// React Native port of the web game's src/hooks/useHotelGame.js.
// Same GameStore, same server protocol; only the platform hooks differ
// (MMKV instead of localStorage, NetInfo/AppState instead of window events).
import './platform/polyfills';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';
import { GameStore } from './core/gameStore.js';
import { ENGINE_HASH } from './engine/engine-hash.js';
import { readJson, storage, writeJson } from './platform/storage';
import { gameSessionAPI, hasAccountToken, onSessionChange, readUser } from './platform/api';
import type { GameState, ActionResult, Effect } from './types';

// One store for the app, shared by every component using this hook.
let store: any = null;
function getStore() {
  // GameStore only uses getItem/setItem/removeItem of the Storage interface.
  if (!store) store = new GameStore({ storage: storage as unknown as Storage, api: gameSessionAPI });
  return store;
}

const SYNC_INTERVAL_MS = 15000;
const SYNC_WHEN_PENDING = 200;
const ENGINE_CHECK_MS = 5 * 60 * 1000;
const UPDATE_TRIED_KEY = 'plb.engineUpdate';
const UPDATE_RETRY_MS = 4 * 60 * 1000;

/**
 * The server runs newer rules than this build: fetch the JS update (EAS Update)
 * that carries them and restart into it. Like the web's reload, try once per
 * engine hash every few minutes — the API deploys before the update is published.
 * Returns false when there's nothing to install (dev build, or not published yet).
 */
async function installEngineUpdate(serverHash: string) {
  if (!Updates.isEnabled) return false;
  const last = readJson<{ hash?: string; at?: number }>(UPDATE_TRIED_KEY, {});
  if (last.hash === serverHash && Date.now() - (last.at || 0) < UPDATE_RETRY_MS) return false;
  writeJson(UPDATE_TRIED_KEY, { hash: serverHash, at: Date.now() });
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

let online = true;
NetInfo.addEventListener((s) => {
  online = s.isConnected !== false && s.isInternetReachable !== false;
});

export type SyncInfo = {
  mode: 'guest' | 'account' | null;
  pending: number;
  confirmedSeq: number;
  corrections: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  /** The server runs newer rules than this app build (needs an app/OTA update). */
  outdated: boolean;
};

export default function useHotelGame({ onEffects }: { onEffects?: (effects: Effect[], after: GameState) => void } = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [user, setUser] = useState(() => (hasAccountToken() ? readUser() : null));
  const [sync, setSync] = useState<SyncInfo>({
    mode: null,
    pending: 0,
    confirmedSeq: 0,
    corrections: 0,
    syncing: false,
    lastSyncedAt: null,
    error: null,
    outdated: false,
  });
  const effectsRef = useRef(onEffects);
  useEffect(() => {
    effectsRef.current = onEffects;
  });

  const refreshSync = useCallback((patch: Partial<SyncInfo> = {}) => {
    const s = getStore();
    setSync((prev) => ({ ...prev, mode: s.mode, pending: s.pendingCount, confirmedSeq: s.confirmedSeq, corrections: s.corrections, ...patch }));
  }, []);

  const runSync = useCallback(async () => {
    const s = getStore();
    if (s.mode !== 'account' || !s.pendingCount || !online) return;
    refreshSync({ syncing: true });
    const ok = await s.sync();
    refreshSync({ syncing: false, ...(ok ? { lastSyncedAt: Date.now(), error: null } : { error: s.lastSyncError ? 'sync_failed' : null }) });
  }, [refreshSync]);

  // When the server's rules change every sync disagrees and the game keeps
  // jumping back. Sync what's queued, then install the OTA update with the new
  // engine; if none is published yet, show "Update app" (the server still wins).
  const checkEngine = useCallback(async () => {
    const s = getStore();
    if (!online || s.mode !== 'account') return;
    let engineHash: string | undefined;
    try {
      ({ engineHash } = await gameSessionAPI.engineInfo());
    } catch {
      return; // offline / API down: keep the last answer
    }
    const outdated = Boolean(engineHash && engineHash !== ENGINE_HASH);
    if (outdated && engineHash) {
      if (s.pendingCount) await s.sync().catch(() => {});
      s.persist();
      if (await installEngineUpdate(engineHash)) return;
    }
    refreshSync({ outdated });
  }, [refreshSync]);

  const lastCorrections = useRef(0);
  useEffect(() => {
    if (sync.corrections > lastCorrections.current) {
      lastCorrections.current = sync.corrections;
      checkEngine();
    }
  }, [sync.corrections, checkEngine]);

  useEffect(() => {
    const s = getStore();
    const unsubscribe = s.subscribe((next: GameState) => setState(next));

    const init = async () => {
      const account = hasAccountToken() ? readUser() : null;
      setUser(account);
      const userId = account && account.id ? account.id : null;
      try {
        // Signing in attaches this phone's hotel to the account (a new guest game
        // is adopted; otherwise the account's server hotel wins). Signing out
        // starts a guest hotel; the account's hotel stays on the server.
        await s.init({ userId, online, hotelName: account?.hotel?.name, hotelType: account?.hotel?.type });
      } catch {
        // Server unreachable or session problem: keep playing locally.
        if (!s.state) await s.init({ userId, online: false });
        refreshSync({ error: 'offline' });
      }
      setState(s.state);
      refreshSync();
      checkEngine();
    };
    init();
    const offSession = onSessionChange(() => init());

    let wasOnline = online;
    const offNet = NetInfo.addEventListener((n) => {
      const nowOnline = n.isConnected !== false && n.isInternetReachable !== false;
      if (nowOnline && !wasOnline) init(); // attach / sync once back online
      wasOnline = nowOnline;
    });
    const timer = setInterval(runSync, SYNC_INTERVAL_MS);
    const engineTimer = setInterval(checkEngine, ENGINE_CHECK_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        s.persist();
        runSync();
      }
    });
    return () => {
      unsubscribe();
      offSession();
      offNet();
      clearInterval(timer);
      clearInterval(engineTimer);
      appState.remove();
      s.persist();
    };
  }, [refreshSync, runSync, checkEngine]);

  // Persist shortly after changes (state is ~40 KB; avoid writing every tick).
  useEffect(() => {
    if (!state) return undefined;
    const t = setTimeout(() => getStore().persist(), 1000);
    return () => clearTimeout(t);
  }, [state]);

  const dispatch = useCallback(
    (type: string, payload?: object): ActionResult => {
      const s = getStore();
      if (!s.state) return { ok: false, error: 'not_ready', effects: [] };
      const result: ActionResult = s.dispatch(type, payload);
      if (result.effects && result.effects.length && effectsRef.current) effectsRef.current(result.effects, s.state);
      if (s.pendingCount >= SYNC_WHEN_PENDING) runSync();
      else refreshSync();
      return result;
    },
    [refreshSync, runSync]
  );

  const newGame = useCallback(
    async (opts: { hotelName?: string; hotelType?: string }) => {
      await getStore().newGame(opts);
      refreshSync();
    },
    [refreshSync]
  );

  /** Continue from a verified cloud save (replaces the current session). */
  const restoreSave = useCallback(
    async (saveId: string) => {
      await getStore().restoreSave(saveId);
      refreshSync();
    },
    [refreshSync]
  );

  /** Guests only: load a snapshot saved on this phone. */
  const loadLocalSnapshot = useCallback(
    (snapshot: GameState) => {
      getStore().loadLocalSnapshot(snapshot);
      refreshSync();
    },
    [refreshSync]
  );

  /** Make sure the server has everything (e.g. before a cloud save). */
  const flush = useCallback(async () => {
    await runSync();
    return getStore().pendingCount === 0;
  }, [runSync]);

  return { state, dispatch, sync, newGame, restoreSave, loadLocalSnapshot, flush, user };
}

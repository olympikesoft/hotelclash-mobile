// The app runs the same engine + GameStore as the web game (synced copies in
// game/engine and game/core). These tests play through those copies the way the
// app does, so a bad sync or a platform assumption shows up before a build.
import { GameStore } from '../core/gameStore.js';
import { ONBOARDING_STEPS } from '../core/onboarding.js';
import { data, insights } from '../engine/index.js';
import { explainRejection } from '../ui/Modals';

function memoryStorage() {
  const mem = new Map<string, string>();
  return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), mem };
}

async function guestGame() {
  let t = Date.UTC(2026, 10, 1, 12);
  const storage = memoryStorage();
  const store = new GameStore({ storage: storage as unknown as Storage, api: {}, now: () => t });
  await store.init({ userId: null });
  const tick = (n: number, ms = 3000) => {
    for (let i = 0; i < n; i++) {
      t += ms;
      expect(store.dispatch('TICK').ok).toBe(true);
    }
  };
  return { store, storage, tick, advance: (ms: number) => (t += ms) };
}

describe('shared game in the app', () => {
  it('plays a guest hotel and persists it', async () => {
    const { store, storage, tick } = await guestGame();
    tick(30);
    expect(store.state.day).toBe(31);
    expect(store.dispatch('BUILD_ROOM', { roomType: 'Standard' }).ok).toBe(true);
    expect(store.dispatch('HIRE_STAFF', { role: 'Housekeeper' }).ok).toBe(true);
    store.persist();
    const saved = JSON.parse(storage.getItem('hotelClash.engine.v1')!);
    expect(saved.mode).toBe('guest');
    expect(saved.current.day).toBe(31);
  });

  it('pays away earnings after a long gap, 2× when doubled, once', async () => {
    const { store, tick, advance } = await guestGame();
    tick(40);
    store.state.stats.avgDayProfit = 1000; // a profitable hotel (the engine smooths real profit)
    advance(2 * 3600_000);
    // First action back (not a TICK, which would also run a day and move the average).
    const r = store.dispatch('SET_POLICY', { key: 'petFriendly', value: true });
    const away: any = r.effects.find((e: any) => e.kind === 'awayEarnings');
    expect(away.amount).toBe(1000 * data.AWAY_EARNINGS.profitDaysPerHour * 2);
    const before = store.state.money;
    expect(store.dispatch('CLAIM_AWAY_EARNINGS', { doubled: true }).ok).toBe(true);
    expect(store.state.money - before).toBe(away.amount * 2);
    expect(store.dispatch('CLAIM_AWAY_EARNINGS', {}).error).toBe('nothing_to_claim');
  });

  it('enforces reward limits the Rewards tab relies on', async () => {
    const { store, tick } = await guestGame();
    tick(2);
    expect(store.dispatch('CLAIM_SOCIAL_REWARD', { rewardId: 'share_whatsapp' }).ok).toBe(true);
    expect(store.dispatch('CLAIM_SOCIAL_REWARD', { rewardId: 'share_whatsapp' }).error).toBe('already_claimed');
    for (let i = 0; i < data.WHEEL_SPINS_PER_DAY; i++) expect(store.dispatch('SPIN_WHEEL').ok).toBe(true);
    expect(store.dispatch('SPIN_WHEEL').error).toBe('no_spins_left');
  });

  it('exposes the insights and onboarding the screens read', async () => {
    const { store, tick } = await guestGame();
    tick(5);
    const S = store.state;
    expect(insights.economics(S)).toEqual(expect.objectContaining({ lastProfit: expect.any(Number), occupancy: expect.any(Number) }));
    expect(insights.levelProgress(S)).toEqual(expect.objectContaining({ level: 1, progress: expect.any(Number) }));
    expect(insights.debtStatus(S).inDebt).toBe(false);
    expect(ONBOARDING_STEPS.length).toBeGreaterThan(5);
    expect(ONBOARDING_STEPS.every((st: any) => typeof st.done(S) === 'boolean')).toBe(true);
  });

  it('explains rejected actions in plain words', () => {
    expect(explainRejection({ error: 'insufficient_funds', effects: [] })).toBe('Not enough cash for that yet.');
    expect(explainRejection({ error: 'whatever', effects: [{ kind: 'notify', message: 'Hire a chef first 💎 tip' }] })).toBe('Hire a chef first');
  });
});

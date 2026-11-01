// Save / load (port of the web's save + load modals in pages/game.js).
// Accounts save to the cloud: the server stores its own verified state, so the
// queue is synced first. Guests keep up to 10 snapshots on this phone.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiError, savesAPI, type SavedGame } from '../platform/api';
import { readJson, writeJson } from '../platform/storage';
import type { GameState } from '../types';
import { Button, C, s, usd } from './kit';

const LOCAL_SAVES_KEY = 'hotelClash.localSaves';
type LocalSave = { id: string; name: string; date: string; day: number; money: number; reputation: number; state: GameState };
type Row = { id: string; name: string; date: string; day: number; money: number; reputation: number; verified?: boolean; local?: LocalSave };

export default function SavesModal({
  open,
  isGuest,
  game,
  flush,
  restoreSave,
  loadLocalSnapshot,
  onLoaded,
  onClose,
  toast,
}: {
  open: boolean;
  isGuest: boolean;
  game: GameState;
  flush: () => Promise<boolean>;
  restoreSave: (saveId: string) => Promise<void>;
  loadLocalSnapshot: (state: GameState) => void;
  onLoaded: (name: string) => void;
  onClose: () => void;
  toast: (tone: 'ok' | 'error' | 'info', text: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (isGuest) {
      setRows(readJson<LocalSave[]>(LOCAL_SAVES_KEY, []).map((l) => ({ ...l, local: l })));
      return;
    }
    setRows(null);
    try {
      setRows(await savesAPI.list());
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Could not load your saves.'));
    }
  }, [isGuest]);

  useEffect(() => {
    if (open) {
      setName(`${game.hotelName || 'My Hotel'} · day ${game.day}`);
      load();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const saveName = name.trim();
    if (!saveName) return;
    setBusy('save');
    try {
      if (isGuest) {
        const snapshot: LocalSave = { id: `${Date.now()}`, name: saveName, date: new Date().toLocaleString(), day: game.day, money: game.money, reputation: game.reputation, state: game };
        writeJson(LOCAL_SAVES_KEY, [snapshot, ...readJson<LocalSave[]>(LOCAL_SAVES_KEY, [])].slice(0, 10));
        toast('ok', `Saved on this phone as "${saveName}".`);
      } else {
        if (!(await flush())) {
          toast('info', "Can't reach the server right now — your progress is safe on this phone and will sync later.");
          return;
        }
        await savesAPI.save(saveName);
        toast('ok', `Saved to the cloud as "${saveName}".`);
      }
      await load();
    } catch (err) {
      toast('error', apiError(err, 'Error saving game.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (row: Row) => {
    if (!isGuest && !row.verified) {
      toast('info', "This save is from before ranked play and can't be restored. Your current hotel keeps all its progress.");
      return;
    }
    setBusy(row.id);
    try {
      if (row.local) loadLocalSnapshot(row.local.state);
      else await restoreSave(row.id);
      onLoaded(row.name);
    } catch (err) {
      toast('error', apiError(err, 'Could not load that save. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: Row) => {
    setBusy(`del-${row.id}`);
    try {
      if (row.local) writeJson(LOCAL_SAVES_KEY, readJson<LocalSave[]>(LOCAL_SAVES_KEY, []).filter((l) => l.id !== row.id));
      else await savesAPI.remove(row.id);
      await load();
    } catch (err) {
      toast('error', apiError(err, 'Could not delete that save.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={[s.between, st.head]}>
            <Text style={st.title}>{isGuest ? '💾 Saves on this phone' : '☁️ Cloud saves'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={st.label}>SAVE THIS HOTEL AS</Text>
            <View style={[s.row, { gap: 8 }]}>
              <TextInput value={name} onChangeText={setName} maxLength={60} style={[st.input, { flex: 1 }]} />
              <Button onPress={save} busy={busy === 'save'} disabled={!name.trim()}>
                Save
              </Button>
            </View>
            <Text style={[s.tiny, { marginTop: 6 }]}>
              {isGuest ? 'Up to 10 saves, kept on this phone only. Create an account to keep your hotel in the cloud.' : 'The server saves its own verified copy, so only ranked progress is stored.'}
            </Text>

            <Text style={[st.label, { marginTop: 18 }]}>LOAD A SAVE</Text>
            {error ? <Text style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</Text> : null}
            {rows == null ? (
              <ActivityIndicator color={C.indigo} style={{ marginVertical: 16 }} />
            ) : rows.length === 0 ? (
              <Text style={s.small}>No saves yet.</Text>
            ) : (
              rows.map((r) => (
                <View key={r.id} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={s.tiny}>
                      Day {r.day} · {usd(r.money || 0)} · {Number(r.reputation || 0).toFixed(1)}★{!isGuest && !r.verified ? ' · old save' : ''}
                    </Text>
                  </View>
                  <Button variant="ghost" busy={busy === r.id} onPress={() => restore(r)}>
                    Load
                  </Button>
                  <Button variant="danger" busy={busy === `del-${r.id}`} onPress={() => remove(r)}>
                    ✕
                  </Button>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', maxHeight: '85%' },
  head: { backgroundColor: C.dark, paddingHorizontal: 18, paddingVertical: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.sub, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
});

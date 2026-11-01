// Pop-ups: new hotel, bankruptcy, level up, random event, welcome back
// (ports of the web's NewGameModal, GameOverModal, LevelUpModal, RandomEventModal)
// and the toasts that answer "did my tap work?".
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameState } from '../types';
import { Button, C, s, usd } from './kit';

function Sheet({ visible, onClose, children }: { visible: boolean; onClose?: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Header({ bg, kicker, title, text, badge }: { bg: string; kicker?: string; title: string; text?: string; badge?: React.ReactNode }) {
  return (
    <View style={[st.header, { backgroundColor: bg }]}>
      {badge}
      {kicker ? <Text style={st.kicker}>{kicker}</Text> : null}
      <Text style={st.title}>{title}</Text>
      {text ? <Text style={st.text}>{text}</Text> : null}
    </View>
  );
}

export function NewGameModal({ open, defaultName, isGuest, onConfirm, onClose }: { open: boolean; defaultName?: string; isGuest: boolean; onConfirm: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(defaultName || 'My Hotel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(name.trim() || 'My Hotel');
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={open} onClose={onClose}>
      <Header bg={C.dark} title="🏨 Start a new hotel" text="Day 1, $100,000 and two rooms. Your current hotel will be closed." />
      <View style={st.body}>
        <Text style={st.label}>HOTEL NAME</Text>
        <TextInput value={name} onChangeText={setName} maxLength={80} style={st.input} />
        <Text style={[s.small, st.note]}>
          • Your current hotel's progress ends here{isGuest ? '' : ' (cloud saves you made stay available)'}.{'\n'}
          {isGuest ? '• Tip: guest progress lives on this phone only.' : '• Your coins carry over.'}
        </Text>
        {error ? <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text> : null}
        <View style={[s.row, { gap: 8, justifyContent: 'flex-end', marginTop: 12 }]}>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={start} busy={busy}>
            Start new hotel
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

export function GameOverModal({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const g = game.gameOver;
  if (!g) return null;
  const stats: [string, string | number][] = [
    ['Days in business', g.day],
    ['Guests served', (g.guestsServed || 0).toLocaleString('en-US')],
    ['Hotel level', g.hotelLevel],
    ['Achievements', g.achievements],
  ];
  return (
    <Sheet visible>
      <Header bg="#9f1239" kicker="🏦" title="Bankrupt" text={`The bank closed ${game.hotelName} on day ${g.day} — ${g.reason}, owing ${usd(g.debt || 0)}.`} />
      <View style={st.body}>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {stats.map(([label, value]) => (
            <View key={label} style={st.statBox}>
              <Text style={s.tiny}>{label.toUpperCase()}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.small, { textAlign: 'center', marginVertical: 12 }]}>Watch payroll against revenue, keep prices near the sweet spot and expand only when rooms are full.</Text>
        <Button big onPress={onNewGame}>
          Start a new hotel
        </Button>
      </View>
    </Sheet>
  );
}

/** Where to go to use something that just unlocked. */
const tabFor = (unlock: string) => (/ rooms$/.test(unlock) ? 'rooms' : / campaign$/.test(unlock) ? 'marketing' : 'facilities');

export function LevelUpModal({
  levelUp,
  next,
  onGo,
  onClose,
  onSaveHotel,
}: {
  levelUp: { level: number; bonus: number; unlocks: string[] } | null;
  next: any;
  onGo: (tab: 'rooms' | 'marketing' | 'facilities') => void;
  onClose: () => void;
  /** Guests: offer a free account to keep the hotel. */
  onSaveHotel?: () => void;
}) {
  if (!levelUp) return null;
  return (
    <Sheet visible onClose={onClose}>
      <Header
        bg="#6d28d9"
        badge={
          <View style={st.levelBadge}>
            <Text style={st.levelBadgeText}>{levelUp.level}</Text>
          </View>
        }
        kicker="👑 LEVEL UP"
        title={`Your hotel reached level ${levelUp.level}`}
      />
      {levelUp.bonus > 0 && <Text style={st.bonus}>+{usd(levelUp.bonus)} bonus</Text>}
      <View style={st.body}>
        {levelUp.unlocks.length > 0 ? (
          <>
            <Text style={[st.label, { marginBottom: 6 }]}>UNLOCKED</Text>
            {levelUp.unlocks.map((u) => (
              <Pressable key={u} onPress={() => onGo(tabFor(u))} style={[s.between, st.unlock]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>🔓 {u}</Text>
                <Text style={{ color: C.faint }}>→</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={s.small}>Your hotel is worth more and pays out a level bonus. Keep growing!</Text>
        )}
        {next && !next.max && (
          <Text style={st.nextGoal}>
            🎯 <Text style={{ fontWeight: '700' }}>Next goal:</Text> level {next.next} at {usd(next.threshold)} hotel value
            {next.unlocks.length ? ` — unlocks ${next.unlocks.slice(0, 2).join(', ')}${next.unlocks.length > 2 ? '…' : ''}` : ''}.
          </Text>
        )}
        <View style={[s.row, { gap: 8, marginTop: 12 }]}>
          {onSaveHotel && (
            <Button big onPress={onSaveHotel} style={{ flex: 1, backgroundColor: '#fbbf24' }}>
              <Text style={{ color: '#0f172a', fontWeight: '900' }}>Save my hotel</Text>
            </Button>
          )}
          <Button big variant="dark" onPress={onClose} style={{ flex: 1 }}>
            Continue
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

export function EventModal({ event, onClose }: { event: { title: string; description: string; result: string } | null; onClose: () => void }) {
  if (!event) return null;
  return (
    <Sheet visible onClose={onClose}>
      <Header bg="#0369a1" kicker="🎯 EVENT" title={event.title} text={event.description} />
      <View style={st.body}>
        <Text style={{ fontSize: 14, color: '#1e293b', marginBottom: 12 }}>{event.result}</Text>
        <Button big onPress={onClose}>
          Continue
        </Button>
      </View>
    </Sheet>
  );
}

const awayText = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m} min`;
};

/** Away earnings (engine CLAIM_AWAY_EARNINGS): collect, or watch an ad for 2×. */
export function AwayModal({
  away,
  adReady,
  busy,
  onCollect,
  onDouble,
}: {
  away: { ms: number; amount: number } | null;
  adReady: boolean;
  busy: boolean;
  onCollect: () => void;
  onDouble: () => void;
}) {
  if (!away) return null;
  return (
    <Sheet visible onClose={onCollect}>
      <Header bg="#047857" kicker="👋 WELCOME BACK" title={`Your hotel earned ${usd(away.amount)}`} text={`While you were away (${awayText(away.ms)}), guests kept checking in.`} />
      <View style={st.body}>
        <Button big variant="green" onPress={onDouble} disabled={!adReady} busy={busy}>
          {adReady ? `▶ Watch ad · collect ${usd(away.amount * 2)}` : 'Ad loading…'}
        </Button>
        <Button big variant="ghost" onPress={onCollect} disabled={busy} style={{ marginTop: 8 }}>
          Collect {usd(away.amount)}
        </Button>
      </View>
    </Sheet>
  );
}

export type Toast = { id: number; tone: 'ok' | 'error' | 'info'; text: string };
const TOAST_BG = { ok: '#059669', error: '#e11d48', info: '#1e293b' };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <View pointerEvents="box-none" style={st.toasts}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => onDismiss(t.id)} style={[st.toast, { backgroundColor: TOAST_BG[t.tone] }]}>
          <Text style={st.toastText}>
            {t.tone === 'ok' ? '✓ ' : t.tone === 'error' ? '! ' : ''}
            {t.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const REASONS: Record<string, string> = {
  insufficient_funds: 'Not enough cash for that yet.',
  already_built: 'You already have that.',
  missing_staff: 'Hire the required staff first.',
  max_quality: 'That room is already at top quality.',
  max_level: 'Already at the maximum level.',
  already_active: 'That campaign is already running.',
  cooldown: 'That bonus is cooling down — try again later.',
  game_over: 'Your hotel is closed. Start a new hotel from the menu.',
  not_ready: 'Still loading your hotel…',
};

/** Human explanation of a rejected action (engine message first, then the code). */
export function explainRejection(result: { error?: string; effects?: { kind: string; message?: string }[] }) {
  const note = (result.effects || []).find((e) => e.kind === 'notify');
  if (note && note.message) return note.message.replace(/\s*💎.*$/, '').trim();
  return REASONS[result.error || ''] || 'That action is not possible right now.';
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.7)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 6 },
  body: { padding: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.sub },
  input: { marginTop: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
  note: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, lineHeight: 18 },
  statBox: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10 },
  levelBadge: { width: 72, height: 72, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  levelBadgeText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bonus: { alignSelf: 'center', marginTop: -14, backgroundColor: '#fbbf24', color: '#0f172a', fontWeight: '800', fontSize: 14, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  unlock: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: C.line },
  nextGoal: { marginTop: 10, backgroundColor: C.indigoSoft, color: '#312e81', borderRadius: 12, padding: 10, fontSize: 13 },
  toasts: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center', gap: 8 },
  toast: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 420, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

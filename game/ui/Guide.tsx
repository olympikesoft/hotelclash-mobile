// New-player help: the "Getting started" checklist on the Dashboard and the
// How to play pages (ports of the web's GettingStarted.js and HowToPlayModal.js).
// Steps come from the shared onboarding.js and tick themselves off from the state.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ONBOARDING_STEPS } from '../core/onboarding.js';
import { readJson, storage, writeJson } from '../platform/storage';
import type { GameState } from '../types';
import { Button, C, s } from './kit';

const KEY = 'hotelClash.onboarding';
type Saved = { done: string[]; hidden: boolean };
type Step = { id: string; title: string; how: string; tab: string; done: (S: GameState) => boolean };
const STEPS = ONBOARDING_STEPS as Step[];

export const resetOnboarding = () => storage.removeItem(KEY);

export function GettingStarted({ game, onNavigate }: { game: GameState; onNavigate: (tab: string) => void }) {
  const [saved, setSaved] = useState<Saved>(() => readJson<Saved>(KEY, { done: [], hidden: false }));
  const [open, setOpen] = useState(false);

  // Remember newly completed steps (they stay ticked).
  const nowDone = STEPS.filter((st) => st.done(game)).map((st) => st.id);
  const newly = nowDone.filter((id) => !saved.done.includes(id));
  useEffect(() => {
    if (!newly.length) return;
    const next = { ...saved, done: [...saved.done, ...newly] };
    setSaved(next);
    writeJson(KEY, next);
  }, [newly.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (saved.hidden) return null;
  const done = new Set([...saved.done, ...nowDone]);
  const count = STEPS.filter((st) => done.has(st.id)).length;
  const current = STEPS.find((st) => !done.has(st.id));
  const hide = () => {
    const next = { ...saved, hidden: true };
    setSaved(next);
    writeJson(KEY, next);
  };

  if (!current) {
    return (
      <View style={[st.box, { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>🎉 You know the basics! Now grow your hotel to 5 stars and Level 5.</Text>
        <Button variant="ghost" style={{ marginTop: 8 }} onPress={hide}>
          Close guide
        </Button>
      </View>
    );
  }

  return (
    <View style={st.box}>
      <View style={s.between}>
        <Text style={st.kicker}>
          🧭 GETTING STARTED · STEP {count + 1} OF {STEPS.length}
        </Text>
        <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Hide guide">
          <Text style={{ color: C.faint, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginTop: 2 }}>{current.title}</Text>
      <Text style={[s.small, { marginTop: 2 }]}>{current.how}</Text>
      <View style={[s.row, { gap: 12, marginTop: 8 }]}>
        <Button onPress={() => onNavigate(current.tab)}>Show me →</Button>
        <Pressable onPress={() => setOpen((v) => !v)}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.indigo }}>All steps {open ? '▲' : '▼'}</Text>
        </Pressable>
      </View>
      <View style={st.track}>
        <View style={[st.fill, { width: `${(count / STEPS.length) * 100}%` }]} />
      </View>
      {open &&
        STEPS.map((step) => {
          const ok = done.has(step.id);
          return (
            <Pressable key={step.id} onPress={() => onNavigate(step.tab)} style={{ paddingVertical: 5 }}>
              <Text style={{ fontSize: 13, color: ok ? C.faint : step === current ? C.text : '#334155', fontWeight: step === current ? '700' : '400', textDecorationLine: ok ? 'line-through' : 'none' }}>
                {ok ? '✅' : '⚪'} {step.title}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const PAGES: { title: string; blocks: { head?: string; text: string; tone?: string }[] }[] = [
  {
    title: 'Welcome to PlayLobbyboss!',
    blocks: [
      { text: 'Welcome to your new career as a hotel manager! Build, expand and manage a successful hotel while dealing with the challenges of the hospitality industry.' },
      { head: '💵 Make money', text: 'Build rooms, hire staff and provide amenities to attract guests and earn revenue.', tone: C.skySoft },
      { head: '⭐ Build reputation', text: 'Keep guests happy to improve your rating and attract more high-paying customers.', tone: C.skySoft },
    ],
  },
  {
    title: 'Game basics',
    blocks: [
      { head: '🛏️ Rooms', text: 'Build different room types, from Standard to Penthouse. Better rooms attract wealthier guests.', tone: C.skySoft },
      { head: '👥 Staff', text: 'Hire staff to run your hotel. Housekeepers keep rooms up, receptionists bring bookings.', tone: C.skySoft },
      { head: '✨ Facilities', text: 'Restaurants, bars and spas earn extra income and attract specific guest types.', tone: C.skySoft },
      { head: '⏸ ▶ ⏩ Speed', text: 'Use the speed buttons at the top to pause, play or fast-forward. Pause for big decisions!', tone: C.amberSoft },
    ],
  },
  {
    title: 'Success strategies',
    blocks: [
      { head: 'Early game', text: 'Build a few Standard rooms, price them near the sweet spot and keep them full. Hire as rooms grow.', tone: C.greenSoft },
      { head: 'Mid game', text: 'Mix Standard and Deluxe rooms, open your first facilities and run marketing campaigns. Watch your rivals.', tone: C.skySoft },
      { head: 'Late game', text: 'Add luxury rooms and high-end facilities, keep a full team and push your market share above 50%.', tone: C.violetSoft },
      { head: '⚖️ Balance is key', text: "Don't expand too quickly: make sure you can afford daily salaries and upkeep first.", tone: C.amberSoft },
    ],
  },
  {
    title: 'Random events',
    blocks: [
      { text: 'Conferences and celebrity visits help; bad weather, repairs and inspections hurt. Disasters grow bigger as your hotel gets richer.' },
      { head: '🛡️ Insurance', text: 'Insurance in the Finance tab caps what a single disaster can cost you.', tone: C.redSoft },
    ],
  },
  {
    title: 'Competition & marketing',
    blocks: [
      { head: '🏢 Rivals', text: "Guests compare your prices, facilities and rating with the other hotels in town. Market share is how much of the town's guests you win.", tone: C.skySoft },
      { head: '📣 Campaigns', text: 'Campaigns bring more guests while they run: local ads, social media, discounts, luxury packages, or taking guests from rivals.', tone: C.violetSoft },
    ],
  },
  {
    title: 'Final tips',
    blocks: [
      { head: '📜 Policies', text: 'Pet-friendly rooms, early check-in or breakfast attract specific guest types for a daily cost.', tone: C.skySoft },
      { head: '🌸 Seasons', text: 'Seasons change bookings and what guests want. Adapt your strategy.', tone: C.skySoft },
      { head: '🏦 Avoid bankruptcy', text: 'Debt costs interest and the bank closes hotels that stay deep in debt. Keep a safety buffer.', tone: C.redSoft },
      { head: "You're ready!", text: 'Good luck with your hotel empire. Setbacks are part of learning!', tone: '#dcfce7' },
    ],
  },
];

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  const close = () => {
    setPage(0);
    onClose();
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={[s.between, st.head]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>❓ {p.title}</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {p.blocks.map((b, i) => (
              <View key={i} style={b.tone ? { backgroundColor: b.tone, borderRadius: 12, padding: 10 } : null}>
                {b.head ? <Text style={{ fontWeight: '700', color: C.text, marginBottom: 2 }}>{b.head}</Text> : null}
                <Text style={{ fontSize: 13, color: '#334155' }}>{b.text}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[s.between, { padding: 12, borderTopWidth: 1, borderTopColor: C.line }]}>
            <Text style={s.tiny}>
              Page {page + 1} of {PAGES.length}
            </Text>
            <View style={[s.row, { gap: 8 }]}>
              <Button variant="ghost" disabled={page === 0} onPress={() => setPage(page - 1)}>
                ‹ Previous
              </Button>
              <Button onPress={() => (page < PAGES.length - 1 ? setPage(page + 1) : close())}>{page < PAGES.length - 1 ? 'Next ›' : 'Finish'}</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 2, borderColor: '#c7d2fe', marginBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#6366f1', flex: 1 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#e0e7ff', overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', backgroundColor: '#6366f1' },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  head: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 14 },
});

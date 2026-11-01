// Top bar: hotel + level progress, resources, speed controls and menu
// (port of the web's components/game/GameHud.js).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { insights } from '../catalog';
import type { GameState } from '../types';
import type { SyncInfo } from '../useHotelGame';

const SEASON_ICON: Record<string, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
const compact = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${Math.round(v / 1e3)}k` : Math.round(v).toLocaleString('en-US');
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

/** "+1,234" bubble next to cash for a moment whenever cash changes. */
function useDelta(value: number) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (!d) return undefined;
    setDelta(d);
    const t = setTimeout(() => setDelta(null), 1600);
    return () => clearTimeout(t);
  }, [value]);
  return delta;
}

/** Thin bar that fills until the next day. */
function DayClock({ day, ms, running }: { day: number; ms: number; running: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (!running) return undefined;
    const anim = Animated.timing(progress, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [day, ms, running, progress]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={st.clockTrack}>
      <Animated.View style={[st.clockFill, { width }]} />
    </View>
  );
}

function Resource({ icon, label, value, color, footer, badge }: { icon: string; label: string; value: string; color: string; footer?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <View style={st.resource}>
      <Text style={st.resIcon}>{icon}</Text>
      <View>
        <Text style={st.resLabel}>{label}</Text>
        <Text style={[st.resValue, { color }]}>{value}</Text>
      </View>
      {badge}
      {footer}
    </View>
  );
}

export type MenuItem = { icon: string; label: string; onPress: () => void };

const SPEEDS = [
  { speed: 0, label: '⏸' },
  { speed: 1, label: '▶' },
  { speed: 2, label: '⏩' },
];

export default function Hud({
  game,
  speed,
  onSpeed,
  sync,
  dayMs,
  menu,
}: {
  game: GameState;
  speed: number;
  onSpeed: (s: number) => void;
  sync: SyncInfo;
  dayMs: number;
  menu: MenuItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const level = insights.levelProgress(game);
  const delta = useDelta(Math.round(game.money));
  const profit = insights.economics(game).lastProfit;
  const rep = game.reputation || 0;

  return (
    <View style={st.hud}>
      <View style={st.top}>
        <View style={st.identity}>
          <View style={st.levelBadge}>
            <Text style={st.levelText}>{level.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.hotelName} numberOfLines={1}>
              {game.hotelName || 'My Hotel'}
            </Text>
            <View style={st.levelRow}>
              <View style={st.levelTrack}>
                <View style={[st.levelFill, { width: `${Math.round(level.progress * 100)}%` }]} />
              </View>
              <Text style={st.levelNext}>{level.max ? 'MAX' : `next Lv ${level.next}`}</Text>
            </View>
          </View>
        </View>

        <View style={st.speeds}>
          {SPEEDS.map((sp) => (
            <Pressable
              key={sp.speed}
              onPress={() => onSpeed(sp.speed)}
              style={[st.speedBtn, speed === sp.speed && { backgroundColor: sp.speed === 0 ? '#f43f5e' : '#10b981' }]}
              accessibilityLabel={['Pause', 'Play', 'Fast'][sp.speed]}
            >
              <Text style={st.speedText}>{sp.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setMenuOpen(true)} style={st.menuBtn} accessibilityLabel="Game menu">
          <Text style={st.menuDots}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.resources}>
        <Resource
          icon="💵"
          label={game.day > 1 ? `Cash · ${profit >= 0 ? '+' : '−'}${compact(Math.abs(profit))}/day` : 'Cash'}
          value={money(game.money)}
          color={game.money < 0 ? '#fb7185' : '#6ee7b7'}
          badge={
            delta ? (
              <Text style={[st.delta, { backgroundColor: delta > 0 ? '#10b981' : '#f43f5e' }]}>
                {delta > 0 ? '+' : '−'}
                {compact(Math.abs(delta))}
              </Text>
            ) : null
          }
        />
        <Resource icon="💎" label="Credits" value={Math.round(game.credits || 0).toLocaleString('en-US')} color="#f0abfc" />
        <Resource
          icon={SEASON_ICON[game.season] || '☀️'}
          label="Day"
          value={String(game.day)}
          color="#7dd3fc"
          footer={<DayClock day={game.day} ms={dayMs} running={speed > 0} />}
        />
        <Resource icon="⭐" label="Rating" value={`${rep.toFixed(1)}/5`} color="#fcd34d" />
        <Resource icon="📊" label="Market" value={`${Number(game.marketShare || 0).toFixed(1)}%`} color="#a5b4fc" />
        {sync.mode === 'account' && (
          <Resource
            icon={sync.error ? '⚠️' : sync.pending ? '⏳' : '☁️'}
            label="Cloud"
            value={sync.outdated ? 'Update app' : sync.error ? 'Offline' : sync.pending ? `${sync.pending} to sync` : 'Saved'}
            color="#cbd5e1"
          />
        )}
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={st.menu}>
            {menu.map((m) => (
              <Pressable
                key={m.label}
                style={({ pressed }) => [st.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => {
                  setMenuOpen(false);
                  m.onPress();
                }}
              >
                <Text style={st.menuText}>
                  {m.icon} {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  hud: { backgroundColor: '#020617', paddingTop: 8, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  levelBadge: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center' },
  levelText: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  hotelName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  levelTrack: { width: 90, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: '#fcd34d', borderRadius: 3 },
  levelNext: { color: '#94a3b8', fontSize: 10 },
  speeds: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 2 },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  speedText: { color: '#fff', fontSize: 13 },
  menuBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  menuDots: { color: '#cbd5e1', fontSize: 20, lineHeight: 22 },
  resources: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  resource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  resIcon: { fontSize: 15 },
  resLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8' },
  resValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  delta: { position: 'absolute', top: 2, right: 4, color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  clockTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  clockFill: { height: '100%', backgroundColor: '#38bdf8' },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.4)', alignItems: 'flex-end', paddingTop: 90, paddingRight: 12 },
  menu: { width: 220, backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  menuText: { color: '#e2e8f0', fontSize: 14 },
});

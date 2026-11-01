// Overview: yesterday's results, cash trend, goals, quick actions, advice and
// the floor plan (port of the web's components/game/Dashboard.js; the street
// scene and full charts come in a later phase).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { insights, type RoomType } from '../catalog';
import type { GameState } from '../types';
import type { DayPoint } from '../useDayHistory';
import { C, Card, Meter, s, shortUsd, usd } from './kit';

export type Tab = 'dashboard' | 'rooms' | 'staff' | 'facilities' | 'marketing';

const TIP_TONE: Record<string, [string, string]> = {
  danger: [C.redSoft, '#9f1239'],
  warn: [C.amberSoft, '#78350f'],
  good: [C.greenSoft, '#065f46'],
  info: [C.skySoft, '#0c4a6e'],
};

function Kpi({ label, value, sub, tone = C.text, trend }: { label: string; value: string; sub?: string; tone?: string; trend?: number | null }) {
  return (
    <View style={[s.stat, { borderRadius: 16 }]}>
      <View style={s.between}>
        <Text style={s.small}>{label}</Text>
        {trend != null && trend !== 0 && (
          <Text style={{ fontSize: 11, fontWeight: '700', color: trend > 0 ? C.green : C.red }}>
            {trend > 0 ? '▲' : '▼'} {shortUsd(Math.abs(trend)).replace('$', '')}
          </Text>
        )}
      </View>
      <Text style={[st.kpiValue, { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={s.tiny} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Daily profit as bars (green = profit, red = loss), last 30 days. */
function ProfitBars({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.profit)));
  return (
    <View style={st.bars}>
      {data.map((d) => (
        <View key={d.day} style={st.barSlot}>
          <View style={[st.bar, { height: `${Math.max(4, (Math.abs(d.profit) / max) * 100)}%`, backgroundColor: d.profit >= 0 ? '#34d399' : '#fb7185' }]} />
        </View>
      ))}
    </View>
  );
}

function RoomGrid({ rooms }: { rooms: GameState['rooms'] }) {
  return (
    <View style={st.grid}>
      {rooms.map((r) => {
        const state = r.underMaintenance ? 'repair' : r.occupied ? 'busy' : 'free';
        return (
          <View key={r.id} style={[st.tile, state === 'busy' ? st.tileBusy : state === 'repair' ? st.tileRepair : null]}>
            <Text style={{ fontSize: 12 }}>{state === 'busy' ? '🧑' : state === 'repair' ? '🔧' : '🛏️'}</Text>
            <Text style={[st.tilePrice, state === 'busy' && { color: '#fff' }]}>${r.price}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Dashboard({
  game,
  history,
  cheapestRoom,
  onNavigate,
  onQuickBuild,
}: {
  game: GameState;
  history: DayPoint[];
  cheapestRoom: RoomType | null;
  onNavigate: (tab: Tab) => void;
  onQuickBuild: () => void;
}) {
  const e = useMemo(() => insights.economics(game), [game]);
  const level = useMemo(() => insights.levelProgress(game), [game]);
  const goals = useMemo(() => insights.nextAchievements(game, 3), [game]);
  const tips: { text: string; level: string; tab?: Tab }[] = useMemo(() => insights.advice(game), [game]);
  const challenge = useMemo(() => insights.challengeStatus(game), [game]);
  const season = insights.SEASONS[game.season] || insights.SEASONS.spring;

  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const chart = history.slice(-30);
  const canBuildRoom = cheapestRoom && game.money + (game.credits || 0) >= cheapestRoom.baseCost;

  const quick = [
    { icon: '🔨', label: cheapestRoom ? `Build ${cheapestRoom.type}` : 'Build room', sub: cheapestRoom ? usd(cheapestRoom.baseCost) : '', disabled: !canBuildRoom, onPress: onQuickBuild },
    { icon: '🧑‍💼', label: 'Hire staff', sub: `${game.staff.length} on payroll`, onPress: () => onNavigate('staff') },
    { icon: '📣', label: 'Marketing', sub: 'Fill empty rooms', onPress: () => onNavigate('marketing') },
    { icon: '✨', label: 'Facilities', sub: 'Extra guest spending', onPress: () => onNavigate('facilities') },
  ];

  return (
    <View>
      <View style={s.statRow}>
        <Kpi label="Revenue / day" value={usd(e.lastRevenue)} sub={`${usd(e.lastRoomIncome)} rooms · ${usd(e.lastFacilityIncome)} facilities`} trend={prev ? e.lastRevenue - prev.revenue : null} />
        <Kpi label="Costs / day" value={usd(e.expenses)} sub={`Staff ${shortUsd(e.payroll)} · Upkeep ${shortUsd(e.roomUpkeep + e.facilityUpkeep)}`} />
        <Kpi
          label="Profit / day"
          value={usd(e.lastProfit)}
          tone={e.lastProfit >= 0 ? C.green : C.red}
          sub={e.lastProfit >= 0 ? 'Making money' : 'Losing money'}
          trend={prev ? e.lastProfit - prev.profit : null}
        />
        <Kpi
          label="Occupancy"
          value={`${Math.round(e.occupancy * 100)}%`}
          sub={`${e.occupiedRooms}/${e.usableRooms} rooms · ${game.guests.length} guests`}
          tone={e.occupancy >= 0.7 ? C.green : e.occupancy < 0.4 ? C.amber : C.text}
        />
      </View>

      <View style={st.quick}>
        {quick.map((q) => (
          <Pressable key={q.label} onPress={q.onPress} disabled={q.disabled} style={({ pressed }) => [st.quickBtn, q.disabled && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
            <Text style={st.quickIcon}>{q.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>
                {q.label}
              </Text>
              <Text style={s.tiny} numberOfLines={1}>
                {q.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={[s.title, { marginBottom: 8 }]}>📈 Cash & profit</Text>
        {chart.length < 2 ? (
          <Text style={st.chartEmpty}>Play a couple of days to see your trend.</Text>
        ) : (
          <>
            <Text style={s.small}>Cash {usd(chart[chart.length - 1].money)}</Text>
            <ProfitBars data={chart} />
            <View style={s.between}>
              <Text style={s.tiny}>Day {chart[0].day}</Text>
              <Text style={s.tiny}>Daily profit</Text>
              <Text style={s.tiny}>Day {chart[chart.length - 1].day}</Text>
            </View>
          </>
        )}
      </Card>

      <Card>
        <Text style={[s.title, { marginBottom: 8 }]}>🎯 Goals</Text>
        {challenge && (
          <View style={[st.challenge, { backgroundColor: challenge.onTrack ? C.greenSoft : C.violetSoft }]}>
            <View style={s.between}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={st.challengeKicker}>Daily challenge</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{challenge.description}</Text>
              </View>
              <Text style={st.reward}>
                {challenge.onTrack ? '✓ ' : ''}+{usd(challenge.reward)}
              </Text>
            </View>
            <View style={{ marginTop: 8 }}>
              <Meter value={challenge.progress || 0} max={100} tone={challenge.onTrack ? '#10b981' : C.violet} />
            </View>
            <Text style={[s.tiny, { marginTop: 4 }]}>
              {challenge.onTrack ? 'On track — paid when the day ends.' : `${Math.round(challenge.progress || 0)}% · judged when the day ends`}
            </Text>
          </View>
        )}
        <View style={{ marginBottom: 10 }}>
          <View style={[s.between, { marginBottom: 4 }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>👑 {level.max ? `Level ${level.level} — max` : `Level ${level.next}`}</Text>
            {!level.max && (
              <Text style={s.tiny}>
                {shortUsd(level.value)} / {shortUsd(level.threshold)} hotel value
              </Text>
            )}
          </View>
          <Meter value={level.progress} max={1} tone="#fbbf24" />
          {!level.max && (
            <Text style={[s.tiny, { marginTop: 4 }]}>
              Reward: {usd(level.bonus)}
              {level.unlocks.length ? ` · unlocks ${level.unlocks.slice(0, 3).join(', ')}${level.unlocks.length > 3 ? '…' : ''}` : ''}
            </Text>
          )}
        </View>
        {goals.map((a: any) => (
          <View key={a.id} style={{ marginBottom: 8 }}>
            <View style={[s.between, { marginBottom: 4 }]}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#334155' }} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={{ fontSize: 12, color: C.green }}>+{usd(a.reward)}</Text>
            </View>
            <Meter value={a.progress} max={1} tone="#0ea5e9" />
          </View>
        ))}
        <Text style={[s.tiny, { textAlign: 'right' }]}>{(game.achievements || []).length} achievements unlocked</Text>
      </Card>

      <Card>
        <Text style={[s.title, { marginBottom: 8 }]}>💡 Manager's advice</Text>
        {tips.map((t) => {
          const [bg, fg] = TIP_TONE[t.level] || TIP_TONE.info;
          return (
            <Pressable key={t.text} disabled={!t.tab} onPress={() => t.tab && onNavigate(t.tab)} style={[st.tip, { backgroundColor: bg }]}>
              <Text style={{ flex: 1, fontSize: 13, color: fg }}>{t.text}</Text>
              {t.tab ? <Text style={{ color: fg, opacity: 0.6 }}>›</Text> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <View style={[s.between, { marginBottom: 8 }]}>
          <Text style={s.title}>🏨 Your hotel</Text>
          <Pressable onPress={() => onNavigate('rooms')}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.indigo }}>Manage rooms →</Text>
          </Pressable>
        </View>
        <RoomGrid rooms={game.rooms} />
        <View style={[s.row, { gap: 6, marginTop: 10 }]}>
          {[
            ['Room quality', `${e.roomQuality.toFixed(1)} / 5`],
            ['Guests', game.guests.length ? `${e.guestHappiness.toFixed(1)} / 5` : '—'],
            ['Staff morale', game.staff.length ? `${e.staffHappiness.toFixed(1)} / 5` : '—'],
          ].map(([label, value]) => (
            <View key={label} style={st.mini}>
              <Text style={s.tiny}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={st.season}>
          <Text style={{ flex: 1, fontSize: 12, color: '#475569' }}>
            <Text style={{ fontWeight: '700', color: '#1e293b' }}>{season.label}:</Text> {season.hint}
          </Text>
          <Text style={s.tiny}>{insights.daysToNextSeason(game.day)}d left</Text>
        </View>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  kpiValue: { marginTop: 2, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickBtn: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: C.line },
  quickIcon: { fontSize: 18, backgroundColor: C.indigoSoft, borderRadius: 10, padding: 6, overflow: 'hidden' },
  chartEmpty: { backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 40, textAlign: 'center', fontSize: 13, color: C.faint },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 2, marginVertical: 8 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  challenge: { borderRadius: 12, padding: 10, marginBottom: 12 },
  challengeKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#8b5cf6' },
  reward: { fontSize: 12, fontWeight: '700', color: '#b45309', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: C.line },
  tileBusy: { backgroundColor: '#10b981', borderColor: '#059669' },
  tileRepair: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  tilePrice: { fontSize: 10, fontWeight: '600', color: C.faint },
  mini: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 8, alignItems: 'center' },
  season: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: C.indigoSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
});

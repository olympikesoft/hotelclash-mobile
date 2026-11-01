// Guests: who stays, what they like, the register and latest reviews
// (port of the web's components/game/GuestsTab.js).
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { insights } from '../catalog';
import type { GameState } from '../types';
import type { Note } from './ActivityFeed';
import { C, Card, Chips, Empty, Meter, Pill, Section, Stat, StatRow, TabHeader, s, usd } from './kit';

const TYPE_ICON: Record<string, string> = { Business: '💼', Family: '👶', Leisure: '🌴' };

/** How a guest feels against what this hotel's rating promised them. */
function mood(happiness: number, expected: number) {
  const d = happiness - expected;
  if (d >= 0.75) return { label: 'Delighted', tone: 'green', bar: '#10b981' };
  if (d >= 0) return { label: 'Happy', tone: 'sky', bar: '#0ea5e9' };
  if (d >= -0.75) return { label: 'Disappointed', tone: 'amber', bar: '#fbbf24' };
  return { label: 'Unhappy', tone: 'red', bar: '#f43f5e' };
}

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
const FILTERS = (['All', 'Business', 'Family', 'Leisure'] as const).map((id) => ({ id, label: id }));

type Guest = { id: string | number; name: string; type: string; roomId: number; happiness: number; checkInDay: number; checkoutDay: number; spending?: number };

export default function GuestsTab({ game, notifications }: { game: GameState; notifications: Note[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('All');
  const expected: number = insights.guestExpectation(game.reputation);
  const roomsById = useMemo(() => new Map(game.rooms.map((r) => [r.id, r])), [game.rooms]);
  const guests = (game.guests || []) as Guest[];
  const owned = new Set(game.facilities.map((f) => f.name));

  // Rating change when each guest checks out (engine: (happiness − expectation) × 0.1).
  const impact = guests.reduce((t, g) => t + (Math.min(5, Math.max(1, g.happiness)) - expected) * 0.1, 0);
  const leavingTomorrow = guests.filter((g) => g.checkoutDay === game.day + 1).length;
  const inHouseValue = guests.reduce((t, g) => t + (g.spending || 0), 0);
  const counts: Record<string, number> = { Business: 0, Family: 0, Leisure: 0 };
  for (const g of guests) counts[g.type] = (counts[g.type] || 0) + 1;

  const shown = guests.filter((g) => filter === 'All' || g.type === filter).sort((a, b) => a.happiness - b.happiness);
  const reviews = notifications.filter((n) => n.type === 'guest_review').slice(0, 6);

  return (
    <View>
      <TabHeader icon="🧳" title="Guests" subtitle={`At ${game.reputation.toFixed(1)}★ guests expect a ${expected.toFixed(1)}/5 stay. Beat that and your rating rises when they check out.`} />
      <StatRow>
        <Stat label="In house" value={guests.length} sub={`${game.rooms.length} rooms`} />
        <Stat label="Rating impact" value={signed(impact)} sub="when current guests leave" tone={impact >= 0 ? C.green : C.red} />
        <Stat label="Leaving tomorrow" value={leavingTomorrow} sub="rooms freeing up" />
        <Stat label="Booked stays" value={usd(inHouseValue)} sub="room revenue in house" />
      </StatRow>

      <Section title="Who stays with you" hint="Each guest type books more often when you have the facilities they like.">
        {Object.keys(insights.GUEST_LIKES).map((type) => (
          <Card key={type}>
            <View style={s.between}>
              <Text style={s.title}>
                {TYPE_ICON[type] || '🧑'} {type}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{counts[type] || 0}</Text>
            </View>
            <View style={[s.row, { flexWrap: 'wrap', gap: 4, marginTop: 8 }]}>
              {insights.GUEST_LIKES[type].map((f) => (
                <Pill key={f} tone={owned.has(f) ? 'green' : 'slate'}>
                  {owned.has(f) ? '✓ ' : ''}
                  {f}
                </Pill>
              ))}
            </View>
          </Card>
        ))}
      </Section>

      <Section title="Guest register" hint="Least happy first. A guest's mood is set at check-in by room quality, room type, price and staffing." action={<Chips options={FILTERS} value={filter} onChange={setFilter} />}>
        {shown.length === 0 ? (
          <Empty>No guests right now. Lower prices or run marketing to fill rooms.</Empty>
        ) : (
          shown.map((g) => {
            const room = roomsById.get(g.roomId);
            const m = mood(g.happiness, expected);
            const nights = Math.max(1, g.checkoutDay - g.checkInDay);
            const done = Math.min(nights, Math.max(0, game.day - g.checkInDay));
            return (
              <Card key={g.id}>
                <View style={s.between}>
                  <View style={[s.row, { flex: 1 }]}>
                    <Text style={[s.icon, { backgroundColor: '#f1f5f9' }]}>{TYPE_ICON[g.type] || '🧑'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={s.tiny}>
                        {g.type} · room #{g.roomId} {room ? room.type : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>
                      {done}/{nights} nights
                    </Text>
                    <Text style={s.tiny}>pays {usd(g.spending || 0)}</Text>
                  </View>
                </View>
                <View style={[s.between, { marginTop: 8, marginBottom: 4 }]}>
                  <Pill tone={m.tone}>{m.label}</Pill>
                  <Text style={s.tiny}>
                    {g.happiness.toFixed(1)} / {expected.toFixed(1)} expected
                  </Text>
                </View>
                <Meter value={g.happiness} max={5} tone={m.bar} />
              </Card>
            );
          })
        )}
      </Section>

      {reviews.length > 0 && (
        <Section icon="💬" title="Latest reviews">
          {reviews.map((r) => (
            <Text key={r.id} style={{ backgroundColor: r.isSpecial ? C.greenSoft : '#f8fafc', color: r.isSpecial ? '#064e3b' : '#334155', borderRadius: 12, padding: 10, fontSize: 13, marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.faint }}>Day {r.day} </Text>
              {r.message}
            </Text>
          ))}
        </Section>
      )}
    </View>
  );
}

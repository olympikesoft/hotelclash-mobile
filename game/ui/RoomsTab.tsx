// Rooms: land, building, pricing per room type and every room
// (port of the web's components/game/RoomsTab.js).
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { insights, type RoomType } from '../catalog';
import type { ActionResult, GameState, Room } from '../types';
import { Button, C, Card, Chips, Empty, Meter, Pill, Section, Stars, Stat, StatRow, TabHeader, s, usd } from './kit';

type Guide = { market: number; sweet: number; ceiling: number } | null;

/** Where a price sits against what guests will pay. */
function priceZone(price: number, guide: Guide): { label: string; tone: string } {
  if (!guide) return { label: '', tone: 'slate' };
  if (price > guide.ceiling) return { label: 'Too expensive', tone: 'red' };
  if (price >= guide.sweet) return { label: 'Premium', tone: 'amber' };
  if (price >= guide.market * 0.85) return { label: 'Sweet spot', tone: 'green' };
  return { label: 'Bargain', tone: 'sky' };
}

function Stepper({ value, onChange, step = 10 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <View style={st.stepper}>
      <Pressable onPress={() => onChange(Math.max(10, value - step))} style={st.stepBtn} accessibilityLabel="Lower price">
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepValue}>{usd(value)}</Text>
      <Pressable onPress={() => onChange(value + step)} style={st.stepBtn} accessibilityLabel="Raise price">
        <Text style={st.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

function TypePricing({ type, rooms, guide, onApply }: { type: string; rooms: Room[]; guide: Guide; onApply: (type: string, price: number) => void }) {
  const current = Math.round(rooms.reduce((t, r) => t + r.price, 0) / rooms.length);
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? current;
  const zone = priceZone(value, guide);
  const occupied = rooms.filter((r) => r.occupied).length;
  const apply = (price: number) => {
    onApply(type, price);
    setDraft(null);
  };
  return (
    <Card>
      <View style={s.between}>
        <View>
          <Text style={s.title}>
            {type} <Text style={{ color: C.faint, fontWeight: '500' }}>× {rooms.length}</Text>
          </Text>
          <Text style={s.tiny}>
            {occupied}/{rooms.length} booked{guide ? ` · market ${usd(guide.market)}` : ''}
          </Text>
        </View>
        {zone.label ? <Pill tone={zone.tone}>{zone.label}</Pill> : null}
      </View>
      <View style={[s.between, { marginTop: 10 }]}>
        <Stepper value={value} onChange={setDraft} step={5} />
        {guide && (
          <Button variant="ghost" onPress={() => apply(guide.sweet)}>
            ✨ Best ({usd(guide.sweet)})
          </Button>
        )}
      </View>
      {draft != null && draft !== current && (
        <View style={[s.row, { gap: 8, marginTop: 8 }]}>
          <Button onPress={() => apply(draft)} style={{ flex: 1 }}>
            Set all to {usd(draft)}
          </Button>
          <Button variant="ghost" onPress={() => setDraft(null)}>
            Cancel
          </Button>
        </View>
      )}
    </Card>
  );
}

function RoomCard({ room, guest, money, guide, onUpgrade, onPrice }: { room: Room; guest: any; money: number; guide: Guide; onUpgrade: (id: number) => void; onPrice: (id: number, price: number) => void }) {
  const cost: number | null = insights.upgradeCost(room);
  const status = room.underMaintenance ? 'repair' : room.occupied ? 'busy' : 'free';
  const zone = priceZone(room.price, guide);
  return (
    <Card style={status === 'busy' ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' } : status === 'repair' ? { backgroundColor: C.amberSoft, borderColor: '#fde68a' } : null}>
      <View style={s.between}>
        <View>
          <Text style={s.tiny}>#{room.id}</Text>
          <Text style={s.title}>{room.type}</Text>
        </View>
        <Pill tone={status === 'busy' ? 'green' : status === 'repair' ? 'amber' : 'slate'}>
          {status === 'busy' ? '🧑 Booked' : status === 'repair' ? `🔧 Repairs${room.repairLeft ? ` · ${room.repairLeft}d` : ''}` : 'Vacant'}
        </Pill>
      </View>
      <View style={[s.between, { marginTop: 6 }]}>
        <Stars value={room.quality} />
        <Text style={[s.tiny, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
          {guest ? `${guest.name} · ${guest.type}` : ''}
        </Text>
      </View>
      <View style={[s.between, { marginTop: 10 }]}>
        <Stepper value={room.price} onChange={(p) => onPrice(room.id, p)} />
        {zone.label ? <Pill tone={zone.tone}>{zone.label}</Pill> : null}
      </View>
      {room.quality > 3 && room.occupied && <Text style={[s.tiny, { marginTop: 4 }]}>Wearing down while occupied</Text>}
      <Button variant="dark" style={{ marginTop: 8 }} disabled={cost == null || money < cost} onPress={() => onUpgrade(room.id)}>
        {cost == null ? 'Max quality' : `⬆ Upgrade · ${usd(cost)}`}
      </Button>
    </Card>
  );
}

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'busy' as const, label: 'Booked' },
  { id: 'free' as const, label: 'Vacant' },
  { id: 'repair' as const, label: 'Repairs' },
];

export default function RoomsTab({
  game,
  roomTypes,
  buildRoom,
  upgradeRoom,
  adjustRoomPrice,
  buyPlot,
}: {
  game: GameState;
  roomTypes: RoomType[];
  buildRoom: (type: string) => ActionResult;
  upgradeRoom: (id: number) => void;
  adjustRoomPrice: (id: number, price: number) => void;
  buyPlot: () => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [justBuilt, setJustBuilt] = useState<string | null>(null);
  const rooms = game.rooms;
  const money = game.money;

  const guestsById = useMemo(() => new Map((game.guests || []).map((g) => [g.id, g])), [game.guests]);
  const guides = useMemo(() => {
    const out: Record<string, Guide> = {};
    for (const rt of roomTypes) out[rt.type] = insights.priceGuide(game, rt.type);
    return out;
  }, [game, roomTypes]);
  const byType = useMemo(() => {
    const out = new Map<string, Room[]>();
    for (const r of rooms) {
      if (!out.has(r.type)) out.set(r.type, []);
      out.get(r.type)!.push(r);
    }
    return roomTypes.filter((rt) => out.has(rt.type)).map((rt) => [rt.type, out.get(rt.type)!] as const);
  }, [rooms, roomTypes]);

  const usable = rooms.filter((r) => !r.underMaintenance);
  const booked = usable.filter((r) => r.occupied);
  const nightly = booked.reduce((t, r) => t + r.price, 0);
  const avgPrice = rooms.length ? rooms.reduce((t, r) => t + r.price, 0) / rooms.length : 0;
  const shown = rooms.filter((r) => filter === 'all' || (r.underMaintenance ? 'repair' : r.occupied ? 'busy' : 'free') === filter);

  const cap: number = insights.roomCapacity(game);
  const full = rooms.length >= cap;
  const plotPrice: number = insights.nextPlotPrice(game);
  const plots: number = insights.plotsOwned(game);

  const build = (type: string) => {
    if (buildRoom(type).ok) {
      setJustBuilt(type);
      setTimeout(() => setJustBuilt(null), 1500);
    }
  };
  // One action per room whose price actually changes.
  const setTypePrice = (type: string, price: number) => {
    for (const r of rooms) if (r.type === type && r.price !== price) adjustRoomPrice(r.id, price);
  };

  return (
    <View>
      <TabHeader icon="🛏️" title="Rooms" />
      <StatRow>
        <Stat label="Rooms" value={rooms.length} sub={`${rooms.length - usable.length} in repair`} />
        <Stat label="Booked" value={`${booked.length}/${usable.length}`} sub={`${usable.length ? Math.round((booked.length / usable.length) * 100) : 0}% occupancy`} />
        <Stat label="Avg price" value={usd(avgPrice)} sub="per night" />
        <Stat label="Tonight" value={usd(nightly)} sub="room revenue" />
      </StatRow>

      <Card style={full ? { backgroundColor: C.amberSoft, borderColor: '#fde68a' } : null}>
        <View style={s.between}>
          <Text style={s.title}>
            🏞️ Land · {plots} plot{plots === 1 ? '' : 's'}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: full ? '#b45309' : C.sub }}>
            {rooms.length}/{cap} rooms
          </Text>
        </View>
        <View style={{ marginVertical: 8 }}>
          <Meter value={rooms.length} max={cap} tone={full ? '#f59e0b' : C.indigo} />
        </View>
        <Text style={s.small}>{full ? 'Your land is full — buy the next plot to keep building.' : `Each plot holds 20 rooms. ${cap - rooms.length} free spot${cap - rooms.length === 1 ? '' : 's'} left.`}</Text>
        <Button variant={full ? 'primary' : 'ghost'} style={{ marginTop: 8 }} disabled={money < plotPrice} onPress={buyPlot}>
          Buy next plot · {usd(plotPrice)}
        </Button>
      </Card>

      <Section icon="🔨" title="Build a room">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
          {roomTypes.map((rt) => {
            const need: number = insights.unlockLevel('room', rt.type);
            const locked = (game.hotelLevel || 1) < need;
            const short = rt.baseCost - money;
            const can = short <= 0 && !locked;
            const guide = guides[rt.type];
            const nightlyProfit = (guide ? guide.sweet : rt.basePrice) - rt.upkeep;
            const payback = nightlyProfit > 0 ? Math.ceil(rt.baseCost / nightlyProfit) : null;
            return (
              <View key={rt.type} style={[st.buildCard, justBuilt === rt.type && { borderColor: '#34d399', backgroundColor: C.greenSoft }]}>
                <View style={s.row}>
                  <Text style={s.icon}>{rt.icon}</Text>
                  <View>
                    <Text style={s.title}>{rt.type}</Text>
                    <Text style={s.tiny}>{rooms.filter((r) => r.type === rt.type).length} owned</Text>
                  </View>
                </View>
                <Text style={[s.small, { marginTop: 8, minHeight: 32 }]} numberOfLines={2}>
                  {rt.description}
                </Text>
                {[
                  ['Earns ~', `${usd(guide ? guide.sweet : rt.basePrice)}/night`, C.green],
                  ['Upkeep', `${usd(rt.upkeep)}/day`, '#334155'],
                  ['Pays back', payback ? `~${payback} nights` : '—', '#334155'],
                ].map(([k, v, color]) => (
                  <View key={k} style={[s.between, { marginTop: 2 }]}>
                    <Text style={s.tiny}>{k}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color }}>{v}</Text>
                  </View>
                ))}
                <Button style={{ marginTop: 10 }} disabled={!can} onPress={() => build(rt.type)}>
                  {justBuilt === rt.type ? 'Built!' : locked ? `🔒 Level ${need}` : can ? `🔨 Build · ${usd(rt.baseCost)}` : `Need ${usd(short)} more`}
                </Button>
              </View>
            );
          })}
        </ScrollView>
      </Section>

      {byType.length > 0 && (
        <Section icon="🏷️" title="Pricing" hint="Guests compare you with rival hotels and your rating. Higher prices earn more per night but fill fewer rooms.">
          {byType.map(([type, list]) => (
            <TypePricing key={type} type={type} rooms={list} guide={guides[type]} onApply={setTypePrice} />
          ))}
        </Section>
      )}

      <Section title="All rooms" action={<Chips options={FILTERS} value={filter} onChange={setFilter} />}>
        {shown.length === 0 ? (
          <Empty>No rooms match this filter.</Empty>
        ) : (
          shown.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              guest={room.guest != null ? guestsById.get(room.guest) : null}
              money={money}
              guide={guides[room.type]}
              onUpgrade={upgradeRoom}
              onPrice={adjustRoomPrice}
            />
          ))
        )}
      </Section>
    </View>
  );
}

const st = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 10 },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  stepText: { fontSize: 18, color: C.sub, fontWeight: '600' },
  stepValue: { minWidth: 60, textAlign: 'center', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], color: C.text },
  buildCard: { width: 220, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line },
});

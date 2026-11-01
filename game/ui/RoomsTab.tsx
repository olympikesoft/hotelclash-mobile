// Rooms: land, building, pricing per room type and every room
// (port of the web's components/game/RoomsTab.js).
// The room list is a virtualized SectionList grouped by room type (collapsed
// by default), and each card is memoized on plain values: the engine hands
// over new objects every tick, so a big hotel would otherwise redraw every
// card every game day.
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { insights, type RoomType } from '../catalog';
import type { ActionResult, GameState, Room } from '../types';
import { Button, C, Card, Chips, Meter, Pill, Section, Stars, Stat, StatRow, TabHeader, s, usd } from './kit';

type Guide = { market: number; sweet: number; ceiling: number } | null;

/** Where a price sits against what guests will pay. */
function priceZone(price: number, guide: Guide): { label: string; tone: string } {
  if (!guide) return { label: '', tone: 'slate' };
  if (price > guide.ceiling) return { label: 'Too expensive', tone: 'red' };
  if (price >= guide.sweet) return { label: 'Premium', tone: 'amber' };
  if (price >= guide.market * 0.85) return { label: 'Sweet spot', tone: 'green' };
  return { label: 'Bargain', tone: 'sky' };
}

const HIT = { top: 8, bottom: 8, left: 6, right: 6 };

function Stepper({ value, onChange, step = 10, label }: { value: number; onChange: (v: number) => void; step?: number; label: string }) {
  return (
    <View style={st.stepper}>
      <Pressable onPress={() => onChange(Math.max(10, value - step))} style={st.stepBtn} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={`Lower ${label} price`}>
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepValue}>{usd(value)}</Text>
      <Pressable onPress={() => onChange(value + step)} style={st.stepBtn} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={`Raise ${label} price`}>
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
            {type} <Text style={{ color: C.sub, fontWeight: '500' }}>× {rooms.length}</Text>
          </Text>
          <Text style={s.tiny}>
            {occupied}/{rooms.length} booked{guide ? ` · market ${usd(guide.market)}` : ''}
          </Text>
        </View>
        {zone.label ? <Pill tone={zone.tone}>{zone.label}</Pill> : null}
      </View>
      <View style={[s.between, { marginTop: 10, flexWrap: 'wrap', gap: 8 }]}>
        <Stepper value={value} onChange={setDraft} step={5} label={type} />
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

type CardProps = {
  id: number;
  type: string;
  price: number;
  quality: number;
  status: 'busy' | 'repair' | 'free';
  repairLeft: number;
  guestLabel: string;
  cost: number | null;
  canUpgrade: boolean;
  zoneLabel: string;
  zoneTone: string;
  onUpgrade: (id: number) => void;
  onPrice: (id: number, price: number) => void;
};

const RoomCard = memo(function RoomCard(p: CardProps) {
  return (
    <Card style={p.status === 'busy' ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' } : p.status === 'repair' ? { backgroundColor: C.amberSoft, borderColor: '#fde68a' } : null}>
      <View style={s.between}>
        <View>
          <Text style={s.tiny}>#{p.id}</Text>
          <Text style={s.title}>{p.type}</Text>
        </View>
        <Pill tone={p.status === 'busy' ? 'green' : p.status === 'repair' ? 'amber' : 'slate'}>
          {p.status === 'busy' ? '🧑 Booked' : p.status === 'repair' ? `🔧 Repairs${p.repairLeft ? ` · ${p.repairLeft}d` : ''}` : 'Vacant'}
        </Pill>
      </View>
      <View style={[s.between, { marginTop: 6 }]}>
        <Stars value={p.quality} />
        <Text style={[s.tiny, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
          {p.guestLabel}
        </Text>
      </View>
      <View style={[s.between, { marginTop: 10 }]}>
        <Stepper value={p.price} onChange={(v) => p.onPrice(p.id, v)} label={`room ${p.id}`} />
        {p.zoneLabel ? <Pill tone={p.zoneTone}>{p.zoneLabel}</Pill> : null}
      </View>
      {p.quality > 3 && p.status === 'busy' && <Text style={[s.tiny, { marginTop: 4 }]}>Wearing down while occupied</Text>}
      <Button variant="dark" style={{ marginTop: 8 }} disabled={!p.canUpgrade} onPress={() => p.onUpgrade(p.id)}>
        {p.cost == null ? 'Max quality' : `⬆ Upgrade · ${usd(p.cost)}`}
      </Button>
    </Card>
  );
});

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'busy' as const, label: 'Booked' },
  { id: 'free' as const, label: 'Vacant' },
  { id: 'repair' as const, label: 'Repairs' },
];
const statusOf = (r: Room) => (r.underMaintenance ? 'repair' : r.occupied ? 'busy' : 'free');

export default function RoomsTab({
  game,
  roomTypes,
  buildRoom,
  upgradeRoom,
  adjustRoomPrice,
  setPrices,
  buyPlot,
  top,
}: {
  game: GameState;
  roomTypes: RoomType[];
  buildRoom: (type: string) => ActionResult;
  upgradeRoom: (id: number) => void;
  adjustRoomPrice: (id: number, price: number) => void;
  /** Several room prices as one update (copies the state once). */
  setPrices: (changes: { roomId: number; price: number }[]) => void;
  buyPlot: () => void;
  /** Banners shown above the tab (debt, guide). */
  top?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [justBuilt, setJustBuilt] = useState<string | null>(null);
  const rooms = game.rooms;
  const money = game.money;

  // Stable callbacks so memoized cards don't redraw when the parent does.
  const actions = useRef({ upgradeRoom, adjustRoomPrice });
  actions.current = { upgradeRoom, adjustRoomPrice };
  const onUpgrade = useCallback((id: number) => actions.current.upgradeRoom(id), []);
  const onPrice = useCallback((id: number, price: number) => actions.current.adjustRoomPrice(id, price), []);

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
  const cap: number = insights.roomCapacity(game);
  const full = rooms.length >= cap;
  const plotPrice: number = insights.nextPlotPrice(game);
  const plots: number = insights.plotsOwned(game);
  // Small hotels show their rooms; big ones start collapsed.
  const defaultOpen = rooms.length <= 12;

  const sections = byType.map(([type, list]) => {
    const shown = list.filter((r) => filter === 'all' || statusOf(r) === filter);
    const isOpen = open[type] ?? defaultOpen;
    return { type, total: list.length, matches: shown.length, isOpen, data: isOpen ? shown : [] };
  });

  const build = (type: string) => {
    if (buildRoom(type).ok) {
      setJustBuilt(type);
      setTimeout(() => setJustBuilt(null), 1500);
    }
  };
  const setTypePrice = (type: string, price: number) =>
    setPrices(rooms.filter((r) => r.type === type && r.price !== price).map((r) => ({ roomId: r.id, price })));

  const header = (
    <View>
      {top}
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

      <View style={[s.sectionHead, { marginBottom: 8 }]}>
        <Text style={s.sectionTitle}>All rooms</Text>
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      contentContainerStyle={st.list}
      stickySectionHeadersEnabled={false}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => (
        <Pressable
          onPress={() => setOpen((o) => ({ ...o, [section.type]: !section.isOpen }))}
          style={st.group}
          accessibilityRole="button"
          accessibilityState={{ expanded: section.isOpen }}
          accessibilityLabel={`${section.type} rooms, ${section.matches} shown`}
        >
          <Text style={s.title}>
            {section.isOpen ? '▾' : '▸'} {section.type}
          </Text>
          <Text style={s.small}>
            {filter === 'all' ? section.total : `${section.matches} of ${section.total}`} room{section.total === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}
      renderItem={({ item: r }) => {
        const cost: number | null = insights.upgradeCost(r);
        const guest = r.guest != null ? guestsById.get(r.guest) : null;
        const zone = priceZone(r.price, guides[r.type]);
        return (
          <RoomCard
            id={r.id}
            type={r.type}
            price={r.price}
            quality={r.quality}
            status={statusOf(r)}
            repairLeft={r.repairLeft || 0}
            guestLabel={guest ? `${guest.name} · ${guest.type}` : ''}
            cost={cost}
            canUpgrade={cost != null && money >= cost}
            zoneLabel={zone.label}
            zoneTone={zone.tone}
            onUpgrade={onUpgrade}
            onPrice={onPrice}
          />
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  list: { padding: 12, paddingBottom: 24 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 10 },
  stepBtn: { minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: '#475569', fontWeight: '600' },
  stepValue: { minWidth: 60, textAlign: 'center', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], color: C.text },
  buildCard: { width: 220, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line },
  group: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, minHeight: 44, marginBottom: 8 },
});

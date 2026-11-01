// Facilities: what's built (with price/seat manager), and the build catalogue
// (port of the web's components/game/FacilitiesTab.js + FacilityManager.js).
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { facilityIcon, insights, type FacilityType } from '../catalog';
import type { Facility, GameState } from '../types';
import { Button, C, Card, Chips, Empty, Meter, Pill, Section, Stat, StatRow, TabHeader, s, shortUsd, usd } from './kit';

const MAX_LEVEL = 5;
const TIERS = [
  { id: 'starter' as const, label: 'Starter', max: 150000 },
  { id: 'growth' as const, label: 'Growth', max: 1500000 },
  { id: 'luxury' as const, label: 'Luxury', max: Infinity },
];
const likedBy = (type: string) => Object.keys(insights.GUEST_LIKES).filter((g) => insights.GUEST_LIKES[g].includes(type));

function Net({ est }: { est: { net: number } | null }) {
  if (!est) return null;
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color: est.net >= 0 ? C.green : C.red }}>
      {est.net >= 0 ? '+' : '−'}
      {usd(Math.abs(est.net))}/day
    </Text>
  );
}

/** How guests read the price level (engine: demand falls as prices rise above normal). */
function priceMood(ratio: number, level: number) {
  const r = ratio - 0.1 * (level - 1); // higher levels justify higher prices
  if (r <= 0.85) return { label: 'Cheap — busy, thin margins', tone: 'sky' };
  if (r <= 1.1) return { label: 'Fair price', tone: 'green' };
  if (r <= 1.35) return { label: 'Pricey — families stay away', tone: 'amber' };
  return { label: 'Too expensive — few visitors', tone: 'red' };
}

type OfferItem = { id: string; name: string; price: number; base: number; cost: number };

function FacilityManager({ game, facility: f, onSetPrice }: { game: GameState; facility: Facility; onSetPrice: (facilityId: number, itemId: string, price: number) => void }) {
  const offer: { kind: 'menu' | 'entry'; items: OfferItem[]; orders: number } = insights.facilityOffer(f);
  const capacity: number = insights.facilityCapacity(game, f);
  const est = insights.facilityEstimate(game, f);
  const mood = priceMood(insights.priceRatio(offer), f.level);
  const day = game.stats?.facilities?.[f.id];
  const full = day && day.turnedAway > 0;

  const step = (item: OfferItem, dir: number) => {
    const delta = Math.max(1, Math.round(item.price * 0.05));
    const next = Math.min(item.base * 5, Math.max(1, item.price + dir * delta));
    if (next !== item.price) onSetPrice(f.id, item.id, next);
  };

  return (
    <View style={{ marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#c7d2fe' }}>
      <View style={[s.between, { marginBottom: 4 }]}>
        <Text style={s.tiny}>👥 SEATS</Text>
        <Text style={s.tiny}>
          {day ? day.visitors : 0}/{capacity} used yesterday
        </Text>
      </View>
      <Meter value={day ? day.visitors : 0} max={capacity} tone={full ? '#f43f5e' : C.indigo} />
      <Text style={[s.tiny, { marginTop: 4, color: full ? '#be123c' : C.sub }]}>
        {full ? `⚠ Full: ${day.turnedAway} turned away. Upgrade for more seats, or raise prices.` : 'More seats come with each level and with skilled staff.'}
      </Text>
      {day ? (
        <View style={{ marginTop: 8 }}>
          {[
            [`Visitors (${day.guests} guests, ${day.locals} locals)`, String(day.visitors), '#1e293b'],
            ['Sales', usd(day.revenue), C.green],
            ['Ingredients', `−${usd(day.cogs)}`, C.red],
            ['Upkeep', `−${usd(f.upkeep)}`, C.red],
            ['Profit yesterday', usd(day.revenue - day.cogs - f.upkeep), day.revenue - day.cogs - f.upkeep >= 0 ? C.green : C.red],
          ].map(([k, v, color]) => (
            <View key={k} style={[s.between, { paddingVertical: 2 }]}>
              <Text style={s.small}>{k}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color }}>{v}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[s.small, { marginTop: 8 }]}>No report yet — play a day.</Text>
      )}
      {est && <Text style={[s.tiny, { marginTop: 4 }]}>At today’s prices expect ~{est.visitors} visitors and {usd(est.net)} profit per day.</Text>}

      <View style={[s.between, { marginTop: 12, marginBottom: 6 }]}>
        <Text style={s.title}>{offer.kind === 'menu' ? 'Menu' : 'Entry fee'}</Text>
        <Pill tone={mood.tone}>{mood.label}</Pill>
      </View>
      {offer.items.map((item) => {
        const margin = item.price > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) : 0;
        return (
          <View key={item.id} style={[s.between, { backgroundColor: '#fff', borderRadius: 10, padding: 8, marginBottom: 4 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.tiny}>
                cost {usd(item.cost)} · suggested {usd(item.base)} · <Text style={{ color: margin >= 60 ? C.green : margin >= 35 ? '#334155' : C.red }}>{margin}%</Text>
              </Text>
            </View>
            <View style={[s.row, { borderWidth: 1, borderColor: C.line, borderRadius: 8 }]}>
              <Pressable onPress={() => step(item, -1)} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 16, color: C.sub }}>−</Text>
              </Pressable>
              <Text style={{ minWidth: 48, textAlign: 'center', fontWeight: '700' }}>{usd(item.price)}</Text>
              <Pressable onPress={() => step(item, 1)} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 16, color: C.sub }}>+</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Text style={[s.tiny, { marginTop: 4 }]}>
        {offer.kind === 'menu' ? `Each visitor orders ${offer.orders} item${offer.orders === 1 ? '' : 's'}.` : 'Every visitor pays the fee.'} Business guests mind prices least, families most.
      </Text>
      {offer.items.some((i) => i.price !== i.base) && (
        <Pressable onPress={() => offer.items.forEach((i) => i.price !== i.base && onSetPrice(f.id, i.id, i.base))} style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.indigo }}>↺ Suggested prices</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FacilitiesTab({
  game,
  facilityTypes,
  buildFacility,
  upgradeFacility,
  hireStaff,
  setFacilityPrice,
}: {
  game: GameState;
  facilityTypes: FacilityType[];
  buildFacility: (type: string) => void;
  upgradeFacility: (id: number) => void;
  hireStaff: (role: string) => void;
  setFacilityPrice: (facilityId: number, itemId: string, price: number) => void;
}) {
  const [tier, setTier] = useState<(typeof TIERS)[number]['id']>('starter');
  const [managing, setManaging] = useState<number | null>(null);
  const money = game.money;
  const built = game.facilities;
  const builtNames = new Set(built.map((f) => f.name));
  const upkeep = built.reduce((t, f) => t + f.upkeep, 0);
  const income = built
    .filter((f) => f.name !== 'Lobby')
    .map((f) => insights.facilityEstimate(game, f))
    .filter(Boolean)
    .reduce((t: number, e: any) => t + e.income, 0);
  const t = TIERS.find((x) => x.id === tier)!;
  const prevMax = TIERS[TIERS.indexOf(t) - 1]?.max ?? 0;
  const catalog = useMemo(
    () => facilityTypes.filter((f) => !builtNames.has(f.type) && f.baseCost > prevMax && f.baseCost <= t.max).sort((a, b) => a.baseCost - b.baseCost),
    [facilityTypes, built, tier] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const level = game.hotelLevel || 1;
  const remaining = facilityTypes.filter((f) => !builtNames.has(f.type));
  const firstUnlock = remaining.length ? Math.min(...remaining.map((f) => insights.unlockLevel('facility', f.type))) : 0;
  const lp = insights.levelProgress(game);

  return (
    <View>
      <TabHeader icon="✨" title="Facilities" subtitle="Guests spend extra at facilities every day. Busier hotels with a better rating earn more from each one." />
      <StatRow>
        <Stat label="Built" value={built.length} sub={`of ${facilityTypes.length}`} />
        <Stat label="Expected income" value={usd(income)} sub="per day" tone={C.green} />
        <Stat label="Upkeep" value={usd(upkeep)} sub="per day" />
        <Stat label="Net" value={usd(income - upkeep)} sub="per day" tone={income - upkeep >= 0 ? C.green : C.red} />
      </StatRow>

      <Section icon="🏛️" title="Your facilities">
        {built.map((f) => {
          const est = f.name === 'Lobby' ? null : insights.facilityEstimate(game, f);
          const report = game.stats?.facilities?.[f.id];
          const cost = 5000 * f.level;
          const maxed = f.level >= MAX_LEVEL;
          return (
            <Card key={f.id}>
              <View style={s.between}>
                <View style={s.row}>
                  <Text style={s.icon}>{facilityIcon(f.name)}</Text>
                  <Text style={s.title}>{f.name}</Text>
                </View>
                <View style={[s.row, { gap: 2 }]}>
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <View key={i} style={{ width: 10, height: 8, borderRadius: 2, backgroundColor: i < f.level ? '#6366f1' : C.line }} />
                  ))}
                </View>
              </View>
              <View style={[s.between, { marginTop: 6 }]}>
                <Text style={s.small}>Upkeep {usd(f.upkeep)}/day</Text>
                {est ? <Net est={est} /> : <Text style={s.small}>Entrance</Text>}
              </View>
              {report && f.name !== 'Lobby' && (
                <Text style={[s.tiny, { marginTop: 2 }]}>
                  Yesterday: {report.visitors} visitors{report.turnedAway ? ` · ${report.turnedAway} turned away` : ''}
                </Text>
              )}
              {f.name !== 'Lobby' && (
                <>
                  <Button variant="ghost" style={{ marginTop: 8 }} onPress={() => setManaging(managing === f.id ? null : f.id)}>
                    {managing === f.id ? 'Close' : '⚙ Manage prices & seats'}
                  </Button>
                  {managing === f.id && <FacilityManager game={game} facility={f} onSetPrice={setFacilityPrice} />}
                  <Button variant="dark" style={{ marginTop: 8 }} disabled={maxed || money < cost} onPress={() => upgradeFacility(f.id)}>
                    {maxed ? 'Max level' : `⬆ Level ${f.level + 1} · ${usd(cost)}`}
                  </Button>
                </>
              )}
            </Card>
          );
        })}
      </Section>

      {remaining.length > 0 && level < firstUnlock && (
        <Card style={{ backgroundColor: C.indigoSoft, borderColor: '#c7d2fe' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#312e81' }}>🔒 Facilities unlock at level {firstUnlock}</Text>
          <Text style={{ fontSize: 13, color: '#3730a3', marginTop: 4 }}>
            Your hotel is worth {usd(lp.value)}
            {lp.next === firstUnlock ? ` of ${usd(lp.threshold)} needed` : ` (level ${lp.next} at ${usd(lp.threshold)})`}. Grow its value: raise room prices so you can afford more, upgrade room quality, build more rooms, and keep your rating up.
          </Text>
          <View style={{ marginTop: 8 }}>
            <Meter value={lp.progress} max={1} tone={C.indigo} />
          </View>
        </Card>
      )}

      <Section icon="🔨" title="Build" hint="Most facilities need specific staff before you can open them." action={<Chips options={TIERS} value={tier} onChange={setTier} />}>
        {catalog.length === 0 ? (
          <Empty>You've built everything in this tier.</Empty>
        ) : (
          catalog.map((ft) => {
            const missing: { role: string; need: number }[] = insights.missingStaff(game, ft.type);
            const est = insights.facilityEstimate(game, ft.type);
            const need: number = insights.unlockLevel('facility', ft.type);
            const locked = level < need;
            const coins = ft.isPremium ? ft.coinCost || 0 : 0;
            const coinShort = coins - (game.credits || 0);
            const short = ft.baseCost + coins - money;
            const fans = likedBy(ft.type);
            return (
              <Card key={ft.type}>
                <View style={s.between}>
                  <View style={[s.row, { flex: 1 }]}>
                    <Text style={s.icon}>{ft.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>{ft.type}</Text>
                      <Text style={s.tiny}>
                        {shortUsd(ft.baseCost)}
                        {coins > 0 ? <Text style={{ color: '#c026d3', fontWeight: '600' }}> + {coins.toLocaleString('en-US')} coins</Text> : null}
                      </Text>
                    </View>
                  </View>
                  <Net est={est} />
                </View>
                <Text style={[s.small, { marginTop: 6 }]} numberOfLines={2}>
                  {ft.description}
                </Text>
                <Text style={[s.small, { marginTop: 4 }]}>
                  {usd(ft.incomePerGuest)} per visit · upkeep {usd(ft.upkeep)}/day
                </Text>
                {fans.length > 0 && (
                  <View style={[s.row, { flexWrap: 'wrap', gap: 4, marginTop: 6 }]}>
                    {fans.map((g) => (
                      <Pill key={g} tone="sky">
                        {g} guests
                      </Pill>
                    ))}
                  </View>
                )}
                <View style={[s.row, { flexWrap: 'wrap', gap: 4, marginTop: 6 }]}>
                  {(ft.requiredStaff || []).map((req) => {
                    const gap = missing.find((m) => m.role === req.role);
                    return gap ? (
                      <Pill key={req.role} tone="amber" onPress={() => hireStaff(req.role)}>
                        ➕ {req.role}
                        {req.count > 1 ? ` ×${gap.need}` : ''}
                      </Pill>
                    ) : (
                      <Pill key={req.role} tone="green">
                        ✓ {req.role}
                      </Pill>
                    );
                  })}
                </View>
                <Button style={{ marginTop: 10 }} disabled={locked || short > 0 || coinShort > 0 || missing.length > 0} onPress={() => buildFacility(ft.type)}>
                  {locked
                    ? `🔒 Unlocks at level ${need}`
                    : coinShort > 0
                    ? `Need ${coinShort.toLocaleString('en-US')} more coins`
                    : missing.length > 0
                    ? '🔒 Hire staff first'
                    : short > 0
                    ? `Need ${shortUsd(short)} more`
                    : `🔨 Build · ${shortUsd(ft.baseCost)}`}
                </Button>
              </Card>
            );
          })
        )}
      </Section>
    </View>
  );
}

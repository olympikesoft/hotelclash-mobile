// Rivals: market-share drivers, the local market (visit for cash) and buying
// rival hotels (port of the web's components/game/RivalsTab.js).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { engineData, insights } from '../catalog';
import type { GameState } from '../types';
import { Button, C, Card, Pill, Section, Stars, Stat, StatRow, TabHeader, s, usd } from './kit';

type Hotel = { id?: string; name: string; reputation: number; rooms: number; occupancyRate: number; avgRoomPrice: number; facilities: string[]; marketingActive?: boolean; you?: boolean };

/** One factor that multiplies the share: ×1.2 is a 20% boost. */
function Factor({ label, value, good, bad }: { label: string; value: number; good: string; bad: string }) {
  const up = value > 1.005;
  const down = value < 0.995;
  return (
    <View style={[s.between, { paddingVertical: 6 }]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>{label}</Text>
        <Text style={s.tiny}>{up ? good : down ? bad : 'No effect right now.'}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: up ? C.green : down ? C.red : C.faint }}>
        {up ? '▲' : down ? '▼' : '–'} ×{value.toFixed(2)}
      </Text>
    </View>
  );
}

export default function RivalsTab({ game, visitedToday, onVisit, onAcquire }: { game: GameState; visitedToday: string[]; onVisit: (name: string) => void; onAcquire: (id: string) => void }) {
  const [buying, setBuying] = useState<string | null>(null);
  const e = insights.economics(game);
  const you: Hotel = {
    name: game.hotelName || 'Your hotel',
    reputation: game.reputation,
    rooms: game.rooms.length,
    occupancyRate: e.occupancy,
    avgRoomPrice: game.rooms.length ? game.rooms.reduce((t, r) => t + r.price, 0) / game.rooms.length : 0,
    facilities: game.facilities.map((f) => f.name),
    you: true,
  };
  const competitors = (game.competitors || []) as (Hotel & { id: string })[];
  const all = [you, ...competitors].sort((a, b) => b.reputation - a.reputation);
  const rank = all.findIndex((h) => h.you) + 1;
  const visitsLeft = Math.max(0, engineData.HOTEL_VISITS_PER_DAY - visitedToday.length);
  const leader = all.find((h) => !h.you);
  const share = game.stats?.share;
  const weekAgo = typeof game.stats?.shareWeekAgo === 'number' ? game.stats.shareWeekAgo : null;

  return (
    <View>
      <TabHeader icon="🏢" title="Rivals" subtitle="Guests compare your prices with similar hotels nearby. Out-rate them to win the market." />
      <StatRow>
        <Stat label="Rating rank" value={`#${rank}`} sub={`of ${all.length} hotels`} tone={rank === 1 ? C.green : C.text} />
        <Stat label="Market share" value={`${Number(game.marketShare || 0).toFixed(1)}%`} sub="50% unlocks an achievement" />
        <Stat label="Top rival" value={leader ? `${leader.reputation.toFixed(1)}★` : '—'} sub={leader ? leader.name : ''} />
        <Stat label="Visits today" value={`${visitsLeft} left`} sub="earn cash for insights" />
      </StatRow>

      {share && (
        <Section title="What drives your market share">
          <Card>
            <Text style={s.tiny}>CUSTOMERS TONIGHT</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginTop: 2 }}>
              {share.customers.toLocaleString('en-US')}
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.sub }}> of {share.town.toLocaleString('en-US')} in town</Text>
            </Text>
            <Text style={[s.small, { marginTop: 4 }]}>
              {share.stays} overnight guests + {share.visits} facility visits (a visit counts as half a night). That's a {share.base}% base share before the factors below.
            </Text>
            {weekAgo != null && (
              <Text style={{ marginTop: 6, fontSize: 13, fontWeight: '700', color: game.marketShare >= weekAgo ? C.green : C.red }}>
                {weekAgo}% → {Number(game.marketShare).toFixed(1)}% since last week
              </Text>
            )}
          </Card>
          <Card>
            <Factor label="Rating vs rivals" value={share.rating} good="You're rated above the average rival." bad="Rivals are rated higher — improve rooms and service." />
            <Factor label="Marketing" value={share.marketing} good="Your campaigns are winning attention." bad="Rivals are advertising. Run a campaign to answer." />
            <Factor label="Season" value={share.season} good="Your facilities suit this season." bad="This season doesn't favour you." />
            <Factor label="Value for money" value={share.value} good="Guests see you as good value." bad="You look pricier than rivals for your rating." />
          </Card>
        </Section>
      )}

      <Section title="Local market" hint={`Visit a rival to earn cash for the insights (${engineData.HOTEL_VISITS_PER_DAY} a day).`}>
        {all.map((h, i) => {
          const visited = visitedToday.includes(h.name);
          return (
            <Card key={h.name} style={h.you ? { backgroundColor: C.indigoSoft, borderColor: '#c7d2fe' } : null}>
              <View style={s.between}>
                <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>
                  {i === 0 ? '👑 ' : ''}
                  {h.name}
                  {h.marketingActive ? ' 📣' : ''}
                </Text>
                {h.you ? <Pill tone="indigo">You</Pill> : null}
              </View>
              <View style={[s.row, { gap: 6, marginTop: 4 }]}>
                <Stars value={h.reputation} />
                <Text style={s.tiny}>
                  {h.reputation.toFixed(1)} · {h.rooms} rooms · {Math.round((h.occupancyRate || 0) * 100)}% full · {usd(h.avgRoomPrice)}
                </Text>
              </View>
              <Text style={[s.tiny, { marginTop: 4 }]} numberOfLines={1}>
                {h.facilities.length ? h.facilities.slice(0, 3).join(', ') + (h.facilities.length > 3 ? ` +${h.facilities.length - 3}` : '') : 'No facilities'}
              </Text>
              {!h.you && (
                <Button variant="ghost" style={{ marginTop: 8 }} disabled={visited || visitsLeft === 0} onPress={() => onVisit(h.name)}>
                  {visited ? 'Visited today' : '👁 Visit'}
                </Button>
              )}
            </Card>
          );
        })}
      </Section>

      <Section title="Buy a rival hotel" hint="Take over its rooms, land and guests. A new small hotel opens in its place 60 days later.">
        {competitors.map((c) => {
          const o = insights.acquisitionOffer(game, c);
          const can = !o.locked && !o.lastRivals && game.money >= o.price;
          return (
            <Card key={c.id} style={o.distressed ? { backgroundColor: C.amberSoft, borderColor: '#fcd34d' } : null}>
              <View style={s.between}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.title} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={s.tiny}>
                    {c.rooms} rooms · {Math.round(c.occupancyRate * 100)}% full · {c.reputation.toFixed(1)}★
                  </Text>
                  {o.distressed && (
                    <View style={{ marginTop: 4 }}>
                      <Pill tone="amber">For sale −30%</Pill>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text }}>{usd(o.price)}</Text>
              </View>
              {buying === c.id ? (
                <View style={{ marginTop: 8, backgroundColor: C.dark, borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>
                    Buy {c.name} for {usd(o.price)}? You'll need staff for {c.rooms} more rooms.
                  </Text>
                  <View style={[s.row, { gap: 8, marginTop: 8, justifyContent: 'flex-end' }]}>
                    <Button variant="ghost" onPress={() => setBuying(null)}>
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        setBuying(null);
                        onAcquire(c.id);
                      }}
                    >
                      Buy
                    </Button>
                  </View>
                </View>
              ) : (
                <Button style={{ marginTop: 8 }} variant={o.distressed ? 'primary' : 'ghost'} disabled={!can} onPress={() => setBuying(c.id)}>
                  {o.locked ? `Unlocks at level ${o.unlockLevel}` : o.lastRivals ? 'The town keeps its last rivals' : game.money < o.price ? `Need ${usd(o.price - game.money)} more` : 'Buy this hotel'}
                </Button>
              )}
            </Card>
          );
        })}
      </Section>
    </View>
  );
}

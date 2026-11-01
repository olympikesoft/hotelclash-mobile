// Marketing: campaigns and hotel policies (port of the web's components/game/MarketingTab.js).
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { engineData, insights } from '../catalog';
import type { GameState } from '../types';
import { Button, C, Card, Pill, Section, Stat, StatRow, TabHeader, s, shortUsd, usd } from './kit';

// What each campaign does in the engine's booking check (tick.js marketingBonus).
const EFFECTS: Record<string, string> = {
  local: 'More travellers come to town and pick you',
  social: 'More arrivals and a slowly rising rating',
  discount: 'Lots of bargain hunters (they mind prices)',
  high_end: '',
  luxury: 'Wealthy guests who fill Suites and Penthouses',
  competitive: 'Takes customers out of rival hotels',
};

const POLICIES: Record<string, { name: string; perk: string }> = {
  petFriendly: { name: 'Pet friendly', perk: 'Families book more often' },
  earlyCheckin: { name: 'Early check-in', perk: 'Business guests book more often' },
  lateCheckout: { name: 'Late check-out', perk: 'Leisure and family guests book more often' },
  freeCancellation: { name: 'Free cancellation', perk: 'Slightly more bookings from everyone' },
  breakfastIncluded: { name: 'Breakfast included', perk: 'Biggest booking boost for all guests' },
};

const costLabel = (c: { perDay?: number; perGuest?: number }) =>
  [c.perDay ? `${usd(c.perDay)}/day` : null, c.perGuest ? `${usd(c.perGuest)} per guest/day` : null].filter(Boolean).join(' + ') || 'Free';

export default function MarketingTab({
  game,
  launchMarketingCampaign,
  changePolicy,
}: {
  game: GameState;
  launchMarketingCampaign: (id: string) => void;
  changePolicy: (key: string, value: boolean) => void;
}) {
  const money = game.money;
  const campaigns = game.marketingCampaigns || [];
  const active = campaigns.filter((c) => c.active);
  const policyTotal: number = insights.policyCost(game);
  const advice: { full: boolean; text: string } = insights.marketingAdvice(game);

  return (
    <View>
      <TabHeader icon="📣" title="Marketing" subtitle="Campaigns bring guests in for a few days. Policies are permanent perks with a daily running cost." />
      <StatRow>
        <Stat label="Active campaigns" value={active.length} sub={active.length ? active.map((c) => c.name).join(', ') : 'none running'} />
        <Stat label="Market share" value={`${Number(game.marketShare || 0).toFixed(1)}%`} sub="of local guests" />
        <Stat label="Policies on" value={Object.values(game.policies || {}).filter(Boolean).length} sub={`of ${Object.keys(POLICIES).length}`} />
        <Stat label="Policy costs" value={usd(policyTotal)} sub="per day" />
      </StatRow>

      <Section icon="📣" title="Campaigns" hint="Campaigns bring more guests to town while they run. The price grows with your hotel. Running several at once adds a little less each.">
        {advice.full && <Text style={{ backgroundColor: C.amberSoft, color: '#78350f', borderRadius: 12, padding: 10, fontSize: 13, marginBottom: 8 }}>⚠ {advice.text}</Text>}
        {campaigns.map((c) => {
          const left = c.active && c.endDay ? Math.max(0, c.endDay - game.day) : 0;
          const cost: number = insights.campaignCost(game, c.id) ?? c.cost;
          const def = engineData.CAMPAIGNS[c.id];
          const demand = def ? Math.round(def.demand * 100) : 0;
          const duration = def ? def.duration : c.duration;
          const need: number = insights.unlockLevel('campaign', c.id);
          const locked = (game.hotelLevel || 1) < need;
          const short = cost - money;
          return (
            <Card key={c.id} style={c.active ? { backgroundColor: C.indigoSoft, borderColor: '#a5b4fc' } : null}>
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{c.name}</Text>
                  <Text style={s.tiny}>
                    {shortUsd(cost)} · {duration} days · +{demand}% arrivals
                  </Text>
                </View>
                {c.active && <Pill tone="indigo">⏱ {left}d left</Pill>}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginTop: 6 }}>{EFFECTS[c.id] || c.description}</Text>
              <Text style={[s.small, { marginTop: 2 }]} numberOfLines={2}>
                {c.description}
              </Text>
              {c.active ? (
                <Text style={{ marginTop: 6, fontSize: 12, color: '#3730a3' }}>
                  So far: ~{Math.round(c.extraGuests || 0)} extra guests, +{usd(c.extraRevenue || 0)} bookings
                </Text>
              ) : c.lastResult ? (
                <Text style={{ marginTop: 6, fontSize: 12, color: c.lastResult.revenue >= c.lastResult.paid ? '#065f46' : '#9f1239' }}>
                  📊 Last run: ~{c.lastResult.guests} guests, +{usd(c.lastResult.revenue)} for {usd(c.lastResult.paid)}
                </Text>
              ) : null}
              <Button style={{ marginTop: 10 }} disabled={c.active || locked || short > 0} onPress={() => launchMarketingCampaign(c.id)}>
                {c.active ? 'Running' : locked ? `🔒 Unlocks at level ${need}` : short > 0 ? `Need ${shortUsd(short)} more` : `Launch · ${shortUsd(cost)}`}
              </Button>
            </Card>
          );
        })}
      </Section>

      <Section icon="📜" title="Hotel policies">
        <Card style={{ paddingVertical: 4 }}>
          {Object.entries(POLICIES).map(([key, p], i) => {
            const on = Boolean(game.policies && game.policies[key]);
            const now: number = on ? insights.policyCost(game, key) : 0;
            return (
              <View key={key} style={[s.between, { paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: '#f1f5f9' }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.title}>{p.name}</Text>
                  <Text style={s.small}>
                    {p.perk} · <Text style={{ color: C.faint }}>{costLabel(engineData.POLICY_COSTS[key])}</Text>
                    {now > 0 ? <Text style={{ fontWeight: '600', color: '#475569' }}> (now {usd(now)}/day)</Text> : null}
                  </Text>
                </View>
                <Switch value={on} onValueChange={(v) => changePolicy(key, v)} trackColor={{ true: '#10b981', false: '#cbd5e1' }} thumbColor="#fff" accessibilityLabel={p.name} />
              </View>
            );
          })}
        </Card>
      </Section>
    </View>
  );
}

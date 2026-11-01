// Finance: daily statement, 30-day profit, insurance and payroll
// (port of the web's components/game/FinanceTab.js; the CSV / learning-report
// export stays on the website).
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { engineData, insights } from '../catalog';
import type { GameState } from '../types';
import type { DayPoint } from '../useDayHistory';
import { Button, C, Card, Empty, Section, Stat, StatRow, TabHeader, s, shortUsd, usd } from './kit';
import { ProfitBars } from './Dashboard';

function Line({ label, value, strong, tone = '#1e293b', indent }: { label: string; value: string; strong?: boolean; tone?: string; indent?: boolean }) {
  return (
    <View style={[s.between, { paddingVertical: 5, paddingLeft: indent ? 12 : 0 }, strong && { borderTopWidth: 1, borderTopColor: C.line, marginTop: 2 }]}>
      <Text style={{ flex: 1, fontSize: 13, color: indent ? C.sub : '#1e293b', fontWeight: strong ? '800' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: tone, fontWeight: strong ? '800' : '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

const PLAN_ICON: Record<string, string> = { none: '🚫', basic: '🛡️', full: '✅' };

export default function FinanceTab({ game, history, onSetInsurance }: { game: GameState; history: DayPoint[]; onSetInsurance: (plan: string) => void }) {
  const e = insights.economics(game);
  const recent = history.slice(-14);
  const avgProfit = recent.length ? recent.reduce((t, p) => t + p.profit, 0) / recent.length : e.lastProfit;
  const runway = avgProfit < 0 && game.money > 0 ? Math.floor(game.money / -avgProfit) : null;
  const chart = history.slice(-30);

  const payrollByRole: Record<string, number> = {};
  for (const st of game.staff) payrollByRole[st.role] = (payrollByRole[st.role] || 0) + st.salary;
  const roles = Object.entries(payrollByRole).sort((a, b) => b[1] - a[1]);
  const current: string = insights.insurancePlan(game);

  return (
    <View>
      <TabHeader icon="💵" title="Finance" subtitle="Yesterday's results and where the money goes every day." />
      <StatRow>
        <Stat label="Cash" value={shortUsd(game.money)} sub={`${(game.credits || 0).toLocaleString('en-US')} coins`} tone={game.money < 0 ? C.red : C.text} />
        <Stat label="Profit yesterday" value={usd(e.lastProfit)} tone={e.lastProfit >= 0 ? C.green : C.red} />
        <Stat label="14-day average" value={usd(avgProfit)} sub="profit per day" tone={avgProfit >= 0 ? C.green : C.red} />
        <Stat
          label="Runway"
          value={runway == null ? (avgProfit >= 0 ? 'Growing' : 'In debt') : `${runway} days`}
          sub={runway == null ? '' : 'until cash runs out'}
          tone={runway != null && runway < 30 ? C.red : C.text}
        />
      </StatRow>

      <Section icon="🧾" title="Daily statement">
        <Card>
          <Line label="Revenue (yesterday)" value={usd(e.lastRevenue)} tone={C.green} />
          <Line label="Rooms" value={usd(e.lastRoomIncome)} indent />
          <Line label="Facilities" value={usd(e.lastFacilityIncome)} indent />
          <Line label="Costs" value={`−${usd(e.expenses + (e.lastIngredients || 0) + (e.lastTax || 0))}`} tone={C.red} />
          <Line label="Staff payroll" value={usd(e.payroll)} indent />
          <Line label={e.scaleFactor > 1 ? `Room upkeep (×${e.scaleFactor.toFixed(2)} big-hotel costs)` : 'Room upkeep'} value={usd(e.roomUpkeep)} indent />
          <Line label="Facility upkeep" value={usd(e.facilityUpkeep)} indent />
          <Line label="Policies" value={usd(e.policyCosts || 0)} indent />
          <Line label="Insurance" value={usd(e.insurance || 0)} indent />
          <Line label="Property tax (0.1% of value)" value={usd(e.propertyTax || 0)} indent />
          <Line label="Profit tax" value={usd(e.lastTax || 0)} indent />
          <Line label="Facility ingredients" value={usd(e.lastIngredients || 0)} indent />
          <Line label="Profit" value={usd(e.lastProfit)} strong tone={e.lastProfit >= 0 ? C.green : C.red} />
        </Card>
      </Section>

      <Section icon="📈" title="Last 30 days">
        {chart.length < 2 ? (
          <Empty>Play a few days to see your history.</Empty>
        ) : (
          <Card>
            <ProfitBars data={chart} height={140} />
            <View style={s.between}>
              <Text style={s.tiny}>Day {chart[0].day}</Text>
              <Text style={s.tiny}>Daily profit</Text>
              <Text style={s.tiny}>Day {chart[chart.length - 1].day}</Text>
            </View>
          </Card>
        )}
      </Section>

      <Section icon="🛡️" title="Insurance" hint="Fires, floods, outages and inspections happen — and get bigger after day 200. Insurance limits what one disaster can cost you.">
        {Object.entries(engineData.INSURANCE_PLANS as Record<string, { name: string; deductibleDays: number | null }>).map(([id, p]) => {
          const isCurrent = current === id;
          const cap: number | null = insights.insuranceCap(game, id);
          return (
            <Card key={id} style={isCurrent ? (id === 'none' ? { backgroundColor: C.redSoft, borderColor: '#fda4af' } : { backgroundColor: C.greenSoft, borderColor: '#6ee7b7' }) : null}>
              <View style={s.between}>
                <Text style={s.title}>
                  {PLAN_ICON[id] || '🛡️'} {p.name}
                </Text>
                {isCurrent && <Text style={{ fontSize: 10, fontWeight: '700', color: C.sub }}>CURRENT</Text>}
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 4 }}>
                {usd(insights.insurancePremium(game, id))}
                <Text style={{ fontSize: 12, color: C.faint }}>/day</Text>
              </Text>
              <Text style={[s.small, { marginTop: 2 }]}>
                {cap == null ? 'You pay the full cost of every disaster.' : `A disaster costs you at most ${usd(cap)} (about ${p.deductibleDays} days of business).`}
              </Text>
              {!isCurrent && (
                <Button variant={id === 'none' ? 'danger' : 'primary'} style={{ marginTop: 8 }} onPress={() => onSetInsurance(id)}>
                  {id === 'none' ? 'Cancel insurance' : `Switch to ${p.name}`}
                </Button>
              )}
            </Card>
          );
        })}
      </Section>

      {roles.length > 0 && (
        <Section title="Payroll by role">
          {roles.map(([role, cost]) => (
            <View key={role} style={[s.between, { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 }]}>
              <Text style={{ fontSize: 13, color: '#334155' }}>{role}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{usd(cost)}/day</Text>
            </View>
          ))}
        </Section>
      )}

      <Section icon="🎓" title="Export for study">
        <Text style={s.small}>The spreadsheet export and the learning report are on the website (history is recorded on each device).</Text>
        <Pressable onPress={() => Linking.openURL('https://www.playlobbyboss.com/learn')} style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.indigo }}>Free lessons at playlobbyboss.com/learn ↗</Text>
        </Pressable>
      </Section>
    </View>
  );
}

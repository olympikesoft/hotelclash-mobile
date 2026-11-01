// Shown above every tab while the hotel is in debt: what it costs and what
// happens next (port of the web's components/game/DebtBanner.js).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { insights } from '../catalog';
import type { GameState } from '../types';
import { usd } from './kit';

export default function DebtBanner({ game, onNavigate, onBuyCoins }: { game: GameState; onNavigate: (tab: 'rooms' | 'staff') => void; onBuyCoins?: () => void }) {
  const d = insights.debtStatus(game);
  if (!d.inDebt) return null;
  const urgent = (d.repoIn != null && d.repoIn <= 2) || d.bankruptIn <= 3;
  const next =
    d.repoTarget && d.repoIn != null && d.repoIn < d.bankruptIn
      ? `The bank repossesses your ${d.repoTarget.name} in ${d.repoIn} day${d.repoIn === 1 ? '' : 's'} unless you get back above $0.`
      : d.bankruptIn <= 7
      ? `Bankruptcy in ${d.bankruptIn} day${d.bankruptIn === 1 ? '' : 's'}: get back above $0 or the bank closes your hotel.`
      : `Get back above $0: after ${d.days + d.bankruptIn} days in debt the bank closes your hotel.`;

  return (
    <View style={[st.box, { backgroundColor: urgent ? '#be123c' : '#e11d48' }]} accessibilityRole="alert">
      <View style={st.body}>
        <Text style={st.title}>
          🚨 In debt: {usd(d.debt)} <Text style={st.day}>· day {d.days}</Text>
        </Text>
        <Text style={st.text}>{next}</Text>
        <View style={st.actions}>
          <Pressable onPress={() => onNavigate('rooms')} style={[st.btn, { backgroundColor: '#fff' }]}>
            <Text style={[st.btnText, { color: '#be123c' }]}>Raise prices</Text>
          </Pressable>
          <Pressable onPress={() => onNavigate('staff')} style={[st.btn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={[st.btnText, { color: '#fff' }]}>Cut payroll</Text>
          </Pressable>
          {onBuyCoins && (
            <Pressable onPress={onBuyCoins} style={[st.btn, { backgroundColor: '#fbbf24' }]}>
              <Text style={[st.btnText, { color: '#0f172a' }]}>💎 Clear with coins</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={st.facts}>
        <Text style={st.fact}>% Interest −{usd(d.interest)}/day</Text>
        <Text style={st.fact}>📉 Bookings −{d.bookingPenalty}% · rating falling daily</Text>
        <Text style={st.fact}>{d.atRiskStaff ? `🚪 ${d.atRiskStaff} unpaid staff close to quitting` : '😟 Staff morale dropping (unpaid wages)'}</Text>
        {d.repoTarget ? (
          <Text style={st.fact}>
            🏦 Next seizure: {d.repoTarget.name} (covers {usd(d.repoValue)})
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  body: { padding: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  day: { color: '#fecdd3', fontWeight: '600' },
  text: { color: '#ffe4e6', fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { fontSize: 12, fontWeight: '700' },
  facts: { backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  fact: { color: '#ffe4e6', fontSize: 11 },
});

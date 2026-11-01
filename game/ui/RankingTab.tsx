// Ranking: the public leaderboard by hotel value (port of the web's
// components/game/RankingTab.js). Sharing, invites and "your race" need an
// account, which the app gets with sign-in.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { socialAPI, type RankedHotel } from '../platform/api';
import { Button, C, Card, Section, TabHeader, s, usd } from './kit';

const MEDALS = ['🥇', '🥈', '🥉'];

function Row({ h }: { h: RankedHotel }) {
  return (
    <Pressable onPress={() => Linking.openURL(`https://www.playlobbyboss.com/hotel/${encodeURIComponent(h.id)}`)}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        <Text style={{ width: 30, textAlign: 'center', fontWeight: '900', color: C.sub }}>{MEDALS[h.rank - 1] || `#${h.rank}`}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {h.hotelName}
          </Text>
          <Text style={s.tiny} numberOfLines={1}>
            {h.name} · Lv {h.level} · {h.rating.toFixed(1)}★ · {h.rooms} rooms · day {h.day}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{usd(h.value)}</Text>
      </Card>
    </Pressable>
  );
}

export default function RankingTab() {
  const [board, setBoard] = useState<{ total: number; leaderboard: RankedHotel[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBoard(await socialAPI.leaderboard(50));
    } catch {
      setError('Could not load the ranking. Check your connection and try again.');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <TabHeader icon="🏆" title="Ranking" subtitle="Hotels ranked by what they're worth. Only server-verified games count." />
      <Card style={{ backgroundColor: C.indigoSoft, borderColor: '#c7d2fe' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#312e81' }}>Join the ranking</Text>
        <Text style={{ fontSize: 13, color: '#3730a3', marginTop: 2 }}>Hotels played with a free PlayLobbyboss account are ranked. Hotels played as a guest on this phone aren't.</Text>
      </Card>
      {error && (
        <Card style={{ backgroundColor: C.redSoft, borderColor: '#fecdd3' }}>
          <Text style={{ fontSize: 13, color: '#be123c' }}>{error}</Text>
          <Button variant="ghost" style={{ marginTop: 8 }} onPress={load}>
            Try again
          </Button>
        </Card>
      )}
      <Section icon="👥" title="Top hotels" hint={board ? `${board.total} hotels in the ranking` : undefined}>
        {!board && !error && <ActivityIndicator color={C.indigo} style={{ marginVertical: 20 }} />}
        {board && board.leaderboard.length === 0 && <Text style={s.small}>No hotels yet — be the first!</Text>}
        {(board ? board.leaderboard : []).map((h) => (
          <Row key={h.id} h={h} />
        ))}
      </Section>
    </View>
  );
}

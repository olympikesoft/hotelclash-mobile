// Ranking: leaderboard by hotel value, and for signed-in players their rank,
// race, sharing and invites (port of the web's components/game/RankingTab.js).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, Text, View } from 'react-native';
import { apiError, socialAPI, type MyRanking, type RankedHotel } from '../platform/api';
import { track } from '../../services/analytics';
import { Button, C, Card, Section, Stat, StatRow, TabHeader, s, usd } from './kit';

const MEDALS = ['🥇', '🥈', '🥉'];
const hotelPage = (id: string) => `https://www.playlobbyboss.com/hotel/${encodeURIComponent(id)}`;

function Row({ h, me }: { h: RankedHotel; me?: boolean }) {
  return (
    <Pressable onPress={() => Linking.openURL(hotelPage(h.id))}>
      <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, me && { backgroundColor: C.indigoSoft, borderColor: '#c7d2fe' }]}>
        <Text style={{ width: 30, textAlign: 'center', fontWeight: '900', color: C.sub }}>{MEDALS[h.rank - 1] || `#${h.rank}`}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {h.hotelName}
          </Text>
          <Text style={s.tiny} numberOfLines={1}>
            {me ? 'You' : h.name} · Lv {h.level} · {h.rating.toFixed(1)}★ · {h.rooms} rooms · day {h.day}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{usd(h.value)}</Text>
      </Card>
    </Pressable>
  );
}

export default function RankingTab({ signedIn, onSignUp, onCoinsClaimed }: { signedIn: boolean; onSignUp: () => void; onCoinsClaimed: () => void }) {
  const [board, setBoard] = useState<{ total: number; leaderboard: RankedHotel[] } | null>(null);
  const [mine, setMine] = useState<MyRanking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, m] = await Promise.all([socialAPI.leaderboard(50), signedIn ? socialAPI.me() : Promise.resolve(null)]);
      setBoard(b);
      setMine(m);
    } catch {
      setError('Could not load the ranking. Check your connection and try again.');
    }
  }, [signedIn]);
  useEffect(() => {
    load();
  }, [load]);

  const me = mine?.me || null;
  const ahead = me && mine ? mine.neighbours.find((n) => n.rank === me.rank - 1) : null;

  const shareHotel = async () => {
    if (!mine) return;
    const text = me ? `My hotel ${me.hotelName} is #${me.rank} on PlayLobbyboss, worth ${usd(me.value)}. Can you beat it?` : 'Build your own hotel empire on PlayLobbyboss — can you beat mine?';
    const res = await Share.share({ message: `${text} ${mine.shareUrl}`, url: mine.shareUrl }).catch(() => null);
    if (res && res.action !== Share.dismissedAction) track('share', { content_type: 'hotel', method: 'share_sheet' });
  };
  const shareInvite = async () => {
    if (!mine) return;
    const res = await Share.share({ message: `Join me on PlayLobbyboss and get bonus coins: ${mine.inviteUrl}`, url: mine.inviteUrl }).catch(() => null);
    if (res && res.action !== Share.dismissedAction) track('share', { content_type: 'invite', method: 'share_sheet' });
  };
  const claim = async (inviteId: string) => {
    setClaiming(inviteId);
    try {
      await socialAPI.claimInvite(inviteId);
      onCoinsClaimed(); // the coins reach the game on the next sync
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not claim this reward.'));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <View>
      <TabHeader icon="🏆" title="Ranking" subtitle="Hotels ranked by what they're worth. Only server-verified games count." />

      {!signedIn && (
        <Card style={{ backgroundColor: C.indigoSoft, borderColor: '#c7d2fe' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#312e81' }}>Join the ranking</Text>
          <Text style={{ fontSize: 13, color: '#3730a3', marginTop: 2 }}>Create a free account to put your hotel on the leaderboard, share it and invite friends.</Text>
          <Button style={{ marginTop: 10 }} onPress={onSignUp}>
            Create account
          </Button>
        </Card>
      )}

      {error && (
        <Card style={{ backgroundColor: C.redSoft, borderColor: '#fecdd3' }}>
          <Text style={{ fontSize: 13, color: '#be123c' }}>{error}</Text>
          <Button variant="ghost" style={{ marginTop: 8 }} onPress={load}>
            Try again
          </Button>
        </Card>
      )}

      {signedIn && mine && (
        <>
          <StatRow>
            <Stat label="Your rank" value={me ? `#${me.rank}` : '—'} sub={board ? `of ${board.total} hotels` : ''} tone={C.indigo} />
            <Stat label="Hotel value" value={me ? usd(me.value) : '—'} sub={me ? `Level ${me.level}` : 'Play a few days to enter'} />
            <Stat label="Next place" value={ahead && me ? usd(ahead.value - me.value) : me ? '👑 Top' : '—'} sub={ahead ? `to pass ${ahead.hotelName}` : ''} />
            <Stat label="Friends invited" value={mine.friends.length} sub="+1,000 coins each at day 5" />
          </StatRow>

          <Section icon="📤" title="Share your hotel" hint="Friends who join from your link count as your invites.">
            <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Button onPress={shareHotel}>📤 Share my hotel</Button>
              <Button variant="ghost" onPress={shareInvite}>
                ✉️ Invite a friend
              </Button>
              {me && (
                <Button variant="ghost" onPress={() => Linking.openURL(hotelPage(me.id))}>
                  ↗ My public page
                </Button>
              )}
            </View>
          </Section>

          {mine.neighbours.length > 1 && (
            <Section icon="👑" title="Your race" hint="The hotels just above and below you.">
              {mine.neighbours.map((h) => (
                <Row key={h.id} h={h} me={Boolean(me && h.id === me.id)} />
              ))}
            </Section>
          )}

          {mine.friends.length > 0 && (
            <Section icon="🎁" title="Friends you invited">
              {mine.friends.map((f) => (
                <Card key={f.inviteId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{f.name}</Text>
                    <Text style={s.tiny}>{f.day ? `Day ${f.day} · Lv ${f.level} · ${usd(f.value)}` : 'Not started yet'}</Text>
                  </View>
                  {f.claimed ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>+1,000 coins ✓</Text>
                  ) : f.canClaim ? (
                    <Button busy={claiming === f.inviteId} onPress={() => claim(f.inviteId)}>
                      🎁 Claim 1,000
                    </Button>
                  ) : (
                    <Text style={s.tiny}>Reward at day 5</Text>
                  )}
                </Card>
              ))}
            </Section>
          )}
        </>
      )}

      <Section icon="👥" title="Top hotels" hint={board ? `${board.total} hotels in the ranking` : undefined}>
        {!board && !error && <ActivityIndicator color={C.indigo} style={{ marginVertical: 20 }} />}
        {board && board.leaderboard.length === 0 && <Text style={s.small}>No hotels yet — be the first!</Text>}
        {(board ? board.leaderboard : []).map((h) => (
          <Row key={h.id} h={h} me={Boolean(me && h.id === me.id)} />
        ))}
      </Section>
    </View>
  );
}

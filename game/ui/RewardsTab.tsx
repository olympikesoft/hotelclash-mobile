// Rewards: the daily wheel, the ad bonus and one-time share rewards (port of
// the web's RewardsTab.js + DailyRewardWheel.js). Every amount, limit and
// cooldown is decided by the engine; this screen only animates and asks.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Share, Text, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { engineData } from '../catalog';
import type { ActionResult, GameState } from '../types';
import { Button, C, Card, Section, Stat, StatRow, TabHeader, s, usd } from './kit';

const SHARE_URL = 'https://www.playlobbyboss.com';
const SHARE_TEXT = 'Just started playing PlayLobbyboss - an amazing hotel management game! 🏨✨ Come build your empire with me!';

// Same look as the web wheel; the outcome comes from the engine (SPIN_WHEEL).
const WHEEL_LOOK: Record<number, { label: string; color: string }> = {
  1: { label: '$500', color: '#FFD700' },
  2: { label: '$1000', color: '#FF6B6B' },
  3: { label: '50 💎', color: '#4ECDC4' },
  4: { label: '$2000', color: '#45B7D1' },
  5: { label: '+0.5 ⭐', color: '#FFA07A' },
  6: { label: '$5000!', color: '#98D8C8' },
  7: { label: '100 💎', color: '#F7DC6F' },
  8: { label: '$1500', color: '#BB8FCE' },
};

const TASKS: { id: string; title: string; icon: string; kind: 'share' | 'follow' }[] = [
  { id: 'share_twitter', title: 'Share on X / Twitter', icon: '🐦', kind: 'share' },
  { id: 'share_whatsapp', title: 'Share via WhatsApp', icon: '💬', kind: 'share' },
  { id: 'share_telegram', title: 'Share via Telegram', icon: '✈️', kind: 'share' },
  { id: 'share_reddit', title: 'Post on Reddit', icon: '👽', kind: 'share' },
  { id: 'share_email', title: 'Share via Email', icon: '✉️', kind: 'share' },
  { id: 'copy_link_share', title: 'Share your link anywhere', icon: '🔗', kind: 'share' },
  { id: 'follow_facebook', title: 'Follow us on Facebook', icon: '📘', kind: 'follow' },
];

const SIZE = 260;
const R = SIZE / 2;

function Wheel({ segments, rotation }: { segments: { id: number }[]; rotation: Animated.Value }) {
  const n = segments.length;
  const slice = (2 * Math.PI) / n;
  const spin = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 22, color: C.text, marginBottom: -6, zIndex: 1 }}>▼</Text>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={SIZE} height={SIZE}>
          <G x={R} y={R}>
            {segments.map((seg, i) => {
              // Segment i is centred on angle i × slice, measured clockwise from the top.
              const a0 = i * slice - slice / 2 - Math.PI / 2;
              const a1 = a0 + slice;
              const path = `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
              const mid = a0 + slice / 2;
              const look = WHEEL_LOOK[seg.id] || { label: '?', color: '#ddd' };
              return (
                <G key={seg.id}>
                  <Path d={path} fill={look.color} stroke="#fff" strokeWidth={2} />
                  <SvgText
                    x={R * 0.62 * Math.cos(mid)}
                    y={R * 0.62 * Math.sin(mid)}
                    fontSize={13}
                    fontWeight="bold"
                    fill="#1f2937"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    rotation={(mid * 180) / Math.PI + 90}
                    origin={`${R * 0.62 * Math.cos(mid)}, ${R * 0.62 * Math.sin(mid)}`}
                  >
                    {look.label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function RewardsTab({
  game,
  spinsLeft,
  dispatch,
  onWatchAd,
  adReady,
  toast,
}: {
  game: GameState;
  spinsLeft: number;
  dispatch: (type: string, payload?: object) => ActionResult;
  onWatchAd: () => Promise<boolean>;
  adReady: boolean;
  toast: (tone: 'ok' | 'error' | 'info', text: string) => void;
}) {
  const segments: { id: number; type: string; amount: number }[] = engineData.WHEEL_SEGMENTS;
  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<string | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; left: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const claimed = new Set<string>(game.claimedRewards || []);
  const rewards: Record<string, number> = engineData.SOCIAL_REWARDS;
  const adBonus = engineData.AD_REWARDS.mobile_ad_bonus as { amount: number; cooldownMs: number };
  const lastAd = (game.clock?.ads || {}).mobile_ad_bonus || 0;
  const adWait = Math.max(0, lastAd + adBonus.cooldownMs - now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // After sharing, a short wait before the claim (like the web's confirm step).
  useEffect(() => {
    if (!pending || pending.left <= 0) return undefined;
    const t = setTimeout(() => setPending((p) => (p ? { ...p, left: p.left - 1 } : p)), 1000);
    return () => clearTimeout(t);
  }, [pending]);

  const spin = () => {
    if (spinning || spinsLeft <= 0) return;
    const result = dispatch('SPIN_WHEEL');
    const wheel = result.ok ? result.effects.find((e) => e.kind === 'wheel') : null;
    if (!wheel) {
      toast('error', 'No spins left today.');
      return;
    }
    const index = Math.max(0, segments.findIndex((sg) => sg.id === wheel.segment.id));
    // Five full turns, then land the winning segment under the pointer.
    const target = angle.current - (angle.current % 360) + 1800 + (360 - index * (360 / segments.length));
    angle.current = target;
    setSpinning(true);
    setWon(null);
    Animated.timing(rotation, { toValue: target, duration: 3000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setSpinning(false);
      setWon((WHEEL_LOOK[wheel.segment.id] || { label: '' }).label);
    });
  };

  const watchAd = async () => {
    setAdBusy(true);
    const earned = await onWatchAd();
    setAdBusy(false);
    if (!earned) return;
    const result = dispatch('CLAIM_AD_REWARD', { rewardId: 'mobile_ad_bonus' });
    if (!result.ok) toast('error', 'That bonus is cooling down — try again later.');
  };

  const startTask = async (task: (typeof TASKS)[number]) => {
    try {
      if (task.kind === 'follow') await Linking.openURL('https://facebook.com/hotelclash');
      else {
        const res = await Share.share({ message: `${SHARE_TEXT} ${SHARE_URL}`, url: SHARE_URL });
        if (res.action === Share.dismissedAction) return;
      }
      setPending({ id: task.id, left: 5 });
    } catch {
      toast('error', 'Could not open sharing on this phone.');
    }
  };

  const claim = (id: string) => {
    const result = dispatch('CLAIM_SOCIAL_REWARD', { rewardId: id });
    setPending(null);
    if (!result.ok) toast('error', result.error === 'already_claimed' ? 'Already claimed.' : 'Could not claim this reward.');
  };

  const available = TASKS.filter((t) => !claimed.has(t.id)).reduce((t, x) => t + (rewards[x.id] || 0), 0);
  const earned = TASKS.filter((t) => claimed.has(t.id)).reduce((t, x) => t + (rewards[x.id] || 0), 0);

  return (
    <View>
      <TabHeader icon="🎁" title="Rewards" subtitle="Spin the wheel every day, watch an ad for a cash bonus, and share the game." />
      <StatRow>
        <Stat label="Spins today" value={`${spinsLeft} left`} sub={`${engineData.WHEEL_SPINS_PER_DAY} per day`} />
        <Stat label="Share rewards" value={usd(available)} sub={`${usd(earned)} claimed`} tone={C.green} />
      </StatRow>

      <Section icon="🎰" title="Lucky wheel">
        <Card style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Wheel segments={segments} rotation={rotation} />
          <Button big style={{ marginTop: 14, alignSelf: 'stretch' }} disabled={spinning || spinsLeft <= 0} onPress={spin}>
            {spinning ? '🎰 Spinning…' : spinsLeft > 0 ? '🎯 Spin now' : 'No spins left today'}
          </Button>
          {won && <Text style={{ marginTop: 10, fontSize: 18, fontWeight: '900', color: C.text }}>🎉 You won {won}</Text>}
        </Card>
      </Section>

      <Section icon="📺" title="Ad bonus">
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center' }}>Watch a short video for {usd(adBonus.amount)}. Available every {Math.round(adBonus.cooldownMs / 60000)} minutes.</Text>
          <Button big variant="green" style={{ marginTop: 10, alignSelf: 'stretch' }} disabled={adWait > 0 || !adReady} busy={adBusy} onPress={watchAd}>
            {adWait > 0 ? `Next bonus in ${Math.ceil(adWait / 60000)} min` : adReady ? `▶ Watch ad for ${usd(adBonus.amount)}` : 'Ad loading…'}
          </Button>
        </Card>
      </Section>

      <Section icon="📣" title="Share the game" hint="One-time rewards. Thanks for helping the game grow!">
        {TASKS.map((t) => {
          const done = claimed.has(t.id);
          const waiting = pending?.id === t.id;
          return (
            <Card key={t.id} style={done ? { backgroundColor: C.greenSoft, borderColor: '#a7f3d0' } : null}>
              <View style={s.between}>
                <Text style={[s.title, { flex: 1 }]}>
                  {t.icon} {t.title}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#b45309' }}>{usd(rewards[t.id] || 0)}</Text>
              </View>
              {done ? (
                <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '700', color: C.green }}>✓ Claimed</Text>
              ) : waiting ? (
                <Button style={{ marginTop: 8 }} disabled={pending.left > 0} onPress={() => claim(t.id)}>
                  {pending.left > 0 ? `Claim in ${pending.left}s` : 'I have done it — claim'}
                </Button>
              ) : (
                <Button variant="ghost" style={{ marginTop: 8 }} disabled={Boolean(pending)} onPress={() => startTask(t)}>
                  {t.kind === 'follow' ? 'Open Facebook' : 'Share'}
                </Button>
              )}
            </Card>
          );
        })}
      </Section>
    </View>
  );
}

// The native game screen (replaces the WebView): runs the shared engine via
// GameStore, ticks the clock, turns engine effects into pop-ups and toasts.
// Mirrors the web's pages/game.js for the phase-1 tabs.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import useHotelGame from './useHotelGame';
import useDayHistory from './useDayHistory';
import { facilityTypes, insights, roomTypes, staffRoles, trainingPrograms } from './catalog';
import { isRewardedAdReady, preloadRewardedAd, showRewardedAd } from './platform/rewardedAd';
import { track } from '../services/analytics';
import { buyRemoveAds, useRemoveAds } from '../services/removeAds';
import type { Effect, GameState } from './types';
import Hud, { type MenuItem } from './ui/Hud';
import Dashboard, { type Tab } from './ui/Dashboard';
import RoomsTab from './ui/RoomsTab';
import StaffTab from './ui/StaffTab';
import FacilitiesTab from './ui/FacilitiesTab';
import MarketingTab from './ui/MarketingTab';
import { AwayModal, EventModal, GameOverModal, LevelUpModal, NewGameModal, Toasts, explainRejection, type Toast } from './ui/Modals';
import { C } from './ui/kit';

const BANNER_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-7819420241195884/9518012960';
const DAY_MS: Record<number, number> = { 1: 3000, 2: 1500 }; // same pacing as the web game

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Hotel' },
  { id: 'rooms', icon: '🛏️', label: 'Rooms' },
  { id: 'staff', icon: '👥', label: 'Staff' },
  { id: 'facilities', icon: '✨', label: 'Facilities' },
  { id: 'marketing', icon: '📣', label: 'Marketing' },
];

const cheapestRoom = roomTypes.reduce<(typeof roomTypes)[number] | null>((best, r) => (!best || r.baseCost < best.baseCost ? r : best), null);

export default function GameScreen() {
  const [speed, setSpeed] = useState(0); // 0 = paused, 1 = normal, 2 = fast
  const speedBeforePause = useRef(1);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [event, setEvent] = useState<{ title: string; description: string; result: string } | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; bonus: number; unlocks: string[] } | null>(null);
  const [away, setAway] = useState<{ ms: number; amount: number } | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const removeAds = useRemoveAds();

  const toast = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3000);
  }, []);

  /** Pause for a pop-up; `resume()` restores the speed the player had. */
  const pause = useCallback(() => {
    setSpeed((sp) => {
      if (sp) speedBeforePause.current = sp;
      return 0;
    });
  }, []);
  const resume = useCallback(() => setSpeed(speedBeforePause.current || 1), []);

  const handleEffects = (effects: Effect[]) => {
    for (const e of effects) {
      switch (e.kind) {
        case 'event':
          setEvent({ title: e.title, description: e.description, result: e.result });
          pause();
          break;
        case 'levelup':
          setLevelUp({ level: e.level, bonus: e.money, unlocks: e.unlocks || [] });
          track('level_up', { level: e.level });
          pause();
          break;
        case 'achievement':
          toast('ok', `🏆 ${e.achievement.title}`);
          track('achievement', { id: e.achievement.id });
          break;
        case 'awayEarnings':
          setAway({ ms: e.ms, amount: e.amount });
          track('away_earnings_shown', { amount: e.amount, minutes: Math.round(e.ms / 60000) });
          pause();
          break;
        case 'reward':
          if (e.type === 'money') toast('ok', `+$${e.amount.toLocaleString('en-US')}`);
          else if (e.type === 'credits') toast('ok', `+${e.amount.toLocaleString('en-US')}💎`);
          break;
        default:
          // notify/celebration/challenge: the activity feed comes in phase 2
          break;
      }
    }
  };
  const effectsRef = useRef(handleEffects);
  effectsRef.current = handleEffects;

  const { state: game, dispatch, sync, newGame } = useHotelGame({ onEffects: (effects) => effectsRef.current(effects) });
  const history = useDayHistory(game);
  const ready = Boolean(game);

  // Start the clock shortly after loading (like the web game), and show any
  // away earnings left unclaimed when the app was last closed.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!game || autoStarted.current) return undefined;
    autoStarted.current = true;
    track('game_screen_open', { native: true });
    if (game.away) {
      setAway(game.away);
      return undefined;
    }
    const t = setTimeout(() => setSpeed((sp) => (sp === 0 ? 1 : sp)), 800);
    return () => clearTimeout(t);
  }, [game]);

  // The clock stops while the app is in the background; the engine pays away
  // earnings for the gap on the first tick back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!ready || !speed || !appActive) return undefined;
    const id = setInterval(() => dispatch('TICK'), DAY_MS[speed]);
    return () => clearInterval(id);
  }, [speed, ready, appActive, dispatch]);

  useEffect(() => {
    preloadRewardedAd();
    const id = setInterval(() => setAdReady(isRewardedAdReady()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Run a player action and always tell the player what happened. */
  const act = (type: string, payload?: object, okText?: string) => {
    const result = dispatch(type, payload);
    if (!result.ok) toast('error', explainRejection(result));
    else if (okText) toast('ok', okText);
    return result;
  };

  const claimAway = async (doubled: boolean) => {
    if (doubled) {
      setAdBusy(true);
      const earned = await showRewardedAd('away_earnings');
      setAdBusy(false);
      doubled = earned;
    }
    const result = dispatch('CLAIM_AWAY_EARNINGS', { doubled });
    track('away_earnings_claimed', { doubled, amount: result.amount || 0 });
    setAway(null);
    resume();
  };

  const navigate = (next: Tab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  if (!game) {
    return (
      <SafeAreaView style={[st.root, st.center]}>
        <ActivityIndicator color={C.indigo} />
        <Text style={{ marginTop: 10, color: C.sub }}>Opening your hotel…</Text>
      </SafeAreaView>
    );
  }

  const menu: MenuItem[] = [
    { icon: '🔄', label: 'New hotel…', onPress: () => setShowNewGame(true) },
    ...(!removeAds.owned && removeAds.price ? [{ icon: '🚫', label: `Remove ads · ${removeAds.price}`, onPress: buyRemoveAds }] : []),
  ];

  const g = game as GameState;
  return (
    <SafeAreaView style={st.root} edges={['top', 'left', 'right']}>
      <Hud game={g} speed={speed} onSpeed={setSpeed} sync={sync} dayMs={DAY_MS[speed] || 3000} menu={menu} />

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        {tab === 'dashboard' && <Dashboard game={g} history={history} cheapestRoom={cheapestRoom} onNavigate={navigate} onQuickBuild={() => cheapestRoom && act('BUILD_ROOM', { roomType: cheapestRoom.type }, `Built a new ${cheapestRoom.type} room.`)} />}
        {tab === 'rooms' && (
          <RoomsTab
            game={g}
            roomTypes={roomTypes}
            buildRoom={(type) => act('BUILD_ROOM', { roomType: type }, `Built a new ${type} room.`)}
            upgradeRoom={(roomId) => act('UPGRADE_ROOM', { roomId }, `Room #${roomId} upgraded — guests will notice.`)}
            adjustRoomPrice={(roomId, price) => act('SET_ROOM_PRICE', { roomId, price: Number(price) })}
            buyPlot={() => act('BUY_PLOT', {}, 'Bought a new plot of land.')}
          />
        )}
        {tab === 'staff' && (
          <StaffTab
            game={g}
            staffRoles={staffRoles}
            trainingPrograms={trainingPrograms}
            hireStaff={(role) => act('HIRE_STAFF', { role }, `Hired a new ${role}.`)}
            fireStaff={(staffId) => act('FIRE_STAFF', { staffId }, 'Staff member let go.')}
            conductTraining={(trainingId, staffId) => act('TRAIN_STAFF', { trainingId, staffId }, 'Training complete — skills improved.')}
          />
        )}
        {tab === 'facilities' && (
          <FacilitiesTab
            game={g}
            facilityTypes={facilityTypes}
            buildFacility={(type) => act('BUILD_FACILITY', { facilityType: type }, `${type} is open for guests!`)}
            upgradeFacility={(facilityId) => act('UPGRADE_FACILITY', { facilityId }, 'Facility upgraded.')}
            hireStaff={(role) => act('HIRE_STAFF', { role }, `Hired a new ${role}.`)}
            setFacilityPrice={(facilityId, itemId, price) => act('SET_FACILITY_PRICE', { facilityId, itemId, price })}
          />
        )}
        {tab === 'marketing' && (
          <MarketingTab
            game={g}
            launchMarketingCampaign={(campaignId) => act('LAUNCH_CAMPAIGN', { campaignId }, 'Campaign launched — expect more bookings.')}
            changePolicy={(key, value) => act('SET_POLICY', { key, value }, value ? 'Policy turned on.' : 'Policy turned off.')}
          />
        )}
      </ScrollView>

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((list) => list.filter((t) => t.id !== id))} />

      {!removeAds.owned && (
        <View style={st.banner}>
          <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={st.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => navigate(t.id)} style={st.tabBtn} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={[st.tabIcon, tab !== t.id && { opacity: 0.55 }]}>{t.icon}</Text>
            <Text style={[st.tabLabel, tab === t.id && st.tabLabelOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </SafeAreaView>

      <AwayModal away={away} adReady={adReady} busy={adBusy} onCollect={() => claimAway(false)} onDouble={() => claimAway(true)} />
      <EventModal
        event={event}
        onClose={() => {
          setEvent(null);
          resume();
        }}
      />
      <LevelUpModal
        levelUp={levelUp}
        next={insights.levelProgress(g)}
        onGo={(next) => {
          setLevelUp(null);
          navigate(next);
          resume();
        }}
        onClose={() => {
          setLevelUp(null);
          resume();
        }}
      />
      <GameOverModal game={g} onNewGame={() => setShowNewGame(true)} />
      <NewGameModal
        open={showNewGame}
        defaultName={g.hotelName}
        isGuest={sync.mode !== 'account'}
        onClose={() => setShowNewGame(false)}
        onConfirm={async (hotelName) => {
          await newGame({ hotelName, hotelType: g.hotelType });
          setShowNewGame(false);
          setSpeed(0);
          navigate('dashboard');
          track('new_game');
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, paddingBottom: 24 },
  banner: { alignItems: 'center', backgroundColor: '#f5f5f5' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: C.faint, marginTop: 2 },
  tabLabelOn: { color: C.indigo },
});

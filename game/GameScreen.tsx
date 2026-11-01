// The native game screen (replaces the WebView): runs the shared engine via
// GameStore, ticks the clock, turns engine effects into pop-ups and toasts.
// Mirrors the web's pages/game.js.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import useHotelGame from './useHotelGame';
import useDayHistory from './useDayHistory';
import { engineData, facilityTypes, insights, roomTypes, staffRoles, trainingPrograms } from './catalog';
import { readJson, writeJson } from './platform/storage';
import { PRIVACY_URL, hasAccountToken, paymentAPI, signOut } from './platform/api';
import { onCoinsGranted, retryUnfinished } from './platform/coinShop';
import CoinShop from './ui/CoinShop';
import AccountModal, { ManageAccountModal } from './ui/AccountModal';
import DebtBanner from './ui/DebtBanner';
import Confetti from './ui/Confetti';
import * as Haptics from 'expo-haptics';
import SavesModal from './ui/SavesModal';
import { isRewardedAdReady, preloadRewardedAd, showRewardedAd } from './platform/rewardedAd';
import { maybeShowInterstitial, preloadInterstitial } from './platform/interstitialAd';
import { cancelAwayReminder, scheduleAwayReminder } from './platform/awayReminder';
import { showAdPrivacyOptions, useAdsConsent } from '../services/adsConsent';
import { track } from '../services/analytics';
import { buyRemoveAds, useRemoveAds } from '../services/removeAds';
import type { Effect, GameState } from './types';
import Hud, { type MenuItem } from './ui/Hud';
import Dashboard, { type Tab } from './ui/Dashboard';
import RoomsTab from './ui/RoomsTab';
import StaffTab from './ui/StaffTab';
import FacilitiesTab from './ui/FacilitiesTab';
import MarketingTab from './ui/MarketingTab';
import FinanceTab from './ui/FinanceTab';
import GuestsTab from './ui/GuestsTab';
import RivalsTab from './ui/RivalsTab';
import RankingTab from './ui/RankingTab';
import RewardsTab from './ui/RewardsTab';
import ActivityFeed, { type Note } from './ui/ActivityFeed';
import { GettingStarted, HowToPlay, resetOnboarding } from './ui/Guide';
import { AwayModal, EventModal, GameOverModal, LevelUpModal, NewGameModal, Toasts, explainRejection, type Toast } from './ui/Modals';
import { C, s } from './ui/kit';

const BANNER_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-7819420241195884/9518012960';
const DAY_MS: Record<number, number> = { 1: 3000, 2: 1500 }; // same pacing as the web game

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Hotel' },
  { id: 'rooms', icon: '🛏️', label: 'Rooms' },
  { id: 'staff', icon: '👥', label: 'Staff' },
  { id: 'facilities', icon: '✨', label: 'Facilities' },
  { id: 'more', icon: '☰', label: 'More' },
];
// Behind "More" (a phone bar fits five tabs).
const MORE_TABS: { id: Tab; icon: string; label: string; sub: string }[] = [
  { id: 'marketing', icon: '📣', label: 'Marketing', sub: 'Campaigns & policies' },
  { id: 'finance', icon: '💵', label: 'Finance', sub: 'Statement & insurance' },
  { id: 'guests', icon: '🧳', label: 'Guests', sub: 'Moods & reviews' },
  { id: 'rivals', icon: '🏢', label: 'Rivals', sub: 'Market, visits, buyouts' },
  { id: 'rewards', icon: '🎁', label: 'Rewards', sub: 'Wheel & bonuses' },
  { id: 'ranking', icon: '🏆', label: 'Ranking', sub: 'Top hotels' },
  { id: 'activity', icon: '🔔', label: 'Activity', sub: 'Everything that happened' },
];
const MORE_IDS = new Set<Tab>(MORE_TABS.map((t) => t.id));

const NOTES_KEY = 'hotelClash.notifications';
const todayUtc = () => new Date().toISOString().slice(0, 10);

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
  const [showHelp, setShowHelp] = useState(false);
  const [account, setAccount] = useState<{ mode: 'login' | 'register'; reason?: string } | null>(null);
  const [showSaves, setShowSaves] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [notes, setNotes] = useState<Note[]>(() => readJson<Note[]>(NOTES_KEY, []));
  const scrollRef = useRef<ScrollView>(null);
  const removeAds = useRemoveAds();
  const adsConsent = useAdsConsent();

  // The engine decides what to report; the Activity tab groups repeats.
  const addNote = (message: string, isSpecial: boolean, type: string, day: number) =>
    setNotes((prev) => [{ id: `${Date.now()}-${Math.random()}`, message, isSpecial, type: type || 'general', day }, ...prev].slice(0, 150));
  useEffect(() => {
    const t = setTimeout(() => writeJson(NOTES_KEY, notes.slice(0, 100)), 1000);
    return () => clearTimeout(t);
  }, [notes]);

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

  const handleEffects = (effects: Effect[], after: GameState) => {
    for (const e of effects) {
      switch (e.kind) {
        case 'notify':
          addNote(e.message, Boolean(e.isSpecial), e.type, after.day);
          break;
        case 'event':
          setEvent({ title: e.title, description: e.description, result: e.result });
          pause();
          break;
        case 'levelup':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setConfetti((n) => n + 1);
          setLevelUp({ level: e.level, bonus: e.money, unlocks: e.unlocks || [] });
          track('level_up', { level: e.level });
          pause();
          break;
        case 'achievement':
          toast('ok', `🏆 ${e.achievement.title}`);
          setConfetti((n) => n + 1);
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
          // celebration/challenge/insufficientFunds: shown by the tabs and toasts
          break;
      }
    }
  };
  const effectsRef = useRef(handleEffects);
  effectsRef.current = handleEffects;

  const { state: game, dispatch, sync, newGame, restoreSave, loadLocalSnapshot, flush, user } = useHotelGame({ onEffects: (effects, after) => effectsRef.current(effects, after) });
  const history = useDayHistory(game);
  const ready = Boolean(game);

  // Coins waiting on the server (sign-up bonus, invites, purchases) are collected
  // once and added as RECEIVE_COINS, which the server checks against its records.
  // Only into an account-attached game: a guest game would lose them.
  const modeRef = useRef(sync.mode);
  modeRef.current = sync.mode;
  const deliverCoins = useCallback(async () => {
    if (modeRef.current !== 'account' || !hasAccountToken()) return;
    try {
      const { newCredits, delivered } = await paymentAPI.checkPayments();
      if (newCredits > 0) {
        for (const d of delivered) dispatch('RECEIVE_COINS', { ref: d.id, amount: Math.round(d.amount) });
        toast('ok', `🎁 ${newCredits.toLocaleString('en-US')} coins added to your balance!`);
      }
    } catch {
      // offline: collected on the next launch
    }
  }, [dispatch, toast]);
  useEffect(() => {
    if (sync.mode !== 'account') return;
    deliverCoins();
    retryUnfinished();
  }, [sync.mode, user?.id, deliverCoins]);
  useEffect(() => onCoinsGranted(() => deliverCoins()), [deliverCoins]);

  // Drop log entries "from the future" (a previous hotel, or a server correction).
  const currentDay = game ? game.day : null;
  useEffect(() => {
    if (currentDay == null) return;
    setNotes((list) => (list.some((n) => n.day > currentDay) ? list.filter((n) => n.day <= currentDay) : list));
  }, [currentDay]);

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

  // Android back: a "More" screen goes back to More, any other tab to the Hotel tab,
  // and only the Hotel tab leaves the app. (Pop-ups close themselves via onRequestClose.)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'dashboard') return false;
      setTab(MORE_IDS.has(tab) ? 'more' : 'dashboard');
      return true;
    });
    return () => sub.remove();
  }, [tab]);

  // The clock stops while the app is in the background; the engine pays away
  // earnings for the gap on the first tick back.
  const gameRef = useRef<GameState | null>(null);
  gameRef.current = game;
  useEffect(() => {
    cancelAwayReminder();
    const sub = AppState.addEventListener('change', (st) => {
      setAppActive(st === 'active');
      if (st === 'background') scheduleAwayReminder(gameRef.current);
      else if (st === 'active') cancelAwayReminder();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!ready || !speed || !appActive) return undefined;
    const id = setInterval(() => dispatch('TICK'), DAY_MS[speed]);
    return () => clearInterval(id);
  }, [speed, ready, appActive, dispatch]);

  useEffect(() => {
    preloadRewardedAd();
    preloadInterstitial();
    const id = setInterval(() => setAdReady(isRewardedAdReady()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Run a player action and always tell the player what happened (with a buzz). */
  const act = (type: string, payload?: object, okText?: string) => {
    const result = dispatch(type, payload);
    if (!result.ok) {
      toast('error', explainRejection(result));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      if (okText) toast('ok', okText);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
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

  // Wheel spins and rival visits are limited per real (UTC) day.
  const today = todayUtc();
  const spinsLeft = engineData.WHEEL_SPINS_PER_DAY - (game.clock?.wheelDate === today ? game.clock.wheelSpins : 0);
  const visitedToday: string[] = game.clock?.visitDate === today ? game.clock.visited || [] : [];

  const signedIn = Boolean(user);
  const confirmSignOut = () =>
    Alert.alert('Sign out?', "Your hotel stays in your account. This phone starts a new guest hotel until you sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setShowManage(false);
          flush().finally(() => {
            signOut();
            setNotes([]);
            track('logout');
          });
        },
      },
    ]);

  const menu: MenuItem[] = [
    ...(signedIn
      ? [{ icon: '👤', label: `${user?.username || 'Account'} · account`, onPress: () => setShowManage(true) }]
      : [
          { icon: '☁️', label: 'Save my hotel (free account)', onPress: () => setAccount({ mode: 'register' }) },
          { icon: '👤', label: 'Sign in', onPress: () => setAccount({ mode: 'login' }) },
        ]),
    { icon: '💾', label: signedIn ? 'Cloud saves' : 'Saves on this phone', onPress: () => setShowSaves(true) },
    ...(Platform.OS === 'android' ? [{ icon: '💎', label: 'Buy coins', onPress: () => setShowShop(true) }] : []),
    { icon: '❓', label: 'How to play', onPress: () => setShowHelp(true) },
    { icon: '🔄', label: 'New hotel…', onPress: () => setShowNewGame(true) },
    { icon: '🔒', label: 'Privacy policy', onPress: () => Linking.openURL(PRIVACY_URL) },
    ...(adsConsent.privacyOptions ? [{ icon: '🛡️', label: 'Ad privacy options', onPress: showAdPrivacyOptions }] : []),
    ...(!removeAds.owned && removeAds.price ? [{ icon: '🚫', label: `Remove ads · ${removeAds.price}`, onPress: buyRemoveAds }] : []),
  ];

  const g = game as GameState;
  return (
    <SafeAreaView style={st.root} edges={['top', 'left', 'right']}>
      <Hud game={g} speed={speed} onSpeed={setSpeed} sync={sync} dayMs={DAY_MS[speed] || 3000} menu={menu} onCredits={Platform.OS === 'android' ? () => setShowShop(true) : undefined} />

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <DebtBanner game={g} onNavigate={navigate} onBuyCoins={Platform.OS === 'android' ? () => setShowShop(true) : undefined} />
        {tab === 'dashboard' && <GettingStarted game={g} onNavigate={(t) => navigate(t as Tab)} />}
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
        {tab === 'finance' && (
          <FinanceTab game={g} history={history} onSetInsurance={(plan) => act('SET_INSURANCE', { plan }, plan === 'none' ? 'Insurance cancelled.' : 'Your hotel is insured.')} />
        )}
        {tab === 'guests' && <GuestsTab game={g} notifications={notes} />}
        {tab === 'rivals' && (
          <RivalsTab
            game={g}
            visitedToday={visitedToday}
            onVisit={(name) => {
              const result = act('VISIT_HOTEL', { name });
              if (result.ok) toast('ok', `Visited ${name}: +$${(result.amount || 0).toLocaleString('en-US')} for the insights.`);
            }}
            onAcquire={(competitorId) => act('ACQUIRE_HOTEL', { competitorId })}
          />
        )}
        {tab === 'ranking' && (
          <RankingTab
            signedIn={signedIn}
            onSignUp={() => setAccount({ mode: 'register', reason: 'Create a free account to put your hotel on the leaderboard, share it and invite friends.' })}
            onCoinsClaimed={() => {
              flush();
              toast('ok', 'Coins claimed — they arrive with your next sync.');
            }}
          />
        )}
        {tab === 'rewards' && (
          <RewardsTab game={g} spinsLeft={spinsLeft} dispatch={dispatch} onWatchAd={() => showRewardedAd('ad_bonus')} adReady={adReady} toast={toast} />
        )}
        {tab === 'activity' && <ActivityFeed notifications={notes} onClear={() => setNotes([])} />}
        {tab === 'more' && (
          <View style={st.moreGrid}>
            {MORE_TABS.map((t) => (
              <Pressable key={t.id} onPress={() => navigate(t.id)} style={({ pressed }) => [st.moreTile, pressed && { opacity: 0.8 }]}>
                <Text style={{ fontSize: 26 }}>{t.icon}</Text>
                <Text style={[s.title, { marginTop: 6 }]}>{t.label}</Text>
                <Text style={s.tiny}>{t.sub}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Confetti trigger={confetti} />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((list) => list.filter((t) => t.id !== id))} />

      {!removeAds.owned && adsConsent.canRequestAds && (
        <View style={st.banner}>
          <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={st.tabBar}>
        {TABS.map((t) => {
          const on = tab === t.id || (t.id === 'more' && MORE_IDS.has(tab));
          return (
            <Pressable key={t.id} onPress={() => navigate(t.id)} style={st.tabBtn} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[st.tabIcon, !on && { opacity: 0.55 }]}>{t.icon}</Text>
              <Text style={[st.tabLabel, on && st.tabLabelOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </SafeAreaView>

      <AwayModal away={away} adReady={adReady} busy={adBusy} onCollect={() => claimAway(false)} onDouble={() => claimAway(true)} />
      <EventModal
        event={event}
        onClose={() => {
          setEvent(null);
          resume();
          maybeShowInterstitial('event');
        }}
      />
      <LevelUpModal
        levelUp={levelUp}
        next={insights.levelProgress(g)}
        onSaveHotel={
          signedIn
            ? undefined
            : () => {
                setLevelUp(null);
                setAccount({ mode: 'register', reason: `Your hotel reached level ${levelUp?.level}! Save it with a free account so you never lose it — plus 10,000 coins.` });
              }
        }
        onGo={(next) => {
          setLevelUp(null);
          navigate(next);
          resume();
        }}
        onClose={() => {
          setLevelUp(null);
          resume();
          maybeShowInterstitial('level_up');
        }}
      />
      <GameOverModal game={g} onNewGame={() => setShowNewGame(true)} />
      <HowToPlay open={showHelp} onClose={() => setShowHelp(false)} />
      {account && (
        <AccountModal
          open
          initialMode={account.mode}
          reason={account.reason}
          hotelName={g.hotelName}
          onClose={() => setAccount(null)}
          onSignedIn={() => {
            setAccount(null);
            toast('ok', 'Signed in — your hotel now saves to your account.');
          }}
        />
      )}
      <CoinShop
        open={showShop}
        signedIn={signedIn}
        coins={g.credits || 0}
        onClose={() => setShowShop(false)}
        onSignUp={() => {
          setShowShop(false);
          setAccount({ mode: 'register', reason: 'Coins are kept in your account. Create a free account — you get 10,000 coins to start.' });
        }}
      />
      <ManageAccountModal
        open={showManage}
        username={user?.username}
        onClose={() => setShowManage(false)}
        onSignOut={confirmSignOut}
        onDeleted={() => {
          setShowManage(false);
          setNotes([]);
          toast('ok', 'Your account was deleted. You can keep playing as a guest.');
        }}
      />
      <SavesModal
        open={showSaves}
        isGuest={!signedIn}
        game={g}
        flush={flush}
        restoreSave={restoreSave}
        loadLocalSnapshot={loadLocalSnapshot}
        toast={toast}
        onClose={() => setShowSaves(false)}
        onLoaded={(name) => {
          setShowSaves(false);
          setSpeed(0);
          navigate('dashboard');
          toast('ok', `Loaded "${name}". Press ▶ to continue.`);
        }}
      />
      <NewGameModal
        open={showNewGame}
        defaultName={g.hotelName}
        isGuest={sync.mode !== 'account'}
        onClose={() => setShowNewGame(false)}
        onConfirm={async (hotelName) => {
          await newGame({ hotelName, hotelType: g.hotelType });
          setNotes([]);
          resetOnboarding();
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
  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreTile: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
});

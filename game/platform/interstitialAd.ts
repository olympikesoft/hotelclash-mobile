// Interstitial for the native game, shown only at natural breaks (after an
// event or level-up pop-up) and at most every few minutes. Never for players
// who bought Remove ads, and only once ad consent allows requests.
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { track } from '../../services/analytics';
import { whenAdsAllowed } from '../../services/adsConsent';
import { getRemoveAdsState } from '../../services/removeAds';

const UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-7819420241195884/9609170748';
const MIN_GAP_MS = 3 * 60 * 1000;

let ad: InterstitialAd | null = null;
let loaded = false;
let lastShown = Date.now(); // no interstitial in the first minutes of a session

export function preloadInterstitial() {
  if (ad || getRemoveAdsState().owned) return;
  whenAdsAllowed().then((allowed) => {
    if (!allowed || ad) return;
    const next = InterstitialAd.createForAdRequest(UNIT_ID, { requestNonPersonalizedAdsOnly: true });
    ad = next;
    loaded = false;
    next.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
    });
    next.addAdEventListener(AdEventType.ERROR, (error) => {
      track('ad_load_failed', { format: 'interstitial', code: (error as any)?.code });
      ad = null;
    });
    next.addAdEventListener(AdEventType.CLOSED, () => {
      ad = null;
      preloadInterstitial();
    });
    next.load();
  });
}

/** Show one if it's loaded and enough time has passed; returns whether it showed. */
export function maybeShowInterstitial(placement: string) {
  if (getRemoveAdsState().owned || !ad || !loaded || Date.now() - lastShown < MIN_GAP_MS) return false;
  lastShown = Date.now();
  loaded = false;
  track('ad_shown', { format: 'interstitial', placement });
  ad.show().catch(() => {
    ad = null;
    preloadInterstitial();
  });
  return true;
}

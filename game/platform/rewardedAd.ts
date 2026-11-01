// Rewarded video for the native game: always keeps one ad preloaded and
// resolves `showRewardedAd()` with whether the player earned the reward.
import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { track } from '../../services/analytics';

const UNIT_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7819420241195884/5484175866';

let ad: RewardedAd | null = null;
let loaded = false;

export function preloadRewardedAd() {
  if (ad) return;
  const next = RewardedAd.createForAdRequest(UNIT_ID, { requestNonPersonalizedAdsOnly: true });
  ad = next;
  loaded = false;
  next.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded = true;
  });
  next.addAdEventListener(AdEventType.ERROR, (error) => {
    track('ad_load_failed', { format: 'rewarded', code: (error as any)?.code });
    ad = null; // try again on the next preload
  });
  next.load();
}

export const isRewardedAdReady = () => loaded;

/** Shows the ad; resolves true only if the reward was earned. */
export function showRewardedAd(placement: string): Promise<boolean> {
  const current = ad;
  if (!current || !loaded) {
    track('ad_not_ready', { format: 'rewarded', placement });
    preloadRewardedAd();
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let earned = false;
    const offEarned = current.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
      track('ad_reward_earned', { placement });
    });
    const offClosed = current.addAdEventListener(AdEventType.CLOSED, () => {
      offEarned();
      offClosed();
      ad = null;
      preloadRewardedAd();
      resolve(earned);
    });
    track('ad_shown', { format: 'rewarded', placement });
    current.show().catch(() => {
      offEarned();
      offClosed();
      ad = null;
      preloadRewardedAd();
      resolve(false);
    });
  });
}

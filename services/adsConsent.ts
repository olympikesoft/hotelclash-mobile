// Ad consent (Google UMP) before any ad is requested. In the EU/UK and other
// regions that require it, Google shows its consent form on first launch; ads
// (always non-personalised requests) only start once consent allows them.
import { useEffect, useState } from 'react';
import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } from 'react-native-google-mobile-ads';
import { track } from './analytics';

type ConsentState = { ready: boolean; canRequestAds: boolean; privacyOptions: boolean };

let state: ConsentState = { ready: false, canRequestAds: false, privacyOptions: false };
const listeners = new Set<(s: ConsentState) => void>();
const set = (patch: Partial<ConsentState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

let started: Promise<boolean> | null = null;

/** Gather consent (form shown only if required), then initialise the ads SDK. Call once at app start. */
export function startAds(): Promise<boolean> {
  if (started) return started;
  started = (async () => {
    let canRequestAds = true;
    try {
      await AdsConsent.requestInfoUpdate();
      const info = await AdsConsent.loadAndShowConsentFormIfRequired();
      canRequestAds = info.canRequestAds;
      set({ privacyOptions: info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
      track('ads_consent', { can_request_ads: canRequestAds });
    } catch {
      // Consent service unreachable: Google allows requests using the last known consent.
      canRequestAds = (await AdsConsent.getConsentInfo().catch(() => null))?.canRequestAds ?? false;
    }
    // Emulators get test ads automatically; debug builds use TestIds everywhere.
    if (canRequestAds) await mobileAds().initialize().catch(() => {});
    set({ ready: true, canRequestAds });
    return canRequestAds;
  })();
  return started;
}

/** Resolves once consent is settled: true when ads may be requested. */
export const whenAdsAllowed = () => startAds();

/** "Privacy options" entry point (required in the menu wherever the form applies). */
export async function showAdPrivacyOptions() {
  try {
    const info = await AdsConsent.showPrivacyOptionsForm();
    set({ canRequestAds: info.canRequestAds });
    if (info.canRequestAds) mobileAds().initialize().catch(() => {});
  } catch {
    // form not available (not required in this region)
  }
}

export function useAdsConsent() {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}

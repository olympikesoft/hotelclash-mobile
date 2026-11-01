// "Remove ads" one-time purchase (Google Play Billing).
// Turns off banner and interstitial ads; rewarded ads stay (the player chooses to watch them).
// Ownership is cached on the device so it holds offline and before the store answers.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  getProducts,
  getAvailablePurchases,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  PurchaseStateAndroid,
  type Purchase,
} from 'react-native-iap';
import { track } from './analytics';

// Create this as a one-time (managed) product in Play Console > Monetize > Products > In-app products
export const REMOVE_ADS_SKU = 'remove_ads';
const OWNED_KEY = 'remove_ads_owned';

export type RemoveAdsState = {
  owned: boolean;
  price: string | null; // localized, e.g. "€3.99"; null until the store answers
  busy: boolean;
  error: string | null;
};

let state: RemoveAdsState = { owned: false, price: null, busy: false, error: null };
const listeners = new Set<(s: RemoveAdsState) => void>();
const setState = (patch: Partial<RemoveAdsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

const markOwned = () => {
  if (!state.owned) setState({ owned: true });
  AsyncStorage.setItem(OWNED_KEY, '1').catch(() => {});
};

// Google refunds purchases that aren't acknowledged within 3 days
const handlePurchase = async (purchase: Purchase) => {
  if (purchase.productId !== REMOVE_ADS_SKU) return;
  if (purchase.purchaseStateAndroid === PurchaseStateAndroid.PENDING) return; // e.g. cash payment not done yet
  markOwned();
  if (!purchase.isAcknowledgedAndroid) {
    await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
  }
};

let started = false;

// Call once at app start (Google Play on Android, the App Store on iOS: create
// `remove_ads` as a non-consumable in both stores).
export async function initRemoveAds() {
  if (started || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  started = true;

  if ((await AsyncStorage.getItem(OWNED_KEY).catch(() => null)) === '1') setState({ owned: true });

  purchaseUpdatedListener(async (purchase) => {
    await handlePurchase(purchase);
    if (purchase.productId === REMOVE_ADS_SKU) {
      track('remove_ads_purchased');
      setState({ busy: false, error: null });
    }
  });
  purchaseErrorListener((err) => {
    const cancelled = err.code === 'E_USER_CANCELLED';
    track(cancelled ? 'remove_ads_cancelled' : 'remove_ads_failed', { code: err.code });
    setState({ busy: false, error: cancelled ? null : 'Purchase failed. Please try again.' });
  });

  try {
    await initConnection();
    await restoreRemoveAds();
    const [product] = await getProducts({ skus: [REMOVE_ADS_SKU] });
    if (product) setState({ price: product.localizedPrice });
  } catch {
    // Offline or Play unavailable: keep the cached ownership
  }
}

// Also restores a purchase made on another device with the same Google account
export async function restoreRemoveAds() {
  const purchases = await getAvailablePurchases();
  await Promise.all(purchases.map(handlePurchase));
}

export async function buyRemoveAds() {
  if (state.owned || state.busy) return;
  track('remove_ads_start');
  setState({ busy: true, error: null });
  try {
    await requestPurchase(Platform.OS === 'ios' ? { sku: REMOVE_ADS_SKU } : { skus: [REMOVE_ADS_SKU] });
    // Result arrives in purchaseUpdatedListener / purchaseErrorListener
  } catch (err: any) {
    // Cancels and failures are also reported to purchaseErrorListener
    if (err?.code === 'E_USER_CANCELLED' || state.owned) setState({ busy: false });
    else setState({ busy: false, error: 'Purchase failed. Check your connection and try again.' });
  }
}

export function getRemoveAdsState() {
  return state;
}

export function subscribeRemoveAds(listener: (s: RemoveAdsState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRemoveAds() {
  const [current, setCurrent] = useState(state);
  useEffect(() => subscribeRemoveAds(setCurrent), []);
  return current;
}

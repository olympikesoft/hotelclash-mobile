// Coin packs sold with Google Play Billing (consumables). The API verifies each
// purchase token with Google and records it once; only then is the purchase
// consumed (so a failed verification can be retried on the next launch) and
// the coins collected into the game like any other grant.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { finishTransaction, getAvailablePurchases, getProducts, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase, type Purchase } from 'react-native-iap';
import { apiError, hasAccountToken, paymentAPI } from './api';
import { track } from '../../services/analytics';

// Same packs as the web shop (API credit.service PACKAGES / PLAY_PRODUCTS).
export const COIN_PACKS = [
  { sku: 'coins_100k', coins: 100000, label: '100K coins' },
  { sku: 'coins_500k', coins: 500000, label: '500K coins', popular: true },
  { sku: 'coins_1m', coins: 1000000, label: '1M coins' },
];
const SKUS = COIN_PACKS.map((p) => p.sku);

type ShopState = { prices: Record<string, string>; busy: string | null; error: string | null };
let state: ShopState = { prices: {}, busy: null, error: null };
const listeners = new Set<(s: ShopState) => void>();
const set = (patch: Partial<ShopState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

const grantedListeners = new Set<() => void>();
/** Fires when coins are waiting on the server (collect them with checkPayments). */
export function onCoinsGranted(fn: () => void) {
  grantedListeners.add(fn);
  return () => {
    grantedListeners.delete(fn);
  };
}

async function settle(purchase: Purchase) {
  if (!SKUS.includes(purchase.productId) || !purchase.purchaseToken) return;
  if (!hasAccountToken()) return; // kept by Google until the player signs in again
  try {
    await paymentAPI.verifyGooglePlay(purchase.productId, purchase.purchaseToken);
    await finishTransaction({ purchase, isConsumable: true }).catch(() => {});
    track('purchase', { item_id: purchase.productId, currency: 'coins', value: COIN_PACKS.find((p) => p.sku === purchase.productId)?.coins });
    grantedListeners.forEach((fn) => fn());
    set({ busy: null, error: null });
  } catch (err: any) {
    // 402 = still pending (e.g. cash payment): left unconsumed, retried on next launch.
    set({ busy: null, error: err?.response?.status === 402 ? 'Payment is still pending — your coins arrive once it completes.' : apiError(err, 'Could not confirm the purchase.') });
  }
}

let started = false;
export async function initCoinShop() {
  if (started || Platform.OS !== 'android') return;
  started = true;
  purchaseUpdatedListener((p) => {
    settle(p);
  });
  purchaseErrorListener((err) => {
    if (state.busy) set({ busy: null, error: err.code === 'E_USER_CANCELLED' ? null : 'Purchase failed. Please try again.' });
  });
  try {
    await initConnection();
    const products = await getProducts({ skus: SKUS });
    set({ prices: Object.fromEntries(products.map((p) => [p.productId, p.localizedPrice])) });
    await retryUnfinished();
  } catch {
    // offline / no Play Store: the shop shows "unavailable"
  }
}

/** Purchases paid but not yet verified + consumed (app closed mid-way, offline, signed out). */
export async function retryUnfinished() {
  if (Platform.OS !== 'android' || !hasAccountToken()) return;
  const purchases = await getAvailablePurchases().catch(() => [] as Purchase[]);
  for (const p of purchases) await settle(p);
}

export async function buyCoins(sku: string) {
  if (state.busy) return;
  set({ busy: sku, error: null });
  track('begin_checkout', { item_id: sku });
  try {
    await requestPurchase({ skus: [sku] });
  } catch (err: any) {
    set({ busy: null, error: err?.code === 'E_USER_CANCELLED' ? null : 'Could not start the purchase.' });
  }
}

export function useCoinShop() {
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

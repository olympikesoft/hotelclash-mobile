// Updated MainScreen component with fixes and Interstitial Ad integration
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
  Platform,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  AppState,
} from "react-native";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { track, setAppProperties } from "../services/analytics";
import { buyRemoveAds, useRemoveAds } from "../services/removeAds";
import { useAdsConsent } from "../services/adsConsent";

// --- Constants & Helpers ---
const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : "ca-app-pub-7819420241195884/9518012960";

// --- Interstitial Ad Unit ID ---
const INTERSTITIAL_AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-7819420241195884/9609170748";

// --- Reward Ad Unit ID ---
const REWARD_AD_UNIT_ID = __DEV__ ? TestIds.REWARDED : "ca-app-pub-7819420241195884/5484175866";

// The game runs at playlobbyboss.com (the old hotelhero.fun domain expired).
// Players start straight in the game; accounts are optional and handled there.
const APP_VERSION = "1.4.0";
const WEBVIEW_URL = `https://www.playlobbyboss.com/game?utm_source=app&utm_medium=${Platform.OS}`;
// Hosts the app keeps inside the WebView; any other link opens in the browser.
const IN_APP_HOSTS = ["playlobbyboss.com", "www.playlobbyboss.com", "api.playlobbyboss.com"];
const APP_LOGO = require("../assets/images/logo.png");
const COLORS = {
  primary: "#007AFF",
  background: "#FFFFFF",
  grey: "#f0f0f0",
  error: "#FF3B30",
  textLight: "#8e8e93",
  adPlaceholder: "#f5f5f5",
};
const MODAL_SELECTOR_IN_WEBVIEW = "#ad-container";

// --- Component definitions ---
interface OfflineMessageProps {
  onRetry: () => void;
  isRetrying: boolean;
}

const OfflineMessage: React.FC<OfflineMessageProps> = ({
  onRetry,
  isRetrying,
}) => (
  <View style={styles.placeholderContainer}>
    <Image
      source={APP_LOGO}
      style={styles.placeholderLogo}
      resizeMode="contain"
    />
    <Text style={styles.errorTitle}>No Internet Connection</Text>
    <Text style={styles.errorText}>Please check internet.</Text>
    <TouchableOpacity
      style={styles.retryButton}
      onPress={onRetry}
      disabled={isRetrying}
    >
      {isRetrying ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.retryButtonText}>Try Again</Text>
      )}
    </TouchableOpacity>
  </View>
);

const PlaceholderLoadingComponent: React.FC = () => (
  <View style={styles.placeholderContainer}>
    <Image
      source={APP_LOGO}
      style={styles.placeholderLogo}
      resizeMode="contain"
    />
    <ActivityIndicator
      size="large"
      color={COLORS.primary}
      style={{ marginTop: 20 }}
    />
    <Text style={styles.placeholderText}>Loading Game...</Text>
  </View>
);

interface WebViewErrorComponentProps {
  onRetry: () => void;
}

const WebViewErrorComponent: React.FC<WebViewErrorComponentProps> = ({
  onRetry,
}) => (
  <View style={styles.placeholderContainer}>
    <Image
      source={APP_LOGO}
      style={styles.placeholderLogo}
      resizeMode="contain"
    />
    <Text style={styles.errorTitle}>Oops!</Text>
    <Text style={styles.errorText}>Could not load game.</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Text style={styles.retryButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
);

// NetInfo reports isInternetReachable as null until it has checked; only an
// explicit false means offline. (Treating null as offline showed the "no
// internet" screen on launch for many players.)
const isOnline = (state: NetInfoState) => state.isConnected !== false && state.isInternetReachable !== false;

// Navigation cancelled on purpose (e.g. a link handed to the browser) also
// fires onError: iOS NSURLErrorCancelled (-999), Android ERR_ABORTED (-3).
const isCancelledLoad = (nativeEvent: any) =>
  nativeEvent?.code === -999 || nativeEvent?.code === -3 || /cancel|aborted/i.test(String(nativeEvent?.description || ''));

// --- Main Screen Component ---
type ViewState = "loading" | "webview" | "offline" | "error";
interface WebViewAdMessage {
  type: "adModalVisibility" | "showRewardedAd";
  visible?: boolean;
}

const MainScreen: React.FC = () => {
  const webViewRef = useRef<WebView>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [isWebViewLoading, setIsWebViewLoading] = useState<boolean>(true);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [webViewKey, setWebViewKey] = useState<number>(0);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [adLoaded, setAdLoaded] = useState<boolean>(false);
  const [adError, setAdError] = useState<boolean>(false);
  const [isNativeAdBannerVisible, setIsNativeAdBannerVisible] =
    useState<boolean>(true);

  // Track if we need to force a WebView reload
  const needsReload = useRef<boolean>(false);

  // Add a flag to prevent multiple consecutive loads
  const webViewMounted = useRef<boolean>(false);
  const initialLoadComplete = useRef<boolean>(false);
  
  // Interstitial Ad State and Refs
  const interstitialAd = useRef<InterstitialAd | null>(null);
  const isInterstitialLoaded = useRef<boolean>(false);

  // Rewarded Video Ad State and Refs
  const rewardedAd = useRef<RewardedAd | null>(null);
  const isRewardedAdLoaded = useRef<boolean>(false);

  // "Remove ads" purchase: no banner or interstitials (rewarded ads stay, they're opt-in)
  const removeAds = useRemoveAds();
  const adsConsent = useAdsConsent(); // no ad requests before the consent check
  const adsRemovedRef = useRef<boolean>(removeAds.owned);
  adsRemovedRef.current = removeAds.owned;

  // Load timing for analytics: reset on every (re)load, reported once per load
  const loadStartedAt = useRef<number>(Date.now());
  const loadTracked = useRef<boolean>(false);

  const trackGameLoaded = (source: string) => {
    if (loadTracked.current) return;
    loadTracked.current = true;
    track("game_loaded", { ms: Date.now() - loadStartedAt.current, source });
  };

  // Remount the WebView from scratch (retry, or the web process was killed)
  const remountWebView = () => {
    loadStartedAt.current = Date.now();
    loadTracked.current = false;
    setWebViewKey((prevKey) => prevKey + 1);
    webViewMounted.current = false;
    initialLoadComplete.current = false;
  };

  // --- Injected JavaScript ---
  const injectedJsCode = `
    (function() {
      if (window.location.pathname === '/game') {
          if (window.adModalObserverInitialized) { console.log('[Injected JS /game] Already initialized.'); return true; }
          window.adModalObserverInitialized = true; console.log('[Injected JS /game] Initializing Observer...');
          const targetSelector = "${MODAL_SELECTOR_IN_WEBVIEW}";
          let lastVisibilityState = null; let checkTimeout = null; let observer = null;
          const postMessageSafely = (message) => { if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } else { console.warn('[Injected JS /game] postMessage unavailable.'); if (observer) { try { observer.disconnect(); } catch(e) {} observer = null; } window.adModalObserverInitialized = false; }};
          const _postMessageToReactNative = (isVisible) => { if (isVisible !== lastVisibilityState) { console.log('[Injected JS /game] Ad container presence:', isVisible); const message = { type: 'adModalVisibility', visible: isVisible }; postMessageSafely(message); lastVisibilityState = isVisible; }};
          const postMessageToReactNative = _postMessageToReactNative;
          // The game mutates the DOM constantly: batch mutations into one check every 250ms
          // instead of a querySelector per mutation. The check runs after the batch, so the
          // final visibility state is never dropped (the old throttle could miss it).
          const scheduleCheck = () => { if (!checkTimeout) { checkTimeout = setTimeout(() => { checkTimeout = null; checkModalVisibility(); }, 250); }};
          const checkModalVisibility = () => { try { const modalAdElement = document.querySelector(targetSelector); const isVisible = modalAdElement !== null; postMessageToReactNative(isVisible); } catch (e) { console.error('[Injected JS /game] Error checking visibility:', e); postMessageToReactNative(false); if (observer) { try { observer.disconnect(); } catch(err) {} } window.adModalObserverInitialized = false; }};
          try { if (window.myAdModalObserverInstance) { try { window.myAdModalObserverInstance.disconnect(); } catch(e) {} } observer = new MutationObserver(scheduleCheck); const observerTargetNode = document.body; if (observerTargetNode) { observer.observe(observerTargetNode, { childList: true, subtree: true }); window.myAdModalObserverInstance = observer; console.log('[Injected JS /game] Observer attached.'); setTimeout(checkModalVisibility, 1500); } else { console.error('[Injected JS /game] Observer target not found!'); window.adModalObserverInitialized = false; }} catch (e) { console.error('[Injected JS /game] Failed to create observer:', e); window.adModalObserverInitialized = false; }
          window.addEventListener('unload', () => { console.log('[Injected JS /game] Unloading.'); if (observer) { try { observer.disconnect(); } catch(e) {} observer = null; } window.adModalObserverInitialized = false; window.myAdModalObserverInstance = null; });
      } else { console.log('[Injected JS] Not /game path.'); if (window.myAdModalObserverInstance) { try { window.myAdModalObserverInstance.disconnect(); } catch(e) {} window.myAdModalObserverInstance = null; } window.adModalObserverInitialized = false; }
    })();
    true;
  `;

  // --- Memoized handleRetry - optimized to prevent loops ---
  const handleRetry = useCallback(() => {
    console.log("[RN] Retry attempt initiated...");

    if (isRetrying) {
      console.log("[RN] Retry already in progress, skipping.");
      return;
    }

    setIsRetrying(true);
    setIsNativeAdBannerVisible(true);
    track("game_retry");

    NetInfo.fetch()
      .then((state) => {
        if (isOnline(state)) {
          console.log("[RN] Network OK. Reloading.");
          needsReload.current = true;
          setViewState("loading");
          setTimeout(() => {
            if (needsReload.current) {
              needsReload.current = false;
              remountWebView();
            }
          }, 50);
        } else {
          console.log("[RN] Still offline.");
          setIsRetrying(false);
          setViewState("offline");
        }
      })
      .catch((error) => {
        console.error("[RN] Retry network check error:", error);
        setIsRetrying(false);
        setViewState("offline");
      });
  }, [isRetrying]);
  
  // --- Function to load the interstitial ad ---
 const loadInterstitialAd = useCallback(() => {
  console.log("[RN Ad] Attempting to load Interstitial Ad...");
  isInterstitialLoaded.current = false;

  const newAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  const removeLoadListener = newAd.addAdEventListener(AdEventType.LOADED, () => {
    console.log("[RN Ad] Interstitial ad loaded successfully!");
    interstitialAd.current = newAd;
    isInterstitialLoaded.current = true;
  });

  const removeErrorListener = newAd.addAdEventListener(AdEventType.ERROR, (error) => {
    console.error("[RN Ad] Interstitial ad failed to load:", error);
    isInterstitialLoaded.current = false;
    track("ad_load_failed", { format: "interstitial", code: (error as any)?.code });
  });

  const removeCloseListener = newAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log("[RN Ad] Interstitial ad closed by user.");
    loadInterstitialAd(); // Pre-load the next ad
  });

  newAd.load();

  return () => {
    removeLoadListener();
    removeErrorListener();
    removeCloseListener();
  };
}, []);

  // --- Function to load the rewarded video ad ---
  const loadRewardedAd = useCallback(() => {
    console.log("[RN Ad] Attempting to load Rewarded Ad...");
    isRewardedAdLoaded.current = false;

    const newAd = RewardedAd.createForAdRequest(REWARD_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const removeLoadListener = newAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log("[RN Ad] Rewarded ad loaded successfully!");
      rewardedAd.current = newAd;
      isRewardedAdLoaded.current = true;
    });

    // ERROR lives on AdEventType; RewardedAdEventType.ERROR is undefined, so failures were never caught
    const removeErrorListener = newAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error("[RN Ad] Rewarded ad failed to load:", error);
      isRewardedAdLoaded.current = false;
      track("ad_load_failed", { format: "rewarded", code: (error as any)?.code });
    });

    const removeEarnedRewardListener = newAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        console.log("[RN Ad] User earned reward:", reward);
        track("ad_reward_earned", { amount: reward.amount, reward_type: reward.type });
        // Send reward info to WebView
        if (webViewRef.current) {
          // FIX: "type" was set twice, so the reward type overwrote 'rewardEarned'
          // and the game never heard about the reward.
          webViewRef.current.postMessage(
            JSON.stringify({ type: 'rewardEarned', amount: reward.amount, rewardType: reward.type })
          );
        }
      }
    );

    const removeCloseListener = newAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log("[RN Ad] Rewarded ad closed by user.");
      track("ad_closed", { format: "rewarded" });
      // Lets the game stop waiting if the player closed the ad before the reward.
      webViewRef.current?.postMessage(JSON.stringify({ type: 'rewardedAdClosed' }));
      loadRewardedAd(); // Pre-load the next ad
    });

    newAd.load();

    return () => {
      removeLoadListener();
      removeErrorListener();
      removeEarnedRewardListener();
      removeCloseListener();
    };
  }, []);


  // --- Analytics: app properties + foreground/background ---
  useEffect(() => {
    setAppProperties(APP_VERSION);
    track("game_screen_open");

    let backgroundedAt = 0;
    const subscription = AppState.addEventListener("change", (state) => {
      // Let the game pause its loops/sounds while hidden (saves battery and CPU)
      webViewRef.current?.postMessage(JSON.stringify({ type: "appState", state }));
      if (state === "background") {
        backgroundedAt = Date.now();
      } else if (state === "active" && backgroundedAt) {
        track("app_resume", { away_s: Math.round((Date.now() - backgroundedAt) / 1000) });
        backgroundedAt = 0;
      }
    });
    return () => subscription.remove();
  }, []);

  // --- Effect to load the first interstitial ad on mount ---
  useEffect(() => {
    if (removeAds.owned || !adsConsent.canRequestAds) return;
    const unsubscribe = loadInterstitialAd();
    return unsubscribe;
  }, [loadInterstitialAd, removeAds.owned, adsConsent.canRequestAds]);

  // Tell the game what the player owns, so it can hide its own ad prompts or
  // offer the purchase in its menu (send { type: 'buyRemoveAds' } to buy)
  const postPurchases = useCallback(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({ type: "purchases", removeAds: removeAds.owned, removeAdsPrice: removeAds.price })
    );
  }, [removeAds.owned, removeAds.price]);
  useEffect(postPurchases, [postPurchases]);

  // --- Effect to load the first rewarded ad on mount ---
  useEffect(() => {
    if (!adsConsent.canRequestAds) return;
    const unsubscribe = loadRewardedAd();
    return unsubscribe;
  }, [loadRewardedAd, adsConsent.canRequestAds]);


  // --- Effects - Loading Timeout (Modified) ---
  useEffect(() => {
    console.log("[RN] Setting up loading timeout safeguard");

    let loadingTimeout: NodeJS.Timeout | null = null;

    if (viewState === "loading") {
      loadingTimeout = setTimeout(() => {
        console.log("⚠️ Loading timeout triggered.");
        if (viewState === "loading") {
          if (isWebViewLoading) {
            console.log("Forcing webview state from timeout.");
            track("game_load_timeout");
            setIsWebViewLoading(false);
            setViewState("webview");
          } else {
            console.log("Loading timeout hit, but WebView finished loading. Setting webview state.");
            setViewState("webview");
          }
        } else {
          console.log("Loading timeout hit, but state is no longer loading.");
        }
      }, 12000);
    }

    return () => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [viewState, isWebViewLoading]);

  // --- Network Listener Effect ---
  useEffect(() => {
    console.log("[RN] Setting up NetInfo listener.");

    const handleNetworkChange = (state: NetInfoState) => {
      console.log("[RN] Network state changed:", state.isConnected);
      const isOfflineNow = !isOnline(state);

      setViewState((currentState) => {
        if (isOfflineNow) {
          if (currentState !== "error") {
            setIsRetrying(false);
            if (currentState !== "offline") track("offline_shown");
            return "offline";
          }
          return currentState;
        } else {
          if (currentState === "offline") {
            setTimeout(() => handleRetry(), 50);
            return "loading";
          }
          return currentState;
        }
      });
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    NetInfo.fetch().then((state) => {
      console.log("[RN] Initial Network state:", state.isConnected);
      setViewState((initialState) => {
        if (initialState !== "loading") return initialState;
        if (!isOnline(state)) return "offline";
        return "loading";
      });
    });

    return () => {
      console.log("[RN] Removing NetInfo listener.");
      unsubscribe();
    };
  }, [handleRetry]);

  // --- Back Button Effect ---
  useEffect(() => {
    const backAction = () => {
      if (canGoBack && webViewRef.current && viewState === "webview") {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [canGoBack, viewState]);

  // --- Debug Logging Effect ---
  useEffect(() => {
    console.log(
      `[RN] State Update | View: ${viewState} | WebViewLoading: ${isWebViewLoading} | BannerVisible: ${isNativeAdBannerVisible}`
    );
  }, [viewState, isWebViewLoading, isNativeAdBannerVisible]);

  // --- WebView Event Handlers ---
  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleLoadStart = () => {
    console.log("[RN] WebView load started");
    if (!initialLoadComplete.current || needsReload.current) {
      setIsWebViewLoading(true);
    } else {
      console.log("[RN] Navigation within WebView, not setting loading state");
    }
  };

  const handleLoadEnd = (event: WebViewMessageEvent | any) => {
    const nativeEvent = event.nativeEvent;
    const isLoadError = (nativeEvent.code || nativeEvent.description) && !isCancelledLoad(nativeEvent);
    console.log(`[RN] WebView load ended. Error reported in event: ${isLoadError ? "Yes" : "No"}`);

    if (!webViewMounted.current) {
      webViewMounted.current = true;
      console.log("[RN] WebView initial mount complete");
    }

    if (!initialLoadComplete.current && !isLoadError) {
      initialLoadComplete.current = true;
      console.log("[RN] Initial WebView load complete");
      trackGameLoaded("load_end");
      setIsWebViewLoading(false);
      setViewState((currentState) => (currentState === "loading" ? "webview" : currentState));
      if (isRetrying) setIsRetrying(false);
    } else if (needsReload.current) {
      needsReload.current = false;
      setIsWebViewLoading(false);
      setViewState((currentState) => (currentState === "loading" ? "webview" : currentState));
      if (isRetrying) setIsRetrying(false);
    } else {
      setIsWebViewLoading(false);
    }
  };

  const handleError = (event: any) => {
    console.warn("[RN] WebView loading error:", event.nativeEvent?.description);
    if (isCancelledLoad(event.nativeEvent)) return; // not a real failure
    track("webview_error", { code: event.nativeEvent?.code, description: event.nativeEvent?.description });
    setIsWebViewLoading(false);
    setIsRetrying(false);
    if (viewState !== "offline") setViewState("error");
    initialLoadComplete.current = false;
  };

  const handleHttpError = (event: any) => {
    const { nativeEvent } = event;
    console.warn(`[RN] WebView HTTP error: ${nativeEvent?.statusCode}`);

    if (nativeEvent?.statusCode >= 400) {
      track("webview_http_error", { status: nativeEvent.statusCode });
      setIsWebViewLoading(false);
      setIsRetrying(false);
      if (viewState !== "offline") setViewState("error");
      initialLoadComplete.current = false;
    }
  };

  // --- Native AdMob Banner Handlers ---
  const handleAdLoaded = () => {
    console.log("[RN] Native AdMob banner loaded.");
    setAdLoaded(true);
    setAdError(false);
  };

  const handleAdFailedToLoad = (error: Error) => {
    console.error("[RN] Native AdMob banner failed:", error.message);
    track("ad_load_failed", { format: "banner", code: (error as any)?.code });
    setAdError(true);
    setAdLoaded(false);
  };

  // --- WebView Message Handler ---
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    const messageData = event.nativeEvent.data;

    try {
      const message: WebViewAdMessage = JSON.parse(messageData);

      if (message && (message as any).type === "gameReady") {
        // The game is on screen: show it now instead of waiting for the whole
        // page (ads, analytics, images) to finish loading.
        initialLoadComplete.current = true;
        trackGameLoaded("game_ready");
        postPurchases();
        setIsWebViewLoading(false);
        setViewState((current) => (current === "loading" ? "webview" : current));
        if (isRetrying) setIsRetrying(false);
        return;
      }
      if (message && (message as any).type === "buyRemoveAds") {
        buyRemoveAds();
        return;
      }
      if (message && (message as any).type === "analytics") {
        // The web game reports its own events:
        // postMessage(JSON.stringify({ type: 'analytics', name: 'level_up', params: { level: 5 } }))
        const { name, params } = message as any;
        if (typeof name === "string") track(name, params && typeof params === "object" ? params : {});
        return;
      }
      if (message && message.type === "adModalVisibility") {
        const nextBannerVisibility = !message.visible;
        if (nextBannerVisibility !== isNativeAdBannerVisible) {
          console.log(`[RN] Setting native banner visibility: ${nextBannerVisibility}`);
          setIsNativeAdBannerVisible(nextBannerVisibility);
        }

        if (message.visible && !adsRemovedRef.current && isInterstitialLoaded.current && interstitialAd.current) {
          console.log('[RN Ad] WebView modal is visible, showing Interstitial Ad.');
          interstitialAd.current.show();
          isInterstitialLoaded.current = false;
          track("ad_shown", { format: "interstitial" });
        }

      } else if (message && message.type === "showRewardedAd") {
        // Handle request to show rewarded video
        console.log('[RN Ad] WebView requested Rewarded Ad.');
        if (isRewardedAdLoaded.current && rewardedAd.current) {
          console.log('[RN Ad] Showing Rewarded Ad.');
          rewardedAd.current.show();
          isRewardedAdLoaded.current = false;
          track("ad_shown", { format: "rewarded" });
        } else {
          console.log('[RN Ad] Rewarded ad not loaded yet.');
          track("ad_not_ready", { format: "rewarded" });
          // Notify WebView that ad is not ready
          if (webViewRef.current) {
            webViewRef.current.postMessage(
              JSON.stringify({
                type: 'rewardedAdNotReady',
              })
            );
          }
        }
      } else {
        console.log("[RN] Unknown message type:", message?.type);
      }
    } catch (error) {
      console.error("[RN] Failed to parse message:", error, messageData);
    }
  };

  // --- Render (Optimized) ---
  const renderWebView = () => {
    if (viewState === "offline") {
      return null;
    }

    return (
      <WebView
        key={webViewKey}
        ref={webViewRef}
        style={[
          styles.webView,
          (viewState !== "webview" || isWebViewLoading) && styles.hiddenWebView,
        ]}
        source={{ uri: WEBVIEW_URL }}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        onMessage={handleWebViewMessage}
        // The OS can kill the web process (low memory). Without this the screen stays blank.
        onRenderProcessGone={(e) => {
          track("webview_crash", { did_crash: e.nativeEvent.didCrash });
          setViewState("loading");
          remountWebView();
        }}
        onContentProcessDidTerminate={() => {
          track("webview_crash", { platform: "ios" });
          setViewState("loading");
          remountWebView();
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        onNavigationStateChange={handleNavigationStateChange}
        injectedJavaScript={injectedJsCode}
        originWhitelist={["*"]}
        mixedContentMode="compatibility"
        setSupportMultipleWindows={false}
        cacheEnabled={true} // was off: the whole site downloaded again on every launch
        // Feel like an app, not a web page: GPU-composited animations, no
        // rubber-band bounce or edge glow, text not resized by the font setting.
        androidLayerType="hardware"
        overScrollMode="never"
        bounces={false}
        textZoom={100}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={false}
        decelerationRate="normal"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true} // iOS only
        // Real device user agent + an app marker, so the site knows it runs in the app
        // (native ads, no web coin shop). It used to pretend to be an old Pixel 4.
        applicationNameForUserAgent={`PlayLobbybossApp/${APP_VERSION}`}
        onShouldStartLoadWithRequest={(request) => {
          if (request.isTopFrame === false) return true; // embeds (e.g. video) load in place
          try {
            const host = new URL(request.url).hostname;
            if (request.url.startsWith("about:") || IN_APP_HOSTS.includes(host)) return true;
          } catch {
            return true;
          }
          Linking.openURL(request.url).catch(() => {});
          return false;
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.contentContainer}>
        {renderWebView()}

        {/* Overlays */}
        {viewState === "loading" && (
          <View style={styles.overlayContainer}>
            <PlaceholderLoadingComponent />
          </View>
        )}

        {viewState === "offline" && (
          <View style={styles.overlayContainer}>
            <OfflineMessage onRetry={handleRetry} isRetrying={isRetrying} />
          </View>
        )}

        {viewState === "error" && !isRetrying && (
          <View style={styles.overlayContainer}>
            <WebViewErrorComponent onRetry={handleRetry} />
          </View>
        )}

        {isWebViewLoading && viewState === "webview" && (
          <View style={styles.webViewLoadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </View>

      {/* Ad Banner */}
      {isNativeAdBannerVisible && !removeAds.owned && adsConsent.canRequestAds && (
        <View style={styles.adContainer}>
          {adError && !adLoaded && (
            <View style={styles.adErrorPlaceholder}>
              <Text style={styles.adErrorText}>Advertisement</Text>
            </View>
          )}
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdLoaded={handleAdLoaded}
            onAdFailedToLoad={handleAdFailedToLoad}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.adPlaceholder },
  contentContainer: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: COLORS.background,
  },
  webView: { flex: 1, backgroundColor: COLORS.background },
  hiddenWebView: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: -1,
    opacity: 0,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  placeholderLogo: { width: 100, height: 100, marginBottom: 20 },
  placeholderText: { fontSize: 16, color: COLORS.textLight, marginTop: 10 },
  errorTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.error,
    marginBottom: 10,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  retryButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  webViewLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    zIndex: 5,
  },
  adContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.adPlaceholder,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cccccc",
  },
  adErrorPlaceholder: {
    height: 50,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  adErrorText: { fontSize: 12, color: COLORS.textLight },
});

export default MainScreen;
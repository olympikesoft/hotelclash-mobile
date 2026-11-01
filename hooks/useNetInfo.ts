// hooks/useNetInfo.ts
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export function useNetInfo() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [details, setDetails] = useState<NetInfoState | null>(null);

  useEffect(() => {
    console.log('useNetInfo hook initialized');
    
    // Initial check
    NetInfo.fetch().then(state => {
      console.log('Initial network state:', state);
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setDetails(state);
    });

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('Network state changed:', state);
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setDetails(state);
    });

    // Cleanup subscription
    return () => {
      console.log('useNetInfo hook cleanup');
      unsubscribe();
    };
  }, []);

  const checkConnection = async () => {
    try {
      const state = await NetInfo.fetch();
      console.log('Manual network check:', state);
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setDetails(state);
      return state;
    } catch (error) {
      console.error('Error checking network:', error);
      return null;
    }
  };

  return {
    isConnected,
    isInternetReachable,
    details,
    checkConnection
  };
}
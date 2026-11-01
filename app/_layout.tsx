// app/_layout.tsx with professional header
import React, { useEffect } from 'react';
import { StyleSheet, View, Image, Text, Platform, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initializeFirebaseMessaging } from '../services/firebaseNotifications';
import { initRemoveAds, buyRemoveAds, useRemoveAds } from '../services/removeAds';
import { startAds } from '../services/adsConsent';
import { initCoinShop } from '../game/platform/coinShop';

// Release builds: drop the (very chatty) debug logs, they cost CPU on every state change.
// Warnings and errors stay.
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

// Custom header component
function CustomHeader() {
  const insets = useSafeAreaInsets();
  const removeAds = useRemoveAds();

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1a5ee8', '#0e47c1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>HotelHero</Text>
          {/* Shown only once the store returned a price, i.e. billing works */}
          {!removeAds.owned && removeAds.price && (
            <TouchableOpacity
              style={styles.removeAdsButton}
              onPress={buyRemoveAds}
              disabled={removeAds.busy}
            >
              <Text style={styles.removeAdsButtonText}>🚫 Remove ads · {removeAds.price}</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    console.log('Root layout mounted');
    
    // Ad consent first (Google UMP form where required), then the AdMob SDK.
    startAds();
    initRemoveAds();
    initCoinShop();

    // Initialize Firebase Cloud Messaging

    initializeFirebaseMessaging()
      .then(async () => {
        console.log('✅ Firebase Messaging initialized');
        
        // Subscribe all users to "all_users" topic
        const { subscribeToTopic } = require('../services/firebaseNotifications');
        await subscribeToTopic('all_users');
        console.log('✅ Subscribed to all_users topic');
      })
      .catch((err) => {
        console.error('❌ Firebase Messaging init failed:', err);
      });
    
    return () => {
      console.log('Root layout unmounted');
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack 
        screenOptions={{
          // Use custom header instead of default one
          header: () => <CustomHeader />,
          // This makes the header background transparent and removes default styling
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerShadowVisible: false,
          // Ensure content is properly positioned under the custom header
          contentStyle: {
            backgroundColor: '#FFFFFF'
          }
        }}
      />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    zIndex: 100,
  },
  headerGradient: {
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  removeAdsButton: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  removeAdsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  }
});
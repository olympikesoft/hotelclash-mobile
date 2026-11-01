import React from 'react';
import { Stack } from 'expo-router';
import MainScreen from '../screens/WebViewGame';
import GameScreen from '../game/GameScreen';

// Native game (shared engine, no WebView). The WebView version stays as a
// fallback: set this to false to ship it instead.
const USE_NATIVE_GAME = true;

export default function Home() {
  if (USE_NATIVE_GAME) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <GameScreen />
      </>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          title: 'HotelHero',
          // Set this to false if you want to hide the header completely
          headerShown: true,
        }}
      />
      <MainScreen />
    </>
  );
}

import React from 'react';
import { Stack } from 'expo-router';
import MainScreen from './screen/main/index';
import GameScreen from '../game/GameScreen';

// Native game (shared engine, no WebView). Dev builds only until it covers
// sign-in: players with an account on the website play through the WebView,
// which keeps their cloud progress. Flip to `true` for release once accounts land.
const USE_NATIVE_GAME = __DEV__;

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

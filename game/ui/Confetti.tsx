// A short emoji burst for level-ups and achievements (the web uses canvas
// confetti). Bump `trigger` to fire; it ignores touches and cleans itself up.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const PIECES = ['🎉', '✨', '⭐', '💰', '🎊', '🏆'];
const COUNT = 24;

export default function Confetti({ trigger }: { trigger: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        emoji: PIECES[i % PIECES.length],
        x: (Math.random() - 0.5) * width * 0.9,
        y: -(height * (0.35 + Math.random() * 0.35)),
        spin: `${(Math.random() - 0.5) * 720}deg`,
        size: 18 + Math.random() * 14,
      })),
    [trigger, width, height] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!trigger) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [trigger, progress]);

  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.Text
          key={`${trigger}-${i}`}
          style={{
            position: 'absolute',
            left: width / 2,
            bottom: 80,
            fontSize: p.size,
            opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.y, p.y * 0.7] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

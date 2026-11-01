// "Your hotel earned $X while you were away" — a local notification scheduled
// when the app goes to the background, using the same formula the engine pays
// on return (AWAY_EARNINGS), and cancelled as soon as the player is back.
// Only scheduled if notifications are already allowed; never asks by itself.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { engineData } from '../catalog';
import type { GameState } from '../types';

const REMIND_AFTER_HOURS = 3;
const ID = 'away-earnings';

export async function scheduleAwayReminder(game: GameState | null) {
  try {
    if (!game || game.gameOver) return;
    const perDay = Math.max(0, game.stats?.avgDayProfit || 0);
    const { profitDaysPerHour, maxAwayMs } = engineData.AWAY_EARNINGS as { profitDaysPerHour: number; maxAwayMs: number };
    const hours = Math.min(REMIND_AFTER_HOURS, maxAwayMs / 3_600_000);
    const amount = Math.floor(perDay * profitDaysPerHour * hours);
    if (amount <= 0) return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: `🏨 ${game.hotelName || 'Your hotel'} earned $${amount.toLocaleString('en-US')}`,
        body: 'Guests kept checking in while you were away. Collect it — or watch an ad for 2×!',
        data: { kind: 'away_earnings' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: hours * 3600 },
    });
  } catch {
    // reminders are best-effort
  }
}

export function cancelAwayReminder() {
  Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
}

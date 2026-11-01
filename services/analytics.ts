// Firebase Analytics wrapper: never throws, so tracking can't break the game.
import { getAnalytics, logEvent, setUserProperty } from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

type Params = Record<string, string | number | boolean | undefined>;

// Firebase rules: event names are letters/digits/underscores, start with a letter, max 40 chars.
const cleanName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]+/, '').slice(0, 40);

export function track(name: string, params: Params = {}) {
  const eventName = cleanName(name);
  if (!eventName) return;
  const clean: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    clean[cleanName(key)] = typeof value === 'boolean' ? Number(value) : typeof value === 'string' ? value.slice(0, 100) : value;
  }
  logEvent(getAnalytics(), eventName, clean).catch(() => {});
}

export function setAppProperties(appVersion: string) {
  const analytics = getAnalytics();
  setUserProperty(analytics, 'app_version', appVersion).catch(() => {});
  setUserProperty(analytics, 'platform', Platform.OS).catch(() => {});
}

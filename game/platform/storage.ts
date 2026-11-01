// localStorage-like, synchronous storage for GameStore and the UI.
// MMKV instead of AsyncStorage: GameStore reads/writes synchronously, and a
// guest's action log can grow past AsyncStorage's ~2 MB per-entry limit on Android.
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'hotelclash' });

export const storage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // display-only data; ignore
  }
}

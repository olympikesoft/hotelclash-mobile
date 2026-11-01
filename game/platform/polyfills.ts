// Web APIs the shared engine/GameStore use that Hermes doesn't provide.
// Import this once, before anything from game/engine or game/core.
import 'react-native-get-random-values'; // crypto.getRandomValues (GameStore seeds)

// Engine states are plain JSON (no Dates/Maps), so a JSON copy is exact.
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

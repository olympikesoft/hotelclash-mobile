// Game API client: same endpoints and shapes as the web game's
// src/services/api.js (gameSessionAPI), which GameStore expects.
import axios from 'axios';
import { storage } from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.playlobbyboss.com';

const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

const getToken = () => storage.getItem('token');

/** Signed in with a real account (guests have no token or a fake `guest_` one). */
export const hasAccountToken = () => {
  const token = getToken();
  return Boolean(token) && !token!.startsWith('guest_');
};

export function readUser(): { id?: string; username?: string; hotel?: { name?: string; type?: string } | null } | null {
  try {
    return JSON.parse(storage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  if (hasAccountToken()) config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Expired session: drop it so the game falls back to local (guest) play.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) signOut();
    return Promise.reject(error);
  }
);

export const gameSessionAPI = {
  getSession: async () => {
    try {
      return (await api.get('/api/game/session')).data.session;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },
  createSession: async (body = {}) => (await api.post('/api/game/session', body)).data.session,
  sync: async (sessionId: string, body: object) =>
    (await api.post(`/api/game/session/${encodeURIComponent(sessionId)}/sync`, body, { timeout: 30000 })).data,
  getBatch: async (batchId: string) => (await api.get(`/api/game/sync/${encodeURIComponent(batchId)}`)).data,
  sessionFromSave: async (saveId: string) =>
    (await api.post(`/api/game/session/from-save/${encodeURIComponent(saveId)}`)).data.session,
  engineInfo: async () => (await api.get('/api/game/engine')).data as { engineVersion: number; engineHash: string },
};

export type RankedHotel = { id: string; rank: number; hotelName: string; name: string; level: number; rating: number; rooms: number; day: number; value: number };
export type Friend = { inviteId: string; name: string; level: number; value: number; day: number; claimed: boolean; canClaim: boolean };
export type MyRanking = { me: RankedHotel | null; neighbours: RankedHotel[]; inviteCode: string; shareUrl: string; inviteUrl: string; friends: Friend[] };

// Leaderboard by hotel value (API src/routes/social.js); the list is public, `me` needs an account.
export const socialAPI = {
  leaderboard: async (limit = 50) => (await api.get('/api/social/leaderboard', { params: { limit } })).data as { total: number; leaderboard: RankedHotel[] },
  me: async () => (await api.get('/api/social/me')).data as MyRanking,
  claimInvite: async (inviteId: string) => (await api.post('/api/invite/claim', { inviteId })).data,
};

// ------------------------------------------------------------------ accounts

export type User = { id: string; username: string; email: string; credits: number; hotel: { name: string; type: string } | null };

const sessionListeners = new Set<() => void>();
/** Fires after sign-in / sign-out (including an expired token being dropped). */
export function onSessionChange(fn: () => void) {
  sessionListeners.add(fn);
  return () => {
    sessionListeners.delete(fn);
  };
}
const sessionChanged = () => sessionListeners.forEach((fn) => fn());

function storeSession(data: { token?: string; user?: User }) {
  if (!data || !data.token) return;
  storage.setItem('token', data.token);
  if (data.user) storage.setItem('user', JSON.stringify(data.user));
  sessionChanged();
}

export function signOut() {
  storage.removeItem('token');
  storage.removeItem('user');
  sessionChanged();
}

/** The API's own message for a failed request (it sends `message` and `error`). */
export function apiError(err: any, fallback: string) {
  const data = err?.response?.data;
  if (!err?.response) return 'Can’t reach the server. Check your connection and try again.';
  return (data && (data.message || data.error || data.errors?.[0]?.msg)) || fallback;
}

export const authAPI = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email: email.trim(), password });
    storeSession(data);
    return data.user as User;
  },
  register: async (body: { email: string; password: string; username?: string; hotelName?: string; inviteCode?: string }) => {
    const { data } = await api.post('/api/auth/register', body);
    storeSession(data);
    return data.user as User;
  },
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email: email.trim() }),
};

export type SavedGame = { id: string; name: string; date: string; day: number; money: number; reputation: number; hotelName: string; verified: boolean };

// Cloud saves (API src/routes/games.js). With a server session the server saves
// its own verified state, so nothing is uploaded from the phone.
export const savesAPI = {
  list: async () => (await api.get('/api/games/saved-games')).data.savedGames as SavedGame[],
  save: async (saveName: string) => (await api.post('/api/games/save', { saveName })).data,
  remove: async (saveId: string) => (await api.delete(`/api/games/saved-games/${encodeURIComponent(saveId)}`)).data,
};

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

export function readUser(): { id?: string; hotel?: { name?: string; type?: string } } | null {
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
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      storage.removeItem('token');
      storage.removeItem('user');
    }
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

// Leaderboard by hotel value (API src/routes/social.js); public, no account needed.
export const socialAPI = {
  leaderboard: async (limit = 50) => (await api.get('/api/social/leaderboard', { params: { limit } })).data as { total: number; leaderboard: RankedHotel[] },
};

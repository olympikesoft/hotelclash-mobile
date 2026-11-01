// One row per game day for the Dashboard trend (port of the web's
// src/hooks/useDayHistory.js). Display-only and per device.
import { useEffect, useState } from 'react';
import { insights } from './catalog';
import { readJson, writeJson } from './platform/storage';
import type { GameState } from './types';

const KEY = 'hotelClash.dayHistory';
const MAX_DAYS = 400;

export type DayPoint = { day: number; money: number; revenue: number; profit: number; occupancy: number; rating: number };

export default function useDayHistory(state: GameState | null) {
  const [history, setHistory] = useState<DayPoint[]>([]);
  const day = state ? state.day : null;

  useEffect(() => {
    if (!state) return;
    const e = insights.economics(state);
    const point: DayPoint = {
      day: state.day,
      money: Math.round(state.money),
      revenue: e.lastRevenue,
      profit: e.lastProfit,
      occupancy: Math.round(e.occupancy * 100),
      rating: Math.round((state.reputation || 0) * 100) / 100,
    };
    setHistory((prev) => {
      // A new game goes back in time: drop the "future".
      const base = prev.length ? prev : readJson<DayPoint[]>(KEY, []);
      const next = [...base.filter((p) => p.day < point.day), point].slice(-MAX_DAYS);
      writeJson(KEY, next);
      return next;
    });
    // Record once per day, not on every action.
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  return history;
}

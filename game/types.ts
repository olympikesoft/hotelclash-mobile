// The parts of the engine state the native UI reads. The engine (game/engine)
// is plain JS and owns the full shape; extra fields pass through untouched.
export type Room = {
  id: number;
  type: string;
  price: number;
  quality: number;
  occupied: boolean;
  guest: number | string | null;
  underMaintenance?: boolean;
  repairLeft?: number;
};

export type Staff = { id: number; name: string; role: string; salary: number; skill: number; happiness: number };

export type Facility = { id: number; name: string; level: number; upkeep: number };

export type Campaign = {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  active: boolean;
  endDay?: number;
  extraGuests?: number;
  extraRevenue?: number;
  lastResult?: { guests: number; revenue: number; paid: number } | null;
};

export type GameState = {
  hotelName: string;
  hotelType: string;
  day: number;
  season: string;
  money: number;
  credits: number;
  reputation: number;
  marketShare: number;
  hotelLevel: number;
  rooms: Room[];
  staff: Staff[];
  facilities: Facility[];
  guests: { id: number | string; name: string; type: string; roomId: number }[];
  marketingCampaigns: Campaign[];
  policies: Record<string, boolean>;
  achievements: string[];
  stats: Record<string, any>;
  away?: { ms: number; amount: number } | null;
  gameOver?: { day: number; reason: string; debt: number; guestsServed: number; hotelLevel: number; achievements: number } | null;
  [key: string]: any;
};

export type Effect = { kind: string; [key: string]: any };

export type ActionResult = { ok: boolean; error?: string; effects: Effect[]; amount?: number; [key: string]: any };

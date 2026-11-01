// Engine game data plus the icon the app shows for each item (the web uses
// lucide icons; emoji need no icon font and read well at small sizes).
import { data, insights as engineInsights } from './engine/index.js';

const ROOM_ICONS: Record<string, string> = { Standard: '🛏️', Deluxe: '⭐', Suite: '🏠', Executive: '💼', Penthouse: '🌆' };

const FACILITY_ICONS: Record<string, string> = {
  Restaurant: '🍽️', Bar: '🍸', Spa: '💆', Gym: '🏋️', Pool: '🏊', 'Conference Room': '👥', 'Gift Shop': '🎁', Casino: '🎰',
  Nightclub: '🪩', 'Rooftop Garden': '🌷', 'Business Center': '🖨️', 'Kids Club': '🧸', 'Art Gallery': '🖼️', 'Pet Spa': '🐶',
  'Tennis Court': '🎾', 'Cigar Lounge': '🚬', 'Movie Theater': '🎬', Library: '📚', Gondola: '🚡',
  'Private Submarine Experience': '🐠', 'Rooftop Helipad & Skylounge': '🚁', 'Infinity Pool': '🌊', 'Premium Spa': '🧖',
  'Wine Cellar': '🍷', 'Casino Floor': '🃏', Theater: '🎭', 'Golf Course': '⛳', 'Private Island': '🏝️', 'Theme Park': '🎢',
  'Ski Resort': '⛷️', Lobby: '🛎️',
};

const STAFF_ICONS: Record<string, string> = {
  Receptionist: '🛎️', Housekeeper: '🧹', Chef: '👨‍🍳', Manager: '💼', Concierge: '👍', Maintenance: '🔧', Security: '🛡️',
  'Event Coordinator': '📅', Sommelier: '🍷', Valet: '🚗', 'IT Specialist': '🖥️', 'Marketing Director': '📈',
  'Fitness Instructor': '🏋️', Gardener: '🌷', 'Guest Relations Manager': '⭐', 'Spa Therapist': '💆', Bartender: '🍸',
  'Sustainability Officer': '🌿', Singer: '🎤', Lifeguard: '🛟', Dealer: '🃏', 'Golf Pro': '⛳', Groundskeeper: '🌳',
  'Cart Attendant': '🛺', 'Boat Captain': '⛵', 'Island Manager': '🏝️', 'Ride Operator': '🎢', 'Safety Inspector': '🦺',
  'Ski Instructor': '⛷️', 'Lift Operator': '🚠', 'Mountain Rescue': '🚑',
};

export type RoomType = { type: string; baseCost: number; basePrice: number; upkeep: number; description: string; icon: string };
export type FacilityType = {
  type: string;
  baseCost: number;
  upkeep: number;
  incomePerGuest: number;
  description: string;
  requiredStaff?: { role: string; count: number }[];
  isPremium?: boolean;
  coinCost?: number;
  icon: string;
};
export type StaffRole = { role: string; baseSalary: number; description: string; icon: string };
export type TrainingProgram = { id: string; name: string; cost: number; skillBoost: number; happiness: number };

export const engineData: any = data;
export const roomTypes: RoomType[] = data.ROOM_TYPES.map((r: any) => ({ ...r, icon: ROOM_ICONS[r.type] || '🛏️' }));
export const facilityTypes: FacilityType[] = data.FACILITY_TYPES.map((f: any) => ({ ...f, icon: FACILITY_ICONS[f.type] || '🏛️' }));
export const staffRoles: StaffRole[] = data.STAFF_ROLES.map((s: any) => ({ ...s, icon: STAFF_ICONS[s.role] || '🧑' }));
export const trainingPrograms: TrainingProgram[] = data.TRAINING_PROGRAMS;
export const facilityIcon = (name: string) => FACILITY_ICONS[name] || '🏛️';

// Dashboard/tab analysis straight from the engine (same formulas the server simulates).
export const insights: Record<string, (...args: any[]) => any> & { GUEST_LIKES: Record<string, string[]>; SEASONS: Record<string, { label: string; hint: string }> } =
  engineInsights as any;

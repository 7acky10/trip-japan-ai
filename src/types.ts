export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  createdAt: number;
  colorPreset: string; // Tailwind color class for identification
  syncId?: string; // Opt-in identifier for free-cloud real-time syncing
}

export type TransitMode = 'transit' | 'bus' | 'train' | 'walk' | 'taxi' | 'flight' | 'none';

export interface ItineraryItem {
  id: string;
  tripId: string;
  date: string; // YYYY-MM-DD
  title: string;
  location: string;
  startMinutes: number; // minutes from midnight (e.g. 540 for 09:00)
  endMinutes: number;   // minutes from midnight (e.g. 630 for 10:30)
  isReserved: boolean;
  reservationTime: string; // e.g. "12:30" or empty
  googleMapsRoute: string; // Custom string or Google Maps transit route details
  googleMapsUrl?: string;  // Preconstructed or user-pasted google map routing link
  transitMode: TransitMode;
  transitCost: number;     // Cost of transit (e.g., in local currency)
  transitDuration: number; // Travel time in minutes
  transitDetails: string;  // details of transit e.g. "搭乘東京地鐵日比谷線"
  transitCurrency?: string; // Currency symbol e.g., '¥' or '$'
  notes?: string;
  isHotel?: boolean;       // Newly added to identify hotels
}

export interface DayTab {
  dateString: string; // YYYY-MM-DD
  label: string;      // "Day 1", "Day 2", etc.
  dayOfWeek: string;  // "Mon", "Tue", etc.
  formattedDate: string; // "6/23"
}

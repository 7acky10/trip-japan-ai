import { DayTab, TransitMode } from './types';

// Convert minutes from midnight (0–1440+) to HH:MM format (supports overnight)
export function formatMinutesToTime(minutes: number, showNextDayPrefix = false): string {
  const isNextDay = minutes >= 1440;
  const normalized = Math.max(0, minutes % 1440);
  const hours = Math.floor(normalized / 60);
  const mins = Math.floor(normalized % 60);
  const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  return isNextDay && showNextDayPrefix ? `翌日 ${timeStr}` : timeStr;
}

// Convert "HH:MM" format string to minutes from midnight
export function parseTimeToMinutes(timeString: string): number {
  if (!timeString) return 0;
  const cleanStr = timeString.replace('翌日 ', '');
  const [hStr, mStr] = cleanStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return Math.min(2879, Math.max(0, h * 60 + m));
}

// Generate the days list between start and end date (supports up to 14 days)
export function generateDaysList(startDate: string, endDate: string): DayTab[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || !endDate) {
    return [];
  }
  
  const dayTabs: DayTab[] = [];
  const daysOfWeek = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  
  // Calculate difference in days, cap at 14 days for a short-term trip
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.min(14, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
  
  for (let i = 0; i < diffDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    
    const yyyy = current.getFullYear();
    const mm = (current.getMonth() + 1).toString().padStart(2, '0');
    const dd = current.getDate().toString().padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    dayTabs.push({
      dateString,
      label: `第 ${i + 1} 天`,
      dayOfWeek: daysOfWeek[current.getDay()],
      formattedDate: `${current.getMonth() + 1}/${current.getDate()}`
    });
  }
  
  return dayTabs;
}

// Construct standard Google Maps Transit URL
export function makeGoogleMapsDirUrl(origin: string, destination: string): string {
  if (!origin || !destination) return '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
}

// Predictable seed-based mock route suggestions (since we don't have active live maps API credentials,
// simulating multiple travel options based on locations so the user gets realistic public transit lines, costs, and durations)
export interface MockTransitOption {
  mode: TransitMode;
  details: string;
  duration: number; // in mins
  cost: number;    // in TWD/JPY currency
  desc: string;
}

export function generateMockTransitRoutes(origin: string, destination: string): MockTransitOption[] {
  if (!origin || !destination) {
    return [];
  }

  // Simple hash for input strings to get deterministic mock routes
  const combinedStr = `${origin}-${destination}`;
  let hash = 0;
  for (let i = 0; i < combinedStr.length; i++) {
    hash = combinedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const durationFactor = (hash % 25) + 12; // 12-36 minutes base
  const costFactor = (hash % 15) * 20 + 150; // JPY/TWD style base cost

  const isDomesticTaiwan = origin.match(/[\u4e00-\u9fa5]/) && !combinedStr.includes("東京") && !combinedStr.includes("大阪") && !combinedStr.includes("京都") && !combinedStr.includes("日本") && !combinedStr.includes("JAPAN");
  const isJapan = combinedStr.includes("東京") || combinedStr.includes("大阪") || combinedStr.includes("京都") || combinedStr.includes("日本") || combinedStr.includes("駅") || combinedStr.includes("新宿") || combinedStr.includes("澀谷") || combinedStr.includes("山手") || combinedStr.includes("JAPAN") || combinedStr.includes("Tokyo") || combinedStr.includes("Kyoto");

  const currencySymbol = isJapan ? "¥" : "NT$";
  
  // Create 4 distinct mock routes
  const routes: MockTransitOption[] = [];

  // Route 1: Rapid Train / Subway (Metro)
  if (isJapan) {
    routes.push({
      mode: 'train',
      details: `搭乘地下鐵 / JR / 電鐵`,
      duration: durationFactor,
      cost: Math.round(costFactor * 1.1),
      desc: `大眾交通運輸 (${durationFactor} 分鐘 / ${currencySymbol}${Math.round(costFactor * 1.1)})`
    });
  } else {
    routes.push({
      mode: 'train',
      details: `搭乘捷運 / 火車`,
      duration: durationFactor,
      cost: Math.round(costFactor * 0.4),
      desc: `大眾交通運輸 (${durationFactor} 分鐘 / ${currencySymbol}${Math.round(costFactor * 0.4)})`
    });
  }

  // Route 2: Local Bus
  if (isJapan) {
    routes.push({
      mode: 'bus',
      details: `都營巴士 / 市營公車`,
      duration: Math.round(durationFactor * 1.4),
      cost: 210,
      desc: `公車系統 (${Math.round(durationFactor * 1.4)} 分鐘 / ${currencySymbol}210)`
    });
  } else {
    routes.push({
      mode: 'bus',
      details: `聯營公車 / 客運`,
      duration: Math.round(durationFactor * 1.3),
      cost: 30,
      desc: `公車系統 (${Math.round(durationFactor * 1.3)} 分鐘 / ${currencySymbol}30)`
    });
  }

  // Route 3: Walking
  const walkDuration = Math.round(durationFactor * 4.5);
  routes.push({
    mode: 'walk',
    details: `步行前往`,
    duration: walkDuration,
    cost: 0,
    desc: `步行直達 (${walkDuration} 分鐘 / 免費)`
  });

  // Route 4: Taxi
  const taxiCost = isJapan ? Math.round(durationFactor * 150 + 500) : Math.round(durationFactor * 25 + 85);
  routes.push({
    mode: 'taxi',
    details: `搭乘計程車 / Uber`,
    duration: Math.round(durationFactor * 0.6),
    cost: taxiCost,
    desc: `計程車 / 車輛 (${Math.round(durationFactor * 0.6)} 分鐘 / 約 ${currencySymbol}${taxiCost})`
  });

  return routes;
}

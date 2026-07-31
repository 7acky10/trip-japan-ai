import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Trip, ItineraryItem, DayTab, TransitMode } from './types';
import { generateDaysList, formatMinutesToTime, makeGoogleMapsDirUrl } from './utils';
import TripSetupForm from './components/TripSetupForm';
import CalendarGrid from './components/CalendarGrid';
import ItineraryItemEditor from './components/ItineraryItemEditor';
import TripAgendaView from './components/TripAgendaView';
import CloudSyncManager from './components/CloudSyncManager';
import TripDuplicateModal from './components/TripDuplicateModal';
import UnscheduledPanel from './components/UnscheduledPanel';

// Standard icons from lucide-react
import { 
  Compass, 
  Calendar as CalendarIcon, 
  List, 
  Lock, 
  Unlock, 
  Plus, 
  MapPin, 
  ExternalLink, 
  Clock, 
  ChevronRight, 
  Trash2, 
  HelpCircle, 
  Sparkles,
  RefreshCw,
  LogOut,
  X,
  Map,
  Ticket,
  Coins,
  Route,
  Copy
} from 'lucide-react';

const LOCAL_STORAGE_TRIPS_KEY = 'travel_itinerary_trips_data';
const LOCAL_STORAGE_ITEMS_KEY = 'travel_itinerary_items_data';

// High-fidelity Predefined Tokyo 5-Day Guided travel template
const DEMO_TRIP: Trip = {
  id: 'demo_tokyo_trip',
  name: '東京大眾運輸自由行 (示範)',
  startDate: '2026-06-25',
  endDate: '2026-06-29',
  createdAt: Date.now(),
  colorPreset: 'indigo'
};

const DEMO_ITEMS: ItineraryItem[] = [
  // Day 1: 6/25
  {
    id: 'demo_item_1',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-25',
    title: '下榻飯店：東京車站酒店',
    location: '東京車站',
    startMinutes: 510, // 08:30
    endMinutes: 600,   // 10:00
    isReserved: true,
    reservationTime: '08:30',
    googleMapsRoute: '',
    googleMapsUrl: '',
    transitMode: 'none',
    transitCost: 0,
    transitDuration: 0,
    transitDetails: '',
    notes: '抵達東京後先將行李寄放到櫃檯，領取預排好的西瓜卡。',
    isHotel: true
  },
  {
    id: 'demo_item_2',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-25',
    title: '築地場外市場品嚐海鮮壽司',
    location: '築地場外市場',
    startMinutes: 660, // 11:00
    endMinutes: 780,   // 13:00
    isReserved: false,
    reservationTime: '',
    googleMapsRoute: '東京車站 → 築地市場',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=%E6%9D%B1%E4%BA%AC%E8%BB%8A%E7%AB%99&destination=%E7%AF%89%E5%9C%B0%E5%A0%B4%E5%A4%96%E5%B8%82%E5%A0%B4&travelmode=transit',
    transitMode: 'train',
    transitCost: 180,
    transitDuration: 15,
    transitDetails: '搭乘東京地下鐵日比谷線至築地站',
    notes: '必吃玉子燒、海膽蓋飯與生蠔。注意部分店家僅收現金！'
  },
  {
    id: 'demo_item_3',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-25',
    title: 'teamLab Stars 沉浸式星空藝術展',
    location: 'teamLab Planets TOKYO豐洲',
    startMinutes: 840, // 14:00
    endMinutes: 1020,  // 17:00
    isReserved: true,
    reservationTime: '14:00',
    googleMapsRoute: '築地市場 → 豐洲 teamLab',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=%E7%AF%89%E5%9C%B0%E5%A0%B4%E5%A4%96%E5%B8%82%E5%A0%B4&destination=teamLab+Planets+TOKYO%E8%B1%90%E6%B4%B2&travelmode=transit',
    transitMode: 'train',
    transitCost: 260,
    transitDuration: 20,
    transitDetails: '搭乘百合鷗號電車至新豐洲站',
    notes: '這是赤腳體驗展覽，記得穿著方便脫穿的褲子和鞋襪。門票已經訂好。'
  },
  {
    id: 'demo_item_4',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-25',
    title: '銀座涮涮鍋精緻牛排晚餐',
    location: '銀座木村家',
    startMinutes: 1110, // 18:30
    endMinutes: 1230,  // 20:30
    isReserved: true,
    reservationTime: '18:30',
    googleMapsRoute: '豐洲 → 銀座',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=teamLab+Planets+TOKYO%E8%B1%90%E6%B4%B2&destination=%E9%8B%80%E5%BA%A7%E6%9C%A8%E6%9D%91%E5%AE%B6&travelmode=transit',
    transitMode: 'train',
    transitCost: 320,
    transitDuration: 25,
    transitDetails: '搭乘有樂町線至銀座一丁目站',
    notes: '經典精緻和牛涮涮鍋盛宴，已完成線上訂位！'
  },
  // Day 2: 6/26
  {
    id: 'demo_item_5',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-26',
    title: '澀谷十字路口與忠犬八公像',
    location: '澀谷車站',
    startMinutes: 570, // 09:30
    endMinutes: 660,   // 11:05
    isReserved: false,
    reservationTime: '',
    googleMapsRoute: '',
    googleMapsUrl: '',
    transitMode: 'none',
    transitCost: 0,
    transitDuration: 0,
    transitDetails: '',
    notes: '極具代表性的十字路口，可去Starbucks二樓俯瞰拍照。'
  },
  {
    id: 'demo_item_6',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-26',
    title: '明治神宮參拜與林蔭步道',
    location: '明治神宮',
    startMinutes: 705, // 11:45
    endMinutes: 810,   // 13:30
    isReserved: false,
    reservationTime: '',
    googleMapsRoute: '澀谷 → 原宿',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=%E6%BE%A0%E8%B0%B7%E8%BB%8A%E7%AB%99&destination=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE&travelmode=transit',
    transitMode: 'train',
    transitCost: 155,
    transitDuration: 12,
    transitDetails: '搭乘JR山手線至原宿站',
    notes: '散步通過巨大的鳥居，享受林蔭大自然芬多精。'
  },
  {
    id: 'demo_item_7',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-26',
    title: '新宿御苑英式花園野餐',
    location: '新宿御苑',
    startMinutes: 840, // 14:00
    endMinutes: 990,   // 16:30
    isReserved: false,
    reservationTime: '',
    googleMapsRoute: '明治神宮 → 新宿御苑',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE&destination=%E6%96%B0%E5%AE%BF%E5%BE%A1%E8%8B%91&travelmode=transit',
    transitMode: 'walk',
    transitCost: 0,
    transitDuration: 20,
    transitDetails: '沿著明治大道漫步前往',
    notes: '入園參觀費用為500日圓。推薦在草坪上小歇。'
  },
  {
    id: 'demo_item_8',
    tripId: 'demo_tokyo_trip',
    date: '2026-06-26',
    title: '六本木之丘 52F 觀景台夜景',
    location: '六本木之丘 森大樓',
    startMinutes: 1140, // 19:00
    endMinutes: 1260,  // 21:00
    isReserved: true,
    reservationTime: '19:00',
    googleMapsRoute: '新宿御苑 → 六本木之丘',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=%E6%96%B0%E5%AE%BF%E5%BE%A1%E8%8B%91&destination=%E5%85%AD%E6%9C%AC%E6%9C%A8%E4%B9%8B%E4%B8%98+%E6%A3%AE%E5%A4%A3%E6%A8%93&travelmode=transit',
    transitMode: 'train',
    transitCost: 220,
    transitDuration: 18,
    transitDetails: '搭乘都營地下鐵大江戶線',
    notes: '可近距離完整俯瞰點晶剔透的東京鐵塔地標夜景！'
  },
  {
    id: 'demo_item_unscheduled_1',
    tripId: 'demo_tokyo_trip',
    date: 'unscheduled',
    isUnscheduled: true,
    title: '上野阿美橫丁採買與小吃 (備案)',
    location: '上野阿美橫丁',
    startMinutes: 900, // 15:00
    endMinutes: 960,   // 16:00
    isReserved: false,
    reservationTime: '',
    googleMapsRoute: '',
    googleMapsUrl: '',
    transitMode: 'none',
    transitCost: 0,
    transitDuration: 0,
    transitDetails: '',
    notes: '彈性行程：採買藥妝與章魚燒小吃。可隨時拖曳至日曆時間表安排！'
  }
];

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [activeDate, setActiveDate] = useState<string>('');
  
  // App parameters
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  
  // Custom Detail viewer popup
  const [viewingItemDetail, setViewingItemDetail] = useState<ItineraryItem | null>(null);
  
  // Safe delete state without window.confirm (since iframes block it)
  const [deleteConfirmTripId, setDeleteConfirmTripId] = useState<string | null>(null);

  // Copy / Duplicate trip state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const handleDuplicateTripConfirm = (newTrip: Trip, newItems: ItineraryItem[]) => {
    const updatedTrips = [newTrip, ...trips];
    const updatedItems = [...itineraryItems, ...newItems];

    setTrips(updatedTrips);
    setItineraryItems(updatedItems);
    setCurrentTrip(newTrip);
    setActiveDate(newTrip.startDate);

    saveToLocalStorage(updatedTrips, updatedItems);
    setShowDuplicateModal(false);
  };

  // Sync / Shared Trip callbacks
  const handleTripSyncIdUpdate = (updatedTrip: Trip) => {
    setCurrentTrip(updatedTrip);
    const updatedTrips = trips.map((t) => t.id === updatedTrip.id ? updatedTrip : t);
    setTrips(updatedTrips);
    saveToLocalStorage(updatedTrips, itineraryItems);
  };

  const handleCloudSyncReceived = (syncedTrip: Trip, syncedItems: ItineraryItem[]) => {
    // 1. Update/Add this trip to total trips state
    const foundIdx = trips.findIndex((t) => t.id === syncedTrip.id);
    let updatedTrips = [...trips];
    if (foundIdx > -1) {
      updatedTrips[foundIdx] = syncedTrip;
    } else {
      updatedTrips = [syncedTrip, ...updatedTrips];
    }
    setTrips(updatedTrips);
    setCurrentTrip(syncedTrip);
    if (!activeDate || syncedTrip.id !== currentTrip?.id) {
      setActiveDate(syncedTrip.startDate);
    }

    // 2. Insert/replace itinerary items for THIS trip only
    const cleanItems = itineraryItems.filter((i) => i.tripId !== syncedTrip.id);
    const updatedItems = [...cleanItems, ...syncedItems];
    setItineraryItems(updatedItems);

    // 3. Save to local storage
    localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(updatedTrips));
    localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(updatedItems));
  };

  // Helper to get local date string yyyy-mm-dd
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  // Initialize and load data from LocalStorage
  useEffect(() => {
    const loadedTrips = localStorage.getItem(LOCAL_STORAGE_TRIPS_KEY);
    const loadedItems = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);

    let parsedTrips: Trip[] = [];
    if (loadedTrips) {
      try {
        parsedTrips = JSON.parse(loadedTrips) as Trip[];
        setTrips(parsedTrips);
      } catch (e) {
        console.error('Failed to parse saved trips data from LocalStorage:', e);
      }
    }

    if (loadedItems) {
      try {
        const parsed = JSON.parse(loadedItems) as ItineraryItem[];
        setItineraryItems(parsed);
      } catch (e) {
        console.error('Failed to parse saved itinerary items from LocalStorage:', e);
      }
    }

    // Auto-select the first trip on load if available
    if (parsedTrips.length > 0) {
      setCurrentTrip(parsedTrips[0]);
    }
  }, []);

  // Monitor currentTrip change to pre-select correct activeDate (today's date if within trip range)
  // Only trigger when the actual trip ID changes to prevent polling from resetting the user's active date selection.
  useEffect(() => {
    if (currentTrip) {
      const days = generateDaysList(currentTrip.startDate, currentTrip.endDate);
      const isValidActiveDate = days.some(day => day.dateString === activeDate);
      
      if (!activeDate || !isValidActiveDate) {
        const todayStr = getLocalDateString();
        if (todayStr >= currentTrip.startDate && todayStr <= currentTrip.endDate) {
          setActiveDate(todayStr);
          setViewMode('calendar'); // 開啟網頁時直接跳到當天的日曆時段
        } else {
          setActiveDate(currentTrip.startDate);
        }
      }
    } else {
      setActiveDate('');
    }
  }, [currentTrip?.id]);

  // Sync state to LocalStorage
  const saveToLocalStorage = (allTrips: Trip[], allItems: ItineraryItem[]) => {
    localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(allTrips));
    localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(allItems));
  };

  // Setup/Create Trip Complete
  const handleTripSetupComplete = (newTrip: Trip) => {
    const updatedTrips = [newTrip, ...trips];
    setTrips(updatedTrips);
    setCurrentTrip(newTrip);
    setActiveDate(newTrip.startDate);
    saveToLocalStorage(updatedTrips, itineraryItems);
  };

  // Load Predesigned Demo values for testing immediately
  const handleLoadDemo = () => {
    // Add Demo Trip and items
    const hasDemo = trips.some((t) => t.id === DEMO_TRIP.id);
    let updatedTrips = [...trips];
    if (!hasDemo) {
      updatedTrips = [DEMO_TRIP, ...trips];
    }

    // Filter out previous demo items and append
    const cleanedItems = itineraryItems.filter((item) => item.tripId !== DEMO_TRIP.id);
    const updatedItems = [...cleanedItems, ...DEMO_ITEMS];

    setTrips(updatedTrips);
    setItineraryItems(updatedItems);
    setCurrentTrip(DEMO_TRIP);
    setActiveDate(DEMO_TRIP.startDate);
    saveToLocalStorage(updatedTrips, updatedItems);
  };

  const handleSelectTrip = (tripId: string) => {
    const found = trips.find((t) => t.id === tripId);
    if (found) {
      setCurrentTrip(found);
      setActiveDate(found.startDate);
    }
  };

  const handleLogoutTrip = () => {
    setCurrentTrip(null);
    setActiveDate('');
  };

  // Delete trip fully
  const handleDeleteTrip = () => {
    if (!currentTrip) return;
    if (deleteConfirmTripId !== currentTrip.id) {
      setDeleteConfirmTripId(currentTrip.id);
      // Auto cancel after 5 seconds to keep it safe
      setTimeout(() => {
        setDeleteConfirmTripId(prev => prev === currentTrip.id ? null : prev);
      }, 5000);
      return;
    }

    const restTrips = trips.filter((t) => t.id !== currentTrip.id);
    const restItems = itineraryItems.filter((i) => i.tripId !== currentTrip.id);
    setTrips(restTrips);
    setItineraryItems(restItems);
    saveToLocalStorage(restTrips, restItems);
    setCurrentTrip(null);
    setDeleteConfirmTripId(null);
  };

  // Automatically recalculate and align Google Maps routing URLs when item sequence or details change
  const recalculateGoogleMapsUrls = (itemsList: ItineraryItem[]): ItineraryItem[] => {
    if (!currentTrip) return itemsList;

    // Helper functions inside/used by the mapper
    const getPrevNightHotel = (activeItem: ItineraryItem, list: ItineraryItem[]): ItineraryItem | null => {
      const tabs = generateDaysList(currentTrip.startDate, currentTrip.endDate);
      const itemDateIndex = tabs.findIndex(tab => tab.dateString === activeItem.date);
      if (itemDateIndex <= 0) return null;

      const checkDateStrings = tabs.slice(0, itemDateIndex).map(tab => tab.dateString).reverse();
      for (const dateStr of checkDateStrings) {
        const hotelsOnDate = list
          .filter(item => item.tripId === activeItem.tripId && item.date === dateStr && (item.isHotel || /飯店|酒店|旅館|民宿|住宿|Hotel|Hostel|Inn|B&B/i.test(item.title)))
          .sort((a, b) => b.startMinutes - a.startMinutes);
        if (hotelsOnDate.length > 0) {
          return hotelsOnDate[0];
        }
      }
      return null;
    };

    const getPrevLocation = (activeItem: ItineraryItem, list: ItineraryItem[]): string | null => {
      const dayItems = list
        .filter(item => item.tripId === activeItem.tripId && item.date === activeItem.date && item.id !== activeItem.id)
        .sort((a, b) => a.startMinutes - b.startMinutes);

      let lastBefore: ItineraryItem | null = null;
      for (const item of dayItems) {
        if (item.endMinutes <= activeItem.startMinutes) {
          if (!lastBefore || item.endMinutes > lastBefore.endMinutes) {
            lastBefore = item;
          }
        }
      }

      if (lastBefore && lastBefore.location) {
        return lastBefore.location;
      }

      const prevHotel = getPrevNightHotel(activeItem, list);
      return prevHotel && prevHotel.location ? prevHotel.location : null;
    };

    // Map through the list and update googleMapsUrl if needed
    return itemsList.map(item => {
      if (item.tripId !== currentTrip.id) return item;
      if (item.transitMode === 'flight') {
        return { ...item, googleMapsUrl: '' };
      }
      // Re-evaluate previous location
      const prevLoc = getPrevLocation(item, itemsList);
      if (prevLoc && item.location) {
        const generatedUrl = makeGoogleMapsDirUrl(prevLoc, item.location);
        return { ...item, googleMapsUrl: generatedUrl };
      } else {
        return { ...item, googleMapsUrl: '' };
      }
    });
  };

  // Save or edit an Itinerary Item
  const handleSaveItineraryItem = (savedItem: ItineraryItem) => {
    const exists = itineraryItems.some(i => i.id === savedItem.id);
    let updated: ItineraryItem[];
    if (exists) {
      updated = itineraryItems.map(i => i.id === savedItem.id ? savedItem : i);
    } else {
      updated = [...itineraryItems, savedItem];
    }
    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
    setEditingItem(null);
    setViewingItemDetail(null);
  };

  // Delete Itinerary Item
  const handleDeleteItineraryItem = (id: string) => {
    const updated = itineraryItems.filter(i => i.id !== id);
    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
    setEditingItem(null);
    setViewingItemDetail(null);
  };

  // Update Itinerary item times (e.g. from Drag & drop resize in calendar)
  const handleItemTimeUpdate = (id: string, startMins: number, endMins: number) => {
    const updated = itineraryItems.map(item => {
      if (item.id === id) {
        // Find if locations can update its path or preserve
        return {
          ...item,
          startMinutes: startMins,
          endMinutes: endMins
        };
      }
      return item;
    });
    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
  };

  // Add Item quickly at empty grid slot click
  const handleAddNewItemAtTime = (startMins: number) => {
    if (!currentTrip) return;

    const defaultNew: ItineraryItem = {
      id: `item_${Date.now()}`,
      tripId: currentTrip.id,
      date: activeDate,
      title: '新行程景點',
      location: '',
      startMinutes: startMins,
      endMinutes: Math.min(1440, startMins + 90), // Default duration: 1.5 hours
      isReserved: false,
      reservationTime: '',
      googleMapsRoute: '',
      googleMapsUrl: '',
      transitMode: 'none',
      transitCost: 0,
      transitDuration: 0,
      transitDetails: '',
      notes: ''
    };

    setEditingItem(defaultNew);
  };

  // Add new unscheduled (stashed) itinerary item
  const handleAddUnscheduledItem = (title: string, location: string, startMins: number, durationMins: number) => {
    if (!currentTrip) return;
    const newItem: ItineraryItem = {
      id: `item_${Date.now()}`,
      tripId: currentTrip.id,
      date: 'unscheduled',
      isUnscheduled: true,
      title,
      location,
      startMinutes: startMins,
      endMinutes: Math.min(1440, startMins + durationMins),
      isReserved: false,
      reservationTime: '',
      googleMapsRoute: '',
      googleMapsUrl: '',
      transitMode: 'none',
      transitCost: 0,
      transitDuration: 0,
      transitDetails: '',
      notes: ''
    };

    const updated = [...itineraryItems, newItem];
    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
  };

  // Move unscheduled item to calendar active date / time
  const handleMoveUnscheduledToCalendar = (itemId: string, targetDate: string, targetStartMins?: number) => {
    const updated = itineraryItems.map(item => {
      if (item.id === itemId) {
        const duration = item.endMinutes - item.startMinutes || 60;
        const startMinutes = targetStartMins !== undefined ? targetStartMins : item.startMinutes;
        const endMinutes = Math.min(1440, startMinutes + duration);
        return {
          ...item,
          date: targetDate,
          isUnscheduled: false,
          startMinutes,
          endMinutes
        };
      }
      return item;
    });

    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
  };

  // Move scheduled item back to unscheduled stashed list
  const handleMoveItemToUnscheduled = (itemId: string) => {
    const updated = itineraryItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          date: 'unscheduled',
          isUnscheduled: true
        };
      }
      return item;
    });

    const finalUpdated = recalculateGoogleMapsUrls(updated);
    setItineraryItems(finalUpdated);
    saveToLocalStorage(trips, finalUpdated);
  };

  // Get active days tabs for active travel period
  const dayTabs: DayTab[] = currentTrip 
    ? generateDaysList(currentTrip.startDate, currentTrip.endDate)
    : [];

  // Filter items for current active date, including previous day's items that cross overnight (endMinutes > 1440)
  const activeDayItems = itineraryItems.filter(item => {
    if (!currentTrip || item.tripId !== currentTrip.id) return false;
    if (item.isUnscheduled || item.date === 'unscheduled') return false;
    
    // Direct match
    if (item.date === activeDate) return true;
    
    // If item crosses midnight, check if it was on the previous day
    if (item.endMinutes > 1440) {
      const activeIdx = dayTabs.findIndex(t => t.dateString === activeDate);
      if (activeIdx > 0) {
        const prevDayString = dayTabs[activeIdx - 1].dateString;
        if (item.date === prevDayString) return true;
      }
    }
    return false;
  });

  const unscheduledItems = itineraryItems.filter(item => {
    return currentTrip && item.tripId === currentTrip.id && (item.isUnscheduled || item.date === 'unscheduled' || !item.date);
  });

  const activeIdx = dayTabs.findIndex(t => t.dateString === activeDate);
  const nextDayTransitItems = currentTrip && activeIdx >= 0 && activeIdx < dayTabs.length - 1
    ? itineraryItems.filter(item => {
        return (
          item.tripId === currentTrip.id &&
          item.date === dayTabs[activeIdx + 1].dateString &&
          item.transitMode !== 'none' &&
          (item.transitDuration || 0) > 0 &&
          item.startMinutes - (item.transitDuration || 0) < 0
        );
      })
    : [];

  // Find the active hotel for the previous night of a given item's date
  const getPreviousNightHotel = (activeItem: ItineraryItem): ItineraryItem | null => {
    if (!currentTrip) return null;

    // Get ordered days of the trip
    const tabs = generateDaysList(currentTrip.startDate, currentTrip.endDate);
    const itemDateIndex = tabs.findIndex(tab => tab.dateString === activeItem.date);

    // If day of activeItem is the very first day or not found, there is no "previous night"
    if (itemDateIndex <= 0) return null;

    // We want to find the latest hotel starting from Day (itemDateIndex - 1) going backwards
    const checkDateStrings = tabs.slice(0, itemDateIndex).map(tab => tab.dateString).reverse();

    for (const dateStr of checkDateStrings) {
      // Find hotel items on this date
      const hotelsOnDate = itineraryItems
        .filter(item => item.tripId === activeItem.tripId && item.date === dateStr && (item.isHotel || /飯店|酒店|旅館|民宿|住宿|Hotel|Hostel|Inn|B&B/i.test(item.title)))
        .sort((a, b) => b.startMinutes - a.startMinutes); // Latest first on the same day

      if (hotelsOnDate.length > 0) {
        return hotelsOnDate[0];
      }
    }

    return null;
  };

  // Auto detect previous item location to compute transit routing start point
  const getPreviousLocationOf = (activeItem: ItineraryItem): string | null => {
    // Collect all other items on the same day except current
    const dayItems = itineraryItems
      .filter(item => item.tripId === activeItem.tripId && item.date === activeItem.date && item.id !== activeItem.id)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    
    // Find item that ends immediately before activeItem starts
    let lastBefore: ItineraryItem | null = null;
    for (const item of dayItems) {
      if (item.endMinutes <= activeItem.startMinutes) {
        if (!lastBefore || item.endMinutes > lastBefore.endMinutes) {
          lastBefore = item;
        }
      }
    }

    if (lastBefore && lastBefore.location) {
      return lastBefore.location;
    }

    // Since there's no previous item on this day, check if we can use the previous day's check-in hotel
    const prevHotel = getPreviousNightHotel(activeItem);
    return prevHotel && prevHotel.location ? prevHotel.location : null;
  };

  // Quick helper to read current day's total budget
  const activeDayTransitYen = activeDayItems.filter(item => (item.transitCurrency || '¥') === '¥' && item.transitCost !== undefined && item.transitCost !== null && item.transitCost >= 0).reduce((sum, item) => sum + (item.transitCost || 0), 0);
  const activeDayTransitNT = activeDayItems.filter(item => item.transitCurrency === '$' && item.transitCost !== undefined && item.transitCost !== null && item.transitCost >= 0).reduce((sum, item) => sum + (item.transitCost || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] flex flex-col font-sans">
      
      {/* Top Main Navigation Header */}
      <header className="bg-[#121214] border-b border-white/5 px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-[#A7C7E7] text-black rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-[15px] sm:text-base leading-tight tracking-tight text-white">
              {currentTrip ? currentTrip.name : '短期旅行日程助手'}
            </h1>
            {currentTrip && (
              <p className="text-[10px] text-[#8a8a8e] font-medium">
                📅 {currentTrip.startDate} ~ {currentTrip.endDate} ({dayTabs.length} 天)
              </p>
            )}
          </div>
        </div>

        {/* Header CTA area */}
        <div className="flex items-center space-x-2">
          {currentTrip ? (
            <>
              {/* Leave trip button */}
              <button
                onClick={handleLogoutTrip}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition"
                title="回到旅程列表"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </>
          ) : (
            <button
              onClick={handleLoadDemo}
              className="px-3.5 py-1.5 text-xs font-bold text-[#A7C7E7] bg-[#A7C7E7]/10 hover:bg-[#A7C7E7]/20 rounded-full border border-[#A7C7E7]/20 flex items-center space-x-1 transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A7C7E7]" />
              <span>示範行程：5天4夜東京</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-0 sm:p-4 flex flex-col space-y-4">
        
        {currentTrip ? (
          <>
            {/* View filter (Calendar vs Agenda) & Days slider Tab */}
            <div className="bg-[#121214] p-3 border-b border-white/5 sm:border sm:border-white/5 sm:rounded-2xl space-y-3 shrink-0">
              
              {/* Tab Header View Mode */}
              <div className="flex items-center justify-between">
                <div className="flex bg-[#1e1e22] p-0.5 rounded-lg border border-white/5">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-md transition ${
                      viewMode === 'calendar' 
                        ? 'bg-[#A7C7E7] text-black shadow-md font-bold' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>日曆時段</span>
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('agenda');
                      // 點選旅程總覽的時候也要滑動到當天的位置 (若今日期在行程區間中)
                      const todayStr = getLocalDateString();
                      if (currentTrip && todayStr >= currentTrip.startDate && todayStr <= currentTrip.endDate) {
                        setActiveDate(todayStr);
                      }
                    }}
                    className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-md transition ${
                      viewMode === 'agenda' 
                        ? 'bg-[#A7C7E7] text-black shadow-md font-bold' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>旅程總覽</span>
                  </button>
                </div>

                {/* Day Cost Badge */}
                {viewMode === 'calendar' && (
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-[#8a8a8e] tracking-wider">今日估計路費</p>
                    <p className="text-sm font-black text-[#03dac6]">
                      {activeDayTransitYen > 0 && `¥ ${activeDayTransitYen.toLocaleString()}`}
                      {activeDayTransitYen > 0 && activeDayTransitNT > 0 && ' + '}
                      {(activeDayTransitNT > 0 || (activeDayTransitYen === 0 && activeDayTransitNT === 0)) && `NT$ ${activeDayTransitNT.toLocaleString()}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Days Horizon Scroll Tab (Allows fast mobile tap to change days) */}
              <div className="flex items-center space-x-2 overflow-x-auto py-1.5 scrollbar-none w-full flex-nowrap scroll-smooth whitespace-nowrap overflow-y-hidden select-none">
                {dayTabs.map((day) => {
                  const isActive = day.dateString === activeDate;

                  return (
                    <button
                      key={day.dateString}
                      onClick={() => {
                        setActiveDate(day.dateString);
                      }}
                      className={`flex flex-col items-center justify-center p-2 px-3.5 rounded-xl shrink-0 text-center transition min-w-[62px] ${
                        isActive
                          ? 'bg-[#A7C7E7] text-black font-extrabold shadow-md'
                          : 'bg-[#1e1e22] hover:bg-[#2c2c31] text-[#8a8a8e] border border-white/5'
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-medium leading-none mb-1">
                        {day.label}
                      </span>
                      <span className="text-sm font-black leading-none">
                        {day.formattedDate}
                      </span>
                      <span className="text-[10px] font-bold mt-1 opacity-80 leading-none">
                        {day.dayOfWeek}
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Core View Display */}
            <div className="flex-1">
              {viewMode === 'calendar' ? (
                <div className="flex flex-col lg:flex-row gap-4 items-start">
                  <div className="flex-1 w-full min-w-0">
                    <CalendarGrid
                      items={activeDayItems}
                      activeDate={activeDate}
                      nextDayTransitItems={nextDayTransitItems}
                      onItemClick={(item) => setViewingItemDetail(item)}
                      onTransitClick={(item) => setViewingItemDetail(item)}
                      onItemTimeUpdate={handleItemTimeUpdate}
                      onAddAtTime={handleAddNewItemAtTime}
                      colorPreset={currentTrip.colorPreset}
                      onMoveToUnscheduled={handleMoveItemToUnscheduled}
                      onDropUnscheduledItem={(itemId, startMins) => handleMoveUnscheduledToCalendar(itemId, activeDate, startMins)}
                    />
                  </div>

                  {/* Desktop Right Side / Mobile Bottom Panel for Temporary (Unscheduled) Itinerary */}
                  <div className="w-full lg:w-80 shrink-0">
                    <UnscheduledPanel
                      items={unscheduledItems}
                      activeDate={activeDate}
                      activeDateLabel={dayTabs.find(t => t.dateString === activeDate)?.formattedDate}
                      onAddUnscheduled={handleAddUnscheduledItem}
                      onMoveToCalendar={handleMoveUnscheduledToCalendar}
                      onMoveToUnscheduled={handleMoveItemToUnscheduled}
                      onEditItem={(item) => setEditingItem(item)}
                      onDeleteItem={handleDeleteItineraryItem}
                      colorPreset={currentTrip.colorPreset}
                    />
                  </div>
                </div>
              ) : (
                <TripAgendaView
                  trip={currentTrip}
                  dayTabs={dayTabs}
                  items={itineraryItems.filter((i) => i.tripId === currentTrip.id)}
                  onItemClick={(item) => setViewingItemDetail(item)}
                  onTransitClick={(item) => setViewingItemDetail(item)}
                  colorPreset={currentTrip.colorPreset}
                  activeDate={activeDate}
                />
              )}
            </div>

            {/* Dynamic Cloud Sync Collaboration Panel */}
            <div className="max-w-md mx-auto w-full px-4 sm:px-0">
              <CloudSyncManager
                currentTrip={currentTrip}
                items={itineraryItems.filter((i) => i.tripId === currentTrip.id)}
                onTripUpdated={handleTripSyncIdUpdate}
                onSyncReceived={handleCloudSyncReceived}
              />
            </div>

            {/* Footer option - Danger deletion */}
            <div className="px-4 py-8 text-center bg-[#121214] rounded-2xl border border-white/5 max-w-md mx-auto">
              <h5 className="font-semibold text-white text-xs">旅程設定與重設</h5>
              <p className="text-[11px] text-[#8a8a8e] mt-0.5 leading-relaxed">
                您的行程儲存於瀏覽器地端的本地資料庫中 (LocalStorage)。
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-3.5">
                <button
                  onClick={() => setShowDuplicateModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#A7C7E7] bg-[#A7C7E7]/10 hover:bg-[#A7C7E7]/20 rounded-lg border border-[#A7C7E7]/20 flex items-center justify-center space-x-1.5 transition cursor-pointer w-full sm:w-auto select-none"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>建立此旅程副本</span>
                </button>

                <button
                  onClick={handleDeleteTrip}
                  className={`px-3.5 py-1.5 text-xs rounded-lg transition font-medium cursor-pointer border w-full sm:w-auto ${
                    deleteConfirmTripId === currentTrip.id
                      ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 animate-pulse'
                      : 'text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10'
                  }`}
                >
                  {deleteConfirmTripId === currentTrip.id ? '⚠️ 再次點選以確認刪除 (無法還原)' : '刪除此整個旅程計畫'}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Trip Setup form if no active trip chosen */
          <div className="space-y-4 max-w-md mx-auto w-full px-4 sm:px-0">
            <TripSetupForm
              onSetupComplete={handleTripSetupComplete}
              existingTrips={trips}
              onSelectTrip={handleSelectTrip}
            />
            
            {/* Quick entry portal for companions to join directly */}
            <CloudSyncManager
              currentTrip={null}
              items={[]}
              onTripUpdated={handleTripSyncIdUpdate}
              onSyncReceived={handleCloudSyncReceived}
            />
          </div>
        )}

      </main>

      {/* 1. EDIT MODAL/DRAWER POPUP */}
      {editingItem && (
        <ItineraryItemEditor
          item={editingItem}
          itineraryItems={itineraryItems}
          tripDays={currentTrip ? generateDaysList(currentTrip.startDate, currentTrip.endDate) : []}
          previousLocation={getPreviousLocationOf(editingItem)}
          onSave={handleSaveItineraryItem}
          onDelete={() => handleDeleteItineraryItem(editingItem.id)}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* 1.1 DUPLICATE TRIP MODAL POPUP */}
      {showDuplicateModal && currentTrip && (
        <TripDuplicateModal
          currentTrip={currentTrip}
          items={itineraryItems.filter((i) => i.tripId === currentTrip.id)}
          onConfirm={handleDuplicateTripConfirm}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

      {/* 2. READ-ONLY PREVIEW DRAWER (When clicking on locked mode) */}
      {viewingItemDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in" onClick={() => setViewingItemDetail(null)}>
          <div 
            className="bg-[#121214] border border-white/5 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden p-5 space-y-4 animate-slide-up text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 bg-[#A7C7E7]/10 text-[#A7C7E7] rounded-md">
                <Clock className="w-3 h-3" />
                <span>
                  {formatMinutesToTime(viewingItemDetail.startMinutes)} - {formatMinutesToTime(viewingItemDetail.endMinutes)}
                </span>
              </span>

              <button 
                onClick={() => setViewingItemDetail(null)}
                className="p-1 hover:bg-white/5 rounded-full text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <div>
              <h3 className="font-extrabold text-lg text-white leading-snug">
                {viewingItemDetail.title}
              </h3>
              {viewingItemDetail.location && (
                <p className="flex items-center text-xs text-slate-400 mt-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#A7C7E7] mr-1" />
                  <span>{viewingItemDetail.location}</span>
                </p>
              )}
            </div>

            {/* Status box */}
            {viewingItemDetail.isReserved && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center space-x-2.5">
                <span className="p-1 bg-amber-500 text-black rounded">
                  <Ticket className="w-4 h-4" />
                </span>
                <div>
                  <h5 className="text-xs font-bold text-amber-500 leading-none">此行程已預約</h5>
                  {viewingItemDetail.reservationTime && (
                    <p className="text-[11px] text-amber-400/80 mt-0.5 font-medium">報到約定時間：{viewingItemDetail.reservationTime}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes description */}
            {viewingItemDetail.notes && (
              <div className="bg-[#1e1e22] p-3 rounded-xl border border-white/5">
                <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">備忘備註</h5>
                <div className="text-xs text-gray-300 leading-relaxed">
                  <Markdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                          {children}
                        </a>
                      ),
                      p: ({ children }) => <p className="whitespace-pre-wrap min-h-[1.25em] my-1.5">{children}</p>,
                      h1: ({ children }) => <h1 className="text-sm font-extrabold text-white mt-3 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-bold text-white mt-2.5 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-bold text-white mt-2 mb-0.5">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-xs font-semibold text-white mt-1.5 mb-0.5">{children}</h4>,
                      ul: ({ children }) => <ul className="list-disc list-inside pl-1 my-1.5 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside pl-1 my-1.5 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="my-0.5">{children}</li>
                    }}
                  >
                    {viewingItemDetail.notes}
                  </Markdown>
                </div>
              </div>
            )}

            {/* Transit Route options */}
            {viewingItemDetail.transitMode !== 'none' ? (
              <div className="p-3.5 bg-sky-500/5 text-sky-300 rounded-xl border border-sky-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">大眾交通規劃資訊</span>
                  {viewingItemDetail.googleMapsUrl && (
                    <a
                      href={viewingItemDetail.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#03dac6] hover:underline flex items-center space-x-0.5"
                    >
                      <span>開啟 Google Map 路線</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1 px-1.5 bg-[#121214] rounded-md border border-white/5">
                      {viewingItemDetail.transitMode === 'train' && '🚇'}
                      {viewingItemDetail.transitMode === 'bus' && '🚌'}
                      {viewingItemDetail.transitMode === 'walk' && '🚶'}
                      {viewingItemDetail.transitMode === 'taxi' && '🚖'}
                      {viewingItemDetail.transitMode === 'flight' && '✈️'}
                      {viewingItemDetail.transitMode === 'transit' && '🚇'}
                    </span>
                    <p className="text-[10px] text-sky-400/80 font-medium">
                      預估乘車時間 {viewingItemDetail.transitDuration} 分鐘{viewingItemDetail.transitCost !== undefined && viewingItemDetail.transitCost !== null && viewingItemDetail.transitCost >= 1 ? ` • ${viewingItemDetail.transitCurrency === '$' ? 'NT$' : viewingItemDetail.transitCurrency || '¥'} ${viewingItemDetail.transitCost}` : ''}
                    </p>
                  </div>
                  {viewingItemDetail.transitDetails && (
                    <div className="text-xs text-sky-300 font-medium leading-relaxed break-words text-left pl-1">
                      <Markdown
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-semibold">
                              {children}
                            </a>
                          ),
                          p: ({ children }) => <p className="whitespace-pre-wrap min-h-[1.25em] my-1.5">{children}</p>,
                          h1: ({ children }) => <h1 className="text-sm font-extrabold text-white mt-3 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xs font-bold text-white mt-2.5 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-xs font-bold text-white mt-2 mb-0.5">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-xs font-semibold text-white mt-1.5 mb-0.5">{children}</h4>,
                          ul: ({ children }) => <ul className="list-disc list-inside pl-1 my-1.5 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside pl-1 my-1.5 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="my-0.5">{children}</li>
                        }}
                      >
                        {viewingItemDetail.transitDetails}
                      </Markdown>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#1e1e22] text-gray-500 text-center rounded-xl text-[11px] border border-white/5">
                無預排之交通方式。
              </div>
            )}

            {/* Direct CTA tools */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setViewingItemDetail(null);
                  setEditingItem(viewingItemDetail);
                }}
                className="flex-1 py-2.5 bg-[#1e1e22] hover:bg-[#2c2c31] text-white border border-white/5 font-bold text-xs rounded-xl transition"
              >
                編輯詳情路徑
              </button>

              <button
                type="button"
                onClick={() => setViewingItemDetail(null)}
                className="px-5 py-2.5 bg-[#A7C7E7] hover:bg-[#96b7d7] text-black font-bold text-xs rounded-xl transition shadow-md"
              >
                關閉並返回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General visual animations helper */}
      <style>{`
        /* Hide scrollbars but preserve mobile scrolling */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Slide/Fade entries */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.18s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

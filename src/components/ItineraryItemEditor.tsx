import React, { useState, useEffect } from 'react';
import { ItineraryItem, TransitMode } from '../types';
import { parseTimeToMinutes, formatMinutesToTime, generateMockTransitRoutes, makeGoogleMapsDirUrl } from '../utils';
import { X, MapPin, Clock, Check, ChevronRight, ChevronDown, Train, HelpCircle, Footprints, Bus, Car, Navigation, DollarSign, Save, Plane } from 'lucide-react';

interface ItineraryItemEditorProps {
  item: ItineraryItem;
  itineraryItems?: ItineraryItem[];
  tripDays?: { dateString: string; label: string; dayOfWeek: string; formattedDate: string }[];
  previousLocation: string | null;
  onSave: (updatedItem: ItineraryItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ItineraryItemEditor({
  item,
  itineraryItems = [],
  tripDays = [],
  previousLocation,
  onSave,
  onDelete,
  onClose
}: ItineraryItemEditorProps) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date);
  const [location, setLocation] = useState(item.location);
  const [startTime, setStartTime] = useState(formatMinutesToTime(item.startMinutes));
  const [endTime, setEndTime] = useState(formatMinutesToTime(item.endMinutes));
  const [isReserved, setIsReserved] = useState(item.isReserved);
  const [reservationTime, setReservationTime] = useState(item.reservationTime || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [isHotel, setIsHotel] = useState(item.isHotel || /飯店|酒店|旅館|民宿|住宿|Hotel|Hostel|Inn|B&B/i.test(item.title) || false);
  const [isCrossOvernight, setIsCrossOvernight] = useState(item.endMinutes > 1440);
  const [showMoreSettings, setShowMoreSettings] = useState(
    item.endMinutes > 1440 || !!item.isReserved || !!item.isHotel
  );
  const hasManuallyToggledCrossover = React.useRef(false);

  // Auto-detect cross-overnight if end time has been set earlier than start time
  // ONLY auto-enable to true when endTime is earlier than startTime (endMins < startMins)
  // NEVER auto-disable to false, in order to preserve existing overnight items or manual selections
  useEffect(() => {
    if (hasManuallyToggledCrossover.current) return;
    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);
    if (endMins > 0 && endMins < startMins) {
      setIsCrossOvernight(true);
    }
  }, [startTime, endTime]);

  // Auto-detect hotel keywords to suggest hotel status toggle
  useEffect(() => {
    if (!item.id.startsWith('demo_') && item.title !== title) {
      const hasHotel = /飯店|酒店|旅館|民宿|住宿|Hotel|Hostel|Inn|B&B/i.test(title);
      if (hasHotel) {
        setIsHotel(true);
      }
    }
  }, [title]);

  // Transit states
  const [transitMode, setTransitMode] = useState<TransitMode>(item.transitMode);
  const [transitCost, setTransitCost] = useState<number>(item.transitCost);
  const [transitCurrency, setTransitCurrency] = useState<string>(item.transitCurrency || '¥');
  const [transitDuration, setTransitDuration] = useState<number>(item.transitDuration);
  const [transitDetails, setTransitDetails] = useState<string>(item.transitDetails);
  const [mapsUrl, setMapsUrl] = useState<string>(item.googleMapsUrl || '');

  // Flight information sub-states
  const [flightNo, setFlightNo] = useState(() => {
    if (item.transitMode === 'flight' && item.transitDetails) {
      return item.transitDetails.split(' | ')[0] || '';
    }
    return '';
  });
  const [flightAirports, setFlightAirports] = useState(() => {
    if (item.transitMode === 'flight' && item.transitDetails) {
      return item.transitDetails.split(' | ')[1] || '';
    }
    return '';
  });
  const [flightGate, setFlightGate] = useState(() => {
    if (item.transitMode === 'flight' && item.transitDetails) {
      return item.transitDetails.split(' | ')[2] || '';
    }
    return '';
  });

  // Keep transitDetails synced for Flight Mode
  useEffect(() => {
    if (transitMode === 'flight') {
      const parts = [];
      if (flightNo.trim()) parts.push(flightNo.trim());
      if (flightAirports.trim()) parts.push(flightAirports.trim());
      if (flightGate.trim()) parts.push(flightGate.trim());
      setTransitDetails(parts.join(' | ') || '機場航班');
    }
  }, [transitMode, flightNo, flightAirports, flightGate]);

  // We need to compute the previous location dynamically based on selected date and start time
  const computedPreviousLocation = React.useMemo(() => {
    if (!itineraryItems || itineraryItems.length === 0 || !tripDays || tripDays.length === 0) {
      return previousLocation; // fallback
    }

    const startMins = parseTimeToMinutes(startTime);

    // 1. Get other items on the SELECTED date
    const dayItems = itineraryItems
      .filter(i => i.tripId === item.tripId && i.date === date && i.id !== item.id)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    // 2. Find the item that ends before the current selected start minutes
    let lastBefore: ItineraryItem | null = null;
    for (const i of dayItems) {
      if (i.endMinutes <= startMins) {
        if (!lastBefore || i.endMinutes > lastBefore.endMinutes) {
          lastBefore = i;
        }
      }
    }

    if (lastBefore && lastBefore.location) {
      return lastBefore.location;
    }

    // 3. Since there's no previous item on this day, check if we can use the previous day's check-in hotel
    const itemDateIndex = tripDays.findIndex(tab => tab.dateString === date);
    if (itemDateIndex > 0) {
      const checkDateStrings = tripDays.slice(0, itemDateIndex).map(tab => tab.dateString).reverse();
      for (const dateStr of checkDateStrings) {
        const hotelsOnDate = itineraryItems
          .filter(i => i.tripId === item.tripId && i.date === dateStr && i.id !== item.id && (i.isHotel || /飯店|酒店|旅館|民宿|住宿|Hotel|Hostel|Inn|B&B/i.test(i.title)))
          .sort((a, b) => b.startMinutes - a.startMinutes);

        if (hotelsOnDate.length > 0) {
          return hotelsOnDate[0].location || null;
        }
      }
    }

    return null;
  }, [itineraryItems, tripDays, date, startTime, item.tripId, item.id, previousLocation]);

  // Mock transit choices based on computedPreviousLocation and current location
  const transitOptions = computedPreviousLocation && location 
    ? generateMockTransitRoutes(computedPreviousLocation, location)
    : [];

  // Update Google Maps URL if either location or computedPreviousLocation updates
  useEffect(() => {
    if (computedPreviousLocation && location && transitMode !== 'flight') {
      const generatedUrl = makeGoogleMapsDirUrl(computedPreviousLocation, location);
      setMapsUrl(generatedUrl);
    } else {
      setMapsUrl('');
    }
  }, [computedPreviousLocation, location, transitMode]);

  const handleApplyTransitOption = (option: { mode: TransitMode; details: string; duration: number; cost: number }) => {
    setTransitMode(option.mode);
    setTransitDetails(option.details);
    setTransitDuration(option.duration);
    setTransitCost(option.cost);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startMins = parseTimeToMinutes(startTime);
    let endMins = parseTimeToMinutes(endTime);

    if (isCrossOvernight) {
      endMins = endMins + 1440;
    } else {
      // Auto fix if endMinutes <= startMinutes
      if (endMins <= startMins) {
        endMins = Math.min(1439, startMins + 60); // Default to 1 hour
      }
    }

    onSave({
      ...item,
      date,
      isUnscheduled: date === 'unscheduled',
      title: title.trim() || '未命名行程',
      location: location.trim(),
      startMinutes: startMins,
      endMinutes: endMins,
      isReserved,
      reservationTime: isReserved ? reservationTime : '',
      transitMode,
      transitCost: Number(transitCost) || 0,
      transitDuration: Number(transitDuration) || 0,
      transitDetails: transitMode !== 'none' ? transitDetails : '',
      transitCurrency: transitMode !== 'none' ? transitCurrency : '¥',
      googleMapsUrl: transitMode === 'flight' ? '' : (mapsUrl || item.googleMapsUrl),
      notes: notes.trim(),
      isHotel
    });
  };

  const cleanTransit = () => {
    setTransitMode('none');
    setTransitCost(0);
    setTransitDuration(0);
    setTransitDetails('');
  };

  // Get transit icon
  const getModeIcon = (mode: TransitMode) => {
    switch (mode) {
      case 'train': return <Train className="w-4 h-4 text-sky-400" />;
      case 'bus': return <Bus className="w-4 h-4 text-sky-400" />;
      case 'walk': return <Footprints className="w-4 h-4 text-sky-400" />;
      case 'taxi': return <Car className="w-4 h-4 text-sky-400" />;
      case 'transit': return <Navigation className="w-4 h-4 text-sky-400" />;
      case 'flight': return <Plane className="w-4 h-4 text-sky-400" />;
      default: return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div 
        className="bg-[#0c0c0e] border border-white/5 w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <h3 className="font-semibold text-lg text-white">編輯行程與路程</h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-gray-300">
          
          {/* 行程日期選擇 (Date Selection) */}
          {tripDays && tripDays.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="date-inp">
                行程日期
              </label>
              <select
                id="date-inp"
                className="w-full px-3 py-2.5 bg-[#121214] border border-white/10 rounded-lg text-white font-medium focus:outline-none focus:border-[#A7C7E7] focus:bg-[#121214] transition cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                {tripDays.map((day) => (
                  <option key={day.dateString} value={day.dateString} className="bg-[#0c0c0e]">
                    {day.dateString} ({day.dayOfWeek}) - {day.label}
                  </option>
                ))}
                <option value="unscheduled" className="bg-[#0c0c0e]">
                  📥 暫存行程 (尚未確定日期 / 移入暫存區)
                </option>
              </select>
            </div>
          )}

          {/* Card Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="title-inp">
              行程主題
            </label>
            <input
              id="title-inp"
              type="text"
              required
              className="w-full px-3 py-2.5 bg-[#121214] border border-white/10 rounded-lg text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:bg-[#121214] transition"
              placeholder="輸入行程名稱 (例如：淺草雷門、吉野家午餐)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Location Block */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="loc-inp">
              地點 / 地址
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                id="loc-inp"
                type="text"
                className="w-full pl-9 pr-3 py-2.5 bg-[#121214] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#A7C7E7] focus:bg-[#121214] transition"
                placeholder="地點名稱"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Time Picker */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                開始時間
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input
                  type="time"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#A7C7E7] focus:bg-[#121214]"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                結束時間
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input
                  type="time"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#A7C7E7] focus:bg-[#121214]"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              備註說明 (行程細節、注意事項)
            </label>
            <textarea
              className="w-full px-3 py-2 bg-[#121214] border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#A7C7E7] focus:bg-[#121214] transition"
              rows={2}
              placeholder="例如：入園門票須先拿好，推薦買草莓大幅。"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* collapsible More Settings fields */}
            <button
              type="button"
              onClick={() => setShowMoreSettings(!showMoreSettings)}
              className="flex items-center space-x-1.5 text-xs text-[#A7C7E7] hover:text-[#A7C7E7]/80 focus:outline-none transition select-none cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreSettings ? 'rotate-180' : ''}`} />
              <span className="font-semibold">{showMoreSettings ? '收闔' : '展開'} 更多設定 (跨夜/預約/住宿設定)</span>
            </button>

            {showMoreSettings && (
              <div className="mt-3.5 space-y-3.5 animate-fade-in">
                {/* Cross Overnight Option */}
                <div className="p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-2 text-left">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 text-indigo-400 focus:ring-indigo-400 bg-black/20"
                      checked={isCrossOvernight}
                      onChange={(e) => {
                        hasManuallyToggledCrossover.current = true;
                        setIsCrossOvernight(e.target.checked);
                      }}
                    />
                    <span className="text-sm font-semibold text-white">
                      此行程/交通跨夜 (時間跨越隔天)
                    </span>
                  </label>
                  {isCrossOvernight && (
                    <p className="text-[11px] text-indigo-400/80 leading-relaxed font-light pl-6.5">
                      💡 開啟後，結束時間將設定在隔日的 <span className="font-semibold text-[#A7C7E7] font-mono">{endTime}</span>。此行程將在今日深夜延續，並在明日日程前段 (00:00~{endTime}) 自動同步展示！
                    </p>
                  )}
                </div>

                {/* Reservation Card */}
                <div className="p-3.5 bg-[#A7C7E7]/5 rounded-xl border border-[#A7C7E7]/20 space-y-3">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 text-[#A7C7E7] focus:ring-[#A7C7E7] bg-black/20"
                      checked={isReserved}
                      onChange={(e) => setIsReserved(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-white">
                      此行程需要預約 / 已完成預約
                    </span>
                  </label>

                  {isReserved && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 animate-fade-in text-left">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#A7C7E7] mb-1">
                          預約報到時間
                        </label>
                        <input
                          type="text"
                          className="w-full px-2.5 py-1.5 bg-[#121214] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#A7C7E7]"
                          placeholder="例如 12:30 或 18:00"
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Hotel Designation Card */}
                <div className="p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/20 space-y-1.5 text-left">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 text-indigo-400 focus:ring-indigo-400 bg-black/20"
                      checked={isHotel}
                      onChange={(e) => setIsHotel(e.target.checked)}
                    />
                    <span className="text-sm font-semibold text-white">
                      住宿處
                    </span>
                  </label>
                </div>
              </div>
            )}

          {/* Transit and Routing Section & Google Maps integration */}
          <div className="border-t border-white/5 pt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center space-x-1.5">
                <span>--前往此地的交通工具--</span>
              </h4>
              {computedPreviousLocation ? (
                <span className="text-xs text-gray-300 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
                  起點: {computedPreviousLocation}
                </span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/10 px-2.5 py-1 rounded-full">
                  當前無起點
                </span>
              )}
            </div>

            {/* Main Interactive Configuration area */}
            {(computedPreviousLocation || transitMode !== 'none') ? (
              <div className="space-y-3 bg-[#121214] p-3.5 rounded-xl border border-white/5">
                {transitMode === 'flight' ? (
                  /* Flight Input Mode */
                  <div className="space-y-3.5">
                    <div className="p-3 bg-sky-500/5 text-sky-300 border border-sky-500/20 rounded-xl flex items-center space-x-2.5 text-xs">
                      <Plane className="w-5 h-5 text-sky-400 animate-pulse" />
                      <div>
                        <p className="font-bold">啟用「航班」模式</p>
                        <p className="text-[10px] text-gray-400 font-light mt-0.5">此模式不帶入 Google Map 路線資訊，您可以填寫班機詳情。</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          航空公司與航班編號
                        </label>
                        <input
                          type="text"
                          className="w-full p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#A7C7E7]"
                          placeholder="例如：長榮航空 BR198"
                          value={flightNo}
                          onChange={(e) => setFlightNo(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          機場與航線 (起飛 ➔ 降落)
                        </label>
                        <input
                          type="text"
                          className="w-full p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#A7C7E7]"
                          placeholder="例如：桃園 TPE ➔ 成田 NRT"
                          value={flightAirports}
                          onChange={(e) => setFlightAirports(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          登機門 / 航廈
                        </label>
                        <input
                          type="text"
                          className="w-full p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#A7C7E7]"
                          placeholder="例如：T2 - Gate C1"
                          value={flightGate}
                          onChange={(e) => setFlightGate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          航程耗時 (分鐘)
                        </label>
                        <input
                          type="number"
                          className="w-full p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white placeholder-gray-600"
                          placeholder="例如：210"
                          value={transitDuration || ''}
                          onChange={(e) => setTransitDuration(Number(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          預估票價
                        </label>
                        <div className="relative flex items-center">
                          <button
                            type="button"
                            onClick={() => setTransitCurrency(prev => prev === '¥' ? '$' : '¥')}
                            className="absolute left-2 top-2 h-5 w-5 flex items-center justify-center font-bold text-[13px] text-[#A7C7E7] hover:text-white hover:bg-white/10 rounded transition select-none cursor-pointer"
                            title="點選切換幣別 (日幣 ¥ / 台幣 $)"
                          >
                            {transitCurrency}
                          </button>
                          <input
                            type="number"
                            className="w-full pl-7 pr-1 p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white"
                            placeholder="機票"
                            value={transitCost || ''}
                            onChange={(e) => setTransitCost(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        更換交通模式
                      </label>
                      <select
                        className="w-full p-2 bg-[#1e1e22] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-[#A7C7E7]"
                        value={transitMode}
                        onChange={(e) => setTransitMode(e.target.value as TransitMode)}
                      >
                        <optgroup label="陸地交通">
                          <option value="none">🚫 無 (不顯示路程)</option>
                          <option value="train">🚇 電車/地下鐵/JR/新幹線</option>
                          <option value="bus">🚌 公車 / 客運</option>
                          <option value="walk">🚶 步行</option>
                          <option value="taxi">🚖 計程車 / 開車</option>
                        </optgroup>
                        <optgroup label="搭乘飛機">
                          <option value="flight">✈️ 機場航班 (飛機)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="p-2.5 bg-white/5 border border-white/5 rounded-lg text-left">
                      <p className="text-[10px] text-[#A7C7E7] font-semibold mb-0.5">預覽輸出成果：</p>
                      <p className="text-xs font-mono text-gray-300">
                        {transitDetails || "未輸入完整航班資訊"}
                        {transitCost && transitCost >= 1 ? ` | ${transitCurrency}${transitCost}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Standard Land Transit - Let user input details directly */
                  <div className="space-y-3">
                    {/* Customized Transit Edit */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            自訂交通方式
                          </label>
                          <select
                            className="w-full p-2 bg-[#121214] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-[#A7C7E7]"
                            value={transitMode}
                            onChange={(e) => setTransitMode(e.target.value as TransitMode)}
                          >
                            <optgroup label="陸地交通">
                              <option value="none">🚫 無 (不顯示路程)</option>
                              <option value="train">🚇 電車/地下鐵/JR/新幹線</option>
                              <option value="bus">🚌 公車 / 客運</option>
                              <option value="walk">🚶 步行</option>
                              <option value="taxi">🚖 計程車 / 開車</option>
                            </optgroup>
                            <optgroup label="搭乘飛機">
                              <option value="flight">✈️ 機場航班 (飛機)</option>
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            交通費用
                          </label>
                          <div className="relative flex items-center">
                            <button
                              type="button"
                              onClick={() => setTransitCurrency(prev => prev === '¥' ? '$' : '¥')}
                              className="absolute left-1.5 top-1.5 h-5 w-5 flex items-center justify-center font-bold text-[13px] text-[#A7C7E7] hover:text-white hover:bg-white/10 rounded transition select-none cursor-pointer"
                              title="點選切換幣別 (日幣 ¥ / 台幣 $)"
                            >
                              {transitCurrency}
                            </button>
                            <input
                              type="number"
                              className="w-full pl-7 pr-2 p-1.5 bg-[#121214] border border-white/10 rounded text-xs text-white"
                              placeholder="例如 210"
                              value={transitCost || ''}
                              onChange={(e) => setTransitCost(Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            時間估計 (分鐘)
                          </label>
                          <input
                            type="number"
                            className="w-full p-1.5 bg-[#121214] border border-white/10 rounded text-xs text-white"
                            placeholder="乘車時間 (分鐘)"
                            value={transitDuration || ''}
                            onChange={(e) => setTransitDuration(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            路程詳情 (支援換行與詳細分類)
                          </label>
                          <textarea
                            rows={3}
                            className="w-full p-2 bg-[#121214] border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#A7C7E7] resize-y leading-relaxed"
                            placeholder="例如：&#10;1. 步行至 XXX 站 (約 5 分鐘)&#10;2. 搭乘日比谷線至築地站&#10;3. A1 出口步行 3 分鐘抵達"
                            value={transitDetails}
                            onChange={(e) => setTransitDetails(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Google Maps link preview */}
                      {mapsUrl && (
                        <div className="mt-2 text-[11px] text-gray-400 break-all bg-[#A7C7E7]/5 p-2 rounded border border-[#A7C7E7]/20 text-left">
                          <span className="font-semibold text-[#A7C7E7]">Google Map 路線網址:</span>
                          <a 
                            href={mapsUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="block text-[#A7C7E7] hover:underline truncate mt-1"
                          >
                            {mapsUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t border-white/5 pt-2">
                  <button
                    type="button"
                    onClick={cleanTransit}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition"
                  >
                    清除交通安排
                  </button>
                </div>
              </div>
            ) : (
              /* If no starting location but the user wants to add flight or transport */
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 text-left flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-gray-300">規劃交通方式</h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">選擇航班或設定交通方式。</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setTransitMode('flight')}
                    className="px-3 py-1.5 bg-[#A7C7E7]/10 hover:bg-[#A7C7E7]/20 border border-[#A7C7E7]/20 text-[#A7C7E7] rounded-lg text-[11px] font-bold transition select-none cursor-pointer"
                  >
                    設定航班
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransitMode('transit')}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/5 text-white rounded-lg text-[11px] font-bold transition select-none cursor-pointer"
                  >
                    設定地面交通
                  </button>
                </div>
              </div>
            )}
          </div>

        </form>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between bg-[#121214]">
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="px-3.5 py-2 bg-red-500/10 border border-red-500/20 text-red-450 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition"
          >
            刪除行程
          </button>

          <div className="flex space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/5 border border-white/5 text-gray-300 rounded-lg text-sm font-semibold transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              className="px-4.5 py-2 bg-[#A7C7E7] hover:bg-[#96b7d7] text-black rounded-lg text-sm font-bold flex items-center space-x-1.5 transition shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>儲存變更</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

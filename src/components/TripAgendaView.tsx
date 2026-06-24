import React, { useEffect } from 'react';
import { Trip, ItineraryItem, DayTab } from '../types';
import { formatMinutesToTime } from '../utils';
import { MapPin, Map, Check, Trash2, Calendar, Clipboard, Compass, ExternalLink, Ticket, Coins, Clock } from 'lucide-react';

interface TripAgendaViewProps {
  trip: Trip;
  dayTabs: DayTab[];
  items: ItineraryItem[];
  onItemClick: (item: ItineraryItem) => void;
  onTransitClick?: (item: ItineraryItem) => void;
  colorPreset: string;
  activeDate?: string;
}

export default function TripAgendaView({
  trip,
  dayTabs,
  items,
  onItemClick,
  onTransitClick,
  colorPreset,
  activeDate
}: TripAgendaViewProps) {

  // Auto scroll to activeDate day section when activeDate changes or on view mount
  useEffect(() => {
    if (activeDate) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`agenda-day-${activeDate}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeDate]);
  
  // Calculate total expense
  const totalYen = items.filter(item => (item.transitCurrency || '¥') === '¥' && item.transitCost !== undefined && item.transitCost !== null && item.transitCost >= 0).reduce((sum, item) => sum + (item.transitCost || 0), 0);
  const totalNT = items.filter(item => item.transitCurrency === '$' && item.transitCost !== undefined && item.transitCost !== null && item.transitCost >= 0).reduce((sum, item) => sum + (item.transitCost || 0), 0);
  const totalReservedCount = items.filter(i => i.isReserved).length;

  const getThemeText = (preset: string) => {
    switch (preset) {
      case 'emerald': return 'text-emerald-400';
      case 'amber': return 'text-amber-400';
      case 'orange': return 'text-orange-400';
      case 'rose': return 'text-rose-400';
      default: return 'text-[#A7C7E7]';
    }
  };

  const getThemeBg = (preset: string) => {
    switch (preset) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'amber': return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'orange': return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      case 'rose': return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      default: return 'bg-[#A7C7E7]/15 text-[#A7C7E7] border-[#A7C7E7]/20';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 pb-12 animate-fade-in text-[#e0e0e0]">

      {/* Main Days Agenda */}
      <div className="space-y-6">
        {dayTabs.map((day, dIdx) => {
          const dayItems = items
            .filter((item) => {
              if (item.date === day.dateString) return true;
              if (item.endMinutes > 1440 && dIdx > 0) {
                const prevDay = dayTabs[dIdx - 1];
                if (item.date === prevDay.dateString) return true;
              }
              return false;
            })
            .sort((a, b) => {
              const aStart = a.date === day.dateString ? a.startMinutes : 0;
              const bStart = b.date === day.dateString ? b.startMinutes : 0;
              return aStart - bStart;
            });

          const tomorrowDateStr = dayTabs[dIdx + 1]?.dateString;
          const tomorrowItemsWithCrossTransit = tomorrowDateStr
            ? items.filter((item) => {
                return (
                  item.tripId === trip.id &&
                  item.date === tomorrowDateStr &&
                  item.transitMode !== 'none' &&
                  (item.transitDuration || 0) > 0 &&
                  item.startMinutes - (item.transitDuration || 0) < 0
                );
              })
            : [];

          return (
            <div key={day.dateString} id={`agenda-day-${day.dateString}`} className="space-y-3">
              {/* Day title label */}
              <div className="flex items-center space-x-3 sticky top-0 bg-[#0a0a0c]/90 py-2.5 backdrop-blur-xs z-10 font-bold">
                <span className={`px-3 py-1 font-extrabold text-xs rounded-full uppercase border ${getThemeBg(colorPreset)}`}>
                  {day.label}
                </span>
                <span className="text-sm font-semibold text-white">
                  {day.formattedDate} ({day.dayOfWeek})
                </span>
                <span className="h-px bg-white/10 flex-1 ml-2" />
              </div>

              {/* Day items lists */}
              {dayItems.length === 0 && tomorrowItemsWithCrossTransit.length === 0 ? (
                <div className="text-center p-6 bg-[#121214] rounded-xl border border-dashed border-white/5 text-[#8a8a8e] text-xs">
                  本日尚無行程規劃。回到 Calendar 點點看，新增一些好玩的行程吧！
                </div>
              ) : (
                <div className="space-y-6 pl-4 border-l-2 border-white/10 relative ml-2">
                  {dayItems.map((item, idx) => {
                    const nextItem = dayItems[idx + 1];
                    const isContinuedFromYesterday = item.date !== day.dateString;

                    // Compute transit cross-overnight suppression
                    const duration = item.transitDuration || 0;
                    const transitStartsYesterday = item.transitMode !== 'none' && duration > 0 && item.startMinutes - duration < 0;
                    const shouldSuppressTransit = transitStartsYesterday && dIdx > 0;

                    return (
                      <div key={item.id} className="space-y-4 relative">
                        {/* Timeline node dot for the event */}
                        <div className={`absolute left-[-17px] top-6 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0c] z-20 ${
                          isContinuedFromYesterday 
                            ? 'bg-indigo-400' 
                            : 'bg-[#A7C7E7]'
                        }`} />

                        {/* Transit section info shown in agenda road list BEFORE agenda card */}
                        {item.transitMode !== 'none' && !shouldSuppressTransit && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              onTransitClick?.(item);
                            }}
                            className="relative pl-2 pr-3 py-2.5 hover:bg-white/2 transition rounded-xl text-xs text-left cursor-pointer duration-150 group/transit"
                          >
                            {/* Accent timeline rail for transit */}
                            <div className="absolute left-[-17px] -translate-x-1/2 top-0 bottom-0 w-[2px] bg-sky-500/30 group-hover/transit:bg-sky-500/50 z-10" />
                            
                            {/* Transit bubble */}
                            <div className="absolute left-[-17px] -translate-x-1/2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0a0a0c] border border-sky-500/30 flex items-center justify-center text-[11px] shadow-sm z-20 transition group-hover/transit:border-sky-500/50">
                              {item.transitMode === 'train' && '🚇'}
                              {item.transitMode === 'bus' && '🚌'}
                              {item.transitMode === 'walk' && '🚶'}
                              {item.transitMode === 'taxi' && '🚖'}
                              {item.transitMode === 'flight' && '✈️'}
                              {item.transitMode === 'transit' && '🚇'}
                            </div>

                            {(() => {
                              const lines = (item.transitDetails || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
                              const transitTitle = lines.length > 0 ? lines[0] : (idx > 0 ? `${dayItems[idx - 1].title} ➔ ${item.title}` : `前往 ${item.title}`);
                              const remainingDetails = lines.slice(1).join('\n');

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5 text-sky-300">
                                      <span className="font-bold text-white/95 text-xs sm:text-sm">
                                        {transitTitle}
                                      </span>
                                      <span className="text-sky-400/80 font-semibold text-[10px] bg-sky-500/10 px-1.5 py-0.5 rounded shrink-0">
                                        {item.transitDuration} 分鐘
                                      </span>
                                    </div>

                                    {item.transitCost !== undefined && item.transitCost !== null && item.transitCost >= 1 && (
                                      <div className="flex items-center space-x-1.5 font-semibold text-sky-300 shrink-0 text-xs">
                                        <span>{(item.transitCurrency === '$' ? 'NT$' : item.transitCurrency || '¥')} {item.transitCost}</span>
                                        {item.googleMapsUrl && (
                                          <a
                                            href={item.googleMapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1 hover:bg-white/10 rounded transition text-sky-400"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {remainingDetails && (
                                    <div className="mt-1 text-[11px] text-[#a1a1aa] leading-relaxed break-words font-normal whitespace-pre-wrap pl-1 text-left">
                                      {remainingDetails}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Event list card */}
                        <div 
                          onClick={() => onItemClick(item)}
                          className={`p-4 rounded-xl border shadow-3xs cursor-pointer hover:shadow-xs transition duration-150 relative overflow-hidden group text-left ${
                            isContinuedFromYesterday 
                              ? 'bg-gradient-to-r from-indigo-500/5 to-transparent border-indigo-500/10 hover:border-indigo-500/20' 
                              : 'bg-[#121214] border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              {/* Time and category */}
                              <div className="flex items-center space-x-2 text-xs font-semibold text-white/50 tracking-wide">
                                <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                {isContinuedFromYesterday ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-sans font-bold">跨夜延續</span>
                                    <span>{formatMinutesToTime(item.startMinutes)} - {formatMinutesToTime(item.endMinutes, true)}</span>
                                  </span>
                                ) : (
                                  <span>{formatMinutesToTime(item.startMinutes)} - {formatMinutesToTime(item.endMinutes, true)}</span>
                                )}
                              </div>

                              {/* Title */}
                              <h4 className="font-bold text-white text-base sm:text-lg group-hover:text-[#A7C7E7] transition-colors duration-150 tracking-tight leading-snug">
                                {item.title}
                              </h4>
                              
                              {/* Location */}
                              {item.location && (
                                <p className="text-xs text-white/60 font-medium flex items-center mt-1">
                                  <MapPin className="w-3.5 h-3.5 text-gray-500 mr-1 shrink-0" />
                                  <span>{item.location}</span>
                                </p>
                              )}
                            </div>

                            {/* Reserv button */}
                            {item.isReserved && (
                              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-3xs flex items-center space-x-1.5 shrink-0">
                                <Ticket className="w-3.5 h-3.5" />
                                <span>已預約 {item.reservationTime}</span>
                              </span>
                            )}
                          </div>

                          {/* Notes summary (No box, no border - Indented with low saturation text) */}
                          {item.notes && (
                            <div className="mt-2.5 pl-3 border-l-2 border-white/10 text-[11px] text-gray-400 leading-relaxed font-light">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Render Cross-overnight Transits from Next Day on the Active (Previous) Day */}
                  {tomorrowItemsWithCrossTransit.map((tomorrowItem) => {
                    const duration = tomorrowItem.transitDuration || 0;
                    const transitStartMinsToday = 1440 + (tomorrowItem.startMinutes - duration);
                    
                    return (
                      <div 
                        key={`cross-transit-agenda-${tomorrowItem.id}`}
                        onClick={() => onTransitClick?.(tomorrowItem)}
                        className="relative pl-2 pr-3 py-3 hover:bg-white/2 transition rounded-xl text-xs text-left cursor-pointer duration-150 group/transit"
                      >
                        {/* Accent timeline rail for cross-overnight transit */}
                        <div className="absolute left-[-17px] -translate-x-1/2 top-0 bottom-0 w-[2px] bg-indigo-500/30 group-hover/transit:bg-indigo-500/50 z-10" />
                        
                        {/* Transit bubble */}
                        <div className="absolute left-[-17px] -translate-x-1/2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0a0a0c] border border-indigo-500/30 flex items-center justify-center text-[11px] shadow-sm z-20 transition group-hover/transit:border-indigo-500/50">
                          {tomorrowItem.transitMode === 'train' && '🚇'}
                          {tomorrowItem.transitMode === 'bus' && '🚌'}
                          {tomorrowItem.transitMode === 'walk' && '🚶'}
                          {tomorrowItem.transitMode === 'taxi' && '🚖'}
                          {tomorrowItem.transitMode === 'flight' && '✈️'}
                          {tomorrowItem.transitMode === 'transit' && '🚇'}
                        </div>

                        {(() => {
                          const lines = (tomorrowItem.transitDetails || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
                          const transitTitle = lines.length > 0 ? lines[0] : (tomorrowItem.location ? `${tomorrowItem.location} ➔ ${tomorrowItem.title}` : `前往 ${tomorrowItem.title}`);
                          const remainingDetails = lines.slice(1).join('\n');

                          return (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-sans font-bold shrink-0">
                                      跨夜至隔日
                                    </span>
                                    <span className="font-bold text-white/95 text-xs sm:text-sm">
                                      {transitTitle}
                                    </span>
                                    <span className="text-indigo-400/80 font-semibold text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                                      {duration} 分鐘
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-light mt-0.5">
                                    預計於 {formatMinutesToTime(transitStartMinsToday)} 出發，隔日 {formatMinutesToTime(tomorrowItem.startMinutes)} 抵達
                                  </p>
                                </div>

                                {tomorrowItem.transitCost !== undefined && tomorrowItem.transitCost !== null && tomorrowItem.transitCost >= 1 && (
                                  <div className="flex items-center space-x-1.5 font-bold text-indigo-300 shrink-0 text-xs">
                                    <span>{(tomorrowItem.transitCurrency === '$' ? 'NT$' : tomorrowItem.transitCurrency || '¥')} {tomorrowItem.transitCost}</span>
                                    {tomorrowItem.googleMapsUrl && (
                                      <a
                                        href={tomorrowItem.googleMapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 hover:bg-white/10 rounded transition text-indigo-400"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              {remainingDetails && (
                                <div className="mt-1 text-[11px] text-[#a1a1aa] leading-relaxed break-words font-normal whitespace-pre-wrap pl-1 text-left w-full">
                                  {remainingDetails}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { ItineraryItem, TransitMode } from '../types';
import { formatMinutesToTime } from '../utils';
import { MapPin, Clock, Train, Bus, Car, Footprints, Navigation, CheckCircle2, AlertTriangle, Heart, HelpCircle, ExternalLink, Plane, Inbox } from 'lucide-react';

interface CalendarGridProps {
  items: ItineraryItem[]; // already filtered for the current date
  activeDate?: string;
  nextDayTransitItems?: ItineraryItem[];
  onItemClick: (item: ItineraryItem) => void;
  onTransitClick?: (item: ItineraryItem) => void;
  onItemTimeUpdate: (id: string, startMins: number, endMins: number) => void;
  onAddAtTime: (startMins: number) => void;
  colorPreset: string;
  onMoveToUnscheduled?: (itemId: string) => void;
  onDropUnscheduledItem?: (itemId: string, startMins: number) => void;
}

const HOUR_HEIGHT = 60; // 60px per hour means 1px = 1 minute!
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarGrid({
  items,
  activeDate,
  nextDayTransitItems = [],
  onItemClick,
  onTransitClick,
  onItemTimeUpdate,
  onAddAtTime,
  colorPreset,
  onMoveToUnscheduled,
  onDropUnscheduledItem
}: CalendarGridProps) {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const ignoreNextClickRef = useRef<boolean>(false);

  // Drag / Resize gesture states
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'drag' | 'resize-top' | 'resize-bottom' | null>(null);
  const [initialItemValue, setInitialItemValue] = useState<{ startMins: number; endMins: number; title: string } | null>(null);
  const [pointerStartY, setPointerStartY] = useState<number>(0);
  const [currentDeltaMinutes, setCurrentDeltaMinutes] = useState<number>(0);
  const [longPressAlert, setLongPressAlert] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dragHoverInfo, setDragHoverInfo] = useState<{ startMins: number; duration: number; title: string } | null>(null);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for tracking global window pointer events reliably
  const activeItemIdRef = useRef<string | null>(null);
  activeItemIdRef.current = activeItemId;

  const activeActionRef = useRef<'drag' | 'resize-top' | 'resize-bottom' | null>(null);
  activeActionRef.current = activeAction;

  const initialItemValueRef = useRef<{ startMins: number; endMins: number; title: string } | null>(null);
  initialItemValueRef.current = initialItemValue;

  const pointerStartYRef = useRef<number>(0);
  pointerStartYRef.current = pointerStartY;

  const currentDeltaRef = useRef<number>(0);

  // Global window listeners so pointer release anywhere on screen properly updates item time and clears drag state
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (holdTimerRef.current && !activeActionRef.current) {
        const distY = Math.abs(e.pageY - pointerStartYRef.current);
        if (distY > 8) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
      }

      if (!activeItemIdRef.current || !activeActionRef.current || !initialItemValueRef.current) return;

      const deltaY = e.pageY - pointerStartYRef.current;
      let deltaMins = Math.round(deltaY);
      deltaMins = Math.round(deltaMins / 15) * 15;

      if (deltaMins !== 0) {
        ignoreNextClickRef.current = true;
      }

      currentDeltaRef.current = deltaMins;
      setCurrentDeltaMinutes(deltaMins);
    };

    const handleGlobalPointerEnd = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (activeItemIdRef.current && activeActionRef.current && initialItemValueRef.current) {
        let finalStart = initialItemValueRef.current.startMins;
        let finalEnd = initialItemValueRef.current.endMins;

        if (activeActionRef.current === 'drag') {
          const duration = initialItemValueRef.current.endMins - initialItemValueRef.current.startMins;
          finalStart = Math.max(0, Math.min(1440 - duration, initialItemValueRef.current.startMins + currentDeltaRef.current));
          finalEnd = finalStart + duration;
        } else if (activeActionRef.current === 'resize-top') {
          finalStart = Math.max(0, Math.min(initialItemValueRef.current.endMins - 15, initialItemValueRef.current.startMins + currentDeltaRef.current));
        } else if (activeActionRef.current === 'resize-bottom') {
          finalEnd = Math.min(1440, Math.max(initialItemValueRef.current.startMins + 15, initialItemValueRef.current.endMins + currentDeltaRef.current));
        }

        onItemTimeUpdate(activeItemIdRef.current, finalStart, finalEnd);
        ignoreNextClickRef.current = true;
      }

      setActiveItemId(null);
      setActiveAction(null);
      setInitialItemValue(null);
      setCurrentDeltaMinutes(0);
      currentDeltaRef.current = 0;
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);
    window.addEventListener('dragend', handleGlobalPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
      window.removeEventListener('dragend', handleGlobalPointerEnd);
    };
  }, [onItemTimeUpdate]);

  // Detect mobile/tablet screen & touch input to prevent drag scroll collision
  useEffect(() => {
    const checkMobile = () => {
      // ONLY classify true small screen mobile viewports (< 768px) as "mobile" for layout/hints
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const [now, setNow] = useState(new Date());

  // Update current time state every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Auto scroll to current time if activeDate is today on load
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;

    if (activeDate === todayStr && gridContainerRef.current) {
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      const containerHeight = gridContainerRef.current.clientHeight || 400;
      const targetScrollTop = Math.max(0, currentMinutes - containerHeight / 3);
      
      const timer = setTimeout(() => {
        if (gridContainerRef.current) {
          gridContainerRef.current.scrollTop = targetScrollTop;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeDate]);

  // Sort items by start minutes to display correctly and perform gaps travel logic
  const sortedItems = [...items].sort((a, b) => a.startMinutes - b.startMinutes);

  // Convert ColorPreset class to tailwind values
  const getPaletteTheme = (preset: string) => {
    switch (preset) {
      case 'emerald': return { bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', accentBg: 'bg-emerald-500', hoverBg: 'hover:bg-emerald-500/25' };
      case 'amber': return { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', accentBg: 'bg-amber-500', hoverBg: 'hover:bg-amber-500/25' };
      case 'orange': return { bg: 'bg-orange-500/10 text-orange-300 border-orange-500/20', accentBg: 'bg-orange-500', hoverBg: 'hover:bg-orange-500/25' };
      case 'rose': return { bg: 'bg-rose-500/10 text-rose-300 border-rose-500/20', accentBg: 'bg-rose-500', hoverBg: 'hover:bg-rose-500/25' };
      default: return { bg: 'bg-[#A7C7E7]/10 text-[#A7C7E7] border-[#A7C7E7]/20', accentBg: 'bg-[#A7C7E7]', hoverBg: 'hover:bg-[#A7C7E7]/25' };
    }
  };

  const themeColors = getPaletteTheme(colorPreset);

  const getTransitIcon = (mode: TransitMode) => {
    switch (mode) {
      case 'train': return <Train className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      case 'bus': return <Bus className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      case 'walk': return <Footprints className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      case 'taxi': return <Car className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      case 'transit': return <Train className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      case 'flight': return <Plane className="w-3.5 h-3.5 text-sky-400 sm:w-4 sm:h-4" />;
      default: return null;
    }
  };

  // Click on empty grid background space
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger if clicking exactly the grid background, to avoid clicking events
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('grid-slot-bg')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      // Calculate minutes
      const clickedMins = Math.floor(relativeY);
      // Snap to 30 mins
      const snappedMins = Math.round(clickedMins / 30) * 30;
      onAddAtTime(snappedMins);
    }
  };

  // Pointer Down handler on an itinerary card
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>, 
    item: ItineraryItem, 
    actionType: 'drag' | 'resize-top' | 'resize-bottom'
  ) => {
    e.stopPropagation();

    // Disable dragging/resizing on actual touch input to prevent touch scrolling conflicts
    if (e.pointerType === 'touch') return;

    // Disable dragging/resizing on items continued from yesterday or cross-overnight items
    const isContinuedFromYesterday = activeDate && item.date !== activeDate;
    const isCrossOvernightItem = item.endMinutes > 1440;
    if (isContinuedFromYesterday || isCrossOvernightItem) return;

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    const startY = e.pageY;
    setPointerStartY(startY);
    setInitialItemValue({
      startMins: item.startMinutes,
      endMins: item.endMinutes,
      title: item.title
    });
    setCurrentDeltaMinutes(0);

    if (actionType === 'resize-top' || actionType === 'resize-bottom') {
      e.preventDefault();
      // Immediate action - set pointer capture for smooth vertical edge resizing
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
      setActiveItemId(item.id);
      setActiveAction(actionType);
      ignoreNextClickRef.current = true;
    } else {
      // For standard 'drag', don't lock pointer capture immediately so HTML5 native drag to UnscheduledPanel can fire
      const targetElem = e.currentTarget;
      const pointerId = e.pointerId;

      ignoreNextClickRef.current = false;

      // Long-press timer for in-calendar vertical repositioning
      holdTimerRef.current = setTimeout(() => {
        try {
          targetElem.setPointerCapture(pointerId);
        } catch (err) {}
        setActiveItemId(item.id);
        setActiveAction(actionType);
        ignoreNextClickRef.current = true;
        
        // Visual feedback
        setLongPressAlert(`長按成功：已抓住「${item.title}」`);
        setTimeout(() => setLongPressAlert(null), 2000);

        // Trigger standard mobile vibration if supported
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(30);
        }
      }, 400); // 400ms long press threshold
    }
  };

  // Pointer Move handler
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current && !activeAction) {
      // If we are waiting for long press but pointer moved too much, cancel the press!
      // This is crucial so mobile users can still scroll up and down the calendar scroll container smoothly!
      const distY = Math.abs(e.pageY - pointerStartY);
      if (distY > 8) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }

    if (!activeItemId || !activeAction || !initialItemValue) return;
    
    e.stopPropagation();

    const deltaY = e.pageY - pointerStartY;
    // 1px = 1 minute because HOUR_HEIGHT = 60
    let deltaMins = Math.round(deltaY);

    // Snap to 15-minute segments for ease of planning
    deltaMins = Math.round(deltaMins / 15) * 15;
    
    if (deltaMins !== 0) {
      ignoreNextClickRef.current = true;
    }
    
    setCurrentDeltaMinutes(deltaMins);
  };

  // Pointer Up/Cancel handler (handles end of gestures)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (activeItemId && activeAction && initialItemValue) {
      // Finalize the position
      let finalStart = initialItemValue.startMins;
      let finalEnd = initialItemValue.endMins;

      if (activeAction === 'drag') {
        finalStart = Math.max(0, Math.min(1440 - (initialItemValue.endMins - initialItemValue.startMins), initialItemValue.startMins + currentDeltaMinutes));
        finalEnd = finalStart + (initialItemValue.endMins - initialItemValue.startMins);
      } else if (activeAction === 'resize-top') {
        finalStart = Math.max(0, Math.min(initialItemValue.endMins - 15, initialItemValue.startMins + currentDeltaMinutes));
      } else if (activeAction === 'resize-bottom') {
        finalEnd = Math.min(1440, Math.max(initialItemValue.startMins + 15, initialItemValue.endMins + currentDeltaMinutes));
      }

      onItemTimeUpdate(activeItemId, finalStart, finalEnd);
      ignoreNextClickRef.current = true;
    }

    setActiveItemId(null);
    setActiveAction(null);
    setInitialItemValue(null);
    setCurrentDeltaMinutes(0);
  };

  const isToday = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    return activeDate === `${year}-${month}-${date}`;
  })();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Calculate dynamic positions for all items
  const renderedItems = items.map((item) => {
    const isEventDragging = activeItemId === item.id;
    const isContinuedFromYesterday = activeDate && item.date !== activeDate;
    const isCrossOvernightItem = item.endMinutes > 1440;
    
    let displayStart = isContinuedFromYesterday ? 0 : item.startMinutes;
    let displayEnd = isContinuedFromYesterday 
      ? Math.min(1440, item.endMinutes - 1440) 
      : Math.min(1440, item.endMinutes);

    if (isEventDragging && activeAction) {
      if (activeAction === 'drag') {
        const duration = item.endMinutes - item.startMinutes;
        displayStart = Math.max(0, Math.min(1440 - duration, item.startMinutes + currentDeltaMinutes));
        displayEnd = displayStart + duration;
      } else if (activeAction === 'resize-top') {
        displayStart = Math.max(0, Math.min(item.endMinutes - 15, item.startMinutes + currentDeltaMinutes));
      } else if (activeAction === 'resize-bottom') {
        displayEnd = Math.min(1440, Math.max(item.startMinutes + 15, item.endMinutes + currentDeltaMinutes));
      }
    }

    const cardTop = displayStart;
    const cardHeight = Math.max(25, displayEnd - displayStart);

    return {
      item,
      id: item.id,
      start: displayStart,
      end: displayEnd,
      cardTop,
      cardHeight,
      isContinuedFromYesterday,
      isCrossOvernightItem,
      isEventDragging
    };
  });

  const layoutMap: Record<string, { colIndex: number; colCount: number }> = {};

  if (renderedItems.length > 0) {
    const sortedRendered = [...renderedItems].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end;
    });

    const clusters: Array<typeof sortedRendered> = [];
    let currentCluster: typeof sortedRendered = [];
    let maxEnd = 0;

    for (const ri of sortedRendered) {
      if (currentCluster.length > 0 && ri.start >= maxEnd) {
        clusters.push(currentCluster);
        currentCluster = [ri];
        maxEnd = ri.end;
      } else {
        currentCluster.push(ri);
        maxEnd = Math.max(maxEnd, ri.end);
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    for (const cluster of clusters) {
      const columns: Array<string[]> = []; // stores item IDs in each column
      const itemColIndices: Record<string, number> = {};

      for (const ri of cluster) {
        let colIndex = -1;
        for (let c = 0; c < columns.length; c++) {
          const colItemIds = columns[c];
          const lastItemId = colItemIds[colItemIds.length - 1];
          const lastItemRendered = renderedItems.find(item => item.id === lastItemId);
          
          if (lastItemRendered && ri.start >= lastItemRendered.end) {
            colItemIds.push(ri.id);
            colIndex = c;
            break;
          }
        }
        if (colIndex === -1) {
          colIndex = columns.length;
          columns.push([ri.id]);
        }
        itemColIndices[ri.id] = colIndex;
      }

      const colCount = columns.length;
      for (const ri of cluster) {
        layoutMap[ri.id] = {
          colIndex: itemColIndices[ri.id],
          colCount: colCount
        };
      }
    }
  }

  return (
    <div className="relative border border-white/5 rounded-2xl bg-[#121214] shadow-xs overflow-hidden flex flex-col h-[75vh]">
      
      {/* Dynamic Floating Toast Feedback for Long-Press Success */}
      {longPressAlert && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-[#A7C7E7] text-black text-xs py-1.5 px-3.5 rounded-full shadow-lg z-30 font-bold animate-bounce flex items-center space-x-1.5 border border-[#A7C7E7]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
          <span>{longPressAlert}</span>
        </div>
      )}

      {/* Guide Banner */}
      <div className="bg-[#1e1e22]/80 px-4 py-2 border-b border-white/5 flex items-center justify-between text-[11px] text-gray-400">
        <span className="flex items-center">
          {isMobile ? (
            <>
              📱 <strong className="ml-1 text-[#e0e0e0] font-medium">提示：</strong>
              已在行動裝置上鎖定拖曳與調整時間（避免與捲動衝突），請直接點選行程進行編輯。
            </>
          ) : (
            <>
              💡 <strong className="ml-1 text-[#e0e0e0] font-medium">手勢指南：</strong>
              長按行程開始拖曳、長按外框上下邊緣可調整時間
            </>
          )}
        </span>
      </div>

      {/* Scrollable calendar view body */}
      <div 
        className="flex-1 overflow-y-auto selection:bg-transparent touch-pan-y" 
        style={{ scrollBehavior: 'smooth' }}
        ref={gridContainerRef}
      >
        <div className="relative flex w-full" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          
          {/* Left Y-ticks (Hour indices) */}
          <div className="w-12 sm:w-16 border-r border-white/5 select-none bg-black/10 flex flex-col shrink-0">
            {HOUR_LABELS.map((hour) => (
              <div 
                key={hour} 
                className="text-[11px] font-mono font-medium text-gray-400 text-right pr-2 sm:pr-3 relative" 
                style={{ height: `${HOUR_HEIGHT}px`, top: '-7px' }}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Right interactive Grid Slots Area */}
          <div 
            id="calendar-grid-area"
            className="flex-1 relative cursor-crosshair"
            onClick={handleGridClick}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';

              const dragging = (window as any).__draggingItem;
              if (dragging) {
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = dragging.offsetY || 0;
                const duration = dragging.duration || 60;
                const relativeY = (e.clientY - rect.top) - offsetY;
                const hoverMins = Math.max(0, Math.min(1440 - duration, Math.round(relativeY / 15) * 15));

                setDragHoverInfo({
                  startMins: hoverMins,
                  duration,
                  title: dragging.title || '行程'
                });
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragHoverInfo(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragHoverInfo(null);
              delete (window as any).__draggingItem;

              if (holdTimerRef.current) {
                clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
              }
              setActiveItemId(null);
              setActiveAction(null);
              setInitialItemValue(null);
              setCurrentDeltaMinutes(0);
              currentDeltaRef.current = 0;

              const itemId = e.dataTransfer.getData('text/plain');
              const offsetYStr = e.dataTransfer.getData('text/drag-offset-y');
              const offsetY = offsetYStr ? parseFloat(offsetYStr) : 0;

              if (itemId && onDropUnscheduledItem) {
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = (e.clientY - rect.top) - offsetY;
                const clickedMins = Math.max(0, Math.min(1380, Math.round(relativeY / 15) * 15));
                onDropUnscheduledItem(itemId, clickedMins);
              }
            }}
          >
            {/* Live Drag-and-Drop Placement Hover Preview */}
            {dragHoverInfo && (
              <div
                style={{
                  top: `${dragHoverInfo.startMins}px`,
                  height: `${Math.max(25, dragHoverInfo.duration)}px`,
                  left: isMobile ? '8px' : '16px',
                  right: isMobile ? '8px' : '16px',
                }}
                className="absolute z-40 border-2 border-dashed border-[#A7C7E7] bg-[#A7C7E7]/25 rounded-xl p-2 pointer-events-none transition-all flex items-center justify-between shadow-xl backdrop-blur-xs"
              >
                <div className="flex items-center gap-1.5 text-white font-bold text-xs truncate">
                  <span className="w-2 h-2 rounded-full bg-[#A7C7E7] animate-ping shrink-0" />
                  <span className="truncate">{dragHoverInfo.title}</span>
                </div>
                <span className="text-xs font-mono font-bold bg-black/80 text-[#A7C7E7] px-2 py-0.5 rounded shrink-0 border border-[#A7C7E7]/40 shadow-sm">
                  {formatMinutesToTime(dragHoverInfo.startMins)} - {formatMinutesToTime(dragHoverInfo.startMins + dragHoverInfo.duration, true)}
                </span>
              </div>
            )}
            {/* Grid line stripes */}
            {HOUR_LABELS.map((hour) => (
              <div 
                key={hour}
                className="grid-slot-bg absolute left-0 right-0 border-b border-white/5 flex items-start pointer-events-none"
                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                {/* 30-minute dashed sub-gridline */}
                <div className="w-full border-b border-dashed border-white/5 uppercase text-[9px]" style={{ marginTop: `${HOUR_HEIGHT / 2}px` }} />
              </div>
            ))}

            {/* Render Public Transit cards in structural Gaps between items */}
            {sortedItems.map((currItem, idx) => {
              // Only draw transit section if requested
              if (currItem.transitMode === 'none') return null;

              // Top positioning of the transit card. We can display it in the gap preceding this current item!
              // Duration of travel in minutes determines height of travel block
              const duration = currItem.transitDuration || 20; 
              
              const originalTransitStart = currItem.startMinutes - duration;
              let topPos = originalTransitStart;
              let heightPos = duration;
              const firstLine = (currItem.transitDetails || '').split('\n').map(l => l.trim()).filter(l => l.length > 0)[0] || '移動中';
              let displayTitle = firstLine;

              if (originalTransitStart < 0) {
                // If it starts on the previous day, clamp it to start at 0 (midnight)
                // and the height on this day is exactly its end minutes on this day (currItem.startMinutes).
                topPos = 0;
                heightPos = currItem.startMinutes;
                displayTitle = `(跨夜續) ${firstLine}`;
              }

              if (heightPos <= 0) return null; // No portion to show on this day

              return (
                <div
                  key={`transit-gap-${currItem.id}`}
                  onClick={() => onTransitClick?.(currItem)}
                  className="absolute left-2 right-2 sm:left-4 sm:right-4 z-10 flex items-center justify-between border border-dashed border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 cursor-pointer active:scale-[0.99] rounded-xl px-3 transition shadow-3xs"
                  style={{
                    top: `${topPos}px`,
                    height: `${heightPos}px`,
                  }}
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2.5 overflow-hidden">
                    <span className="p-1 bg-[#121214] rounded-md border border-white/5 shadow-3xs">
                      {getTransitIcon(currItem.transitMode)}
                    </span>
                    <div className="overflow-hidden">
                      <p className="text-[10px] sm:text-xs font-semibold text-sky-300 truncate">
                        {displayTitle}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-sky-400/80">
                         {duration} 分鐘 {originalTransitStart < 0 && `(本日路程 ${heightPos} 分鐘)`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {currItem.transitCost !== undefined && currItem.transitCost !== null && currItem.transitCost >= 1 && (
                      <span className="text-[10px] sm:text-xs font-extrabold text-sky-300 bg-[#1e1e22]/80 border border-sky-500/20 px-1.5 py-0.5 rounded">
                        {(currItem.transitCurrency === '$' ? 'NT$' : currItem.transitCurrency || '¥')} {currItem.transitCost}
                      </span>
                    )}
                    {currItem.googleMapsUrl && (
                      <a 
                      href={currItem.googleMapsUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="ml-1 inline-flex items-center p-0.5 hover:bg-white/10 rounded transition text-sky-400"
                        title="開啟預排好的交通路線"
                      >
                        <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Render Cross-overnight Transits from Next Day on the Active (Previous) Day */}
            {nextDayTransitItems.map((nextItem) => {
              const duration = nextItem.transitDuration || 20;
              const originalTransitStart = nextItem.startMinutes - duration;
              
              // Starts today at 1440 + originalTransitStart and ends at 1440 (midnight)
              const topPos = 1440 + originalTransitStart;
              const heightPos = -originalTransitStart; // which is 1440 - topPos = duration - nextItem.startMinutes

              if (heightPos <= 0) return null;

              return (
                <div
                  key={`transit-nextday-crossing-grid-${nextItem.id}`}
                  onClick={() => onTransitClick?.(nextItem)}
                  className="absolute left-2 right-2 sm:left-4 sm:right-4 z-10 flex items-center justify-between border border-dashed border-indigo-500/35 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer active:scale-[0.99] rounded-xl px-3 transition shadow-3xs"
                  style={{
                    top: `${topPos}px`,
                    height: `${heightPos}px`,
                  }}
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2.5 overflow-hidden">
                    <span className="p-1 bg-[#121214] rounded-md border border-indigo-500/25 shadow-3xs">
                      {getTransitIcon(nextItem.transitMode)}
                    </span>
                    <div className="overflow-hidden">
                      <p className="text-[10px] sm:text-xs font-semibold text-indigo-300 truncate">
                        <span className="bg-indigo-500/20 text-indigo-200 text-[8px] px-1 py-0.5 rounded font-bold mr-1">跨夜交通</span>
                        {(nextItem.transitDetails || '').split('\n').map(l => l.trim()).filter(l => l.length > 0)[0] || '移動中'}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-indigo-400/80">
                        {duration} 分鐘 (本日 {heightPos} 分鐘，接到隔日的 {nextItem.title})
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {nextItem.transitCost !== undefined && nextItem.transitCost !== null && nextItem.transitCost >= 1 && (
                      <span className="text-[10px] sm:text-xs font-extrabold text-indigo-300 bg-[#1e1e22]/80 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                        {(nextItem.transitCurrency === '$' ? 'NT$' : nextItem.transitCurrency || '¥')} {nextItem.transitCost}
                      </span>
                    )}
                    {nextItem.googleMapsUrl && (
                      <a 
                      href={nextItem.googleMapsUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="ml-1 inline-flex items-center p-0.5 hover:bg-white/10 rounded transition text-indigo-400"
                        title="開啟預排好的交通路線"
                      >
                        <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Render Calendar Events (Itinerary Cards) */}
            {renderedItems.map(({ item, start, end, cardTop, cardHeight, isContinuedFromYesterday, isCrossOvernightItem, isEventDragging }) => {
              // Responsive classes
              const showCompact = cardHeight < 50;

              const { colIndex = 0, colCount = 1 } = layoutMap[item.id] || {};
              const outerMargin = isMobile ? 8 : 16;
              const gap = 6;

              const cardLeft = `calc(${outerMargin}px + ${colIndex} * ((100% - ${outerMargin * 2}px - ${(colCount - 1) * gap}px) / ${colCount} + ${gap}px))`;
              const cardWidth = `calc((100% - ${outerMargin * 2}px - ${(colCount - 1) * gap}px) / ${colCount})`;

              return (
                <div
                  key={item.id}
                  id={`item-${item.id}`}
                  draggable={!isMobile && !isContinuedFromYesterday && !isCrossOvernightItem}
                  onDragStart={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    if (holdTimerRef.current) {
                      clearTimeout(holdTimerRef.current);
                      holdTimerRef.current = null;
                    }
                    setActiveItemId(null);
                    setActiveAction(null);
                    setInitialItemValue(null);
                    setCurrentDeltaMinutes(0);
                    currentDeltaRef.current = 0;
                    ignoreNextClickRef.current = true;
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                    e.dataTransfer.setData('text/drag-offset-y', String(offsetY));
                    e.dataTransfer.effectAllowed = 'move';
                    (window as any).__draggingItem = {
                      id: item.id,
                      duration: item.endMinutes - item.startMinutes || 60,
                      offsetY,
                      title: item.title
                    };
                  }}
                  onDragEnd={() => {
                    delete (window as any).__draggingItem;
                    setDragHoverInfo(null);
                    setActiveItemId(null);
                    setActiveAction(null);
                    setInitialItemValue(null);
                    setCurrentDeltaMinutes(0);
                    currentDeltaRef.current = 0;
                  }}
                  style={{
                    top: `${cardTop}px`,
                    height: `${cardHeight}px`,
                    left: cardLeft,
                    width: cardWidth
                  }}
                  className={`absolute z-20 rounded-xl border flex flex-col p-2 select-none pointer-events-auto transition-all group ${
                    isEventDragging 
                      ? 'shadow-xl ring-2 ring-[#A7C7E7] scale-[1.01] bg-[#1e1e22] text-white opacity-95 z-30 cursor-grabbing border-white/10'
                      : `shadow-3xs ${themeColors.bg} ${themeColors.hoverBg} cursor-pointer`
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ignoreNextClickRef.current) {
                      ignoreNextClickRef.current = false;
                      return;
                    }
                    // Normal click opens the editor/viewer
                    onItemClick(item);
                  }}
                >
                  
                  {/* Top Edge Resize Handle */}
                  {(!isMobile && !isContinuedFromYesterday && !isCrossOvernightItem) && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePointerDown(e, item, 'resize-top');
                      }}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="absolute -top-1.5 left-0 right-0 h-4 cursor-row-resize z-40 bg-transparent flex items-center justify-center group"
                      title="上下拉動調整開始時間"
                    >
                      <div className="w-16 h-1.5 bg-[#A7C7E7]/40 group-hover:bg-[#A7C7E7] rounded-full transition-all shadow-xs" />
                    </div>
                  )}

                  {/* Standard Main Drag Body Handle (Pointer interactions) */}
                  <div 
                    className="flex-1 overflow-hidden"
                    onPointerDown={(e) => handlePointerDown(e, item, 'drag')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  >
                    {showCompact ? (
                      <div className="flex items-center justify-between h-full overflow-hidden text-[11px] leading-tight font-medium">
                        <span className="truncate max-w-[65%] text-white font-semibold flex items-center gap-1">
                          {item.isReserved && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="已預約" />}
                          {isContinuedFromYesterday && <span className="bg-indigo-500/30 text-indigo-300 text-[9px] px-1 rounded scale-90">跨夜</span>}
                          {item.title}
                        </span>
                        <span className="font-mono text-[10px] shrink-0 text-gray-400">
                          {formatMinutesToTime(start)}~{formatMinutesToTime(end, true)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          {/* Title & Hour Range */}
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-bold text-[13px] leading-snug tracking-tight text-white truncate flex items-center gap-1.5">
                              {isContinuedFromYesterday && <span className="bg-indigo-550/30 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded-md shrink-0 border border-indigo-500/10">跨夜延續</span>}
                              {item.title}
                            </h4>
                            <div className="flex items-center space-x-1 shrink-0">
                              <span className="text-[10px] font-mono text-gray-300 bg-black/25 px-1 py-0.5 rounded">
                                {formatMinutesToTime(start)} - {formatMinutesToTime(end, true)}
                              </span>
                              {onMoveToUnscheduled && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveToUnscheduled(item.id);
                                  }}
                                  className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition cursor-pointer"
                                  title="移至暫存行程區"
                                >
                                  <Inbox className="w-3 h-3 text-[#A7C7E7]" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Location details */}
                          {item.location && (
                            <p className="flex items-center text-[11px] text-gray-400 mt-1 truncate">
                              <MapPin className="w-3 h-3 text-gray-500 mr-0.5 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </p>
                          )}
                        </div>

                        {/* Badges footer */}
                        <div className="flex flex-wrap gap-1 items-center mt-1.5">
                          {item.isReserved && (
                            <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold bg-amber-500 text-black rounded px-1.5 py-0.5 shadow-3xs uppercase">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>已約 {item.reservationTime || '未備註時間'}</span>
                            </span>
                          )}

                          {item.notes && (
                            <span className="text-[9px] text-gray-300 bg-black/20 px-1.5 py-0.5 rounded truncate max-w-[120px] border border-white/5">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Edge Resize Handle */}
                  {(!isMobile && !isContinuedFromYesterday && !isCrossOvernightItem) && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePointerDown(e, item, 'resize-bottom');
                      }}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="absolute -bottom-1.5 left-0 right-0 h-4 cursor-row-resize z-40 bg-transparent flex items-center justify-center group"
                      title="上下拉動調整結束時間"
                    >
                      <div className="w-16 h-1.5 bg-[#A7C7E7]/40 group-hover:bg-[#A7C7E7] rounded-full transition-all shadow-xs" />
                    </div>
                  )}

                </div>
              );
            })}

            {isToday && (
              <div 
                className="absolute left-0 right-0 z-25 pointer-events-none flex items-center"
                style={{ top: `${currentMinutes}px` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 -ml-1.5 shadow-sm shrink-0 border border-black/50" />
                <div className="flex-1 h-0.5 border-t-2 border-dashed border-yellow-400/80 opacity-90 shadow-2xs" />
                <span className="text-[10px] font-mono font-bold bg-yellow-400 text-black px-1.5 py-0.5 rounded-sm ml-2 mr-2 select-none shadow-md shrink-0">
                  現在 {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                </span>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

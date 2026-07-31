import React, { useState, useRef } from 'react';
import { ItineraryItem } from '../types';
import { formatMinutesToTime, parseTimeToMinutes } from '../utils';
import { Plus, MapPin, Clock, Trash2, Edit3, CalendarPlus, Move, Inbox, X, Check } from 'lucide-react';

interface UnscheduledPanelProps {
  items: ItineraryItem[];
  activeDate: string;
  activeDateLabel?: string;
  onAddUnscheduled: (title: string, location: string, startMins: number, durationMins: number) => void;
  onMoveToCalendar: (itemId: string, targetDate: string, targetStartMins?: number) => void;
  onMoveToUnscheduled: (itemId: string) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDeleteItem: (itemId: string) => void;
  colorPreset?: string;
}

export default function UnscheduledPanel({
  items,
  activeDate,
  activeDateLabel,
  onAddUnscheduled,
  onMoveToCalendar,
  onMoveToUnscheduled,
  onEditItem,
  onDeleteItem,
  colorPreset = 'indigo'
}: UnscheduledPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Quick form submit for adding unscheduled item
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newLocation.trim()) return;

    const startMins = parseTimeToMinutes(newStartTime);
    const durationMins = 60; // 預設持續時間 1 小時

    onAddUnscheduled(
      newTitle.trim() || newLocation.trim() || '暫存景點',
      newLocation.trim(),
      startMins,
      durationMins
    );

    // Reset form
    setNewTitle('');
    setNewLocation('');
    setNewStartTime('09:00');
    setShowAddModal(false);
  };

  // Drag over drop zone handlers with ref counter to avoid child element flickering
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    // Get item ID from dataTransfer
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) {
      onMoveToUnscheduled(itemId);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#121214] border rounded-2xl flex flex-col h-full max-h-[75vh] overflow-hidden transition-all text-left shadow-xs ${
        isDragOver
          ? 'border-[#A7C7E7] ring-2 ring-[#A7C7E7]/40 bg-[#1e1e24]'
          : 'border-white/5'
      }`}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between bg-[#16161a] shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-[#A7C7E7]/10 text-[#A7C7E7] rounded-lg">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
              <span>暫存行程</span>
              {items.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#A7C7E7]/20 text-[#A7C7E7] rounded-full text-[10px] font-black">
                  {items.length}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-gray-400 font-medium">可隨時拖曳移至時間表</p>
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="px-2.5 py-1.5 bg-[#A7C7E7] hover:bg-[#96b7d7] text-black font-bold text-xs rounded-xl flex items-center space-x-1 transition shadow-sm cursor-pointer"
          title="新增暫存行程"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新增暫存</span>
        </button>
      </div>

      {/* Drag Over Hint Notice */}
      {isDragOver && (
        <div className="p-3 bg-[#A7C7E7]/10 border-b border-[#A7C7E7]/20 text-[#A7C7E7] text-xs font-bold text-center flex items-center justify-center space-x-1.5 animate-pulse shrink-0">
          <Move className="w-4 h-4" />
          <span>放開滑鼠將行程移入暫存區</span>
        </div>
      )}

      {/* Inline Quick Add Form Modal */}
      {showAddModal && (
        <div className="p-3.5 bg-[#1a1a1e] border-b border-white/10 shrink-0 animate-fade-in">
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#A7C7E7] uppercase tracking-wider">
                新增暫存行程
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                行程名稱 / 主題 *
              </label>
              <input
                type="text"
                required
                placeholder="例如：明治神宮散步、敘敘苑燒肉"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#A7C7E7]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                行程地點
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="例如：明治神宮前"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#A7C7E7]"
                />
                <MapPin className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#A7C7E7]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  預設時長
                </label>
                <div className="px-2 py-1.5 text-xs bg-[#121214] border border-white/5 rounded-lg text-gray-400 font-medium">
                  1 小時 (預設)
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 text-xs font-bold bg-[#A7C7E7] hover:bg-[#96b7d7] text-black rounded-lg transition"
              >
                儲存暫存
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {items.length === 0 ? (
          <div className="p-6 text-center text-gray-500 my-auto flex flex-col items-center justify-center space-y-2">
            <Inbox className="w-8 h-8 opacity-40 text-gray-400 mb-1" />
            <p className="text-xs font-bold text-gray-400">目前無暫存行程</p>
            <p className="text-[11px] text-gray-500 max-w-[200px] leading-relaxed">
              點按右上方「+」新增暫存行程，或是把日曆中的行程拖曳到此區域暫存。
            </p>
          </div>
        ) : (
          items.map((item) => {
            const startStr = formatMinutesToTime(item.startMinutes);
            const endStr = formatMinutesToTime(item.endMinutes);

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
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
                }}
                className="group p-3 bg-[#1e1e22] hover:bg-[#28282e] border border-white/5 hover:border-white/15 rounded-xl transition shadow-2xs flex flex-col space-y-2 cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="p-0.5 px-1.5 bg-[#A7C7E7]/10 text-[#A7C7E7] text-[10px] font-bold rounded flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{startStr} - {endStr}</span>
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-white leading-snug truncate">
                      {item.title}
                    </h4>
                    {item.location && (
                      <p className="text-[11px] text-gray-400 flex items-center mt-0.5 truncate">
                        <MapPin className="w-3 h-3 text-gray-500 mr-1 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Move/Drag Handle Icon */}
                  <div className="text-gray-500 hover:text-gray-300 p-1 cursor-grab" title="按住拖曳至日曆時段">
                    <Move className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[11px]">
                  {/* Assign to current active date */}
                  <button
                    onClick={() => onMoveToCalendar(item.id, activeDate)}
                    className="px-2 py-1 bg-[#A7C7E7]/10 hover:bg-[#A7C7E7]/20 text-[#A7C7E7] border border-[#A7C7E7]/20 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer"
                    title={`將此行程排入 ${activeDate}`}
                  >
                    <CalendarPlus className="w-3 h-3" />
                    <span>排入本日 ({activeDateLabel || activeDate})</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onEditItem(item)}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition"
                      title="編輯"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded transition"
                      title="刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

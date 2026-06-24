import React, { useState } from 'react';
import { Trip, ItineraryItem } from '../types';
import { generateDaysList } from '../utils';
import { X, Copy, Calendar, Save, Sparkles, AlertCircle } from 'lucide-react';

interface TripDuplicateModalProps {
  currentTrip: Trip;
  items: ItineraryItem[];
  onConfirm: (newTrip: Trip, newItems: ItineraryItem[]) => void;
  onClose: () => void;
}

export default function TripDuplicateModal({
  currentTrip,
  items,
  onConfirm,
  onClose,
}: TripDuplicateModalProps) {
  const [name, setName] = useState(`${currentTrip.name} (副本)`);
  const [startDate, setStartDate] = useState(currentTrip.startDate);
  const [endDate, setEndDate] = useState(currentTrip.endDate);
  const [error, setError] = useState('');

  const sourceDays = generateDaysList(currentTrip.startDate, currentTrip.endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('請輸入旅程名稱！');
      return;
    }
    if (!startDate || !endDate) {
      setError('請選擇完整的開始與結束日期！');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('結束日期不能早於開始日期！');
      return;
    }

    // Short term limit: 14 days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 14) {
      setError('此工具專為 1 ~ 2 週（最多 14 天）的短期旅程設計，請縮短日期範圍！');
      return;
    }

    const newTripId = `trip_${Date.now()}`;
    const newTrip: Trip = {
      id: newTripId,
      name: name.trim(),
      startDate,
      endDate,
      createdAt: Date.now(),
      colorPreset: currentTrip.colorPreset, // keep same preset
    };

    const newDays = generateDaysList(startDate, endDate);
    const copiedItems: ItineraryItem[] = [];

    // Map source items day by day to new days
    newDays.forEach((newDay, i) => {
      // If the source trip has this day index
      if (i < sourceDays.length) {
        const sourceDayDate = sourceDays[i].dateString;
        const sourceDayItems = items.filter(item => item.date === sourceDayDate);

        sourceDayItems.forEach((oldItem, idx) => {
          copiedItems.push({
            ...oldItem,
            id: `item_${Date.now()}_${i}_${idx}_${Math.random().toString(36).substring(2, 9)}`,
            tripId: newTripId,
            date: newDay.dateString,
          });
        });
      }
    });

    onConfirm(newTrip, copiedItems);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#1e1e22] border border-white/5 w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
            <Copy className="w-4 h-4 text-[#A7C7E7]" />
            <span>建立旅程副本</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-xl text-xs leading-relaxed flex items-start space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-xs text-indigo-300 leading-relaxed">
            <p className="font-semibold flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>複製行程資訊</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              原旅程：<span className="text-white font-medium">{currentTrip.name}</span> ({sourceDays.length} 天)
            </p>
          </div>

          {/* New Trip Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              旅程副本名稱
            </label>
            <input
              maxLength={20}
              required
              type="text"
              className="w-full px-3 py-2 text-sm bg-[#121214] border border-white/10 hover:border-white/20 focus:border-[#A7C7E7] text-white focus:bg-[#2a2a2f] rounded-xl focus:outline-none transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Date range setup */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                出發日期
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 text-xs bg-[#121214] border border-white/10 rounded-xl focus:outline-none focus:border-[#A7C7E7] text-white"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                結束日期
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 text-xs bg-[#121214] border border-white/10 rounded-xl focus:outline-none focus:border-[#A7C7E7] text-white"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-dashed border-white/5 pt-3.5 space-y-1.5 text-[11px] text-gray-400 leading-normal">
            <span className="font-bold text-gray-300">💡 副本日程規則：</span>
            <p>1. 舊行程各時段、地點、備註與路費等設定將會全部保留並複製。</p>
            <p>2. 若新日期天數減少，則僅複製前幾天的行程（例如 5 天縮短為 3 天，則只帶入前 3 天行程）。</p>
            <p>3. 若新日期天數增加，多出來的天數將維持空白，不作任何安排。</p>
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-end space-x-2.5 bg-[#121214]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 hover:bg-white/5 border border-white/5 text-gray-300 rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4.5 py-2 bg-[#A7C7E7] hover:bg-[#96b7d7] text-black rounded-lg text-sm font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>確認建立副本</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Trip } from '../types';
import { Calendar, Compass, ArrowRight, Sun, Sparkles } from 'lucide-react';

interface TripSetupFormProps {
  onSetupComplete: (trip: Trip) => void;
  existingTrips: Trip[];
  onSelectTrip: (tripId: string) => void;
}

const PALETTE_PRESETS = [
  { class: 'indigo', label: '靛藍東京', color: 'bg-indigo-600', text: 'text-indigo-600' },
  { class: 'emerald', label: '綠野京都', color: 'bg-emerald-600', text: 'text-emerald-600' },
  { class: 'amber', label: '琥珀大阪', color: 'bg-amber-500', text: 'text-amber-500' },
  { class: 'orange', label: '落日沖繩', color: 'bg-orange-500', text: 'text-orange-500' },
  { class: 'rose', label: '緋紅花季', color: 'bg-rose-500', text: 'text-rose-500' },
];

export default function TripSetupForm({ onSetupComplete, existingTrips, onSelectTrip }: TripSetupFormProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [error, setError] = useState('');

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

    // Short term limit: 14 days (2 weeks)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 14) {
      setError('此工具專為 1 ~ 2 週（最多 14 天）的短期旅程設計，請縮短日期範圍！');
      return;
    }

    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      name: name.trim(),
      startDate,
      endDate,
      createdAt: Date.now(),
      colorPreset: selectedColor,
    };

    onSetupComplete(newTrip);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-16 text-[#e0e0e0] animate-fade-in">
      
      {/* Title logo branding */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-[#A7C7E7]/10 text-[#A7C7E7] rounded-2xl mb-4">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">短期旅行規劃助手</h1>
        <p className="text-xs text-[#8a8a8e] mt-1 max-w-xs mx-auto">
          結合 Google Maps、行程表拖曳、大眾交通費用統計，完美支援行動裝置！
        </p>
      </div>

      {/* Main setup container */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl shadow-xl p-5 sm:p-6 space-y-6">
        
        {/* If there are existing trips */}
        {existingTrips.length > 0 && (
          <div className="pb-5 border-b border-white/5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              開啟已儲存的旅程
            </label>
            <div className="grid grid-cols-1 gap-2">
              {existingTrips.map((t) => {
                const startStr = t.startDate.split('-').slice(1).join('/');
                const endStr = t.endDate.split('-').slice(1).join('/');
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTrip(t.id)}
                    className="flex justify-between items-center p-3 text-left hover:bg-[#2c2c31] bg-[#1e1e22] border border-white/5 hover:border-white/10 rounded-xl transition duration-150"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-white">{t.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {startStr} ~ {endStr}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-[#A7C7E7]" />
            <span>建立新的旅程與空白日程表</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trip Name input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider" htmlFor="trip-name">
                旅程名稱
              </label>
              <input
                id="trip-name"
                maxLength={20}
                required
                type="text"
                placeholder="例如：東京京都雙城賞楓自由行"
                className="w-full px-3 py-2.5 text-sm bg-[#1e1e22] border border-white/10 hover:border-white/20 focus:border-[#A7C7E7] text-white focus:bg-[#2a2a2f] rounded-xl focus:outline-none transition placeholder-gray-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Travel Date selection */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  出發日期
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 text-xs bg-[#1e1e22] border border-white/10 rounded-xl focus:outline-none focus:border-[#A7C7E7] focus:bg-[#2a2a2f] text-white"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  結束日期
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 text-xs bg-[#1e1e22] border border-white/10 rounded-xl focus:outline-none focus:border-[#A7C7E7] focus:bg-[#2a2a2f] text-white"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Curated color select presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                選擇風格配色
              </label>
              <div className="flex flex-wrap gap-2">
                {PALETTE_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.class}
                    onClick={() => setSelectedColor(p.class)}
                    className={`flex items-center space-x-1.5 p-2 px-3 rounded-xl border text-xs transition duration-150 cursor-pointer ${
                      selectedColor === p.class
                        ? 'bg-[#A7C7E7]/20 border-[#A7C7E7] text-[#A7C7E7] font-semibold'
                        : 'bg-[#1e1e22] hover:bg-[#2c2c31] border-white/5 text-gray-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Errors */}
            {error && (
              <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg text-xs leading-relaxed">
                ⚠️ {error}
              </div>
            )}

            {/* Launch button */}
            <button
              type="submit"
              className="w-full mt-2 bg-[#A7C7E7] hover:bg-[#96b7d7] text-black font-semibold text-sm py-3 rounded-xl transition duration-150 shadow-md transform active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sun className="w-4 h-4" />
              <span>建立我的專屬日程表</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

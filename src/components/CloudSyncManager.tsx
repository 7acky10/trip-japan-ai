import React, { useState, useEffect, useRef } from "react";
import { Trip, ItineraryItem } from "../types";
import { Share2, Copy, RefreshCw, Users, Check, Wifi, Globe, Send } from "lucide-react";

interface CloudSyncManagerProps {
  currentTrip: Trip | null;
  items: ItineraryItem[];
  onTripUpdated: (updatedTrip: Trip) => void;
  onSyncReceived: (trip: Trip, items: ItineraryItem[]) => void;
}

export default function CloudSyncManager({
  currentTrip,
  items,
  onTripUpdated,
  onSyncReceived,
}: CloudSyncManagerProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState("");
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keep reference of items representation to avoid upload loop
  const prevItemsRef = useRef<string>("");
  const initialLoadDone = useRef<boolean>(false);

  // Store the latest props in a ref to avoid stale closure issues in the setInterval polling loop
  const latestProps = useRef({ currentTrip, items, onSyncReceived, onTripUpdated });
  useEffect(() => {
    latestProps.current = { currentTrip, items, onSyncReceived, onTripUpdated };
  });

  // Auto parsing URL search param to join a trip seamlessly if ?join=abcde is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join")?.trim().toLowerCase();
    if (joinCode && joinCode.length === 6 && (!currentTrip || currentTrip.syncId !== joinCode)) {
      handleJoinTripDirectly(joinCode);
    }
  }, [currentTrip?.syncId]);

  // Clear error whenever current trip ID, sync ID, or sync code input changes
  useEffect(() => {
    setError("");
  }, [currentTrip?.id, currentTrip?.syncId, syncCodeInput]);

  // Regular Polling loop: Read cloud trip immediately on mount/syncId change and then poll every 3 seconds
  useEffect(() => {
    const activeSyncId = latestProps.current.currentTrip?.syncId;
    if (!latestProps.current.currentTrip || !activeSyncId) {
      initialLoadDone.current = true;
      return;
    }

    // Fetch immediately on mount or when switching trips
    fetchCloudTrip(activeSyncId, false);

    // Set up polling fetch (every 3 seconds for fast, real-time updates)
    const timer = setInterval(() => {
      const currentActiveSyncId = latestProps.current.currentTrip?.syncId;
      if (currentActiveSyncId) {
        fetchCloudTrip(currentActiveSyncId, false);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [currentTrip?.syncId]);

  // Upload local changes when local items state changes, avoiding loops and running only after initial sync load completes
  useEffect(() => {
    const activeTrip = latestProps.current.currentTrip;
    if (!activeTrip || !activeTrip.syncId) return;

    const itemsJsonStr = JSON.stringify(items);
    
    // If initial loading from the cloud has not completed yet, set reference to prevent overwriting cloud updates
    if (!initialLoadDone.current) {
      prevItemsRef.current = itemsJsonStr;
      return;
    }

    if (prevItemsRef.current !== itemsJsonStr) {
      uploadLocalChanges(activeTrip.syncId, activeTrip, items);
      prevItemsRef.current = itemsJsonStr;
    }
  }, [items, currentTrip?.id]);

  const uploadLocalChanges = async (syncId: string, trip: Trip, localItems: ItineraryItem[]) => {
    try {
      setIsSyncing(true);
      const res = await fetch(`/api/share/${syncId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip, items: localItems }),
      });
      if (res.ok) {
        // Success upload
      }
    } catch (e) {
      console.error("Collaborative upload sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCloudTrip = async (syncId: string, showSpinner = true) => {
    try {
      if (showSpinner) setIsSyncing(true);
      
      // Use cache-busting timestamp parameter and standard cache prevention headers to prevent aggressive mobile caching
      const res = await fetch(`/api/share/${syncId}?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      
      if (!res.ok) {
        throw new Error("Unable to fetch shared trip from cloud");
      }
      const data = await res.json();
      const fetchedItemsStr = JSON.stringify(data.items);
      const localItemsStr = JSON.stringify(latestProps.current.items);

      // Only invoke callback if there's a real server discrepancy to prevent render loops
      if (fetchedItemsStr !== localItemsStr) {
        latestProps.current.onSyncReceived(data.trip, data.items);
        prevItemsRef.current = fetchedItemsStr;
      }
      initialLoadDone.current = true;
    } catch (e) {
      console.warn("Collaborative sync fetching interval error:", e);
    } finally {
      if (showSpinner) setIsSyncing(false);
    }
  };

  const handleShareTrip = async () => {
    if (!currentTrip) return;
    setIsSharing(true);
    setError("");

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip: currentTrip, items }),
      });

      if (!res.ok) {
        throw new Error("分享連線失敗，請稍後再試！");
      }

      const { syncId } = await res.json();
      const updatedTrip = { ...currentTrip, syncId };
      onTripUpdated(updatedTrip);
      
      // Update our matching snapshot
      prevItemsRef.current = JSON.stringify(items);
      initialLoadDone.current = true;
    } catch (err: any) {
      setError(err.message || "建立旅程協同分享失敗！");
    } finally {
      setIsSharing(false);
    }
  };

  const handleJoinTripDirectly = async (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    if (!cleanCode || cleanCode.length !== 6) {
      setError("請輸入正確的 6 位小寫英數同步代碼！");
      return;
    }

    setIsSharing(true);
    setError("");

    try {
      // Use cache-busting timestamp parameter and cache prevention headers on manual joins as well
      const res = await fetch(`/api/share/${cleanCode}?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      if (!res.ok) {
        throw new Error("找不到對應的雲端行程！代碼可能正確性不足或已被移除。");
      }

      const data = await res.json();
      
      // Ensure sync variables are correctly set so that we don't overwrite cloud data with uninitialized local states
      prevItemsRef.current = JSON.stringify(data.items);
      initialLoadDone.current = true;

      onSyncReceived(data.trip, data.items);
      setSyncCodeInput("");
      
      // Clear URL join param to look clean
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      setError(err.message || "讀取旅程失敗！");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (!currentTrip?.syncId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${currentTrip.syncId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!currentTrip?.syncId) return;
    navigator.clipboard.writeText(currentTrip.syncId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!currentTrip) {
    return (
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-4.5 text-center text-[#8a8a8e]">
        <Globe className="w-5 h-5 mx-auto text-gray-500 mb-2" />
        <p className="text-xs">先建立或開啟一個旅程即可同步邀請夥伴共同編輯！</p>
      </div>
    );
  }

  const isShared = !!currentTrip.syncId;

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
          <Share2 className="w-4 h-4 text-[#A7C7E7]" />
          <span>同伴共同編輯與分享 (Cloud Share)</span>
        </h4>
        {isShared && (
          <span className="flex items-center text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold animate-pulse space-x-1">
            <Wifi className="w-3 h-3" />
            <span>在線即時同步</span>
          </span>
        )}
      </div>

      {isShared ? (
        <div className="space-y-3.5">
          <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/15 text-xs text-emerald-300 leading-relaxed text-left flex items-start space-x-2">
            <Users className="w-4 h-4 shrink-0 text-emerald-400 mt-1" />
            <div>
              <p className="font-bold">雲端同伴協同就緒！</p>
              <p className="text-[11px] text-gray-400 font-light mt-0.5">
                將此代碼分享給旅伴，他們就能透過任何手機或分頁共同點選與編輯行程，兩端瞬間同步！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#1e1e22] hover:bg-[#2c2c31] border border-white/5 rounded-xl text-xs font-semibold text-white transition cursor-pointer select-none"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#A7C7E7]" />}
              <span>{copiedCode ? "已複製代碼" : "複製同步代碼"}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#1e1e22] hover:bg-[#2c2c31] border border-white/5 rounded-xl text-xs font-semibold text-white transition cursor-pointer select-none"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-[#A7C7E7]" />}
              <span>{copiedLink ? "已複製網址" : "複製同伴直登 URL"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="p-1 px-2.5 font-mono font-bold text-center bg-[#1e1e22] text-[#A7C7E7] border border-white/5 rounded-md text-[13px] tracking-wider select-all">
                {currentTrip.syncId}
              </span>
            </div>

            <button
              disabled={isSyncing}
              onClick={() => fetchCloudTrip(currentTrip.syncId!, true)}
              className="text-gray-400 hover:text-white flex items-center space-x-1 transition cursor-pointer disabled:opacity-50 text-[11px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "讀取中" : "手動立即同步"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 font-light leading-relaxed">
            此行程目前只儲存在這台瀏覽器（LocalStorage）中。想要和同伴們分開編輯或隨時共用同一份最新的行前表嗎？一鍵建立雲端共享，共同商量行程！
          </p>

          <button
            onClick={handleShareTrip}
            disabled={isSharing}
            className="w-full bg-[#A7C7E7] hover:bg-[#96b7d7] text-black font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            <span>{isSharing ? "上傳分享中..." : "建立我的雲端協同分享"}</span>
          </button>

          <div className="border-t border-dashed border-white/5 pt-3.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">
              輸入旅伴的旅程同步代碼 (Join Trip)
            </label>
            <div className="flex space-x-2">
              <input
                maxLength={6}
                type="text"
                placeholder="例如 b8gx9a"
                className="flex-1 px-3 py-2 text-xs bg-[#1e1e22] border border-white/10 hover:border-white/20 focus:border-[#A7C7E7] text-white focus:bg-[#2a2a2f] rounded-xl focus:outline-none transition uppercase tracking-wider"
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value)}
              />
              <button
                onClick={() => handleJoinTripDirectly(syncCodeInput)}
                disabled={isSharing || syncCodeInput.trim().length !== 6}
                className="bg-white/10 hover:bg-white/20 border border-white/5 active:bg-white/5 text-white p-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>讀取並匯入</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-2.5 rounded-lg text-xs leading-relaxed">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

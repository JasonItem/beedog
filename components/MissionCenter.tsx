
import React, { useState } from 'react';
import { X, CheckCircle, CalendarCheck, Gamepad2, Zap, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { performDailyCheckIn } from '../services/userService';
import { Button } from './Button';

interface MissionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGames: () => void;
}

export const MissionCenter: React.FC<MissionCenterProps> = ({ isOpen, onClose, onNavigateToGames }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Get Today's Date YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  const isCheckedIn = userProfile?.lastCheckInDate === today;
  const isGamePlayed = userProfile?.lastGamePlayedDate === today;

  const handleCheckIn = async () => {
    if (!user || isCheckedIn || loading) return;
    setLoading(true);
    try {
      await performDailyCheckIn(user.uid);
      await refreshProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToGames = () => {
    onClose();
    onNavigateToGames();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#161616] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-[#333] relative flex flex-col max-h-[85vh]">
        
        {/* Header - Minimalist */}
        <div className="p-6 border-b border-neutral-100 dark:border-white/5 bg-white dark:bg-[#161616]">
           <div className="flex justify-between items-center mb-1">
              <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                 <Zap className="text-brand-yellow fill-brand-yellow" /> 任务中心
              </h2>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              >
                 <X size={20} />
              </button>
           </div>
           <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              完成每日任务，赚取更多蜂蜜！
           </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
           
           {/* Mission 1: Check In */}
           <div className={`p-4 rounded-2xl border transition-all ${isCheckedIn ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-neutral-50 dark:bg-[#222] border-neutral-100 dark:border-[#333]'}`}>
              <div className="flex justify-between items-start mb-3">
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isCheckedIn ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                       <CalendarCheck size={24} />
                    </div>
                    <div>
                       <h3 className="font-bold text-lg dark:text-white">每日签到</h3>
                       <p className="text-xs text-neutral-500 dark:text-neutral-400">每天访问即可领取奖励</p>
                    </div>
                 </div>
                 <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    +10 🍯
                 </div>
              </div>
              
              {isCheckedIn ? (
                 <div className="w-full py-2 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                    <CheckCircle size={16} /> 已完成
                 </div>
              ) : (
                 <Button onClick={handleCheckIn} disabled={loading} size="sm" className="w-full">
                    {loading ? <Loader2 className="animate-spin" size={16}/> : "立即签到"}
                 </Button>
              )}
           </div>

           {/* Mission 2: Play Game */}
           <div className={`p-4 rounded-2xl border transition-all ${isGamePlayed ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-neutral-50 dark:bg-[#222] border-neutral-100 dark:border-[#333]'}`}>
              <div className="flex justify-between items-start mb-3">
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isGamePlayed ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'}`}>
                       <Gamepad2 size={24} />
                    </div>
                    <div>
                       <h3 className="font-bold text-lg dark:text-white">每日首玩</h3>
                       <p className="text-xs text-neutral-500 dark:text-neutral-400">体验任意一个小游戏</p>
                    </div>
                 </div>
                 <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    +10 🍯
                 </div>
              </div>
              
              {isGamePlayed ? (
                 <div className="w-full py-2 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                    <CheckCircle size={16} /> 已完成
                 </div>
              ) : (
                 <Button onClick={handleGoToGames} variant="secondary" size="sm" className="w-full group">
                    去玩游戏 <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                 </Button>
              )}
           </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-neutral-50 dark:bg-[#111] border-t border-neutral-100 dark:border-[#333] text-center">
           <p className="text-xs text-neutral-400">任务每天 00:00 (本地时间) 重置</p>
        </div>

      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { X, CheckCircle, CalendarCheck, Gamepad2, Zap, Loader2, ArrowRight, HelpCircle, Coins, AlertTriangle, Info, Trophy, Medal, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { performDailyCheckIn, getHoneyLeaderboard, UserProfile } from '../services/userService';
import { Button } from './Button';

interface MissionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGames: () => void;
}

export const MissionCenter: React.FC<MissionCenterProps> = ({ isOpen, onClose, onNavigateToGames }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'earn' | 'leaderboard' | 'guide'>('earn');
  
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const fetchLeaderboard = () => {
    setLoadingLeaderboard(true);
    setLeaderboard([]); // Clear existing to show loading state clearly
    getHoneyLeaderboard().then(data => {
        setLeaderboard(data);
    }).finally(() => {
        setLoadingLeaderboard(false);
    });
  };

  // Fetch leaderboard when tab changes or when Modal OPENS
  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
        fetchLeaderboard();
    }
  }, [isOpen, activeTab]);

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

  const renderRankIcon = (index: number) => {
      if (index === 0) return <Trophy className="text-yellow-500 fill-yellow-500" size={20} />;
      if (index === 1) return <Medal className="text-gray-400 fill-gray-400" size={20} />;
      if (index === 2) return <Medal className="text-amber-700 fill-amber-700" size={20} />;
      return <span className="font-bold text-neutral-500 w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#161616] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-[#333] relative flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 dark:border-white/5 bg-white dark:bg-[#161616]">
           <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                 <Zap className="text-brand-yellow fill-brand-yellow" /> 蜂蜜中心
              </h2>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              >
                 <X size={20} />
              </button>
           </div>
           
           {/* Tabs */}
           <div className="flex p-1 bg-neutral-100 dark:bg-[#222] rounded-xl">
              <button 
                onClick={() => setActiveTab('earn')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'earn' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
              >
                赚取
              </button>
              <button 
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
              >
                排行榜
              </button>
              <button 
                onClick={() => setActiveTab('guide')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'guide' ? 'bg-white dark:bg-[#333] shadow-sm text-brand-yellow' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
              >
                说明
              </button>
           </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
           
           {activeTab === 'earn' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
               <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mb-2">
                  完成每日任务，积累蜂蜜兑换权益！
               </p>

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
                        +100 🍯
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
                        +500 🍯
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
           )}

           {activeTab === 'leaderboard' && (
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                   <div className="flex justify-between items-center mb-2">
                       <div className="text-left">
                           <h3 className="font-bold dark:text-white flex items-center gap-2">
                               <Trophy className="text-brand-yellow"/> 蜂蜜富豪榜 TOP 50
                           </h3>
                           <p className="text-xs text-neutral-500 dark:text-neutral-400">实时更新社区最富有的蜜蜂狗</p>
                       </div>
                       <button onClick={fetchLeaderboard} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors" disabled={loadingLeaderboard}>
                           <RotateCcw size={18} className={`${loadingLeaderboard ? 'animate-spin' : ''} text-neutral-500`}/>
                       </button>
                   </div>

                   {loadingLeaderboard ? (
                       <div className="flex justify-center py-10">
                           <Loader2 className="animate-spin text-brand-yellow" size={32}/>
                       </div>
                   ) : leaderboard.length === 0 ? (
                       <div className="text-center text-neutral-400 py-10 flex flex-col items-center gap-2">
                           <div className="text-4xl">🌫️</div>
                           <span>暂无数据</span>
                       </div>
                   ) : (
                       <div className="space-y-2 flex-1 overflow-y-auto pr-1 pb-4">
                           {leaderboard.map((u, idx) => (
                               <div key={u.uid} className={`flex items-center justify-between p-3 rounded-xl border ${u.uid === user?.uid ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-neutral-50 dark:bg-[#222] border-neutral-100 dark:border-[#333]'}`}>
                                   <div className="flex items-center gap-3">
                                       <div className="w-6 flex justify-center">
                                           {renderRankIcon(idx)}
                                       </div>
                                       <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#333] overflow-hidden border border-neutral-200 dark:border-[#444] shrink-0">
                                            {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">🐶</div>}
                                       </div>
                                       <div className="flex flex-col">
                                           <span className={`font-bold text-sm ${u.uid === user?.uid ? 'text-brand-yellow' : 'dark:text-neutral-200'} truncate max-w-[100px]`}>
                                               {u.nickname || '蜜蜂狗'}
                                           </span>
                                       </div>
                                   </div>
                                   <div className="font-mono font-black text-brand-yellow text-sm">
                                       {u.credits.toLocaleString()} 🍯
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
                   
                   {/* User's own rank indicator if logged in */}
                   {userProfile && (
                       <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-3 rounded-xl flex justify-between items-center shadow-lg mt-auto shrink-0">
                           <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-brand-yellow flex items-center justify-center text-xs font-bold text-black">
                                   我
                               </div>
                               <span className="font-bold text-sm">我的资产</span>
                           </div>
                           <span className="font-mono font-black">{userProfile.credits.toLocaleString()} 🍯</span>
                       </div>
                   )}
               </div>
           )}

           {activeTab === 'guide' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Intro */}
                <div className="bg-brand-yellow/10 p-4 rounded-2xl border border-brand-yellow/20">
                   <h3 className="font-bold text-brand-yellow mb-2 flex items-center gap-2">
                      <Info size={18}/> 什么是“蜂蜜”?
                   </h3>
                   <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      “蜂蜜” (Honey) 是蜜蜂狗社区平台的互动积分。它是我们感谢社区成员活跃参与的一种方式，记录了你在社区中的贡献与活跃度。
                   </p>
                </div>

                {/* Uses */}
                <div>
                   <h3 className="font-bold dark:text-white mb-3 flex items-center gap-2">
                      🍯 蜂蜜有什么用?
                   </h3>
                   <ul className="space-y-3">
                      <li className="flex gap-3 items-start text-sm text-neutral-600 dark:text-neutral-300">
                         <div className="mt-0.5 min-w-[20px]"><Gamepad2 size={16} className="text-blue-500"/></div>
                         <span><span className="font-bold dark:text-white">玩游戏消耗:</span> 部分高级游戏或特殊模式可能需要消耗蜂蜜。</span>
                      </li>
                      <li className="flex gap-3 items-start text-sm text-neutral-600 dark:text-neutral-300">
                         <div className="mt-0.5 min-w-[20px]"><Zap size={16} className="text-orange-500"/></div>
                         <span><span className="font-bold dark:text-white">AI 工具消耗:</span> 使用 AI 生成 PFP、表情包或算命等功能需要消耗蜂蜜。</span>
                      </li>
                      <li className="flex gap-3 items-start text-sm text-neutral-600 dark:text-neutral-300 opacity-70">
                         <div className="mt-0.5 min-w-[20px]"><Coins size={16} className="text-green-500"/></div>
                         <span><span className="font-bold dark:text-white">未来权益 (规划中):</span> 兑换社区周边、参与特殊抽奖活动、竞猜活动等，也许未来会对积分排行榜玩家进行奖励。</span>
                      </li>
                   </ul>
                </div>

                {/* Disclaimer */}
                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-200 dark:border-red-900/30">
                   <h3 className="font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <AlertTriangle size={16}/> 重要声明
                   </h3>
                   <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed text-justify">
                      “蜂蜜”仅为本网站内部的娱乐积分，<span className="font-bold underline">不是加密货币</span>，不基于任何区块链技术，<span className="font-bold underline">没有任何现金价值</span>。
                      <br/><br/>
                      蜂蜜无法提现、无法交易、无法兑换法币或其他代币。它仅用于增加社区互动的趣味性。请注意甄别信息，谨防受骗。
                   </p>
                </div>
             </div>
           )}

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-neutral-50 dark:bg-[#111] border-t border-neutral-100 dark:border-[#333] text-center">
           <p className="text-xs text-neutral-400">任务每天 00:00 (本地时间) 重置</p>
        </div>

      </div>
    </div>
  );
};

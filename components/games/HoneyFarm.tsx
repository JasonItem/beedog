
import React, { useState, useEffect } from 'react';
import { UserProfile, deductCredit, updateFarmData, FarmPlot } from '../../services/userService';
import { saveHighScore } from '../../services/gameService'; // Used for XP Leaderboard
import { audio } from '../../services/audioService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import { Sprout, Clock, Lock, Zap, ArrowUpCircle, ShoppingBasket, Shovel, Info, TrendingUp, Hourglass } from 'lucide-react';

interface HoneyFarmProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
  onLoginRequest: () => void;
}

// Crop Configuration
interface CropType {
  id: string;
  name: string;
  icon: string;
  cost: number; // Seed cost
  yield: number; // Sell price
  growthTime: number; // Seconds
  xp: number; // XP gained
  unlockLevel: number;
}

// Updated Stats: 50x Yield, Minimum 5 minutes
const CROPS: CropType[] = [
  { id: 'wheat', name: '小麦', icon: '🌾', cost: 10, yield: 500, growthTime: 300, xp: 10, unlockLevel: 1 }, // 5 mins
  { id: 'carrot', name: '胡萝卜', icon: '🥕', cost: 50, yield: 2500, growthTime: 600, xp: 25, unlockLevel: 2 }, // 10 mins
  { id: 'corn', name: '玉米', icon: '🌽', cost: 200, yield: 10000, growthTime: 1800, xp: 80, unlockLevel: 3 }, // 30 mins
  { id: 'potato', name: '土豆', icon: '🥔', cost: 500, yield: 25000, growthTime: 3600, xp: 200, unlockLevel: 5 }, // 1 hour
  { id: 'rose', name: '玫瑰', icon: '🌹', cost: 1000, yield: 50000, growthTime: 7200, xp: 500, unlockLevel: 8 }, // 2 hours
  { id: 'pumpkin', name: '南瓜', icon: '🎃', cost: 5000, yield: 250000, growthTime: 21600, xp: 2000, unlockLevel: 12 }, // 6 hours
  { id: 'tree', name: '摇钱树', icon: '🌳', cost: 20000, yield: 1000000, growthTime: 86400, xp: 10000, unlockLevel: 20 }, // 24 hours
];

// XP Curve
const getXpForNextLevel = (level: number) => Math.floor(100 * Math.pow(1.2, level - 1));

export const HoneyFarm: React.FC<HoneyFarmProps> = ({ userProfile, onGameOver, onLoginRequest }) => {
  const { refreshProfile } = useAuth();
  
  // Game State
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [selectedCrop, setSelectedCrop] = useState<CropType | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'levelup'} | null>(null);

  // Initialize Data
  useEffect(() => {
    if (userProfile?.farmData) {
        setPlots(userProfile.farmData.plots);
        setLevel(userProfile.farmData.level);
        setXp(userProfile.farmData.xp);
    } else {
        // Fallback or Init for new users (though ensureUserProfile handles this)
        const emptyPlots = Array(9).fill(null).map((_, i) => ({ id: i, cropId: null, plantedAt: 0, status: 'EMPTY' } as FarmPlot));
        setPlots(emptyPlots);
    }
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  // Timer Loop (Update every second to check growth)
  useEffect(() => {
    const interval = setInterval(() => {
        setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const showNotif = (msg: string, type: 'success' | 'error' | 'levelup') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 2000);
  };

  const getPlotStatus = (plot: FarmPlot): 'EMPTY' | 'GROWING' | 'READY' => {
      if (!plot.cropId) return 'EMPTY';
      const crop = CROPS.find(c => c.id === plot.cropId);
      if (!crop) return 'EMPTY';
      
      const elapsed = (now - plot.plantedAt) / 1000;
      return elapsed >= crop.growthTime ? 'READY' : 'GROWING';
  };

  const handlePlotClick = async (plotIndex: number) => {
      if (!userProfile) { onLoginRequest(); return; }
      if (isProcessing) return;

      const plot = plots[plotIndex];
      const status = getPlotStatus(plot);

      // CASE 1: Harvest
      if (status === 'READY') {
          await harvestCrop(plotIndex);
          return;
      }

      // CASE 2: Plant
      if (status === 'EMPTY') {
          if (!selectedCrop) {
              showNotif("请先在下方选择种子", 'error');
          } else if (level < selectedCrop.unlockLevel) {
              showNotif(`等级不足，需 Lv.${selectedCrop.unlockLevel}`, 'error');
          } else {
              await plantCrop(plotIndex, selectedCrop);
          }
          return;
      }

      // CASE 3: Growing info
      if (status === 'GROWING') {
          const crop = CROPS.find(c => c.id === plot.cropId)!;
          const elapsed = (now - plot.plantedAt) / 1000;
          const timeLeft = Math.ceil(crop.growthTime - elapsed);
          showNotif(`还需 ${formatTime(timeLeft)}`, 'success'); 
      }
  };

  const plantCrop = async (plotIndex: number, crop: CropType) => {
      if (credits < crop.cost) {
          showNotif("蜂蜜不足，无法购买种子", 'error');
          return;
      }

      setIsProcessing(true);
      try {
          // Deduct
          const success = await deductCredit(userProfile!.uid, crop.cost);
          if (!success) {
              showNotif("交易失败", 'error');
              return;
          }
          
          setCredits(prev => prev - crop.cost); // Optimistic UI

          // Update Plot
          const newPlots = [...plots];
          newPlots[plotIndex] = {
              ...newPlots[plotIndex],
              cropId: crop.id,
              plantedAt: Date.now(),
              status: 'GROWING'
          };
          setPlots(newPlots);

          // Save
          await updateFarmData(userProfile!.uid, { plots: newPlots });
          await refreshProfile();
          
          audio.playStep();
      } catch (e) {
          console.error(e);
          showNotif("种植失败", 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const harvestCrop = async (plotIndex: number) => {
      setIsProcessing(true);
      try {
          const plot = plots[plotIndex];
          const crop = CROPS.find(c => c.id === plot.cropId)!;
          
          // Logic: Add Credits, Add XP, Clear Plot
          // We use negative deductCredit to add credits
          await deductCredit(userProfile!.uid, -crop.yield);
          
          let newXp = xp + crop.xp;
          let newLevel = level;
          let leveledUp = false;
          
          // Check Level Up
          let xpNeeded = getXpForNextLevel(newLevel);
          while (newXp >= xpNeeded && newLevel < 50) {
              newXp -= xpNeeded;
              newLevel++;
              leveledUp = true;
              xpNeeded = getXpForNextLevel(newLevel);
          }

          const newPlots = [...plots];
          newPlots[plotIndex] = {
              ...newPlots[plotIndex],
              cropId: null,
              plantedAt: 0,
              status: 'EMPTY'
          };

          setPlots(newPlots);
          setCredits(prev => prev + crop.yield);
          setXp(newXp);
          setLevel(newLevel);

          await updateFarmData(userProfile!.uid, {
              plots: newPlots,
              xp: newXp,
              level: newLevel
          });
          
          // Leaderboard update logic
          const powerScore = newLevel * 1000 + newXp;
          await saveHighScore(userProfile!, 'honey_farm', powerScore);

          await refreshProfile();
          
          audio.playScore();
          if (leveledUp) {
              showNotif(`升级了! Lv.${newLevel}`, 'levelup');
              audio.playJump();
          } else {
              showNotif(`收获! +${crop.yield} 蜂蜜`, 'success');
          }

      } catch (e) {
          console.error(e);
          showNotif("收获失败", 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const formatTime = (seconds: number) => {
      if (seconds < 60) return `${seconds}秒`;
      const mins = Math.floor(seconds / 60);
      if (mins < 60) return `${mins}分`;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (remMins === 0) return `${hours}小时`;
      return `${hours}时${remMins}分`;
  };

  const getProgress = (plot: FarmPlot) => {
      if (!plot.cropId) return 0;
      const crop = CROPS.find(c => c.id === plot.cropId)!;
      const elapsed = (now - plot.plantedAt) / 1000;
      return Math.min(100, (elapsed / crop.growthTime) * 100);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto min-h-[600px] bg-[#f0fdf4] rounded-3xl overflow-hidden shadow-2xl border-4 border-green-600 relative font-sans select-none">
        
        {/* Top HUD */}
        <div className="w-full bg-green-600 p-4 pb-12 shadow-md relative z-10">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-green-300 flex items-center justify-center font-black text-green-700 text-lg shadow-sm">
                        {level}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white text-xs font-bold opacity-80">FARM LEVEL</span>
                        <div className="w-24 h-2 bg-green-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-yellow-400 transition-all duration-300" 
                                style={{ width: `${(xp / getXpForNextLevel(level)) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
                <div className="bg-black/20 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10 backdrop-blur-sm">
                    <span>🍯</span>
                    <span className="font-mono font-bold">{credits}</span>
                </div>
            </div>
        </div>

        {/* Farm Grid */}
        <div className="flex-1 w-full bg-[#574128] p-4 relative -mt-6 rounded-t-3xl shadow-inner overflow-y-auto" style={{backgroundImage: 'radial-gradient(#7c5e3a 2px, transparent 2px)', backgroundSize: '16px 16px'}}>
            
            {/* Notification */}
            {notification && (
                <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all transform duration-300 ${notification.type === 'levelup' ? 'scale-125' : ''}`}>
                    <div className={`px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-bold border ${
                        notification.type === 'success' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        notification.type === 'levelup' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                        'bg-red-100 text-red-800 border-red-300'
                    }`}>
                        {notification.type === 'levelup' && <ArrowUpCircle size={18} />}
                        {notification.type === 'error' && <Info size={18} />}
                        {notification.type === 'success' && <Zap size={18} />}
                        {notification.msg}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4">
                {plots.map((plot, idx) => {
                    const status = getPlotStatus(plot);
                    const crop = CROPS.find(c => c.id === plot.cropId);
                    const progress = getProgress(plot);

                    return (
                        <button
                            key={plot.id}
                            onClick={() => handlePlotClick(idx)}
                            disabled={isProcessing}
                            className={`aspect-square rounded-2xl relative overflow-hidden transition-all active:scale-95 shadow-[0_4px_0_rgba(0,0,0,0.2)] border-b-4 border-black/10
                                ${status === 'EMPTY' ? 'bg-[#7c5e3a] hover:bg-[#8b6b43]' : 
                                  status === 'GROWING' ? 'bg-[#5d4037]' : 
                                  'bg-[#86efac] border-green-400 ring-2 ring-green-300'}
                            `}
                        >
                            {status === 'EMPTY' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#a18260] opacity-50">
                                    <Shovel size={24} />
                                    <span className="text-[10px] font-bold mt-1">耕种</span>
                                </div>
                            )}

                            {status === 'GROWING' && crop && (
                                <div className="w-full h-full flex flex-col items-center justify-center relative">
                                    <div className="text-3xl animate-pulse scale-75 opacity-80 filter grayscale">{crop.icon}</div>
                                    <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-400 transition-all duration-1000 linear" style={{width: `${progress}%`}}></div>
                                    </div>
                                    <div className="absolute top-1 right-1">
                                        <Clock size={12} className="text-white/50"/>
                                    </div>
                                </div>
                            )}

                            {status === 'READY' && crop && (
                                <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
                                    <div className="text-4xl drop-shadow-md animate-bounce">{crop.icon}</div>
                                    <div className="absolute top-1 right-1 bg-white text-green-700 text-[10px] font-bold px-1.5 rounded shadow-sm">
                                        READY
                                    </div>
                                    <div className="absolute bottom-1 bg-black/40 text-white text-[10px] px-1 rounded backdrop-blur-sm">
                                        +{crop.yield}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Footer / Seed Bag */}
        <div className="w-full bg-white p-4 border-t border-green-100 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <ShoppingBasket size={18} className="text-green-600"/> 种子袋
                </h3>
                {selectedCrop && (
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        {level < selectedCrop.unlockLevel ? 
                            <span className="text-red-500 font-bold flex items-center gap-1"><Lock size={12}/> 需要 Lv.{selectedCrop.unlockLevel}</span> :
                            <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1"><Zap size={12}/> 点击空地种植</span>
                        }
                    </div>
                )}
            </div>
            
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
                {CROPS.map(crop => {
                    const isLocked = level < crop.unlockLevel;
                    const isSelected = selectedCrop?.id === crop.id;
                    
                    return (
                        <button
                            key={crop.id}
                            onClick={() => setSelectedCrop(crop)}
                            className={`flex-shrink-0 w-28 h-32 rounded-xl border-2 flex flex-col items-center justify-between p-2 relative transition-all
                                ${isLocked ? 'bg-gray-50 border-gray-200 opacity-80 grayscale-[0.8]' : 
                                  isSelected ? 'bg-green-50 border-green-500 shadow-lg transform -translate-y-1' : 
                                  'bg-white border-gray-200 hover:border-green-300'}
                            `}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-1 w-full justify-center border-b border-dashed border-gray-200 pb-1">
                                <span className="text-xl">{crop.icon}</span>
                                <span className="text-xs font-bold text-gray-800">{crop.name}</span>
                            </div>

                            {/* Stats */}
                            <div className="w-full space-y-1 my-1">
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                    <span>成本</span>
                                    <span className="font-mono font-bold text-red-500">-{crop.cost}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                    <span>收益</span>
                                    <span className="font-mono font-bold text-green-600">+{crop.yield}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                                    <span className="flex items-center gap-0.5"><Hourglass size={8}/> 时间</span>
                                    <span className="font-mono">{formatTime(crop.growthTime)}</span>
                                </div>
                            </div>

                            {/* Status Footer */}
                            {isLocked ? (
                                <div className="w-full bg-gray-200 text-gray-500 text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1">
                                    <Lock size={10}/> Lv.{crop.unlockLevel}
                                </div>
                            ) : (
                                <div className={`w-full text-[10px] font-bold py-1 rounded text-center ${isSelected ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>
                                    {isSelected ? '已选择' : '选择'}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Auth Overlay */}
        {!userProfile && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6 text-center">
                <Sprout size={48} className="text-green-400 mb-4" />
                <h3 className="text-2xl font-black text-white mb-2">蜜蜂农场</h3>
                <p className="text-white/80 mb-6 text-sm">
                    种植作物，挂机也能赚蜂蜜！<br/>
                    登录后即可开始经营你的农场。
                </p>
                <Button onClick={onLoginRequest} className="w-full max-w-xs shadow-xl scale-110">
                    立即登录
                </Button>
            </div>
        )}

    </div>
  );
};

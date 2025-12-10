
import React, { useState, useEffect } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Star, Rocket, Pickaxe, Shield, CarFront, Activity, Volleyball, ChevronsUp, Layers, Scissors, CircleDashed, Grid3X3, Users, TrendingUp, Anchor, Maximize, Minimize2, Volume2, VolumeX, BarChart2 } from 'lucide-react';
import { FlappyBee } from './games/FlappyBee';
import { BeeJump } from './games/BeeJump';
import { HoneyMiner } from './games/HoneyMiner';
import { BeeDefense } from './games/BeeDefense';
import { BeeRacing } from './games/BeeRacing';
import { BeeSnake } from './games/BeeSnake';
import { BeeVolley } from './games/BeeVolley';
import { BeeRun } from './games/BeeRun';
import { HoneyStack } from './games/HoneyStack';
import { FudBuster } from './games/FudBuster';
import { BeeEvolution } from './games/BeeEvolution';
import { BeeTileMatch } from './games/BeeTileMatch';
import { BeeSwarm } from './games/BeeSwarm';
import { HoneyClimber } from './games/HoneyClimber';
import { HoneySwing } from './games/HoneySwing';
import { MoonOrDoom } from './games/MoonOrDoom';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, getPlayerCount, GameScore } from '../services/gameService';
import { completeDailyGameMission } from '../services/userService';
import { audio } from '../services/audioService';
import { Button } from './Button';

interface MiniGamesHubProps {
  onLoginRequest: () => void;
}

const GAMES = [
  {
    id: 'moon_doom',
    name: '传奇交易员',
    description: 'Crypto 模拟盘！预测 10 秒后的价格走势 (Moon or Doom)。5倍杠杆，赚取蜂蜜！',
    color: 'from-green-500 to-red-600',
    icon: BarChart2
  },
  {
    id: 'honey_swing',
    name: '蜜蜂摆荡',
    description: '像蜘蛛侠一样飞荡！点击射出蜂蜜绳，利用惯性飞越牛熊市！',
    color: 'from-amber-500 to-orange-700',
    icon: Anchor
  },
  {
    id: 'honey_climber',
    name: '蜂蜜攀登者',
    description: '手速与反应的极限挑战！左右点击躲避红色阴线，快速攀登绿色阳线！',
    color: 'from-green-500 to-emerald-700',
    icon: TrendingUp
  },
  {
    id: 'bee_swarm',
    name: '蜜蜂大军',
    description: '爽快射击跑酷！打破箱子集结蜜蜂僚机，组建无敌舰队！',
    color: 'from-orange-400 to-red-500',
    icon: Users
  },
  {
    id: 'bee_match',
    name: '蜜蜂消消乐',
    description: '羊了个羊同款玩法！在堆叠的牌中找出三张相同的消除，挑战高难度！',
    color: 'from-emerald-400 to-green-600',
    icon: Grid3X3
  },
  {
    id: 'bee_evolution',
    name: '蜜蜂狗进化论',
    description: '合成大西瓜玩法！从蜜蜂卵开始，一步步合成出巨大的蜜蜂狗！',
    color: 'from-amber-300 to-orange-500',
    icon: CircleDashed
  },
  {
    id: 'fud_buster',
    name: 'FUD 粉碎者',
    description: '切碎空头和 FUD 新闻，保卫牛市！千万别切绿色蜡烛！',
    color: 'from-red-500 to-rose-700',
    icon: Scissors
  },
  {
    id: 'flappy_bee',
    name: '笨鸟先飞',
    description: '控制蜜蜂狗穿越障碍，飞得越远越好！',
    color: 'from-sky-400 to-blue-600',
    icon: Rocket
  },
  {
    id: 'honey_stack',
    name: '蜂蜜叠叠乐',
    description: '解压神作！看准时机堆叠蛋糕，挑战最高塔！',
    color: 'from-amber-400 to-yellow-600',
    icon: Layers
  },
  {
    id: 'bee_run',
    name: '重力暴走',
    description: '点击反转重力！在天花板和地板之间极速奔跑，躲避尖刺！',
    color: 'from-blue-500 to-indigo-700',
    icon: ChevronsUp
  },
  {
    id: 'bee_jump',
    name: '飞向月球',
    description: '踩着绿色蜡烛图冲向月球！千万别踩空！',
    color: 'from-green-400 to-emerald-600',
    icon: Rocket
  },
  {
    id: 'honey_miner',
    name: '蜜蜂矿工',
    description: '60秒限时挑战！抓取蜂蜜和钻石，避开垃圾资产。',
    color: 'from-yellow-600 to-amber-800',
    icon: Pickaxe
  },
  {
    id: 'bee_defense',
    name: '保卫狗头',
    description: '点击拍死来袭的蜜蜂！别让 BeeDog 的脸再肿了！',
    color: 'from-red-400 to-red-600',
    icon: Shield
  },
  {
    id: 'bee_racing',
    name: '极速狂飙',
    description: '老司机带带我！左右闪避障碍，收集油桶冲刺！',
    color: 'from-indigo-500 to-purple-700',
    icon: CarFront
  },
  {
    id: 'bee_snake',
    name: '贪吃蛇',
    description: '经典回归！吃蜂蜜变长，小心别咬到尾巴！',
    color: 'from-yellow-500 to-orange-600',
    icon: Activity
  },
  {
    id: 'bee_volley',
    name: '沙滩排球',
    description: '阳光、沙滩、排球！你能同时顶起几个球？',
    color: 'from-cyan-400 to-blue-500',
    icon: Volleyball
  }
];

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [missionMessage, setMissionMessage] = useState<string | null>(null);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Fetch player counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      // Fetch all counts in parallel
      await Promise.all(GAMES.map(async (game) => {
        const count = await getPlayerCount(game.id);
        counts[game.id] = count;
      }));
      setPlayerCounts(counts);
    };
    fetchCounts();
    
    // Sync initial mute state
    setIsMuted(audio.getMuteState());
  }, []);

  const fetchScores = async (gameId: string) => {
    setLoadingLeaderboard(true);
    try {
      const scores = await getLeaderboard(gameId);
      setLeaderboard(scores);
    } catch (error) {
      console.error("Failed to load leaderboard", error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleGameSelect = (id: string) => {
      // Initialize audio on first user interaction
      audio.init();
      setActiveGameId(id);
  };

  const toggleMute = () => {
      const newState = audio.toggleMute();
      setIsMuted(newState);
  };

  useEffect(() => {
    if (activeGameId) {
      fetchScores(activeGameId);
      setMissionMessage(null);
      setIsFullscreen(false); // Reset fullscreen when changing games
    }
  }, [activeGameId]);

  const handleGameOver = async () => {
    if (activeGameId) {
      fetchScores(activeGameId);
      // Refresh count for this game
      const newCount = await getPlayerCount(activeGameId);
      setPlayerCounts(prev => ({...prev, [activeGameId]: newCount}));
      
      // Try to complete mission
      if (user) {
          try {
              const result = await completeDailyGameMission(user.uid);
              if (result.success) {
                  setMissionMessage(`🎉 任务完成！+${result.earned} 蜂蜜`);
                  await refreshProfile();
                  setTimeout(() => setMissionMessage(null), 4000);
              }
          } catch (e) {
              console.error("Mission trigger failed", e);
          }
      }
    }
  };

  const renderGame = () => {
    switch (activeGameId) {
      case 'moon_doom': return <MoonOrDoom userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_swing': return <HoneySwing userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_climber': return <HoneyClimber userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_swarm': return <BeeSwarm userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_match': return <BeeTileMatch userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_evolution': return <BeeEvolution userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'fud_buster': return <FudBuster userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'flappy_bee': return <FlappyBee userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_stack': return <HoneyStack userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_run': return <BeeRun userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_jump': return <BeeJump userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_miner': return <HoneyMiner userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_defense': return <BeeDefense userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_racing': return <BeeRacing userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_snake': return <BeeSnake userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_volley': return <BeeVolley userProfile={userProfile} onGameOver={handleGameOver} />;
      default: return null;
    }
  };

  if (activeGameId) {
    const gameInfo = GAMES.find(g => g.id === activeGameId);
    return (
      <div className={`min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#050505] relative ${isFullscreen ? 'z-[100]' : ''}`}>
        {missionMessage && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] animate-in fade-in slide-in-from-top-4 pointer-events-none">
                <div className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-full shadow-xl border-2 border-white flex items-center gap-2">
                    <Star className="fill-current" size={20}/> {missionMessage}
                </div>
            </div>
        )}

        {/* Fullscreen Overlay Container Logic */}
        <div 
          className={isFullscreen 
            ? "fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center p-4 overflow-y-auto" 
            : "container mx-auto px-4 max-w-4xl"
          }
        >
          {/* Header Controls */}
          {isFullscreen ? (
             <div className="fixed top-6 right-6 z-[110] flex gap-3">
                 <button 
                    onClick={toggleMute}
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg"
                    title={isMuted ? "开启声音" : "静音"}
                 >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                 </button>
                 <button 
                    onClick={() => setIsFullscreen(false)} 
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg group"
                    title="退出全屏"
                 >
                    <Minimize2 size={24} className="group-hover:scale-90 transition-transform" />
                 </button>
             </div>
          ) : (
             <div className="mb-6 flex items-center justify-between">
                <button 
                  onClick={() => setActiveGameId(null)}
                  className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-yellow transition-colors font-bold group px-4 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  返回大厅
                </button>
                
                <div className="flex items-center gap-3">
                   <h2 className="text-xl font-black dark:text-white">{gameInfo?.name}</h2>
                   <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-700"></div>
                   
                   <button 
                      onClick={toggleMute}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400"
                      title={isMuted ? "开启声音" : "静音"}
                   >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                   </button>

                   <button 
                      onClick={() => setIsFullscreen(true)}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                      title="全屏游玩"
                   >
                      <Maximize size={20} className="text-neutral-500 dark:text-neutral-400 group-hover:text-brand-yellow transition-colors" />
                   </button>
                </div>
             </div>
          )}

          {/* Content Grid */}
          <div className={isFullscreen 
              ? "w-full flex justify-center items-center min-h-full" 
              : "grid md:grid-cols-2 gap-8 items-start"
          }>
             {/* Game Rendering Area */}
             <div className={isFullscreen ? "w-full max-w-md flex justify-center" : ""}>
                {renderGame()}
             </div>
             
             {/* Leaderboard (Hidden in Fullscreen) */}
             {!isFullscreen && (
               <div className="bg-white dark:bg-[#161616] rounded-[2rem] p-6 shadow-xl border border-neutral-200 dark:border-[#333]">
                  <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 dark:border-[#333] pb-4">
                     <Trophy className="text-yellow-500 fill-yellow-500" />
                     <h3 className="text-lg font-bold dark:text-white">排行榜 (Top 20)</h3>
                  </div>
                  
                  {loadingLeaderboard ? (
                     <div className="text-center py-10 text-neutral-500">加载中...</div>
                  ) : leaderboard.length === 0 ? (
                     <div className="text-center py-10 text-neutral-500">暂无记录，快来争夺第一名！</div>
                  ) : (
                     <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {leaderboard.map((score, index) => (
                           <div key={`${score.userId}-${index}`} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${userProfile?.uid === score.userId ? 'bg-brand-yellow/10 border-brand-yellow/30' : 'bg-neutral-50 border-neutral-100 dark:bg-[#222] dark:border-[#333]'}`}>
                              <div className="flex items-center gap-3">
                                 <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${index < 3 ? 'text-black' : 'text-neutral-500'} ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-neutral-300' : index === 2 ? 'bg-orange-300' : 'bg-transparent'}`}>
                                    {index + 1}
                                 </div>
                                 <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#333] border border-neutral-200 dark:border-[#444] flex items-center justify-center overflow-hidden shrink-0">
                                    {score.avatarUrl ? <img src={score.avatarUrl} alt={score.nickname} className="w-full h-full object-cover" /> : <span className="text-sm">❓</span>}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-sm dark:text-white max-w-[100px] truncate">{score.nickname}</span>
                                    {userProfile?.uid === score.userId && <span className="text-[10px] text-brand-orange font-bold">我</span>}
                                 </div>
                              </div>
                              <div className="font-mono font-black text-lg text-brand-yellow">{score.score}</div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20 bg-white dark:bg-[#050505]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-yellow/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 border border-brand-yellow/30">
            <Gamepad2 size={14} className="fill-brand-yellow text-brand-yellow" />
            Game Center
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black mb-6 dark:text-white">
             蜜蜂狗 <span className="text-brand-yellow">小游戏中心</span>
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
             无聊了吗？来玩两把！所有分数都会记录在全网排行榜上。<br/>
             <span className="text-brand-yellow font-bold">每日首次游玩可获得 10 蜂蜜奖励！</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
           {GAMES.map(game => (
              <div 
                key={game.id}
                onClick={() => handleGameSelect(game.id)}
                className="group relative bg-white dark:bg-[#161616] rounded-[2rem] overflow-hidden border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              >
                 {/* Player Count Badge */}
                 <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/10">
                    <Users size={12} />
                    <span>{playerCounts[game.id] !== undefined ? playerCounts[game.id] : '-'} 人游玩</span>
                 </div>

                 <div className={`h-40 bg-gradient-to-br ${game.color} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <game.icon size={64} className="text-white opacity-90 drop-shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" />
                 </div>
                 <div className="p-6">
                    <h3 className="text-xl font-black mb-2 dark:text-white truncate">{game.name}</h3>
                    <p className="text-neutral-500 text-sm mb-4 min-h-[40px] line-clamp-2 leading-relaxed">{game.description}</p>
                    <Button size="sm" className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl">
                       <Trophy size={14} className="mr-2" /> 开始挑战
                    </Button>
                 </div>
              </div>
           ))}

           <div className="bg-neutral-50 dark:bg-[#111] rounded-[2.5rem] p-8 border-2 border-dashed border-neutral-200 dark:border-[#333] flex flex-col items-center justify-center text-center min-h-[200px] opacity-60">
              <Star size={48} className="text-neutral-400 mb-4" />
              <h3 className="text-lg font-bold text-neutral-400 mb-1">更多游戏制作中...</h3>
              <p className="text-neutral-500 text-xs">敬请期待更多新游戏</p>
           </div>
        </div>

        {!userProfile && (
           <div className="text-center mt-16 p-6 rounded-2xl bg-neutral-50 dark:bg-[#111] max-w-md mx-auto">
              <p className="text-neutral-500">
                 <button onClick={onLoginRequest} className="text-brand-yellow font-bold hover:underline">登录</button> 以记录分数并在排行榜上展示你的名字！
              </p>
           </div>
        )}
      </div>
    </div>
  );
};

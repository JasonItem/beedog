
import React, { useState, useEffect } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Star, Rocket, Pickaxe, Shield, CarFront, Activity, Volleyball, ChevronsUp, Layers, Scissors, CircleDashed, Grid3X3 } from 'lucide-react';
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
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, GameScore } from '../services/gameService';
import { completeDailyGameMission } from '../services/userService';
import { Button } from './Button';

interface MiniGamesHubProps {
  onLoginRequest: () => void;
}

const GAMES = [
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

  useEffect(() => {
    if (activeGameId) {
      fetchScores(activeGameId);
      setMissionMessage(null);
    }
  }, [activeGameId]);

  const handleGameOver = async () => {
    if (activeGameId) {
      fetchScores(activeGameId);
      
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
      <div className="min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#050505] relative">
        {missionMessage && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4">
                <div className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-full shadow-xl border-2 border-white flex items-center gap-2">
                    <Star className="fill-current" size={20}/> {missionMessage}
                </div>
            </div>
        )}

        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <button 
              onClick={() => setActiveGameId(null)}
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-yellow transition-colors font-bold group px-4 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              返回大厅
            </button>
            <h2 className="text-xl font-black dark:text-white">{gameInfo?.name}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
             <div>{renderGame()}</div>
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
           {GAMES.map(game => (
              <div 
                key={game.id}
                onClick={() => setActiveGameId(game.id)}
                className="group relative bg-white dark:bg-[#161616] rounded-[2.5rem] overflow-hidden border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              >
                 <div className={`h-48 bg-gradient-to-br ${game.color} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <game.icon size={80} className="text-white opacity-90 drop-shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" />
                 </div>
                 <div className="p-8">
                    <h3 className="text-2xl font-black mb-2 dark:text-white">{game.name}</h3>
                    <p className="text-neutral-500 mb-6 min-h-[48px] line-clamp-2">{game.description}</p>
                    <Button size="sm" className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90">
                       <Trophy size={16} className="mr-2" /> 开始挑战
                    </Button>
                 </div>
              </div>
           ))}

           <div className="bg-neutral-50 dark:bg-[#111] rounded-[2.5rem] p-8 border-2 border-dashed border-neutral-200 dark:border-[#333] flex flex-col items-center justify-center text-center min-h-[300px] opacity-60">
              <Star size={48} className="text-neutral-400 mb-4" />
              <h3 className="text-xl font-bold text-neutral-400 mb-2">更多游戏制作中...</h3>
              <p className="text-neutral-500 text-sm">敬请期待更多新游戏</p>
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

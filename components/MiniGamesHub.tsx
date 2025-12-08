
import React, { useState, useEffect } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Star, Rocket, Pickaxe, Shield, CarFront, Activity } from 'lucide-react';
import { FlappyBee } from './games/FlappyBee';
import { BeeJump } from './games/BeeJump';
import { HoneyMiner } from './games/HoneyMiner';
import { BeeDefense } from './games/BeeDefense';
import { BeeRacing } from './games/BeeRacing';
import { BeeSnake } from './games/BeeSnake';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, GameScore } from '../services/gameService';
import { Button } from './Button';

interface MiniGamesHubProps {
  onLoginRequest: () => void;
}

const GAMES = [
  {
    id: 'flappy_bee',
    name: '笨鸟先飞',
    description: '控制 BeeDog 穿越障碍，飞得越远越好！',
    image: '', 
    color: 'bg-sky-400'
  },
  {
    id: 'bee_jump',
    name: '飞向月球',
    description: '踩着绿色蜡烛图冲向月球！千万别踩空！',
    image: '', 
    color: 'bg-green-500'
  },
  {
    id: 'honey_miner',
    name: '蜜蜂矿工',
    description: '60秒限时挑战！抓取蜂蜜和钻石，避开垃圾资产。',
    image: '', 
    color: 'bg-amber-700'
  },
  {
    id: 'bee_defense',
    name: '保卫狗头',
    description: '点击拍死来袭的蜜蜂！别让 BeeDog 的脸再肿了！',
    image: '', 
    color: 'bg-red-500'
  },
  {
    id: 'bee_racing',
    name: '极速狂飙',
    description: '老司机带带我！左右闪避障碍，收集油桶冲刺！',
    image: '',
    color: 'bg-indigo-500'
  },
  {
    id: 'bee_snake',
    name: '贪吃蛇',
    description: '经典回归！吃蜂蜜变长，小心别咬到尾巴！',
    image: '',
    color: 'bg-yellow-600'
  }
];

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({ onLoginRequest }) => {
  const { userProfile } = useAuth();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Fetch leaderboard when game is active or hub loads
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
    // If a game is active, load its leaderboard
    if (activeGameId) {
      fetchScores(activeGameId);
    } else {
      // Default to loading the first game's leaderboard on hub view just for display if needed, 
      // or do nothing.
    }
  }, [activeGameId]);

  const handleGameOver = () => {
    if (activeGameId) {
      fetchScores(activeGameId);
    }
  };

  const renderGame = () => {
    switch (activeGameId) {
      case 'flappy_bee':
        return <FlappyBee userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_jump':
        return <BeeJump userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_miner':
        return <HoneyMiner userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_defense':
        return <BeeDefense userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_racing':
        return <BeeRacing userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_snake':
        return <BeeSnake userProfile={userProfile} onGameOver={handleGameOver} />;
      default:
        return null;
    }
  };

  if (activeGameId) {
    const gameInfo = GAMES.find(g => g.id === activeGameId);
    return (
      <div className="min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#0A0A0A]">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <button 
              onClick={() => setActiveGameId(null)}
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-yellow transition-colors font-bold group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              返回大厅
            </button>
            <h2 className="text-xl font-black dark:text-white">{gameInfo?.name}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
             {/* Game Area */}
             <div>
                {renderGame()}
             </div>

             {/* Leaderboard Area */}
             <div className="bg-white dark:bg-[#161616] rounded-2xl p-6 shadow-lg border border-neutral-200 dark:border-[#333]">
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
                         <div key={`${score.userId}-${index}`} className={`flex items-center justify-between p-3 rounded-xl border ${userProfile?.uid === score.userId ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' : 'bg-neutral-50 border-neutral-100 dark:bg-[#222] dark:border-[#333]'}`}>
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${
                                  index === 0 ? 'bg-yellow-400 text-black' :
                                  index === 1 ? 'bg-neutral-300 text-black' :
                                  index === 2 ? 'bg-orange-300 text-black' :
                                  'bg-transparent text-neutral-500'
                               }`}>
                                  {index + 1}
                               </div>
                               
                               {/* Avatar with Fallback */}
                               <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#333] border border-neutral-200 dark:border-[#444] flex items-center justify-center overflow-hidden shrink-0">
                                  {score.avatarUrl ? (
                                     <img src={score.avatarUrl} alt={score.nickname} className="w-full h-full object-cover" />
                                  ) : (
                                     <div className="w-full h-full flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                                        <span className="text-sm leading-none pt-0.5">❓</span>
                                     </div>
                                  )}
                               </div>

                               <div className="flex flex-col">
                                  <span className="font-bold text-sm dark:text-white max-w-[100px] truncate">{score.nickname}</span>
                                  {userProfile?.uid === score.userId && <span className="text-[10px] text-brand-orange font-bold">我</span>}
                               </div>
                            </div>
                            <div className="font-mono font-bold text-lg text-brand-yellow">
                               {score.score}
                            </div>
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

  // HUB VIEW
  return (
    <div className="min-h-screen pt-32 pb-20 bg-white dark:bg-[#050505]">
      <div className="container mx-auto px-4">
        
        {/* Hub Header */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-yellow/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 border border-brand-yellow/30">
            <Gamepad2 size={14} className="fill-brand-yellow text-brand-yellow" />
            Game Center
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 dark:text-white">
             BeeDog <span className="text-brand-yellow">小游戏中心</span>
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
             无聊了吗？来玩两把！所有分数都会记录在全网排行榜上。
          </p>
        </div>

        {/* Game Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
           {GAMES.map(game => (
              <div 
                key={game.id}
                onClick={() => setActiveGameId(game.id)}
                className="group relative bg-white dark:bg-[#161616] rounded-3xl overflow-hidden border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer"
              >
                 <div className={`h-40 ${game.color} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                    {game.id === 'bee_jump' ? (
                       <Rocket size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500 group-hover:-translate-y-4 group-hover:translate-x-4" />
                    ) : game.id === 'honey_miner' ? (
                       <Pickaxe size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500 group-hover:-rotate-12" />
                    ) : game.id === 'bee_defense' ? (
                       <Shield size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-12" />
                    ) : game.id === 'bee_racing' ? (
                       <CarFront size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500 group-hover:scale-110" />
                    ) : game.id === 'bee_snake' ? (
                       <Activity size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                       <Gamepad2 size={64} className="text-white opacity-80 group-hover:scale-110 transition-transform duration-500" />
                    )}
                 </div>
                 <div className="p-6">
                    <h3 className="text-2xl font-black mb-2 dark:text-white">{game.name}</h3>
                    <p className="text-neutral-500 mb-6 min-h-[48px]">{game.description}</p>
                    <div className="flex items-center justify-between">
                       <Button size="sm" className="w-full">
                          <Trophy size={16} className="mr-2" /> 开始挑战
                       </Button>
                    </div>
                 </div>
              </div>
           ))}

           {/* Coming Soon Card */}
           <div className="bg-neutral-100 dark:bg-[#111] rounded-3xl p-8 border border-neutral-200 dark:border-[#333] opacity-60 flex flex-col items-center justify-center text-center min-h-[300px]">
              <Star size={48} className="text-neutral-400 mb-4" />
              <h3 className="text-xl font-bold text-neutral-400 mb-2">更多游戏制作中...</h3>
              <p className="text-neutral-500 text-sm">敬请期待 BeeDog 跑酷、消除等新游戏</p>
           </div>
        </div>

        {!userProfile && (
           <div className="text-center mt-12">
              <p className="text-neutral-500">
                 <button onClick={onLoginRequest} className="text-brand-yellow font-bold hover:underline">登录</button> 以记录分数并在排行榜上展示你的名字！
              </p>
           </div>
        )}

      </div>
    </div>
  );
};

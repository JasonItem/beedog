
import React, { useState, useEffect } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Star, Rocket, Pickaxe, Shield, CarFront, Activity, Volleyball, ChevronsUp, Layers, Scissors, CircleDashed, Grid3X3, Users, TrendingUp, Anchor, Maximize, Minimize2, Volume2, VolumeX, BarChart2, Ticket, Coins, Utensils, Info, Play, Flame, Zap, MessageSquare, Send, ThumbsUp, Crown, AlertCircle, CheckCircle, CheckCircle2, ChevronDown } from 'lucide-react';
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
import { HoneyScratch } from './games/HoneyScratch';
import { HoneyBurger } from './games/HoneyBurger';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, getPlayerCount, getUserHighScore, GameScore, addGameReview, getGameReviews, GameReview } from '../services/gameService';
import { completeDailyGameMission, claimPerGameDailyReward } from '../services/userService';
import { audio } from '../services/audioService';
import { Button } from './Button';

interface MiniGamesHubProps {
  onLoginRequest: () => void;
}

// Enhanced Game Interface
interface GameData {
  id: string;
  name: string;
  description: string;
  howToPlay: string;
  color: string;
  icon: React.ElementType;
  tags: string[];
  isHoneyGame: boolean; // Involves earning/spending honey directly
  cost?: number;
}

export const GAMES: GameData[] = [
  {
    id: 'honey_burger',
    name: '蜜蜂狗汉堡店',
    description: 'Crypto 亏钱了？来麦当劳打工吧！按照订单制作汉堡，赚取辛苦钱。',
    howToPlay: '根据顾客头顶的气泡，按顺序点击配料。注意时间限制，配错会扣除生命值。',
    color: 'from-amber-500 to-red-600',
    icon: Utensils,
    tags: ['模拟', '手速'],
    isHoneyGame: true
  },
  {
    id: 'honey_scratch',
    name: '蜜蜂刮刮乐',
    description: '运气也是实力的一部分！三种价位，最高赢取 10,000 蜂蜜！',
    howToPlay: '选择刮刮卡价位，支付蜂蜜后刮开涂层。集齐三个相同图案即可获得对应奖励。',
    color: 'from-purple-500 to-indigo-600',
    icon: Ticket,
    tags: ['运气', '休闲'],
    isHoneyGame: true
  },
  {
    id: 'moon_doom',
    name: '传奇交易员',
    description: 'Crypto 模拟盘！预测 10 秒后的价格走势 (Moon or Doom)。',
    howToPlay: '观察K线走势，下注看涨(Moon)或看跌(Doom)。10秒后结算，猜对翻倍，猜错归零。',
    color: 'from-green-500 to-red-600',
    icon: BarChart2,
    tags: ['策略', '模拟'],
    isHoneyGame: true
  },
  {
    id: 'bee_swarm',
    name: '蜜蜂大军',
    description: '爽快射击跑酷！打破箱子集结蜜蜂僚机，组建无敌舰队！',
    howToPlay: '左右滑动控制移动。射击箱子增加蜜蜂数量，射击敌人获得分数。小心躲避红色子弹。',
    color: 'from-orange-400 to-red-500',
    icon: Users,
    tags: ['射击', '跑酷'],
    isHoneyGame: false
  },
  {
    id: 'honey_swing',
    name: '蜜蜂摆荡',
    description: '像蜘蛛侠一样飞荡！点击射出蜂蜜绳，利用惯性飞越牛熊市！',
    howToPlay: '按住屏幕射出绳索钩住支点，松开手指借力飞出。不要掉落到下方红线区域。',
    color: 'from-amber-500 to-orange-700',
    icon: Anchor,
    tags: ['物理', '技巧'],
    isHoneyGame: false
  },
  {
    id: 'honey_climber',
    name: '蜂蜜攀登者',
    description: '手速与反应的极限挑战！左右点击躲避红色阴线，快速攀登绿色阳线！',
    howToPlay: '点击屏幕左侧或右侧进行攀爬。避开红色的树枝，收集能量防止FOMO耗尽。',
    color: 'from-green-500 to-emerald-700',
    icon: TrendingUp,
    tags: ['反应', '街机'],
    isHoneyGame: false
  },
  {
    id: 'bee_match',
    name: '蜜蜂消消乐',
    description: '羊了个羊同款玩法！在堆叠的牌中找出三张相同的消除，挑战高难度！',
    howToPlay: '点击卡牌放入下方卡槽，三个相同图案自动消除。卡槽满7张则游戏失败。',
    color: 'from-emerald-400 to-green-600',
    icon: Grid3X3,
    tags: ['益智', '消除'],
    isHoneyGame: false
  },
  {
    id: 'bee_evolution',
    name: '蜜蜂狗进化论',
    description: '合成大西瓜玩法！从蜜蜂卵开始，一步步合成出巨大的蜜蜂狗！',
    howToPlay: '点击屏幕投放物体，相同等级的物体碰撞会进化成更高级的形态。不要让物体堆满屏幕。',
    color: 'from-amber-300 to-orange-500',
    icon: CircleDashed,
    tags: ['合成', '休闲'],
    isHoneyGame: false
  },
  {
    id: 'fud_buster',
    name: 'FUD 粉碎者',
    description: '切碎空头和 FUD 新闻，保卫牛市！千万别切绿色蜡烛！',
    howToPlay: '滑动屏幕切碎红色的空头、熊和新闻。切到绿色蜡烛会扣除生命值。',
    color: 'from-red-500 to-rose-700',
    icon: Scissors,
    tags: ['动作', '解压'],
    isHoneyGame: false
  },
  {
    id: 'flappy_bee',
    name: '笨鸟先飞',
    description: '控制蜜蜂狗穿越障碍，飞得越远越好！',
    howToPlay: '点击屏幕控制蜜蜂狗向上飞行，穿过绿色管子。撞到管子或地面游戏结束。',
    color: 'from-sky-400 to-blue-600',
    icon: Rocket,
    tags: ['经典', '街机'],
    isHoneyGame: false
  },
  {
    id: 'honey_stack',
    name: '蜂蜜叠叠乐',
    description: '解压神作！看准时机堆叠蛋糕，挑战最高塔！',
    howToPlay: '当移动的方块与下方重合时点击屏幕。未重合的部分会被切掉，方块越来越小。',
    color: 'from-amber-400 to-yellow-600',
    icon: Layers,
    tags: ['节奏', '专注'],
    isHoneyGame: false
  },
  {
    id: 'bee_run',
    name: '重力暴走',
    description: '点击反转重力！在天花板和地板之间极速奔跑，躲避尖刺！',
    howToPlay: '点击屏幕切换重力方向（上下）。躲避障碍物，尽可能跑得更远。',
    color: 'from-blue-500 to-indigo-700',
    icon: ChevronsUp,
    tags: ['跑酷', '反应'],
    isHoneyGame: false
  },
  {
    id: 'bee_jump',
    name: '飞向月球',
    description: '踩着绿色蜡烛图冲向月球！千万别踩空！',
    howToPlay: '左右倾斜手机或点击屏幕左右控制方向。踩在绿色平台上跳跃，掉落则游戏结束。',
    color: 'from-green-400 to-emerald-600',
    icon: Rocket,
    tags: ['技巧', '跳跃'],
    isHoneyGame: false
  },
  {
    id: 'honey_miner',
    name: '蜜蜂矿工',
    description: '60秒限时挑战！抓取蜂蜜和钻石，避开垃圾资产。',
    howToPlay: '点击屏幕发射钩爪。抓取高价值物品（BTC, ETH, 蜂蜜），避开石头。',
    color: 'from-yellow-600 to-amber-800',
    icon: Pickaxe,
    tags: ['经典', '休闲'],
    isHoneyGame: false
  },
  {
    id: 'bee_defense',
    name: '保卫狗头',
    description: '点击拍死来袭的蜜蜂！别让 BeeDog 的脸再肿了！',
    howToPlay: '蜜蜂会从四面八方飞来，点击它们将其消灭。保护中间的狗头不被叮咬。',
    color: 'from-red-400 to-red-600',
    icon: Shield,
    tags: ['塔防', '点击'],
    isHoneyGame: false
  },
  {
    id: 'bee_racing',
    name: '极速狂飙',
    description: '老司机带带我！左右闪避障碍，收集油桶冲刺！',
    howToPlay: '左右滑动控制赛车变道。收集蜂蜜加速，撞到障碍物或敌车会减速或游戏结束。',
    color: 'from-indigo-500 to-purple-700',
    icon: CarFront,
    tags: ['赛车', '竞速'],
    isHoneyGame: false
  },
  {
    id: 'bee_snake',
    name: '贪吃蛇',
    description: '经典回归！吃蜂蜜变长，小心别咬到尾巴！',
    howToPlay: '滑动屏幕或使用方向键控制移动。吃掉蜂蜜变长，撞墙或撞到自己游戏结束。',
    color: 'from-yellow-500 to-orange-600',
    icon: Activity,
    tags: ['经典', '益智'],
    isHoneyGame: false
  },
  {
    id: 'bee_volley',
    name: '沙滩排球',
    description: '阳光、沙滩、排球！你能同时顶起几个球？',
    howToPlay: '拖动角色左右移动。用头顶起排球，不要让球落地。球的数量会逐渐增加。',
    color: 'from-cyan-400 to-blue-500',
    icon: Volleyball,
    tags: ['体育', '技巧'],
    isHoneyGame: false
  }
];

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  
  // Layout State
  const [selectedGame, setSelectedGame] = useState<GameData>(GAMES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'REVIEWS'>('LEADERBOARD');
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false); // Mobile Dropdown
  
  // Data State
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [reviews, setReviews] = useState<GameReview[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [userBestScore, setUserBestScore] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);

  // Review Form State
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Date String for Reward Check
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Helper to check if reward claimed
  const isRewardClaimed = (gameId: string) => {
      return userProfile?.dailyGameRewards?.[gameId] === todayStr;
  };

  // Fetch player counts on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(GAMES.map(async (game) => {
        const count = await getPlayerCount(game.id);
        if (isMounted) counts[game.id] = count;
      }));
      if (isMounted) setPlayerCounts(counts);
    };
    fetchCounts();
    setIsMuted(audio.getMuteState());
    return () => { isMounted = false; };
  }, []);

  // Fetch Game Details (Leaderboard + Reviews) when selection changes
  useEffect(() => {
    if (selectedGame) {
      setLoadingData(true);
      // Reset inputs
      setUserRating(5);
      setUserComment('');
      setIsGameSelectorOpen(false); // Close mobile menu on select
      
      Promise.all([
          getLeaderboard(selectedGame.id, 20), // Fetch more to show list
          getGameReviews(selectedGame.id, 50),
          userProfile ? getUserHighScore(selectedGame.id, userProfile.uid) : Promise.resolve(0)
      ]).then(([scores, reviewList, myScore]) => {
          setLeaderboard(scores);
          setReviews(reviewList);
          setUserBestScore(myScore);
          
          // Calculate Average Rating
          if (reviewList.length > 0) {
              const total = reviewList.reduce((sum, r) => sum + r.rating, 0);
              setAvgRating(total / reviewList.length);
          } else {
              setAvgRating(0);
          }
      }).finally(() => {
          setLoadingData(false);
      });
    }
  }, [selectedGame, userProfile]);

  const showNotif = (msg: string, type: 'success' | 'error') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const toggleMute = () => {
      const newState = audio.toggleMute();
      setIsMuted(newState);
  };

  const handleGameStart = () => {
      audio.init();
      setIsPlaying(true);
  };

  const handleGameOver = async () => {
    if (selectedGame) {
      // Refresh Data (Leaderboard only mainly needed for score update)
      const [scores, newCount] = await Promise.all([
          getLeaderboard(selectedGame.id, 20),
          getPlayerCount(selectedGame.id)
      ]);
      setLeaderboard(scores);
      setPlayerCounts(prev => ({...prev, [selectedGame.id]: newCount}));
      
      // Update User Best (Optimistic)
      if(userProfile) {
          const myBest = await getUserHighScore(selectedGame.id, userProfile.uid);
          setUserBestScore(myBest);
      }

      // Mission Logic
      if (user) {
          try {
              let earnedTotal = 0;
              let msgs = [];
              const globalRes = await completeDailyGameMission(user.uid);
              if (globalRes.success) {
                  earnedTotal += globalRes.earned;
                  msgs.push("每日首玩");
              }
              const gameRes = await claimPerGameDailyReward(user.uid, selectedGame.id);
              if (gameRes.success) {
                  earnedTotal += gameRes.earned;
                  msgs.push("本游戏奖励");
              }
              if (earnedTotal > 0) {
                  const title = msgs.join(" & ");
                  showNotif(`🎉 ${title}完成！+${earnedTotal} 蜂蜜`, 'success');
                  await refreshProfile();
              }
          } catch (e) {
              console.error("Mission failed", e);
          }
      }
    }
  };

  const handleSubmitReview = async () => {
      if (!userProfile || !selectedGame || !userComment.trim()) return;
      
      setSubmittingReview(true);
      try {
          const newReview = await addGameReview(userProfile, selectedGame.id, userRating, userComment);
          
          // Update local list (optimistic add/replace)
          const updatedReviews = [newReview, ...reviews.filter(r => r.userId !== userProfile.uid)];
          setReviews(updatedReviews);
          
          // Recalc Avg
          const total = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
          setAvgRating(total / updatedReviews.length);
          
          setUserComment('');
          showNotif("评价发布成功！", 'success');
      } catch (e: any) {
          console.error("Failed to post review", e);
          if (e.code === 'permission-denied') {
              showNotif("发布失败：权限不足 (可能是后台限制)", 'error');
          } else {
              showNotif("发布失败，请稍后再试", 'error');
          }
      } finally {
          setSubmittingReview(false);
      }
  };

  // --- RENDER GAME COMPONENT ---
  const renderGame = () => {
    switch (selectedGame.id) {
      case 'honey_burger': return <HoneyBurger userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_scratch': return <HoneyScratch userProfile={userProfile} onGameOver={handleGameOver} />;
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

  // --- FULLSCREEN PLAY MODE ---
  if (isPlaying) {
      return (
        <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center p-4 overflow-hidden animate-in fade-in zoom-in duration-300">
             <div className="absolute top-6 right-6 z-[110] flex gap-3">
                 <button 
                    onClick={toggleMute}
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg"
                 >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                 </button>
                 <button 
                    onClick={() => { 
                        setIsPlaying(false); 
                        audio.init(); 
                        handleGameOver(); // Trigger data refresh on exit
                    }}
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg group"
                 >
                    <Minimize2 size={24} className="group-hover:scale-90 transition-transform" />
                 </button>
             </div>
             
             {notification && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] animate-in fade-in slide-in-from-top-4 pointer-events-none">
                    <div className={`bg-yellow-500 text-black font-bold px-6 py-3 rounded-full shadow-xl border-2 border-white flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-500 text-white' : ''}`}>
                        <Star className="fill-current" size={20}/> {notification.msg}
                    </div>
                </div>
             )}

             <div className="w-full h-full flex items-center justify-center">
                {renderGame()}
             </div>
        </div>
      );
  }

  // --- LOBBY MODE (Split Layout) ---
  return (
    <div className="min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#050505]">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
             <h1 className="text-3xl font-black dark:text-white flex items-center gap-3">
                <Gamepad2 className="text-brand-yellow" size={32}/> 游戏大厅
             </h1>
             <div className="flex gap-2">
                 <button onClick={onLoginRequest} className="md:hidden text-xs bg-neutral-200 dark:bg-[#333] px-3 py-2 rounded-full font-bold dark:text-white">
                    {user ? '已登录' : '登录存档'}
                 </button>
             </div>
        </div>

        {/* MOBILE GAME SELECTOR (Only Visible on Mobile) */}
        <div className="lg:hidden mb-6 relative z-30">
            <button 
                onClick={() => setIsGameSelectorOpen(!isGameSelectorOpen)}
                className="w-full bg-white dark:bg-[#161616] p-4 rounded-2xl shadow-lg border border-neutral-200 dark:border-[#333] flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-yellow text-black`}>
                        <selectedGame.icon size={20} />
                    </div>
                    <div className="text-left">
                        <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider">当前选择</div>
                        <div className="font-bold dark:text-white">{selectedGame.name}</div>
                    </div>
                </div>
                <ChevronDown size={20} className={`transition-transform ${isGameSelectorOpen ? 'rotate-180' : ''} text-neutral-400`}/>
            </button>

            {/* Dropdown Menu */}
            {isGameSelectorOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#161616] rounded-2xl shadow-2xl border border-neutral-200 dark:border-[#333] overflow-hidden max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                    {GAMES.map(game => (
                        <button
                            key={game.id}
                            onClick={() => setSelectedGame(game)}
                            className={`w-full p-3 flex items-center gap-3 border-b border-neutral-100 dark:border-[#222] last:border-0 active:bg-neutral-100 dark:active:bg-[#222] transition-colors
                                ${selectedGame.id === game.id ? 'bg-brand-yellow/10 dark:bg-brand-yellow/20' : ''}
                            `}
                        >
                            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-[#333] flex items-center justify-center text-neutral-500">
                                <game.icon size={16}/>
                            </div>
                            <div className="flex-1 text-left flex justify-between items-center">
                                <div>
                                    <div className={`font-bold text-sm ${selectedGame.id === game.id ? 'text-brand-yellow' : 'dark:text-white'}`}>{game.name}</div>
                                    {game.isHoneyGame && <div className="text-[10px] text-orange-500 font-bold flex items-center gap-1"><Zap size={8} className="fill-current"/> 赚蜂蜜</div>}
                                </div>
                                {isRewardClaimed(game.id) && <CheckCircle2 size={16} className="text-green-500 fill-green-500/20"/>}
                            </div>
                            {selectedGame.id === game.id && <div className="w-2 h-2 rounded-full bg-brand-yellow"></div>}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Main Grid: items-start prevents height stretching, allowing left side to grow naturally */}
        <div className="grid lg:grid-cols-12 gap-6 items-start relative">
            
            {/* Notification Toast (Lobby) */}
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className={`px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold animate-in slide-in-from-top-2 border ${
                        notification.type === 'success' ? 'bg-green-600 text-white border-green-400' : 'bg-red-600 text-white border-red-400'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                        {notification.msg}
                    </div>
                </div>
            )}

            {/* LEFT SIDE: Game Details Dashboard (col-span-8) - No fixed height */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* 1. Hero Card */}
                <div className={`relative rounded-[2.5rem] overflow-hidden p-8 md:p-12 text-white shadow-2xl transition-all duration-500 bg-gradient-to-br ${selectedGame.color}`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    {/* Honey Badge */}
                    {selectedGame.isHoneyGame && (
                        <div className="absolute top-6 right-6 bg-yellow-400 text-black px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg animate-pulse">
                            <Zap size={14} className="fill-black"/> 赚取蜂蜜
                        </div>
                    )}
                    
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                        {/* Icon */}
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-inner border border-white/30 shrink-0">
                            <selectedGame.icon size={64} className="text-white drop-shadow-md" />
                        </div>
                        
                        <div className="flex-1 text-center md:text-left space-y-4">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">{selectedGame.name}</h2>
                                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                    {selectedGame.tags.map(tag => (
                                        <span key={tag} className="bg-black/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm border border-white/10">
                                            #{tag}
                                        </span>
                                    ))}
                                    {/* Star Rating Badge */}
                                    {avgRating > 0 && (
                                        <span className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1 backdrop-blur-sm border border-white/20">
                                            <Star size={12} className="fill-black"/> {avgRating.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-white/90 text-lg leading-relaxed font-medium max-w-xl">
                                {selectedGame.description}
                            </p>
                            
                            <div className="flex gap-4 justify-center md:justify-start mt-2">
                                <Button 
                                    onClick={handleGameStart}
                                    className="bg-white text-black hover:bg-neutral-100 border-none px-10 py-4 text-xl font-black shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                                >
                                    <Play className="mr-2 fill-black" /> 立即开始
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Info Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Gameplay Guide */}
                    <div className="bg-white dark:bg-[#161616] rounded-3xl p-6 border border-neutral-200 dark:border-[#333] shadow-sm relative overflow-hidden group">
                        {/* Background Decor */}
                        <div className="absolute -bottom-6 -right-6 opacity-5 dark:opacity-10 transition-transform group-hover:scale-110">
                            <selectedGame.icon size={120} className="text-black dark:text-white"/>
                        </div>
                        
                        <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
                            <Info size={20} className="text-blue-500"/> 玩法说明
                        </h3>
                        <p className="text-neutral-600 dark:text-neutral-400 text-base leading-relaxed relative z-10 font-medium">
                            {selectedGame.howToPlay}
                        </p>
                    </div>

                    {/* Leaderboard & Reviews Tabs */}
                    <div className="bg-white dark:bg-[#161616] rounded-3xl p-6 border border-neutral-200 dark:border-[#333] shadow-sm flex flex-col h-[500px]">
                        {/* Tab Switcher */}
                        <div className="flex bg-neutral-100 dark:bg-[#222] p-1 rounded-xl mb-4 shrink-0">
                            <button 
                                onClick={() => setActiveTab('LEADERBOARD')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    activeTab === 'LEADERBOARD' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500'
                                }`}
                            >
                                <Activity size={16}/> 排行榜
                            </button>
                            <button 
                                onClick={() => setActiveTab('REVIEWS')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    activeTab === 'REVIEWS' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500'
                                }`}
                            >
                                <MessageSquare size={16}/> 玩家评价
                            </button>
                        </div>
                        
                        {activeTab === 'LEADERBOARD' ? (
                            <>
                                {/* Active Avatars */}
                                <div className="flex items-center -space-x-3 mb-4 overflow-hidden pl-2 py-2 shrink-0">
                                    {leaderboard.slice(0, 5).map((s, i) => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#161616] relative bg-neutral-200 dark:bg-[#333] overflow-hidden" title={s.nickname}>
                                            {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <span className="flex items-center justify-center h-full w-full text-xs">🐶</span>}
                                        </div>
                                    ))}
                                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#161616] bg-neutral-100 dark:bg-[#222] flex items-center justify-center text-[10px] font-bold text-neutral-500 z-10">
                                        +{Math.max(0, (playerCounts[selectedGame.id] || 0) - 5)}
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-2 pr-1">
                                    {loadingData ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm">加载中...</div>
                                    ) : leaderboard.length === 0 ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm">暂无记录</div>
                                    ) : (
                                        leaderboard.map((s, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-3 hover:bg-neutral-50 dark:hover:bg-[#222] rounded-xl transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 text-center font-black ${idx < 3 ? 'text-yellow-500 text-lg' : 'text-neutral-400'}`}>{idx+1}</span>
                                                    
                                                    {/* Avatar in List */}
                                                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#333] overflow-hidden border border-neutral-100 dark:border-[#444] shrink-0">
                                                        {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">🐶</div>}
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <span className="font-bold dark:text-gray-200 truncate max-w-[100px]">{s.nickname}</span>
                                                    </div>
                                                </div>
                                                <span className="font-mono font-black dark:text-white bg-neutral-100 dark:bg-[#333] px-2 py-1 rounded text-xs">{s.score}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* My Best Score Sticky Footer */}
                                {userProfile && (
                                    <div className="pt-3 border-t border-neutral-100 dark:border-[#333] shrink-0">
                                        <div className="bg-brand-yellow/10 border border-brand-yellow/30 p-3 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Crown size={16} className="text-brand-yellow fill-brand-yellow" />
                                                <span className="text-xs font-bold text-brand-yellow uppercase tracking-wider">我的最佳</span>
                                            </div>
                                            <span className="font-black font-mono text-xl text-brand-yellow">{userBestScore}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* REVIEWS TAB */
                            <div className="flex flex-col flex-1 min-h-0">
                                {/* Review List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1">
                                    {reviews.length === 0 ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm flex flex-col items-center gap-2">
                                            <MessageSquare className="opacity-20" size={32}/>
                                            暂无评价，快来抢沙发！
                                        </div>
                                    ) : (
                                        reviews.map((rev) => (
                                            <div key={rev.userId} className="bg-neutral-50 dark:bg-[#222] p-3 rounded-xl">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-neutral-200 overflow-hidden">
                                                            {rev.avatarUrl ? <img src={rev.avatarUrl} className="w-full h-full object-cover"/> : <span className="flex items-center justify-center h-full w-full text-[10px]">👤</span>}
                                                        </div>
                                                        <span className="text-xs font-bold dark:text-white">{rev.nickname}</span>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} size={10} className={i < rev.rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300 dark:text-neutral-600"} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-neutral-600 dark:text-neutral-300 break-words leading-relaxed">
                                                    {rev.comment}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Review Input */}
                                {user ? (
                                    <div className="pt-3 border-t border-neutral-100 dark:border-[#333] shrink-0">
                                        <div className="flex gap-1 mb-2 justify-center">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button key={star} onClick={() => setUserRating(star)} className="p-1 hover:scale-110 transition-transform">
                                                    <Star size={20} className={star <= userRating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300 dark:text-neutral-600"} />
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={userComment}
                                                onChange={(e) => setUserComment(e.target.value.slice(0, 140))}
                                                placeholder="写下你的评价..." 
                                                className="flex-1 bg-neutral-100 dark:bg-[#222] border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 dark:text-white outline-none"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSubmitReview()}
                                            />
                                            <button 
                                                onClick={handleSubmitReview} 
                                                disabled={!userComment.trim() || submittingReview}
                                                className="bg-yellow-400 text-black p-2 rounded-xl hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-4 border-t border-neutral-100 dark:border-[#333] text-center shrink-0">
                                        <button onClick={onLoginRequest} className="text-xs text-blue-500 hover:underline">登录后发表评价</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: Game List (Desktop Only) - Hidden on Mobile */}
            <div className="hidden lg:flex lg:col-span-4 bg-white dark:bg-[#161616] rounded-[2.5rem] border border-neutral-200 dark:border-[#333] overflow-hidden flex-col shadow-xl lg:sticky lg:top-24 lg:h-[calc(100vh-120px)]">
                <div className="p-6 border-b border-neutral-100 dark:border-[#222] bg-neutral-50/50 dark:bg-[#1a1a1a]">
                    <h3 className="font-black text-lg dark:text-white">所有游戏</h3>
                    <p className="text-xs text-neutral-500 mt-1">选择一款游戏开始挑战</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {GAMES.map(game => (
                        <button
                            key={game.id}
                            onClick={() => setSelectedGame(game)}
                            className={`w-full p-3 rounded-2xl flex items-center gap-4 transition-all duration-300 group text-left border ${
                                selectedGame.id === game.id 
                                ? 'bg-brand-yellow text-black border-brand-yellow shadow-lg scale-[1.02]' 
                                : 'bg-white dark:bg-[#1e1e1e] border-transparent hover:bg-neutral-100 dark:hover:bg-[#252525] dark:text-gray-300'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                selectedGame.id === game.id ? 'bg-black/10' : 'bg-neutral-100 dark:bg-[#333]'
                            }`}>
                                <game.icon size={24} className={selectedGame.id === game.id ? 'text-black' : 'text-neutral-500 dark:text-gray-400'} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{game.name}</div>
                                <div className="flex items-center gap-2 text-xs opacity-70">
                                    <span className="flex items-center gap-1"><Users size={10}/> {playerCounts[game.id] || 0}</span>
                                    {game.isHoneyGame && <span className="flex items-center gap-1 text-orange-600 dark:text-yellow-400 font-bold"><Zap size={10} className="fill-current"/> 赚蜂蜜</span>}
                                </div>
                            </div>
                            
                            {/* Reward Indicator */}
                            {isRewardClaimed(game.id) ? (
                                <div className="text-green-500" title="今日奖励已领">
                                    <CheckCircle2 size={20} className="fill-green-500/20"/>
                                </div>
                            ) : selectedGame.id === game.id && (
                                <div className="w-2 h-2 rounded-full bg-black animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Star, Rocket, Pickaxe, Shield, CarFront, Activity, Volleyball, ChevronsUp, Layers, Scissors, CircleDashed, Grid3X3, Users, TrendingUp, Anchor, Maximize, Minimize2, Volume2, VolumeX, BarChart2, Ticket, Coins, Utensils, Info, Play, Flame, Zap, MessageSquare, Send, ThumbsUp, Crown, AlertCircle, CheckCircle, CheckCircle2, ChevronDown, DollarSign, Bike, Anchor as AnchorIcon, Sprout, Footprints, MousePointer2, Shuffle, ArrowUpCircle } from 'lucide-react';
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
import { HoneySlots } from './games/HoneySlots';
import { BeeKnight } from './games/BeeKnight';
import { HoneyFishing } from './games/HoneyFishing';
import { HoneyFarm } from './games/HoneyFarm';
import { HoneyJump } from './games/HoneyJump';
import { HoneyDozer } from './games/HoneyDozer'; // Imported missing game
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, getPlayerCount, getUserHighScore, GameScore, addGameReview, getGameReviews, GameReview } from '../services/gameService';
import { completeDailyGameMission, claimPerGameDailyReward } from '../services/userService';
import { audio } from '../services/audioService';
import { Button } from './Button';
import { useLanguage } from '../context/LanguageContext';

interface MiniGamesHubProps {
  onLoginRequest: () => void;
}

// Data Structure (Text moved to context dictionary)
export interface GameConfig {
  id: string;
  nameKey: string;
  descKey: string;
  howToPlay: string; // Keep this simple or move to dict too
  color: string;
  icon: React.ElementType;
  tags: string[];
  isHoneyGame: boolean;
}

// FULL LIST OF 23 GAMES
export const GAMES: GameConfig[] = [
  // FEATURED / HIGH QUALITY
  { id: 'honey_jump', nameKey: 'game.honey_jump.name', descKey: 'game.honey_jump.desc', howToPlay: 'Tap/Hold to charge jump.', color: 'from-sky-500 to-blue-600', icon: Footprints, tags: ['Action', 'Skill'], isHoneyGame: false },
  { id: 'honey_farm', nameKey: 'game.honey_farm.name', descKey: 'game.honey_farm.desc', howToPlay: 'Plant seeds, wait, harvest.', color: 'from-green-600 to-emerald-800', icon: Sprout, tags: ['Idle', 'Farm'], isHoneyGame: true },
  { id: 'honey_fishing', nameKey: 'game.honey_fishing.name', descKey: 'game.honey_fishing.desc', howToPlay: 'Cast line, keep fish in bar.', color: 'from-cyan-500 to-blue-700', icon: AnchorIcon, tags: ['Sim', 'Relax'], isHoneyGame: true },
  { id: 'bee_knight', nameKey: 'game.bee_knight.name', descKey: 'game.bee_knight.desc', howToPlay: 'Dodge obstacles, deliver food.', color: 'from-yellow-500 to-amber-700', icon: Bike, tags: ['Runner', 'Action'], isHoneyGame: true },
  
  // CASUAL / ARCADE
  { id: 'flappy_bee', nameKey: 'game.flappy_bee.name', descKey: 'game.flappy_bee.desc', howToPlay: 'Tap to fly.', color: 'from-sky-400 to-indigo-500', icon: Rocket, tags: ['Classic', 'Skill'], isHoneyGame: false },
  { id: 'honey_miner', nameKey: 'game.honey_miner.name', descKey: 'game.honey_miner.desc', howToPlay: 'Aim hook, grab gold.', color: 'from-yellow-600 to-amber-800', icon: Pickaxe, tags: ['Arcade', 'Timing'], isHoneyGame: false },
  { id: 'bee_defense', nameKey: 'game.bee_defense.name', descKey: 'game.bee_defense.desc', howToPlay: 'Tap enemies to defend.', color: 'from-red-500 to-orange-600', icon: Shield, tags: ['Action', 'Defense'], isHoneyGame: false },
  { id: 'bee_racing', nameKey: 'game.bee_racing.name', descKey: 'game.bee_racing.desc', howToPlay: 'Swipe to dodge traffic.', color: 'from-gray-700 to-black', icon: CarFront, tags: ['Racing', 'Reflex'], isHoneyGame: false },
  { id: 'bee_snake', nameKey: 'game.bee_snake.name', descKey: 'game.bee_snake.desc', howToPlay: 'Eat honey, don\'t crash.', color: 'from-green-500 to-emerald-700', icon: Activity, tags: ['Classic', 'Snake'], isHoneyGame: false },
  { id: 'bee_volley', nameKey: 'game.bee_volley.name', descKey: 'game.bee_volley.desc', howToPlay: 'Move to bounce ball.', color: 'from-blue-400 to-indigo-600', icon: Volleyball, tags: ['Sports', 'Physics'], isHoneyGame: false },
  { id: 'bee_run', nameKey: 'game.bee_run.name', descKey: 'game.bee_run.desc', howToPlay: 'Tap to flip gravity.', color: 'from-indigo-600 to-purple-800', icon: ChevronsUp, tags: ['Runner', 'Gravity'], isHoneyGame: false },
  { id: 'honey_stack', nameKey: 'game.honey_stack.name', descKey: 'game.honey_stack.desc', howToPlay: 'Tap to stack blocks.', color: 'from-amber-400 to-orange-600', icon: Layers, tags: ['Timing', 'Casual'], isHoneyGame: false },
  { id: 'fud_buster', nameKey: 'game.fud_buster.name', descKey: 'game.fud_buster.desc', howToPlay: 'Swipe to slice FUD.', color: 'from-red-600 to-rose-800', icon: Scissors, tags: ['Action', 'Ninja'], isHoneyGame: false },
  { id: 'bee_evolution', nameKey: 'game.bee_evolution.name', descKey: 'game.bee_evolution.desc', howToPlay: 'Drop & merge matching balls.', color: 'from-purple-500 to-pink-600', icon: CircleDashed, tags: ['Puzzle', 'Merge'], isHoneyGame: false },
  { id: 'bee_tile_match', nameKey: 'game.bee_tile_match.name', descKey: 'game.bee_tile_match.desc', howToPlay: 'Match 3 tiles to clear.', color: 'from-green-500 to-teal-700', icon: Grid3X3, tags: ['Puzzle', 'Match-3'], isHoneyGame: false },
  { id: 'honey_climber', nameKey: 'game.honey_climber.name', descKey: 'game.honey_climber.desc', howToPlay: 'Tap sides to climb tree.', color: 'from-green-700 to-emerald-900', icon: ArrowUpCircle, tags: ['Arcade', 'Climbing'], isHoneyGame: false },
  { id: 'honey_swing', nameKey: 'game.honey_swing.name', descKey: 'game.honey_swing.desc', howToPlay: 'Hold to swing, release to fly.', color: 'from-orange-500 to-red-600', icon: Anchor, tags: ['Physics', 'Skill'], isHoneyGame: false },
  
  // GAMBLING / LUCK
  { id: 'honey_slots', nameKey: 'game.honey_slots.name', descKey: 'game.honey_slots.desc', howToPlay: 'Bet honey, spin to win.', color: 'from-yellow-600 to-amber-900', icon: DollarSign, tags: ['Luck', 'Casino'], isHoneyGame: true },
  { id: 'honey_burger', nameKey: 'game.honey_burger.name', descKey: 'game.honey_burger.desc', howToPlay: 'Assemble ingredients correctly.', color: 'from-amber-500 to-red-600', icon: Utensils, tags: ['Sim', 'Speed'], isHoneyGame: true },
  { id: 'honey_scratch', nameKey: 'game.honey_scratch.name', descKey: 'game.honey_scratch.desc', howToPlay: 'Scratch to match 3 symbols.', color: 'from-purple-500 to-indigo-600', icon: Ticket, tags: ['Luck', 'Casual'], isHoneyGame: true },
  { id: 'moon_doom', nameKey: 'game.moon_doom.name', descKey: 'game.moon_doom.desc', howToPlay: 'Predict price movement.', color: 'from-green-500 to-red-600', icon: BarChart2, tags: ['Sim', 'Crypto'], isHoneyGame: true },
  { id: 'bee_swarm', nameKey: 'game.bee_swarm.name', descKey: 'game.bee_swarm.desc', howToPlay: 'Shoot enemies, gather swarm.', color: 'from-orange-400 to-red-500', icon: Users, tags: ['Shooter', 'Action'], isHoneyGame: false },
  { id: 'honey_dozer', nameKey: 'game.honey_dozer.name', descKey: 'game.honey_dozer.desc', howToPlay: 'Drop coins, push prizes.', color: 'from-yellow-500 to-amber-600', icon: Coins, tags: ['Arcade', 'Luck'], isHoneyGame: true },
];

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const fullscreenRef = useRef<HTMLDivElement>(null);
  
  // Layout State
  const [selectedGameConfig, setSelectedGameConfig] = useState<GameConfig>(GAMES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'REVIEWS'>('LEADERBOARD');
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false);
  
  // Data State
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [reviews, setReviews] = useState<GameReview[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [userBestScore, setUserBestScore] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);

  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const isRewardClaimed = (gameId: string) => {
      return userProfile?.dailyGameRewards?.[gameId] === todayStr;
  };

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

  useEffect(() => {
    if (selectedGameConfig) {
      setLoadingData(true);
      setUserRating(5);
      setUserComment('');
      setIsGameSelectorOpen(false);
      
      Promise.all([
          getLeaderboard(selectedGameConfig.id, 20),
          getGameReviews(selectedGameConfig.id, 50),
          userProfile ? getUserHighScore(selectedGameConfig.id, userProfile.uid) : Promise.resolve(0)
      ]).then(([scores, reviewList, myScore]) => {
          setLeaderboard(scores);
          setReviews(reviewList);
          setUserBestScore(myScore);
          
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
  }, [selectedGameConfig, userProfile]);

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
      if (fullscreenRef.current) {
          fullscreenRef.current.requestFullscreen().catch(err => {
              console.log("Fullscreen request denied or not supported:", err);
          });
      }
  };

  useEffect(() => {
      const handleFsChange = () => {
          if (!document.fullscreenElement) {
              // handle exit
          }
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleGameOver = async () => {
    if (selectedGameConfig) {
      const [scores, newCount] = await Promise.all([
          getLeaderboard(selectedGameConfig.id, 20),
          getPlayerCount(selectedGameConfig.id)
      ]);
      setLeaderboard(scores);
      setPlayerCounts(prev => ({...prev, [selectedGameConfig.id]: newCount}));
      
      if(userProfile) {
          const myBest = await getUserHighScore(selectedGameConfig.id, userProfile.uid);
          setUserBestScore(myBest);
      }

      if (user) {
          try {
              let earnedTotal = 0;
              let msgs = [];
              const globalRes = await completeDailyGameMission(user.uid);
              if (globalRes.success) {
                  earnedTotal += globalRes.earned;
                  msgs.push("Daily Play");
              }
              const gameRes = await claimPerGameDailyReward(user.uid, selectedGameConfig.id);
              if (gameRes.success) {
                  earnedTotal += gameRes.earned;
                  msgs.push("Game Reward");
              }
              if (earnedTotal > 0) {
                  showNotif(`🎉 +${earnedTotal} Honey`, 'success');
                  await refreshProfile();
              }
          } catch (e) {
              console.error("Mission failed", e);
          }
      }
    }
  };

  const handleSubmitReview = async () => {
      if (!userProfile || !selectedGameConfig || !userComment.trim()) return;
      setSubmittingReview(true);
      try {
          const newReview = await addGameReview(userProfile, selectedGameConfig.id, userRating, userComment);
          const updatedReviews = [newReview, ...reviews.filter(r => r.userId !== userProfile.uid)];
          setReviews(updatedReviews);
          const total = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
          setAvgRating(total / updatedReviews.length);
          setUserComment('');
          showNotif("Review Posted!", 'success');
      } catch (e: any) {
          showNotif("Failed to post review", 'error');
      } finally {
          setSubmittingReview(false);
      }
  };

  const renderGame = () => {
    switch (selectedGameConfig.id) {
      case 'honey_jump': return <HoneyJump userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_farm': return <HoneyFarm userProfile={userProfile} onGameOver={handleGameOver} onLoginRequest={onLoginRequest} />;
      case 'honey_fishing': return <HoneyFishing userProfile={userProfile} onGameOver={handleGameOver} onLoginRequest={onLoginRequest} />;
      case 'bee_knight': return <BeeKnight userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'flappy_bee': return <FlappyBee userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_miner': return <HoneyMiner userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_defense': return <BeeDefense userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_racing': return <BeeRacing userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_snake': return <BeeSnake userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_volley': return <BeeVolley userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_run': return <BeeRun userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_stack': return <HoneyStack userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'fud_buster': return <FudBuster userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_evolution': return <BeeEvolution userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_tile_match': return <BeeTileMatch userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_climber': return <HoneyClimber userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_swing': return <HoneySwing userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_slots': return <HoneySlots userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_burger': return <HoneyBurger userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_scratch': return <HoneyScratch userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'moon_doom': return <MoonOrDoom userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'bee_swarm': return <BeeSwarm userProfile={userProfile} onGameOver={handleGameOver} />;
      case 'honey_dozer': return <HoneyDozer userProfile={userProfile} onGameOver={handleGameOver} />;
      default: return <div className="text-white">Game Not Found</div>;
    }
  };

  if (isPlaying) {
      return (
        <div 
            ref={fullscreenRef}
            className="fixed inset-0 z-[200] bg-[#050505] flex flex-col animate-in fade-in zoom-in duration-300"
        >
             <div className="w-full bg-[#121212] border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between shadow-xl z-[210]">
                 <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedGameConfig.color} flex items-center justify-center text-white shadow-lg`}>
                        <selectedGameConfig.icon size={18} />
                    </div>
                    <div>
                        <div className="font-black text-white text-sm leading-none">{t(selectedGameConfig.nameKey)}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5 font-bold">Playing</div>
                    </div>
                 </div>

                 <div className="flex gap-2">
                     <button onClick={toggleMute} className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-white/10 flex items-center justify-center">
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                     </button>
                     <button onClick={() => { setIsPlaying(false); audio.init(); handleGameOver(); }} className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 flex items-center justify-center">
                        <Minimize2 size={18} />
                     </button>
                 </div>
             </div>
             
             {notification && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[220] w-max max-w-[90%] pointer-events-none flex justify-center">
                    <div className={`px-5 py-2.5 rounded-full shadow-2xl border flex items-center gap-2 font-bold animate-in slide-in-from-top-4 ${notification.type === 'error' ? 'bg-red-600 border-red-400 text-white' : 'bg-green-600 border-green-400 text-white'}`}>
                        {notification.type === 'error' ? <AlertCircle size={16}/> : <Star size={16} className="fill-current"/>}
                        {notification.msg}
                    </div>
                </div>
             )}

             <div className="flex-1 w-full overflow-y-auto custom-scrollbar relative bg-[#050505]">
                 <div className="min-h-full flex flex-col items-center justify-center p-4 pb-20">
                    {renderGame()}
                 </div>
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#050505]">
      <div className="container mx-auto px-4 max-w-7xl">
        
        <div className="flex justify-between items-center mb-6">
             <h1 className="text-3xl font-black dark:text-white flex items-center gap-3">
                <Gamepad2 className="text-brand-yellow" size={32}/> {t('games.lobby')}
             </h1>
             <div className="flex gap-2">
                 <button onClick={onLoginRequest} className="md:hidden text-xs bg-neutral-200 dark:bg-[#333] px-3 py-2 rounded-full font-bold dark:text-white">
                    {user ? t('games.logged_in') : t('games.login_save')}
                 </button>
             </div>
        </div>

        {/* Mobile Dropdown */}
        <div className="lg:hidden mb-6 relative z-30">
            <button 
                onClick={() => setIsGameSelectorOpen(!isGameSelectorOpen)}
                className="w-full bg-white dark:bg-[#161616] p-4 rounded-2xl shadow-lg border border-neutral-200 dark:border-[#333] flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-yellow text-black`}>
                        <selectedGameConfig.icon size={20} />
                    </div>
                    <div className="text-left">
                        <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider">{t('games.select')}</div>
                        <div className="font-bold dark:text-white">{t(selectedGameConfig.nameKey)}</div>
                    </div>
                </div>
                <ChevronDown size={20} className={`transition-transform ${isGameSelectorOpen ? 'rotate-180' : ''} text-neutral-400`}/>
            </button>

            {isGameSelectorOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#161616] rounded-2xl shadow-2xl border border-neutral-200 dark:border-[#333] overflow-hidden max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                    {GAMES.map(game => (
                        <button
                            key={game.id}
                            onClick={() => setSelectedGameConfig(game)}
                            className={`w-full p-3 flex items-center gap-3 border-b border-neutral-100 dark:border-[#222] last:border-0 active:bg-neutral-100 dark:active:bg-[#222] transition-colors
                                ${selectedGameConfig.id === game.id ? 'bg-brand-yellow/10 dark:bg-brand-yellow/20' : ''}
                            `}
                        >
                            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-[#333] flex items-center justify-center text-neutral-500">
                                <game.icon size={16}/>
                            </div>
                            <div className="flex-1 text-left flex justify-between items-center">
                                <div>
                                    <div className={`font-bold text-sm ${selectedGameConfig.id === game.id ? 'text-brand-yellow' : 'dark:text-white'}`}>{t(game.nameKey)}</div>
                                    {game.isHoneyGame && <div className="text-[10px] text-orange-500 font-bold flex items-center gap-1"><Zap size={8} className="fill-current"/> {t('games.earn_honey')}</div>}
                                </div>
                                {isRewardClaimed(game.id) && <CheckCircle2 size={16} className="text-green-500 fill-green-500/20"/>}
                            </div>
                            {selectedGameConfig.id === game.id && <div className="w-2 h-2 rounded-full bg-brand-yellow"></div>}
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start relative">
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className={`px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold animate-in slide-in-from-top-2 border ${notification.type === 'success' ? 'bg-green-600 text-white border-green-400' : 'bg-red-600 text-white border-red-400'}`}>
                        {notification.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                        {notification.msg}
                    </div>
                </div>
            )}

            <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Hero Card */}
                <div className={`relative rounded-[2.5rem] overflow-hidden p-8 md:p-12 text-white shadow-2xl transition-all duration-500 bg-gradient-to-br ${selectedGameConfig.color}`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    {selectedGameConfig.isHoneyGame && (
                        <div className="absolute top-6 right-6 bg-yellow-400 text-black px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg animate-pulse">
                            <Zap size={14} className="fill-black"/> {t('games.earn_honey')}
                        </div>
                    )}
                    
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-inner border border-white/30 shrink-0">
                            <selectedGameConfig.icon size={64} className="text-white drop-shadow-md" />
                        </div>
                        
                        <div className="flex-1 text-center md:text-left space-y-4">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">{t(selectedGameConfig.nameKey)}</h2>
                                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                    {selectedGameConfig.tags.map(tag => (
                                        <span key={tag} className="bg-black/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm border border-white/10">
                                            #{tag}
                                        </span>
                                    ))}
                                    {avgRating > 0 && (
                                        <span className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1 backdrop-blur-sm border border-white/20">
                                            <Star size={12} className="fill-black"/> {avgRating.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-white/90 text-lg leading-relaxed font-medium max-w-xl">
                                {t(selectedGameConfig.descKey)}
                            </p>
                            
                            <div className="flex gap-4 justify-center md:justify-start mt-2">
                                <Button 
                                    onClick={handleGameStart}
                                    className="bg-white text-black hover:bg-neutral-100 border-none px-10 py-4 text-xl font-black shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                                >
                                    <Play className="mr-2 fill-black" /> {t('games.play_now')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-[#161616] rounded-3xl p-6 border border-neutral-200 dark:border-[#333] shadow-sm relative overflow-hidden group">
                        <div className="absolute -bottom-6 -right-6 opacity-5 dark:opacity-10 transition-transform group-hover:scale-110">
                            <selectedGameConfig.icon size={120} className="text-black dark:text-white"/>
                        </div>
                        
                        <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
                            <Info size={20} className="text-blue-500"/> {t('games.how_to_play')}
                        </h3>
                        <p className="text-neutral-600 dark:text-neutral-400 text-base leading-relaxed relative z-10 font-medium">
                            {selectedGameConfig.howToPlay}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-[#161616] rounded-3xl p-6 border border-neutral-200 dark:border-[#333] shadow-sm flex flex-col flex-1 min-h-0">
                        <div className="flex bg-neutral-100 dark:bg-[#222] p-1 rounded-xl mb-4 shrink-0">
                            <button 
                                onClick={() => setActiveTab('LEADERBOARD')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    activeTab === 'LEADERBOARD' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500'
                                }`}
                            >
                                <Activity size={16}/> {t('games.leaderboard')}
                            </button>
                            <button 
                                onClick={() => setActiveTab('REVIEWS')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    activeTab === 'REVIEWS' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-neutral-500'
                                }`}
                            >
                                <MessageSquare size={16}/> {t('games.reviews')}
                            </button>
                        </div>
                        
                        {activeTab === 'LEADERBOARD' ? (
                            <>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-2 pr-1 h-[250px]">
                                    {loadingData ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm">Loading...</div>
                                    ) : leaderboard.length === 0 ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm">No Records</div>
                                    ) : (
                                        leaderboard.map((s, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-3 hover:bg-neutral-50 dark:hover:bg-[#222] rounded-xl transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 text-center font-black ${idx < 3 ? 'text-yellow-500 text-lg' : 'text-neutral-400'}`}>{idx+1}</span>
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
                                {userProfile && (
                                    <div className="pt-3 border-t border-neutral-100 dark:border-[#333] shrink-0">
                                        <div className="bg-brand-yellow/10 border border-brand-yellow/30 p-3 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Crown size={16} className="text-brand-yellow fill-brand-yellow" />
                                                <span className="text-xs font-bold text-brand-yellow uppercase tracking-wider">{t('games.my_best')}</span>
                                            </div>
                                            <span className="font-black font-mono text-xl text-brand-yellow">{userBestScore}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col flex-1 min-h-0">
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1 h-[250px]">
                                    {reviews.length === 0 ? (
                                        <div className="text-center text-neutral-400 py-8 text-sm flex flex-col items-center gap-2">
                                            <MessageSquare className="opacity-20" size={32}/>
                                            No reviews yet. Be the first!
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
                                                placeholder="Your review..." 
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
                                        <button onClick={onLoginRequest} className="text-xs text-blue-500 hover:underline">Login to review</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden lg:flex lg:col-span-4 bg-white dark:bg-[#161616] rounded-[2.5rem] border border-neutral-200 dark:border-[#333] overflow-hidden flex-col shadow-xl lg:sticky lg:top-24 lg:h-[calc(100vh-120px)]">
                <div className="p-6 border-b border-neutral-100 dark:border-[#222] bg-neutral-50/50 dark:bg-[#1a1a1a]">
                    <h3 className="font-black text-lg dark:text-white">{t('games.all_games')}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{t('games.select_hint')}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {GAMES.map(game => (
                        <button
                            key={game.id}
                            onClick={() => setSelectedGameConfig(game)}
                            className={`w-full p-3 rounded-2xl flex items-center gap-4 transition-all duration-300 group text-left border ${
                                selectedGameConfig.id === game.id 
                                ? 'bg-brand-yellow text-black border-brand-yellow shadow-lg scale-[1.02]' 
                                : 'bg-white dark:bg-[#1e1e1e] border-transparent hover:bg-neutral-100 dark:hover:bg-[#252525] dark:text-gray-300'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                selectedGameConfig.id === game.id ? 'bg-black/10' : 'bg-neutral-100 dark:bg-[#333]'
                            }`}>
                                <game.icon size={24} className={selectedGameConfig.id === game.id ? 'text-black' : 'text-neutral-500 dark:text-gray-400'} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{t(game.nameKey)}</div>
                                <div className="flex items-center gap-2 text-xs opacity-70">
                                    <span className="flex items-center gap-1"><Users size={10}/> {playerCounts[game.id] || 0}</span>
                                    {game.isHoneyGame && <span className="flex items-center gap-1 text-orange-600 dark:text-yellow-400 font-bold"><Zap size={10} className="fill-current"/> {t('games.earn_honey')}</span>}
                                </div>
                            </div>
                            
                            {isRewardClaimed(game.id) ? (
                                <div className="text-green-500" title="Reward Claimed">
                                    <CheckCircle2 size={20} className="fill-green-500/20"/>
                                </div>
                            ) : selectedGameConfig.id === game.id && (
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

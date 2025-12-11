
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { updateCumulativeScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Clock, Heart, ChefHat, Check, X as XIcon, Utensils, AlertTriangle, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HoneyBurgerProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Ingredient Types
type IngredientType = 'bun_bottom' | 'patty' | 'cheese' | 'lettuce' | 'honey' | 'bun_top';

const INGREDIENTS: { id: IngredientType; label: string; color: string; icon: string }[] = [
  { id: 'bun_bottom', label: '底包', color: '#f59e0b', icon: '🥯' },
  { id: 'patty', label: '肉饼', color: '#78350f', icon: '🥩' },
  { id: 'cheese', label: '芝士', color: '#fbbf24', icon: '🧀' },
  { id: 'lettuce', label: '生菜', color: '#22c55e', icon: '🥬' },
  { id: 'honey', label: '蜂蜜', color: '#eab308', icon: '🍯' },
  { id: 'bun_top', label: '顶包', color: '#f59e0b', icon: '🥯' },
];

interface Order {
  id: number;
  customer: string;
  recipe: IngredientType[];
  timeLeft: number;
  maxTime: number;
  status: 'waiting' | 'eating' | 'angry'; // visual state
}

const CUSTOMERS = ['🐻', '🐮', '🐸', '🦁', '🐼', '🐨', '🐯', '🐷', '🐵'];

export const HoneyBurger: React.FC<HoneyBurgerProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0); // Session Earnings UI
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [lives, setLives] = useState(3);
  const [currentStack, setCurrentStack] = useState<IngredientType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<{type: 'CORRECT' | 'WRONG', text: string} | null>(null);
  
  // Game Refs for synchronous logic
  const gameRef = useRef({
    difficulty: 1,
    frameCount: 0,
    animationId: 0,
    lastFrameTime: 0,
    isProcessing: false,
    spawnTimer: 0,
    maxOrders: 1,
    isPlaying: false,
    // Critical state mirrored in Ref for Loop/Event access
    lives: 3,
    score: 0,
    orders: [] as Order[]
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const startGame = () => {
    if (!userProfile) return; // Strict check
    
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);

    setGameState('PLAYING');
    setScore(0);
    setLives(3);
    setCombo(0);
    setCurrentStack([]);
    setOrders([]);
    
    // Reset Ref State
    gameRef.current = {
        difficulty: 1,
        frameCount: 0,
        animationId: 0,
        lastFrameTime: performance.now(),
        isProcessing: false,
        spawnTimer: 0,
        maxOrders: 1,
        isPlaying: true,
        lives: 3,
        score: 0,
        orders: []
    };

    loop();
  };

  const endGame = async () => {
    if (gameRef.current.isPlaying === false) return;
    
    gameRef.current.isPlaying = false;
    audio.playGameOver();
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);
    
    if (userProfile && gameRef.current.score > 0) {
        // Await updates to ensure consistency before UI updates
        await updateCumulativeScore(userProfile, 'honey_burger', gameRef.current.score);
        await deductCredit(userProfile.uid, -gameRef.current.score);
        await refreshProfile();
    }
    onGameOver();
  };

  const addIngredient = (type: IngredientType) => {
      if (gameState !== 'PLAYING' || gameRef.current.isProcessing) return;
      
      // Prevent adding anything before bottom bun
      if (currentStack.length === 0 && type !== 'bun_bottom') {
          return;
      }

      // Prevent adding bottom bun if already started
      if (currentStack.length > 0 && type === 'bun_bottom') {
          return; 
      }

      audio.playStep();
      const newStack = [...currentStack, type];
      setCurrentStack(newStack);
      
      // Auto-check if bun_top is added (Finisher)
      if (type === 'bun_top') {
          gameRef.current.isProcessing = true;
          // Small delay for visual completion
          setTimeout(() => processFinishedBurger(newStack), 150);
      }
  };

  const processFinishedBurger = (finalStack: IngredientType[]) => {
      // Find matching order in REF to ensure we have latest
      const matchingOrderIndex = gameRef.current.orders.findIndex(o => 
          JSON.stringify(o.recipe) === JSON.stringify(finalStack)
      );

      if (matchingOrderIndex !== -1) {
          // Success!
          const order = gameRef.current.orders[matchingOrderIndex];
          handleSuccess(order);
      } else {
          // Fail!
          handleMistake('WRONG');
      }
  };

  const handleSuccess = (order: Order) => {
      audio.playScore();
      
      // Calculate earnings
      const basePay = 5;
      const tips = Math.floor((order.timeLeft / order.maxTime) * 10); // Speed tip
      const complexityBonus = order.recipe.length;
      const totalEarn = basePay + tips + complexityBonus;
      
      // Update Ref
      gameRef.current.score += totalEarn;
      // Remove from Ref
      gameRef.current.orders = gameRef.current.orders.filter(o => o.id !== order.id);
      
      // Update UI
      setScore(gameRef.current.score);
      setOrders([...gameRef.current.orders]);
      setCombo(prev => prev + 1);
      setFeedback({ type: 'CORRECT', text: `+${totalEarn} 🍯` });
      
      // Increase difficulty
      gameRef.current.difficulty += 0.1;
      
      // Unlock more order slots
      if (gameRef.current.score > 150) gameRef.current.maxOrders = 3;
      else if (gameRef.current.score > 50) gameRef.current.maxOrders = 2;

      // Force spawn timer to be low so new customer comes instantly
      gameRef.current.spawnTimer = 30; // 0.5s delay

      setCurrentStack([]);
      
      setTimeout(() => {
          gameRef.current.isProcessing = false;
          setFeedback(null);
      }, 500);
  };

  const handleMistake = (reason: 'WRONG' | 'TIMEOUT') => {
      audio.playGameOver(); // Fail sound
      
      // Decrease Life Logic in Ref
      gameRef.current.lives -= 1;
      setLives(gameRef.current.lives); // Sync UI
      
      if (gameRef.current.lives <= 0) {
          endGame();
      } else {
          setCombo(0);
          setFeedback({ type: 'WRONG', text: reason === 'TIMEOUT' ? '超时!' : '配方错误!' });
          
          // Clear plate if wrong
          if (reason === 'WRONG') {
              setCurrentStack([]);
              gameRef.current.isProcessing = false;
          }
          
          setTimeout(() => {
              setFeedback(null);
          }, 800);
      }
  };

  const trashBurger = () => {
      if(gameState === 'PLAYING') {
          audio.playStep();
          setCurrentStack([]);
      }
  }

  const loop = () => {
    if (!gameRef.current.isPlaying) return;
    
    gameRef.current.animationId = requestAnimationFrame(loop);
    
    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    if (elapsed < 16) return; // 60fps cap
    gameRef.current.lastFrameTime = now;

    // 1. Manage Orders Time
    // Working on REF directly
    const currentOrders = gameRef.current.orders;
    const nextOrders: Order[] = [];
    let timeoutTriggered = false;

    for (const o of currentOrders) {
        o.timeLeft -= 1;
        if (o.timeLeft <= 0) {
            timeoutTriggered = true;
        } else {
            nextOrders.push(o);
        }
    }
    
    gameRef.current.orders = nextOrders;

    // Handle Timeout (One at a time to prevent mass death)
    if (timeoutTriggered && !gameRef.current.isProcessing) {
         // We do this check here to avoid React render cycle conflict, 
         // but since we use Ref, we can call logic directly.
         // However, handleMistake calls setState, so we should be careful.
         // Calling it directly is usually fine in RAF unless it triggers cascading updates.
         handleMistake('TIMEOUT');
         if (gameRef.current.lives <= 0) return; // Stop if died
    }

    // 2. Spawn New Orders
    const { maxOrders } = gameRef.current;
    
    if (gameRef.current.orders.length < maxOrders) {
        if (gameRef.current.spawnTimer <= 0) {
            // SPAWN LOGIC
            const diff = gameRef.current.difficulty;
            const recipe: IngredientType[] = ['bun_bottom'];
            const layerCount = Math.min(6, 1 + Math.floor(Math.random() * (1 + diff * 0.4)));
            const midIngredients: IngredientType[] = ['patty', 'cheese', 'lettuce', 'honey'];
            for (let i = 0; i < layerCount; i++) {
                recipe.push(midIngredients[Math.floor(Math.random() * midIngredients.length)]);
            }
            recipe.push('bun_top');
            const maxTime = Math.max(300, 900 - diff * 80); // Faster time drain

            const newOrder: Order = {
                id: Date.now() + Math.random(),
                customer: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
                recipe,
                timeLeft: maxTime,
                maxTime,
                status: 'waiting'
            };
            
            gameRef.current.orders.push(newOrder);
            
            // Reset spawn timer
            gameRef.current.spawnTimer = 100 + Math.random() * 100;
        } else {
            gameRef.current.spawnTimer--;
        }
    }

    // 3. Sync UI
    setOrders([...gameRef.current.orders]);
  };

  // --- RENDER HELPERS ---

  const renderStack = () => {
      return (
          <div className="relative w-48 h-56 flex flex-col-reverse items-center justify-start transition-all">
              {/* Plate */}
              <div className="absolute bottom-0 w-48 h-3 bg-neutral-300 rounded-[50%] border border-neutral-400 shadow-md z-0"></div>
              
              {currentStack.map((ing, index) => {
                  const data = INGREDIENTS.find(i => i.id === ing);
                  const style = {
                      marginBottom: -22, // Tighter overlap
                      zIndex: index + 1,
                      transform: `scale(${1 + Math.sin(index)*0.02}) rotate(${Math.sin(index * 132) * 2}deg)`
                  };
                  return (
                      <div key={index} className="text-6xl drop-shadow-xl transition-all animate-in slide-in-from-top-4 duration-200 filter" style={style}>
                          {data?.icon}
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto h-[600px] bg-[#f8fafc] rounded-3xl overflow-hidden shadow-2xl relative border-4 border-amber-500 select-none font-sans">
        
        {/* Header HUD */}
        <div className="w-full bg-amber-500 p-3 flex justify-between items-center text-white z-30 shadow-md">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <div className="text-[10px] uppercase font-bold opacity-80 leading-none mb-0.5 flex items-center gap-1">
                        <Wallet size={10}/> 钱包
                    </div>
                    <span className="font-mono font-black text-sm">{credits} 🍯</span>
                </div>
                
                <div className="h-6 w-px bg-white/30"></div>

                <div className="flex flex-col">
                    <div className="text-[10px] uppercase font-bold opacity-80 leading-none mb-0.5 flex items-center gap-1">
                        <ChefHat size={10}/> 本局收入
                    </div>
                    <span className="font-mono font-black text-sm text-green-100">+{score}</span>
                </div>
            </div>
            
            {/* Lives */}
            <div className="flex gap-1 bg-black/20 px-3 py-1.5 rounded-full">
                {[...Array(3)].map((_, i) => (
                    <Heart key={i} size={16} className={i < lives ? "fill-red-500 text-red-500" : "text-white/30"} />
                ))}
            </div>
        </div>

        {/* --- KITCHEN RAIL (ORDERS) --- */}
        <div className="w-full bg-neutral-200 border-b-4 border-neutral-300 p-2 min-h-[150px] flex gap-2 items-center overflow-x-auto relative z-20 shadow-inner">
            {/* Ticket Rail (Visual) */}
            <div className="absolute top-0 left-0 w-full h-2 bg-neutral-400 z-30 shadow-sm"></div>
            
            {orders.length === 0 && gameState === 'PLAYING' && (
                <div className="w-full flex items-center justify-center text-neutral-400 text-sm font-bold italic">
                    等待顾客...
                </div>
            )}

            {orders.map((order) => (
                <div key={order.id} className="relative min-w-[90px] w-[90px] bg-white rounded-b-lg shadow-md animate-in slide-in-from-right-10 duration-300 flex flex-col transform origin-top hover:scale-105 transition-transform mt-1">
                    {/* Pin */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-red-700 z-40 shadow-sm"></div>
                    
                    {/* Customer */}
                    <div className="bg-amber-50 p-1 text-center border-b border-amber-100 flex justify-center pt-2">
                        <span className="text-2xl drop-shadow-sm">{order.customer}</span>
                    </div>
                    
                    {/* Recipe Column */}
                    <div className="flex-1 flex flex-col-reverse items-center gap-0.5 p-1 overflow-hidden min-h-[60px]">
                        {order.recipe.map((ing, idx) => {
                            const ingData = INGREDIENTS.find(i => i.id === ing);
                            return (
                                <div key={idx} className="text-sm leading-none" style={{marginBottom: -4, zIndex: idx}}>
                                    {ingData?.icon}
                                </div>
                            );
                        })}
                    </div>

                    {/* Timer Bar */}
                    <div className="h-3 w-full bg-gray-200 mt-1 rounded-b-lg overflow-hidden relative border-t border-gray-100">
                        <div 
                            className={`h-full transition-all duration-200 linear ${
                                order.timeLeft < order.maxTime * 0.3 ? 'bg-red-500' : 
                                order.timeLeft < order.maxTime * 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${(order.timeLeft / order.maxTime) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>

        {/* --- WORKSTATION --- */}
        <div className="flex-1 w-full relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] flex flex-col justify-end pb-4">
            
            {/* Floating Feedback */}
            {feedback && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-max">
                    <div className={`px-6 py-3 rounded-2xl shadow-xl font-black text-xl flex items-center gap-2 animate-in zoom-in fade-in duration-150 ${feedback.type === 'CORRECT' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {feedback.type === 'CORRECT' ? <Check size={24}/> : <XIcon size={24}/>}
                        {feedback.text}
                    </div>
                </div>
            )}

            {/* Burger Stack */}
            <div className="flex justify-center items-end mb-4 z-10 h-64">
                {currentStack.length === 0 ? (
                    <div className="text-neutral-300 font-black text-4xl opacity-20 rotate-[-10deg]">BUILD HERE</div>
                ) : (
                    renderStack()
                )}
            </div>

            {/* Ingredient Controls */}
            <div className="bg-white border-t border-neutral-200 p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                <div className="grid grid-cols-3 gap-2">
                    {INGREDIENTS.map(ing => (
                        <button
                            key={ing.id}
                            onClick={() => addIngredient(ing.id)}
                            disabled={gameState !== 'PLAYING' || gameRef.current.isProcessing}
                            className="relative flex flex-col items-center justify-center bg-white border border-neutral-200 rounded-2xl p-2 shadow-sm active:scale-95 active:bg-amber-50 transition-all group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-50 opacity-50"></div>
                            <span className="text-3xl relative z-10 group-active:scale-110 transition-transform duration-100">{ing.icon}</span>
                            <span className="text-xs font-bold text-neutral-500 mt-1 relative z-10">{ing.label}</span>
                            
                            {/* Highlight bottom bun start */}
                            {currentStack.length === 0 && ing.id === 'bun_bottom' && (
                                <div className="absolute inset-0 border-2 border-amber-400 rounded-2xl animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
                
                {/* Trash Button */}
                <button
                    onClick={trashBurger}
                    disabled={gameState !== 'PLAYING' || currentStack.length === 0}
                    className="w-full mt-3 bg-red-50 text-red-500 font-bold py-3 rounded-xl hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <RotateCcw size={18}/> 倒掉重做 (Trash)
                </button>
            </div>
        </div>

        {/* Start Screen Overlay */}
        {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-50 backdrop-blur-sm">
                <div className="bg-amber-500 p-5 rounded-full mb-6 shadow-2xl border-4 border-white animate-bounce">
                    <Utensils size={48} className="text-white" />
                </div>
                <h1 className="text-5xl font-black mb-2 text-amber-400 drop-shadow-md text-center tracking-tighter">
                    BeeDog<br/>Burger
                </h1>
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md mb-8 text-center border border-white/10">
                    <p className="text-sm text-gray-200 leading-relaxed font-medium">
                        我是练习时长两年半的汉堡练习生。<br/>
                        <span className="text-amber-400 font-bold">观察订单</span> &rarr; <span className="text-green-400 font-bold">组装汉堡</span> &rarr; <span className="text-red-400 font-bold">别让顾客等太久</span>!
                    </p>
                </div>
                
                {!userProfile ? (
                    <div className="bg-red-500/20 border border-red-500 p-4 rounded-xl text-center">
                        <p className="text-red-400 font-bold mb-2 flex items-center justify-center gap-2"><AlertTriangle size={18}/> 未登录</p>
                        <p className="text-sm text-gray-300">请先登录游戏账号，以便记录您的工资（蜂蜜）。</p>
                    </div>
                ) : (
                    <Button onClick={startGame} className="w-full max-w-xs shadow-xl scale-110 bg-gradient-to-r from-amber-500 to-orange-600 border-none px-10 py-4 text-xl font-black rounded-2xl">
                        <Play className="mr-2 fill-current" /> 开始打工
                    </Button>
                )}
            </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white p-6 z-50 animate-in fade-in zoom-in duration-300">
                <div className="text-7xl mb-4 animate-pulse">😭</div>
                <div className="text-4xl font-black mb-2 text-red-500 italic text-center">YOU'RE FIRED!</div>
                <div className="text-sm text-gray-400 mb-8 font-medium">这就是社畜的命运吗...</div>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 w-full max-w-xs mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                    <div className="text-xs text-neutral-500 uppercase font-bold mb-2 tracking-[0.3em]">今日工资</div>
                    <div className="text-6xl font-black text-amber-400 font-mono tracking-tighter">+{score}</div>
                    <div className="text-xs text-amber-600/50 font-bold mt-1">HONEY COINS</div>
                </div>

                <Button onClick={startGame} className="w-full max-w-xs mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold rounded-2xl shadow-lg">
                    <RotateCcw className="mr-2" /> 重新入职
                </Button>
            </div>
        )}

    </div>
  );
};

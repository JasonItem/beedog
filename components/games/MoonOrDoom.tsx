
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { saveScore, getUserHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { TrendingUp, TrendingDown, Clock, Zap, Activity, AlertTriangle, Lock, Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MoonOrDoomProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface PricePoint {
  value: number;
  time: number;
}

const ROUND_DURATION = 10; // seconds

export const MoonOrDoom: React.FC<MoonOrDoomProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // React State (For UI Rendering only)
  const [gameState, setGameState] = useState<'IDLE' | 'LIVE' | 'SETTLING'>('IDLE');
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [betAmount, setBetAmount] = useState<string>('10');
  const [timeLeft, setTimeLeft] = useState(0);
  const [cumulativePnL, setCumulativePnL] = useState(0); // Display value
  const [isSubmitting, setIsSubmitting] = useState(false); // Debounce state
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'win' | 'loss' | 'info'} | null>(null);

  // Constants
  const CANVAS_WIDTH = 320;
  // Reduced height for better mobile fit
  const CANVAS_HEIGHT = 300;
  
  // Mutable Refs (For Game Logic Loop - avoids stale closures)
  const gameRef = useRef({
    state: 'IDLE', 
    priceHistory: [] as PricePoint[],
    basePrice: 1000,
    volatility: 3.0,
    trend: 0,
    lastFrameTime: 0,
    lastTickTime: 0, 
    animationId: 0,
    endTime: 0,
    // Locked Bet Data
    lockedEntryPrice: 0,
    lockedPosition: null as 'MOON' | 'DOOM' | null,
    lockedBetAmount: 0,
    activeUserId: null as string | null, // CRITICAL: Cache User ID to prevent null errors on settlement
    // Tracking
    currentCumulativePnL: 0
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  // Load initial high score / PnL base
  useEffect(() => {
    if (userProfile) {
      getUserHighScore('moon_doom', userProfile.uid).then(score => {
        gameRef.current.currentCumulativePnL = score;
        setCumulativePnL(score);
      });
    }
  }, [userProfile]);

  useEffect(() => {
    // Initialize history with 60 seconds of data
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
        gameRef.current.priceHistory.push({
            value: 1000 + Math.sin(i * 0.2) * 20 + (Math.random() - 0.5) * 10,
            time: now - (60 - i) * 1000
        });
    }
    
    gameRef.current.lastTickTime = performance.now();
    startLoop();

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const startLoop = () => {
      gameRef.current.lastFrameTime = performance.now();
      loop();
  };

  const handleSetAmount = (val: string) => {
      if (val === '') {
          setBetAmount('');
          return;
      }
      const num = parseInt(val);
      if (!isNaN(num)) {
          setBetAmount(num.toString());
      }
  };

  const setMaxBet = () => setBetAmount(credits.toString());
  const setHalfBet = () => setBetAmount(Math.floor(credits / 2).toString());

  const placeBet = async (direction: 'MOON' | 'DOOM') => {
      if (!userProfile) return;
      
      // Strict Check: Prevent double tapping via State or Ref
      if (gameRef.current.state !== 'IDLE' || isSubmitting) return;
      
      const amount = parseInt(betAmount);
      
      if (isNaN(amount) || amount <= 0) {
          setNotification({ msg: "请输入有效的金额", type: 'info' });
          setTimeout(() => setNotification(null), 2000);
          return;
      }

      if (credits < amount) {
          setNotification({ msg: "蜂蜜不足!", type: 'loss' });
          setTimeout(() => setNotification(null), 2000);
          return;
      }

      // CRITICAL: Lock state immediately to prevent race conditions UI side
      setIsSubmitting(true);
      gameRef.current.state = 'SUBMITTING'; 

      // Deduct Margin (Bet) - Now uses Transactional safety
      const success = await deductCredit(userProfile.uid, amount);
      if (!success) {
          gameRef.current.state = 'IDLE'; // Unlock on failure
          setIsSubmitting(false);
          setNotification({ msg: "余额不足或网络错误", type: 'loss' });
          setTimeout(() => setNotification(null), 2000);
          return;
      }
      
      setCredits(prev => prev - amount);
      refreshProfile();

      // Lock In Data to Ref (Critical for Loop access)
      const currentPrice = gameRef.current.priceHistory[gameRef.current.priceHistory.length - 1].value;
      gameRef.current.lockedEntryPrice = currentPrice;
      gameRef.current.lockedPosition = direction;
      gameRef.current.lockedBetAmount = amount;
      gameRef.current.activeUserId = userProfile.uid; // LOCK USER ID HERE
      
      // Update State
      gameRef.current.state = 'LIVE';
      setGameState('LIVE');
      setIsSubmitting(false); // Re-enable (though gameState will likely keep buttons disabled)
      
      setTimeLeft(ROUND_DURATION);
      setNotification(null);
      
      gameRef.current.endTime = Date.now() + ROUND_DURATION * 1000;
      
      audio.playShoot();
  };

  const settleRound = async (finalPrice: number) => {
      // CRITICAL FIX: Ensure we only settle once
      if (gameRef.current.state !== 'LIVE') return;
      
      // Immediately lock state to prevent re-entry in next frame
      gameRef.current.state = 'SETTLING';
      setGameState('SETTLING');
      
      // Use Cached UserID to ensure payout happens even if userProfile prop is temporarily null
      const userId = gameRef.current.activeUserId;
      if (!userId) {
          console.error("Critical: No Active User ID for settlement");
          setGameState('IDLE');
          return;
      }
      
      const { lockedBetAmount, lockedEntryPrice, lockedPosition } = gameRef.current;
      
      // --- PNL CALCULATION (1:1 Ratio) ---
      let finalPnL = 0;
      
      // Check Win Condition
      const isMoonWin = lockedPosition === 'MOON' && finalPrice > lockedEntryPrice;
      const isDoomWin = lockedPosition === 'DOOM' && finalPrice < lockedEntryPrice;
      const isDraw = finalPrice === lockedEntryPrice;

      if (isMoonWin || isDoomWin) {
          finalPnL = lockedBetAmount; // Profit = Bet Amount
      } else if (isDraw) {
          finalPnL = 0; // No profit, no loss
      } else {
          finalPnL = -lockedBetAmount; // Loss = Bet Amount
      }

      const payout = lockedBetAmount + finalPnL; // Return Principal + Profit (or - Loss)

      // Update Local Accumulator (High Water Mark Logic)
      gameRef.current.currentCumulativePnL += finalPnL;
      setCumulativePnL(gameRef.current.currentCumulativePnL);

      // Save PnL to Leaderboard (Always update, even if loss)
      if (userProfile && userProfile.uid === userId) {
          try {
              // Use saveScore instead of saveHighScore to allow negative updates
              await saveScore(userProfile, 'moon_doom', gameRef.current.currentCumulativePnL);
          } catch(e) {
              console.warn("Failed to update leaderboard, ignoring:", e);
          }
      }

      if (finalPnL > 0) {
          audio.playScore();
          setNotification({ msg: `大赚! +${finalPnL} 蜂蜜`, type: 'win' });
      } else if (finalPnL < 0) {
          audio.playGameOver();
          setNotification({ msg: `亏损 ${Math.abs(finalPnL)} 蜂蜜`, type: 'loss' });
      } else {
          setNotification({ msg: "价格未变，退还本金", type: 'info' });
      }

      // Payout to Wallet (Critical: Use cached ID)
      if (payout > 0) {
          await deductCredit(userId, -payout); // Negative deduct adds credits (Transactional safe)
          
          // Only update UI state if the currently viewing user is the one who played
          if (userProfile && userProfile.uid === userId) {
             setCredits(prev => prev + payout);
          }
      }

      refreshProfile();
      onGameOver(); // Trigger global game over callbacks

      // Reset
      gameRef.current.lockedPosition = null;
      gameRef.current.activeUserId = null;
      gameRef.current.state = 'IDLE';
      setGameState('IDLE');
      
      setTimeout(() => setNotification(null), 4000);
  };

  const updatePrice = () => {
      const game = gameRef.current;
      
      if (Math.random() > 0.85) {
          game.trend = (Math.random() - 0.5) * 5; 
      }
      
      // Volatility increases during LIVE game for excitement
      const currentVol = game.state === 'LIVE' ? game.volatility * 1.5 : game.volatility;
      const change = (Math.random() - 0.5) * currentVol + game.trend;
      const lastPrice = game.priceHistory[game.priceHistory.length - 1].value;
      let newPrice = lastPrice + change;
      
      if (newPrice < 500) newPrice += 5;
      if (newPrice > 1500) newPrice -= 5;

      game.priceHistory.push({
          value: newPrice,
          time: Date.now()
      });

      if (game.priceHistory.length > 60) {
          game.priceHistory.shift();
      }
  };

  const drawChart = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background
      ctx.fillStyle = '#09090b'; 
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Grid
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 0; y < CANVAS_HEIGHT; y+=40) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); }
      for (let x = 0; x < CANVAS_WIDTH; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); }
      ctx.stroke();

      const history = gameRef.current.priceHistory;
      if (history.length < 2) return;

      // Auto-Scale
      let min = Infinity, max = -Infinity;
      history.forEach(p => {
          if (p.value < min) min = p.value;
          if (p.value > max) max = p.value;
      });
      const range = max - min || 10;
      const drawMin = min - range * 0.2;
      const drawMax = max + range * 0.2;

      const getY = (val: number) => CANVAS_HEIGHT - ((val - drawMin) / (drawMax - drawMin)) * CANVAS_HEIGHT;
      const getX = (idx: number) => (idx / (history.length - 1)) * CANVAS_WIDTH;

      // Entry Line
      if (gameRef.current.state === 'LIVE' || gameRef.current.state === 'SETTLING') {
          const entryPrice = gameRef.current.lockedEntryPrice;
          const y = getY(entryPrice);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = '#fbbf24';
          ctx.font = '10px monospace';
          ctx.fillText(`ENTRY: ${entryPrice.toFixed(2)}`, 5, y - 5);
      }

      // Chart Line
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].value));
      for (let i = 1; i < history.length; i++) {
          ctx.lineTo(getX(i), getY(history[i].value));
      }
      
      const lastVal = history[history.length-1].value;
      const prevVal = history[history.length-2].value;
      let lineColor = lastVal >= prevVal ? '#22c55e' : '#ef4444';
      
      // Dynamic PnL Color
      if (gameRef.current.state === 'LIVE') {
          const entry = gameRef.current.lockedEntryPrice;
          const pos = gameRef.current.lockedPosition;
          // Simple color logic: Green if winning, Red if losing
          let isWinning = false;
          if (pos === 'MOON') isWinning = lastVal > entry;
          else if (pos === 'DOOM') isWinning = lastVal < entry;
          
          lineColor = isWinning ? '#22c55e' : '#ef4444';
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Area Fill
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.lineTo(0, CANVAS_HEIGHT);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, lineColor === '#22c55e' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Current Price Tag
      const lastY = getY(lastVal);
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH-5, lastY, 4, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = lineColor;
      ctx.fillRect(CANVAS_WIDTH - 70, lastY - 12, 70, 24);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(lastVal.toFixed(2), CANVAS_WIDTH - 5, lastY + 4);
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    
    if (elapsed < 16) return; 
    gameRef.current.lastFrameTime = now;

    // Tick Updates (10 times a second)
    if (now - gameRef.current.lastTickTime > 100) {
        updatePrice();
        gameRef.current.lastTickTime = now;
        
        // Timer Check
        if (gameRef.current.state === 'LIVE') {
            const remaining = Math.max(0, gameRef.current.endTime - Date.now());
            setTimeLeft(Math.ceil(remaining / 1000));
            
            if (remaining <= 0) {
                const history = gameRef.current.priceHistory;
                const finalPrice = history[history.length - 1].value;
                settleRound(finalPrice);
            }
        }
    }

    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawChart(ctx);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-sm mx-auto">
      {/* 1. Top HUD */}
      <div className="w-full bg-neutral-900 rounded-2xl p-3 border border-white/10 shadow-lg">
          <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                  <div className="bg-yellow-500/20 p-1.5 rounded-lg text-yellow-500">
                      <Zap size={16} className="fill-current" />
                  </div>
                  <div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase">余额 Balance</div>
                      <div className="text-lg font-mono font-black text-white leading-none">{credits}</div>
                  </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/5">
                  <Activity size={12} className="text-green-400" />
                  <span className="font-mono font-bold text-green-400 text-xs">$蜜蜂狗</span>
              </div>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <div className="bg-black/40 rounded-xl p-1.5 text-center">
                  <div className="text-[9px] text-neutral-500">本局投入</div>
                  <div className="font-mono text-white font-bold text-sm">{gameState === 'LIVE' ? gameRef.current.lockedBetAmount : '-'}</div>
              </div>
              <div className={`rounded-xl p-1.5 text-center ${cumulativePnL >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                  <div className="text-[9px] text-neutral-500">累计盈亏</div>
                  <div className={`font-mono font-bold text-sm ${cumulativePnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {cumulativePnL > 0 ? '+' : ''}{cumulativePnL}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. Chart Area */}
      <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-800">
        <canvas 
            ref={canvasRef} 
            width={320} 
            height={CANVAS_HEIGHT} 
            className={`w-full h-[${CANVAS_HEIGHT}px] block`}
        />

        {/* Mascot */}
        <div className="absolute top-2 left-2 z-10 opacity-50 text-2xl">
          <img alt="Logo" className="w-8 h-8 relative z-10 transform group-hover:rotate-12 transition-transform" src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" />
        </div>

        {/* Countdown Overlay */}
        {gameState === 'LIVE' && (
            <div className="absolute top-2 right-2 z-10">
                <div className="bg-neutral-900/90 text-white px-2 py-1 rounded-lg border border-white/20 flex items-center gap-2 shadow-xl backdrop-blur-md animate-pulse">
                    <Clock size={14} className="text-white" />
                    <span className="font-mono font-black text-lg">{timeLeft}s</span>
                </div>
            </div>
        )}

        {/* Auth Overlay */}
        {!userProfile && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6 text-center">
                <Lock size={32} className="text-yellow-500 mb-3" />
                <h3 className="font-bold text-white text-lg">需要登录</h3>
                <p className="text-xs text-neutral-400 mb-4">登录后即可参与预测赚取蜂蜜</p>
            </div>
        )}
        
        {/* Notification Toast */}
        {notification && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-max pointer-events-none">
                <div className={`
                    rounded-2xl px-6 py-4 shadow-2xl border-2 flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300
                    ${notification.type === 'win' ? 'bg-green-600 border-green-300 text-white' : 
                      notification.type === 'loss' ? 'bg-red-600 border-red-300 text-white' : 
                      'bg-neutral-800 border-neutral-500 text-white'}
                `}>
                    <div className="flex items-center gap-2">
                        {notification.type === 'win' ? <TrendingUp size={28} /> : notification.type === 'loss' ? <TrendingDown size={28} /> : <AlertTriangle size={28}/>}
                        <span className="font-black text-2xl tracking-tight">{notification.msg}</span>
                    </div>
                    <div className="text-[10px] opacity-80 uppercase font-bold tracking-widest">
                        {notification.type === 'win' ? 'WINNER' : notification.type === 'loss' ? 'TRY AGAIN' : 'DRAW'}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* 3. Control Panel */}
      <div className="w-full space-y-2 bg-neutral-900 p-3 rounded-2xl border border-white/5">
          
          {/* Bet Amount Input */}
          <div className="flex items-center gap-2">
              <div className="bg-neutral-800 rounded-xl p-2 text-neutral-400">
                  <Wallet size={18} />
              </div>
              <div className="flex-1 bg-neutral-800 rounded-xl flex items-center px-3 relative border border-transparent focus-within:border-brand-yellow transition-colors">
                  <input 
                      type="number"
                      value={betAmount}
                      onChange={(e) => handleSetAmount(e.target.value)}
                      placeholder="金额"
                      className={`w-full bg-transparent text-white font-mono font-bold text-lg py-2 focus:outline-none ${parseInt(betAmount) > credits ? 'text-red-500' : ''}`}
                      disabled={gameState !== 'IDLE' || isSubmitting}
                  />
                  <span className="text-[10px] text-neutral-500 font-bold absolute right-3 pointer-events-none">HONEY</span>
              </div>
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100].map(amt => (
                  <button 
                    key={amt}
                    onClick={() => setBetAmount(amt.toString())}
                    disabled={gameState !== 'IDLE' || isSubmitting}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                  >
                    {amt}
                  </button>
              ))}
              <button onClick={setHalfBet} disabled={gameState !== 'IDLE' || isSubmitting} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold py-1.5 rounded-lg transition-colors">1/2</button>
              <button onClick={setMaxBet} disabled={gameState !== 'IDLE' || isSubmitting} className="bg-neutral-800 hover:bg-neutral-700 text-brand-yellow text-[10px] font-bold py-1.5 rounded-lg transition-colors col-span-4">MAX</button>
          </div>

          {/* Big Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                disabled={gameState !== 'IDLE' || isSubmitting || !userProfile || parseInt(betAmount) <= 0 || parseInt(betAmount) > credits}
                onClick={() => placeBet('MOON')}
                className={`group bg-green-600 hover:bg-green-500 active:translate-y-1 border-b-4 border-green-800 active:border-b-0 text-white py-3 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden`}
              >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  {isSubmitting ? <Loader2 className="animate-spin text-white" size={24} /> : <TrendingUp size={24} className="group-hover:scale-110 transition-transform"/>}
                  <span className="font-black text-base">MOON (涨)</span>
                  <span className="text-[9px] opacity-70 font-mono">翻倍 (1:1)</span>
              </button>
              
              <button
                disabled={gameState !== 'IDLE' || isSubmitting || !userProfile || parseInt(betAmount) <= 0 || parseInt(betAmount) > credits}
                onClick={() => placeBet('DOOM')}
                className={`group bg-red-600 hover:bg-red-500 active:translate-y-1 border-b-4 border-red-800 active:border-b-0 text-white py-3 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden`}
              >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  {isSubmitting ? <Loader2 className="animate-spin text-white" size={24} /> : <TrendingDown size={24} className="group-hover:scale-110 transition-transform"/>}
                  <span className="font-black text-base">DOOM (跌)</span>
                  <span className="text-[9px] opacity-70 font-mono">翻倍 (1:1)</span>
              </button>
          </div>
      </div>
    </div>
  );
};

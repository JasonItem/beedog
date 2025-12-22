import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { updateCumulativeScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, Coins, AlertTriangle, TrendingUp, DollarSign, Lock, Loader2, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HoneySlotsProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Configuration
const SYMBOLS = [
  { id: 0, char: '🍒', val: 2, weight: 40 },
  { id: 1, char: '🍋', val: 5, weight: 30 },
  { id: 2, char: '🍇', val: 10, weight: 20 },
  { id: 3, char: '🍯', val: 25, weight: 15 },
  { id: 4, char: '💎', val: 50, weight: 8 },
  { id: 5, char: '7️⃣', val: 100, weight: 4 },
  { id: 6, char: '🐶', val: 500, weight: 1 }, // Jackpot
];

const REEL_COUNT = 3;
const SYMBOL_SIZE = 80;
const REEL_WIDTH = 100;
const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 400; // Visible area
const SPIN_DURATION = 2000; // Base spin time ms

// Paylines (indices in a flat 3x3 grid: 0-8)
// 0 1 2
// 3 4 5
// 6 7 8
const PAYLINES = [
    [0, 1, 2], // Top
    [3, 4, 5], // Middle
    [6, 7, 8], // Bottom
    [0, 4, 8], // Diag 1
    [6, 4, 2]  // Diag 2
];

interface ReelState {
    symbols: number[]; // The strip of symbols
    offsetY: number;   // Current pixel offset
    speed: number;
    state: 'IDLE' | 'SPINNING' | 'STOPPING';
    stopDelay: number; // When to start stopping
    targetIndex: number; // The index to land on (top row)
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    char: string;
}

interface SpinResult {
    grid: number[];
    win: number;
    lines: number[][];
    isWin: boolean;
}

const MiniSlot: React.FC<{ result: SpinResult }> = ({ result }) => {
    return (
        <div className={`
          relative bg-white dark:bg-[#222] rounded-lg p-1.5 border-2 flex flex-col items-center justify-center aspect-square shadow-sm
          ${result.isWin ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-neutral-200 dark:border-[#444]'}
        `}>
            <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-full h-full">
                {result.grid.map((symId, i) => (
                    <div key={i} className="flex items-center justify-center bg-gray-100 dark:bg-[#333] rounded-sm overflow-hidden">
                        <span className="text-base sm:text-lg leading-none select-none">{SYMBOLS[symId].char}</span>
                    </div>
                ))}
            </div>
            {result.win > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg animate-in zoom-in">
                    <div className="text-yellow-400 font-black text-lg drop-shadow-md">+{result.win}</div>
                </div>
            )}
        </div>
    );
};

export const HoneySlots: React.FC<HoneySlotsProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [betAmount, setBetAmount] = useState(10);
  const [sessionWinnings, setSessionWinnings] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'WIN'>('IDLE');
  const [message, setMessage] = useState("准备好赢大奖了吗?");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // 10x Spin State
  const [isTenSpinModalOpen, setIsTenSpinModalOpen] = useState(false);
  const [tenSpinResults, setTenSpinResults] = useState<SpinResult[]>([]);
  const [tenSpinPhase, setTenSpinPhase] = useState<'IDLE' | 'SPINNING' | 'REVEAL'>('IDLE');
  const [tenSpinTotalWin, setTenSpinTotalWin] = useState(0);

  const gameRef = useRef({
    reels: [] as ReelState[],
    particles: [] as Particle[],
    winningLines: [] as number[][], // Array of arrays of indices
    animationId: 0,
    lastFrameTime: 0,
    spinStartTime: 0,
    status: 'IDLE' as 'IDLE' | 'SPINNING' | 'WIN', // Mirror for loop
    currentBetAmount: 10, // Mirror for loop access to avoid stale closure
    lossStreak: 0 // Track consecutive losses for pity system
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
      initGame();
      return () => {
          if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
      };
  }, []);

  const changeBet = (amount: number) => {
      setBetAmount(amount);
      gameRef.current.currentBetAmount = amount;
  };

  const generateReelStrip = () => {
      // Create a long strip of random symbols for visual spinning
      const strip = [];
      for (let i = 0; i < 60; i++) {
          strip.push(Math.floor(Math.random() * SYMBOLS.length));
      }
      return strip;
  };

  const initGame = () => {
      // Initialize Reels
      const reels: ReelState[] = [];
      for (let i = 0; i < REEL_COUNT; i++) {
          reels.push({
              symbols: generateReelStrip(),
              offsetY: 0,
              speed: 0,
              state: 'IDLE',
              stopDelay: i * 500, // Staggered stops
              targetIndex: 0
          });
      }
      gameRef.current.reels = reels;
      gameRef.current.status = 'IDLE';
      loop();
  };

  // RNG Logic
  const getWeightedSymbol = () => {
      const totalWeight = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
      let random = Math.random() * totalWeight;
      for (let i = 0; i < SYMBOLS.length; i++) {
          random -= SYMBOLS[i].weight;
          if (random < 0) return i;
      }
      return 0;
  };

  /**
   * Core Spin Logic (Decoupled from Canvas)
   * Returns the result of a single spin and updates the loss streak ref
   */
  const simulateSpinResult = (bet: number): SpinResult => {
      const resultMatrix: number[][] = [];
      let currentLossStreak = gameRef.current.lossStreak;

      // PITY MECHANISM: Check if user has lost 10 times in a row
      if (currentLossStreak >= 10) {
          // Force a win with low tier symbols
          const lowTierSymbols = [0, 1, 2];
          const winningSymbol = lowTierSymbols[Math.floor(Math.random() * lowTierSymbols.length)];
          
          for(let col=0; col<REEL_COUNT; col++) {
              resultMatrix.push([getWeightedSymbol(), getWeightedSymbol(), getWeightedSymbol()]);
          }
          // Overwrite Middle Row
          for(let col=0; col<REEL_COUNT; col++) {
              resultMatrix[col][1] = winningSymbol;
          }
      } else {
          // Standard RNG
          for(let col=0; col<REEL_COUNT; col++) {
              resultMatrix.push([getWeightedSymbol(), getWeightedSymbol(), getWeightedSymbol()]);
          }
      }

      // Convert Matrix (Col, Row) to Flat Grid (Row, Col) for Payline check
      // Matrix: [[C0R0, C0R1, C0R2], [C1R0, C1R1, C1R2], ...]
      // Grid: [0, 1, 2 (Row0), 3, 4, 5 (Row1), ...]
      const gridValues: number[] = [];
      for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
              gridValues.push(resultMatrix[col][row]);
          }
      }

      // Calculate Win
      let totalWin = 0;
      const winningLines: number[][] = [];

      PAYLINES.forEach(line => {
          const s1 = gridValues[line[0]];
          const s2 = gridValues[line[1]];
          const s3 = gridValues[line[2]];

          if (s1 === s2 && s2 === s3) {
              const symbolData = SYMBOLS[s1];
              totalWin += symbolData.val * bet;
              winningLines.push(line);
          }
      });

      if (totalWin > 0) {
          gameRef.current.lossStreak = 0; // Reset streak
      } else {
          gameRef.current.lossStreak++; // Increment streak
      }

      return {
          grid: gridValues,
          win: totalWin,
          lines: winningLines,
          isWin: totalWin > 0
      };
  };

  const handleSpin = async () => {
      if (gameRef.current.status === 'SPINNING' || isProcessing || isSettling) return;
      if (!userProfile) return;
      if (credits < betAmount) {
          setMessage("蜂蜜不足!");
          return;
      }

      setIsProcessing(true);

      try {
          // Sync Ref Bet Amount just in case
          gameRef.current.currentBetAmount = betAmount;

          // Optimistic update
          setCredits(prev => prev - betAmount);
          
          // Deduct
          const success = await deductCredit(userProfile.uid, betAmount);
          if (!success) {
              setCredits(prev => prev + betAmount); // Revert
              setMessage("扣款失败");
              setIsProcessing(false);
              return;
          }
          refreshProfile();
          
          // Setup Spin
          setGameState('SPINNING');
          gameRef.current.status = 'SPINNING';
          // sessionWinnings is NOT reset here, it accumulates for the session
          setMessage("好运降临...");
          gameRef.current.winningLines = [];
          gameRef.current.spinStartTime = performance.now();

          // --- Determine Outcome ---
          const result = simulateSpinResult(betAmount);
          
          // Map flat grid back to column-based strips for animation
          // grid: 0 1 2 (Row 0), 3 4 5 (Row 1)...
          // reels need: Col 0: [0, 3, 6], Col 1: [1, 4, 7]...
          
          gameRef.current.reels.forEach((reel, colIndex) => {
              reel.state = 'SPINNING';
              reel.speed = 30 + Math.random() * 10;
              const stopIndex = 20 + (colIndex * 10); // Ensure enough runway
              reel.targetIndex = stopIndex;
              
              // Overwrite strip at stop position
              reel.symbols[stopIndex] = result.grid[colIndex];     // Row 0
              reel.symbols[stopIndex + 1] = result.grid[colIndex + 3]; // Row 1
              reel.symbols[stopIndex + 2] = result.grid[colIndex + 6]; // Row 2
          });
          
          audio.playShoot(); // Spin sound

          // Store result to check when animation stops
          // We attach it to the gameRef temporarily or re-calculate at end.
          // Re-calculation at end ensures sync, but we already have it.
          // Let's rely on the reel state matching the result.

      } catch (e) {
          console.error(e);
          setMessage("发生错误");
          setGameState('IDLE');
          gameRef.current.status = 'IDLE';
      } finally {
          setIsProcessing(false);
      }
  };

  const handleTenSpin = async () => {
      if (gameRef.current.status === 'SPINNING' || isProcessing || isSettling) return;
      if (!userProfile) return;
      
      const totalCost = betAmount * 10;
      if (credits < totalCost) {
          setMessage("蜂蜜不足 (需要 " + totalCost + ")");
          return;
      }

      setIsProcessing(true);
      setIsTenSpinModalOpen(true);
      setTenSpinPhase('SPINNING');
      setTenSpinResults([]);
      setTenSpinTotalWin(0);

      try {
          // Optimistic Update
          setCredits(prev => prev - totalCost);
          
          // Deduct
          const success = await deductCredit(userProfile.uid, totalCost);
          if (!success) {
              setCredits(prev => prev + totalCost);
              setIsTenSpinModalOpen(false);
              setMessage("扣款失败");
              setIsProcessing(false);
              return;
          }
          refreshProfile();

          // Calculate 10 Results
          const results: SpinResult[] = [];
          let totalWin = 0;
          
          for(let i=0; i<10; i++) {
              const res = simulateSpinResult(betAmount);
              results.push(res);
              totalWin += res.win;
          }

          setTenSpinResults(results);
          setTenSpinTotalWin(totalWin);
          audio.playShoot(); // Start sound

          // Animation Delay
          setTimeout(async () => {
              setTenSpinPhase('REVEAL');
              
              if (totalWin > 0) {
                  audio.playScore();
                  const newSessionTotal = sessionWinnings + totalWin;
                  setSessionWinnings(newSessionTotal);
                  setCredits(prev => prev + totalWin);

                  // Update Backend
                  try {
                      await updateCumulativeScore(userProfile, 'honey_slots', totalWin);
                      await deductCredit(userProfile.uid, -totalWin); 
                      await refreshProfile();
                  } catch(e) { console.error("Payout failed", e); }
                  
                  // Update Main Game Score if high
                  onGameOver();
              } else {
                  audio.playGameOver();
              }
              
              setIsProcessing(false);
          }, 2000); // 2 seconds spin time

      } catch (e) {
          console.error(e);
          setIsTenSpinModalOpen(false);
          setIsProcessing(false);
      }
  };

  const checkWin = async () => {
      const reels = gameRef.current.reels;
      const gridValues: number[] = [];
      for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
              const reel = reels[col];
              const symbolIndex = reel.targetIndex + row;
              gridValues.push(reel.symbols[symbolIndex]);
          }
      }

      let totalWin = 0;
      const winningLines: number[][] = [];
      const currentBet = gameRef.current.currentBetAmount; // Use Ref value

      PAYLINES.forEach(line => {
          const s1 = gridValues[line[0]];
          const s2 = gridValues[line[1]];
          const s3 = gridValues[line[2]];

          if (s1 === s2 && s2 === s3) {
              const symbolData = SYMBOLS[s1];
              totalWin += symbolData.val * currentBet;
              winningLines.push(line);
          }
      });

      if (totalWin > 0) {
          // Reset Loss Streak on Win
          gameRef.current.lossStreak = 0;

          const newSessionTotal = sessionWinnings + totalWin;
          setSessionWinnings(newSessionTotal);
          setCredits(prev => prev + totalWin);
          setGameState('WIN');
          gameRef.current.status = 'WIN'; // Stop loop logic
          setMessage(`大奖! 赢得 ${totalWin} 蜂蜜!`);
          gameRef.current.winningLines = winningLines;
          
          spawnWinParticles();
          audio.playScore(); 

          if (userProfile) {
            setIsSettling(true);
            try {
                // Update Cumulative Score (Add to existing total on Leaderboard)
                await updateCumulativeScore(userProfile, 'honey_slots', totalWin);
                
                // Add winnings to wallet
                await deductCredit(userProfile.uid, -totalWin); 
                
                await refreshProfile();
            } catch (e) {
                console.error("Payout failed:", e);
            } finally {
                setIsSettling(false);
            }
          }
          onGameOver();
      } else {
          // Increment Loss Streak - Already handled in simulateSpinResult, but for single spin
          // the logic was mixed. Since we use simulateSpinResult now, let's just update UI
          setGameState('IDLE');
          gameRef.current.status = 'IDLE';
          setMessage("再试一次?");
          audio.playStep();
      }
  };

  const spawnWinParticles = () => {
      for(let i=0; i<30; i++) {
          gameRef.current.particles.push({
              x: CANVAS_WIDTH / 2,
              y: CANVAS_HEIGHT / 2,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              life: 60 + Math.random() * 30,
              char: Math.random() > 0.5 ? '💰' : '🍯'
          });
      }
  };

  const drawReel = (ctx: CanvasRenderingContext2D, reelIdx: number, x: number) => {
      const reel = gameRef.current.reels[reelIdx];
      const offsetX = x;
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(offsetX, 50, REEL_WIDTH, SYMBOL_SIZE * 3); // Clip area
      ctx.clip();

      const startIdx = Math.floor(reel.offsetY / SYMBOL_SIZE);
      const endIdx = startIdx + 5; 

      for (let i = startIdx; i < endIdx; i++) {
          const symbolId = reel.symbols[i % reel.symbols.length];
          if (symbolId === undefined) continue;
          
          const symbol = SYMBOLS[symbolId];
          const y = (i * SYMBOL_SIZE) - reel.offsetY + 50; 

          ctx.font = '48px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol.char, offsetX + REEL_WIDTH/2, y + SYMBOL_SIZE/2);
      }

      // Inner Shadow
      const grad = ctx.createLinearGradient(0, 50, 0, 50 + SYMBOL_SIZE*3);
      grad.addColorStop(0, 'rgba(0,0,0,0.5)');
      grad.addColorStop(0.1, 'rgba(0,0,0,0)');
      grad.addColorStop(0.9, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(offsetX, 50, REEL_WIDTH, SYMBOL_SIZE * 3);

      ctx.restore();
      
      if (reelIdx < REEL_COUNT - 1) {
          ctx.fillStyle = '#333';
          ctx.fillRect(offsetX + REEL_WIDTH, 50, 4, SYMBOL_SIZE * 3);
      }
  };

  const drawPaylines = (ctx: CanvasRenderingContext2D) => {
      const lines = gameRef.current.winningLines;
      if (lines.length === 0) return;

      const elapsed = performance.now();
      if (Math.floor(elapsed / 300) % 2 === 0) return; // Blink

      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ef4444';
      ctx.lineCap = 'round';

      lines.forEach(line => {
          const getCoord = (idx: number) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              return {
                  x: 20 + col * (REEL_WIDTH + 4) + REEL_WIDTH/2,
                  y: 50 + row * SYMBOL_SIZE + SYMBOL_SIZE/2
              };
          };

          const p1 = getCoord(line[0]);
          const p2 = getCoord(line[1]);
          const p3 = getCoord(line[2]);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.stroke();
      });
  };

  const loop = () => {
      gameRef.current.animationId = requestAnimationFrame(loop);
      
      const now = performance.now();
      const elapsed = now - gameRef.current.lastFrameTime;
      if (elapsed < 16) return;
      gameRef.current.lastFrameTime = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // --- LOGIC ---
      let allStopped = true;

      gameRef.current.reels.forEach((reel, idx) => {
          if (reel.state === 'SPINNING') {
              allStopped = false;
              if (reel.speed < 40) reel.speed += 1;
              reel.offsetY += reel.speed;

              if (now - gameRef.current.spinStartTime > SPIN_DURATION + reel.stopDelay) {
                  reel.state = 'STOPPING';
              }
          } else if (reel.state === 'STOPPING') {
              allStopped = false;
              const targetY = reel.targetIndex * SYMBOL_SIZE;
              const dist = targetY - reel.offsetY;
              
              if (dist <= 0) {
                  reel.offsetY = targetY;
                  reel.state = 'IDLE';
                  reel.speed = 0;
                  audio.playStep();
                  
                  ctx.save();
                  ctx.translate(0, 5); 
                  ctx.restore();
              } else {
                  reel.speed = Math.max(5, dist * 0.1);
                  reel.offsetY += reel.speed;
              }
          }
      });

      // Check win only if we were spinning and now everything stopped
      if (allStopped && gameRef.current.status === 'SPINNING') {
          // Temporarily set status to avoid re-entry before async checkWin finishes
          gameRef.current.status = 'IDLE'; 
          checkWin();
      }

      // Particles
      for (let i = gameRef.current.particles.length - 1; i >= 0; i--) {
          const p = gameRef.current.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.5;
          p.life--;
          if (p.life <= 0) gameRef.current.particles.splice(i, 1);
      }

      // --- RENDER ---
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.fillStyle = '#fbbf24'; // Gold
      ctx.fillRect(10, 40, CANVAS_WIDTH - 20, SYMBOL_SIZE * 3 + 20);
      
      ctx.fillStyle = '#fff';
      ctx.fillRect(15, 45, CANVAS_WIDTH - 30, SYMBOL_SIZE * 3 + 10);

      gameRef.current.reels.forEach((r, i) => {
          drawReel(ctx, i, 20 + i * (REEL_WIDTH + 4));
      });

      drawPaylines(ctx);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 40, CANVAS_WIDTH - 20, SYMBOL_SIZE * 3 + 20);

      gameRef.current.particles.forEach(p => {
          ctx.font = '24px serif';
          ctx.fillText(p.char, p.x, p.y);
      });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="w-full max-w-sm bg-neutral-900 rounded-xl p-3 border border-yellow-600/30 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2">
              <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-500">
                  <Zap size={20} className="fill-current" />
              </div>
              <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">蜂蜜余额</div>
                  <div className="text-xl font-mono font-black text-white">{credits}</div>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <div className="text-right">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">本局赢得</div>
                  <div className="text-xl font-mono font-black text-green-400">+{sessionWinnings}</div>
              </div>
              <div className="bg-green-500/20 p-2 rounded-lg text-green-500">
                  <TrendingUp size={20} />
              </div>
          </div>
      </div>

      {/* Game Canvas */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-600 bg-neutral-800">
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT} 
            className="block"
          />
          
          {/* Overlay Message */}
          <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none">
              <div className="bg-black/80 text-yellow-400 text-sm font-bold py-2 px-4 inline-block rounded-full border border-yellow-600 animate-pulse">
                  {message}
              </div>
          </div>

          {/* Auth Overlay */}
          {!userProfile && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
                <Lock size={48} className="text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">需要登录</h3>
                <p className="text-sm text-neutral-400 text-center mb-4">登录后即可参与抽奖，赢取海量蜂蜜！</p>
            </div>
          )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          <div className="col-span-2 flex justify-center gap-2 mb-2">
              {[10, 50, 100].map(amt => (
                  <button 
                    key={amt}
                    onClick={() => changeBet(amt)}
                    disabled={gameState === 'SPINNING' || !userProfile || isProcessing || isSettling}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${
                        betAmount === amt 
                        ? 'bg-yellow-500 border-yellow-600 text-black shadow-lg scale-105' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 disabled:opacity-50'
                    }`}
                  >
                      {amt}
                  </button>
              ))}
          </div>

          <Button 
            onClick={handleSpin} 
            disabled={gameState === 'SPINNING' || !userProfile || isProcessing || isSettling}
            className="py-4 text-xl font-black bg-gradient-to-r from-yellow-500 to-orange-600 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              {gameState === 'SPINNING' || isProcessing && !isTenSpinModalOpen ? (
                  <><Loader2 className="animate-spin" size={24}/> 旋转中...</>
              ) : isSettling && !isTenSpinModalOpen ? (
                  <><Loader2 className="animate-spin" size={24}/> 结算...</>
              ) : (
                  <>SPIN <Coins size={20} className="ml-1"/></>
              )}
          </Button>

          <Button 
            onClick={handleTenSpin}
            disabled={gameState === 'SPINNING' || !userProfile || isProcessing || isSettling}
            className="py-4 text-lg font-black bg-purple-600 hover:bg-purple-500 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
             10连抽 <Sparkles size={18}/>
          </Button>
      </div>

      {/* Paytable Hint */}
      <div className="w-full max-w-sm bg-neutral-800/50 rounded-xl p-3 text-xs text-neutral-400">
          <div className="flex justify-between items-center mb-2 font-bold text-neutral-300">
              <span>赔率表</span>
              <span>(3个相同)</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
              {SYMBOLS.map(s => (
                  <div key={s.id} className="bg-neutral-900 rounded p-1">
                      <div className="text-lg">{s.char}</div>
                      <div className="font-mono text-yellow-500">x{s.val}</div>
                  </div>
              ))}
          </div>
      </div>

      {/* 10x Spin Modal */}
      {isTenSpinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
              <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
                  
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-black text-white flex items-center gap-2">
                          <Sparkles className="text-purple-500"/> 10连抽结果
                      </h2>
                      {!isProcessing && (
                        <button onClick={() => setIsTenSpinModalOpen(false)} className="bg-neutral-800 p-2 rounded-full hover:bg-neutral-700 text-white">
                            <X size={20}/>
                        </button>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 p-1">
                       {tenSpinPhase === 'SPINNING' ? (
                           // Loading Placeholders
                           Array.from({length: 10}).map((_, i) => (
                               <div key={i} className="aspect-square bg-neutral-800 rounded-lg flex items-center justify-center animate-pulse border border-neutral-700">
                                   <span className="text-4xl blur-sm">🍒🍋🍇</span>
                               </div>
                           ))
                       ) : (
                           // Results
                           tenSpinResults.map((res, i) => (
                               <MiniSlot key={i} result={res} />
                           ))
                       )}
                  </div>

                  <div className="mt-auto bg-neutral-800 rounded-xl p-4 flex justify-between items-center border border-neutral-700">
                      <div className="text-gray-400 font-bold text-sm">总计赢得</div>
                      <div className="text-3xl font-mono font-black text-yellow-400 flex items-center gap-2">
                          {tenSpinPhase === 'SPINNING' ? <Loader2 className="animate-spin"/> : tenSpinTotalWin}
                          <span className="text-sm text-gray-500">🍯</span>
                      </div>
                  </div>

                  {!isProcessing && (
                      <Button onClick={() => setIsTenSpinModalOpen(false)} className="mt-4 w-full py-3 text-lg">
                          收下奖励
                      </Button>
                  )}
              </div>
          </div>
      )}

    </div>
  );
};
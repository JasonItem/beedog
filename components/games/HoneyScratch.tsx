
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import { Ticket, RotateCcw, Trophy, Sparkles, Eraser, AlertTriangle, CheckCircle2, Loader2, Info } from 'lucide-react';

interface HoneyScratchProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

const TIERS = [
  { id: 'standard', name: '标准版', cost: 10, maxPrize: 100, color: 'bg-blue-500' },
  { id: 'premium', name: '进阶版', cost: 50, maxPrize: 1000, color: 'bg-purple-600' },
  { id: 'deluxe', name: '豪华版', cost: 100, maxPrize: 10000, color: 'bg-yellow-600' }
];

// Prize Pools (Value, Weight)
// Adjusted weights to ensure ~50% loss rate (val: 0)
const POOLS = {
  standard: [
    { val: 0, weight: 60 }, // Increased weight for loss (Total pool ~120, so 60/120 = 50%)
    { val: 5, weight: 20 },
    { val: 10, weight: 25 }, // Money back
    { val: 20, weight: 10 },
    { val: 50, weight: 4 },
    { val: 100, weight: 1 }
  ],
  premium: [
    { val: 0, weight: 55 }, // (Total pool ~110, so 55/110 = 50%)
    { val: 20, weight: 20 },
    { val: 50, weight: 20 },
    { val: 100, weight: 10 },
    { val: 250, weight: 4 },
    { val: 1000, weight: 1 }
  ],
  deluxe: [
    { val: 0, weight: 50 }, // (Total pool ~100, so 50/100 = 50%)
    { val: 50, weight: 20 },
    { val: 100, weight: 15 },
    { val: 200, weight: 10 },
    { val: 1000, weight: 4 },
    { val: 10000, weight: 1 }
  ]
};

export const HoneyScratch: React.FC<HoneyScratchProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<'SELECT' | 'PLAYING' | 'REVEALED'>('SELECT');
  const [selectedTier, setSelectedTier] = useState(TIERS[0]);
  const [gridValues, setGridValues] = useState<number[]>(Array(9).fill(0));
  const [winAmount, setWinAmount] = useState(0);
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [scratchPercent, setScratchPercent] = useState(0);
  const [isScratching, setIsScratching] = useState(false);
  
  // New States
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  const showNotif = (msg: string, type: 'success' | 'error' | 'info') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 2000);
  };

  // --- LOGIC ---

  const generateGrid = (tierId: string) => {
    // 1. Determine Outcome
    const pool = POOLS[tierId as keyof typeof POOLS];
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    let outcome = 0;
    
    for (const item of pool) {
        if (random < item.weight) {
            outcome = item.val;
            break;
        }
        random -= item.weight;
    }

    setWinAmount(outcome);

    // 2. Build Grid
    let grid = Array(9).fill(0);
    const availableIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const possiblePrizes = pool.map(p => p.val).filter(v => v > 0);

    if (outcome > 0) {
        // WIN: Place 3 matching outcomes
        for (let i = 0; i < 3; i++) {
            const posIndex = Math.floor(Math.random() * availableIndices.length);
            const pos = availableIndices.splice(posIndex, 1)[0];
            grid[pos] = outcome;
        }
        
        // Fill rest with random non-matching to avoid accidental extra wins
        for (const idx of availableIndices) {
            let filler = 0;
            // Try to pick a filler that isn't the outcome
            do {
                filler = possiblePrizes[Math.floor(Math.random() * possiblePrizes.length)];
            } while (filler === outcome);
            grid[idx] = filler;
        }
        
        // Double check we didn't accidentally make a triple of filler
        const counts: Record<number, number> = {};
        grid.forEach(v => counts[v] = (counts[v] || 0) + 1);
        for (const [val, count] of Object.entries(counts)) {
            if (parseInt(val) !== outcome && count >= 3) {
               // Break the accidental win
               const idxToBreak = grid.indexOf(parseInt(val));
               grid[idxToBreak] = 0; 
            }
        }

    } else {
        // LOSS: Ensure NO value appears >= 3 times
        // Fill randomly, then validate
        let isValid = false;
        while (!isValid) {
            // Fill
            for (let i = 0; i < 9; i++) {
                grid[i] = possiblePrizes[Math.floor(Math.random() * possiblePrizes.length)];
            }
            
            // Check
            const counts: Record<number, number> = {};
            grid.forEach(v => counts[v] = (counts[v] || 0) + 1);
            isValid = !Object.values(counts).some(c => c >= 3);
        }
    }

    return grid;
  };

  const buyTicket = async () => {
      if (!userProfile) return;
      if (isProcessing) return; // Prevent double click

      if (credits < selectedTier.cost) {
          showNotif("蜂蜜不足！", 'error');
          return;
      }

      setIsProcessing(true);

      try {
          // Deduct
          const success = await deductCredit(userProfile.uid, selectedTier.cost);
          
          if (!success) {
              showNotif("购买失败", 'error');
              setIsProcessing(false);
              return;
          }

          // UI Update
          setCredits(prev => prev - selectedTier.cost);
          refreshProfile();
          showNotif(`消费 ${selectedTier.cost} 蜂蜜`, 'info');

          // Generate
          const newGrid = generateGrid(selectedTier.id);
          setGridValues(newGrid);
          setGameState('PLAYING');
          setScratchPercent(0);
          
          // Init Canvas
          setTimeout(initCanvas, 50);
      } catch (error) {
          console.error("Purchase error:", error);
          showNotif("网络错误", 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const initCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw Cover
      ctx.fillStyle = '#94a3b8'; // Slate 400
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Pattern
      ctx.fillStyle = '#cbd5e1'; // Slate 300
      for(let i=0; i<50; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const r = Math.random() * 20 + 5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      }
      
      // Text
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("刮开图层", canvas.width/2, canvas.height/2);
      ctx.font = '14px sans-serif';
      ctx.fillText("集齐三个图案中奖", canvas.width/2, canvas.height/2 + 30);
  };

  const handleScratch = (e: React.MouseEvent | React.TouchEvent) => {
      if (gameState !== 'PLAYING') return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          // Check for mouse button
          if ((e as React.MouseEvent).buttons !== 1) return;
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      
      if (!isScratching) {
          setIsScratching(true);
          // Audio loop could go here
          audio.playStep(); // Simple sfx
      }

      // Check percentage every few calls (throttle)
      if (Math.random() > 0.8) checkScratchPercentage();
  };

  const checkScratchPercentage = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Sample pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      let transparent = 0;
      
      // Check alpha channel of every 10th pixel for speed
      for (let i = 3; i < pixels.length; i += 40) {
          if (pixels[i] === 0) transparent++;
      }
      
      const total = pixels.length / 40;
      const percent = (transparent / total) * 100;
      
      if (percent > 40) {
          revealAll();
      }
  };

  const revealAll = async () => {
      if (gameState === 'REVEALED') return;
      
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      setGameState('REVEALED');
      
      if (winAmount > 0) {
          audio.playScore();
          if (userProfile) {
              // Await updates to ensure data consistency
              await saveHighScore(userProfile, 'honey_scratch', winAmount);
              await deductCredit(userProfile.uid, -winAmount);
              
              setCredits(prev => prev + winAmount);
              await refreshProfile();
              showNotif(`获得 ${winAmount} 蜂蜜`, 'success');
          }
          onGameOver(); // Trigger update
      } else {
          audio.playGameOver();
      }
  };

  return (
    <div className="flex flex-col items-center gap-6 min-h-[500px]">
      
      {/* Header / Stats */}
      <div className="w-full max-w-md bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-sm border border-neutral-200 dark:border-[#333] flex justify-between items-center relative">
          
          <div className="flex items-center gap-2">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-xl text-brand-yellow">
                  <Ticket size={20} />
              </div>
              <div>
                  <div className="text-xs text-neutral-500 uppercase font-bold">蜂蜜余额</div>
                  <div className="font-mono font-black text-lg dark:text-white">{credits}</div>
              </div>
          </div>
          <div className="flex gap-2">
              {TIERS.map(tier => (
                  <button
                    key={tier.id}
                    onClick={() => {
                        if (gameState !== 'PLAYING') setSelectedTier(tier);
                    }}
                    disabled={gameState === 'PLAYING'}
                    className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 transition-all ${
                        selectedTier.id === tier.id 
                        ? `${tier.color} text-white border-transparent scale-110 shadow-lg` 
                        : 'bg-neutral-50 dark:bg-[#2a2a2a] border-neutral-200 dark:border-[#444] text-neutral-400 hover:border-neutral-300'
                    }`}
                  >
                      <span className="text-[10px] font-bold">{tier.name.slice(0,2)}</span>
                      <span className="text-xs font-mono">{tier.cost}</span>
                  </button>
              ))}
          </div>
      </div>

      {/* Main Game Area */}
      <div className="relative">
          
          {/* Notification Overlay */}
          {notification && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none w-max">
                  <div className={`px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-bold animate-in zoom-in fade-in duration-200 border ${
                      notification.type === 'success' ? 'bg-green-600 text-white border-green-400' :
                      notification.type === 'error' ? 'bg-red-600 text-white border-red-400' :
                      'bg-white text-black border-neutral-200'
                  }`}>
                      {notification.type === 'success' && <CheckCircle2 size={18} />}
                      {notification.type === 'error' && <AlertTriangle size={18} />}
                      {notification.type === 'info' && <Info size={18} />}
                      {notification.msg}
                  </div>
              </div>
          )}

          {/* Ticket Body */}
          <div className="w-[300px] h-[420px] bg-white dark:bg-[#222] rounded-3xl shadow-2xl border-4 border-neutral-800 relative overflow-hidden flex flex-col">
              
              {/* Ticket Header */}
              <div className={`${selectedTier.color} p-4 text-white text-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                  <h3 className="font-black text-2xl uppercase italic tracking-wider relative z-10">{selectedTier.name}</h3>
                  <div className="text-xs font-bold opacity-80 relative z-10 flex justify-center items-center gap-1">
                      <Trophy size={12}/> 最高奖金 {selectedTier.maxPrize}
                  </div>
              </div>

              {/* Ticket Grid Area */}
              <div className="flex-1 p-4 bg-neutral-100 dark:bg-[#111] relative" ref={containerRef}>
                  
                  {/* The Grid Content (Under Canvas) */}
                  <div className="grid grid-cols-3 gap-3 w-full h-full">
                      {gridValues.map((val, idx) => (
                          <div 
                            key={idx} 
                            className={`
                                rounded-xl flex items-center justify-center border-2 
                                ${val === winAmount && winAmount > 0 && gameState === 'REVEALED' 
                                    ? 'bg-yellow-100 border-yellow-400 animate-pulse' 
                                    : 'bg-white dark:bg-[#2a2a2a] border-neutral-200 dark:border-[#333]'}
                            `}
                          >
                              {val > 0 ? (
                                  <div className="text-center">
                                      <div className="text-xl">🍯</div>
                                      <div className={`font-black font-mono ${val === winAmount && winAmount > 0 && gameState === 'REVEALED' ? 'text-yellow-600' : 'text-neutral-700 dark:text-neutral-300'}`}>{val}</div>
                                  </div>
                              ) : (
                                  <div className="text-neutral-300 dark:text-neutral-700 text-xl font-bold">X</div>
                              )}
                          </div>
                      ))}
                  </div>

                  {/* Scratch Overlay Canvas */}
                  {gameState === 'PLAYING' && (
                      <canvas 
                        ref={canvasRef}
                        className="absolute inset-0 z-10 touch-none cursor-crosshair"
                        onMouseDown={handleScratch}
                        onMouseMove={handleScratch}
                        onTouchStart={handleScratch}
                        onTouchMove={handleScratch}
                      />
                  )}

                  {/* Buy Button Overlay */}
                  {gameState === 'SELECT' && (
                      <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6">
                          <Ticket size={48} className="text-white mb-4 animate-bounce" />
                          <Button 
                            onClick={buyTicket} 
                            disabled={isProcessing}
                            className={`w-full py-4 text-xl font-black shadow-xl ${selectedTier.color} border-none flex items-center justify-center gap-2`}
                          >
                              {isProcessing ? <Loader2 className="animate-spin" size={24}/> : null}
                              {isProcessing ? "购买中..." : `${selectedTier.cost} 蜂蜜购买`}
                          </Button>
                      </div>
                  )}

                  {/* Result Overlay */}
                  {gameState === 'REVEALED' && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                          {winAmount > 0 ? (
                              <div className="bg-yellow-500 text-black px-6 py-4 rounded-3xl shadow-2xl border-4 border-white transform rotate-[-5deg] animate-in zoom-in fade-in duration-300">
                                  <div className="text-sm font-bold uppercase tracking-widest text-center">恭喜中奖</div>
                                  <div className="text-5xl font-black font-mono text-center flex items-center justify-center gap-2">
                                      <Sparkles size={32}/> {winAmount}
                                  </div>
                              </div>
                          ) : (
                              <div className="bg-neutral-800 text-white px-6 py-4 rounded-3xl shadow-xl border-4 border-neutral-600 animate-in zoom-in fade-in duration-300">
                                  <div className="text-xl font-bold text-center">很遗憾 未中奖</div>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Footer */}
              <div className="bg-white dark:bg-[#222] p-3 border-t border-neutral-200 dark:border-[#333] flex justify-between items-center text-xs text-neutral-400 font-mono">
                  <span>ID: {Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
                  <span>返奖率 90%</span>
              </div>
          </div>
      </div>

      {/* Controls */}
      {gameState === 'REVEALED' && (
          <div className="flex gap-4">
              <Button onClick={() => setGameState('SELECT')} variant="secondary" className="px-8">
                  <RotateCcw className="mr-2" size={18} /> 返回大厅
              </Button>
              <Button onClick={buyTicket} disabled={isProcessing} className={`${selectedTier.color} px-8 border-none text-white`}>
                  {isProcessing ? <Loader2 className="animate-spin mr-2" size={18}/> : <Eraser className="mr-2" size={18} />} 
                  再刮一张
              </Button>
          </div>
      )}

      {!userProfile && gameState === 'SELECT' && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold">
              <AlertTriangle size={16}/> 请先登录游戏
          </div>
      )}

    </div>
  );
};

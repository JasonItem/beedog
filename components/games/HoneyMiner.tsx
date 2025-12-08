
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Timer, Zap } from 'lucide-react';

interface HoneyMinerProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Item Types
type ItemType = 'btc' | 'eth' | 'bnb' | 'rock' | 'mystery';

interface MineItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  radius: number;
  score: number;
  weight: number; // Higher is heavier (slower)
  active: boolean;
}

export const HoneyMiner: React.FC<HoneyMinerProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minerImgRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const ORIGIN_X = CANVAS_WIDTH / 2;
  const ORIGIN_Y = 50; // Moved down slightly to fit image
  const BASE_SPEED = 8;

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    angle: 0,
    angleSpeed: 0.015, // Slower speed
    angleDirection: 1, // 1 or -1
    hookStatus: 'IDLE' as 'IDLE' | 'SHOOT' | 'REWIND',
    hookLen: 30,
    hookX: ORIGIN_X,
    hookY: ORIGIN_Y,
    items: [] as MineItem[],
    caughtItem: null as MineItem | null,
    animationId: 0,
    lastTime: 0, // For Countdown Timer
    lastFrameTime: 0, // For FPS throttling
    isGameOver: false,
    timeRemaining: 60, // Logic timer
    score: 0 // Added score to ref
  });

  useEffect(() => {
    // Load Miner Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce";
    img.onload = () => {
      minerImgRef.current = img;
    };

    return () => {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
  }, []);

  // Level Generation
  const generateLevel = () => {
    const items: MineItem[] = [];
    let idCounter = 0;

    // Helper to add item
    const addItem = (type: ItemType, count: number, minY: number, maxY: number) => {
      for (let i = 0; i < count; i++) {
        const padding = 30;
        const x = Math.random() * (CANVAS_WIDTH - padding * 2) + padding;
        const y = Math.random() * (maxY - minY) + minY;
        
        let radius = 0;
        let score = 0;
        let weight = 0;

        switch (type) {
          case 'btc': // Bitcoin: High Value, Fast-ish
            radius = 14; score = 500; weight = 0.8; break;
          case 'eth': // Ethereum: Medium/High Value
            radius = 18; score = 300; weight = 1.2; break;
          case 'bnb': // BNB: Good Value
            radius = 20; score = 150; weight = 1.0; break;
          case 'rock': // Bad Value, Very Heavy
            radius = 25; score = 10; weight = 4.0; break;
          case 'mystery': // Airdrop Box
            radius = 16; score = Math.floor(Math.random() * 450) + 50; weight = Math.random() * 2 + 0.5; break;
        }

        items.push({ id: idCounter++, type, x, y, radius, score, weight, active: true });
      }
    };

    // Distribution
    addItem('btc', 2, 250, 450);
    addItem('eth', 3, 200, 400);
    addItem('bnb', 4, 150, 350);
    addItem('rock', 5, 150, 450);
    addItem('mystery', 2, 200, 400);

    return items;
  };

  const startGame = () => {
    if (gameRef.current.animationId) {
      cancelAnimationFrame(gameRef.current.animationId);
    }

    setGameState('PLAYING');
    setScore(0);
    setTimeLeft(60);
    
    gameRef.current = {
      angle: 0,
      angleSpeed: 0.015,
      angleDirection: 1,
      hookStatus: 'IDLE',
      hookLen: 30,
      hookX: ORIGIN_X,
      hookY: ORIGIN_Y,
      items: generateLevel(),
      caughtItem: null,
      animationId: 0,
      lastTime: performance.now(),
      lastFrameTime: performance.now(),
      isGameOver: false,
      timeRemaining: 60,
      score: 0 
    };
    
    loop();
  };

  const endGame = async () => {
    if (gameRef.current.isGameOver) return; 
    
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    if (gameRef.current.animationId) {
       cancelAnimationFrame(gameRef.current.animationId);
    }
    
    const finalScore = gameRef.current.score;
    if (userProfile && finalScore > 0) {
      await saveHighScore(userProfile, 'honey_miner', finalScore);
      onGameOver();
    }
  };

  const handleInput = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    if (gameState === 'START' || gameState === 'GAME_OVER') return;
    
    if (gameRef.current.hookStatus === 'IDLE') {
      gameRef.current.hookStatus = 'SHOOT';
    }
  };

  const drawHook = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle); 
    
    // Draw Hook Head
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.beginPath();
    // Claw shape
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(0, 10); 
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();

    ctx.restore();
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: MineItem) => {
    if (!item.active) return;

    const { x, y, radius, type } = item;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(2, 2, radius, radius, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    switch (type) {
        case 'btc': // Bitcoin
            ctx.fillStyle = '#f7931a'; // BTC Orange
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#fcd34d'; // Lighter orange border
            ctx.lineWidth = 2;
            ctx.stroke();
            // Symbol
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline='middle';
            ctx.fillText('₿', 0, 1);
            break;

        case 'eth': // Ethereum
            ctx.fillStyle = '#627eea'; // ETH Blue/Purple
            // Diamond/Rhombus shape
            ctx.beginPath();
            ctx.moveTo(0, -radius);
            ctx.lineTo(radius*0.7, 0);
            ctx.lineTo(0, radius);
            ctx.lineTo(-radius*0.7, 0);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(radius*0.7, 0); ctx.lineTo(0, radius); ctx.fill();
            // Symbol
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline='middle';
            ctx.fillText('Ξ', 0, 1);
            break;

        case 'bnb': // BNB
            ctx.fillStyle = '#f3ba2f'; // BNB Yellow
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#b48a20'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#fff'; 
            ctx.font = 'bold 10px sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline='middle'; 
            ctx.fillText('BNB', 0, 1);
            break;

        case 'rock': // Rock
            ctx.fillStyle = '#57534e'; // Stone-600
            ctx.beginPath();
            // Irregular shape
            ctx.moveTo(-radius, 0);
            ctx.lineTo(-radius/2, -radius*0.8);
            ctx.lineTo(radius/2, -radius*0.9);
            ctx.lineTo(radius, 0);
            ctx.lineTo(radius*0.5, radius*0.8);
            ctx.lineTo(-radius*0.6, radius*0.7);
            ctx.fill();
            // Cracks
            ctx.strokeStyle = '#44403c';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0,0); ctx.lineTo(5, -2); ctx.stroke();
            break;

        case 'mystery': // Airdrop Box
            // Box body
            ctx.fillStyle = '#ec4899'; // Pink-500
            ctx.fillRect(-radius, -radius, radius*2, radius*2);
            // Ribbon
            ctx.fillStyle = '#fce7f3'; 
            ctx.fillRect(-radius, -2, radius*2, 4);
            ctx.fillRect(-2, -radius, 4, radius*2);
            // Question mark
            ctx.fillStyle = '#fff'; 
            ctx.font = 'bold 14px sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline='middle'; 
            ctx.fillText('?', 0, 0);
            break;
    }

    ctx.restore();
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const game = gameRef.current;
    
    // FPS Throttling
    const elapsedFrame = now - game.lastFrameTime;
    if (elapsedFrame < FRAME_INTERVAL) return;
    game.lastFrameTime = now - (elapsedFrame % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (game.isGameOver) return; 

    // Timer Logic
    if (now - game.lastTime > 1000) {
        game.timeRemaining = Math.max(0, game.timeRemaining - 1);
        setTimeLeft(game.timeRemaining);
        game.lastTime = now;
    }

    // End Game Check
    if (game.hookStatus === 'IDLE' && game.timeRemaining <= 0) {
        endGame();
        return;
    }

    // --- LOGIC ---

    // 1. Hook Angle oscillation
    if (game.hookStatus === 'IDLE') {
        game.angle += game.angleSpeed * game.angleDirection;
        if (game.angle > 1.3) game.angleDirection = -1; // ~75 degrees
        if (game.angle < -1.3) game.angleDirection = 1;
        
        game.hookLen = 30; // Reset length
        game.hookX = ORIGIN_X + Math.sin(game.angle) * game.hookLen;
        game.hookY = ORIGIN_Y + Math.cos(game.angle) * game.hookLen;
    }

    // 2. Shoot
    if (game.hookStatus === 'SHOOT') {
        game.hookLen += BASE_SPEED;
        game.hookX = ORIGIN_X + Math.sin(game.angle) * game.hookLen;
        game.hookY = ORIGIN_Y + Math.cos(game.angle) * game.hookLen;

        // Boundary Check
        if (game.hookX < 0 || game.hookX > CANVAS_WIDTH || game.hookY > CANVAS_HEIGHT) {
            game.hookStatus = 'REWIND';
        }

        // Collision Check
        for (const item of game.items) {
            if (item.active) {
                const dx = game.hookX - item.x;
                const dy = game.hookY - item.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < item.radius + 5) {
                    // HIT!
                    item.active = false; // Hide from world
                    game.caughtItem = item;
                    game.hookStatus = 'REWIND';
                    break;
                }
            }
        }
    }

    // 3. Rewind
    if (game.hookStatus === 'REWIND') {
        // Calculate speed based on weight
        const weight = game.caughtItem ? game.caughtItem.weight : 1;
        const speed = BASE_SPEED / weight;
        
        game.hookLen -= speed;
        
        game.hookX = ORIGIN_X + Math.sin(game.angle) * game.hookLen;
        game.hookY = ORIGIN_Y + Math.cos(game.angle) * game.hookLen;

        if (game.hookLen <= 30) {
            // Returned to base
            game.hookStatus = 'IDLE';
            if (game.caughtItem) {
                const earnedScore = game.caughtItem.score; 
                game.score += earnedScore; // Update Ref
                setScore(game.score); // Update UI
                game.caughtItem = null;
                
                // Respawn logic if few items left
                if (game.items.filter(i => i.active).length < 4) {
                    const newItem = generateLevel()[0]; // Just take the first random one generated
                    newItem.id = Date.now();
                    game.items.push(newItem);
                }
            }
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pivot Base
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(ORIGIN_X, ORIGIN_Y - 5, 8, 0, Math.PI*2); ctx.fill();
    
    // Draw BeeDog Operator (Centered on Pivot)
    if (minerImgRef.current) {
        ctx.save();
        const size = 50;
        ctx.translate(ORIGIN_X, ORIGIN_Y - 25);
        // Tilt dog based on angle slightly
        ctx.rotate(game.angle * 0.2);
        ctx.drawImage(minerImgRef.current, -size/2, -size/2, size, size);
        ctx.restore();
    } else {
        ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.fillText('🐶', ORIGIN_X, ORIGIN_Y - 25);
    }

    // Line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, ORIGIN_Y);
    ctx.lineTo(game.hookX, game.hookY);
    ctx.stroke();

    // Hook Head
    drawHook(ctx, game.hookX, game.hookY, -game.angle);

    // Caught Item
    if (game.caughtItem) {
        // Temporarily override x/y to draw at hook tip
        const tempItem = { ...game.caughtItem, x: game.hookX, y: game.hookY, active: true };
        drawItem(ctx, tempItem);
    }

    // World Items
    game.items.forEach(item => drawItem(ctx, item));
  };

  useEffect(() => {
    return () => {
        if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-[#451a03] rounded-xl overflow-hidden shadow-2xl border-4 border-amber-900 select-none touch-none">
       {/* Dirt Background Texture */}
       <div className="absolute inset-0 opacity-20" 
            style={{backgroundImage: 'repeating-linear-gradient(45deg, #2a1002 25%, transparent 25%, transparent 75%, #2a1002 75%, #2a1002), repeating-linear-gradient(45deg, #2a1002 25%, #451a03 25%, #451a03 75%, #2a1002 75%, #2a1002)', backgroundSize: '40px 40px', backgroundPosition: '0 0, 20px 20px'}}>
       </div>

       <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="relative z-10 w-full h-full block cursor-pointer"
        onMouseDown={handleInput}
        onTouchStart={handleInput}
       />

       {/* HUD */}
       <div className="absolute top-2 left-2 z-20 flex gap-4 pointer-events-none">
          <div className="bg-black/60 text-white px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg backdrop-blur-md">
             <Zap size={16} className="text-yellow-400 fill-yellow-400" />
             <span className="font-black text-xl font-mono">${score}</span>
          </div>
          <div className={`bg-black/60 text-white px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg backdrop-blur-md ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>
             <Timer size={16} />
             <span className="font-bold text-lg font-mono">{timeLeft}s</span>
          </div>
       </div>

       {/* Start Screen */}
       {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-30 backdrop-blur-sm">
          <div className="text-4xl font-black mb-2 text-yellow-400 drop-shadow-lg text-center">Bee Miner<br/><span className="text-2xl text-white">Crypto Rush</span></div>
          <p className="mb-8 font-bold text-center text-neutral-300 text-sm leading-relaxed">
            点击屏幕发射钩子<br/>
            抓取 <span className="text-orange-400">BTC</span>、<span className="text-blue-400">ETH</span> 和 <span className="text-yellow-400">BNB</span><br/>
            避开垃圾资产 (石头)！
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-[0_0_20px_rgba(234,179,8,0.5)] scale-110 border-none bg-yellow-500 hover:bg-yellow-400 text-black">
             <Play className="mr-2 fill-current" /> 开始挖矿
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-30 backdrop-blur-md">
          <div className="text-3xl font-black mb-4 text-yellow-400">TIME'S UP!</div>
          <div className="bg-[#2a1002] border border-[#451a03] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl">
             <div className="text-xs text-neutral-400 uppercase font-bold mb-2 tracking-widest">本局收益 (PnL)</div>
             <div className="text-5xl font-black text-green-400 font-mono">+${score}</div>
          </div>
          <Button onClick={startGame} className="w-full mb-3 py-3 text-lg bg-white text-black hover:bg-neutral-200 border-none">
             <RotateCcw className="mr-2" /> 再挖一次
          </Button>
        </div>
      )}

    </div>
  );
};

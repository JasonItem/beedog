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
type ItemType = 'diamond' | 'gold' | 'honey' | 'rock' | 'bag';

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
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const ORIGIN_X = CANVAS_WIDTH / 2;
  const ORIGIN_Y = 40;
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
          case 'diamond': // High Value, Fast
            radius = 12; score = 500; weight = 0.5; break;
          case 'gold': // Medium Value, Medium
            radius = 18; score = 250; weight = 1.5; break;
          case 'honey': // Good Value, Medium
            radius = 22; score = 150; weight = 1.2; break;
          case 'rock': // Bad Value, Very Heavy
            radius = 25; score = 20; weight = 4.0; break;
          case 'bag': // Mystery
            radius = 16; score = Math.floor(Math.random() * 400) + 50; weight = Math.random() * 2 + 0.5; break;
        }

        items.push({ id: idCounter++, type, x, y, radius, score, weight, active: true });
      }
    };

    // Distribution
    addItem('diamond', 2, 250, 450);
    addItem('gold', 3, 200, 400);
    addItem('honey', 4, 150, 350);
    addItem('rock', 5, 150, 450);
    addItem('bag', 2, 200, 400);

    return items;
  };

  const startGame = () => {
    // FIX: Cancel any existing animation frame to prevent multiple loops running
    if (gameRef.current.animationId) {
      cancelAnimationFrame(gameRef.current.animationId);
    }

    setGameState('PLAYING');
    setScore(0);
    setTimeLeft(60);
    
    gameRef.current = {
      angle: 0,
      angleSpeed: 0.015, // Slower speed here as well
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
      score: 0 // Reset score in ref
    };
    
    loop();
  };

  const endGame = async () => {
    if (gameRef.current.isGameOver) return; // Prevent double trigger
    
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    if (gameRef.current.animationId) {
       cancelAnimationFrame(gameRef.current.animationId);
    }
    
    // Only save score if user is logged in
    // Use score from Ref to avoid closure staleness
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
    ctx.rotate(angle); // Angle is already in radians + Math.PI/2 offset logic handled in loop
    
    // Draw Hook Head
    ctx.fillStyle = '#9ca3af'; // gray-400
    ctx.beginPath();
    // Simple 3-prong hook
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(0, 8); 
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    ctx.restore();
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: MineItem) => {
    if (!item.active) return;

    const { x, y, radius, type } = item;
    ctx.save();
    ctx.translate(x, y);

    switch (type) {
        case 'diamond':
            ctx.fillStyle = '#60a5fa'; // Blue-400
            ctx.beginPath();
            ctx.moveTo(0, -radius);
            ctx.lineTo(radius, 0);
            ctx.lineTo(0, radius);
            ctx.lineTo(-radius, 0);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.moveTo(-radius/2, -radius/2); ctx.lineTo(0, -radius); ctx.lineTo(radius/2, -radius/2); ctx.fill();
            break;
        case 'gold':
            ctx.fillStyle = '#facc15'; // Yellow-400
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline='middle'; ctx.fillText('$', 0,0);
            break;
        case 'honey':
            ctx.fillStyle = '#f97316'; // Orange-500
            // Pot shape
            ctx.beginPath(); 
            ctx.ellipse(0, 5, radius, radius*0.8, 0, 0, Math.PI*2); 
            ctx.fill();
            ctx.fillStyle = '#fcd34d'; // Honey overflow
            ctx.beginPath(); ctx.ellipse(0, -5, radius*0.6, 5, 0, 0, Math.PI*2); ctx.fill();
            break;
        case 'rock':
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
            break;
        case 'bag':
            ctx.fillStyle = '#ec4899'; // Pink-500
            ctx.beginPath();
            ctx.arc(0, 5, radius, 0, Math.PI, false);
            ctx.lineTo(-radius, 5);
            ctx.lineTo(0, -radius*1.2);
            ctx.lineTo(radius, 5);
            ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline='middle'; ctx.fillText('?', 0, 5);
            break;
    }

    ctx.restore();
  };

  const loop = () => {
    // Request next frame
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
    
    if (game.isGameOver) return; // Stop update loop if game over

    // Timer Logic (Independent of FPS throttling)
    if (now - game.lastTime > 1000) {
        game.timeRemaining = Math.max(0, game.timeRemaining - 1);
        setTimeLeft(game.timeRemaining); // Update UI
        game.lastTime = now;
    }

    // End Game Check
    // We only end when time is up AND hook is idle (so they can finish catching the last item)
    if (game.hookStatus === 'IDLE' && game.timeRemaining <= 0) {
        endGame();
        return;
    }

    // --- LOGIC ---

    // 1. Hook Angle oscillation
    if (game.hookStatus === 'IDLE') {
        game.angle += game.angleSpeed * game.angleDirection;
        if (game.angle > 1.2) game.angleDirection = -1; // ~70 degrees
        if (game.angle < -1.2) game.angleDirection = 1;
        
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
                
                // Respawn logic
                if (game.items.filter(i => i.active).length < 5) {
                    const newItem = generateLevel()[0];
                    newItem.id = Date.now();
                    game.items.push(newItem);
                }
            }
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Miner/Base
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(ORIGIN_X, ORIGIN_Y - 20, 10, 0, Math.PI*2); ctx.fill(); // Pivot
    
    // Draw BeeDog Operator
    ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.fillText('🐶', ORIGIN_X, ORIGIN_Y - 35);

    // Line
    ctx.strokeStyle = '#000';
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
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-[#5D4037] rounded-xl overflow-hidden shadow-2xl border-4 border-amber-900 select-none touch-none">
       {/* Dirt Background Texture */}
       <div className="absolute inset-0 opacity-10" 
            style={{backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #5D4037 25%, #5D4037 75%, #000 75%, #000)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px'}}>
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
          <div className="bg-black/50 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2">
             <Zap size={16} className="text-yellow-400" />
             <span className="font-bold text-lg">{score}</span>
          </div>
          <div className={`bg-black/50 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>
             <Timer size={16} />
             <span className="font-bold text-lg">{timeLeft}s</span>
          </div>
       </div>

       {/* Start Screen */}
       {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-30">
          <div className="text-4xl font-black mb-2 text-yellow-400 drop-shadow-lg text-center">Honey Miner<br/><span className="text-2xl text-white">淘金热</span></div>
          <p className="mb-6 font-bold text-center text-neutral-300 text-sm">
            点击屏幕发射钩子。<br/>
            抓取 <span className="text-blue-400">钻石</span> 和 <span className="text-orange-400">蜂蜜</span><br/>
            不要抓到石头！限时 60 秒！
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-xl scale-110">
             <Play className="mr-2" /> 开始挖矿
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-30">
          <div className="text-3xl font-black mb-2 text-yellow-400">TIME'S UP!</div>
          <div className="bg-[#3e2723] border border-[#5d4037] rounded-xl p-6 w-full mb-6 flex flex-col items-center shadow-lg">
             <div className="text-xs text-neutral-400 uppercase font-bold mb-1">本局收益</div>
             <div className="text-5xl font-black text-white font-mono">${score}</div>
          </div>
          <Button onClick={startGame} className="w-full mb-3">
             <RotateCcw className="mr-2" /> 再挖一次
          </Button>
        </div>
      )}

    </div>
  );
};
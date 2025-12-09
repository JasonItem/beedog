
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, TrendingUp, Heart } from 'lucide-react';

interface FudBusterProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

type ItemType = 'red_candle' | 'bear' | 'fud' | 'green_candle' | 'rocket';

interface GameItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  active: boolean;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

export const FudBuster: React.FC<FudBusterProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isBullRun, setIsBullRun] = useState(false); // Bonus mode

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const GRAVITY = 0.15;
  
  // Game Refs
  const gameRef = useRef({
    items: [] as GameItem[],
    particles: [] as Particle[],
    trail: [] as TrailPoint[],
    isMouseDown: false,
    score: 0,
    lives: 3,
    spawnTimer: 0,
    spawnRate: 60,
    difficultyMultiplier: 1,
    bullRunTimer: 0,
    animationId: 0,
    lastFrameTime: 0
  });

  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  useEffect(() => {
    // Add event listeners for trail tracking
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      if (canvas) {
          canvas.removeEventListener('touchmove', handleTouchMove);
      }
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
  }, []);

  const createItem = (): GameItem => {
    const typeRand = Math.random();
    let type: ItemType = 'red_candle';
    
    // Probabilities
    if (gameRef.current.bullRunTimer > 0) {
        // In Bull Run mode, everything is good to slice (visually represented as bears/reds)
        type = Math.random() > 0.5 ? 'red_candle' : 'bear';
    } else {
        if (typeRand > 0.95) type = 'rocket'; // 5% Bonus
        else if (typeRand > 0.8) type = 'green_candle'; // 15% Bomb (Don't cut)
        else if (typeRand > 0.6) type = 'fud'; // 20% News
        else if (typeRand > 0.3) type = 'bear'; // 30% Bear
        else type = 'red_candle'; // 30% Red Candle
    }

    const radius = 25;
    const x = Math.random() * (CANVAS_WIDTH - 60) + 30;
    const y = CANVAS_HEIGHT + radius;
    
    // Velocity to throw it up and towards center-ish
    const vx = (CANVAS_WIDTH / 2 - x) * (Math.random() * 0.01 + 0.005);
    const vy = -(Math.random() * 4 + 7); // Random upward force

    let color = '#ef4444'; // Red
    if (type === 'green_candle') color = '#22c55e';
    if (type === 'rocket') color = '#3b82f6';
    if (type === 'bear') color = '#92400e'; // Brown
    if (type === 'fud') color = '#e5e7eb'; // Grey news

    return {
      id: Date.now() + Math.random(),
      type,
      x, y,
      vx, vy,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      radius,
      active: true,
      color
    };
  };

  const createExplosion = (x: number, y: number, color: string, count: number = 10) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        gameRef.current.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            color,
            size: Math.random() * 3 + 1
        });
    }
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setLives(3);
    setIsBullRun(false);

    gameRef.current = {
      items: [],
      particles: [],
      trail: [],
      isMouseDown: false,
      score: 0,
      lives: 3,
      spawnTimer: 0,
      spawnRate: 60,
      difficultyMultiplier: 1,
      bullRunTimer: 0,
      animationId: 0,
      lastFrameTime: performance.now()
    };
    
    loop();
  };

  const endGame = async () => {
    audio.playGameOver();
    gameRef.current.lives = 0; // Ensure logic knows
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'fud_buster', gameRef.current.score);
      onGameOver();
    }
  };

  // --- RENDERING HELPERS ---

  const drawCandle = (ctx: CanvasRenderingContext2D, item: GameItem) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      
      const w = 20;
      const h = 40;
      
      // Wick
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h/2 - 10);
      ctx.lineTo(0, h/2 + 10);
      ctx.stroke();

      // Body
      ctx.fillStyle = item.color;
      ctx.fillRect(-w/2, -h/2, w, h);
      
      // Outline
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w/2, -h/2, w, h);

      ctx.restore();
  };

  const drawBear = (ctx: CanvasRenderingContext2D, item: GameItem) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      
      ctx.font = '32px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐻', 0, 0);

      ctx.restore();
  };

  const drawNews = (ctx: CanvasRenderingContext2D, item: GameItem) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(-20, -15, 40, 30);
      
      // Text lines
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-15, -10, 30, 4);
      ctx.fillRect(-15, -2, 20, 4);
      ctx.fillRect(-15, 6, 25, 4);
      
      ctx.font = '10px sans-serif';
      ctx.fillText('FUD', -10, 25);

      ctx.restore();
  };

  const drawRocket = (ctx: CanvasRenderingContext2D, item: GameItem) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      
      ctx.font = '32px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);

      ctx.restore();
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameRef.current.lives <= 0) return;

    const game = gameRef.current;

    // --- LOGIC ---

    // Difficulty scaling
    game.difficultyMultiplier = 1 + (game.score / 500);
    game.spawnRate = Math.max(20, 60 - Math.floor(game.score / 50));

    // Bull Run Timer
    if (game.bullRunTimer > 0) {
        game.bullRunTimer--;
        if (game.bullRunTimer <= 0) {
            setIsBullRun(false);
        }
    }

    // Spawning
    game.spawnTimer++;
    // In Bull Run, spawn way faster
    const currentRate = game.bullRunTimer > 0 ? 10 : game.spawnRate;
    
    if (game.spawnTimer > currentRate) {
        game.spawnTimer = 0;
        // Maybe spawn multiple?
        const count = game.bullRunTimer > 0 ? 2 : 1;
        for(let i=0; i<count; i++) {
            game.items.push(createItem());
        }
    }

    // Update Items
    for (let i = game.items.length - 1; i >= 0; i--) {
        const item = game.items[i];
        
        // Physics
        item.x += item.vx;
        item.y += item.vy;
        item.vy += GRAVITY;
        item.rotation += item.rotationSpeed;

        // Check Trail Collision (Slicing)
        // We check line segments of trail against circle of item
        if (item.active) {
            for (let j = 0; j < game.trail.length - 1; j++) {
                const p1 = game.trail[j];
                const p2 = game.trail[j+1];
                
                // Simple distance check from point for optimization (good enough for fast swipes)
                const dist = Math.sqrt(Math.pow(item.x - p2.x, 2) + Math.pow(item.y - p2.y, 2));
                
                if (dist < item.radius + 10) { // +10 for blade thickness tolerance
                    // SLICED!
                    item.active = false;
                    
                    if (item.type === 'green_candle') {
                        // BAD!
                        audio.playGameOver(); // Crash sound
                        game.lives--;
                        setLives(game.lives);
                        createExplosion(item.x, item.y, '#22c55e', 20); // Green explosion
                        if (game.lives <= 0) endGame();
                    } else if (item.type === 'rocket') {
                        // BONUS!
                        audio.playScore();
                        game.bullRunTimer = 300; // 5 seconds
                        setIsBullRun(true);
                        game.score += 50;
                        setScore(game.score);
                        createExplosion(item.x, item.y, '#3b82f6', 30);
                    } else {
                        // GOOD!
                        audio.playScore();
                        let points = 10;
                        if (item.type === 'bear') points = 20;
                        if (item.type === 'fud') points = 15;
                        
                        if (game.bullRunTimer > 0) points *= 2; // Double points
                        
                        game.score += points;
                        setScore(game.score);
                        createExplosion(item.x, item.y, item.color);
                    }
                    break;
                }
            }
        }

        // Check Fell Off Screen
        if (item.y > CANVAS_HEIGHT + 50) {
            // If it was a 'bad' item (red, bear, fud) and fell off, lose a life?
            // Classic rules: dropping fruit = lose life. Dropping bomb = safe.
            // Here: Dropping Red/Bear/FUD = Bad. Dropping Green/Rocket = Okay.
            if (item.active) {
                if (item.type !== 'green_candle' && item.type !== 'rocket' && game.bullRunTimer <= 0) {
                    audio.playStep(); // Lose life sound
                    game.lives--;
                    setLives(game.lives);
                    if (game.lives <= 0) endGame();
                }
            }
            game.items.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY * 0.5; // lighter gravity for particles
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // Update Trail (Remove old points)
    if (game.trail.length > 0) {
        // Keep points for 0.2 seconds
        const cutoff = Date.now() - 200;
        game.trail = game.trail.filter(p => p.time > cutoff);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Dynamic Chart Background
    // Draw a random looking chart line that moves
    ctx.strokeStyle = game.bullRunTimer > 0 ? '#22c55e' : '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const t = Date.now() * 0.002;
    for (let x = 0; x < CANVAS_WIDTH; x+=10) {
        const y = CANVAS_HEIGHT/2 + Math.sin(x * 0.02 + t) * 50 + Math.cos(x * 0.05 - t) * 30;
        if (x===0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bull Run Overlay
    if (game.bullRunTimer > 0) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BULL RUN!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    }

    // Draw Items
    game.items.forEach(item => {
        if (!item.active) return;
        if (item.type === 'red_candle' || item.type === 'green_candle') drawCandle(ctx, item);
        else if (item.type === 'bear') drawBear(ctx, item);
        else if (item.type === 'fud') drawNews(ctx, item);
        else if (item.type === 'rocket') drawRocket(ctx, item);
    });

    // Draw Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Draw Blade Trail
    if (game.trail.length > 1) {
        ctx.strokeStyle = game.bullRunTimer > 0 ? '#22c55e' : '#fbbf24'; // Green in bull run, Gold normal
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw varied thickness
        for (let i = 0; i < game.trail.length - 1; i++) {
            const p1 = game.trail[i];
            const p2 = game.trail[i+1];
            const age = Date.now() - p1.time;
            const thickness = Math.max(1, 8 - (age / 200) * 8);
            
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }
  };

  // --- INPUT HANDLING ---

  const addTrailPoint = (x: number, y: number) => {
      gameRef.current.trail.push({
          x,
          y,
          time: Date.now()
      });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      gameRef.current.isMouseDown = true;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      addTrailPoint((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  };

  const handleMouseUp = () => {
      gameRef.current.isMouseDown = false;
      // Clear trail faster on lift?
      // gameRef.current.trail = [];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!gameRef.current.isMouseDown) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      addTrailPoint((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const t = e.touches[0];
      addTrailPoint((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
  };

  const handleTouchMove = (e: TouchEvent | React.TouchEvent) => {
      if ('preventDefault' in e) e.preventDefault(); // Prevent scrolling
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const t = (e as React.TouchEvent).touches ? (e as React.TouchEvent).touches[0] : (e as TouchEvent).touches[0];
      addTrailPoint((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border-4 border-red-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        // Touch move added via ref listener for passive:false
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
         <div className="bg-black/60 text-white px-3 py-1.5 rounded-xl border border-red-500/30 flex items-center gap-2 backdrop-blur-md">
            <TrendingUp size={16} className={isBullRun ? "text-green-400" : "text-red-400"} />
            <span className={`font-black text-xl font-mono ${isBullRun ? "text-green-400 animate-pulse" : "text-white"}`}>{score}</span>
         </div>
         <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
                <Heart key={i} size={20} className={i < lives ? "text-red-500 fill-red-500" : "text-gray-600"} />
            ))}
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-orange-600 drop-shadow-lg italic transform -rotate-3 text-center">
             FUD<br/>BUSTER
          </div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
            像切水果一样划过屏幕<br/>
            切碎 <span className="text-red-500">空头</span>、<span className="text-stone-400">FUD</span> 和 <span className="text-amber-700">狗熊</span><br/>
            千万不要切 <span className="text-green-500">绿色蜡烛</span>!
          </p>
          <Button onClick={startGame} className="animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.6)] scale-110 bg-red-600 hover:bg-red-500 border-none text-white font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> SLICE!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <div className="text-4xl font-black mb-6 text-red-500 italic">MARKET CRASH</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Portfolio Value</div>
             <div className="text-6xl font-black text-white font-mono tracking-tighter">${score}</div>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 重新护盘
          </Button>
        </div>
      )}

    </div>
  );
};

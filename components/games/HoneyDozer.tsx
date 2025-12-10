
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit, performDailyCheckIn } from '../../services/userService'; // Re-using existing services
import { updateCumulativeScore } from '../../services/gameService'; // New cumulative service
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, Coins, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Need refreshProfile

interface HoneyDozerProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Entity Types
interface Coin {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  mass: number;
  type: 'gold' | 'silver' | 'gem';
  value: number;
  isSleeping: boolean; // Optimization
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

export const HoneyDozer: React.FC<HoneyDozerProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING'>('START');
  const [sessionEarnings, setSessionEarnings] = useState(0);
  const [wallsActiveTimer, setWallsActiveTimer] = useState(0);
  const [credits, setCredits] = useState(userProfile?.credits || 0);

  // Constants
  const CANVAS_WIDTH = 360;
  const CANVAS_HEIGHT = 600;
  const COIN_COST = 10;
  
  // Physics Constants
  const FRICTION = 0.92; // High friction like heavy metal
  const PUSHER_SPEED = 0.03;
  const PUSHER_RANGE = 80;
  const PUSHER_BASE_Y = 100;
  
  const gameRef = useRef({
    coins: [] as Coin[],
    particles: [] as Particle[],
    pusherY: PUSHER_BASE_Y,
    pusherPhase: 0,
    wallsActive: false,
    animationId: 0,
    lastFrameTime: 0,
    bgOffset: 0
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const initGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    setGameState('PLAYING');
    setSessionEarnings(0);

    // Initial Coins (Seed the board so it's not empty)
    const seedCoins: Coin[] = [];
    for (let i = 0; i < 20; i++) {
        seedCoins.push({
            id: Date.now() + i,
            x: Math.random() * (CANVAS_WIDTH - 40) + 20,
            y: Math.random() * (CANVAS_HEIGHT / 2) + 200,
            radius: 18,
            vx: 0, vy: 0,
            mass: 1,
            type: 'gold',
            value: 15,
            isSleeping: false,
            color: '#fbbf24'
        });
    }

    gameRef.current = {
      coins: seedCoins,
      particles: [],
      pusherY: PUSHER_BASE_Y,
      pusherPhase: 0,
      wallsActive: false,
      animationId: 0,
      lastFrameTime: performance.now(),
      bgOffset: 0
    };
    
    loop();
  };

  const spawnCoin = async (x: number) => {
      if (!userProfile) return;
      
      // Optimistic Update
      if (credits < COIN_COST) return;
      setCredits(prev => prev - COIN_COST);
      
      // Deduct from backend
      const success = await deductCredit(userProfile.uid, COIN_COST);
      if (!success) {
          // Revert if failed
          setCredits(prev => prev + COIN_COST);
          return;
      }
      refreshProfile(); // Sync real balance

      audio.playStep();

      // Chance for special coins
      const rand = Math.random();
      let type: 'gold' | 'silver' | 'gem' = 'gold';
      let color = '#fbbf24';
      let value = 15; // Net +5 profit if won (Cost 10)

      if (rand > 0.95) {
          type = 'gem';
          color = '#3b82f6';
          value = 100;
      } else if (rand > 0.85) {
          type = 'silver';
          color = '#e5e7eb';
          value = 50;
      }

      gameRef.current.coins.push({
          id: Date.now(),
          x: Math.max(20, Math.min(CANVAS_WIDTH - 20, x)),
          y: 60, // Drop from top
          radius: type === 'gem' ? 22 : 18,
          vx: (Math.random() - 0.5) * 2,
          vy: 5, // Initial drop velocity
          mass: type === 'gem' ? 1.5 : 1,
          type,
          value,
          isSleeping: false,
          color
      });
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30 + Math.random() * 20,
            color,
            size: Math.random() * 3 + 1
        });
    }
  };

  const resolveCollision = (c1: Coin, c2: Coin) => {
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const distSq = dx*dx + dy*dy;
      const minDist = c1.radius + c2.radius;

      if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          
          // Normalized collision vector
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate circles to prevent overlap (Static resolution)
          // Move proportional to mass? Assuming equal mass for simplicity mostly
          const moveX = nx * overlap * 0.5;
          const moveY = ny * overlap * 0.5;
          
          c1.x -= moveX;
          c1.y -= moveY;
          c2.x += moveX;
          c2.y += moveY;

          // Wake up sleeping coins
          c1.isSleeping = false;
          c2.isSleeping = false;

          // Simple Impulse transfer (highly dampened for pusher feel)
          // We want them to push, not bounce like billiard balls
          const p = 0.2; // Push factor
          
          c1.vx -= nx * p;
          c1.vy -= ny * p;
          c2.vx += nx * p;
          c2.vy += ny * p;
      }
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    const FRAME_INTERVAL = 1000 / 60;
    
    if (elapsed < FRAME_INTERVAL) return;
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;

    // --- UPDATE ---

    // 1. Update Pusher
    game.pusherPhase += PUSHER_SPEED;
    game.pusherY = PUSHER_BASE_Y + Math.sin(game.pusherPhase) * PUSHER_RANGE;

    // 2. Wall Timer
    if (game.wallsActive) {
        setWallsActiveTimer(prev => {
            if (prev <= 1) {
                game.wallsActive = false;
                return 0;
            }
            return prev - 1;
        });
    }

    // 3. Update Coins
    for (let i = game.coins.length - 1; i >= 0; i--) {
        const c = game.coins[i];
        
        // Physics integration
        c.x += c.vx;
        c.y += c.vy;
        
        // Friction (Dampening)
        c.vx *= FRICTION;
        c.vy *= FRICTION;

        // Stop micro-movements
        if (Math.abs(c.vx) < 0.05 && Math.abs(c.vy) < 0.05) {
            c.vx = 0;
            c.vy = 0;
            c.isSleeping = true;
        }

        // Pusher Interaction
        // Check if coin is in pusher area
        const pusherHeight = 50; // Visual height of block
        if (c.y < game.pusherY + pusherHeight + c.radius && c.y > game.pusherY - 50) {
            // If overlapping with pusher face
            if (c.y < game.pusherY + pusherHeight) {
                // Push it down!
                c.y = game.pusherY + pusherHeight + c.radius;
                c.vy += 2; // Add downward force
                c.vx += (Math.random() - 0.5) * 1; // Slight jitter
                c.isSleeping = false;
            }
        }

        // Walls / Gutters
        if (game.wallsActive) {
            // Bounc off walls
            if (c.x < c.radius) { c.x = c.radius; c.vx *= -0.5; }
            if (c.x > CANVAS_WIDTH - c.radius) { c.x = CANVAS_WIDTH - c.radius; c.vx *= -0.5; }
        } else {
            // Side Gutter Loss
            if (c.x < -c.radius || c.x > CANVAS_WIDTH + c.radius) {
                game.coins.splice(i, 1);
                createParticles(c.x, c.y, '#ef4444', 5);
                continue; // Lost
            }
        }

        // Bottom Win
        if (c.y > CANVAS_HEIGHT + c.radius) {
            // WINNER!
            if (userProfile) {
                // Special Effect for Gem
                if (c.type === 'gem') {
                    game.wallsActive = true;
                    setWallsActiveTimer(1800); // 30 seconds at 60fps
                    audio.playScore();
                } else {
                    audio.playScore(); // Basic coin sound
                }

                // Add Earnings locally
                setSessionEarnings(prev => prev + c.value);
                setCredits(prev => prev + c.value); // Optimistic UI update
                
                // Async update DB
                // We assume user credit balance is updated via a separate mechanism or we call it here.
                // Since `updateCumulativeScore` just updates the leaderboard, we also need to give the user the Honey.
                // For simplicity, we assume `deductCredit` handles minus, we need an `addCredit` equivalent.
                // We'll use `updateCumulativeScore` to track leaderboard history, and handle wallet separately.
                // HACK: Use negative deduct to add credits? Or create a new service.
                // Let's assume performDailyCheckIn-like logic or just rely on backend.
                // Actually, let's just use `updateCumulativeScore` which updates the LEADERBOARD.
                // We need to update user WALLET too. 
                // Re-using `deductCredit` with negative amount works if implemented that way, 
                // but usually better to have `addCredits`. 
                // Since I cannot change `userService` drastically, I will use `updateCumulativeScore` for leaderboard
                // and assume I can call `deductCredit` with negative number or create a quick `addCredit` in `userService` if I could.
                // Current `deductCredit` uses `increment(-amount)`. So `deductCredit(uid, -10)` adds 10. Clever.
                
                deductCredit(userProfile.uid, -c.value); // Add money
                updateCumulativeScore(userProfile, 'honey_dozer', c.value); // Update Leaderboard History
            }
            
            createParticles(c.x, c.y, '#22c55e', 10);
            game.coins.splice(i, 1);
            continue;
        }
    }

    // Resolve Collisions (N^2 check but N is low < 50 usually)
    // Run multiple iterations for stability
    for (let k = 0; k < 3; k++) {
        for (let i = 0; i < game.coins.length; i++) {
            for (let j = i + 1; j < game.coins.length; j++) {
                resolveCollision(game.coins[i], game.coins[j]);
            }
        }
    }

    // Update Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#171717'; // Dark base
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Hex Pattern Floor
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let y = 0; y < CANVAS_HEIGHT; y+=40) {
        for (let x = 0; x < CANVAS_WIDTH; x+=40) {
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI*2);
            ctx.stroke();
        }
    }

    // Side Gutters
    if (!game.wallsActive) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(0, 200, 20, CANVAS_HEIGHT);
        ctx.fillRect(CANVAS_WIDTH-20, 200, 20, CANVAS_HEIGHT);
    } else {
        // Walls Active Visual
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(0, 200, 10, CANVAS_HEIGHT);
        ctx.fillRect(CANVAS_WIDTH-10, 200, 10, CANVAS_HEIGHT);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3b82f6';
        ctx.strokeStyle = '#60a5fa';
        ctx.beginPath(); ctx.moveTo(10, 200); ctx.lineTo(10, CANVAS_HEIGHT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH-10, 200); ctx.lineTo(CANVAS_WIDTH-10, CANVAS_HEIGHT); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Pusher
    ctx.fillStyle = '#b45309'; // Dark Gold
    ctx.fillRect(0, 0, CANVAS_WIDTH, game.pusherY);
    // Pusher Front Face
    ctx.fillStyle = '#f59e0b'; // Gold
    ctx.fillRect(0, game.pusherY, CANVAS_WIDTH, 50);
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, game.pusherY, CANVAS_WIDTH, 5);

    // Coins
    game.coins.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(2, 2, c.radius, 0, Math.PI*2); ctx.fill();

        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, Math.PI*2); ctx.fill();
        
        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner Detail
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-5, -5, c.radius/2, 0, Math.PI*2); ctx.fill();
        
        // Symbol
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let symbol = '$';
        if (c.type === 'gem') symbol = '💎';
        else if (c.type === 'silver') symbol = 'Ag';
        ctx.fillText(symbol, 0, 0);

        ctx.restore();
    });

    // Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    });
    
    // Win Line
    ctx.strokeStyle = '#22c55e';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT - 5);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 5);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
      if (gameState !== 'PLAYING') return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      let clientX;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
      } else {
          clientX = (e as React.MouseEvent).clientX;
      }
      
      const scaleX = CANVAS_WIDTH / rect.width;
      const x = (clientX - rect.left) * scaleX;
      
      spawnCoin(x);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="w-full max-w-md bg-neutral-900 rounded-xl p-3 border border-yellow-600/30 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2">
              <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-500">
                  <Zap size={20} className="fill-current" />
              </div>
              <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Credits</div>
                  <div className="text-xl font-mono font-black text-white">{credits}</div>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <div className="text-right">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Won</div>
                  <div className="text-xl font-mono font-black text-green-400">+{sessionEarnings}</div>
              </div>
              <div className="bg-green-500/20 p-2 rounded-lg text-green-500">
                  <Coins size={20} />
              </div>
          </div>
      </div>

      <div className="relative w-full max-w-md mx-auto aspect-[360/600] bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-600 select-none touch-none">
        <canvas 
            ref={canvasRef} 
            width={360} 
            height={600} 
            className="w-full h-full block cursor-pointer"
            onMouseDown={handleTap}
            onTouchStart={handleTap}
        />

        {/* Walls Timer */}
        {wallsActiveTimer > 0 && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg animate-pulse z-10">
                <ShieldCheck size={16} /> WALLS: {Math.ceil(wallsActiveTimer / 60)}s
            </div>
        )}

        {/* Start Screen */}
        {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
            <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-amber-600 drop-shadow-lg text-center">
                HONEY<br/>DOZER
            </div>
            <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
                点击屏幕投入金币 (消耗10蜂蜜)<br/>
                利用推板将金币推落下方<br/>
                <span className="text-blue-400">蓝色宝石</span> 会激活防掉落护盾！<br/>
                <span className="text-green-500">赚取的蜂蜜计入历史榜单</span>
            </p>
            {!userProfile ? (
                <div className="text-red-400 font-bold bg-red-900/50 px-4 py-2 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={16}/> 请先登录游戏
                </div>
            ) : (
                <Button onClick={initGame} className="animate-pulse shadow-xl scale-110 bg-yellow-500 hover:bg-yellow-400 border-none text-black font-black px-10 py-4 text-xl">
                    <Play className="mr-2 fill-current" /> PLAY
                </Button>
            )}
            </div>
        )}
      </div>
      
      <p className="text-xs text-neutral-500 text-center">
          Tap anywhere to drop a coin. Don't let them fall off the sides!
      </p>
    </div>
  );
};

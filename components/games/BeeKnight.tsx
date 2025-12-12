
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import { Play, RotateCcw, Package, Utensils, Zap, AlertTriangle, Bike, Clock, Wallet, Loader2, Lock } from 'lucide-react';

interface BeeKnightProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface GameObject {
  id: number;
  lane: number; // 0, 1, 2
  y: number;
  type: 'obstacle' | 'food' | 'customer' | 'coin';
  subtype?: string; // for obstacles: 'car', 'barrier'
  hit: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

export const BeeKnight: React.FC<BeeKnightProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'SETTLING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0); // Leaderboard Score (Points)
  const [sessionHoney, setSessionHoney] = useState(0); // Currency Earned (Honey)
  const [deliveries, setDeliveries] = useState(0);
  const [hasFood, setHasFood] = useState(false);
  const [health, setHealth] = useState(3);
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [timerDisplay, setTimerDisplay] = useState(0); // For UI only

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  const LANE_WIDTH = CANVAS_WIDTH / 3;
  const PLAYER_Y = CANVAS_HEIGHT - 100;
  const INITIAL_DELIVERY_TIME = 600; // 60fps * 10s = 600 frames
  
  const gameRef = useRef({
    lane: 1, // 0: Left, 1: Center, 2: Right
    targetX: CANVAS_WIDTH / 2,
    x: CANVAS_WIDTH / 2,
    speed: 6,
    objects: [] as GameObject[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    roadOffset: 0,
    score: 0,
    sessionHoney: 0,
    hasFood: false,
    deliveryTimer: 0,
    maxDeliveryTime: INITIAL_DELIVERY_TIME,
    health: 3,
    distance: 0,
    frameCount: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  // Lifecycle Cleanup (Unmount only)
  useEffect(() => {
    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'PLAYING') {
        if (e.key === 'ArrowLeft') moveLane(-1);
        if (e.key === 'ArrowRight') moveLane(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState]);

  const moveLane = (dir: number) => {
    const newLane = Math.max(0, Math.min(2, gameRef.current.lane + dir));
    if (newLane !== gameRef.current.lane) {
      gameRef.current.lane = newLane;
      audio.playStep();
    }
  };

  const startGame = () => {
    if (!userProfile) return;
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setSessionHoney(0);
    setDeliveries(0);
    setHasFood(false);
    setHealth(3);
    setTimerDisplay(0);

    gameRef.current = {
      lane: 1,
      targetX: CANVAS_WIDTH / 2,
      x: CANVAS_WIDTH / 2,
      speed: 6,
      objects: [],
      particles: [],
      floatingTexts: [],
      roadOffset: 0,
      score: 0,
      sessionHoney: 0,
      hasFood: false,
      deliveryTimer: 0,
      maxDeliveryTime: INITIAL_DELIVERY_TIME,
      health: 3,
      distance: 0,
      frameCount: 0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now()
    };
    loop();
  };

  const endGame = async () => {
    audio.playGameOver();
    gameRef.current.isGameOver = true;
    setGameState('SETTLING'); // Show loading
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile) {
        try {
            // 1. Save High Score
            if (gameRef.current.score > 0) {
                await saveHighScore(userProfile, 'bee_knight', gameRef.current.score);
            }

            // 2. Settle Honey (Add or Deduct)
            const earned = gameRef.current.sessionHoney;
            if (earned !== 0) {
                // negative value passed to deductCredit actually adds credits (inverse logic in userService)
                // deductCredit(uid, 10) -> user.credits -= 10
                // deductCredit(uid, -10) -> user.credits += 10
                await deductCredit(userProfile.uid, -earned);
                await refreshProfile();
            }
        } catch (e) {
            console.error("Settlement failed", e);
        }
    }
    
    setGameState('GAME_OVER');
    onGameOver();
  };

  const spawnFloatingText = (text: string, color: string, x?: number, y?: number) => {
      gameRef.current.floatingTexts.push({
          x: x || gameRef.current.x,
          y: y || PLAYER_Y - 50,
          text,
          color,
          life: 40,
          vy: -2
      });
  };

  const spawnObject = () => {
    const { hasFood } = gameRef.current;
    const lane = Math.floor(Math.random() * 3);
    const rand = Math.random();
    let type: 'obstacle' | 'food' | 'customer' | 'coin' = 'obstacle';
    
    // Adjusted probabilities for gameplay flow
    if (!hasFood && rand > 0.6) {
        type = 'food';
    } else if (hasFood && rand > 0.6) {
        type = 'customer';
    } else if (rand > 0.3) {
        type = 'obstacle';
    } else {
        type = 'coin';
    }

    // Don't spawn blocking patterns immediately after one another
    const lastObj = gameRef.current.objects[gameRef.current.objects.length - 1];
    if (lastObj && lastObj.y < 150) return; 

    gameRef.current.objects.push({
        id: Date.now() + Math.random(),
        lane,
        y: -100,
        type,
        subtype: Math.random() > 0.5 ? 'car' : 'barrier',
        hit: false
    });
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        gameRef.current.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 10,
            color
        });
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Bike Body
    ctx.fillStyle = '#facc15'; // Yellow Bike
    ctx.fillRect(-15, -20, 30, 40);
    
    // Wheels
    ctx.fillStyle = '#171717';
    ctx.fillRect(-18, -25, 8, 15); // Front L
    ctx.fillRect(10, -25, 8, 15); // Front R
    ctx.fillRect(-18, 15, 8, 15); // Rear L
    ctx.fillRect(10, 15, 8, 15); // Rear R

    // Rider
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(0, -2, 12, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(-8, -2, 16, 4);

    // Delivery Box (Back)
    ctx.fillStyle = '#3b82f6'; // Blue Box
    ctx.fillRect(-14, 10, 28, 20);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, 10, 28, 20);
    
    if (gameRef.current.hasFood) {
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍔', 0, 25);
        
        // Draw Timer Bar above player
        const pct = Math.max(0, gameRef.current.deliveryTimer / gameRef.current.maxDeliveryTime);
        ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#22c55e';
        ctx.fillRect(-20, -40, 40 * pct, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-20, -40, 40, 6);
    } else {
        ctx.fillStyle = 'white';
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bee', 0, 22);
    }

    ctx.restore();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: GameObject, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);

      if (obj.type === 'obstacle') {
          if (obj.subtype === 'car') {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(-20, -30, 40, 60);
              ctx.fillStyle = '#7f1d1d';
              ctx.fillRect(-15, -10, 30, 15);
              ctx.fillStyle = '#000';
              ctx.fillRect(-22, -20, 4, 12); ctx.fillRect(18, -20, 4, 12);
              ctx.fillRect(-22, 10, 4, 12); ctx.fillRect(18, 10, 4, 12);
          } else {
              ctx.fillStyle = '#fbbf24';
              ctx.fillRect(-25, -10, 50, 20);
              ctx.fillStyle = '#000';
              ctx.beginPath();
              ctx.moveTo(-15, -10); ctx.lineTo(-5, 10); ctx.lineTo(-10, 10); ctx.lineTo(-20, -10); ctx.fill();
              ctx.beginPath();
              ctx.moveTo(5, -10); ctx.lineTo(15, 10); ctx.lineTo(10, 10); ctx.lineTo(0, -10); ctx.fill();
          }
      } else if (obj.type === 'food') {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍔', 0, 0);
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.strokeStyle = '#fbbf24'; ctx.stroke();
          ctx.shadowBlur = 0;
      } else if (obj.type === 'customer') {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐶', 0, 0);
          ctx.fillStyle = '#FFF';
          ctx.fillRect(10, -30, 30, 20);
          ctx.fillStyle = '#000';
          ctx.font = '12px serif';
          ctx.fillText('🍽️', 25, -20);
      } else if (obj.type === 'coin') {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#FFF';
          ctx.font = '10px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0);
      }

      ctx.restore();
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

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;
    game.frameCount++;
    
    // --- UPDATE ---

    // Difficulty ramp
    game.speed += 0.001; 
    
    // Player Position Lerp
    game.targetX = (game.lane * LANE_WIDTH) + (LANE_WIDTH / 2);
    game.x += (game.targetX - game.x) * 0.2;

    // Road Scroll
    game.roadOffset += game.speed;
    if (game.roadOffset >= 40) game.roadOffset = 0;

    // Timer Logic
    if (game.hasFood) {
        game.deliveryTimer--;
        // Update UI every 10 frames to avoid React overhead
        if (game.frameCount % 10 === 0) {
            setTimerDisplay(Math.ceil(game.deliveryTimer / 60));
        }

        if (game.deliveryTimer <= 0) {
            // TIMEOUT
            game.hasFood = false;
            setHasFood(false);
            game.sessionHoney -= 2; // Penalty
            setSessionHoney(game.sessionHoney);
            spawnFloatingText("超时! -2 🍯", "#ef4444");
            audio.playGameOver(); // Fail sound
        }
    }

    // Spawning
    const spawnRate = Math.max(30, 100 - Math.floor(game.speed * 5));
    if (game.frameCount % spawnRate === 0) {
        spawnObject();
    }

    // Update Objects
    for (let i = game.objects.length - 1; i >= 0; i--) {
        const obj = game.objects[i];
        obj.y += game.speed;

        if (obj.y > CANVAS_HEIGHT + 50) {
            game.objects.splice(i, 1);
            continue;
        }

        // Collision
        if (!obj.hit && 
            Math.abs(obj.y - PLAYER_Y) < 40 && // Y overlap
            Math.abs((obj.lane * LANE_WIDTH + LANE_WIDTH/2) - game.x) < 30 // X overlap
        ) {
            if (obj.type === 'obstacle') {
                obj.hit = true;
                game.health--;
                setHealth(game.health);
                createParticles(game.x, PLAYER_Y, '#ef4444', 10);
                audio.playGameOver(); 
                
                if (game.health <= 0) {
                    endGame();
                    return;
                }
            } else if (obj.type === 'coin') {
                obj.hit = true;
                game.score += 100; // Score
                game.sessionHoney += 6; // Money (Increased to 6)
                setScore(game.score);
                setSessionHoney(game.sessionHoney);
                spawnFloatingText("+6 🍯", "#fbbf24");
                audio.playScore();
                game.objects.splice(i, 1);
            } else if (obj.type === 'food') {
                if (!game.hasFood) {
                    obj.hit = true;
                    game.hasFood = true;
                    game.deliveryTimer = game.maxDeliveryTime; // Reset Timer
                    setHasFood(true);
                    audio.playScore(); 
                    game.objects.splice(i, 1);
                    createParticles(game.x, PLAYER_Y, '#22c55e', 8);
                    spawnFloatingText("接单!", "#22c55e");
                }
            } else if (obj.type === 'customer') {
                if (game.hasFood) {
                    obj.hit = true;
                    game.hasFood = false;
                    setHasFood(false);
                    
                    const bonus = Math.floor(game.deliveryTimer / 60); // Speed bonus points
                    game.score += 500 + bonus * 10;
                    game.sessionHoney += 30; // Flat reward (Increased to 30)
                    
                    setScore(game.score);
                    setSessionHoney(game.sessionHoney);
                    setDeliveries(prev => prev + 1);
                    
                    audio.playScore(); 
                    createParticles(game.x, PLAYER_Y, '#fbbf24', 15);
                    spawnFloatingText("+30 🍯", "#fbbf24");
                }
            }
        }
    }

    // Update Particles & Floating Text
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }
    for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
        const t = game.floatingTexts[i];
        t.y += t.vy;
        t.life--;
        if (t.life <= 0) game.floatingTexts.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road
    ctx.fillStyle = '#374151'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Lane Markers
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -game.roadOffset;
    ctx.beginPath();
    ctx.moveTo(LANE_WIDTH, 0); ctx.lineTo(LANE_WIDTH, CANVAS_HEIGHT);
    ctx.moveTo(LANE_WIDTH * 2, 0); ctx.lineTo(LANE_WIDTH * 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sidewalks
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(0, 0, 10, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 10, 0, 10, CANVAS_HEIGHT);

    // Objects
    game.objects.sort((a,b) => a.y - b.y).forEach(obj => {
        if (obj.hit) return;
        const x = (obj.lane * LANE_WIDTH) + (LANE_WIDTH / 2);
        drawObject(ctx, obj, x, obj.y);
    });

    // Player
    drawPlayer(ctx, game.x, PLAYER_Y);

    // Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 20;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Floating Text
    game.floatingTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || gameState !== 'PLAYING') return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      if (x < rect.width / 2) moveLane(-1);
      else moveLane(1);
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[320/550] bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={550} 
        className="w-full h-full block cursor-pointer"
        onPointerDown={handlePointerDown}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
         <div className="flex items-center gap-1">
             {[...Array(3)].map((_, i) => (
                 <div key={i} className={`w-3 h-3 rounded-full ${i < health ? 'bg-red-500' : 'bg-gray-600'}`}></div>
             ))}
         </div>
         <div className="bg-black/60 text-white px-3 py-1 rounded-xl border border-yellow-500/30 flex items-center gap-2 backdrop-blur-md shadow-lg">
            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="font-black text-xl font-mono">{score}</span>
         </div>
         {hasFood && (
             <div className="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs font-bold animate-pulse flex items-center gap-2 shadow-lg">
                 <Clock size={12}/> {timerDisplay}s
             </div>
         )}
      </div>

      <div className="absolute top-4 right-4 z-10 pointer-events-none flex flex-col items-end gap-1">
          <div className="bg-black/60 text-white px-3 py-1 rounded-xl border border-white/20 flex items-center gap-2 backdrop-blur-md shadow-lg">
             <Wallet size={16} className="text-green-400" />
             <span className="font-black text-sm font-mono">{credits}</span>
          </div>
          <div className="bg-black/40 text-green-300 px-2 py-0.5 rounded text-xs font-bold">
             本局: {sessionHoney >= 0 ? '+' : ''}{sessionHoney}
          </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-600 drop-shadow-lg text-center transform -rotate-3">
             BEE<br/>KNIGHT
          </div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
            点击屏幕 / 键盘 <span className="text-white">左/右</span> 变道。<br/>
            捡起 <span className="text-green-400">食物🍔</span> 送给 <span className="text-yellow-400">顾客🐶</span>。<br/>
            <span className="text-red-400">注意：超时送餐会扣除蜂蜜！</span>
          </p>
          
          {!userProfile ? (
              <div className="bg-red-500/20 border border-red-500 p-4 rounded-xl text-center">
                  <p className="text-red-400 font-bold mb-2 flex items-center justify-center gap-2"><Lock size={18}/> 未登录</p>
                  <p className="text-sm text-gray-300">请先登录游戏账号，以便记录您的工资（蜂蜜）。</p>
              </div>
          ) : (
              <Button onClick={startGame} className="animate-pulse shadow-[0_0_25px_rgba(234,179,8,0.6)] scale-110 bg-yellow-600 hover:bg-yellow-500 border-none text-black font-black px-10 py-4 text-xl">
                 <Play className="mr-2 fill-current" /> 开始送餐
              </Button>
          )}
        </div>
      )}

      {/* Settlement / Game Over Screen */}
      {(gameState === 'SETTLING' || gameState === 'GAME_OVER') && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <div className="text-4xl font-black mb-2 text-white italic">CRASHED!</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Game Score</div>
             <div className="text-5xl font-black text-yellow-400 font-mono tracking-tighter mb-4">{score}</div>
             
             <div className="w-full h-px bg-white/10 mb-4"></div>
             
             <div className="flex justify-between w-full text-sm mb-2">
                 <span className="text-gray-400">送达单数:</span>
                 <span className="font-bold">{deliveries}</span>
             </div>
             <div className="flex justify-between w-full text-sm items-center">
                 <span className="text-gray-400">本局收益:</span>
                 {gameState === 'SETTLING' ? (
                     <span className="text-yellow-500 flex items-center gap-1 animate-pulse"><Loader2 size={12} className="animate-spin"/> 结算中</span>
                 ) : (
                     <span className={`font-black font-mono ${sessionHoney >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {sessionHoney >= 0 ? '+' : ''}{sessionHoney} 🍯
                     </span>
                 )}
             </div>
          </div>

          <Button onClick={startGame} disabled={gameState === 'SETTLING'} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold disabled:opacity-50">
             <RotateCcw className="mr-2" /> 接下一单
          </Button>
        </div>
      )}

    </div>
  );
};

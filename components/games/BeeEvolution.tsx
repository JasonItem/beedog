
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Crown, AlertTriangle } from 'lucide-react';

interface BeeEvolutionProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Evolution Tiers
const TIERS = [
  { id: 0, name: 'Egg', radius: 15, color: '#f3f4f6', score: 2 },        // 🥚
  { id: 1, name: 'Larva', radius: 25, color: '#a3e635', score: 4 },      // 🐛
  { id: 2, name: 'Bee', radius: 35, color: '#fbbf24', score: 8 },        // 🐝
  { id: 3, name: 'Honey', radius: 45, color: '#d97706', score: 16 },     // 🍯
  { id: 4, name: 'Bag', radius: 55, color: '#22c55e', score: 32 },       // 💰
  { id: 5, name: 'Diamond', radius: 65, color: '#3b82f6', score: 64 },   // 💎
  { id: 6, name: 'Rocket', radius: 75, color: '#ef4444', score: 128 },   // 🚀
  { id: 7, name: 'Moon', radius: 90, color: '#94a3b8', score: 256 },     // 🌕
  { id: 8, name: 'BeeDog', radius: 110, color: '#FFD700', score: 512 },  // 🐶 (Target)
];

interface Ball {
  id: number;
  tierId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  isMerging: boolean; // Visual scale effect
  scale: number;
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

export const BeeEvolution: React.FC<BeeEvolutionProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [nextTier, setNextTier] = useState(0); // Next ball to drop preview

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 500;
  const GRAVITY = 0.5;
  const DAMPING = 0.6; // Wall bounce energy loss
  const FRICTION = 0.98; // Air resistance
  const DEADLINE_Y = 100; // Game over line
  
  const gameRef = useRef({
    balls: [] as Ball[],
    particles: [] as Particle[],
    currentBallX: CANVAS_WIDTH / 2, // Where the player is aiming
    nextTierId: 0, // Tier of the ball ready to drop
    isDropping: false, // Cooldown
    dropTimer: 0,
    score: 0,
    isGameOver: false,
    animationId: 0,
    deadlineTimer: 0
  });

  useEffect(() => {
    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const createBall = (x: number, y: number, tierId: number, isNewDrop: boolean = false): Ball => {
    const tier = TIERS[tierId];
    return {
      id: Date.now() + Math.random(),
      tierId,
      x,
      y,
      vx: 0,
      vy: isNewDrop ? 0 : 0,
      radius: tier.radius,
      mass: tier.radius, // Simple mass approximation
      isMerging: !isNewDrop, // If created from merge, trigger anim
      scale: isNewDrop ? 1 : 0.1 // Pop in effect
    };
  };

  const createParticles = (x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        gameRef.current.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            color,
            size: Math.random() * 4 + 2
        });
    }
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setNextTier(0);

    gameRef.current = {
      balls: [],
      particles: [],
      currentBallX: CANVAS_WIDTH / 2,
      nextTierId: 0,
      isDropping: false,
      dropTimer: 0,
      score: 0,
      isGameOver: false,
      animationId: 0,
      deadlineTimer: 0
    };
    
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_evolution', gameRef.current.score);
      onGameOver();
    }
  };

  const dropBall = () => {
    if (gameRef.current.isDropping || gameState !== 'PLAYING') return;
    
    const { currentBallX, nextTierId } = gameRef.current;
    
    // Add new ball to physics world
    gameRef.current.balls.push(createBall(currentBallX, 50, nextTierId, true));
    
    // Reset next
    gameRef.current.isDropping = true;
    gameRef.current.dropTimer = 30; // 0.5s delay
    
    // Determine next tier (Random 0-3 mostly)
    // As score gets higher, maybe allow slightly higher starting tiers?
    // Standard game: Random 0-4
    const rand = Math.random();
    let nextId = 0;
    if (rand > 0.9) nextId = 3;
    else if (rand > 0.7) nextId = 2;
    else if (rand > 0.4) nextId = 1;
    
    gameRef.current.nextTierId = nextId;
    setNextTier(nextId);
  };

  const resolveCollision = (b1: Ball, b2: Ball) => {
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < b1.radius + b2.radius) {
        // --- MERGE LOGIC ---
        if (b1.tierId === b2.tierId && b1.tierId < TIERS.length - 1) {
            // Remove both
            b1.radius = 0; // Mark for removal
            b2.radius = 0; 
            
            // Create next tier at midpoint
            const midX = (b1.x + b2.x) / 2;
            const midY = (b1.y + b2.y) / 2;
            const nextId = b1.tierId + 1;
            
            gameRef.current.balls.push(createBall(midX, midY, nextId));
            
            // Score
            const points = TIERS[nextId].score;
            gameRef.current.score += points;
            setScore(gameRef.current.score);
            
            // Effects
            createParticles(midX, midY, TIERS[nextId].color, 15);
            
            return; // Done
        }

        // --- PHYSICS BOUNCE LOGIC ---
        // Normal vector
        const nx = dx / dist;
        const ny = dy / dist;

        // Tangent vector
        const tx = -ny;
        const ty = nx;

        // Dot Product Tangent
        const dpTan1 = b1.vx * tx + b1.vy * ty;
        const dpTan2 = b2.vx * tx + b2.vy * ty;

        // Dot Product Normal
        const dpNorm1 = b1.vx * nx + b1.vy * ny;
        const dpNorm2 = b2.vx * nx + b2.vy * ny;

        // Conservation of momentum in 1D
        const m1 = (dpNorm1 * (b1.mass - b2.mass) + 2 * b2.mass * dpNorm2) / (b1.mass + b2.mass);
        const m2 = (dpNorm2 * (b2.mass - b1.mass) + 2 * b1.mass * dpNorm1) / (b1.mass + b2.mass);

        // Update velocities
        b1.vx = tx * dpTan1 + nx * m1;
        b1.vy = ty * dpTan1 + ny * m1;
        b2.vx = tx * dpTan2 + nx * m2;
        b2.vy = ty * dpTan2 + ny * m2;

        // Prevent overlap (Static resolution)
        const overlap = (b1.radius + b2.radius - dist) / 2;
        b1.x -= overlap * nx;
        b1.y -= overlap * ny;
        b2.x += overlap * nx;
        b2.y += overlap * ny;
        
        // Energy loss
        b1.vx *= 0.9; b1.vy *= 0.9;
        b2.vx *= 0.9; b2.vy *= 0.9;
    }
  };

  const drawTierIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, tierId: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    const tier = TIERS[tierId];
    
    // Circle body
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = tier.color;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Gloss
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-radius*0.3, -radius*0.3, radius*0.2, radius*0.15, Math.PI/4, 0, Math.PI*2);
    ctx.fill();

    // Icon / Emoji
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Adjust font size based on radius
    const fontSize = radius * 1.0; 
    ctx.font = `${fontSize}px serif`;
    
    let char = '';
    switch(tierId) {
        case 0: char = '🥚'; break;
        case 1: char = '🐛'; break;
        case 2: char = '🐝'; break;
        case 3: char = '🍯'; break;
        case 4: char = '💰'; break;
        case 5: char = '💎'; break;
        case 6: char = '🚀'; break;
        case 7: char = '🌕'; break;
        case 8: char = '🐶'; break;
    }
    ctx.fillText(char, 0, 5); // offset slightly

    ctx.restore();
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;

    // Input Handling (Cooldown)
    if (game.isDropping) {
        game.dropTimer--;
        if (game.dropTimer <= 0) {
            game.isDropping = false;
        }
    }

    // --- PHYSICS UPDATES ---
    
    // 1. Gravity & Movement
    for (const b of game.balls) {
        b.vy += GRAVITY;
        b.vx *= FRICTION;
        b.vy *= FRICTION;
        
        b.x += b.vx;
        b.y += b.vy;

        // Scale anim
        if (b.scale < 1) b.scale += 0.1;
        if (b.scale > 1) b.scale = 1;

        // Floor
        if (b.y + b.radius > CANVAS_HEIGHT) {
            b.y = CANVAS_HEIGHT - b.radius;
            b.vy *= -DAMPING;
            b.vx *= 0.8; // Floor friction
        }
        // Walls
        if (b.x - b.radius < 0) {
            b.x = b.radius;
            b.vx *= -DAMPING;
        }
        if (b.x + b.radius > CANVAS_WIDTH) {
            b.x = CANVAS_WIDTH - b.radius;
            b.vx *= -DAMPING;
        }
    }

    // 2. Collision Resolution (Iterative for stability)
    // Run multiple passes to stabilize stacks
    for (let k = 0; k < 4; k++) {
        for (let i = 0; i < game.balls.length; i++) {
            for (let j = i + 1; j < game.balls.length; j++) {
                resolveCollision(game.balls[i], game.balls[j]);
            }
        }
    }

    // 3. Cleanup Merged Balls (radius 0)
    game.balls = game.balls.filter(b => b.radius > 0);

    // 4. Update Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // 5. Game Over Check
    // Check if any ball is above deadline AND essentially stopped (stable stack)
    // Ignore balls that are currently dropping (first second of life)
    let exceeding = false;
    for (const b of game.balls) {
        // Only check balls that are settled or high up but not just spawned
        // We can check if velocity is low
        if (b.y - b.radius < DEADLINE_Y && Math.abs(b.vy) < 1 && Math.abs(b.vx) < 1) {
            exceeding = true;
            break;
        }
    }

    if (exceeding) {
        game.deadlineTimer++;
        if (game.deadlineTimer > 120) { // 2 seconds over line
            endGame();
            return;
        }
    } else {
        game.deadlineTimer = 0;
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Container
    ctx.fillStyle = '#fef3c7'; // Light Amber
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Deadline
    if (game.deadlineTimer > 0) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + Math.sin(Date.now() * 0.02) * 0.5})`; // Flashing Red
        ctx.lineWidth = 4;
    } else {
        ctx.strokeStyle = '#e5e7eb'; // Grey
        ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(CANVAS_WIDTH, DEADLINE_Y);
    ctx.stroke();
    if (game.deadlineTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('WARNING!', 10, DEADLINE_Y - 5);
    }

    // Draw Balls
    for (const b of game.balls) {
        drawTierIcon(ctx, b.x, b.y, b.radius, b.tierId, b.scale);
    }

    // Draw Particles
    for (const p of game.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Draw Aimer (Top Line)
    if (!game.isDropping) {
        ctx.strokeStyle = '#9ca3af';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(game.currentBallX, 20);
        ctx.lineTo(game.currentBallX, CANVAS_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);

        // Preview Ball
        drawTierIcon(ctx, game.currentBallX, 50, TIERS[game.nextTierId].radius, game.nextTierId, 1);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
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

    // Update X position
    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    gameRef.current.currentBallX = Math.max(10, Math.min(CANVAS_WIDTH - 10, x));
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault(); // Prevent scroll on touch
      handlePointerMove(e);
      dropBall();
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[320/500] bg-white rounded-xl overflow-hidden shadow-2xl border-4 border-amber-400 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={500} 
        className="w-full h-full block cursor-crosshair"
        onMouseMove={handlePointerMove}
        onMouseDown={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchStart={handlePointerDown}
      />

      {/* HUD */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
         <div className="bg-white/80 px-3 py-1 rounded-full border border-amber-200 shadow-sm flex items-center gap-2">
            <span className="text-2xl">🐶</span>
            <span className="font-black text-xl text-amber-600">{score}</span>
         </div>
      </div>

      {/* Evolution Guide */}
      <div className="absolute top-2 right-2 z-10 pointer-events-none opacity-50 scale-75 origin-top-right">
         <div className="bg-white/80 p-2 rounded-xl border border-amber-200 grid grid-cols-3 gap-1 w-24">
            {TIERS.slice(0, 9).map(t => (
                <div key={t.id} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{backgroundColor: t.color}}>
                    {['🥚','🐛','🐝','🍯','💰','💎','🚀','🌕','🐶'][t.id]}
                </div>
            ))}
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-black p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-orange-600 drop-shadow-sm text-center">
             BeeDog<br/>Evolution
          </div>
          <p className="mb-8 font-bold text-center text-neutral-500 text-sm leading-relaxed max-w-[260px]">
            点击屏幕释放球体<br/>
            相同物体碰撞会 <span className="text-amber-500">合成进化</span><br/>
            目标：合成大 BeeDog!
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-xl scale-110 bg-amber-500 hover:bg-amber-400 text-black border-none px-8 py-3">
             <Play className="mr-2 fill-current" /> PLAY
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <AlertTriangle size={48} className="text-red-500 mb-4 animate-pulse" />
          <div className="text-4xl font-black mb-6 text-white">OVERFLOW!</div>
          
          <div className="bg-[#1f2937] border border-[#374151] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-lg relative overflow-hidden">
             <div className="text-xs text-neutral-400 uppercase font-bold mb-1 tracking-[0.2em]">Final Score</div>
             <div className="text-6xl font-black text-amber-400 font-mono tracking-tighter">{score}</div>
             <Crown className="absolute top-4 right-4 text-yellow-600 opacity-20 rotate-12" size={48}/>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再试一次
          </Button>
        </div>
      )}

    </div>
  );
};


import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Shield, Heart } from 'lucide-react';

interface BeeDefenseProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'normal' | 'fast' | 'tank';
  hp: number;
  radius: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const BeeDefense: React.FC<BeeDefenseProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;
  
  // Game Ref
  const gameRef = useRef({
    bees: [] as Enemy[],
    particles: [] as Particle[],
    spawnRate: 60, // frames between spawns
    frameCount: 0,
    score: 0,
    health: 100,
    difficultyMultiplier: 1.0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0
  });

  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  useEffect(() => {
    // Load BeeDog Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce";
    img.onload = () => {
      imageRef.current = img;
    };

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    setGameState('PLAYING');
    setScore(0);
    setHealth(100);
    
    gameRef.current = {
      bees: [],
      particles: [],
      spawnRate: 60,
      frameCount: 0,
      score: 0,
      health: 100,
      difficultyMultiplier: 1.0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now()
    };
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_defense', gameRef.current.score);
      onGameOver();
    }
  };

  const spawnBee = () => {
    // Spawn from edge
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let x = 0, y = 0;
    
    switch(side) {
      case 0: x = Math.random() * CANVAS_WIDTH; y = -20; break;
      case 1: x = CANVAS_WIDTH + 20; y = Math.random() * CANVAS_HEIGHT; break;
      case 2: x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 20; break;
      case 3: x = -20; y = Math.random() * CANVAS_HEIGHT; break;
    }

    // Calculate velocity vector towards center
    const angle = Math.atan2(CENTER_Y - y, CENTER_X - x);
    
    // Randomize type
    const rand = Math.random();
    let type: 'normal' | 'fast' | 'tank' = 'normal';
    let speed = 2;
    let hp = 1;
    let radius = 12;

    if (gameRef.current.score > 500 && rand > 0.8) {
       type = 'tank';
       speed = 1.0;
       hp = 3;
       radius = 16;
    } else if (gameRef.current.score > 200 && rand > 0.6) {
       type = 'fast';
       speed = 3.5;
       hp = 1;
       radius = 10;
    }

    // Difficulty scaling
    speed *= gameRef.current.difficultyMultiplier;

    gameRef.current.bees.push({
      id: Date.now() + Math.random(),
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      type,
      hp,
      radius
    });
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for(let i=0; i<8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      gameRef.current.particles.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20,
        color
      });
    }
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    
    // Get coordinates
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    // Scale coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Hit detection (iterate backwards to hit top bees first)
    const bees = gameRef.current.bees;
    for (let i = bees.length - 1; i >= 0; i--) {
      const b = bees[i];
      const dx = x - b.x;
      const dy = y - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // Tap radius allowance (make it easier to hit)
      if (dist < b.radius + 15) {
        b.hp--;
        createExplosion(b.x, b.y, '#FFF');
        
        if (b.hp <= 0) {
          // Score
          let points = 10;
          if (b.type === 'fast') points = 20;
          if (b.type === 'tank') points = 50;
          gameRef.current.score += points;
          setScore(gameRef.current.score);
          
          // Remove bee
          bees.splice(i, 1);
          createExplosion(b.x, b.y, b.type === 'tank' ? '#F00' : '#FFD700');
        } else {
          // Hit effect but not dead
          b.x -= b.vx * 2; // Knockback
          b.y -= b.vy * 2;
        }
        return; // Only hit one bee per tap
      }
    }
  };

  const drawBee = (ctx: CanvasRenderingContext2D, b: Enemy) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    // Rotate towards center
    ctx.rotate(Math.atan2(b.vy, b.vx));

    // Body
    ctx.fillStyle = b.type === 'tank' ? '#991b1b' : b.type === 'fast' ? '#ea580c' : '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.radius, b.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Stripes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.fillRect(-5, -b.radius*0.7, 3, b.radius*1.4);
    ctx.fillRect(2, -b.radius*0.7, 3, b.radius*1.4);

    // Wings (Animated)
    const wingOffset = Math.sin(gameRef.current.frameCount * 0.5) * 5;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(0, -b.radius + wingOffset, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, b.radius - wingOffset, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helmet for Tank
    if (b.type === 'tank') {
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(5, 0, 8, -Math.PI/2, Math.PI/2);
        ctx.fill();
        ctx.stroke();
    }

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

    if (gameRef.current.isGameOver) return;

    gameRef.current.frameCount++;

    // Spawning Logic
    // Difficulty ramp up
    gameRef.current.difficultyMultiplier = 1 + (gameRef.current.score / 1000);
    const currentSpawnRate = Math.max(20, 60 - Math.floor(gameRef.current.score / 50));
    
    if (gameRef.current.frameCount % currentSpawnRate === 0) {
      spawnBee();
    }

    // Update Logic
    const game = gameRef.current;
    
    // Update Bees
    for (let i = game.bees.length - 1; i >= 0; i--) {
      const b = game.bees[i];
      b.x += b.vx;
      b.y += b.vy;

      // Check collision with BeeDog
      const dx = b.x - CENTER_X;
      const dy = b.y - CENTER_Y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      // BeeDog radius grows as health drops (swelling)
      const beeDogRadius = 40 + (100 - game.health) * 0.3;

      if (dist < beeDogRadius) {
        // Sting!
        game.health -= 10;
        setHealth(game.health);
        createExplosion(b.x, b.y, '#F00');
        game.bees.splice(i, 1);

        if (game.health <= 0) {
          endGame();
          return;
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

    // Draw BeeDog (Center)
    ctx.save();
    ctx.translate(CENTER_X, CENTER_Y);
    
    // Scale face based on low health (swelling)
    const swellScale = 1 + ((100 - game.health) / 100) * 0.5;
    ctx.scale(swellScale, swellScale);

    if (imageRef.current) {
      // Draw Image
      const size = 80;
      ctx.drawImage(imageRef.current, -size / 2, -size / 2, size, size);
    } else {
      // Fallback Drawing if image not loaded
      ctx.fillStyle = '#d97706'; // Dark Golden
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-12, -5, 4, 0, Math.PI * 2);
      ctx.arc(12, -5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Swollen bumps (Red dots appear when damaged)
    if (game.health < 80) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.beginPath(); ctx.arc(-20, 15, 8, 0, Math.PI*2); ctx.fill();
    }
    if (game.health < 50) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.beginPath(); ctx.arc(25, -10, 10, 0, Math.PI*2); ctx.fill();
    }
    
    ctx.restore();

    // Draw Bees
    game.bees.forEach(b => drawBee(ctx, b));

    // Draw Particles
    game.particles.forEach(p => {
       ctx.fillStyle = p.color;
       ctx.globalAlpha = p.life / 20;
       ctx.beginPath();
       ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
       ctx.fill();
       ctx.globalAlpha = 1.0;
    });
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[2/3] bg-gradient-to-b from-sky-200 to-green-100 rounded-xl overflow-hidden shadow-2xl border-4 border-black dark:border-white select-none touch-none">
      
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl opacity-10 pointer-events-none">🛡️</div>

      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="relative z-10 w-full h-full block cursor-crosshair active:cursor-grabbing"
        onMouseDown={handleTap}
        onTouchStart={handleTap}
      />

      {/* HUD */}
      <div className="absolute top-2 left-2 right-2 z-20 flex justify-between pointer-events-none">
         <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            <span className="font-black text-xl text-blue-900">{score}</span>
         </div>
         
         {/* Health Bar */}
         <div className="flex items-center gap-1">
            <Heart size={20} className="text-red-500 fill-red-500" />
            <div className="w-32 h-4 bg-white rounded-full border border-black overflow-hidden">
               <div 
                 className={`h-full transition-all duration-300 ${health > 50 ? 'bg-green-500' : health > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                 style={{ width: `${health}%` }}
               />
            </div>
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-30">
          <div className="text-4xl font-black mb-2 text-yellow-400 drop-shadow-lg text-center">Bee Defense<br/><span className="text-2xl text-white">保卫狗头</span></div>
          <p className="mb-6 font-bold text-center text-neutral-300 text-sm">
            蜜蜂大军来袭！<br/>
            <span className="text-yellow-400">点击蜜蜂</span> 拍死它们。<br/>
            不要让 BeeDog 的脸肿成猪头！
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-xl scale-110">
             <Play className="mr-2" /> 开始防守
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-30">
          <div className="text-3xl font-black mb-2 text-red-500">脸肿了! 😭</div>
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-6 w-full mb-6 flex flex-col items-center shadow-lg">
             <div className="text-xs text-neutral-400 uppercase font-bold mb-1">防守得分</div>
             <div className="text-5xl font-black text-white font-mono">{score}</div>
          </div>
          <Button onClick={startGame} className="w-full mb-3">
             <RotateCcw className="mr-2" /> 再次尝试
          </Button>
        </div>
      )}

    </div>
  );
};

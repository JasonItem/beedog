
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Trophy, CircleDot } from 'lucide-react';

interface BeeVolleyProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
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

export const BeeVolley: React.FC<BeeVolleyProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beeDogImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [ballCount, setBallCount] = useState(1);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const GRAVITY = 0.4;
  const FRICTION = 0.99;
  const PLAYER_SPEED = 8;
  const PLAYER_WIDTH = 60;
  const PLAYER_HEIGHT = 60; // Adjusted for square-ish image
  const BOUNCE_FORCE = -16; 
  const SPAWN_FORCE = -19; // Strong upward force for bottom spawn

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 70, // Slightly above bottom
    balls: [] as Ball[],
    particles: [] as Particle[],
    score: 0,
    hitsForNextBall: 8, // Start slower (8 hits)
    currentHits: 0,
    isGameOver: false,
    keys: { left: false, right: false },
    animationId: 0,
    lastFrameTime: 0,
    playerSquish: 0, // Visual effect
  });

  useEffect(() => {
    // Load BeeDog Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      beeDogImgRef.current = img;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameRef.current.keys.left = true;
      if (e.key === 'ArrowRight') gameRef.current.keys.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameRef.current.keys.left = false;
      if (e.key === 'ArrowRight') gameRef.current.keys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const createBall = (x: number, y: number, vy: number = 0): Ball => {
    return {
      id: Date.now() + Math.random(),
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: vy,
      radius: 18,
      rotation: 0,
      color: '#FFF'
    };
  };

  const createSandParticles = (x: number, y: number, count: number, speed: number) => {
    for (let i = 0; i < count; i++) {
        gameRef.current.particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 1) * speed,
            life: 20 + Math.random() * 10,
            color: Math.random() > 0.5 ? '#d97706' : '#fcd34d', // Dark/Light sand
            size: Math.random() * 3 + 1
        });
    }
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setBallCount(1);

    gameRef.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 70,
      // First ball spawns from top center for a fair start
      balls: [createBall(CANVAS_WIDTH / 2, 80, 0)],
      particles: [],
      score: 0,
      hitsForNextBall: 8, 
      currentHits: 0,
      isGameOver: false,
      keys: { left: false, right: false },
      animationId: 0,
      lastFrameTime: performance.now(),
      playerSquish: 0,
    };
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_volley', gameRef.current.score);
      onGameOver();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, squish: number) => {
    ctx.save();
    // Squish effect (stretch width, shrink height)
    const w = PLAYER_WIDTH * (1 + squish * 0.2);
    const h = PLAYER_HEIGHT * (1 - squish * 0.2);
    const drawX = x - (w - PLAYER_WIDTH) / 2;
    const drawY = y + (PLAYER_HEIGHT - h); // Stick to bottom

    if (beeDogImgRef.current) {
        ctx.drawImage(beeDogImgRef.current, drawX, drawY, w, h);
    } else {
        // Fallback
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(x + PLAYER_WIDTH/2, y + PLAYER_HEIGHT/2, w/2, h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Ball Base
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    
    // Panels (Volleyball style)
    ctx.fillStyle = '#facc15'; // Yellow
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, -0.5, 1.0);
    ctx.lineTo(0,0);
    ctx.fill();
    
    ctx.fillStyle = '#3b82f6'; // Blue
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 1.5, 3.0);
    ctx.lineTo(0,0);
    ctx.fill();

    // Outline
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gloss
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-5, -5, ball.radius/2, ball.radius/3, -0.5, 0, Math.PI*2);
    ctx.fill();

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

    const game = gameRef.current;

    // --- PHYSICS & LOGIC ---

    // Player Squish Recovery
    game.playerSquish *= 0.8;

    // Player Movement
    let moved = false;
    if (game.keys.left) {
        game.playerX -= PLAYER_SPEED;
        moved = true;
    }
    if (game.keys.right) {
        game.playerX += PLAYER_SPEED;
        moved = true;
    }

    // Sand Particles on Move
    if (moved && Math.random() > 0.5) {
        createSandParticles(
            game.playerX + PLAYER_WIDTH/2 + (Math.random()-0.5)*20, 
            game.playerY + PLAYER_HEIGHT, 
            1, 
            2
        );
    }

    // Wall Constraint
    if (game.playerX < 0) game.playerX = 0;
    if (game.playerX + PLAYER_WIDTH > CANVAS_WIDTH) game.playerX = CANVAS_WIDTH - PLAYER_WIDTH;

    // Ball Physics
    for (let i = 0; i < game.balls.length; i++) {
      const ball = game.balls[i];
      
      ball.vy += GRAVITY;
      ball.vx *= FRICTION;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.rotation += ball.vx * 0.05;

      // Wall Bounce
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx * 0.8;
      }
      if (ball.x + ball.radius > CANVAS_WIDTH) {
        ball.x = CANVAS_WIDTH - ball.radius;
        ball.vx = -ball.vx * 0.8;
      }

      // Ceiling Bounce
      if (ball.y - ball.radius < 0 && ball.vy < 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy * 0.5;
      }

      // --- GAME OVER LOGIC (UPDATED) ---
      // Lose only if ball falls below screen AND was moving DOWN.
      // This allows balls spawned from bottom (moving up) to pass safely.
      if (ball.y + ball.radius > CANVAS_HEIGHT + 20) { // Slight buffer +20
          if (ball.vy > 0) {
              endGame();
              return;
          }
      }

      // Player Collision (Box vs Circle simplified)
      // Check if ball is within player's bounding box area
      if (
        ball.y + ball.radius > game.playerY + 10 && // Top + offset
        ball.y - ball.radius < game.playerY + PLAYER_HEIGHT &&
        ball.x + ball.radius > game.playerX &&
        ball.x - ball.radius < game.playerX + PLAYER_WIDTH
      ) {
        // Only bounce if ball is moving down
        if (ball.vy > 0) {
           ball.vy = BOUNCE_FORCE;
           ball.y = game.playerY - ball.radius + 12; // Snap to top overlap slightly
           
           // Horizontal deflection
           const center = game.playerX + PLAYER_WIDTH / 2;
           const hitPoint = ball.x - center;
           ball.vx = hitPoint * 0.2; 

           // Effects
           game.playerSquish = 0.5; // Squish player
           createSandParticles(ball.x, game.playerY, 5, 5); // Particles from impact

           // Score & Progression
           game.score++;
           setScore(game.score);
           
           game.currentHits++;
           // Check for new ball spawn
           if (game.currentHits >= game.hitsForNextBall) {
             game.currentHits = 0;
             game.hitsForNextBall += 5; // Scale difficulty
             
             // --- SPAWN NEW BALL FROM BOTTOM ---
             const spawnX = Math.random() * (CANVAS_WIDTH - 60) + 30;
             game.balls.push(createBall(spawnX, CANVAS_HEIGHT, SPAWN_FORCE));
             setBallCount(game.balls.length);
           }
        }
      }
    }

    // Particle Physics
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, '#38bdf8'); // Sky
    skyGrad.addColorStop(0.6, '#bae6fd');
    skyGrad.addColorStop(0.6, '#0ea5e9'); // Ocean Horizon Line
    skyGrad.addColorStop(0.8, '#7dd3fc'); // Shallow water
    skyGrad.addColorStop(0.8, '#fde047'); // Sand start
    skyGrad.addColorStop(1, '#d97706'); // Sand end
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Decor (Sun/Clouds)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(40, 60, 30, 0, Math.PI*2); ctx.fill(); // Sun glare

    // 3. Shadow (Only if ball is above ground)
    game.balls.forEach(ball => {
        if (ball.y < CANVAS_HEIGHT - 20) {
            const groundY = CANVAS_HEIGHT - 30;
            const dist = groundY - ball.y;
            const shadowSize = Math.max(5, ball.radius - dist * 0.05);
            const alpha = Math.max(0, 0.3 - dist * 0.001);
            
            ctx.fillStyle = `rgba(0,0,0,${alpha})`;
            ctx.beginPath();
            ctx.ellipse(ball.x, groundY, shadowSize, shadowSize * 0.3, 0, 0, Math.PI*2);
            ctx.fill();
        }
    });

    // 4. Particles (Sand)
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // 5. Player
    drawPlayer(ctx, game.playerX, game.playerY, game.playerSquish);

    // 6. Balls
    game.balls.forEach(ball => drawBall(ctx, ball));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;
    if (touchX < screenWidth / 2) {
       gameRef.current.keys.left = true;
       gameRef.current.keys.right = false;
    } else {
       gameRef.current.keys.right = true;
       gameRef.current.keys.left = false;
    }
  };

  const handleTouchEnd = () => {
    gameRef.current.keys.left = false;
    gameRef.current.keys.right = false;
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[2/3] bg-sky-200 rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-400 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
         <div className="bg-black/40 text-white px-3 py-1 rounded-full border border-white/20 flex items-center gap-2 backdrop-blur-sm">
            <Trophy size={16} className="text-yellow-400" />
            <span className="font-black text-lg">{score}</span>
         </div>
         <div className="bg-black/40 text-white px-3 py-1 rounded-full border border-white/20 flex items-center gap-2 backdrop-blur-sm">
            <CircleDot size={16} className="text-white" />
            <span className="font-black text-lg">x{ballCount}</span>
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-4xl font-black mb-2 text-yellow-300 drop-shadow-lg stroke-black text-center">Bee Volley<br/><span className="text-2xl text-white">沙滩排球</span></div>
          <p className="mb-8 font-bold text-center text-neutral-200 text-sm">
            左右移动接球，别让球落地！<br/>
            新球会从<span className="text-yellow-400">底部</span>突然飞出，小心！<br/>
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-xl scale-110">
             <Play className="mr-2" /> 开始顶球
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20">
          <div className="text-3xl font-black mb-4 text-red-500">落地了! 🏐</div>
          
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-6 w-full mb-8 flex flex-col items-center shadow-lg">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1">接球次数</div>
             <div className="text-5xl font-black text-white font-mono">{score}</div>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg">
             <RotateCcw className="mr-2" /> 再来一局
          </Button>
        </div>
      )}
      
      {/* Controls Hint */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-4 w-full flex justify-between px-8 opacity-30 pointer-events-none text-white text-xs font-bold uppercase tracking-widest">
           <span>Left</span>
           <span>Right</span>
        </div>
      )}
    </div>
  );
};

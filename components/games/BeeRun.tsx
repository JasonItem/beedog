
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, ChevronsUp, ChevronsDown } from 'lucide-react';

interface BeeRunProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Obstacle {
  id: number;
  x: number;
  y: number; // 0 for floor, 1 for ceiling (relative placement)
  width: number;
  height: number;
  type: 'spike' | 'block' | 'coin';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const BeeRun: React.FC<BeeRunProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beeDogImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const PLAYER_SIZE = 40;
  const GRAVITY_FORCE = 1.2;
  const JUMP_FORCE = 0; // No jump, just gravity flip
  const FLOOR_Y = CANVAS_HEIGHT - 60;
  const CEILING_Y = 60;
  
  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    playerX: 60,
    playerY: FLOOR_Y - PLAYER_SIZE,
    playerVy: 0,
    gravityDir: 1, // 1 = Down (Normal), -1 = Up (Inverted)
    isGrounded: true,
    speed: 6,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    score: 0,
    frameCount: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0,
    bgOffset: 0
  });

  useEffect(() => {
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      beeDogImgRef.current = img;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        flipGravity();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const flipGravity = () => {
    if (gameState !== 'PLAYING') return;
    
    audio.playJump(); // SFX
    
    // Allow flip mid-air? Let's say yes for more dynamic gameplay, or strictly when grounded.
    // Let's allow mid-air control for easier correction.
    gameRef.current.gravityDir *= -1;
    gameRef.current.isGrounded = false;
    
    // Create effect
    createParticles(
        gameRef.current.playerX + PLAYER_SIZE/2, 
        gameRef.current.playerY + PLAYER_SIZE/2, 
        10, 
        '#3b82f6'
    );
  };

  const createParticles = (x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 20 + Math.random() * 10,
            color
        });
    }
  };

  const spawnObstacle = () => {
    const typeRand = Math.random();
    // 50% chance floor, 50% chance ceiling
    const isCeiling = Math.random() > 0.5;
    
    let type: 'spike' | 'block' | 'coin' = 'spike';
    let width = 30;
    let height = 40;
    
    if (typeRand > 0.8) {
        type = 'coin';
        width = 30; height = 30;
    } else if (typeRand > 0.6) {
        type = 'block';
        width = 40; height = 40;
    }

    // Y position calculation
    let y = 0;
    if (type === 'coin') {
        // Coins float in middle sometimes
        y = isCeiling ? CEILING_Y + 10 : FLOOR_Y - 40;
    } else {
        // Spikes/Blocks attached to surface
        y = isCeiling ? CEILING_Y : FLOOR_Y - height;
    }

    gameRef.current.obstacles.push({
        id: Date.now() + Math.random(),
        x: CANVAS_WIDTH + 50,
        y: y,
        width,
        height,
        type
    });
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);

    gameRef.current = {
      playerX: 60,
      playerY: FLOOR_Y - PLAYER_SIZE,
      playerVy: 0,
      gravityDir: 1,
      isGrounded: true,
      speed: 5,
      obstacles: [],
      particles: [],
      score: 0,
      frameCount: 0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now(),
      bgOffset: 0
    };
    loop();
  };

  const endGame = async () => {
    audio.playGameOver(); // SFX
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_run', gameRef.current.score);
      onGameOver();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const { playerX, playerY, gravityDir } = gameRef.current;
    
    ctx.save();
    ctx.translate(playerX + PLAYER_SIZE/2, playerY + PLAYER_SIZE/2);
    
    // Flip if gravity is up
    if (gravityDir === -1) {
        ctx.scale(1, -1);
    }
    
    // Slight tilt based on vertical velocity
    ctx.rotate(gameRef.current.playerVy * 0.05);

    if (beeDogImgRef.current) {
        ctx.drawImage(beeDogImgRef.current, -PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    }
    
    // Trail/Speed effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#3b82f6';
    
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
    game.frameCount++;

    // --- PHYSICS ---
    
    // Gravity application
    // If gravityDir is 1 (down), we add gravity to Vy. If -1 (up), we subtract.
    game.playerVy += GRAVITY_FORCE * game.gravityDir;
    
    // Limit terminal velocity
    const TERMINAL_VEL = 15;
    if (game.playerVy > TERMINAL_VEL) game.playerVy = TERMINAL_VEL;
    if (game.playerVy < -TERMINAL_VEL) game.playerVy = -TERMINAL_VEL;

    game.playerY += game.playerVy;

    // Floor/Ceiling Collision
    game.isGrounded = false;
    
    // Floor Check (Always clamp to bounds)
    if (game.playerY + PLAYER_SIZE > FLOOR_Y) {
        game.playerY = FLOOR_Y - PLAYER_SIZE;
        
        // If moving down into floor
        if (game.playerVy > 0) {
            game.playerVy = 0;
            if (game.gravityDir === 1) { // Only grounded if gravity holds us here
                game.isGrounded = true;
                createParticles(game.playerX, game.playerY + PLAYER_SIZE, 1, '#888'); // Dust
            }
        }
    }
    
    // Ceiling Check (Always clamp to bounds)
    if (game.playerY < CEILING_Y) {
        game.playerY = CEILING_Y;
        
        // If moving up into ceiling
        if (game.playerVy < 0) {
            game.playerVy = 0;
            if (game.gravityDir === -1) { // Only grounded if gravity holds us here
                game.isGrounded = true;
                createParticles(game.playerX, game.playerY, 1, '#888'); // Dust
            }
        }
    }

    // Speed Increase
    if (game.frameCount % 300 === 0) {
        game.speed += 0.5;
    }
    
    // Score
    game.score += 1;
    if (game.frameCount % 10 === 0) setScore(game.score); // Sync raw score

    // Spawning
    // Distance based spawn logic
    const minSpawnDist = 40 + (2000 / game.speed); // Faster = closer spawns allowed
    const lastObstacle = game.obstacles[game.obstacles.length - 1];
    
    if (!lastObstacle || (CANVAS_WIDTH - lastObstacle.x > minSpawnDist)) {
        // Random chance to spawn
        if (Math.random() < 0.05) {
            spawnObstacle();
        }
    }

    // Update Obstacles
    for (let i = game.obstacles.length - 1; i >= 0; i--) {
        const ob = game.obstacles[i];
        ob.x -= game.speed;

        if (ob.x + ob.width < 0) {
            game.obstacles.splice(i, 1);
            continue;
        }

        // Collision Detection
        // Shrink hitbox slightly for fairness
        const padding = 8;
        if (
            game.playerX + padding < ob.x + ob.width - padding &&
            game.playerX + PLAYER_SIZE - padding > ob.x + padding &&
            game.playerY + padding < ob.y + ob.height - padding &&
            game.playerY + PLAYER_SIZE - padding > ob.y + padding
        ) {
            if (ob.type === 'coin') {
                game.score += 500; // Bonus points
                audio.playScore(); // SFX
                createParticles(ob.x + ob.width/2, ob.y + ob.height/2, 10, '#fbbf24');
                game.obstacles.splice(i, 1);
            } else {
                createParticles(game.playerX, game.playerY, 20, '#ef4444');
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

    // Dynamic Background (Sci-fi Tunnel)
    game.bgOffset -= game.speed * 0.5;
    if (game.bgOffset <= -40) game.bgOffset = 0;
    
    // Wall Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#1e1b4b'); // Dark Indigo
    bgGrad.addColorStop(0.5, '#0f172a'); // Slate 900
    bgGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid Lines (Perspective)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)'; // Light Blue
    ctx.lineWidth = 1;
    
    // Horizontal lines (Top and Bottom tracks)
    ctx.beginPath();
    ctx.moveTo(0, CEILING_Y); ctx.lineTo(CANVAS_WIDTH, CEILING_Y);
    ctx.moveTo(0, FLOOR_Y); ctx.lineTo(CANVAS_WIDTH, FLOOR_Y);
    ctx.stroke();

    // Vertical moving lines (Speed effect)
    for (let x = game.bgOffset; x < CANVAS_WIDTH; x += 40) {
        if (x < 0) continue;
        // Ceiling grid
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CEILING_Y); ctx.stroke();
        // Floor grid
        ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
    }

    // Draw Obstacles
    game.obstacles.forEach(ob => {
        if (ob.type === 'coin') {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(ob.x + ob.width/2, ob.y + ob.height/2, ob.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Shine
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.fillText('$', ob.x + 10, ob.y + 20);
        } else if (ob.type === 'spike') {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            // Triangle pointing up or down depending on position
            // Rough heuristic: if y < height/2, it's on ceiling, point down
            const onCeiling = ob.y < CANVAS_HEIGHT / 2;
            
            if (onCeiling) {
                ctx.moveTo(ob.x, ob.y);
                ctx.lineTo(ob.x + ob.width, ob.y);
                ctx.lineTo(ob.x + ob.width/2, ob.y + ob.height);
            } else {
                ctx.moveTo(ob.x, ob.y + ob.height);
                ctx.lineTo(ob.x + ob.width, ob.y + ob.height);
                ctx.lineTo(ob.x + ob.width/2, ob.y);
            }
            ctx.fill();
        } else {
            // Block
            ctx.fillStyle = '#64748b'; // Slate
            ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
            // Highlight
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(ob.x, ob.y, ob.width, 4);
        }
    });

    // Draw Player
    drawPlayer(ctx);

    // Draw Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.random() * 3, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      flipGravity();
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border-4 border-blue-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block cursor-pointer"
        onPointerDown={handlePointerDown}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex gap-4 pointer-events-none">
         <div className="bg-black/60 text-white px-3 py-1.5 rounded-xl border border-blue-500/30 flex items-center gap-2 backdrop-blur-md">
            <Zap size={16} className="text-blue-400 fill-blue-400" />
            <span className="font-black text-xl font-mono">{score}</span>
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-indigo-600 drop-shadow-lg italic transform -skew-x-12 text-center">
             GRAVITY<br/>RUNNER
          </div>
          <p className="mb-10 font-bold text-center text-neutral-400 text-sm leading-relaxed">
            点击屏幕 <span className="text-blue-400">反转重力</span><br/>
            在天花板和地板之间穿梭<br/>
            躲避红色的尖刺！
          </p>
          <Button onClick={startGame} className="animate-pulse shadow-[0_0_25px_rgba(59,130,246,0.6)] scale-110 bg-blue-600 hover:bg-blue-500 border-none text-white font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> RUN!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <div className="text-4xl font-black mb-6 text-white italic">CRASHED!</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Score</div>
             <div className="text-6xl font-black text-blue-400 font-mono tracking-tighter">{score}</div>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再试一次
          </Button>
        </div>
      )}
      
      {/* Controls Hint */}
      {gameState === 'PLAYING' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
           <div className="flex flex-col items-center gap-8">
              <ChevronsUp size={48} className="text-white animate-bounce" />
              <div className="text-xs font-bold text-white uppercase tracking-widest">TAP TO FLIP</div>
              <ChevronsDown size={48} className="text-white animate-bounce" />
           </div>
        </div>
      )}

    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react';

interface BeeJumpProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

export const BeeJump: React.FC<BeeJumpProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Game Constants - Tuned for easier, floatier gameplay
  const GRAVITY = 0.12; // Reduced from 0.2
  const JUMP_FORCE = -5.5; // Reduced from -7
  const MOVEMENT_SPEED = 3.5; // Slightly reduced for control
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  
  // Platform settings
  const PLATFORM_WIDTH = 60;
  const PLATFORM_HEIGHT = 15;
  const RED_PLATFORM_RESPAWN_FRAMES = 180; // ~3 seconds at 60fps

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    playerX: CANVAS_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 150,
    playerVy: 0,
    playerVx: 0,
    platforms: [] as { x: number; y: number; type: 'green' | 'red'; isHidden?: boolean; respawnFrame?: number }[],
    cameraY: 0,
    score: 0,
    isGameOver: false,
    keys: { left: false, right: false },
    animationId: 0,
    frameCount: 0,
    lastFrameTime: 0
  });

  useEffect(() => {
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

  const initGame = () => {
    // Generate initial platforms
    const platforms: { x: number; y: number; type: 'green' | 'red'; isHidden?: boolean; respawnFrame?: number }[] = [];
    // Base platform
    platforms.push({ x: CANVAS_WIDTH / 2 - PLATFORM_WIDTH / 2, y: CANVAS_HEIGHT - 50, type: 'green' });
    
    // Random platforms upwards
    let y = CANVAS_HEIGHT - 50;
    while (y > -CANVAS_HEIGHT * 2) {
      y -= 70 + Math.random() * 40; // Gap between platforms
      const x = Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH);
      const isRed = Math.random() > 0.8; // 20% chance of red (breakable) platform
      platforms.push({ x, y, type: isRed ? 'red' : 'green' });
    }

    gameRef.current = {
      ...gameRef.current,
      playerX: CANVAS_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 150,
      playerVy: JUMP_FORCE, // Initial jump
      playerVx: 0,
      platforms,
      cameraY: 0,
      score: 0,
      isGameOver: false,
      animationId: 0,
      frameCount: 0,
      lastFrameTime: performance.now()
    };
    setScore(0);
    setGameState('PLAYING');
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_jump', gameRef.current.score);
      onGameOver();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, vy: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Simple BeeDog Blob
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Face
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-5, -2, 2, 0, Math.PI * 2); // Left Eye
    ctx.arc(5, -2, 2, 0, Math.PI * 2);  // Right Eye
    ctx.fill();

    // Ears (React to velocity)
    ctx.beginPath();
    if (vy < 0) {
       // Jumping up, ears down
       ctx.ellipse(-12, 0, 4, 8, -0.5, 0, Math.PI * 2);
       ctx.ellipse(12, 0, 4, 8, 0.5, 0, Math.PI * 2);
    } else {
       // Falling, ears up
       ctx.ellipse(-12, -5, 4, 8, -0.5, 0, Math.PI * 2);
       ctx.ellipse(12, -5, 4, 8, 0.5, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#D97706'; // Darker orange ears
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const loop = () => {
    // Keep Requesting
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;

    // Limit FPS
    if (elapsed < FRAME_INTERVAL) return;
    
    // Adjust
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;
    if (game.isGameOver) return;

    game.frameCount++;

    // --- PHYSICS ---
    
    // Horizontal Movement
    if (game.keys.left) game.playerVx = -MOVEMENT_SPEED;
    else if (game.keys.right) game.playerVx = MOVEMENT_SPEED;
    else game.playerVx = 0;

    game.playerX += game.playerVx;

    // Screen wrap (Pacman style)
    if (game.playerX > CANVAS_WIDTH) game.playerX = 0;
    else if (game.playerX < 0) game.playerX = CANVAS_WIDTH;

    // Vertical Movement
    game.playerVy += GRAVITY;
    game.playerY += game.playerVy;

    // Camera / Scroll Logic
    // If player goes above 40% of screen height, move everything down
    const threshold = CANVAS_HEIGHT * 0.4;
    if (game.playerY < threshold) {
      const diff = threshold - game.playerY;
      game.playerY = threshold;
      
      // Move platforms down
      game.platforms.forEach(p => p.y += diff);
      
      // Add score based on height climbed
      game.score += Math.floor(diff);
      setScore(game.score);

      // Generate new platforms at top
      const highestPlatformY = Math.min(...game.platforms.map(p => p.y));
      if (highestPlatformY > 50) {
         const x = Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH);
         const isRed = Math.random() > 0.8;
         game.platforms.push({ 
           x, 
           y: highestPlatformY - (70 + Math.random() * 40), 
           type: isRed ? 'red' : 'green' 
         });
      }

      // Cleanup old platforms
      game.platforms = game.platforms.filter(p => p.y < CANVAS_HEIGHT + 50);
    }

    // --- LOGIC: Platform Collision & Update ---
    
    // 1. Respawn Hidden Platforms
    game.platforms.forEach(p => {
       if (p.isHidden && p.respawnFrame && game.frameCount > p.respawnFrame) {
         p.isHidden = false;
       }
    });

    // 2. Collision (Only when falling)
    if (game.playerVy > 0) {
      for (let i = 0; i < game.platforms.length; i++) {
        const p = game.platforms[i];
        
        // Skip collision if platform is broken/hidden
        if (p.isHidden) continue;

        if (
          game.playerX + 10 > p.x && 
          game.playerX - 10 < p.x + PLATFORM_WIDTH &&
          game.playerY + 12 > p.y &&
          game.playerY + 12 < p.y + PLATFORM_HEIGHT + game.playerVy // Ensure we didn't tunnel through
        ) {
          if (p.type === 'red') {
             // RED CANDLE LOGIC:
             // 1. Jump first! (Provide lift)
             game.playerVy = JUMP_FORCE;
             
             // 2. Then break/hide it
             p.isHidden = true;
             p.respawnFrame = game.frameCount + RED_PLATFORM_RESPAWN_FRAMES;
          } else {
             // GREEN CANDLE:
             // Standard bounce
             game.playerVy = JUMP_FORCE;
          }
          break; // Only collide with one at a time
        }
      }
    }

    // Game Over condition (Falling off screen)
    if (game.playerY > CANVAS_HEIGHT) {
      endGame();
      return;
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<CANVAS_HEIGHT; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Draw Platforms (Candles)
    game.platforms.forEach(p => {
      // Don't draw if hidden
      if (p.isHidden) {
         // Optional: Draw a faint ghost outline to show where it was/will be?
         // For now, let's keep it clean and fully hidden.
         return; 
      }

      // Main Body
      ctx.fillStyle = p.type === 'green' ? '#22c55e' : '#ef4444'; // Green-500 or Red-500
      ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT);
      
      // Wick (Candle style)
      ctx.beginPath();
      ctx.moveTo(p.x + PLATFORM_WIDTH/2, p.y);
      ctx.lineTo(p.x + PLATFORM_WIDTH/2, p.y - 10);
      ctx.moveTo(p.x + PLATFORM_WIDTH/2, p.y + PLATFORM_HEIGHT);
      ctx.lineTo(p.x + PLATFORM_WIDTH/2, p.y + PLATFORM_HEIGHT + 10);
      ctx.strokeStyle = p.type === 'green' ? '#15803d' : '#991b1b';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Bevel effect
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, 4);
    });

    drawPlayer(ctx, game.playerX, game.playerY, game.playerVy);
  };

  // Touch Controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;
    
    // Simple heuristic: touch left side vs right side
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
    <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-[#111] rounded-xl overflow-hidden shadow-2xl border-4 border-black dark:border-white select-none touch-none">
      
      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-xs text-neutral-400 font-bold uppercase">Market Cap (Score)</div>
        <div className="text-3xl font-black text-brand-yellow font-mono">${score}</div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={320} 
        height={550} 
        className="w-full h-full block"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20">
          <div className="text-4xl font-black mb-2 text-green-500 drop-shadow-lg">To The Moon! 🚀</div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm">
            点击屏幕左右两侧控制方向。<br/>
            踩<span className="text-green-500">绿柱子</span>上涨，<span className="text-red-500">红柱子</span>踩完会碎裂!
          </p>
          <Button onClick={initGame} className="animate-bounce shadow-xl scale-125">
             <Play className="mr-2" /> 开始拉盘
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20">
          <div className="text-3xl font-black mb-4 text-red-500">PANIC SELL! 📉</div>
          
          <div className="bg-[#222] border border-[#333] rounded-xl p-6 w-full mb-8 flex flex-col items-center shadow-lg">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1">历史最高市值</div>
             <div className="text-5xl font-black text-brand-yellow font-mono">${score}</div>
          </div>

          <Button onClick={initGame} className="w-full mb-3 py-4 text-lg">
             <RotateCcw className="mr-2" /> 再次抄底
          </Button>
          <p className="text-xs text-neutral-500 mt-4">Diamond Hands Only 💎🙌</p>
        </div>
      )}
      
      {/* Mobile Controls Hint */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-4 w-full flex justify-between px-8 opacity-20 pointer-events-none">
           <ArrowLeft size={48} className="text-white"/>
           <ArrowRight size={48} className="text-white"/>
        </div>
      )}
    </div>
  );
};
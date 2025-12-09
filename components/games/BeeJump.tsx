
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react';

interface BeeJumpProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

export const BeeJump: React.FC<BeeJumpProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beeDogImgRef = useRef<HTMLImageElement | null>(null);
  const starsRef = useRef<{x: number, y: number, size: number, alpha: number}[]>([]);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Game Constants - Insane Mode
  const GRAVITY = 0.6; 
  const JUMP_FORCE = -14.0;
  const MOVEMENT_SPEED = 10.0; 
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
    playerWidth: 40,  // Base size
    playerHeight: 40, // Adjusted dynamically
    platforms: [] as { x: number; y: number; type: 'green' | 'red'; isHidden?: boolean; respawnFrame?: number }[],
    cameraY: 0,
    score: 0,
    isGameOver: false,
    keys: { left: false, right: false },
    animationId: 0,
    frameCount: 0,
    lastFrameTime: 0,
    facingRight: true
  });

  useEffect(() => {
    // Load BeeDog Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      beeDogImgRef.current = img;
      // Calculate aspect ratio
      if (img.naturalHeight > 0) {
          const ratio = img.naturalWidth / img.naturalHeight;
          gameRef.current.playerHeight = gameRef.current.playerWidth / ratio;
      }
    };

    // Initialize Stars
    const stars = [];
    for(let i=0; i<60; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.8 + 0.2
        });
    }
    starsRef.current = stars;

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
      lastFrameTime: performance.now(),
      facingRight: true
    };
    setScore(0);
    setGameState('PLAYING');
    audio.playJump();
    loop();
  };

  const endGame = async () => {
    audio.playGameOver();
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_jump', gameRef.current.score);
      onGameOver();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, vy: number, facingRight: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Slight tilt based on velocity y (jump feel)
    const tilt = vy * 0.05;
    ctx.rotate(tilt);

    if (!facingRight) {
        ctx.scale(-1, 1);
    }

    const w = gameRef.current.playerWidth;
    const h = gameRef.current.playerHeight;

    if (beeDogImgRef.current) {
        ctx.drawImage(beeDogImgRef.current, -w/2, -h/2, w, h);
    } else {
        // Fallback Blob
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.stroke();
    }

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
    if (game.keys.left) {
        game.playerVx = -MOVEMENT_SPEED;
        game.facingRight = false;
    } else if (game.keys.right) {
        game.playerVx = MOVEMENT_SPEED;
        game.facingRight = true;
    } else {
        game.playerVx = 0;
    }

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
      
      // Move stars down (Parallax effect)
      starsRef.current.forEach(s => {
          s.y += diff * 0.2; // Background moves slower
          if (s.y > CANVAS_HEIGHT) {
              s.y = 0;
              s.x = Math.random() * CANVAS_WIDTH;
          }
      });
      
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
          game.playerY + 15 > p.y &&
          game.playerY + 15 < p.y + PLATFORM_HEIGHT + game.playerVy // Ensure we didn't tunnel through
        ) {
          audio.playJump(); // SFX
          if (p.type === 'red') {
             // RED CANDLE LOGIC:
             game.playerVy = JUMP_FORCE;
             p.isHidden = true;
             p.respawnFrame = game.frameCount + RED_PLATFORM_RESPAWN_FRAMES;
          } else {
             // GREEN CANDLE:
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
    
    // 1. Background (Space Gradient)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#020617'); // Slate 950 (Space)
    bgGradient.addColorStop(1, '#1e1b4b'); // Indigo 950 (Atmosphere)
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Stars
    ctx.fillStyle = '#FFF';
    starsRef.current.forEach(s => {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 3. Grid Lines (Faint)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<CANVAS_HEIGHT; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // 4. Platforms (Neon Candles)
    game.platforms.forEach(p => {
      if (p.isHidden) return; 

      const color = p.type === 'green' ? '#22c55e' : '#ef4444';
      const glowColor = p.type === 'green' ? '#4ade80' : '#f87171';

      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = glowColor;
      
      // Main Body
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT);
      ctx.shadowBlur = 0; // Turn off glow for wick details

      // Wick (Candle style)
      ctx.beginPath();
      // Upper Wick
      ctx.moveTo(p.x + PLATFORM_WIDTH/2, p.y);
      ctx.lineTo(p.x + PLATFORM_WIDTH/2, p.y - 15);
      // Lower Wick
      ctx.moveTo(p.x + PLATFORM_WIDTH/2, p.y + PLATFORM_HEIGHT);
      ctx.lineTo(p.x + PLATFORM_WIDTH/2, p.y + PLATFORM_HEIGHT + 15);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Glass/Bevel effect
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, 4);
      
      ctx.restore();
    });

    // 5. Player
    drawPlayer(ctx, game.playerX, game.playerY, game.playerVy, game.facingRight);
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
    <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-[#020617] rounded-xl overflow-hidden shadow-2xl border-4 border-black dark:border-white select-none touch-none">
      
      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-xs text-neutral-400 font-bold uppercase tracking-widest mb-1">Market Cap</div>
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-mono drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            ${score.toLocaleString()}
        </div>
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
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 drop-shadow-lg tracking-tighter">MOONSHOT</div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed">
            点击屏幕两侧控制方向<br/>
            踩住 <span className="text-green-400 glow-text">绿色阳线</span> 上涨<br/>
            小心 <span className="text-red-500 glow-text">红色阴线</span> 会碎裂!
          </p>
          <Button onClick={initGame} className="animate-bounce shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-110 border-none bg-green-600 hover:bg-green-500 text-white">
             <Play className="mr-2 fill-current" /> 开始拉盘
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <div className="text-4xl font-black mb-4 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">RECT! 📉</div>
          
          <div className="bg-[#111] border border-[#333] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-2 tracking-widest">历史最高市值 (ATH)</div>
             <div className="text-5xl font-black text-yellow-500 font-mono">${score.toLocaleString()}</div>
          </div>

          <Button onClick={initGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none">
             <RotateCcw className="mr-2" /> 再次抄底
          </Button>
          <p className="text-xs text-neutral-600 mt-4 font-mono">Diamond Hands Only 💎🙌</p>
        </div>
      )}
      
      {/* Mobile Controls Hint */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-4 w-full flex justify-between px-8 opacity-10 pointer-events-none">
           <ArrowLeft size={48} className="text-white"/>
           <ArrowRight size={48} className="text-white"/>
        </div>
      )}
    </div>
  );
};

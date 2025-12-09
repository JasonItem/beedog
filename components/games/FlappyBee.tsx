
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw } from 'lucide-react';

interface FlappyBeeProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

export const FlappyBee: React.FC<FlappyBeeProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdImgRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Game Constants - Insane Mode
  const GRAVITY = 0.6; 
  const JUMP = -9.0;    
  const PIPE_SPEED = 5.0; 
  const PIPE_SPAWN_RATE = 70; 
  const GAP_SIZE = 140; 
  const GROUND_HEIGHT = 60;
  
  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  // Game Refs
  const gameRef = useRef({
    birdY: 200, 
    birdVelocity: 0,
    birdX: 60,
    birdWidth: 40,
    birdHeight: 40, // Will be adjusted on image load
    pipes: [] as { x: number; topHeight: number; passed: boolean }[],
    clouds: [] as { x: number; y: number; scale: number; speed: number; opacity: number }[],
    groundOffset: 0,
    frameCount: 0,
    score: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0
  });

  useEffect(() => {
    // Load Bird Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      birdImgRef.current = img;
      // Calculate aspect ratio to prevent distortion
      const ratio = img.naturalWidth / img.naturalHeight;
      gameRef.current.birdWidth = 45; // Slightly larger base width
      gameRef.current.birdHeight = 45 / ratio;
    };

    // Initialize Clouds with more variety
    const clouds = [];
    for(let i=0; i<6; i++) {
        clouds.push({
            x: Math.random() * 320,
            y: Math.random() * 250,
            scale: 0.3 + Math.random() * 0.7,
            speed: 0.2 + Math.random() * 0.5,
            opacity: 0.4 + Math.random() * 0.4
        });
    }
    gameRef.current.clouds = clouds;

    return () => {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
  }, []);

  const startGame = () => {
    if (gameRef.current.animationId) {
      cancelAnimationFrame(gameRef.current.animationId);
    }

    setGameState('PLAYING');
    setScore(0);
    
    // Reset Game State
    gameRef.current.birdY = 200;
    gameRef.current.birdVelocity = -5;
    gameRef.current.pipes = [];
    gameRef.current.frameCount = 0;
    gameRef.current.score = 0;
    gameRef.current.isGameOver = false;
    gameRef.current.lastFrameTime = performance.now();
    gameRef.current.groundOffset = 0;
    
    audio.playJump(); // Initial jump
    loop();
  };

  const jump = (e?: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    // FIX: Prevent double-firing and browser zooming/scrolling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (gameState === 'PLAYING') {
      gameRef.current.birdVelocity = JUMP;
      audio.playJump(); // SFX
    } else if (gameState === 'START' || gameState === 'GAME_OVER') {
      // Optional: Tap to restart logic handled by button
    }
  };

  const endGame = async () => {
    if (gameRef.current.isGameOver) return; // Prevent double trigger
    
    audio.playGameOver(); // SFX
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);
    
    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'flappy_bee', gameRef.current.score);
      onGameOver();
    }
  };

  const drawCloud = (ctx: CanvasRenderingContext2D, cloud: { x: number; y: number; scale: number; opacity: number }) => {
      ctx.save();
      ctx.translate(cloud.x, cloud.y);
      ctx.scale(cloud.scale, cloud.scale);
      ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
      
      // Draw fluffy cloud shape
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.arc(25, -10, 25, 0, Math.PI * 2);
      ctx.arc(50, 0, 20, 0, Math.PI * 2);
      ctx.arc(25, 10, 20, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Rotate based on velocity
    const rotation = Math.min(Math.PI / 2, Math.max(-Math.PI / 4, (velocity * 0.1)));
    ctx.rotate(rotation);

    const w = gameRef.current.birdWidth;
    const h = gameRef.current.birdHeight;

    if (birdImgRef.current) {
        ctx.drawImage(birdImgRef.current, -w/2, -h/2, w, h);
    } else {
        // Fallback
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2);
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

    const game = gameRef.current;
    if (game.isGameOver) return;

    // --- PHYSICS & LOGIC ---

    // Bird Physics
    game.birdVelocity += GRAVITY;
    game.birdY += game.birdVelocity;

    // Ground Scroll
    game.groundOffset = (game.groundOffset + PIPE_SPEED) % 40; // Larger pattern for road markings

    // Cloud Animation
    game.clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x < -100) c.x = canvas.width + 100;
    });

    // Pipe Spawning
    game.frameCount++;
    if (game.frameCount % PIPE_SPAWN_RATE === 0) {
      const minHeight = 50;
      const maxHeight = canvas.height - GROUND_HEIGHT - GAP_SIZE - minHeight;
      const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
      game.pipes.push({ x: canvas.width, topHeight: randomHeight, passed: false });
    }

    // Pipe Logic
    for (let i = 0; i < game.pipes.length; i++) {
      const p = game.pipes[i];
      p.x -= PIPE_SPEED;

      // Hitbox
      // Tighter hitbox for fairness
      const paddingX = 8;
      const paddingY = 8;
      const birdLeft = game.birdX - game.birdWidth / 2 + paddingX;
      const birdRight = game.birdX + game.birdWidth / 2 - paddingX;
      const birdTop = game.birdY - game.birdHeight / 2 + paddingY;
      const birdBottom = game.birdY + game.birdHeight / 2 - paddingY;

      const pipeLeft = p.x;
      const pipeRight = p.x + 50;
      const pipeTopY = p.topHeight;
      const pipeBottomY = p.topHeight + GAP_SIZE;

      // Collision Check
      if (
        birdRight > pipeLeft && 
        birdLeft < pipeRight && 
        (birdTop < pipeTopY || birdBottom > pipeBottomY)
      ) {
        endGame();
        return;
      }

      // Score
      if (pipeRight < birdLeft && !p.passed) {
        game.score++;
        p.passed = true;
        setScore(game.score);
        audio.playScore(); // SFX
      }
    }

    // Remove old pipes
    game.pipes = game.pipes.filter(p => p.x > -100);

    // Ground/Ceiling Collision
    // Hit ground
    if (game.birdY + game.birdHeight/2 - 5 > canvas.height - GROUND_HEIGHT) {
      endGame();
      return;
    }
    // Hit ceiling (optional, usually Flappy bird allows skimming ceiling, but let's cap it)
    if (game.birdY - game.birdHeight/2 < 0) {
        game.birdY = game.birdHeight/2;
        game.birdVelocity = 0;
    }

    // --- RENDER ---
    
    // Sky (Simplified fill for performance)
    ctx.fillStyle = '#38bdf8'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clouds
    game.clouds.forEach(c => drawCloud(ctx, c));

    // Pipes - OPTIMIZATION: Removed gradients in loop
    for (let i = 0; i < game.pipes.length; i++) {
      const p = game.pipes[i];
      
      // Main Green Body
      ctx.fillStyle = '#22c55e'; // Green-500
      ctx.strokeStyle = '#14532d'; // Green-900 (Border)
      ctx.lineWidth = 2;

      // Top Pipe
      ctx.fillRect(p.x, 0, 50, p.topHeight);
      ctx.strokeRect(p.x, 0, 50, p.topHeight);
      
      // Top Pipe Highlight (Left edge)
      ctx.fillStyle = '#4ade80'; // Green-400
      ctx.fillRect(p.x + 2, 0, 6, p.topHeight);
      
      // Top Pipe Cap
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(p.x - 2, p.topHeight - 24, 54, 24);
      ctx.strokeRect(p.x - 2, p.topHeight - 24, 54, 24);
      // Cap Highlight
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(p.x, p.topHeight - 24, 6, 24);

      // Bottom Pipe
      const bottomY = p.topHeight + GAP_SIZE;
      const bottomHeight = canvas.height - GROUND_HEIGHT - bottomY;
      
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(p.x, bottomY, 50, bottomHeight);
      ctx.strokeRect(p.x, bottomY, 50, bottomHeight);
      // Bottom Pipe Highlight
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(p.x + 2, bottomY, 6, bottomHeight);

      // Bottom Pipe Cap
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(p.x - 2, bottomY, 54, 24);
      ctx.strokeRect(p.x - 2, bottomY, 54, 24);
      // Cap Highlight
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(p.x, bottomY, 6, 24);
    }

    // Ground
    const groundY = canvas.height - GROUND_HEIGHT;
    
    // 1. Grass Layer (Top)
    const grassHeight = 15;
    ctx.fillStyle = '#4ade80'; // Bright Green
    ctx.fillRect(0, groundY, canvas.width, grassHeight);
    
    // Grass Detail (Tufts) - OPTIMIZATION: Batch drawing
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=10) {
        ctx.moveTo(i, groundY);
        ctx.lineTo(i+5, groundY+5);
        ctx.lineTo(i+10, groundY);
    }
    ctx.fill();
    
    // 2. Road/Dirt Layer (Bottom)
    ctx.fillStyle = '#dcdcdc'; // Road Gray
    ctx.fillRect(0, groundY + grassHeight, canvas.width, GROUND_HEIGHT - grassHeight);
    
    // Road Markings (Moving) - OPTIMIZATION: Batch drawing
    ctx.fillStyle = '#a0a0a0'; 
    ctx.beginPath();
    for(let i = -40; i < canvas.width; i += 40) {
        const x = i - game.groundOffset;
        ctx.moveTo(x, groundY + grassHeight);
        ctx.lineTo(x - 20, canvas.height);
        ctx.lineTo(x - 15, canvas.height);
        ctx.lineTo(x + 5, groundY + grassHeight);
    }
    ctx.fill();
    
    // Top Border of Road
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY + grassHeight);
    ctx.lineTo(canvas.width, groundY + grassHeight);
    ctx.stroke();

    // Bird
    drawBird(ctx, game.birdX, game.birdY, game.birdVelocity);
  };

  return (
    <div 
      className="relative w-full max-w-md mx-auto aspect-[3/4] bg-neutral-200 rounded-xl overflow-hidden shadow-2xl border-4 border-black dark:border-white select-none touch-none"
      style={{ touchAction: 'none' }} // CRITICAL: Fixes lag on mobile
    >
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block cursor-pointer"
        onPointerDown={jump} // CRITICAL: Fixes double-jump bug
      />

      {/* Score Overlay */}
      <div className="absolute top-8 left-0 w-full text-center pointer-events-none">
        <span className="text-6xl font-black text-white stroke-black drop-shadow-xl font-comic" style={{ WebkitTextStroke: '2px black' }}>
          {score}
        </span>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-6 z-10 backdrop-blur-sm pointer-events-none">
          <div className="text-4xl font-black mb-2 text-brand-yellow drop-shadow-lg stroke-black" style={{ textShadow: '2px 2px 0 #000' }}>笨鸟先飞</div>
          <p className="mb-6 font-bold text-center text-lg">点击屏幕飞行</p>
          <div className="pointer-events-auto">
            <Button onClick={startGame} className="animate-bounce shadow-xl scale-110">
              <Play className="mr-2" /> 开始挑战
            </Button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-10 backdrop-blur-sm pointer-events-none">
          <div className="text-4xl font-black mb-4 text-red-500" style={{ textShadow: '2px 2px 0 #fff' }}>GAME OVER</div>
          
          <div className="bg-white text-black rounded-2xl p-6 w-full max-w-xs mb-6 flex flex-col items-center shadow-2xl border-4 border-brand-yellow">
             <div className="text-sm text-neutral-500 uppercase font-bold tracking-widest mb-1">本局得分</div>
             <div className="text-6xl font-black mb-2">{score}</div>
             {!userProfile && <p className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">登录后记录成绩!</p>}
          </div>
          
          <div className="pointer-events-auto w-full flex justify-center">
            <Button onClick={startGame} className="w-full max-w-xs py-4 text-lg font-bold shadow-lg hover:scale-105 transition-transform">
              <RotateCcw className="mr-2" /> 再玩一次
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Trophy } from 'lucide-react';

interface FlappyBeeProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

export const FlappyBee: React.FC<FlappyBeeProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Game Constants - INSANE Mode
  const GRAVITY = 0.8; 
  const JUMP = -10.0;    
  const PIPE_SPEED = 7.0; 
  const PIPE_SPAWN_RATE = 50; 
  const GAP_SIZE = 150; 
  
  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  // Game Refs to maintain state inside requestAnimationFrame without re-renders
  const gameRef = useRef({
    birdY: 200, 
    birdVelocity: 0,
    birdX: 50,
    birdSize: 30,
    pipes: [] as { x: number; topHeight: number; passed: boolean }[],
    frameCount: 0,
    score: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0
  });

  useEffect(() => {
    // Cleanup on unmount
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
    gameRef.current = {
      birdY: 200, 
      birdVelocity: -5, // Stronger initial boost
      birdX: 50,
      birdSize: 30,
      pipes: [],
      frameCount: 0,
      score: 0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now()
    };
    loop();
  };

  const jump = (e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch actions (scrolling)
    if (e) e.preventDefault();

    if (gameState === 'PLAYING') {
      gameRef.current.birdVelocity = JUMP;
    } else if (gameState === 'START' || gameState === 'GAME_OVER') {
      // Optional: Allow tap to start/restart
      // startGame(); 
    }
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);
    
    // Save Score
    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'flappy_bee', gameRef.current.score);
      onGameOver(); // Trigger leaderboard refresh in parent
    }
  };

  const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number) => {
    ctx.save();
    
    // Rotate bird based on velocity
    ctx.translate(x, y);
    const kvMultiplier = 0.05; // Reduced rotation sensitivity for smoother look at high speed
    const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (velocity * kvMultiplier)));
    ctx.rotate(rotation);

    // Draw Bee Body (Centered at 0,0 due to translate)
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700'; // Brand Yellow
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Stripes
    ctx.beginPath();
    ctx.moveTo(-5, -13);
    ctx.lineTo(-5, 13);
    ctx.moveTo(5, -13);
    ctx.lineTo(5, 13);
    ctx.stroke();

    // Eye
    ctx.beginPath();
    ctx.arc(12, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, -5, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Wing (Flapping visual)
    ctx.beginPath();
    ctx.ellipse(-5, -8, 10, 6, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const loop = () => {
    // Request next frame immediately to keep loop alive
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;

    // Limit FPS
    if (elapsed < FRAME_INTERVAL) return;

    // Adjust lastFrameTime to target interval (prevents drift)
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;
    if (game.isGameOver) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Physics
    game.birdVelocity += GRAVITY;
    game.birdY += game.birdVelocity;

    // Pipe Logic
    game.frameCount++;
    if (game.frameCount % PIPE_SPAWN_RATE === 0) {
      const minHeight = 50;
      const maxHeight = canvas.height - GAP_SIZE - minHeight;
      const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
      game.pipes.push({ x: canvas.width, topHeight: randomHeight, passed: false });
    }

    // Draw & Move Pipes
    for (let i = 0; i < game.pipes.length; i++) {
      const p = game.pipes[i];
      p.x -= PIPE_SPEED;

      // Draw Pipes
      ctx.fillStyle = '#4ADE80'; // Green-400
      ctx.strokeStyle = '#166534'; // Green-800
      ctx.lineWidth = 3; // Thicker border for cartoon look

      // Top Pipe
      ctx.fillRect(p.x, 0, 52, p.topHeight);
      ctx.strokeRect(p.x, 0, 52, p.topHeight);

      // Bottom Pipe
      const bottomY = p.topHeight + GAP_SIZE;
      ctx.fillRect(p.x, bottomY, 52, canvas.height - bottomY);
      ctx.strokeRect(p.x, bottomY, 52, canvas.height - bottomY);

      // Collision Detection
      // Bird hitbox is roughly circle center (birdX, birdY) radius 15
      // Simplified box collision
      if (
        game.birdX + 15 > p.x && 
        game.birdX - 15 < p.x + 52 && 
        (game.birdY - 10 < p.topHeight || game.birdY + 10 > bottomY)
      ) {
        endGame();
        return;
      }

      // Score
      if (p.x + 52 < game.birdX && !p.passed) {
        game.score++;
        p.passed = true;
        setScore(game.score);
      }
    }

    // Remove off-screen pipes
    game.pipes = game.pipes.filter(p => p.x > -60);

    // Ground/Ceiling Collision
    if (game.birdY + 15 > canvas.height || game.birdY - 15 < 0) {
      endGame();
      return;
    }

    // Draw Bird
    drawBird(ctx, game.birdX, game.birdY, game.birdVelocity);
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-sky-300 rounded-xl overflow-hidden shadow-2xl border-4 border-black dark:border-white select-none touch-none">
      {/* Background Clouds (CSS) */}
      <div className="absolute top-10 left-10 text-white/50 text-6xl opacity-50 select-none pointer-events-none">☁️</div>
      <div className="absolute top-40 right-10 text-white/50 text-4xl opacity-40 select-none pointer-events-none">☁️</div>
      <div className="absolute bottom-10 left-20 text-white/50 text-5xl opacity-60 select-none pointer-events-none">☁️</div>

      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block cursor-pointer"
        onMouseDown={jump}
        onTouchStart={jump}
      />

      {/* Score Overlay */}
      <div className="absolute top-4 left-0 w-full text-center pointer-events-none">
        <span className="text-4xl font-black text-white stroke-black drop-shadow-md font-comic">
          {score}
        </span>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-6 z-10">
          <div className="text-4xl font-black mb-2 text-brand-yellow drop-shadow-lg stroke-black">笨鸟先飞</div>
          <p className="mb-6 font-bold text-lg text-center text-white drop-shadow-md">
            地狱难度：专治不服<br/>
            <span className="text-sm opacity-80">点击屏幕飞行</span>
          </p>
          <Button onClick={startGame} className="animate-bounce shadow-xl">
             <Play className="mr-2" /> 开始挑战
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-10">
          <div className="text-3xl font-black mb-2 text-red-500">GAME OVER</div>
          <div className="bg-white text-black rounded-xl p-4 w-full mb-6 flex flex-col items-center shadow-lg">
             <div className="text-sm text-neutral-500 uppercase font-bold">本局得分</div>
             <div className="text-5xl font-black mb-2">{score}</div>
             {!userProfile && <p className="text-xs text-red-500">登录后记录成绩!</p>}
          </div>
          <Button onClick={startGame} className="w-full mb-2">
             <RotateCcw className="mr-2" /> 再玩一次
          </Button>
        </div>
      )}
    </div>
  );
};
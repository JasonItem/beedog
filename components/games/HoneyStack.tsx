
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Layers } from 'lucide-react';

interface HoneyStackProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Debris {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export const HoneyStack: React.FC<HoneyStackProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const INITIAL_WIDTH = 150;
  const BLOCK_HEIGHT = 25;
  const MOVE_SPEED_BASE = 3;
  
  // Color Palette (Honey / Bee Theme)
  const COLORS = [
    '#f59e0b', // Amber 500
    '#d97706', // Amber 600
    '#fbbf24', // Amber 400
    '#fcd34d', // Amber 300
    '#b45309', // Amber 700
  ];

  const gameRef = useRef({
    stack: [] as Block[],
    currentBlock: { x: 0, y: 0, width: 0, height: 0, color: '' } as Block,
    debris: [] as Debris[],
    direction: 1, // 1 = right, -1 = left
    moveSpeed: MOVE_SPEED_BASE,
    cameraY: 0,
    targetCameraY: 0,
    score: 0,
    combo: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0,
    hue: 0
  });

  const initGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setCombo(0);

    // Initial Base Block
    const baseBlock = {
      x: (CANVAS_WIDTH - INITIAL_WIDTH) / 2,
      y: CANVAS_HEIGHT - 100,
      width: INITIAL_WIDTH,
      height: BLOCK_HEIGHT,
      color: COLORS[0]
    };

    gameRef.current = {
      stack: [baseBlock],
      currentBlock: spawnNextBlock(baseBlock, 1),
      debris: [],
      direction: 1,
      moveSpeed: MOVE_SPEED_BASE,
      cameraY: 0,
      targetCameraY: 0,
      score: 0,
      combo: 0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now(),
      hue: 0
    };
    
    loop();
  };

  const spawnNextBlock = (prevBlock: Block, score: number): Block => {
    // Determine spawn side based on score (even/odd)
    const spawnLeft = score % 2 === 0;
    const y = prevBlock.y - BLOCK_HEIGHT;
    
    // Cycle colors
    const colorIndex = score % COLORS.length;
    
    return {
      x: spawnLeft ? -prevBlock.width : CANVAS_WIDTH,
      y: y,
      width: prevBlock.width,
      height: BLOCK_HEIGHT,
      color: COLORS[colorIndex]
    };
  };

  const placeBlock = () => {
    const game = gameRef.current;
    if (game.isGameOver) return;

    const current = game.currentBlock;
    const prev = game.stack[game.stack.length - 1];

    const dist = current.x - prev.x;
    const absDist = Math.abs(dist);

    // Tolerance for "Perfect" hit
    const PERFECTION_TOLERANCE = 3;

    if (absDist <= PERFECTION_TOLERANCE) {
      // PERFECT HIT
      current.x = prev.x; // Snap to position
      game.combo++;
      setCombo(game.combo);
      
      // Visual feedback for combo
      // Maybe grow width slightly if combo is high?
      if (game.combo >= 3 && current.width < INITIAL_WIDTH) {
          current.width = Math.min(INITIAL_WIDTH, current.width + 5);
          // Adjust x to keep centered relative to growth
          current.x -= 2.5; 
      }
      
      // Spawn particles
      createDebris(current.x, current.y, current.width, current.height, true);

    } else if (absDist >= current.width) {
      // MISS
      endGame();
      return;
    } else {
      // CHOP
      game.combo = 0;
      setCombo(0);
      
      // Calculate cut
      current.width -= absDist;
      let debrisX, debrisWidth;
      
      if (dist > 0) {
        // Slid too far right
        current.x = current.x; // Left side is the new valid part
        debrisX = current.x + current.width;
        debrisWidth = absDist;
      } else {
        // Slid too far left
        current.x = prev.x; // Snap to prev left edge
        debrisX = current.x - absDist;
        debrisWidth = absDist;
      }

      createDebris(debrisX, current.y, debrisWidth, BLOCK_HEIGHT, false);
    }

    // Add to stack
    game.stack.push(current);
    game.score++;
    setScore(game.score);

    // Speed up
    game.moveSpeed = Math.min(8, MOVE_SPEED_BASE + game.score * 0.1);

    // Camera Move
    if (game.stack.length > 5) {
        game.targetCameraY += BLOCK_HEIGHT;
    }

    // Spawn Next
    game.currentBlock = spawnNextBlock(current, game.score + 1);
    
    // Reset spawn position based on even/odd
    const spawnLeft = (game.score + 1) % 2 === 0;
    game.currentBlock.x = spawnLeft ? -current.width : CANVAS_WIDTH;
    game.direction = spawnLeft ? 1 : -1;
  };

  const createDebris = (x: number, y: number, w: number, h: number, isPerfect: boolean) => {
    if (isPerfect) {
        // Sparkles for perfect
        for(let i=0; i<8; i++) {
            gameRef.current.debris.push({
                x: x + Math.random() * w,
                y: y + Math.random() * h,
                width: 4, height: 4,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                color: '#FFF',
                life: 30
            });
        }
    } else {
        // Falling block chunk
        gameRef.current.debris.push({
            x, y,
            width: w, height: h,
            vx: 0,
            vy: 2, // Initial fall speed
            color: '#92400e', // Darker chunk
            life: 60
        });
    }
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    
    // Add the falling block animation for the missed block
    const current = gameRef.current.currentBlock;
    createDebris(current.x, current.y, current.width, current.height, false);

    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'honey_stack', gameRef.current.score);
      onGameOver();
    }
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    // No strict fps limit needed for smooth sliding, but keeping consistency
    const elapsed = now - gameRef.current.lastFrameTime;
    if (elapsed < 16) return; // ~60fps cap
    gameRef.current.lastFrameTime = now;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;

    // --- LOGIC ---
    
    if (!game.isGameOver) {
        // Move Block
        game.currentBlock.x += game.moveSpeed * game.direction;
        
        // Bounce off walls (or just wrap for simple logic, but Stack usually bounces)
        // Standard Stack game: If it goes too far, you lose? No, usually it oscillates.
        if (game.currentBlock.x + game.currentBlock.width > CANVAS_WIDTH + 50) {
            game.direction = -1;
        } else if (game.currentBlock.x < -50) {
            game.direction = 1;
        }
    }

    // Camera Lerp
    game.cameraY += (game.targetCameraY - game.cameraY) * 0.1;

    // Update Debris
    for (let i = game.debris.length - 1; i >= 0; i--) {
        const d = game.debris[i];
        d.y += d.vy;
        d.vy += 0.5; // Gravity
        d.x += d.vx;
        d.life--;
        if (d.life <= 0 || d.y > CANVAS_HEIGHT + game.cameraY) {
            game.debris.splice(i, 1);
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Dynamic Background Gradient
    // Shift hue based on score
    const hue = (200 + game.score * 5) % 360; 
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, `hsl(${hue}, 60%, 10%)`);
    bgGrad.addColorStop(1, `hsl(${hue}, 60%, 20%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(0, game.cameraY); // Move world up

    // Draw Stack
    game.stack.forEach((b, idx) => {
        // Base Color
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        
        // 3D/Lighting Effect
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; // Top Highlight
        ctx.fillRect(b.x, b.y, b.width, 4);
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Side Shadow
        ctx.fillRect(b.x + b.width - 4, b.y, 4, b.height);
        
        // BeeDog decoration on every 10th block
        if (idx > 0 && idx % 10 === 0) {
             ctx.font = '16px serif';
             ctx.textAlign = 'center';
             ctx.fillText('🐶', b.x + b.width/2, b.y + 18);
        }
    });

    // Draw Moving Block
    if (!game.isGameOver) {
        const b = game.currentBlock;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(b.x, b.y, b.width, 4);
    }

    // Draw Debris
    game.debris.forEach(d => {
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x, d.y, d.width, d.height);
    });

    ctx.restore();
    
    // Combo Text Overlay
    if (game.combo > 1) {
        ctx.save();
        ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 50);
        const scale = 1 + Math.sin(now * 0.01) * 0.1;
        ctx.scale(scale, scale);
        ctx.fillStyle = '#FFF';
        ctx.font = '900 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.fillText(`COMBO x${game.combo}!`, 0, 0);
        ctx.restore();
    }
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      placeBlock();
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[2/3] bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border-4 border-amber-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={480} 
        className="w-full h-full block cursor-pointer"
        onMouseDown={handleTap}
        onTouchStart={handleTap}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
         <div className="text-white text-4xl font-black drop-shadow-md font-mono">{score}</div>
         <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">Height</div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 drop-shadow-lg text-center transform -rotate-6">
             HONEY<br/>STACK
          </div>
          <p className="mb-10 font-bold text-center text-neutral-300 text-sm leading-relaxed max-w-[240px]">
            看准时机点击屏幕<br/>
            将蛋糕完美重叠<br/>
            <span className="text-amber-400">连击</span> 可以增加底座宽度！
          </p>
          <Button onClick={initGame} className="animate-bounce shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-110 bg-amber-500 hover:bg-amber-400 border-none text-black font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> STACK IT!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <Layers size={64} className="text-amber-500 mb-4" />
          <div className="text-4xl font-black mb-6 text-white">TOWER FELL</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Final Height</div>
             <div className="text-6xl font-black text-amber-400 font-mono tracking-tighter">{score}</div>
          </div>

          <Button onClick={initGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再来一局
          </Button>
        </div>
      )}

    </div>
  );
};

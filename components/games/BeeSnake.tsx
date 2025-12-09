
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface BeeSnakeProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  color: string;
  life: number;
}

export const BeeSnake: React.FC<BeeSnakeProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null); // For pre-rendering background
  const headImgRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Constants
  const COLS = 20;
  const ROWS = 25; // Slightly taller aspect ratio
  const CELL_SIZE = 16; // Will be scaled by canvas CSS
  const CANVAS_WIDTH = COLS * CELL_SIZE;
  const CANVAS_HEIGHT = ROWS * CELL_SIZE;

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  // Game State Ref
  const gameRef = useRef({
    snake: [] as Point[],
    direction: 'RIGHT' as Direction,
    nextDirection: 'RIGHT' as Direction, // Buffer to prevent self-collision on rapid turns
    food: { x: 0, y: 0 } as Point,
    foodType: 'honey' as 'honey' | 'diamond',
    particles: [] as Particle[],
    
    // TIME-BASED MOVEMENT VARIABLES
    lastMoveTime: 0,
    moveInterval: 150, // Faster Start (Was 300ms)
    minMoveInterval: 60, // Cap speed (Was 80ms)
    
    score: 0,
    isGameOver: false,
    animationId: 0,
    lastFrameTime: 0
  });

  // Pre-render Background Grid
  useEffect(() => {
    if (!bgCanvasRef.current) {
        const bg = document.createElement('canvas');
        bg.width = CANVAS_WIDTH;
        bg.height = CANVAS_HEIGHT;
        const bctx = bg.getContext('2d');
        if (bctx) {
            // Background
            bctx.fillStyle = '#18181b'; // Zinc 900
            bctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Grid Dots (Draw once, reuse forever)
            bctx.fillStyle = '#27272a'; // Zinc 800
            for(let x=0; x<CANVAS_WIDTH; x+=CELL_SIZE) {
               for(let y=0; y<CANVAS_HEIGHT; y+=CELL_SIZE) {
                  bctx.fillRect(x + CELL_SIZE/2 - 1, y + CELL_SIZE/2 - 1, 2, 2);
               }
            }
        }
        bgCanvasRef.current = bg;
    }
  }, []);

  useEffect(() => {
    // Load Snake Head Image
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce";
    img.onload = () => {
      headImgRef.current = img;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp': changeDirection('UP'); break;
        case 'ArrowDown': changeDirection('DOWN'); break;
        case 'ArrowLeft': changeDirection('LEFT'); break;
        case 'ArrowRight': changeDirection('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const changeDirection = (dir: Direction) => {
    const current = gameRef.current.direction;
    // Prevent 180 degree turns
    if (dir === 'UP' && current === 'DOWN') return;
    if (dir === 'DOWN' && current === 'UP') return;
    if (dir === 'LEFT' && current === 'RIGHT') return;
    if (dir === 'RIGHT' && current === 'LEFT') return;
    
    // Buffer the input
    gameRef.current.nextDirection = dir;
  };

  const spawnFood = () => {
    let valid = false;
    let x = 0, y = 0;
    
    // Ensure food doesn't spawn on snake
    while (!valid) {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      valid = !gameRef.current.snake.some(segment => segment.x === x && segment.y === y);
    }

    gameRef.current.food = { x, y };
    // 10% chance for diamond
    gameRef.current.foodType = Math.random() > 0.9 ? 'diamond' : 'honey';
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 5; i++) {
      gameRef.current.particles.push({
        x: x * CELL_SIZE + CELL_SIZE/2,
        y: y * CELL_SIZE + CELL_SIZE/2,
        color,
        life: 15 + Math.random() * 10
      });
    }
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);

    // Initial Snake (3 segments)
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);

    gameRef.current = {
      snake: [{x: startX, y: startY}, {x: startX-1, y: startY}, {x: startX-2, y: startY}],
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      food: { x: 0, y: 0 }, // Will spawn immediately
      foodType: 'honey',
      particles: [],
      
      // Reset Speed
      lastMoveTime: performance.now(),
      moveInterval: 150, // Faster start 
      minMoveInterval: 60,

      score: 0,
      isGameOver: false,
      animationId: 0,
      lastFrameTime: performance.now()
    };
    
    spawnFood();
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_snake', gameRef.current.score);
      onGameOver();
    }
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);
    
    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;

    // Limit FPS to 60
    if (elapsed < FRAME_INTERVAL) return;
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;

    // --- TIME-BASED MOVEMENT LOGIC ---
    if (now - game.lastMoveTime > game.moveInterval) {
        game.lastMoveTime = now;
        
        // Update Direction
        game.direction = game.nextDirection;

        // Move Head
        const head = { ...game.snake[0] };
        switch (game.direction) {
            case 'UP': head.y -= 1; break;
            case 'DOWN': head.y += 1; break;
            case 'LEFT': head.x -= 1; break;
            case 'RIGHT': head.x += 1; break;
        }

        // Collision: Wall
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            endGame();
            return;
        }

        // Collision: Self
        if (game.snake.some(s => s.x === head.x && s.y === head.y)) {
            endGame();
            return;
        }

        // Move logic
        game.snake.unshift(head); // Add new head

        // Check Food
        if (head.x === game.food.x && head.y === game.food.y) {
            // Ate food
            const points = game.foodType === 'diamond' ? 50 : 10;
            game.score += points;
            setScore(game.score);
            
            // Effects
            createParticles(head.x, head.y, game.foodType === 'diamond' ? '#60a5fa' : '#fbbf24');

            // SPEED LOGIC: Decrease interval (Move faster)
            if (game.moveInterval > game.minMoveInterval) {
                game.moveInterval -= 2; // Gradual speed up
            }

            spawnFood();
            // Don't pop tail -> Snake grows
        } else {
            game.snake.pop(); // Remove tail -> Snake moves
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background (Use Pre-rendered canvas)
    if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
    } else {
        // Fallback
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw Food
    const fx = game.food.x * CELL_SIZE + CELL_SIZE/2;
    const fy = game.food.y * CELL_SIZE + CELL_SIZE/2;
    
    // Glow under food
    ctx.shadowBlur = 10;
    ctx.shadowColor = game.foodType === 'diamond' ? '#60a5fa' : '#f59e0b';
    ctx.font = `${CELL_SIZE * 1.2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.foodType === 'diamond' ? '💎' : '🍯', fx, fy);
    ctx.shadowBlur = 0;

    // Draw Snake
    game.snake.forEach((seg, index) => {
        const sx = seg.x * CELL_SIZE;
        const sy = seg.y * CELL_SIZE;
        const cx = sx + CELL_SIZE / 2;
        const cy = sy + CELL_SIZE / 2;
        
        if (index === 0) {
            // HEAD (BeeDog Image)
            if (headImgRef.current) {
                ctx.save();
                ctx.translate(cx, cy);
                
                // Rotate based on direction
                let angle = 0;
                switch(game.direction) {
                    case 'UP': angle = 0; break;
                    case 'RIGHT': angle = Math.PI / 2; break;
                    case 'DOWN': angle = Math.PI; break;
                    case 'LEFT': angle = -Math.PI / 2; break;
                }
                ctx.rotate(angle);
                
                // Draw Head (Slightly larger than cell)
                const size = CELL_SIZE * 2.2;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 5;
                ctx.drawImage(headImgRef.current, -size/2, -size/2, size, size);
                ctx.restore();
            } else {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath(); ctx.arc(cx, cy, CELL_SIZE/2, 0, Math.PI*2); ctx.fill();
            }
        } else {
            // BODY (Bee Stripes)
            ctx.shadowBlur = 0;
            // Alternating Yellow/Black for Bee effect
            const isYellow = index % 2 !== 0; // Segment 1 (neck) is yellow, 2 is black...
            
            ctx.fillStyle = isYellow ? '#fbbf24' : '#1f2937'; // Amber-400 / Gray-800
            ctx.beginPath();
            ctx.arc(cx, cy, CELL_SIZE/2, 0, Math.PI*2);
            ctx.fill();
            
            // Highlight on body
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI*2);
            ctx.fill();
        }
    });

    // Draw Particles
    game.particles.forEach((p, idx) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        p.life--;
        p.x += (Math.random() - 0.5) * 2;
        p.y += (Math.random() - 0.5) * 2;
        if (p.life <= 0) game.particles.splice(idx, 1);
    });
    ctx.globalAlpha = 1.0;
  };

  const buttonClass = "bg-neutral-800/80 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center active:bg-yellow-500/80 active:border-yellow-400 active:text-black transition-all shadow-lg active:scale-95 touch-none";

  return (
    <div className="flex flex-col items-center gap-4">
        <div className="relative w-full max-w-md mx-auto aspect-[4/5] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-600 select-none touch-none">
        <canvas 
            ref={canvasRef} 
            width={320} 
            height={400} 
            className="w-full h-full block"
        />

        {/* HUD */}
        <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/60 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2 backdrop-blur-sm">
                <Zap size={16} className="text-yellow-400" />
                <span className="font-bold font-mono text-lg">{score}</span>
            </div>
        </div>

        {/* Start Screen */}
        {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
            <div className="text-4xl font-black mb-2 text-yellow-400 drop-shadow-lg">Bee Snake</div>
            <p className="mb-8 font-bold text-center text-neutral-300 text-sm">
                吃掉蜂蜜变长。<br/>
                不要撞墙或咬到自己！<br/>
                <span className="text-blue-400">钻石</span> 分数更高。
            </p>
            <Button onClick={startGame} className="animate-pulse shadow-xl scale-110">
                <Play className="mr-2" /> 开始游戏
            </Button>
            </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
            <div className="text-3xl font-black mb-4 text-red-500">OUCH! 💀</div>
            
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-6 w-full mb-8 flex flex-col items-center shadow-lg">
                <div className="text-xs text-neutral-500 uppercase font-bold mb-1">得分</div>
                <div className="text-5xl font-black text-white font-mono">{score}</div>
            </div>

            <Button onClick={startGame} className="w-full mb-3 py-4 text-lg">
                <RotateCcw className="mr-2" /> 再来一局
            </Button>
            </div>
        )}
        </div>

        {/* Mobile Controls (D-Pad) */}
        <div className="grid grid-cols-3 gap-2 w-48 h-32 select-none touch-manipulation">
            <div></div>
            <button 
                className={buttonClass}
                onPointerDown={(e) => { e.preventDefault(); changeDirection('UP'); }}
            >
                <ChevronUp className="text-white w-8 h-8"/>
            </button>
            <div></div>
            
            <button 
                className={buttonClass}
                onPointerDown={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
            >
                <ChevronLeft className="text-white w-8 h-8"/>
            </button>
            <button 
                className={buttonClass}
                onPointerDown={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
            >
                <ChevronDown className="text-white w-8 h-8"/>
            </button>
            <button 
                className={buttonClass}
                onPointerDown={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
            >
                <ChevronRight className="text-white w-8 h-8"/>
            </button>
        </div>
    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, TrendingUp, ArrowLeft, ArrowRight } from 'lucide-react';

interface HoneyClimberProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface TreeSegment {
  id: number;
  hasBranch: boolean;
  side: 'LEFT' | 'RIGHT'; // Side the branch is on
  type: 'green' | 'red'; // Visual style
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

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  vy: number;
}

export const HoneyClimber: React.FC<HoneyClimberProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  
  // Refs for props/state to avoid closure staleness in event listeners/loop
  const userProfileRef = useRef(userProfile);
  const onGameOverRef = useRef(onGameOver);

  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [energy, setEnergy] = useState(100);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  const SEGMENT_HEIGHT = 80;
  const COLUMN_WIDTH = 80;
  const BRANCH_WIDTH = 90;
  const BRANCH_HEIGHT = 40;
  const PLAYER_SIZE = 60; 
  const MAX_ENERGY = 100;
  const ENERGY_DRAIN_RATE = 0.4; // Energy lost per frame
  const ENERGY_GAIN = 12; // Energy gained per step
  
  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    segments: [] as TreeSegment[],
    playerSide: 'LEFT' as 'LEFT' | 'RIGHT',
    playerY: CANVAS_HEIGHT - 180, // Fixed visual Y position
    isChopping: false, // Animation state
    chopTimer: 0,
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    score: 0,
    energy: 100,
    bgOffset: 0,
    shake: 0,
    isGameOver: false,
    isPlaying: false, // Added to track game loop state internally
    animationId: 0,
    lastFrameTime: 0,
    gameOverReason: '' as 'COLLISION' | 'TIMEOUT',
    bgHue: 200 // Starts blue (sky)
  });

  // Sync refs
  useEffect(() => {
    userProfileRef.current = userProfile;
    onGameOverRef.current = onGameOver;
  }, [userProfile, onGameOver]);

  useEffect(() => {
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      dogImgRef.current = img;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameRef.current.isPlaying && !gameRef.current.isGameOver) {
        if (e.key === 'ArrowLeft') handleInput('LEFT');
        if (e.key === 'ArrowRight') handleInput('RIGHT');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const generateSegments = (count: number, startSafe: boolean = false) => {
    const newSegments: TreeSegment[] = [];
    for (let i = 0; i < count; i++) {
        // No branches for the first few segments to let player start
        if (startSafe && i < 3) {
            newSegments.push({ id: Date.now() + i, hasBranch: false, side: 'LEFT', type: 'green' });
            continue;
        }

        // Random branch generation
        // 50% chance of branch
        const hasBranch = Math.random() > 0.5;
        const side = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
        
        newSegments.push({ 
            id: Date.now() + i, 
            hasBranch, 
            side, 
            type: hasBranch ? 'red' : 'green' 
        });
    }
    return newSegments;
  };

  const initGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setEnergy(MAX_ENERGY);

    // Initial Segments (Fill screen + buffer)
    const initialSegments = generateSegments(10, true);

    gameRef.current = {
      segments: initialSegments,
      playerSide: 'LEFT', // Default start
      playerY: CANVAS_HEIGHT - 180,
      isChopping: false,
      chopTimer: 0,
      particles: [],
      floatingTexts: [],
      score: 0,
      energy: MAX_ENERGY,
      bgOffset: 0,
      shake: 0,
      isGameOver: false,
      isPlaying: true,
      animationId: 0,
      lastFrameTime: performance.now(),
      gameOverReason: 'COLLISION',
      bgHue: 200
    };
    
    loop();
  };

  const handleInput = (side: 'LEFT' | 'RIGHT') => {
      const game = gameRef.current;
      if (game.isGameOver) return;

      // 1. Move Player
      game.playerSide = side;
      game.isChopping = true;
      game.chopTimer = 5; // Frames for chop animation

      // 2. Check Collision FIRST
      // The segment immediately ABOVE the player's head (index 1)
      const nextSegment = game.segments[1]; 
      
      if (nextSegment.hasBranch && nextSegment.side === side) {
          endGame('COLLISION');
          return;
      }

      // 3. Success Move
      audio.playStep(); // SFX
      game.score += 1;
      setScore(game.score);
      
      // Add Energy
      game.energy = Math.min(MAX_ENERGY, game.energy + ENERGY_GAIN);
      setEnergy(game.energy);

      // Effects
      game.shake = 5;
      createParticles(
          side === 'LEFT' ? (CANVAS_WIDTH/2 - COLUMN_WIDTH/2) : (CANVAS_WIDTH/2 + COLUMN_WIDTH/2), 
          game.playerY - 20, 
          '#22c55e', 
          5
      );
      
      // Floating Text
      game.floatingTexts.push({
          x: side === 'LEFT' ? CANVAS_WIDTH/2 - 80 : CANVAS_WIDTH/2 + 80,
          y: game.playerY,
          text: '+1',
          life: 20,
          vy: -2
      });

      // 4. Update Tree (Shift Down)
      game.segments.shift(); // Remove bottom
      
      // Add new top segment
      const hasBranch = Math.random() > 0.4; // 60% chance
      const branchSide = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
      game.segments.push({
          id: Date.now(),
          hasBranch,
          side: branchSide,
          type: 'red'
      });

      // Change background hue slowly
      game.bgHue = (game.bgHue + 0.5) % 360;
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 15 + Math.random() * 10,
            color,
            size: Math.random() * 4 + 2
        });
    }
  };

  const endGame = async (reason: 'COLLISION' | 'TIMEOUT') => {
    audio.playGameOver(); // SFX
    gameRef.current.isGameOver = true;
    gameRef.current.isPlaying = false;
    gameRef.current.gameOverReason = reason;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    // Death Shake
    gameRef.current.shake = 20;

    const finalScore = gameRef.current.score;
    const profile = userProfileRef.current;
    
    if (profile && finalScore > 0) {
      await saveHighScore(profile, 'honey_climber', finalScore);
      if (onGameOverRef.current) onGameOverRef.current();
    }
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

    // --- UPDATE ---
    
    if (!game.isGameOver) {
        // Drain Energy
        // Drain faster as score increases
        const drainMultiplier = 1 + (game.score / 200);
        game.energy -= ENERGY_DRAIN_RATE * drainMultiplier;
        if (game.energy <= 0) {
            game.energy = 0;
            endGame('TIMEOUT');
            // Don't return, render the frame
        }
        setEnergy(game.energy); // Sync state for UI bar
    }

    // Shake decay
    if (game.shake > 0) game.shake *= 0.8;
    if (game.shake < 0.5) game.shake = 0;

    // Anim timers
    if (game.chopTimer > 0) game.chopTimer--;

    // Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // Floating Texts
    for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
        const t = game.floatingTexts[i];
        t.y += t.vy;
        t.life--;
        if (t.life <= 0) game.floatingTexts.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    
    // Apply Shake
    const shakeX = (Math.random() - 0.5) * game.shake;
    const shakeY = (Math.random() - 0.5) * game.shake;
    ctx.translate(shakeX, shakeY);

    // Dynamic Background
    // Gradient Sky
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, `hsl(${game.bgHue}, 60%, 20%)`);
    grad.addColorStop(1, `hsl(${game.bgHue}, 60%, 40%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Speed Lines (Visualizing vertical speed)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const x = (now * 0.1 * (i+1) + i * 50) % CANVAS_WIDTH;
        ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT);
    }
    ctx.stroke();

    // Draw Lane Dividers & Danger Zones
    const centerX = CANVAS_WIDTH / 2;
    
    // Danger Highlights (Look ahead)
    const nextSeg = game.segments[1];
    if (nextSeg && nextSeg.hasBranch && !game.isGameOver) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Faint Red Highlight
        if (nextSeg.side === 'LEFT') {
            // Highlight Left Lane
            ctx.fillRect(0, 0, centerX - COLUMN_WIDTH/2, CANVAS_HEIGHT);
        } else {
            // Highlight Right Lane
            ctx.fillRect(centerX + COLUMN_WIDTH/2, 0, CANVAS_WIDTH - (centerX + COLUMN_WIDTH/2), CANVAS_HEIGHT);
        }
    }

    // Lane Dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    // Left Lane divider
    ctx.beginPath(); 
    ctx.moveTo(centerX - COLUMN_WIDTH/2 - 10, 0); 
    ctx.lineTo(centerX - COLUMN_WIDTH/2 - 10, CANVAS_HEIGHT); 
    ctx.stroke();
    // Right Lane divider
    ctx.beginPath(); 
    ctx.moveTo(centerX + COLUMN_WIDTH/2 + 10, 0); 
    ctx.lineTo(centerX + COLUMN_WIDTH/2 + 10, CANVAS_HEIGHT); 
    ctx.stroke();
    ctx.setLineDash([]);

    // --- DRAW TRUNK (Bottom Fill) ---
    // Draw static green blocks below the player to anchor the tower
    const segmentsBelow = Math.ceil((CANVAS_HEIGHT - game.playerY) / SEGMENT_HEIGHT) + 2;
    for (let i = 1; i <= segmentsBelow; i++) {
        const y = game.playerY + (i * SEGMENT_HEIGHT) + SEGMENT_HEIGHT/2;
        ctx.fillStyle = '#22c55e'; // Green
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - SEGMENT_HEIGHT, COLUMN_WIDTH, SEGMENT_HEIGHT);
        // Borders/Shading
        ctx.fillStyle = '#16a34a'; 
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - SEGMENT_HEIGHT, 8, SEGMENT_HEIGHT);
        ctx.fillRect(centerX + COLUMN_WIDTH/2 - 8, y - SEGMENT_HEIGHT, 8, SEGMENT_HEIGHT);
        // Divider
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - 2, COLUMN_WIDTH, 2);
    }

    // --- DRAW ACTIVE SEGMENTS ---
    // We draw from bottom to top visually, based on array order
    game.segments.forEach((seg, index) => {
        const y = game.playerY - (index * SEGMENT_HEIGHT) + SEGMENT_HEIGHT/2;
        
        // Don't draw if off screen top
        if (y < -SEGMENT_HEIGHT) return;

        // Draw Candle Body Segment
        ctx.fillStyle = '#22c55e'; // Green
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - SEGMENT_HEIGHT, COLUMN_WIDTH, SEGMENT_HEIGHT);
        
        // Candle borders
        ctx.fillStyle = '#16a34a'; // Darker Green
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - SEGMENT_HEIGHT, 8, SEGMENT_HEIGHT); // Left shading
        ctx.fillRect(centerX + COLUMN_WIDTH/2 - 8, y - SEGMENT_HEIGHT, 8, SEGMENT_HEIGHT); // Right shading
        
        // Horizontal divider line
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(centerX - COLUMN_WIDTH/2, y - 2, COLUMN_WIDTH, 2);

        // Draw Branch (Red Obstacle)
        if (seg.hasBranch) {
            const isLeft = seg.side === 'LEFT';
            const branchX = isLeft ? centerX - COLUMN_WIDTH/2 - BRANCH_WIDTH : centerX + COLUMN_WIDTH/2;
            const branchY = y - SEGMENT_HEIGHT/2 - BRANCH_HEIGHT/2;
            
            // -- Red Candle Design --
            
            // 1. Wick (Horizontal Line)
            ctx.strokeStyle = '#7f1d1d'; // Dark red
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (isLeft) {
                // Wick extending left
                ctx.moveTo(branchX, branchY + BRANCH_HEIGHT/2);
                ctx.lineTo(branchX - 20, branchY + BRANCH_HEIGHT/2);
                // "Spike" at end of wick
                ctx.lineTo(branchX - 25, branchY + BRANCH_HEIGHT/2 - 5);
                ctx.moveTo(branchX - 20, branchY + BRANCH_HEIGHT/2);
                ctx.lineTo(branchX - 25, branchY + BRANCH_HEIGHT/2 + 5);
            } else {
                // Wick extending right
                ctx.moveTo(branchX + BRANCH_WIDTH, branchY + BRANCH_HEIGHT/2);
                ctx.lineTo(branchX + BRANCH_WIDTH + 20, branchY + BRANCH_HEIGHT/2);
                // "Spike"
                ctx.lineTo(branchX + BRANCH_WIDTH + 25, branchY + BRANCH_HEIGHT/2 - 5);
                ctx.moveTo(branchX + BRANCH_WIDTH + 20, branchY + BRANCH_HEIGHT/2);
                ctx.lineTo(branchX + BRANCH_WIDTH + 25, branchY + BRANCH_HEIGHT/2 + 5);
            }
            ctx.stroke();

            // 2. Body (Red Block)
            ctx.fillStyle = '#ef4444'; // Red
            ctx.fillRect(branchX, branchY, BRANCH_WIDTH, BRANCH_HEIGHT);
            
            // 3. Border/Shading
            ctx.strokeStyle = '#991b1b'; // Darker red border
            ctx.lineWidth = 2;
            ctx.strokeRect(branchX, branchY, BRANCH_WIDTH, BRANCH_HEIGHT);
            
            // 4. Inner texture (Candle fill look)
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(branchX + 5, branchY + 5, BRANCH_WIDTH - 10, BRANCH_HEIGHT - 10);
        }
    });

    // Draw Player
    const playerX = game.playerSide === 'LEFT' 
        ? centerX - COLUMN_WIDTH/2 - PLAYER_SIZE/2 - 15
        : centerX + COLUMN_WIDTH/2 + PLAYER_SIZE/2 + 15;
        
    const playerY = game.playerY - PLAYER_SIZE/2 - 20;

    ctx.save();
    ctx.translate(playerX, playerY);
    
    if (game.playerSide === 'RIGHT') ctx.scale(-1, 1); // Flip if right
    
    // Chop Animation
    if (game.isChopping) {
        ctx.rotate(-0.2); // Tilt forward
        ctx.translate(-5, 5);
    }

    if (dogImgRef.current) {
        ctx.drawImage(dogImgRef.current, -PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    } else {
        ctx.fillStyle = 'yellow';
        ctx.beginPath(); ctx.arc(0,0, PLAYER_SIZE/2, 0, Math.PI*2); ctx.fill();
    }
    
    // Sweat drop if energy low
    if (game.energy < 30) {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); 
        ctx.arc(10, -25, 6, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();

    // Draw Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // Draw Floating Texts
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    game.floatingTexts.forEach(t => {
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillText(t.text, t.x, t.y);
    });

    // Game Over Overlay (Red Tint)
    if (game.isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-shakeX, -shakeY, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
  };

  // Fixed Input Handler using Pointer Events for unified touch/mouse support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Prevent default actions to stop scrolling/zooming on rapid taps
      e.preventDefault(); 
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      // Ensure we get the correct X relative to the canvas
      const x = e.clientX - rect.left;
      
      if (x < rect.width / 2) {
          handleInput('LEFT');
      } else {
          handleInput('RIGHT');
      }
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[320/550] bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border-4 border-green-600 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={550} 
        className="w-full h-full block cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
      />

      {/* Energy Bar (Top) */}
      <div className="absolute top-0 left-0 w-full h-4 bg-gray-800 border-b-2 border-black pointer-events-none">
          <div 
            className={`h-full transition-all duration-75 ${energy < 30 ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'}`} 
            style={{ width: `${energy}%` }}
          />
      </div>

      {/* Score */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
         <span className="text-6xl font-black text-white stroke-black drop-shadow-xl font-display" style={{ WebkitTextStroke: '2px black' }}>
            {score}
         </span>
         <div className="text-xs text-center text-white font-bold bg-black/50 px-2 rounded">FLOORS</div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-yellow-300 drop-shadow-lg text-center transform -rotate-3">
             HONEY<br/>CLIMBER
          </div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
            点击屏幕 <span className="text-white">左侧</span> 或 <span className="text-white">右侧</span> 攀爬。<br/>
            <span className="text-red-500 font-bold bg-red-900/50 px-1 rounded">红色区域 = 危险</span><br/>
            速度要快，不要让 FOMO 能量耗尽！
          </p>
          <Button onClick={initGame} className="animate-pulse shadow-[0_0_25px_rgba(34,197,94,0.6)] scale-110 bg-green-600 hover:bg-green-500 border-none text-white font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> CLIMB!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <div className="text-4xl font-black mb-2 text-red-500 italic">
              {gameRef.current.gameOverReason === 'TIMEOUT' ? "FOMO KILLED YOU" : "BONKED!"}
          </div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Height Reached</div>
             <div className="text-6xl font-black text-green-400 font-mono tracking-tighter">{score}m</div>
          </div>

          <Button onClick={initGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再爬一次
          </Button>
        </div>
      )}

      {/* Mobile Controls Hint */}
      {gameState === 'PLAYING' && score < 5 && (
        <div className="absolute bottom-10 w-full flex justify-between px-12 opacity-30 pointer-events-none animate-pulse">
           <ArrowLeft size={48} className="text-white"/>
           <ArrowRight size={48} className="text-white"/>
        </div>
      )}

    </div>
  );
};

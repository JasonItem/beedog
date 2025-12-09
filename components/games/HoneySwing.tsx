
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, Anchor, MoveRight, Hand } from 'lucide-react';

interface HoneySwingProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface AnchorPoint {
  id: number;
  x: number;
  y: number;
  type: 'candle' | 'pot';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const HoneySwing: React.FC<HoneySwingProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 500;
  const GRAVITY = 0.5; // Reduced slightly for floatier feel
  const AIR_FRICTION = 0.99; // Less friction
  const MAX_ROPE_LENGTH = 300; // Longer rope
  const CAMERA_OFFSET_X = 100; // Player stays this far from left
  
  const gameRef = useRef({
    player: { x: 0, y: 0, vx: 0, vy: 0, radius: 20 },
    anchors: [] as AnchorPoint[],
    currentAnchor: null as AnchorPoint | null, // The one we are currently attached to
    ropeLength: 0,
    cameraX: 0,
    particles: [] as Particle[],
    score: 0,
    isGameOver: false,
    isPressing: false,
    isGameStarted: false, // New flag for safe start
    animationId: 0,
    lastFrameTime: 0,
    floorY: CANVAS_HEIGHT - 50
  });

  useEffect(() => {
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => {
      dogImgRef.current = img;
    };

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const generateAnchors = (startX: number, count: number) => {
    const newAnchors: AnchorPoint[] = [];
    let currentX = startX;
    
    for(let i=0; i<count; i++) {
        // ideally high enough to swing, but reachable
        const y = Math.random() * (CANVAS_HEIGHT * 0.4) + 50; 
        const spacing = 180 + Math.random() * 80; // Wider spacing
        currentX += spacing;
        
        newAnchors.push({
            id: Date.now() + i,
            x: currentX,
            y: y,
            type: Math.random() > 0.8 ? 'pot' : 'candle'
        });
    }
    return newAnchors;
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        gameRef.current.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 10,
            color
        });
    }
  };

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    setGameState('PLAYING');
    setScore(0);

    const startX = 100;
    const startY = 300;

    gameRef.current = {
      player: { x: startX, y: startY, vx: 0, vy: 0, radius: 20 }, // Start static
      anchors: generateAnchors(startX - 50, 10), 
      currentAnchor: null,
      ropeLength: 0,
      cameraX: 0,
      particles: [],
      score: 0,
      isGameOver: false,
      isPressing: false,
      isGameStarted: false, // Wait for first tap
      animationId: 0,
      lastFrameTime: performance.now(),
      floorY: CANVAS_HEIGHT - 30
    };
    
    // Add specific easy first anchor
    gameRef.current.anchors.unshift({
        id: 0,
        x: startX + 100,
        y: 100,
        type: 'candle'
    });
    
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);
    
    const finalScore = Math.floor(gameRef.current.score);
    if (finalScore > bestScore) setBestScore(finalScore);

    if (userProfile && finalScore > 0) {
      await saveHighScore(userProfile, 'honey_swing', finalScore);
      onGameOver();
    }
  };

  const attachRope = () => {
      const game = gameRef.current;
      
      // Handle Start logic
      if (!game.isGameStarted) {
          game.isGameStarted = true;
          game.player.vx = 8; // Initial Launch
          game.player.vy = -8;
      }

      // Find nearest anchor in range
      // Priority: In front of player, within radius
      let bestAnchor = null;
      let minDist = MAX_ROPE_LENGTH;

      // Search origin slightly ahead of player to favor forward swings
      const searchX = game.player.x + 50;
      const searchY = game.player.y - 50;

      for (const anchor of game.anchors) {
          // Filter: Must be roughly in front or above
          if (anchor.x < game.player.x - 50) continue; 

          const dx = anchor.x - game.player.x;
          const dy = anchor.y - game.player.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < minDist) {
              minDist = dist;
              bestAnchor = anchor;
          }
      }

      if (bestAnchor) {
          game.currentAnchor = bestAnchor;
          game.ropeLength = minDist;
          
          // Visual effect
          createParticles(bestAnchor.x, bestAnchor.y, '#fbbf24', 10);
      }
  };

  const detachRope = () => {
      const game = gameRef.current;
      if (game.currentAnchor) {
          // Boost on release to make it feel "Pro"
          // Add forward velocity boost
          game.player.vx *= 1.2;
          game.player.vy *= 1.1;
          game.currentAnchor = null;
      }
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);

    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    const FRAME_INTERVAL = 1000 / 60;
    
    if (elapsed < FRAME_INTERVAL) return;
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;
    const { player } = game;

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#020617'); // Dark Slate
    bgGrad.addColorStop(1, '#172554'); // Blue
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Wait Screen logic (Draw this before camera transform for static UI elements if needed, but here we draw inside world)
    
    ctx.save();
    
    // Camera Transform
    // If not started, lock camera
    if (!game.isGameStarted) {
        game.cameraX = 0;
    } else {
        game.cameraX = player.x - CAMERA_OFFSET_X;
    }
    
    ctx.translate(-game.cameraX, 0);

    // Draw Starting Platform
    ctx.fillStyle = '#334155';
    ctx.fillRect(50, 320, 100, 200); // Platform under player start
    ctx.fillStyle = '#fbbf24'; 
    ctx.fillRect(50, 320, 100, 10); // Platform top

    // Draw Floor (Liquidation Line)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(game.cameraX, game.floorY);
    for (let x = game.cameraX; x < game.cameraX + CANVAS_WIDTH + 50; x+=20) {
        const jitter = Math.sin(x * 0.1) * 5;
        ctx.lineTo(x, game.floorY + jitter);
    }
    ctx.stroke();
    // Fill bottom
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.lineTo(game.cameraX + CANVAS_WIDTH + 50, CANVAS_HEIGHT);
    ctx.lineTo(game.cameraX, CANVAS_HEIGHT);
    ctx.fill();

    // Draw Rope
    if (game.currentAnchor) {
        ctx.strokeStyle = '#fbbf24'; // Honey Gold
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(game.currentAnchor.x, game.currentAnchor.y);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw Anchors
    game.anchors.forEach(a => {
        if (a.type === 'candle') {
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'; // Faint Green
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, 0);
            ctx.lineTo(a.x, a.y);
            ctx.stroke();
            
            ctx.fillStyle = '#22c55e'; // Green
            ctx.fillRect(a.x - 5, a.y - 15, 10, 30);
            
            // Highlight reachable
            if (!game.currentAnchor) {
                const dx = a.x - player.x;
                const dy = a.y - player.y;
                if (Math.sqrt(dx*dx + dy*dy) < MAX_ROPE_LENGTH && a.x > player.x - 50) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#fff';
                }
            }

            ctx.fillStyle = '#4ade80';
            ctx.fillRect(a.x - 3, a.y - 13, 6, 26);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#d97706';
            ctx.beginPath(); ctx.arc(a.x, a.y, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.ellipse(a.x, a.y-5, 8, 4, 0, 0, Math.PI*2); ctx.fill();
        }
    });

    // Draw Player
    ctx.save();
    ctx.translate(player.x, player.y);
    // Rotate towards velocity
    const rot = Math.atan2(player.vy, player.vx);
    ctx.rotate(rot);
    
    if (dogImgRef.current) {
        const size = player.radius * 2.5;
        ctx.drawImage(dogImgRef.current, -size/2, -size/2, size, size);
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(0,0, player.radius, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Particles
    for(let i=game.particles.length-1; i>=0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 20;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    ctx.restore();

    // --- PHYSICS (Only if started) ---
    if (!game.isGameStarted) return;

    // 1. Gravity
    player.vy += GRAVITY;
    player.vx *= AIR_FRICTION;
    player.vy *= AIR_FRICTION;

    // 2. Rope Constraint with Energy Injection
    if (game.currentAnchor) {
        const anc = game.currentAnchor;
        const dx = player.x - anc.x;
        const dy = player.y - anc.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > game.ropeLength) {
            // Position Correction
            const angle = Math.atan2(dy, dx);
            player.x = anc.x + Math.cos(angle) * game.ropeLength;
            player.y = anc.y + Math.sin(angle) * game.ropeLength;

            // Velocity Projection (Cancel velocity parallel to rope)
            const nx = Math.cos(angle); // Normal X
            const ny = Math.sin(angle); // Normal Y
            const dot = player.vx * nx + player.vy * ny;
            
            player.vx -= dot * nx;
            player.vy -= dot * ny;
            
            // --- SWING ASSIST (The "Pump") ---
            // Apply tangential force in direction of movement
            // Tangent vector (-ny, nx)
            const tx = -ny;
            const ty = nx;
            
            // Check if we are moving in direction of tangent
            const dotTan = player.vx * tx + player.vy * ty;
            
            // Add energy!
            const pumpForce = 0.4; // Magic number for "fun"
            if (dotTan > 0) {
                player.vx += tx * pumpForce;
                player.vy += ty * pumpForce;
            } else {
                player.vx -= tx * pumpForce;
                player.vy -= ty * pumpForce;
            }
        }
    }

    // 3. Move
    player.x += player.vx;
    player.y += player.vy;

    // 4. Collision (Floor/Roof)
    if (player.y + player.radius > game.floorY) {
        createParticles(player.x, player.y, '#ef4444', 20);
        endGame();
        return;
    }
    
    // 5. Game Logic
    game.score = Math.max(game.score, (player.x - 100) / 10);
    setScore(Math.floor(game.score));

    // Anchor Management
    const lastAnchor = game.anchors[game.anchors.length - 1];
    if (lastAnchor.x < game.cameraX + CANVAS_WIDTH * 2) {
        const newOnes = generateAnchors(lastAnchor.x, 5);
        game.anchors.push(...newOnes);
    }
    if (game.anchors[0].x < game.cameraX - 200) {
        game.anchors.shift();
    }
  };

  // Input Handlers
  const handleInputStart = (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault(); // Prevent scroll
      if (gameState !== 'PLAYING') return;
      gameRef.current.isPressing = true;
      attachRope();
  };

  const handleInputEnd = (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (gameState !== 'PLAYING') return;
      gameRef.current.isPressing = false;
      detachRope();
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[320/500] bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={500} 
        className="w-full h-full block cursor-crosshair"
        onMouseDown={handleInputStart}
        onMouseUp={handleInputEnd}
        onTouchStart={handleInputStart}
        onTouchEnd={handleInputEnd}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 z-10">
         <div className="bg-black/60 text-white px-3 py-1 rounded-xl border border-yellow-500/30 flex items-center gap-2 backdrop-blur-md">
            <MoveRight size={16} className="text-yellow-400" />
            <span className="font-black text-xl font-mono">{Math.floor(score)}m</span>
         </div>
      </div>

      {/* Start Hint */}
      {gameState === 'PLAYING' && !gameRef.current.isGameStarted && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-bounce">
              <div className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                  <Hand size={20} /> 点击开始摆荡!
              </div>
          </div>
      )}

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-600 drop-shadow-lg text-center transform -rotate-3">
             HONEY<br/>SWING
          </div>
          <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
            像蜘蛛侠一样飞荡！<br/>
            <span className="text-yellow-400">按住屏幕</span> 射出蜂蜜绳<br/>
            <span className="text-white">松开手指</span> 借力飞出<br/>
            利用惯性 <span className="text-green-500">荡得更高</span>！
          </p>
          <Button onClick={startGame} className="animate-pulse shadow-[0_0_25px_rgba(234,179,8,0.6)] scale-110 bg-yellow-600 hover:bg-yellow-500 border-none text-white font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> SWING!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <div className="text-4xl font-black mb-4 text-red-500 italic">LIQUIDATED!</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Total Distance</div>
             <div className="text-6xl font-black text-yellow-400 font-mono tracking-tighter">{Math.floor(score)}m</div>
             {score >= bestScore && score > 0 && (
                 <div className="mt-2 text-green-500 font-bold flex items-center gap-1 text-sm"><Zap size={12}/> NEW RECORD</div>
             )}
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再荡一次
          </Button>
        </div>
      )}

    </div>
  );
};

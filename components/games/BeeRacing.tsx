
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, Trophy, Flame, AlertTriangle } from 'lucide-react';

interface BeeRacingProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface GameObject {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rock' | 'car' | 'honey' | 'boost';
  lane: number; // 0, 1, 2
}

export const BeeRacing: React.FC<BeeRacingProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beeDogImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [speedDisplay, setSpeedDisplay] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  const PLAYER_WIDTH = 48;
  const PLAYER_HEIGHT = 74;
  const LANE_WIDTH = CANVAS_WIDTH / 3; 

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 140,
    targetX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    speed: 0,
    baseSpeed: 6,
    maxSpeed: 15,
    distance: 0,
    objects: [] as GameObject[],
    roadOffset: 0,
    isGameOver: false,
    score: 0,
    boostTimer: 0,
    frameCount: 0,
    animationId: 0,
    lastFrameTime: 0,
    keys: { left: false, right: false }
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

  const startGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setSpeedDisplay(0);

    gameRef.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 140,
      targetX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      speed: 6,
      baseSpeed: 6,
      maxSpeed: 15,
      distance: 0,
      objects: [],
      roadOffset: 0,
      isGameOver: false,
      score: 0,
      boostTimer: 0,
      frameCount: 0,
      animationId: 0,
      lastFrameTime: performance.now(),
      keys: { left: false, right: false }
    };
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_racing', gameRef.current.score);
      onGameOver();
    }
  };

  const spawnObject = () => {
    const typeRand = Math.random();
    let type: 'rock' | 'car' | 'honey' | 'boost' = 'rock';
    let width = 45;
    let height = 45;

    if (typeRand > 0.96) {
        type = 'boost';
        width = 32; height = 48;
    } else if (typeRand > 0.85) {
        type = 'honey';
        width = 36; height = 36;
    } else if (typeRand > 0.6) {
        type = 'car';
        width = 48; height = 74;
    } else {
        // Rock
        width = 42; height = 36;
    }

    // Spawn in lanes strict center
    const lane = Math.floor(Math.random() * 3);
    const centerX = (lane * LANE_WIDTH) + (LANE_WIDTH / 2);
    const x = centerX - (width / 2);

    // Prevent overlapping spawn
    const lastObj = gameRef.current.objects[gameRef.current.objects.length - 1];
    if (lastObj && lastObj.y < 100) return; // Wait if recent spawn

    gameRef.current.objects.push({
        id: Date.now() + Math.random(),
        x,
        y: -150, 
        width,
        height,
        type,
        lane
    });
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, isBoost: boolean) => {
    ctx.save();
    ctx.translate(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
    
    // Tilt effect when turning
    const tilt = (gameRef.current.targetX - gameRef.current.playerX) * 0.05;
    ctx.rotate(tilt * 0.15);

    // --- CAR DRAWING ---
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 5, PLAYER_WIDTH/2 + 4, PLAYER_HEIGHT/2 + 2, 0, 0, Math.PI*2);
    ctx.fill();

    // Body (Main)
    ctx.fillStyle = '#FFD700'; // Bee Yellow
    drawRoundedRect(ctx, -PLAYER_WIDTH/2, -PLAYER_HEIGHT/2, PLAYER_WIDTH, PLAYER_HEIGHT, 8);

    // Hood Detail (Stripes)
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -PLAYER_HEIGHT/2, 12, PLAYER_HEIGHT); // Center Stripe

    // Engine Vents on Hood
    ctx.fillStyle = '#333';
    ctx.fillRect(-12, -PLAYER_HEIGHT/2 + 10, 6, 12);
    ctx.fillRect(6, -PLAYER_HEIGHT/2 + 10, 6, 12);

    // Windshield
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.moveTo(-PLAYER_WIDTH/2 + 4, -PLAYER_HEIGHT/2 + 25);
    ctx.lineTo(PLAYER_WIDTH/2 - 4, -PLAYER_HEIGHT/2 + 25);
    ctx.quadraticCurveTo(PLAYER_WIDTH/2 - 2, -PLAYER_HEIGHT/2 + 35, PLAYER_WIDTH/2 - 4, -PLAYER_HEIGHT/2 + 40);
    ctx.lineTo(-PLAYER_WIDTH/2 + 4, -PLAYER_HEIGHT/2 + 40);
    ctx.quadraticCurveTo(-PLAYER_WIDTH/2 + 2, -PLAYER_HEIGHT/2 + 35, -PLAYER_WIDTH/2 + 4, -PLAYER_HEIGHT/2 + 25);
    ctx.fill();
    // Glass Reflection
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(-PLAYER_WIDTH/2 + 8, -PLAYER_HEIGHT/2 + 25);
    ctx.lineTo(-PLAYER_WIDTH/2 + 12, -PLAYER_HEIGHT/2 + 40);
    ctx.lineTo(-PLAYER_WIDTH/2 + 6, -PLAYER_HEIGHT/2 + 40);
    ctx.fill();

    // Side Mirrors
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(-PLAYER_WIDTH/2 - 2, -PLAYER_HEIGHT/2 + 30, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PLAYER_WIDTH/2 + 2, -PLAYER_HEIGHT/2 + 30, 3, 0, Math.PI*2);
    ctx.fill();

    // Wheels (sticking out slightly)
    ctx.fillStyle = '#111';
    // Front Left
    drawRoundedRect(ctx, -PLAYER_WIDTH/2 - 3, -PLAYER_HEIGHT/2 + 8, 4, 14, 2);
    // Front Right
    drawRoundedRect(ctx, PLAYER_WIDTH/2 - 1, -PLAYER_HEIGHT/2 + 8, 4, 14, 2);
    // Rear Left
    drawRoundedRect(ctx, -PLAYER_WIDTH/2 - 3, PLAYER_HEIGHT/2 - 18, 4, 14, 2);
    // Rear Right
    drawRoundedRect(ctx, PLAYER_WIDTH/2 - 1, PLAYER_HEIGHT/2 - 18, 4, 14, 2);

    // Rear Spoiler
    ctx.fillStyle = '#111';
    drawRoundedRect(ctx, -PLAYER_WIDTH/2 - 2, PLAYER_HEIGHT/2 - 8, PLAYER_WIDTH + 4, 6, 2);

    // Driver (BeeDog Head)
    if (beeDogImgRef.current) {
        const size = 32;
        ctx.drawImage(beeDogImgRef.current, -size/2, -5, size, size);
    } else {
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.arc(0, 10, 10, 0, Math.PI*2); ctx.fill();
    }

    // Boost Flames
    if (isBoost) {
        const flameLen = Math.random() * 20 + 10;
        // Left Flame
        ctx.beginPath();
        ctx.fillStyle = '#3b82f6'; // Blue flame for Nitro
        ctx.moveTo(-10, PLAYER_HEIGHT/2);
        ctx.lineTo(-14, PLAYER_HEIGHT/2 + flameLen);
        ctx.lineTo(-6, PLAYER_HEIGHT/2);
        ctx.fill();
        // Right Flame
        ctx.beginPath();
        ctx.moveTo(10, PLAYER_HEIGHT/2);
        ctx.lineTo(14, PLAYER_HEIGHT/2 + flameLen);
        ctx.lineTo(6, PLAYER_HEIGHT/2);
        ctx.fill();
        
        // Inner Core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-10, PLAYER_HEIGHT/2);
        ctx.lineTo(-12, PLAYER_HEIGHT/2 + flameLen/2);
        ctx.lineTo(-8, PLAYER_HEIGHT/2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, PLAYER_HEIGHT/2);
        ctx.lineTo(12, PLAYER_HEIGHT/2 + flameLen/2);
        ctx.lineTo(8, PLAYER_HEIGHT/2);
        ctx.fill();
    }

    ctx.restore();
  };

  const drawEnemyCar = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, w/2 + 2, h/2 + 2, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#dc2626'; // Red
    drawRoundedRect(ctx, -w/2, -h/2, w, h, 6);

    // Roof / Windshield (Darker for closed top)
    ctx.fillStyle = '#111'; // Tinted
    drawRoundedRect(ctx, -w/2 + 4, -h/2 + 15, w - 8, h/2, 4);
    
    // Rear Lights
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-w/2 + 4, h/2 - 4, 8, 4);
    ctx.fillRect(w/2 - 12, h/2 - 4, 8, 4);

    ctx.restore();
  };

  const drawRock = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 2, w/2, h/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Rock Body
    ctx.fillStyle = '#57534e'; // Stone Grey
    ctx.beginPath();
    ctx.moveTo(-w/2 + 5, -h/4);
    ctx.lineTo(0, -h/2);
    ctx.lineTo(w/2 - 5, -h/3);
    ctx.lineTo(w/2, h/3);
    ctx.lineTo(w/4, h/2);
    ctx.lineTo(-w/3, h/2 - 5);
    ctx.lineTo(-w/2, 0);
    ctx.closePath();
    ctx.fill();

    // Highlights
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.moveTo(-w/4, -h/4);
    ctx.lineTo(0, -h/3);
    ctx.lineTo(w/4, 0);
    ctx.fill();

    ctx.restore();
  };

  const drawHoney = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    
    const radius = w/2;

    // Pot
    ctx.fillStyle = '#f59e0b'; // Amber
    ctx.beginPath();
    ctx.arc(0, 4, radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lid/Rim
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.ellipse(0, -4, radius, radius*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(-radius*0.4, 0, radius*0.2, radius*0.3, Math.PI/4, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  };

  const drawBoost = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);

    // Glow
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 10;

    // Canister Body
    ctx.fillStyle = '#2563eb'; // Blue
    drawRoundedRect(ctx, -w/3, -h/2, w/1.5, h, 4);
    ctx.shadowBlur = 0; // Reset

    // Cap
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-w/6, -h/2 - 4, w/3, 4);

    // Label (Lightning)
    ctx.fillStyle = '#facc15'; // Yellow Bolt
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(-6, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-2, 10);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
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
    game.frameCount++;

    // --- LOGIC ---

    // Speed progression
    if (game.boostTimer > 0) {
        game.speed = game.maxSpeed * 1.5; // Super speed
        game.boostTimer--;
    } else {
        // Accelerate naturally
        if (game.speed < game.baseSpeed) {
            game.speed += 0.1;
        } else if (game.baseSpeed < game.maxSpeed) {
            game.baseSpeed += 0.005;
            game.speed = game.baseSpeed;
        }
    }
    
    // Update Score
    if (game.speed > 0) {
       game.distance += game.speed;
       if (game.frameCount % 5 === 0) {
           game.score += 1;
           setScore(game.score);
           setSpeedDisplay(Math.floor(game.speed * 15)); // Fake km/h
       }
    }

    // Steering
    const steerSpeed = 10;
    if (game.keys.left) game.targetX -= steerSpeed;
    if (game.keys.right) game.targetX += steerSpeed;
    
    // Clamp target
    game.targetX = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, game.targetX));

    // Smooth movement (Drift feel)
    game.playerX += (game.targetX - game.playerX) * 0.2;

    // Road Scroll
    game.roadOffset += game.speed;
    if (game.roadOffset >= 60) game.roadOffset = 0;

    // Spawning
    const spawnRate = Math.max(30, Math.floor(120 - game.speed * 4));
    if (game.frameCount % spawnRate === 0) {
        spawnObject();
    }

    // Update Objects
    for (let i = game.objects.length - 1; i >= 0; i--) {
        const obj = game.objects[i];
        
        // Traffic Logic: Cars move forward, but slower than player
        let relativeSpeed = game.speed;
        if (obj.type === 'car') {
            relativeSpeed = game.speed - 4; // Car speed ~4
        }
        
        obj.y += relativeSpeed;

        // Cleanup
        if (obj.y > CANVAS_HEIGHT) {
            game.objects.splice(i, 1);
            continue;
        }

        // Collision AABB (Forgiving)
        const hitX = game.playerX + 8;
        const hitY = game.playerY + 8;
        const hitW = PLAYER_WIDTH - 16;
        const hitH = PLAYER_HEIGHT - 16;

        const objHitX = obj.x + 4;
        const objHitY = obj.y + 4;
        const objHitW = obj.width - 8;
        const objHitH = obj.height - 8;

        if (
            hitX < objHitX + objHitW &&
            hitX + hitW > objHitX &&
            hitY < objHitY + objHitH &&
            hitY + hitH > objHitY
        ) {
            if (obj.type === 'honey') {
                game.score += 50;
                setScore(game.score);
                game.objects.splice(i, 1);
            } else if (obj.type === 'boost') {
                game.boostTimer = 180; // 3 seconds
                game.objects.splice(i, 1);
            } else {
                // Crash
                if (game.boostTimer > 0) {
                    // Smash mode!
                    game.objects.splice(i, 1);
                    game.score += 100;
                } else {
                    endGame();
                    return;
                }
            }
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road Background
    ctx.fillStyle = '#262626'; // Dark Asphalt
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road Shoulders (Red/White stripes)
    const STRIPE_HEIGHT = 40;
    const SHOULDER_WIDTH = 12;
    for (let y = -STRIPE_HEIGHT; y < CANVAS_HEIGHT; y += STRIPE_HEIGHT) {
       const adjustedY = y + game.roadOffset;
       const isRed = Math.floor((y + game.roadOffset) / STRIPE_HEIGHT) % 2 === 0;
       ctx.fillStyle = isRed ? '#ef4444' : '#ffffff';
       
       // Left Shoulder
       ctx.fillRect(0, adjustedY, SHOULDER_WIDTH, STRIPE_HEIGHT);
       // Right Shoulder
       ctx.fillRect(CANVAS_WIDTH - SHOULDER_WIDTH, adjustedY, SHOULDER_WIDTH, STRIPE_HEIGHT);
    }

    // Grass Edges (Outer)
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 4, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 4, 0, 4, CANVAS_HEIGHT);

    // Lane Markers (Dashed Lines)
    ctx.fillStyle = '#FFF';
    ctx.globalAlpha = 0.6;
    for (let i = -60; i < CANVAS_HEIGHT; i += 60) {
        const y = i + game.roadOffset;
        // Lane 1 divider
        ctx.fillRect(LANE_WIDTH - 2, y, 4, 30);
        // Lane 2 divider
        ctx.fillRect(LANE_WIDTH * 2 - 2, y, 4, 30);
    }
    ctx.globalAlpha = 1.0;

    // Draw Objects (Sorted by Y to handle overlap slightly better)
    // Actually standard z-order is enough here as they don't overlap much
    game.objects.forEach(obj => {
        if (obj.type === 'car') drawEnemyCar(ctx, obj.x, obj.y, obj.width, obj.height);
        else if (obj.type === 'rock') drawRock(ctx, obj.x, obj.y, obj.width, obj.height);
        else if (obj.type === 'honey') drawHoney(ctx, obj.x, obj.y, obj.width, obj.height);
        else if (obj.type === 'boost') drawBoost(ctx, obj.x, obj.y, obj.width, obj.height);
    });

    // Draw Player
    drawPlayer(ctx, game.playerX, game.playerY, game.boostTimer > 0);

    // Speed Lines (Visual effect for high speed)
    if (game.speed > 10) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for(let i=0; i<3; i++) {
            const lx = Math.random() * CANVAS_WIDTH;
            const ly = Math.random() * CANVAS_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx, ly + 100);
            ctx.stroke();
        }
    }
  };

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
    } else {
       clientX = (e as React.MouseEvent).clientX;
    }

    const x = clientX - rect.left;
    const scaleX = CANVAS_WIDTH / rect.width;
    const gameX = x * scaleX;

    gameRef.current.targetX = gameX - PLAYER_WIDTH / 2;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (gameState !== 'PLAYING') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const gameX = (e.clientX - rect.left) * scaleX;
      gameRef.current.targetX = gameX - PLAYER_WIDTH / 2;
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-[#333] select-none touch-none ring-4 ring-black">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={550} 
        className="w-full h-full block cursor-none"
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onMouseMove={handleMouseMove}
      />

      {/* HUD: Dashboard Style */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none bg-gradient-to-b from-black/80 to-transparent">
         <div className="flex justify-between items-center">
             
             {/* Score */}
             <div className="flex flex-col">
                <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Trophy size={12} /> Score
                </div>
                <div className="font-mono font-black text-2xl text-yellow-400 leading-none">
                    {score.toString().padStart(5, '0')}
                </div>
             </div>

             {/* Speed Gauge */}
             <div className="relative">
                 <div className="w-24 h-12 overflow-hidden relative">
                     <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-8 border-neutral-700"></div>
                     <div 
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-8 border-transparent border-t-blue-500 border-r-blue-500 transition-all duration-200"
                        style={{ transform: `translateX(-50%) rotate(${ -135 + (speedDisplay / 300) * 270 }deg)` }}
                     ></div>
                 </div>
                 <div className="absolute bottom-0 w-full text-center">
                     <span className="font-black text-white text-xl italic">{speedDisplay}</span>
                     <span className="text-[10px] text-neutral-400 ml-1">KM/H</span>
                 </div>
             </div>
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-600 drop-shadow-lg italic transform -skew-x-12">
             TURBO<br/>RACING
          </div>
          <p className="mb-10 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[240px]">
            左右滑动控制赛车<br/>
            收集 <span className="text-blue-400">氮气</span> 进入无敌冲刺<br/>
            撞击 <span className="text-red-500">敌车</span> 或 <span className="text-stone-400">石头</span> 会失败
          </p>
          <Button onClick={startGame} className="animate-pulse shadow-[0_0_25px_rgba(234,179,8,0.6)] scale-110 bg-gradient-to-r from-yellow-500 to-orange-600 border-none text-black font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> GO!!!
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
          <AlertTriangle size={64} className="text-red-500 mb-4 animate-bounce" />
          <div className="text-4xl font-black mb-6 text-white italic">WASTED</div>
          
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Final Score</div>
             <div className="text-6xl font-black text-yellow-400 font-mono tracking-tighter">{score}</div>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 再来一局
          </Button>
        </div>
      )}

    </div>
  );
};


import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
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
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [speedDisplay, setSpeedDisplay] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  const PLAYER_WIDTH = 50; 
  const PLAYER_HEIGHT = 84; // Slightly longer for sports car look
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
    audio.playGameOver();
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
    
    // Width Logic to prevent "Lane Gaps":
    // Lane width is ~106px. 
    // If Obstacle is 85px, Gap is ~21px. 
    // Player Hitbox is ~34px. 
    // Result: Player physically cannot pass between two adjacent obstacles.
    
    let width = 85; 
    let height = 80;

    if (typeRand > 0.96) {
        type = 'boost';
        width = 45; height = 65;
    } else if (typeRand > 0.85) {
        type = 'honey';
        width = 50; height = 55;
    } else if (typeRand > 0.6) {
        type = 'car';
        width = 85; height = 110; // Wide and long
    } else {
        // Rock
        width = 85; height = 65; // Wide and short
    }

    // Spawn in lanes strict center
    const lane = Math.floor(Math.random() * 3);
    const centerX = (lane * LANE_WIDTH) + (LANE_WIDTH / 2);
    const x = centerX - (width / 2);

    // Prevent overlapping spawn (vertical clearance)
    const lastObj = gameRef.current.objects[gameRef.current.objects.length - 1];
    if (lastObj && lastObj.y < 160) return; 

    gameRef.current.objects.push({
        id: Date.now() + Math.random(),
        x,
        y: -180, 
        width,
        height,
        type,
        lane
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, isBoost: boolean) => {
    ctx.save();
    ctx.translate(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
    
    // Tilt effect when turning
    const tilt = (gameRef.current.targetX - gameRef.current.playerX) * 0.05;
    ctx.rotate(tilt * 0.1);

    // --- NEW BEE-MOBILE SPORTS CAR ---
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 15, PLAYER_WIDTH/2 + 4, PLAYER_HEIGHT/2 - 2, 0, 0, Math.PI*2);
    ctx.fill();

    // Tires (Wide Slick)
    ctx.fillStyle = '#171717';
    // Front
    ctx.beginPath();
    ctx.roundRect(-PLAYER_WIDTH/2 - 6, -PLAYER_HEIGHT/3, 8, 18, 3);
    ctx.roundRect(PLAYER_WIDTH/2 - 2, -PLAYER_HEIGHT/3, 8, 18, 3);
    // Rear (Fatter)
    ctx.roundRect(-PLAYER_WIDTH/2 - 8, PLAYER_HEIGHT/3 - 5, 10, 20, 3);
    ctx.roundRect(PLAYER_WIDTH/2 - 2, PLAYER_HEIGHT/3 - 5, 10, 20, 3);
    ctx.fill();

    // Chassis Body (Aerodynamic Shape)
    ctx.fillStyle = '#fbbf24'; // Amber-400
    ctx.beginPath();
    // Rear is wider
    ctx.moveTo(-PLAYER_WIDTH/2 + 2, PLAYER_HEIGHT/2);
    ctx.lineTo(PLAYER_WIDTH/2 - 2, PLAYER_HEIGHT/2);
    // Taper to front
    ctx.quadraticCurveTo(PLAYER_WIDTH/2 + 5, 0, PLAYER_WIDTH/2 - 8, -PLAYER_HEIGHT/2);
    ctx.lineTo(-PLAYER_WIDTH/2 + 8, -PLAYER_HEIGHT/2);
    ctx.quadraticCurveTo(-PLAYER_WIDTH/2 - 5, 0, -PLAYER_WIDTH/2 + 2, PLAYER_HEIGHT/2);
    ctx.fill();
    
    // Center Racing Stripe (Black)
    ctx.fillStyle = '#000';
    ctx.fillRect(-8, -PLAYER_HEIGHT/2, 16, PLAYER_HEIGHT); 

    // Engine Vents (Rear)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-12, PLAYER_HEIGHT/4, 24, 10);

    // Cockpit / Windshield (Tinted)
    ctx.fillStyle = '#2563eb'; // Blue glass
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(16, -10);
    ctx.quadraticCurveTo(18, 10, 14, 20);
    ctx.lineTo(-14, 20);
    ctx.quadraticCurveTo(-18, 10, -16, -10);
    ctx.fill();
    
    // Glass Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-8, 15);
    ctx.fill();

    // Massive Spoiler (Rear Wing)
    ctx.fillStyle = '#000';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.roundRect(-PLAYER_WIDTH/2 - 6, PLAYER_HEIGHT/2 - 12, PLAYER_WIDTH + 12, 10, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Headlights (Projection)
    ctx.globalCompositeOperation = 'screen';
    const lightGrad = ctx.createLinearGradient(0, -PLAYER_HEIGHT/2, 0, -PLAYER_HEIGHT/2 - 100);
    lightGrad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    lightGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(-15, -PLAYER_HEIGHT/2 + 5);
    ctx.lineTo(-40, -PLAYER_HEIGHT/2 - 100);
    ctx.lineTo(40, -PLAYER_HEIGHT/2 - 100);
    ctx.lineTo(15, -PLAYER_HEIGHT/2 + 5);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Boost Effects
    if (isBoost) {
        const flameLen = Math.random() * 40 + 20;
        ctx.fillStyle = '#3b82f6'; // Blue flame
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#3b82f6';
        
        // Left exhaust
        ctx.beginPath();
        ctx.moveTo(-10, PLAYER_HEIGHT/2);
        ctx.lineTo(-14, PLAYER_HEIGHT/2 + flameLen);
        ctx.lineTo(-6, PLAYER_HEIGHT/2 + flameLen * 0.8);
        ctx.fill();
        
        // Right exhaust
        ctx.beginPath();
        ctx.moveTo(10, PLAYER_HEIGHT/2);
        ctx.lineTo(14, PLAYER_HEIGHT/2 + flameLen);
        ctx.lineTo(6, PLAYER_HEIGHT/2 + flameLen * 0.8);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  const drawEnemyCar = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10, w/2 + 4, h/2 - 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#171717';
    ctx.fillRect(-w/2, -h/3, 8, 20);
    ctx.fillRect(w/2 - 8, -h/3, 8, 20);
    ctx.fillRect(-w/2, h/4, 8, 20);
    ctx.fillRect(w/2 - 8, h/4, 8, 20);

    // Body (Menacing Red)
    ctx.fillStyle = '#991b1b'; // Red-800
    ctx.beginPath();
    ctx.moveTo(-w/2 + 5, -h/2 + 10);
    ctx.lineTo(w/2 - 5, -h/2 + 10);
    ctx.lineTo(w/2, h/2);
    ctx.lineTo(-w/2, h/2);
    ctx.fill();

    // Hood Detail
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(-10, -h/2 + 10);
    ctx.lineTo(10, -h/2 + 10);
    ctx.lineTo(15, 0);
    ctx.lineTo(-15, 0);
    ctx.fill();

    // Windshield (Blacked out)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.lineTo(15, -10);
    ctx.lineTo(18, 15);
    ctx.lineTo(-18, 15);
    ctx.fill();

    // Rear Lights (Angry Eyes)
    ctx.fillStyle = '#ef4444';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-w/2 + 5, h/2 - 5);
    ctx.lineTo(-w/2 + 25, h/2 - 10); // Angled down
    ctx.lineTo(-w/2 + 25, h/2 - 2);
    ctx.lineTo(-w/2 + 5, h/2 - 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(w/2 - 5, h/2 - 5);
    ctx.lineTo(w/2 - 25, h/2 - 10);
    ctx.lineTo(w/2 - 25, h/2 - 2);
    ctx.lineTo(w/2 - 5, h/2 - 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  const drawRock = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, h/3, w/2, h/4, 0, 0, Math.PI*2);
    ctx.fill();

    // Main Rock Body (Jagged)
    ctx.fillStyle = '#57534e'; // Stone-600
    ctx.beginPath();
    ctx.moveTo(-w/2 + 5, 10);
    ctx.lineTo(-w/3, -h/2 + 5);
    ctx.lineTo(0, -h/2 - 5); // Peak
    ctx.lineTo(w/3, -h/2 + 8);
    ctx.lineTo(w/2 - 5, 15);
    ctx.lineTo(w/4, h/2 - 5);
    ctx.lineTo(-w/4, h/2);
    ctx.closePath();
    ctx.fill();

    // 3D Lighting / Texture
    ctx.fillStyle = '#78716c'; // Lighter Stone
    ctx.beginPath();
    ctx.moveTo(-w/4, -h/3);
    ctx.lineTo(0, -h/2 + 5);
    ctx.lineTo(w/5, -h/4);
    ctx.fill();
    
    // Cracks
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-5, 20);
    ctx.moveTo(0, -10);
    ctx.lineTo(15, 5);
    ctx.stroke();

    ctx.restore();
  };

  const drawHoney = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    
    // Float animation
    const offset = Math.sin(Date.now() * 0.005) * 4;
    ctx.translate(0, offset);

    const radius = w/2;

    // Glow
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15;

    // Pot Body
    const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, radius);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, '#d97706');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.arc(0, 5, radius, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Rim
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.ellipse(0, -5, radius, radius*0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Honey inside
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(0, -5, radius*0.8, radius*0.25, 0, 0, Math.PI*2);
    ctx.fill();

    // High Reflection
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(-8, -8, 6, 4, -0.5, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  };

  const drawBoost = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);

    // Spin animation or Float
    const offset = Math.sin(Date.now() * 0.008) * 3;
    ctx.translate(0, offset);

    // Glow
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 20;

    // Canister Body (NOS Style)
    ctx.fillStyle = '#1d4ed8'; // Blue-700
    ctx.beginPath();
    ctx.roundRect(-w/2.5, -h/2, w/1.25, h, 8);
    ctx.fill();
    
    // Highlight curve
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-w/2.5 + 4, -h/2, 4, h);

    ctx.shadowBlur = 0; // Reset

    // Valve / Top
    ctx.fillStyle = '#94a3b8'; // Grey
    ctx.beginPath();
    ctx.moveTo(-6, -h/2);
    ctx.lineTo(-6, -h/2 - 8);
    ctx.lineTo(6, -h/2 - 8);
    ctx.lineTo(6, -h/2);
    ctx.fill();
    
    // Label (Lightning)
    ctx.fillStyle = '#facc15'; 
    ctx.beginPath();
    ctx.moveTo(6, -15);
    ctx.lineTo(-6, 0);
    ctx.lineTo(2, 0);
    ctx.lineTo(-6, 20);
    ctx.lineTo(8, 5);
    ctx.lineTo(-2, 5);
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
    const steerSpeed = 12; // Slightly more responsive
    if (game.keys.left) game.targetX -= steerSpeed;
    if (game.keys.right) game.targetX += steerSpeed;
    
    // Clamp target to track width strictly
    game.targetX = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, game.targetX));

    // Smooth movement (Drift feel)
    game.playerX += (game.targetX - game.playerX) * 0.25;

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

        // Collision AABB (Forgiving but Tight)
        // Player is visually ~50px wide. Hitbox padding = 8px. 
        // Effective Hitbox = 34px wide.
        const hitX = game.playerX + 8; 
        const hitY = game.playerY + 5;
        const hitW = PLAYER_WIDTH - 16;
        const hitH = PLAYER_HEIGHT - 10;

        const objHitX = obj.x + 5;
        const objHitY = obj.y + 5;
        const objHitW = obj.width - 10;
        const objHitH = obj.height - 10;

        if (
            hitX < objHitX + objHitW &&
            hitX + hitW > objHitX &&
            hitY < objHitY + objHitH &&
            hitY + hitH > objHitY
        ) {
            if (obj.type === 'honey') {
                audio.playScore();
                game.score += 50;
                setScore(game.score);
                game.objects.splice(i, 1);
            } else if (obj.type === 'boost') {
                audio.playScore();
                game.boostTimer = 180; // 3 seconds
                game.objects.splice(i, 1);
            } else {
                // Crash
                if (game.boostTimer > 0) {
                    // Smash mode!
                    audio.playScore();
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
    ctx.fillStyle = '#1c1917'; // Darker Stone
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road Shoulders (Red/White stripes)
    const STRIPE_HEIGHT = 40;
    const SHOULDER_WIDTH = 12;
    for (let y = -STRIPE_HEIGHT; y < CANVAS_HEIGHT; y += STRIPE_HEIGHT) {
       const adjustedY = y + game.roadOffset;
       const isRed = Math.floor((y + game.roadOffset) / STRIPE_HEIGHT) % 2 === 0;
       ctx.fillStyle = isRed ? '#ef4444' : '#f5f5f5';
       
       // Left Shoulder
       ctx.fillRect(0, adjustedY, SHOULDER_WIDTH, STRIPE_HEIGHT);
       // Right Shoulder
       ctx.fillRect(CANVAS_WIDTH - SHOULDER_WIDTH, adjustedY, SHOULDER_WIDTH, STRIPE_HEIGHT);
    }

    // Grass Edges (Outer)
    ctx.fillStyle = '#15803d'; // Green
    ctx.fillRect(0, 0, 4, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 4, 0, 4, CANVAS_HEIGHT);

    // Lane Markers (Dashed Lines)
    ctx.fillStyle = '#e5e5e5';
    ctx.globalAlpha = 0.8;
    for (let i = -60; i < CANVAS_HEIGHT; i += 60) {
        const y = i + game.roadOffset;
        // Lane 1 divider
        ctx.fillRect(LANE_WIDTH - 2, y, 4, 30);
        // Lane 2 divider
        ctx.fillRect(LANE_WIDTH * 2 - 2, y, 4, 30);
    }
    ctx.globalAlpha = 1.0;

    // Draw Objects (Sorted by Y to handle overlap slightly better)
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
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        for(let i=0; i<4; i++) {
            const lx = Math.random() * CANVAS_WIDTH;
            const ly = Math.random() * CANVAS_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx, ly + 150);
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

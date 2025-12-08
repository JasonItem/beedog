
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, Trophy, Flame } from 'lucide-react';

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
  color: string;
}

export const BeeRacing: React.FC<BeeRacingProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [speedDisplay, setSpeedDisplay] = useState(0);

  // Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 550;
  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 60;
  const LANE_WIDTH = CANVAS_WIDTH / 3; // 3 Lanes effectively, but free movement allowed

  // FPS Control
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const gameRef = useRef({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 120,
    targetX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, // Smooth steering
    speed: 5,
    baseSpeed: 5,
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
      playerY: CANVAS_HEIGHT - 120,
      targetX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      speed: 6,
      baseSpeed: 6,
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
    let width = 40;
    let height = 40;
    let color = '#57534e'; // Rock color

    if (typeRand > 0.95) {
        type = 'boost';
        color = '#3b82f6'; // Blue
        width = 30; height = 30;
    } else if (typeRand > 0.8) {
        type = 'honey';
        color = '#fbbf24'; // Yellow
        width = 30; height = 30;
    } else if (typeRand > 0.6) {
        type = 'car';
        color = '#ef4444'; // Red Car
        width = 40; height = 70;
    }

    // Spawn in one of 3 lanes mostly, but with slight variance
    const lane = Math.floor(Math.random() * 3);
    const centerX = (lane * LANE_WIDTH) + (LANE_WIDTH / 2);
    const x = centerX - (width / 2) + (Math.random() * 20 - 10);

    gameRef.current.objects.push({
        id: Date.now() + Math.random(),
        x,
        y: -100, // Above screen
        width,
        height,
        type,
        color
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, isBoost: boolean) => {
    ctx.save();
    ctx.translate(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
    
    // Tilt effect when turning
    const tilt = (gameRef.current.targetX - gameRef.current.playerX) * 0.05;
    ctx.rotate(tilt * 0.1);

    // Boost effect
    if (isBoost) {
       ctx.shadowBlur = 20;
       ctx.shadowColor = '#3b82f6';
    }

    // Car Body
    ctx.fillStyle = '#FFD700'; // Bee Yellow
    ctx.fillRect(-PLAYER_WIDTH/2, -PLAYER_HEIGHT/2, PLAYER_WIDTH, PLAYER_HEIGHT);
    
    // Stripes
    ctx.fillStyle = '#000';
    ctx.fillRect(-5, -PLAYER_HEIGHT/2, 10, PLAYER_HEIGHT);

    // Windshield
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-PLAYER_WIDTH/2 + 2, -PLAYER_HEIGHT/2 + 10, PLAYER_WIDTH - 4, 15);

    // Wheels
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-PLAYER_WIDTH/2 - 4, -PLAYER_HEIGHT/2 + 10, 4, 12); // FL
    ctx.fillRect(PLAYER_WIDTH/2, -PLAYER_HEIGHT/2 + 10, 4, 12); // FR
    ctx.fillRect(-PLAYER_WIDTH/2 - 4, PLAYER_HEIGHT/2 - 15, 4, 12); // RL
    ctx.fillRect(PLAYER_WIDTH/2, PLAYER_HEIGHT/2 - 15, 4, 12); // RR

    // Head (BeeDog)
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Flames if boosting
    if (isBoost) {
        ctx.beginPath();
        ctx.moveTo(-5, PLAYER_HEIGHT/2);
        ctx.lineTo(0, PLAYER_HEIGHT/2 + Math.random() * 20 + 10);
        ctx.lineTo(5, PLAYER_HEIGHT/2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
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

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;
    game.frameCount++;

    // --- LOGIC ---

    // Speed progression
    if (game.boostTimer > 0) {
        game.speed = game.baseSpeed * 2.5; // Boost speed
        game.boostTimer--;
    } else {
        game.baseSpeed += 0.002; // Gradual acceleration
        game.speed = game.baseSpeed;
    }
    
    // Update Score
    game.distance += game.speed;
    if (game.frameCount % 10 === 0) {
        game.score += 1;
        setScore(game.score);
        setSpeedDisplay(Math.floor(game.speed * 20)); // Fake km/h
    }

    // Steering
    if (game.keys.left) game.targetX -= 8;
    if (game.keys.right) game.targetX += 8;
    
    // Mouse/Touch logic sets targetX directly, keys modify it relatively
    // Clamp target
    game.targetX = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, game.targetX));

    // Smooth movement
    game.playerX += (game.targetX - game.playerX) * 0.15;

    // Road Scroll
    game.roadOffset += game.speed;
    if (game.roadOffset >= 40) game.roadOffset = 0;

    // Spawning
    // Spawn faster as speed increases
    const spawnRate = Math.max(20, Math.floor(100 - game.speed * 3));
    if (game.frameCount % spawnRate === 0) {
        spawnObject();
    }

    // Update Objects
    for (let i = game.objects.length - 1; i >= 0; i--) {
        const obj = game.objects[i];
        
        // Relative speed: objects come down
        // If it's a car, it moves down but slower than rocks (simulating traffic moving in same direction but slower than player)
        let moveSpeed = game.speed;
        if (obj.type === 'car') moveSpeed = game.speed - 3; // Traffic moves forward at speed 3, so relative approach is speed - 3
        
        obj.y += moveSpeed;

        // Cleanup
        if (obj.y > CANVAS_HEIGHT) {
            game.objects.splice(i, 1);
            continue;
        }

        // Collision
        // Simple AABB
        // Shrink hitbox slightly for forgiveness
        const hitX = game.playerX + 5;
        const hitY = game.playerY + 5;
        const hitW = PLAYER_WIDTH - 10;
        const hitH = PLAYER_HEIGHT - 10;

        if (
            hitX < obj.x + obj.width &&
            hitX + hitW > obj.x &&
            hitY < obj.y + obj.height &&
            hitY + hitH > obj.y
        ) {
            if (obj.type === 'honey') {
                game.score += 50;
                setScore(game.score);
                game.objects.splice(i, 1); // Collect
            } else if (obj.type === 'boost') {
                game.boostTimer = 120; // 2 seconds of boost
                game.objects.splice(i, 1);
            } else {
                // Crash
                // If boosting, destroy obstacle instead of dying?
                if (game.boostTimer > 0) {
                    game.objects.splice(i, 1);
                    game.score += 20; // Smash bonus
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
    ctx.fillStyle = '#374151'; // Asphalt
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grass Edges
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 15, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 15, 0, 15, CANVAS_HEIGHT);

    // Lane Markers (Moving)
    ctx.fillStyle = '#FFF';
    ctx.globalAlpha = 0.5;
    for (let i = -40; i < CANVAS_HEIGHT; i += 40) {
        const y = i + game.roadOffset;
        // Lane 1
        ctx.fillRect(LANE_WIDTH, y, 4, 20);
        // Lane 2
        ctx.fillRect(LANE_WIDTH * 2, y, 4, 20);
    }
    ctx.globalAlpha = 1.0;

    // Draw Objects
    game.objects.forEach(obj => {
        ctx.fillStyle = obj.color;
        
        if (obj.type === 'car') {
            // Simple Car Shape
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            // Taillights
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(obj.x + 2, obj.y + obj.height - 5, 8, 4);
            ctx.fillRect(obj.x + obj.width - 10, obj.y + obj.height - 5, 8, 4);
        } else if (obj.type === 'rock') {
            // Rock Shape
            ctx.beginPath();
            ctx.ellipse(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, obj.height/2, 0, 0, Math.PI*2);
            ctx.fill();
        } else if (obj.type === 'honey') {
            // Honey Pot
            ctx.beginPath();
            ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = '12px serif';
            ctx.fillText('🍯', obj.x + 2, obj.y + 20);
        } else if (obj.type === 'boost') {
            // Bolt
            ctx.beginPath();
            ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.font = '16px serif';
            ctx.fillText('⚡', obj.x + 5, obj.y + 22);
        }
    });

    // Draw Player
    drawPlayer(ctx, game.playerX, game.playerY, game.boostTimer > 0);

    // Speed Lines Effect (when boosting)
    if (game.boostTimer > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        for(let i=0; i<5; i++) {
            const lx = Math.random() * CANVAS_WIDTH;
            const ly = Math.random() * CANVAS_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx, ly + 50);
            ctx.stroke();
        }
    }
  };

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'PLAYING') return;
    
    // Simple control: tap left half to move left lane, tap right half to move right lane
    // Or simpler: tap to steer towards that x
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

    // Set target slightly offset from tap to make it feel responsive but not instant teleport
    gameRef.current.targetX = gameX - PLAYER_WIDTH / 2;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (gameState !== 'PLAYING') return;
      // Allow mouse follow for desktop testing
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const gameX = (e.clientX - rect.left) * scaleX;
      gameRef.current.targetX = gameX - PLAYER_WIDTH / 2;
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-4 border-indigo-500 select-none touch-none">
      
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={550} 
        className="w-full h-full block cursor-crosshair"
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onMouseMove={handleMouseMove}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex gap-4 pointer-events-none">
         <div className="bg-black/60 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2 backdrop-blur-sm">
            <Trophy size={16} className="text-yellow-400" />
            <span className="font-bold font-mono text-lg">{score}</span>
         </div>
         <div className="bg-black/60 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2 backdrop-blur-sm">
            <Zap size={16} className="text-blue-400" />
            <span className="font-bold font-mono text-lg">{speedDisplay} <span className="text-xs text-neutral-400">km/h</span></span>
         </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20">
          <div className="text-4xl font-black mb-2 text-indigo-400 drop-shadow-lg italic transform -skew-x-12">Bee Racing</div>
          <p className="mb-8 font-bold text-center text-neutral-300 text-sm">
            拖动或点击屏幕控制方向。<br/>
            躲避<span className="text-red-500">车辆</span>和<span className="text-gray-400">石头</span>。<br/>
            收集 <span className="text-yellow-400">蜂蜜</span> 和 <span className="text-blue-400">闪电</span>！
          </p>
          <Button onClick={startGame} className="animate-pulse shadow-xl scale-110 bg-indigo-500 hover:bg-indigo-400 border-none">
             <Play className="mr-2" /> 启动引擎
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20">
          <div className="text-3xl font-black mb-4 text-red-500">CRASHED! 💥</div>
          
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-6 w-full mb-8 flex flex-col items-center shadow-lg">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1">最终得分</div>
             <div className="text-5xl font-black text-white font-mono">{score}</div>
          </div>

          <Button onClick={startGame} className="w-full mb-3 py-4 text-lg bg-indigo-600 hover:bg-indigo-500 border-none">
             <RotateCcw className="mr-2" /> 重新发车
          </Button>
        </div>
      )}

    </div>
  );
};

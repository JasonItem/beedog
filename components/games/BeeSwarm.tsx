import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, Crosshair, Users, Zap, ShieldAlert, Star } from 'lucide-react';

interface BeeSwarmProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'player' | 'bullet' | 'enemy' | 'crate' | 'powerup' | 'boss' | 'enemy_bullet';
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  color: string;
  // Crate specific
  rewardType?: 'bees' | 'speed' | 'power' | 'super_bees';
  rewardValue?: number;
  // Enemy specific
  damage?: number;
  attackTimer?: number; // For Boss
  wobble?: number; // For moving enemies
  wobbleSpeed?: number;
}

export const BeeSwarm: React.FC<BeeSwarmProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [swarmCount, setSwarmCount] = useState(1); // 1 = Main BeeDog
  const [level, setLevel] = useState(1);
  const [waveMessage, setWaveMessage] = useState<string | null>(null);

  // Constants - Adjusted for gameplay feel
  const CANVAS_WIDTH = 360;
  const CANVAS_HEIGHT = 600;
  const PLAYER_SPEED = 0.12; 
  const BULLET_SPEED = 12;
  const ENEMY_BULLET_SPEED = 6;
  const SCROLL_SPEED_BASE = 2.5; 
  const BOSS_SPAWN_DISTANCE = 3000; 
  
  const gameRef = useRef({
    player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, width: 40, height: 40 },
    targetX: CANVAS_WIDTH / 2,
    bullets: [] as Entity[],
    enemyBullets: [] as Entity[], 
    enemies: [] as Entity[],
    particles: [] as {x: number, y: number, vx: number, vy: number, life: number, color: string}[],
    
    // Stats
    fireRate: 12, // Starting fire rate
    damage: 1,
    swarmSize: 1, 
    
    // System
    frameCount: 0,
    score: 0,
    distance: 0,
    nextBossDistance: BOSS_SPAWN_DISTANCE,
    scrollSpeed: SCROLL_SPEED_BASE,
    difficulty: 1,
    stage: 1,
    isGameOver: false,
    animationId: 0,
    bossActive: false,
    lastFrameTime: 0
  });

  useEffect(() => {
    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const showWaveMessage = (msg: string) => {
      setWaveMessage(msg);
      setTimeout(() => setWaveMessage(null), 2000);
  };

  const initGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);
    setSwarmCount(1);
    setLevel(1);
    showWaveMessage("WAVE 1");

    gameRef.current = {
      player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, width: 40, height: 40 },
      targetX: CANVAS_WIDTH / 2,
      bullets: [],
      enemyBullets: [],
      enemies: [],
      particles: [],
      
      fireRate: 12, 
      damage: 1,
      swarmSize: 1,
      
      frameCount: 0,
      score: 0,
      distance: 0,
      nextBossDistance: BOSS_SPAWN_DISTANCE,
      scrollSpeed: SCROLL_SPEED_BASE,
      difficulty: 1,
      stage: 1,
      isGameOver: false,
      animationId: 0,
      bossActive: false,
      lastFrameTime: performance.now()
    };
    
    loop();
  };

  const endGame = async () => {
    gameRef.current.isGameOver = true;
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.score > 0) {
      await saveHighScore(userProfile, 'bee_swarm', gameRef.current.score);
      onGameOver();
    }
  };

  const createParticles = (x: number, y: number, color: string, count: number = 5) => {
    for(let i=0; i<count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 20 + Math.random() * 10,
            color
        });
    }
  };

  const spawnBullet = () => {
      const { player, swarmSize } = gameRef.current;
      
      // Main shot
      gameRef.current.bullets.push({
          id: Date.now() + Math.random(),
          type: 'bullet',
          x: player.x,
          y: player.y - 20,
          width: 6,
          height: 12,
          hp: 1, maxHp: 1,
          vx: 0, vy: -BULLET_SPEED,
          color: '#fbbf24' // Yellow
      });

      // Swarm shots
      // LIMIT: Cap the number of simultaneous bullets to prevent "God Mode" DPS
      // Even if you have 100 bees, only 20 fire at once (Visual + Balance)
      const effectiveSwarmDPS = Math.min(swarmSize - 1, 20); 
      
      for(let i=0; i<effectiveSwarmDPS; i++) {
          // Spread them out more chaotically as swarm grows
          const angle = (i / effectiveSwarmDPS) * Math.PI * 2 + (gameRef.current.frameCount * 0.1);
          const radius = 30 + (i % 2) * 15; // Two rings
          
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * 10;
          
          gameRef.current.bullets.push({
            id: Date.now() + Math.random(),
            type: 'bullet',
            x: player.x + offsetX,
            y: player.y + offsetY,
            width: 4,
            height: 8,
            hp: 1, maxHp: 1,
            vx: 0, vy: -BULLET_SPEED * 0.9, 
            color: '#fcd34d'
        });
      }
  };

  const spawnBossBullet = (boss: Entity) => {
      const { player, difficulty } = gameRef.current;
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
      
      // Aggressive Spread: More bullets at higher difficulty
      const bulletCount = 3 + Math.floor(difficulty);
      const spread = 0.5 + (difficulty * 0.05);
      
      // Damage scales with difficulty: Late game bullets HURT
      const bulletDmg = Math.floor(difficulty * 1.5) + 1;

      for (let i = 0; i < bulletCount; i++) {
          const a = angle - spread/2 + (i / (bulletCount-1)) * spread;
          gameRef.current.enemyBullets.push({
              id: Date.now() + Math.random(),
              type: 'enemy_bullet',
              x: boss.x,
              y: boss.y + boss.height/2,
              width: 14,
              height: 14,
              hp: 1, maxHp: 1,
              vx: Math.cos(a) * ENEMY_BULLET_SPEED,
              vy: Math.sin(a) * ENEMY_BULLET_SPEED,
              color: '#7f1d1d', 
              damage: bulletDmg
          });
      }
  };

  const spawnEnemyLine = () => {
      const { difficulty } = gameRef.current;
      
      // Density increases significantly
      const count = Math.min(5, 2 + Math.floor(difficulty / 2));
      
      for(let i=0; i<count; i++) {
          const typeRand = Math.random();
          let type: 'enemy' | 'crate' = 'enemy';
          let width = 45, height = 45, color = '#ef4444';
          
          // Difficulty Scaling Formula: Base + Multiplier * (Difficulty ^ 2.2)
          // Stage 1: ~10 HP
          // Stage 5: ~150 HP
          // Stage 10: ~600 HP (Needs sustained fire)
          const hpMultiplier = Math.pow(difficulty, 2.2);
          
          // Collision Damage Scaling: Hitting an enemy hurts more later
          const collisionDmg = Math.max(1, Math.floor(difficulty));

          let wobble = 0;
          let wobbleSpeed = 0;

          if (typeRand > 0.75) {
              type = 'crate';
              width = 50; height = 50;
              color = '#3b82f6'; 
              // Crates have less HP than enemies generally, easier to break for fun
              // But late game crates should still require effort
              gameRef.current.enemies.push({
                  id: Date.now() + Math.random(),
                  type,
                  x: 0, y: 0, // Set below
                  width, height,
                  hp: 5 + (2 * hpMultiplier),
                  maxHp: 5 + (2 * hpMultiplier),
                  vx: 0, 
                  vy: gameRef.current.scrollSpeed,
                  color,
                  rewardType: 'bees', // Default, logic handles rest
                  rewardValue: 1,
                  damage: 1 // Crates don't hurt much
              });
          } else {
              // ENEMY
              // Late game enemies move side-to-side (Wobble) to dodge bullets
              if (difficulty > 2 && Math.random() > 0.5) {
                  wobble = Math.random() * 100; // Phase offset
                  wobbleSpeed = 0.05 + Math.random() * 0.05;
              }

              gameRef.current.enemies.push({
                  id: Date.now() + Math.random(),
                  type,
                  x: 0, y: 0,
                  width, height,
                  hp: 10 + (5 * hpMultiplier),
                  maxHp: 10 + (5 * hpMultiplier),
                  vx: 0,
                  vy: gameRef.current.scrollSpeed * 1.2,
                  color: '#ef4444',
                  damage: 2 + collisionDmg * 2, // High collision damage
                  wobble,
                  wobbleSpeed
              });
          }
          
          // Position setting (Spread)
          const lastAdded = gameRef.current.enemies[gameRef.current.enemies.length-1];
          const segmentWidth = CANVAS_WIDTH / count;
          lastAdded.x = (i * segmentWidth) + (segmentWidth / 2) + (Math.random() - 0.5) * 20;
          lastAdded.y = -100 - (Math.random() * 150);
          
          // Crate Reward Logic refinement
          if (type === 'crate') {
              const r = Math.random();
              if (r > 0.98) { // Ultra Rare 2%
                  lastAdded.rewardType = 'super_bees';
                  lastAdded.rewardValue = 5 + Math.floor(difficulty); // Capped growth
                  lastAdded.color = '#FFF';
                  lastAdded.hp *= 2; 
              } else if (r > 0.85) {
                  lastAdded.rewardType = 'speed';
                  lastAdded.rewardValue = 1;
              } else if (r > 0.70) {
                  lastAdded.rewardType = 'power';
                  lastAdded.rewardValue = 0.1;
              } else {
                  lastAdded.rewardType = 'bees';
                  // Diminishing returns on regular bee crates to prevent infinite snowball
                  lastAdded.rewardValue = Math.max(1, Math.floor(Math.random() * 3)); 
              }
          }
      }
  };

  const spawnBoss = () => {
      gameRef.current.bossActive = true;
      showWaveMessage(`BOSS WAVE ${gameRef.current.stage}`);
      
      // Boss HP: Massive sponge. Stage 1: 800, Stage 5: 10,000+
      const hp = 800 * Math.pow(gameRef.current.difficulty, 2.0);
      
      gameRef.current.enemies.push({
          id: Date.now(),
          type: 'boss',
          x: CANVAS_WIDTH / 2,
          y: -150,
          width: 180,
          height: 180,
          hp: hp, maxHp: hp,
          vx: 1.5, // Move faster laterally
          vy: 2, 
          color: '#7f1d1d', 
          damage: 99999, // Touch = Death
          attackTimer: 60
      });
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);
    
    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    const FRAME_INTERVAL = 1000 / 60;
    
    if (elapsed < FRAME_INTERVAL) return;
    gameRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    const ctx = canvasRef.current?.getContext('2d');
    if (!canvasRef.current || !ctx) return;

    if (gameRef.current.isGameOver) return;

    const game = gameRef.current;
    game.frameCount++;
    game.distance += game.scrollSpeed;

    // --- LOGIC ---

    // Player Movement
    game.player.x += (game.targetX - game.player.x) * PLAYER_SPEED;
    game.player.x = Math.max(game.player.width/2, Math.min(CANVAS_WIDTH - game.player.width/2, game.player.x));

    // Shooting
    if (game.frameCount % Math.max(5, Math.floor(game.fireRate)) === 0) { 
        spawnBullet();
    }

    // Spawning
    if (!game.bossActive) {
        // Spawn frequency increases with difficulty (capped at 40 frames)
        const spawnFreq = Math.max(40, 80 - Math.floor(game.difficulty * 2));
        if (game.frameCount % spawnFreq === 0) {
            spawnEnemyLine();
        }
        
        if (game.distance > game.nextBossDistance) {
            spawnBoss();
        }
    }

    // Update Player Bullets
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.y += b.vy;
        if (b.y < -50) game.bullets.splice(i, 1);
    }

    // Update Enemy Bullets
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        const b = game.enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        if (b.y > CANVAS_HEIGHT + 50 || b.x < -50 || b.x > CANVAS_WIDTH + 50) {
            game.enemyBullets.splice(i, 1);
            continue;
        }

        // Collision with Player
        // Hitbox slightly smaller than visual
        if (
            Math.abs(b.x - game.player.x) < (b.width + game.player.width)/2 * 0.7 &&
            Math.abs(b.y - game.player.y) < (b.height + game.player.height)/2 * 0.7
        ) {
            // Damage scaling: Late game bullets shred swarm
            const dmg = b.damage || 1;
            game.swarmSize = Math.max(0, game.swarmSize - dmg);
            
            setSwarmCount(game.swarmSize);
            createParticles(game.player.x, game.player.y, '#991b1b', 5);
            game.enemyBullets.splice(i, 1);

            if (game.swarmSize <= 0) {
                endGame();
                return;
            }
        }
    }

    // Update Enemies/Crates
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        
        // Wobble Logic (Lateral Movement)
        if (e.wobbleSpeed && e.wobble !== undefined) {
            e.wobble += e.wobbleSpeed;
            e.x += Math.sin(e.wobble) * 2.5; // Sway magnitude
            // Clamp
            e.x = Math.max(e.width/2, Math.min(CANVAS_WIDTH - e.width/2, e.x));
        }

        // Basic Movement
        e.y += e.vy;
        e.x += e.vx;
        
        // Boss Logic
        if (e.type === 'boss') {
            if (e.x < e.width/2 || e.x > CANVAS_WIDTH - e.width/2) e.vx *= -1;
            if (e.y > 120) e.vy = 0;
            
            if (e.attackTimer !== undefined) {
                e.attackTimer--;
                if (e.attackTimer <= 0) {
                    spawnBossBullet(e);
                    // Rapid fire in late game
                    const cooldown = Math.max(15, 80 - game.difficulty * 8);
                    e.attackTimer = cooldown; 
                }
            }
        }

        // Cleanup
        if (e.y > CANVAS_HEIGHT + 100) {
            if (e.type !== 'boss') {
                game.enemies.splice(i, 1);
                continue;
            }
        }

        // Collision: Player Body vs Enemy
        if (
            Math.abs(e.x - game.player.x) < (e.width + game.player.width)/2 * 0.8 &&
            Math.abs(e.y - game.player.y) < (e.height + game.player.height)/2 * 0.8
        ) {
            if (e.type === 'crate') {
                game.swarmSize = Math.max(1, game.swarmSize - 1);
                createParticles(e.x, e.y, '#FFF');
                game.enemies.splice(i, 1);
            } else {
                const dmg = e.type === 'boss' ? 9999 : (e.damage || 5);
                game.swarmSize -= dmg;
                createParticles(game.player.x, game.player.y, '#F00', 10);
                
                if (e.type !== 'boss') game.enemies.splice(i, 1);

                if (game.swarmSize <= 0) {
                    endGame();
                    return;
                }
            }
            setSwarmCount(game.swarmSize);
            continue;
        }

        // Collision: Player Bullets vs Enemy
        for (let j = game.bullets.length - 1; j >= 0; j--) {
            const b = game.bullets[j];
            // Simple circle/box check
            if (
                Math.abs(e.x - b.x) < (e.width + b.width)/2 &&
                Math.abs(e.y - b.y) < (e.height + b.height)/2
            ) {
                e.hp -= game.damage;
                game.bullets.splice(j, 1);
                createParticles(b.x, b.y - 10, '#fff', 1);

                if (e.hp <= 0) {
                    // Death
                    if (e.type === 'crate') {
                        if (e.rewardType === 'bees' || e.rewardType === 'super_bees') {
                             game.swarmSize += (e.rewardValue || 1);
                        }
                        if (e.rewardType === 'speed') game.fireRate = Math.max(5, game.fireRate - 1);
                        if (e.rewardType === 'power') game.damage += 0.1;
                        
                        setSwarmCount(Math.floor(game.swarmSize));
                        createParticles(e.x, e.y, e.rewardType === 'super_bees' ? '#FFD700' : '#3b82f6', 15);
                    } else if (e.type === 'boss') {
                        game.bossActive = false;
                        game.difficulty += 1.0; // Aggressive difficulty bump per stage
                        game.stage += 1;
                        setLevel(game.stage);
                        showWaveMessage(`STAGE ${game.stage} START`);
                        game.nextBossDistance = game.distance + BOSS_SPAWN_DISTANCE;
                        game.score += 5000 * Math.floor(game.difficulty);
                        createParticles(e.x, e.y, '#F00', 50);
                    } else {
                        game.score += 10 * Math.floor(game.difficulty);
                        createParticles(e.x, e.y, '#ef4444', 10);
                    }
                    
                    setScore(game.score);
                    game.enemies.splice(i, 1);
                }
                break;
            }
        }
    }

    // Update Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid Background
    const gridOffset = game.distance % 40;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=CANVAS_WIDTH; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); }
    for(let y=gridOffset; y<=CANVAS_HEIGHT; y+=40) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); }
    ctx.stroke();

    // Draw Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    });

    // Draw Enemy Bullets
    ctx.fillStyle = '#991b1b';
    game.enemyBullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Draw Enemies/Crates
    game.enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        
        if (e.type === 'crate') {
            ctx.fillStyle = e.color;
            ctx.fillRect(-e.width/2, -e.height/2, e.width, e.height);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(-e.width/2, -e.height/2, e.width, 10);
            
            ctx.fillStyle = e.color === '#FFF' ? '#000' : '#fff';
            ctx.font = 'bold 16px font-mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.ceil(e.hp)}`, 0, -10);
            
            ctx.font = '10px font-sans';
            let rewardText = "";
            if (e.rewardType === 'bees') rewardText = `+${e.rewardValue} Bees`;
            if (e.rewardType === 'super_bees') rewardText = `+${e.rewardValue} MAX!`;
            if (e.rewardType === 'speed') rewardText = "Speed";
            if (e.rewardType === 'power') rewardText = "Power";
            ctx.fillText(rewardText, 0, 15);

        } else if (e.type === 'boss') {
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(0, 0, e.width/2, 0, Math.PI*2);
            ctx.fill();
            // HP Bar
            const hpPct = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = 'red';
            ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width, 10);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width * hpPct, 10);
            ctx.fillStyle = '#fff';
            ctx.font = '32px serif';
            ctx.fillText('👹', -16, 10);

        } else {
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.moveTo(-e.width/2, -e.height/2);
            ctx.lineTo(e.width/2, -e.height/2);
            ctx.lineTo(0, e.height/2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px font-mono';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(e.hp)}`, 0, -5);
        }
        ctx.restore();
    });

    // Draw Player Bullets
    ctx.fillStyle = '#fbbf24';
    game.bullets.forEach(b => {
        ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
    });

    // Draw Player (Swarm)
    const { player, swarmSize } = game;
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐶', player.x, player.y);
    
    // Draw Swarm Orbiting
    const orbitRadius = 35 + Math.min(swarmSize, 50) * 0.5;
    const visualCount = Math.min(swarmSize - 1, 30); 
    
    for(let i=0; i<visualCount; i++) {
        const time = Date.now() * 0.005;
        const angle = (i / visualCount) * Math.PI * 2 + time;
        const bx = player.x + Math.cos(angle) * orbitRadius;
        const by = player.y + Math.sin(angle) * (orbitRadius * 0.5); 
        ctx.font = '16px serif';
        ctx.fillText('🐝', bx, by);
    }
    
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.floor(swarmSize)}`, player.x, player.y + 30);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
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
      
      const scaleX = CANVAS_WIDTH / rect.width;
      const x = (clientX - rect.left) * scaleX;
      
      gameRef.current.targetX = x;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md mx-auto aspect-[360/600] bg-sky-100 rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-500 select-none touch-none">
        
        <canvas 
            ref={canvasRef} 
            width={360} 
            height={600} 
            className="w-full h-full block cursor-crosshair"
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
        />

        {/* Wave Message Overlay */}
        {waveMessage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-black/70 text-white px-8 py-4 rounded-2xl text-3xl font-black italic tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-10">
                    {waveMessage}
                </div>
            </div>
        )}

        {/* HUD */}
        <div className="absolute top-4 left-4 z-10 flex gap-4 pointer-events-none">
            <div className="bg-black/60 text-white px-3 py-1 rounded-xl border border-white/20 flex items-center gap-2 backdrop-blur-md">
                <Crosshair size={16} className="text-yellow-400" />
                <span className="font-bold font-mono">{score}</span>
            </div>
            <div className="bg-black/60 text-white px-3 py-1 rounded-xl border border-white/20 flex items-center gap-2 backdrop-blur-md">
                <Users size={16} className="text-blue-400" />
                <span className="font-bold font-mono">{Math.floor(swarmCount)}</span>
            </div>
        </div>
        
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
             <div className="text-xs font-bold text-gray-500 bg-white/80 px-2 py-1 rounded border border-gray-300">
                 Stage {level}
             </div>
        </div>

        {/* Start Screen */}
        {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-sm">
            <div className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-500 drop-shadow-lg text-center">
                BeeSwarm<br/>RUSH
            </div>
            <p className="mb-8 font-bold text-center text-neutral-400 text-sm leading-relaxed max-w-[260px]">
                滑动控制移动<br/>
                击碎 <span className="text-blue-400">蓝箱子</span> 增加蜜蜂<br/>
                击碎 <span className="text-white font-bold">白箱子</span> 获得大量蜜蜂!<br/>
                <span className="text-red-500">警告：后期难度极高！</span>
            </p>
            <Button onClick={initGame} className="animate-pulse shadow-xl scale-110 bg-yellow-500 hover:bg-yellow-400 border-none text-black font-black px-10 py-4 text-xl">
                <Play className="mr-2 fill-current" /> GO!
            </Button>
            </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6 animate-in fade-in zoom-in z-20 backdrop-blur-md">
            <ShieldAlert size={64} className="text-red-500 mb-4 animate-pulse" />
            <div className="text-4xl font-black mb-2 text-white italic">GAME OVER</div>
            <div className="text-xl font-bold text-yellow-500 mb-6">Stage {level} Reached</div>
            
            <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
                <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Total Score</div>
                <div className="text-6xl font-black text-yellow-400 font-mono tracking-tighter">{score}</div>
                <div className="mt-2 text-sm text-gray-400">Max Swarm: {swarmCount}</div>
            </div>

            <Button onClick={initGame} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
                <RotateCcw className="mr-2" /> 再试一次
            </Button>
            </div>
        )}

      </div>
      
      <div className="flex gap-2 justify-center text-xs text-gray-400">
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm"></span> 宝箱</span>
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-white border border-gray-500 rounded-sm"></span> 超级宝箱</span>
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm"></span> 敌人</span>
      </div>
    </div>
  );
};
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
  enemyType?: 'wasp' | 'bear'; // Visual style
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
    particles: [] as {x: number, y: number, vx: number, vy: number, life: number, color: string, size: number}[],
    
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

  const createParticles = (x: number, y: number, color: string, count: number = 5, sizeBase: number = 4) => {
    for(let i=0; i<count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 20 + Math.random() * 10,
            color,
            size: Math.random() * sizeBase + 1
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
          width: 8,
          height: 16,
          hp: 1, maxHp: 1,
          vx: 0, vy: -BULLET_SPEED,
          color: '#fbbf24' // Yellow
      });

      // Swarm shots
      const effectiveSwarmDPS = Math.min(swarmSize - 1, 20); 
      
      for(let i=0; i<effectiveSwarmDPS; i++) {
          const angle = (i / effectiveSwarmDPS) * Math.PI * 2 + (gameRef.current.frameCount * 0.1);
          const radius = 30 + (i % 2) * 15; 
          
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * 10;
          
          gameRef.current.bullets.push({
            id: Date.now() + Math.random(),
            type: 'bullet',
            x: player.x + offsetX,
            y: player.y + offsetY,
            width: 5,
            height: 10,
            hp: 1, maxHp: 1,
            vx: 0, vy: -BULLET_SPEED * 0.9, 
            color: '#fcd34d'
        });
      }
  };

  const spawnBossBullet = (boss: Entity) => {
      const { player, difficulty } = gameRef.current;
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
      
      const bulletCount = 3 + Math.floor(difficulty);
      const spread = 0.5 + (difficulty * 0.05);
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
              color: '#ef4444', 
              damage: bulletDmg
          });
      }
  };

  const spawnEnemyLine = () => {
      const { difficulty } = gameRef.current;
      
      const count = Math.min(5, 2 + Math.floor(difficulty / 2));
      
      for(let i=0; i<count; i++) {
          const typeRand = Math.random();
          let type: 'enemy' | 'crate' = 'enemy';
          let width = 45, height = 45;
          let enemyType: 'wasp' | 'bear' = 'wasp';
          let color = '#ef4444';
          
          const hpMultiplier = Math.pow(difficulty, 2.2);
          const collisionDmg = Math.max(1, Math.floor(difficulty));

          let wobble = 0;
          let wobbleSpeed = 0;

          if (typeRand > 0.70) {
              type = 'crate';
              width = 50; height = 50; // Hexagon size
              color = '#3b82f6'; 
              
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
                  rewardType: 'bees', 
                  rewardValue: 1,
                  damage: 1
              });
          } else {
              // ENEMY
              if (difficulty > 2 && Math.random() > 0.6) {
                  enemyType = 'bear'; // Tanky
                  width = 55; height = 55;
              } else {
                  enemyType = 'wasp'; // Fast
                  width = 40; height = 40;
              }

              if (Math.random() > 0.5) {
                  wobble = Math.random() * 100;
                  wobbleSpeed = 0.05 + Math.random() * 0.05;
              }

              gameRef.current.enemies.push({
                  id: Date.now() + Math.random(),
                  type,
                  x: 0, y: 0,
                  width, height,
                  hp: (enemyType === 'bear' ? 20 : 10) + (5 * hpMultiplier),
                  maxHp: (enemyType === 'bear' ? 20 : 10) + (5 * hpMultiplier),
                  vx: 0,
                  vy: gameRef.current.scrollSpeed * (enemyType === 'wasp' ? 1.3 : 1.0),
                  color: enemyType === 'bear' ? '#7f1d1d' : '#f59e0b',
                  damage: 2 + collisionDmg * 2,
                  wobble,
                  wobbleSpeed,
                  enemyType
              });
          }
          
          // Position setting
          const lastAdded = gameRef.current.enemies[gameRef.current.enemies.length-1];
          const segmentWidth = CANVAS_WIDTH / count;
          lastAdded.x = (i * segmentWidth) + (segmentWidth / 2) + (Math.random() - 0.5) * 20;
          lastAdded.y = -100 - (Math.random() * 150);
          
          // Crate Reward
          if (type === 'crate') {
              const r = Math.random();
              if (r > 0.98) { // Ultra Rare
                  lastAdded.rewardType = 'super_bees';
                  lastAdded.rewardValue = 5 + Math.floor(difficulty);
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
                  lastAdded.rewardValue = Math.max(1, Math.floor(Math.random() * 3)); 
              }
          }
      }
  };

  const spawnBoss = () => {
      gameRef.current.bossActive = true;
      showWaveMessage(`BOSS WAVE ${gameRef.current.stage}`);
      
      const hp = 800 * Math.pow(gameRef.current.difficulty, 2.0);
      
      gameRef.current.enemies.push({
          id: Date.now(),
          type: 'boss',
          x: CANVAS_WIDTH / 2,
          y: -180,
          width: 200,
          height: 180,
          hp: hp, maxHp: hp,
          vx: 1.5, 
          vy: 2, 
          color: '#451a03', 
          damage: 99999,
          attackTimer: 60
      });
  };

  const drawHexagon = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, fill: boolean = true) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = x + r * Math.cos(angle);
          const py = y + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill) {
          ctx.fillStyle = color;
          ctx.fill();
      } else {
          ctx.strokeStyle = color;
          ctx.stroke();
      }
  };

  const drawWasp = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
      const time = gameRef.current.frameCount;
      ctx.save();
      ctx.translate(x, y);
      
      // Wings
      const wingScale = Math.sin(time * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-10, -5, 12, 6 * Math.abs(wingScale), -0.5, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, -5, 12, 6 * Math.abs(wingScale), 0.5, 0, Math.PI*2);
      ctx.fill();

      // Body (Triangle)
      ctx.fillStyle = '#fbbf24'; // Yellow
      ctx.beginPath();
      ctx.moveTo(-w/2, -w/2);
      ctx.lineTo(w/2, -w/2);
      ctx.lineTo(0, w/2 + 5);
      ctx.fill();
      
      // Stripes
      ctx.fillStyle = '#000';
      ctx.fillRect(-w/3, -5, w/1.5, 4);
      ctx.fillRect(-w/4, 5, w/2, 4);
      
      // Eyes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(-8, -w/3, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -w/3, 4, 0, Math.PI*2); ctx.fill();

      ctx.restore();
  };

  const drawBear = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
      ctx.save();
      ctx.translate(x, y);
      
      // Ears
      ctx.fillStyle = '#451a03'; // Dark Brown
      ctx.beginPath(); ctx.arc(-15, -15, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -15, 8, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = '#78350f'; // Brown
      ctx.beginPath();
      ctx.arc(0, 0, w/2, 0, Math.PI*2);
      ctx.fill();
      
      // Snout
      ctx.fillStyle = '#fbbf24'; // Yellowish snout
      ctx.beginPath();
      ctx.ellipse(0, 5, 12, 8, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI*2); ctx.fill(); // Nose

      // Angry Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-15, -10); ctx.lineTo(-5, -5); ctx.lineTo(-15, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(15, -10); ctx.lineTo(5, -5); ctx.lineTo(15, 0);
      ctx.fill();

      ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, boss: Entity) => {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      
      // Shake effect when hit
      if (gameRef.current.frameCount % 5 === 0) {
          // Subtle shake
      }

      // Mech Bear Head
      const w = boss.width;
      const h = boss.height;

      // Ears (Metal)
      ctx.fillStyle = '#57534e'; // Metal Grey
      ctx.beginPath(); 
      ctx.arc(-w/3, -h/3, 30, 0, Math.PI*2); 
      ctx.arc(w/3, -h/3, 30, 0, Math.PI*2); 
      ctx.fill();
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Main Face
      ctx.fillStyle = '#7f1d1d'; // Dark Red Metal
      ctx.beginPath();
      ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Metal Plates
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-w/4, -h/2, w/2, h);

      // Glowing Eyes
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      // Left Eye
      ctx.moveTo(-60, -20); ctx.lineTo(-20, 0); ctx.lineTo(-60, 10); ctx.fill();
      // Right Eye
      ctx.moveTo(60, -20); ctx.lineTo(20, 0); ctx.lineTo(60, 10); ctx.fill();
      ctx.shadowBlur = 0;

      // Mouth/Grille
      ctx.fillStyle = '#171717';
      ctx.fillRect(-40, 40, 80, 40);
      ctx.fillStyle = '#525252';
      for(let i=0; i<5; i++) {
          ctx.fillRect(-30 + i*15, 40, 5, 40);
      }

      // HP Bar
      const hpPct = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = '#000';
      ctx.fillRect(-w/2, -h/2 - 30, w, 15);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-w/2 + 2, -h/2 - 28, (w-4) * hpPct, 11);

      ctx.restore();
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
        if (
            Math.abs(b.x - game.player.x) < (b.width + game.player.width)/2 * 0.7 &&
            Math.abs(b.y - game.player.y) < (b.height + game.player.height)/2 * 0.7
        ) {
            const dmg = b.damage || 1;
            game.swarmSize = Math.max(0, game.swarmSize - dmg);
            
            setSwarmCount(game.swarmSize);
            createParticles(game.player.x, game.player.y, '#991b1b', 8, 3);
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
        
        if (e.wobbleSpeed && e.wobble !== undefined) {
            e.wobble += e.wobbleSpeed;
            e.x += Math.sin(e.wobble) * 2.5;
            e.x = Math.max(e.width/2, Math.min(CANVAS_WIDTH - e.width/2, e.x));
        }

        e.y += e.vy;
        e.x += e.vx;
        
        if (e.type === 'boss') {
            if (e.x < e.width/2 || e.x > CANVAS_WIDTH - e.width/2) e.vx *= -1;
            if (e.y > 120) e.vy = 0;
            
            if (e.attackTimer !== undefined) {
                e.attackTimer--;
                if (e.attackTimer <= 0) {
                    spawnBossBullet(e);
                    const cooldown = Math.max(15, 80 - game.difficulty * 8);
                    e.attackTimer = cooldown; 
                }
            }
        }

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
                createParticles(e.x, e.y, '#fcd34d', 5, 2);
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
            if (
                Math.abs(e.x - b.x) < (e.width + b.width)/2 &&
                Math.abs(e.y - b.y) < (e.height + b.height)/2
            ) {
                e.hp -= game.damage;
                game.bullets.splice(j, 1);
                // Hit effect
                createParticles(b.x, b.y - 10, '#fff', 2, 2);

                if (e.hp <= 0) {
                    if (e.type === 'crate') {
                        if (e.rewardType === 'bees' || e.rewardType === 'super_bees') {
                             game.swarmSize += (e.rewardValue || 1);
                        }
                        if (e.rewardType === 'speed') game.fireRate = Math.max(5, game.fireRate - 1);
                        if (e.rewardType === 'power') game.damage += 0.1;
                        
                        setSwarmCount(Math.floor(game.swarmSize));
                        createParticles(e.x, e.y, e.rewardType === 'super_bees' ? '#FFD700' : '#3b82f6', 20, 5);
                    } else if (e.type === 'boss') {
                        game.bossActive = false;
                        game.difficulty += 1.0; 
                        game.stage += 1;
                        setLevel(game.stage);
                        showWaveMessage(`STAGE ${game.stage} START`);
                        game.nextBossDistance = game.distance + BOSS_SPAWN_DISTANCE;
                        game.score += 5000 * Math.floor(game.difficulty);
                        createParticles(e.x, e.y, '#F00', 60, 8);
                    } else {
                        game.score += 10 * Math.floor(game.difficulty);
                        createParticles(e.x, e.y, '#ef4444', 10, 3);
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

    // Dynamic Hex Grid Background
    const bgScroll = game.distance % 60;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.1)'; // Honey color faint
    ctx.lineWidth = 2;
    // Draw hex grid effect
    for (let y = -60; y < CANVAS_HEIGHT + 60; y += 52) { // approx hex height
        for (let x = 0; x < CANVAS_WIDTH + 60; x += 60) {
            const offset = (Math.floor((y + bgScroll) / 52) % 2) * 30;
            const drawX = x + offset;
            const drawY = y + bgScroll;
            drawHexagon(ctx, drawX, drawY, 25, 'rgba(251, 191, 36, 0.05)', true);
        }
    }

    // Draw Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // Draw Enemy Bullets (Stingers)
    game.enemyBullets.forEach(b => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.height/2);
        ctx.lineTo(b.x - b.width/2, b.y - b.height/2);
        ctx.lineTo(b.x + b.width/2, b.y - b.height/2);
        ctx.fill();
    });

    // Draw Enemies/Crates
    game.enemies.forEach(e => {
        if (e.type === 'crate') {
            const isSuper = e.rewardType === 'super_bees';
            const crateColor = isSuper ? '#fef08a' : '#93c5fd';
            const borderColor = isSuper ? '#ca8a04' : '#1d4ed8';
            
            drawHexagon(ctx, e.x, e.y, e.width/2, crateColor, true);
            drawHexagon(ctx, e.x, e.y, e.width/2 - 4, borderColor, false);
            
            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 16px font-mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.ceil(e.hp)}`, e.x, e.y);
            
            ctx.font = '10px font-sans';
            ctx.fillText(isSuper ? "MAX!" : "+Bee", e.x, e.y + 15);

        } else if (e.type === 'boss') {
            drawBoss(ctx, e);
        } else {
            if (e.enemyType === 'bear') {
                drawBear(ctx, e.x, e.y, e.width);
            } else {
                drawWasp(ctx, e.x, e.y, e.width);
            }
            
            // HP Text
            ctx.fillStyle = '#fff';
            ctx.font = '10px font-mono';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(e.hp)}`, e.x, e.y + e.height/2 + 12);
        }
    });

    // Draw Player Bullets (Honey Drops)
    ctx.fillStyle = '#fbbf24';
    game.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.width, 0, Math.PI*2);
        ctx.fill();
    });

    // Draw Player (Swarm)
    const { player, swarmSize } = game;
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐶', player.x, player.y);
    
    // Draw Swarm Orbiting (Tiny Bees)
    const orbitRadius = 35 + Math.min(swarmSize, 50) * 0.5;
    const visualCount = Math.min(swarmSize - 1, 30); 
    
    for(let i=0; i<visualCount; i++) {
        const time = Date.now() * 0.005;
        const angle = (i / visualCount) * Math.PI * 2 + time;
        const bx = player.x + Math.cos(angle) * orbitRadius;
        const by = player.y + Math.sin(angle) * (orbitRadius * 0.5); 
        ctx.font = '14px serif';
        ctx.fillText('🐝', bx, by);
    }
    
    // Squad Count
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
      <div className="relative w-full max-w-md mx-auto aspect-[360/600] bg-orange-50 rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-500 select-none touch-none">
        
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
                <div className="bg-black/70 text-white px-8 py-4 rounded-2xl text-3xl font-black italic tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-10 border-2 border-yellow-400">
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
                击碎 <span className="text-blue-400">蓝色晶格</span> 增加蜜蜂<br/>
                击碎 <span className="text-white font-bold">皇家晶格</span> 获得大量蜜蜂!<br/>
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
      
      <div className="flex gap-4 justify-center text-xs text-gray-400 font-medium">
         <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-full border border-blue-600"></span> 晶格</span>
         <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white border border-gray-500 rounded-full"></span> 皇家晶格</span>
         <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full border border-red-700"></span> 敌人</span>
      </div>
    </div>
  );
};

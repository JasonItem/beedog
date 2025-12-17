
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Zap, AlertTriangle, ArrowUp, Footprints } from 'lucide-react';

interface HoneyJumpProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Platform {
  x: number;
  width: number;
  type: 'safe' | 'spike' | 'gap';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// Background Assets in Cycle Order
const BG_URLS = [
  "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F3%2FbackgroundCastles.png?alt=media&token=f8ab2085-cc6e-4d47-b66b-2025a8c76553", // 0-500m
  "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F3%2FbackgroundColorDesert.png?alt=media&token=be3e9813-5392-43f8-9394-67af1cd139aa", // 500-1000m
  "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F3%2FbackgroundColorGrass.png?alt=media&token=a3958543-9fd3-4c20-bfb9-42dd7ada85fc"  // 1000-1500m
];

const BG_SWITCH_DISTANCE = 500;

// Theme Colors corresponding to BG_URLS
// Updated to softer pastel colors for better integration with light backgrounds
const THEMES = [
  { // Castle (Pastel Green / Greyish Brown)
    grassLight: '#86efac', // Green-300
    grassDark: '#4ade80',  // Green-400
    soil: '#71665c'        // Desaturated Brown/Grey
  },
  { // Desert (Pastel Yellow / Sandy)
    grassLight: '#fde047', // Yellow-300
    grassDark: '#facc15',  // Yellow-400
    soil: '#8a7761'        // Soft Sand
  },
  { // Grassland (Pastel Lime / Stone)
    grassLight: '#bef264', // Lime-300
    grassDark: '#a3e635',  // Lime-400
    soil: '#5c5752'        // Warm Stone Grey
  }
];

// Color Interpolation Helper
const lerpColor = (a: string, b: string, t: number) => {
  const ah = parseInt(a.replace(/#/g, ''), 16),
    ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
    bh = parseInt(b.replace(/#/g, ''), 16),
    br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
    rr = ar + t * (br - ar),
    rg = ag + t * (bg - ag),
    rb = ab + t * (bb - ab);

  return `rgb(${Math.round(rr)},${Math.round(rg)},${Math.round(rb)})`;
};

export const HoneyJump: React.FC<HoneyJumpProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgsRef = useRef<HTMLImageElement[]>([]); // Array to hold loaded BGs
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);

  // Constants
  const CANVAS_WIDTH = 360;
  const CANVAS_HEIGHT = 600;
  const GROUND_Y = 400;
  const GRAVITY = 0.6;
  const FRICTION = 0.8;
  const PLAYER_SIZE = 40;
  const MAX_CHARGE_TIME = 750; // ms
  
  // Game Logic Ref
  const gameRef = useRef({
    player: { 
      x: 50, 
      y: GROUND_Y - PLAYER_SIZE, 
      vx: 0, 
      vy: 0, 
      rotation: 0, 
      grounded: true,
      squish: 0 // For charge animation
    },
    cameraX: 0,
    platforms: [] as Platform[],
    particles: [] as Particle[],
    
    // Input
    isCharging: false,
    chargeStartTime: 0,
    
    // Gameplay Stats
    maxDistance: 0,
    spikeCombo: 0, // How many times hit spikes consecutively
    
    // Loop
    animationId: 0,
    lastFrameTime: 0,
    isGameOver: false,

    // Background Transition State
    bgTransition: {
        currentIndex: 0,
        nextIndex: 0,
        fadeAlpha: 0
    }
  });

  useEffect(() => {
    // Load Character
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F1%2Fbee.png?alt=media&token=6b13c993-0686-47d8-9fad-63990e10a5fa";
    img.onload = () => { dogImgRef.current = img; };

    // Load Backgrounds (All 3)
    BG_URLS.forEach((url, index) => {
        const bg = new Image();
        bg.src = url;
        bg.onload = () => {
            bgImgsRef.current[index] = bg;
        };
    });

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const initGame = () => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    setGameState('PLAYING');
    setScore(0);

    // Initial Platforms
    const platforms: Platform[] = [];
    // Start area (Safe)
    platforms.push({ x: -100, width: 400, type: 'safe' });
    
    // Generate initial track
    let currentX = 300;
    for(let i=0; i<10; i++) {
        // Find last real platform to generate next
        const last = platforms.length > 0 ? platforms[platforms.length - 1] : undefined;
        const next = generatePlatform(currentX, last);
        
        // --- SMART MERGE LOGIC ---
        // If the new platform connects seamlessly to the last one (no gap) AND is the same type,
        // extend the last platform instead of creating a new one.
        // This solves the "white line" seam and "rounded corner" discontinuity.
        if (last && last.type === next.type && Math.abs(next.x - (last.x + last.width)) < 1) {
            last.width += next.width;
            currentX = last.x + last.width; // Update currentX pointer
        } else {
            platforms.push(next);
            currentX = next.x + next.width;
        }
    }

    gameRef.current = {
      player: { 
        x: 50, 
        y: GROUND_Y - PLAYER_SIZE, 
        vx: 0, 
        vy: 0, 
        rotation: 0, 
        grounded: true,
        squish: 0
      },
      cameraX: 0,
      platforms,
      particles: [],
      isCharging: false,
      chargeStartTime: 0,
      maxDistance: 0,
      spikeCombo: 0,
      animationId: 0,
      lastFrameTime: performance.now(),
      isGameOver: false,
      bgTransition: { currentIndex: 0, nextIndex: 0, fadeAlpha: 0 }
    };
    
    loop();
  };

  const generatePlatform = (startX: number, lastPlatform?: Platform): Platform => {
      // Calculate Difficulty Factor (0.0 to 1.0)
      // Caps at 20000px (2000m)
      const difficulty = Math.min(1, Math.max(0, startX / 20000));

      // SAFETY RULE 1: If last was spike, we MUST have a safe landing spot immediately (no gap)
      const lastWasSpike = lastPlatform?.type === 'spike';
      
      // Chance of gap increases with difficulty? 
      // Actually, gap chance can stay similar, but gap size increases.
      let isGap = !lastWasSpike && Math.random() > 0.3; // 70% chance of being connected if not forced safe
      let gapSize = 0;
      
      if (isGap) {
          // Dynamic Gap Size
          // Base: 40-120
          // Max Difficulty: 80-260
          // The player can jump approx 450px at max charge, so 260 is safe but challenging.
          const minGap = 40 + (difficulty * 40);
          const maxGap = 120 + (difficulty * 140);
          gapSize = minGap + Math.random() * (maxGap - minGap);
      }

      let platX = startX + gapSize;

      // Determine Type
      let type: 'safe' | 'spike' = 'safe';
      
      if (lastWasSpike) {
          // SAFETY RULE 2: No consecutive spikes
          type = 'safe'; 
      } else {
          // Spike probability increases with difficulty
          // Base: 40%, Max: 70%
          const spikeChance = 0.4 + (difficulty * 0.3);
          type = Math.random() < spikeChance ? 'spike' : 'safe';
      }

      let width = 0;
      if (type === 'spike') {
          // SAFETY RULE 3: Spike platform constraints
          const maxTotalObstacle = 300;
          const maxSpikeWidth = Math.max(60, maxTotalObstacle - gapSize);
          
          // Spike width
          const w = 60 + Math.random() * 120; 
          width = Math.min(w, maxSpikeWidth);
          
          // If the jump is massive, force a safe landing instead of a spike
          // to avoid "leap of faith" onto death
          if (gapSize > 200) type = 'safe';
      } 
      
      if (type === 'safe') {
          // Safe platforms get narrower with difficulty
          // Base: 100-250
          // Max Difficulty: 60-150 (Requires precise landing)
          const minSafe = 100 - (difficulty * 40);
          const maxSafe = 250 - (difficulty * 100);
          width = minSafe + Math.random() * (maxSafe - minSafe);
      }

      return {
          x: platX,
          width,
          type
      };
  };

  const endGame = async () => {
    if (gameRef.current.isGameOver) return;
    
    gameRef.current.isGameOver = true;
    audio.playGameOver();
    setGameState('GAME_OVER');
    cancelAnimationFrame(gameRef.current.animationId);

    if (userProfile && gameRef.current.maxDistance > 0) {
      await saveHighScore(userProfile, 'honey_jump', Math.floor(gameRef.current.maxDistance));
      onGameOver();
    }
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        gameRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 1) * 10,
            life: 20 + Math.random() * 10,
            color
        });
    }
  };

  // --- PHYSICS & LOGIC ---

  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (gameState !== 'PLAYING' || !gameRef.current.player.grounded) return;
      
      gameRef.current.isCharging = true;
      gameRef.current.chargeStartTime = performance.now();
      audio.playStep(); // Charging sound effect start
  };

  const handlePointerUp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (gameState !== 'PLAYING') return;
      if (!gameRef.current.isCharging) return;

      const now = performance.now();
      const chargeDuration = Math.min(MAX_CHARGE_TIME, now - gameRef.current.chargeStartTime); 
      const power = chargeDuration / MAX_CHARGE_TIME; // 0.0 to 1.0 normalized
      
      jump(power);
      
      gameRef.current.isCharging = false;
  };

  const jump = (power: number) => {
      const { player } = gameRef.current;
      
      // Min jump power
      const effectivePower = Math.max(0.15, power);
      
      // Jump Physics (Significantly Toned Down)
      // New: VX 3-9, VY -7 to -15
      
      player.vx = 3 + effectivePower * 6;  // Horizontal Force
      player.vy = -7 - effectivePower * 8; // Vertical Force
      
      player.grounded = false;
      player.squish = 0;
      
      audio.playJump();
      createParticles(player.x, player.y + PLAYER_SIZE, '#fff', 5);
  };

  const hitSpike = () => {
      const { player } = gameRef.current;
      
      audio.playGameOver(); // Ouch sound
      
      // Increment combo penalty
      gameRef.current.spikeCombo++;
      
      // Bounce Back Logic
      const bounceForce = 6 + (gameRef.current.spikeCombo * 3);
      
      player.vx = -bounceForce; // Bounce backward
      player.vy = -7; // Bounce up slightly
      player.grounded = false;
      
      createParticles(player.x, player.y + PLAYER_SIZE, '#d1d5db', 10);
      
      // Visual Shake
      const canvas = canvasRef.current;
      if (canvas) {
          canvas.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px)`;
          setTimeout(() => { if (canvas) canvas.style.transform = 'none'; }, 200);
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

    // --- UPDATE ---

    // 1. Charging Logic
    if (game.isCharging) {
        const chargeDuration = now - game.chargeStartTime;
        const rawPower = Math.min(MAX_CHARGE_TIME, chargeDuration) / (MAX_CHARGE_TIME/100); // 0-100
        
        // Squish player while charging (More pronounced squish)
        player.squish = (rawPower / 100) * 0.6;
    }

    // 2. Physics
    if (!player.grounded) {
        player.vy += GRAVITY;
        // player.rotation += 0.15; // Removed rotation per user request
    } else {
        player.vx *= FRICTION; // Slide to stop
        player.rotation = 0; // Reset rotation
    }

    player.x += player.vx;
    player.y += player.vy;

    // 3. Collision Detection (Ground)
    // Check if player is falling or at ground level
    // BUG FIX: Restrict the landing check to a narrow band around the ground level.
    // If the player falls deep into a gap (e.g., >30px below ground), they should NOT snap back up.
    if (player.vy >= 0 && player.y + PLAYER_SIZE >= GROUND_Y && player.y + PLAYER_SIZE < GROUND_Y + 30) {
        // Check if under a platform
        let landed = false;
        let onSpike = false;
        
        // Use CENTER X of player for better landing logic
        const centerX = player.x + PLAYER_SIZE / 2;

        for (const plat of game.platforms) {
            // Check if center of player is strictly within platform X bounds
            if (centerX > plat.x && centerX < plat.x + plat.width) {
                // Landed on this platform
                landed = true;
                if (plat.type === 'spike') {
                    onSpike = true;
                }
                break;
            }
        }

        if (landed) {
            if (onSpike) {
                // Hit Spike!
                // Only trigger if we aren't already bouncing up (debounce)
                if (player.y >= GROUND_Y - PLAYER_SIZE - 5) {
                    hitSpike();
                }
            } else {
                // Safe Landing
                player.y = GROUND_Y - PLAYER_SIZE;
                player.vy = 0;
                player.grounded = true;
                player.rotation = 0;
                game.spikeCombo = 0; // Reset penalty
            }
        } else {
            // Not on a platform (Gap)
            // Explicitly un-ground if we walked off an edge
            player.grounded = false; 
        }
    }

    // 4. Void Death Check
    // If player falls significantly below ground level (gap), trigger game over immediately.
    // Don't wait for them to fall off the entire canvas.
    if (player.y + PLAYER_SIZE > GROUND_Y + 30) {
       endGame();
       return;
    }

    // 5. Camera Follow
    // Camera follows player, but smooth
    const targetCamX = player.x - 100;
    game.cameraX += (targetCamX - game.cameraX) * 0.1;

    // 6. Score Update
    const dist = Math.floor(player.x / 10);
    if (dist > game.maxDistance) {
        game.maxDistance = dist;
        setScore(dist);
    }

    // 7. Level Generation (Endless)
    const lastPlat = game.platforms[game.platforms.length - 1];
    if (lastPlat.x < player.x + CANVAS_WIDTH * 2) {
        const next = generatePlatform(lastPlat.x + lastPlat.width, lastPlat);
        
        // MERGE LOGIC (Runtime Generation)
        if (lastPlat.type === next.type && Math.abs(next.x - (lastPlat.x + lastPlat.width)) < 1) {
            lastPlat.width += next.width;
        } else {
            game.platforms.push(next);
        }
    }
    
    // OPTIMIZATION: Keep platforms longer so bounce-backs don't hit void
    // Remove if > 800px behind camera (approx 2 screen widths)
    if (game.platforms[0].x + game.platforms[0].width < game.cameraX - 800) {
        game.platforms.shift();
    }

    // 8. Background Transition Logic
    const targetBgIndex = Math.floor(game.maxDistance / BG_SWITCH_DISTANCE) % BG_URLS.length;
    const bgTrans = game.bgTransition;
    
    // If target changed and we aren't already moving to it
    if (bgTrans.currentIndex !== targetBgIndex && bgTrans.nextIndex === bgTrans.currentIndex) {
        bgTrans.nextIndex = targetBgIndex;
    }
    
    // Perform Fade
    if (bgTrans.nextIndex !== bgTrans.currentIndex) {
        bgTrans.fadeAlpha += 0.01; // Fade speed
        if (bgTrans.fadeAlpha >= 1) {
            bgTrans.currentIndex = bgTrans.nextIndex;
            bgTrans.fadeAlpha = 0;
        }
    }

    // 9. Calculate Current Theme Colors (Interpolation)
    const themeA = THEMES[bgTrans.currentIndex];
    const themeB = THEMES[bgTrans.nextIndex];
    const t = bgTrans.fadeAlpha;
    
    const cGrassLight = lerpColor(themeA.grassLight, themeB.grassLight, t);
    const cGrassDark = lerpColor(themeA.grassDark, themeB.grassDark, t);
    const cSoil = lerpColor(themeA.soil, themeB.soil, t);

    // 10. Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Dynamic Backgrounds (Parallax + Fade)
    const renderBgLayer = (index: number, globalAlpha: number) => {
        const img = bgImgsRef.current[index];
        if (!img || !img.complete) {
            // Fallback colors
            ctx.fillStyle = index === 0 ? '#87CEEB' : index === 1 ? '#F4A460' : '#90EE90'; 
            ctx.globalAlpha = globalAlpha;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalAlpha = 1.0;
            return;
        }
        
        const parallaxSpeed = 0.2;
        const scale = CANVAS_HEIGHT / img.height; 
        const scaledW = img.width * scale;
        const scaledH = CANVAS_HEIGHT;
        
        // Calculate scrolling offset based on camera
        // We want the background to scroll slower than the camera
        // FIX: Handle negative cameraX (start of game) correctly to prevent left-side gaps
        const totalOffset = game.cameraX * parallaxSpeed;
        let startX = -(totalOffset % scaledW);
        
        // If startX is positive (due to negative camera or modulo behavior), 
        // shift left by one tile width to ensure coverage from the left edge.
        if (startX > 0) {
            startX -= scaledW;
        }
        
        ctx.globalAlpha = globalAlpha;
        // Draw enough tiles to fill canvas + buffer
        for (let x = startX; x < CANVAS_WIDTH; x += scaledW) {
            ctx.drawImage(img, x, 0, scaledW, scaledH);
        }
        ctx.globalAlpha = 1.0;
    };

    // Draw Current Base
    renderBgLayer(bgTrans.currentIndex, 1.0);
    // Draw Next Fading In
    if (bgTrans.fadeAlpha > 0) {
        renderBgLayer(bgTrans.nextIndex, bgTrans.fadeAlpha);
    }

    ctx.save();
    ctx.translate(-game.cameraX, 0);

    // Platforms
    game.platforms.forEach(plat => {
        const renderWidth = plat.width + 1; // +1 to prevent sub-pixel gaps

        if (plat.type === 'safe') {
            const grassH = 24; // Height of grass cap
            
            // 1. SOIL BODY (PROCEDURAL TEXTURE)
            ctx.fillStyle = cSoil;
            // Draw below ground level, ensure no gap with grass (start at +20 to be overlapped)
            ctx.fillRect(plat.x, GROUND_Y + 20, renderWidth, CANVAS_HEIGHT - (GROUND_Y + 20));
            
            // Procedural Texture (Stones/Speckles)
            // Use semi-transparent black to darken specific spots, creating "stones"
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for(let i = 0; i < renderWidth; i += 20) {
                // Deterministic random using coordinate
                const seed = Math.floor((plat.x + i) * 0.1); 
                if (seed % 3 === 0) {
                     ctx.beginPath();
                     ctx.arc(plat.x + i + 10, GROUND_Y + 40 + (seed%5)*5, 4, 0, Math.PI*2);
                     ctx.fill();
                }
                if (seed % 7 === 0) {
                     ctx.fillRect(plat.x + i + 5, GROUND_Y + 30 + (seed%4)*8, 6, 6);
                }
            }

            // 2. GRASS CAP (Seamless Connection)
            // Main Grass Body
            ctx.fillStyle = cGrassDark;
            ctx.beginPath();
            // Round top corners, sharp bottom corners to fuse with soil
            // Extend slightly left/right (-2, +4 width) for "overhang" look
            ctx.roundRect(plat.x - 2, GROUND_Y, renderWidth + 4, grassH, [10, 10, 0, 0]);
            ctx.fill();
            
            // Top Highlight (Lighter Green)
            ctx.fillStyle = cGrassLight;
            ctx.beginPath();
            ctx.roundRect(plat.x - 2, GROUND_Y, renderWidth + 4, 10, [10, 10, 0, 0]);
            ctx.fill();
            
            // Decorative "Drips" (Organic feel)
            ctx.fillStyle = cGrassDark;
            for(let i = 10; i < renderWidth - 10; i += 15) {
                 // Deterministic random drip
                 if (Math.sin(plat.x + i) > 0.2) {
                     ctx.beginPath();
                     ctx.arc(plat.x + i, GROUND_Y + grassH - 2, 4, 0, Math.PI); 
                     ctx.fill();
                 }
            }

        } else if (plat.type === 'spike') {
            // Dark Body for spike platform
            ctx.fillStyle = cSoil;
            ctx.fillRect(plat.x, GROUND_Y + 20, renderWidth, CANVAS_HEIGHT - (GROUND_Y + 20));
            
            // Top cap (Platform surface)
            ctx.fillStyle = '#57534e'; // Stone grey
            ctx.fillRect(plat.x, GROUND_Y + 10, renderWidth, 10);

            // White Spikes (Thorns/Teeth style)
            ctx.fillStyle = '#e5e7eb'; // Light gray/white
            const spikeSize = 15;
            const count = Math.floor(plat.width / spikeSize);
            
            for(let i=0; i<count; i++) {
                ctx.beginPath();
                const sx = plat.x + i*spikeSize;
                const sy = GROUND_Y + 10; // Sit on stone cap
                
                ctx.moveTo(sx, sy);
                ctx.quadraticCurveTo(sx + spikeSize/2, sy - 20, sx + spikeSize/2, sy - 25); // Sharper
                ctx.quadraticCurveTo(sx + spikeSize/2, sy - 20, sx + spikeSize, sy);
                ctx.fill();
            }
        }
    });

    // Player
    ctx.save();
    ctx.translate(player.x + PLAYER_SIZE/2, player.y + PLAYER_SIZE/2);
    ctx.rotate(player.rotation);
    
    // Squish scale
    const scaleX = 1 + player.squish * 0.5;
    const scaleY = 1 - player.squish * 0.5;
    ctx.scale(scaleX, scaleY);

    if (dogImgRef.current) {
        ctx.drawImage(dogImgRef.current, -PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(0,0, PLAYER_SIZE/2, 0, Math.PI*2); ctx.fill();
    }
    
    // Angry face if combo penalty high
    if (game.spikeCombo > 0) {
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('💢', 15, -15);
    }

    ctx.restore();

    // Particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 3 + 2, 0, Math.PI*2); ctx.fill();
    });

    // Milestone markers (White text with shadow for visibility on any background)
    for(let m = 0; m < game.maxDistance + 500; m+=50) {
        if (m === 0) continue;
        const mx = m * 10;
        
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        
        // Drop shadow for legibility
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(`${m}m`, mx + 1, GROUND_Y + 51);
        
        // Main Text
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${m}m`, mx, GROUND_Y + 50);
    }

    ctx.restore();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md mx-auto aspect-[360/600] bg-[#e4eeb4] rounded-2xl overflow-hidden shadow-2xl border-4 border-[#333] select-none touch-none ring-4 ring-black/5">
        
        <canvas 
            ref={canvasRef} 
            width={360} 
            height={600} 
            className="w-full h-full block cursor-pointer"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        />

        {/* HUD - Capsule Style */}
        <div className="absolute top-6 right-6 z-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md pl-4 pr-2 py-1.5 rounded-full border border-neutral-200 shadow-sm flex items-center gap-3">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Distance</div>
                <div className="bg-neutral-100 px-3 py-1 rounded-full text-lg font-black font-mono text-neutral-800">
                    {score}m
                </div>
            </div>
        </div>

        {/* Start Screen - Optimized */}
        {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 animate-in fade-in duration-300">
                
                {/* Title */}
                <div className="relative mb-8 text-center transform hover:scale-105 transition-transform duration-300">
                    <div className="text-6xl font-black text-[#facc15] tracking-tighter drop-shadow-[4px_4px_0_#000]" 
                         style={{ WebkitTextStroke: '2px black' }}>
                        HONEY
                    </div>
                    <div className="text-6xl font-black text-white tracking-tighter drop-shadow-[4px_4px_0_#000] -mt-2"
                         style={{ WebkitTextStroke: '2px black' }}>
                        JUMP
                    </div>
                    <div className="mt-2 bg-black text-white text-sm font-bold px-3 py-1 rounded-full inline-block border-2 border-white/20">
                        蜜蜂狗跳一跳
                    </div>
                </div>

                {/* Instructions Card */}
                <div className="bg-white w-full max-w-xs rounded-3xl p-6 border-4 border-black shadow-[8px_8px_0_#000] mb-8 relative overflow-hidden">
                    <div className="space-y-4">
                       {/* Item 1 */}
                       <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-yellow-400 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                               <Zap size={24} className="text-black fill-white" />
                           </div>
                           <div>
                               <div className="font-black text-lg">长按蓄力</div>
                               <div className="text-xs text-neutral-500 font-bold">按住屏幕控制力度</div>
                           </div>
                       </div>
                       {/* Item 2 */}
                       <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-blue-400 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                               <ArrowUp size={24} className="text-black" strokeWidth={3} />
                           </div>
                           <div>
                               <div className="font-black text-lg">松开跳跃</div>
                               <div className="text-xs text-neutral-500 font-bold">找准落点起飞</div>
                           </div>
                       </div>
                       {/* Item 3 */}
                       <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-red-400 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                               <AlertTriangle size={24} className="text-black fill-white" />
                           </div>
                           <div>
                               <div className="font-black text-lg">躲避尖刺</div>
                               <div className="text-xs text-neutral-500 font-bold">被扎到会弹飞哦</div>
                           </div>
                       </div>
                    </div>
                </div>

                <Button onClick={initGame} className="w-full max-w-xs py-4 text-xl font-black bg-[#facc15] hover:bg-[#eab308] text-black border-4 border-black rounded-2xl shadow-[4px_4px_0_#fff] active:translate-y-1 active:shadow-none transition-all">
                    <Play className="mr-2 fill-current" /> 开始游戏
                </Button>
            </div>
        )}

        {/* Game Over Screen - Refined */}
        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 animate-in zoom-in duration-300">
                <div className="text-5xl mb-6 animate-bounce">🤕</div>
                
                <div className="text-5xl font-black text-[#facc15] mb-2 tracking-tighter drop-shadow-[2px_2px_0_#000]" 
                     style={{ WebkitTextStroke: '2px black' }}>
                    哎呀!
                </div>
                <div className="text-white font-bold mb-8 text-lg tracking-widest">
                    掉进虚空了...
                </div>
                
                <div className="bg-white w-full max-w-xs rounded-3xl p-8 border-4 border-black shadow-[8px_8px_0_#000] relative overflow-hidden mb-8 transform -rotate-2 hover:rotate-0 transition-transform duration-300">
                    <div className="absolute top-0 left-0 w-full h-4 bg-[repeating-linear-gradient(45deg,#facc15,#facc15_10px,#000_10px,#000_20px)]"></div>
                    <div className="text-center mt-2">
                        <div className="text-sm font-black text-neutral-400 uppercase tracking-widest mb-1">本次距离</div>
                        <div className="text-7xl font-black text-black font-mono tracking-tighter leading-none">
                            {score}
                        </div>
                        <div className="text-base font-bold text-neutral-400 mt-2">米</div>
                    </div>
                </div>

                <Button onClick={initGame} className="w-full max-w-xs py-4 text-xl font-black bg-[#facc15] hover:bg-[#eab308] text-black border-4 border-black rounded-2xl shadow-[4px_4px_0_#fff] active:translate-y-1 active:shadow-none transition-all">
                    <RotateCcw className="mr-2" strokeWidth={3} /> 再试一次
                </Button>
            </div>
        )}
      </div>
    </div>
  );
};

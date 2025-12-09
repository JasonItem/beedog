
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { Button } from '../Button';
import { Play, RotateCcw, PenTool, ShieldCheck, Eraser, Clock, ArrowRight, Star, AlertTriangle, Droplets } from 'lucide-react';

interface SaveBeeDogProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  isStatic: boolean; // True if touching ground/anchor
  vx: number; 
  vy: number;
  mass: number;
  center: Point; // Approximate center of mass
  bounds?: { minX: number, maxX: number, minY: number, maxY: number };
}

interface Bee {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  force: number;
}

interface DogEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  mass: number;
}

interface LevelData {
  id: number;
  dogPos: Point;
  hivePos: Point;
  anchors: {x: number, y: number, w: number, h: number}[];
  beeCount: number;
  difficulty: number;
  maxInk: number;
  hint: string;
}

const LEVELS: LevelData[] = [
  {
    id: 1,
    dogPos: { x: 160, y: 350 }, // In a pit
    hivePos: { x: 160, y: 80 },
    anchors: [
      { x: 0, y: 400, w: 100, h: 200 }, // Left Wall
      { x: 220, y: 400, w: 100, h: 200 }, // Right Wall
      { x: 100, y: 450, w: 120, h: 50 }, // Floor
    ],
    beeCount: 30,
    difficulty: 1,
    maxInk: 500,
    hint: "画个盖子挡住蜜蜂！"
  },
  {
    id: 2,
    dogPos: { x: 160, y: 250 }, // On a platform
    hivePos: { x: 50, y: 100 },
    anchors: [
      { x: 100, y: 300, w: 120, h: 20 } // Floating Platform
    ],
    beeCount: 40,
    difficulty: 1.2,
    maxInk: 400,
    hint: "小心别让狗狗掉下去！"
  },
  {
    id: 3,
    dogPos: { x: 100, y: 200 }, // On a slope
    hivePos: { x: 250, y: 100 },
    anchors: [
      { x: 50, y: 250, w: 100, h: 20 }, // Left Platform
      { x: 50, y: 250, w: 20, h: 200 }  // Wall back
    ],
    beeCount: 50,
    difficulty: 1.5,
    maxInk: 350,
    hint: "把狗狗圈在墙角！"
  },
  {
    id: 4,
    dogPos: { x: 160, y: 180 }, // High Peak
    hivePos: { x: 160, y: 50 },
    anchors: [
      { x: 140, y: 230, w: 40, h: 300 } // Thin Pillar
    ],
    beeCount: 60,
    difficulty: 1.8,
    maxInk: 300,
    hint: "这根柱子太细了，要钩住它！"
  },
  {
    id: 5,
    dogPos: { x: 50, y: 150 }, // Slope Slide
    hivePos: { x: 250, y: 300 },
    anchors: [
      // Slope made of steps
      { x: 0, y: 200, w: 80, h: 20 },
      { x: 80, y: 250, w: 80, h: 20 },
      { x: 160, y: 300, w: 80, h: 20 },
    ],
    beeCount: 80,
    difficulty: 2.0,
    maxInk: 400,
    hint: "一定要防止狗狗滑落深渊！"
  }
];

export const SaveBeeDog: React.FC<SaveBeeDogProps> = ({ userProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  
  // React State for UI
  const [gameState, setGameState] = useState<'DRAWING' | 'SIMULATING' | 'LEVEL_WON' | 'GAME_OVER' | 'VICTORY'>('DRAWING');
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [inkPct, setInkPct] = useState(100);
  
  // Game Constants
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const DOG_RADIUS = 24; 
  const BEE_RADIUS = 6;
  const GRAVITY = 0.4;
  const STROKE_WIDTH = 5; 
  const AIR_FRICTION = 0.98;
  const GROUND_FRICTION = 0.8;
  
  // Mutable Game State
  const gameRef = useRef({
    state: 'DRAWING', // mirror of gameState
    dog: { x: 0, y: 0, vx: 0, vy: 0, radius: DOG_RADIUS, angle: 0, mass: 5 } as DogEntity,
    hivePos: { x: 0, y: 0 },
    strokes: [] as Stroke[],
    currentStroke: [] as Point[],
    bees: [] as Bee[],
    anchors: [] as {x: number, y: number, w: number, h: number}[],
    beeCountTotal: 0,
    beeSpawnedCount: 0,
    frameCount: 0,
    isDrawing: false,
    animationId: 0,
    lastFrameTime: 0,
    difficulty: 1,
    inkLeft: 0,
    maxInk: 0
  });

  useEffect(() => {
    const img = new Image();
    img.src = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce";
    img.onload = () => {
      dogImgRef.current = img;
    };

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    };
  }, []);

  const loadLevel = (levelIndex: number) => {
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    
    const levelData = LEVELS[levelIndex];
    if (!levelData) return;

    setGameState('DRAWING');
    setTimeLeft(10);
    setInkPct(100);
    
    // Sync Ref State
    gameRef.current = {
      ...gameRef.current,
      state: 'DRAWING',
      dog: { 
          x: levelData.dogPos.x, 
          y: levelData.dogPos.y, 
          vx: 0, 
          vy: 0, 
          radius: DOG_RADIUS,
          angle: 0,
          mass: 5 // Dog Mass
      },
      hivePos: { ...levelData.hivePos },
      anchors: [...levelData.anchors],
      beeCountTotal: levelData.beeCount,
      difficulty: levelData.difficulty,
      beeSpawnedCount: 0,
      strokes: [],
      currentStroke: [],
      bees: [],
      frameCount: 0,
      isDrawing: false,
      lastFrameTime: performance.now(),
      maxInk: levelData.maxInk,
      inkLeft: levelData.maxInk
    };
    
    loop();
  };

  useEffect(() => {
    loadLevel(0);
  }, []);

  const nextLevel = () => {
    if (currentLevelIdx < LEVELS.length - 1) {
      setCurrentLevelIdx(prev => prev + 1);
      loadLevel(currentLevelIdx + 1);
    } else {
      setGameState('VICTORY');
      if (userProfile) {
        saveHighScore(userProfile, 'save_dog', totalScore);
        onGameOver();
      }
    }
  };

  const retryLevel = () => {
    loadLevel(currentLevelIdx);
  };

  const startSimulation = () => {
    setGameState('SIMULATING');
    gameRef.current.state = 'SIMULATING';
    
    // Initial check for static strokes
    gameRef.current.strokes.forEach(stroke => {
        checkStrokeStatic(stroke, gameRef.current.anchors);
    });
  };

  const checkStrokeStatic = (stroke: Stroke, anchors: any[]) => {
      stroke.isStatic = false;
      for (const pt of stroke.points) {
          // Check Anchor Collision
          for (const anch of anchors) {
              // Loose check for intersection
              if (pt.x >= anch.x - 2 && pt.x <= anch.x + anch.w + 2 &&
                  pt.y >= anch.y - 2 && pt.y <= anch.y + anch.h + 2) {
                  stroke.isStatic = true;
                  stroke.color = '#000'; // Anchored color
                  return;
              }
          }
      }
      stroke.color = '#f97316'; // Falling color (Orange)
  };

  const spawnBee = () => {
    const { hivePos, difficulty } = gameRef.current;
    const x = hivePos.x + (Math.random() - 0.5) * 20;
    const y = hivePos.y + (Math.random() - 0.5) * 20;
    
    gameRef.current.bees.push({
      id: Date.now() + Math.random(),
      x, y,
      vx: (Math.random() - 0.5) * 12 * difficulty, // Fast bees
      vy: (Math.random() - 0.5) * 12 * difficulty,
      radius: BEE_RADIUS,
      force: 5.0 // Stronger Push force (Updated from 2.0)
    });
    gameRef.current.beeSpawnedCount++;
  };

  // Generic Line Circle Collision
  const checkCollisionLineCircle = (p1: Point, p2: Point, circle: {x: number, y: number, r: number}) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx*dx + dy*dy;
    const t = Math.max(0, Math.min(1, ((circle.x - p1.x) * dx + (circle.y - p1.y) * dy) / (lenSq || 1)));
    
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    
    const distDx = circle.x - closestX;
    const distDy = circle.y - closestY;
    const distSq = distDx*distDx + distDy*distDy;
    
    return {
        hit: distSq < circle.r * circle.r,
        nx: distDx,
        ny: distDy,
        dist: Math.sqrt(distSq)
    };
  };

  const handleLevelComplete = () => {
      const levelScore = 100 + (timeLeft * 10) + Math.floor((gameRef.current.inkLeft / gameRef.current.maxInk) * 50);
      setTotalScore(prev => prev + levelScore);
      setGameState('LEVEL_WON');
      gameRef.current.state = 'LEVEL_WON';
  };

  const handleDefeat = () => {
      if (gameRef.current.state === 'GAME_OVER') return;
      setGameState('GAME_OVER');
      gameRef.current.state = 'GAME_OVER';
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);
    
    const now = performance.now();
    const elapsed = now - gameRef.current.lastFrameTime;
    if (elapsed < 16) return;
    gameRef.current.lastFrameTime = now;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;
    
    if (game.state === 'SIMULATING') {
        game.frameCount++;
        
        // Timer
        if (game.frameCount % 60 === 0) {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    handleLevelComplete();
                    return 0;
                }
                return prev - 1;
            });
        }

        // Spawn Bees
        if (game.frameCount % 5 === 0 && game.beeSpawnedCount < game.beeCountTotal) {
            spawnBee();
        }

        // --- PHYSICS: DOG ---
        const { dog } = game;
        
        // Gravity
        dog.vy += GRAVITY;
        dog.vx *= AIR_FRICTION; 
        dog.vy *= AIR_FRICTION;

        // Apply Velocity
        dog.x += dog.vx;
        dog.y += dog.vy;
        
        // Rotation
        dog.angle += dog.vx * 0.1;

        // 1. Dog vs Anchors (Ground/Walls)
        for (const a of game.anchors) {
            const closestX = Math.max(a.x, Math.min(dog.x, a.x + a.w));
            const closestY = Math.max(a.y, Math.min(dog.y, a.y + a.h));
            
            const dx = dog.x - closestX;
            const dy = dog.y - closestY;
            const distSq = dx*dx + dy*dy;
            
            if (distSq < dog.radius * dog.radius) {
                const dist = Math.sqrt(distSq);
                const overlap = dog.radius - dist;
                const nx = dx / (dist || 1);
                const ny = dy / (dist || 1);
                
                // Resolve pos
                dog.x += nx * overlap;
                dog.y += ny * overlap;
                
                // Resolve vel (Bounce + Friction)
                if (ny < -0.5) { // Floor
                    dog.vy = -dog.vy * 0.2; // Low bounce
                    dog.vx *= GROUND_FRICTION; 
                } else {
                    dog.vx = -dog.vx * 0.5;
                }
            }
        }

        // 2. Dog vs Strokes (Rigid Body Physics Approximation)
        game.strokes.forEach(stroke => {
            for (let i = 0; i < stroke.points.length - 1; i++) {
                const p1 = stroke.points[i];
                const p2 = stroke.points[i+1];
                
                // Rough AABB check first
                if (Math.min(p1.x, p2.x) - dog.radius > dog.x || Math.max(p1.x, p2.x) + dog.radius < dog.x ||
                    Math.min(p1.y, p2.y) - dog.radius > dog.y || Math.max(p1.y, p2.y) + dog.radius < dog.y) {
                    continue;
                }

                const col = checkCollisionLineCircle(p1, p2, {x: dog.x, y: dog.y, r: dog.radius + STROKE_WIDTH/2});
                
                if (col.hit) {
                    const pushDist = (dog.radius + STROKE_WIDTH/2) - col.dist;
                    const nx = col.nx / (col.dist || 1);
                    const ny = col.ny / (col.dist || 1);
                    
                    // Push Dog Out of Line
                    dog.x += nx * pushDist;
                    dog.y += ny * pushDist;
                    
                    // NEW: Add push velocity to dog if line is moving (simulate being hit/squeezed)
                    if (!stroke.isStatic) {
                        dog.vx += nx * pushDist * 0.15;
                        dog.vy += ny * pushDist * 0.15;
                    }
                    
                    // Relative Velocity
                    const rVx = dog.vx - stroke.vx;
                    const rVy = dog.vy - stroke.vy;
                    const velAlongNormal = rVx * nx + rVy * ny;

                    // Only solve if objects are moving towards each other
                    if (velAlongNormal < 0) {
                        const e = 0.2; // Restitution
                        
                        // Impulse scalar
                        let j = -(1 + e) * velAlongNormal;
                        const invMassDog = 1 / dog.mass;
                        const invMassStroke = stroke.isStatic ? 0 : 1 / (stroke.mass || 10);
                        
                        j /= (invMassDog + invMassStroke);
                        
                        const impulseX = j * nx;
                        const impulseY = j * ny;
                        
                        dog.vx += impulseX * invMassDog;
                        dog.vy += impulseY * invMassDog;
                        
                        if (!stroke.isStatic) {
                            stroke.vx -= impulseX * invMassStroke;
                            stroke.vy -= impulseY * invMassStroke;
                            // Friction
                            stroke.vx *= 0.99;
                            stroke.vy *= 0.99;
                        }
                    }
                }
            }
        });

        // VOID DEATH CHECK
        if (dog.y > CANVAS_HEIGHT + 60) {
            handleDefeat();
        }

        // --- PHYSICS: STROKES ---
        game.strokes.forEach(stroke => {
            if (!stroke.isStatic) {
                // Gravity
                stroke.vy += GRAVITY;
                stroke.vx *= AIR_FRICTION;
                stroke.vy *= AIR_FRICTION;

                // Move all points
                let hitStatic = false;
                for (const p of stroke.points) {
                    p.x += stroke.vx;
                    p.y += stroke.vy;
                    
                    // Anchor Check
                    for (const a of game.anchors) {
                        if (p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) {
                            hitStatic = true;
                            stroke.vy = 0;
                            stroke.vx *= GROUND_FRICTION;
                        }
                    }
                }
                
                // Update center
                stroke.center.x += stroke.vx;
                stroke.center.y += stroke.vy;

                if (hitStatic) {
                    if (Math.abs(stroke.vy) < 0.5 && Math.abs(stroke.vx) < 0.5) {
                        stroke.isStatic = true;
                        stroke.color = '#333';
                    }
                }
            }
        });

        // --- UPDATE BEES ---
        for (const bee of game.bees) {
            // Homing Force
            const dx = dog.x - bee.x;
            const dy = dog.y - bee.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 0) {
                bee.vx += (dx / dist) * 0.3;
                bee.vy += (dy / dist) * 0.3;
            }
            
            // Random jitter
            bee.vx += (Math.random() - 0.5) * 1.5;
            bee.vy += (Math.random() - 0.5) * 1.5;
            
            // Cap Speed
            const speed = Math.sqrt(bee.vx*bee.vx + bee.vy*bee.vy);
            if (speed > 5) {
                bee.vx = (bee.vx / speed) * 5;
                bee.vy = (bee.vy / speed) * 5;
            }

            // Move
            bee.x += bee.vx;
            bee.y += bee.vy;

            // 1. Collision with Dog
            if (dist < dog.radius + BEE_RADIUS - 2) {
                handleDefeat();
                return;
            }

            // 2. Collision with Strokes (Push Lines!)
            game.strokes.forEach(stroke => {
                let hitLine = false;
                let hitNx = 0;
                let hitNy = 0;

                for (let i = 0; i < stroke.points.length - 1; i += 2) {
                    const p1 = stroke.points[i];
                    const p2 = stroke.points[i+1];
                    const col = checkCollisionLineCircle(p1, p2, {x: bee.x, y: bee.y, r: bee.radius + STROKE_WIDTH/2 + 2});
                    
                    if (col.hit) {
                        const pushDist = (bee.radius + STROKE_WIDTH/2 + 2) - col.dist;
                        const nx = col.nx / (col.dist || 1);
                        const ny = col.ny / (col.dist || 1);
                        
                        // Push Bee Out
                        bee.x += nx * pushDist;
                        bee.y += ny * pushDist;
                        
                        // Bounce Bee
                        const dot = bee.vx * nx + bee.vy * ny;
                        bee.vx -= 1.5 * dot * nx;
                        bee.vy -= 1.5 * dot * ny;

                        hitLine = true;
                        // Use negative normal to push line opposite to bee rebound
                        hitNx = -nx; 
                        hitNy = -ny;
                    }
                }

                // Apply Force to Line if it's dynamic
                if (hitLine && !stroke.isStatic) {
                    // Impulse force from bee
                    stroke.vx += hitNx * bee.force * 0.5; // Multiplier for visible impact
                    stroke.vy += hitNy * bee.force * 0.5;
                }
            });
            
            // 3. Collision with Anchors
            game.anchors.forEach(a => {
                if (bee.x > a.x && bee.x < a.x + a.w && bee.y > a.y && bee.y < a.y + a.h) {
                    bee.vx *= -1;
                    bee.vy *= -1;
                }
            });
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<CANVAS_WIDTH; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,CANVAS_HEIGHT); }
    for(let i=0; i<CANVAS_HEIGHT; i+=20) { ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH,i); }
    ctx.stroke();

    // Anchors
    ctx.fillStyle = '#475569';
    game.anchors.forEach(a => {
        ctx.fillRect(a.x, a.y, a.w, a.h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(a.x, a.y, a.w, 6);
        ctx.fillStyle = '#475569';
    });

    // Dog
    const { dog } = game;
    ctx.save();
    ctx.translate(dog.x, dog.y);
    ctx.rotate(dog.angle);
    
    if (dogImgRef.current) {
        if (game.state === 'GAME_OVER') ctx.scale(1.2, 1.2); 
        const size = DOG_RADIUS * 2.2;
        ctx.drawImage(dogImgRef.current, -size/2, -size/2, size, size);
    } else {
        ctx.fillStyle = 'orange';
        ctx.beginPath(); ctx.arc(0,0, DOG_RADIUS, 0, Math.PI*2); ctx.fill();
    }
    
    if (game.state === 'SIMULATING') {
        ctx.font = '24px serif';
        ctx.fillText('😱', 10, -20);
    } else if (game.state === 'LEVEL_WON') {
        ctx.font = '24px serif';
        ctx.fillText('😎', 10, -20);
    }
    ctx.restore();

    // Hive
    const { hivePos } = game;
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐝', hivePos.x, hivePos.y); 
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.fillText(game.beeSpawnedCount + "/" + game.beeCountTotal, hivePos.x, hivePos.y + 30);

    // Strokes
    if (game.currentStroke.length > 0) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(game.currentStroke[0].x, game.currentStroke[0].y);
        for (const p of game.currentStroke) ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
    
    game.strokes.forEach(stroke => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (stroke.points.length > 0) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (const p of stroke.points) ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    });

    // Bees
    game.bees.forEach(bee => {
        ctx.save();
        ctx.translate(bee.x, bee.y);
        const angle = Math.atan2(dog.y - bee.y, dog.x - bee.x);
        ctx.rotate(angle);
        
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        
        ctx.beginPath(); ctx.ellipse(0,0, bee.radius, bee.radius*0.7, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -bee.radius*0.7); ctx.lineTo(0, bee.radius*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bee.radius, 0); ctx.lineTo(bee.radius+3, 0); ctx.stroke();
        
        ctx.restore();
    });
  };

  // --- INPUT ---
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return {x:0, y:0};
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      let cx, cy;
      if ('touches' in e) {
          cx = e.touches[0].clientX;
          cy = e.touches[0].clientY;
      } else {
          cx = (e as React.MouseEvent).clientX;
          cy = (e as React.MouseEvent).clientY;
      }
      return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (gameRef.current.state !== 'DRAWING') return;
      
      const { x, y } = getCoords(e);
      
      // Prevent drawing inside Dog radius
      const dx = x - gameRef.current.dog.x;
      const dy = y - gameRef.current.dog.y;
      if (Math.sqrt(dx*dx + dy*dy) < gameRef.current.dog.radius + 5) {
          return;
      }

      if (gameRef.current.inkLeft <= 0) return;

      gameRef.current.isDrawing = true;
      gameRef.current.currentStroke = [{x, y}];
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!gameRef.current.isDrawing || gameRef.current.state !== 'DRAWING') return;
      
      const { x, y } = getCoords(e);
      
      const dx = x - gameRef.current.dog.x;
      const dy = y - gameRef.current.dog.y;
      if (Math.sqrt(dx*dx + dy*dy) < gameRef.current.dog.radius + 5) {
          handleEnd(); 
          return;
      }

      const current = gameRef.current.currentStroke;
      const last = current[current.length - 1];
      
      const dist = Math.sqrt((x-last.x)**2 + (y-last.y)**2);
      
      if (dist > 5) {
          if (gameRef.current.inkLeft >= dist) {
              gameRef.current.inkLeft -= dist;
              current.push({x, y});
              setInkPct(Math.max(0, (gameRef.current.inkLeft / gameRef.current.maxInk) * 100));
          } else {
              handleEnd();
          }
      }
  };

  const handleEnd = () => {
      if (!gameRef.current.isDrawing) return;
      gameRef.current.isDrawing = false;
      if (gameRef.current.currentStroke.length > 1) {
          let sx = 0, sy = 0;
          gameRef.current.currentStroke.forEach(p => { sx+=p.x; sy+=p.y; });
          const center = { 
              x: sx / gameRef.current.currentStroke.length, 
              y: sy / gameRef.current.currentStroke.length 
          };

          const newStroke: Stroke = {
              points: [...gameRef.current.currentStroke],
              color: '#000',
              isStatic: false,
              vx: 0,
              vy: 0,
              mass: Math.min(gameRef.current.currentStroke.length * 0.5, 15), // Cap mass for physics responsiveness
              center
          };
          checkStrokeStatic(newStroke, gameRef.current.anchors);
          gameRef.current.strokes.push(newStroke);
      }
      gameRef.current.currentStroke = [];
  };

  const clearLines = () => {
      if (gameRef.current.state === 'DRAWING') {
          gameRef.current.strokes = [];
          gameRef.current.inkLeft = gameRef.current.maxInk;
          setInkPct(100);
      }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-md bg-neutral-200 h-3 rounded-full overflow-hidden border border-neutral-300">
          <div 
            className="h-full bg-cyan-500 transition-all duration-100 ease-out"
            style={{ width: `${inkPct}%` }}
          />
      </div>
      <div className="flex items-center justify-between w-full max-w-md text-xs text-gray-500 -mt-2 px-1">
         <span className="flex items-center gap-1 font-bold text-cyan-600"><Droplets size={12}/> Ink Limit</span>
         <span>{LEVELS[currentLevelIdx].hint}</span>
      </div>

      <div className="relative w-full max-w-md mx-auto aspect-[2/3] bg-white rounded-xl overflow-hidden shadow-2xl border-4 border-amber-500 select-none" style={{touchAction: 'none'}}>
        <canvas 
            ref={canvasRef} 
            width={320} 
            height={480} 
            className="w-full h-full block cursor-crosshair"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        />

        <div className="absolute top-4 left-4 z-10 flex justify-between w-full pr-8 pointer-events-none">
            <div className="bg-white/80 px-3 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-2">
                Level {currentLevelIdx + 1} / {LEVELS.length}
            </div>
            {gameState === 'SIMULATING' && (
                <div className="bg-red-500 text-white font-black text-xl px-4 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-2 animate-pulse">
                    <Clock size={16} /> {timeLeft}s
                </div>
            )}
        </div>

        <div className="absolute top-16 w-full text-center pointer-events-none">
             {gameState === 'DRAWING' && gameRef.current.strokes.length === 0 && (
                 <span className="bg-black/50 text-white px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-md">
                    画线保护蜜蜂狗！
                 </span>
             )}
             {gameState === 'DRAWING' && inkPct < 5 && (
                 <span className="bg-red-500/80 text-white px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                    墨水不足！
                 </span>
             )}
        </div>

        {gameState === 'LEVEL_WON' && (
            <div className="absolute inset-0 bg-green-500/90 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-md animate-in fade-in zoom-in">
                <ShieldCheck size={64} className="mb-4" />
                <h2 className="text-4xl font-black mb-2">SAFE!</h2>
                <div className="text-xl font-bold mb-6">Level {currentLevelIdx + 1} Complete</div>
                <Button onClick={nextLevel} className="w-full max-w-xs py-4 text-lg bg-white text-green-600 hover:bg-gray-100">
                    Next Level <ArrowRight className="ml-2" />
                </Button>
            </div>
        )}

        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-md animate-in fade-in zoom-in">
                <div className="text-6xl mb-4">🤕</div>
                <h2 className="text-4xl font-black mb-2">FAILED!</h2>
                <p className="mb-6 text-sm opacity-90 text-center">
                    {gameRef.current.dog.y > CANVAS_HEIGHT ? "狗狗掉进深渊了！" : "狗狗被蛰了！"}
                </p>
                <Button onClick={retryLevel} className="mt-2 w-full max-w-xs py-4 text-lg bg-white text-red-600 hover:bg-gray-100">
                    <RotateCcw className="mr-2" /> Retry Level
                </Button>
            </div>
        )}

        {gameState === 'VICTORY' && (
            <div className="absolute inset-0 bg-yellow-500/90 flex flex-col items-center justify-center text-white p-6 z-20 backdrop-blur-md animate-in fade-in zoom-in">
                <Star size={64} className="mb-4 text-white fill-white animate-pulse" />
                <h2 className="text-4xl font-black mb-2">ALL CLEARED!</h2>
                <p className="mb-6 font-bold">Total Score: {totalScore}</p>
                <Button onClick={onGameOver} className="w-full max-w-xs py-4 text-lg bg-white text-yellow-600 hover:bg-gray-100">
                    Back to Menu
                </Button>
            </div>
        )}

      </div>

      <div className="flex gap-4 w-full max-w-md">
          {gameState === 'DRAWING' ? (
              <>
                <button 
                    onClick={clearLines}
                    className="flex-1 bg-white border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                    <Eraser size={20} /> 清除
                </button>
                <button 
                    onClick={startSimulation}
                    className="flex-[2] bg-green-500 hover:bg-green-400 text-white font-black py-3 rounded-xl shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                    <ShieldCheck size={20} /> 保护狗头!
                </button>
              </>
          ) : (
              <div className="h-14"></div>
          )}
      </div>
      
      <p className="text-xs text-neutral-400 text-center max-w-xs leading-relaxed">
         ⚠️ <span className="font-bold">注意虚空！</span> 掉落屏幕下方算失败。<br/>
         确保线条接地，利用物理特性防止被推落。
      </p>
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { Play, RotateCcw, Layers, Trophy, Shuffle, Zap } from 'lucide-react';

interface BeeTileMatchProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Tile Types (Emojis/Icons)
const TILE_TYPES = ['🐶', '🐝', '🍯', '💎', '🚀', '🐻'];
const TILE_COLORS = {
  '🐶': '#fef3c7', // Yellow-100
  '🐝': '#fef9c3', // Yellow-50
  '🍯': '#ffedd5', // Orange-100
  '💎': '#dbeafe', // Blue-100
  '🚀': '#fee2e2', // Red-100
  '🐻': '#f5f5f4', // Stone-100
};

interface Tile {
  id: string;
  type: string;
  x: number;
  y: number;
  layer: number; // Higher is on top
  isClickable: boolean;
  status: 'board' | 'bar' | 'cleared';
  zIndex: number;
}

export const BeeTileMatch: React.FC<BeeTileMatchProps> = ({ userProfile, onGameOver }) => {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'WON' | 'GAME_OVER'>('START');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [bar, setBar] = useState<Tile[]>([]);
  const [score, setScore] = useState(0); // Score tracks cleared sets
  const [level, setLevel] = useState(1);
  const [history, setHistory] = useState<string[]>([]); // For Undo (simple version, maybe later)
  
  // Game Config
  const TILE_SIZE = 48; // Size in px
  const BOARD_WIDTH = 320;
  const BOARD_HEIGHT = 360; // Area for tiles
  const BAR_CAPACITY = 7;

  // Initialize Level
  const initLevel = (difficulty: number) => {
    // 1. Determine number of sets
    // Easy: 12 sets (36 tiles), Hard: 30 sets (90 tiles)
    const sets = difficulty === 1 ? 12 : 15 + (difficulty * 5);
    const totalTiles = sets * 3;
    
    // 2. Create Tile Pool
    let pool: string[] = [];
    for (let i = 0; i < sets; i++) {
        // Pick random type
        const type = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
        pool.push(type, type, type); // Add 3 of same type
    }
    // Shuffle pool
    pool = pool.sort(() => Math.random() - 0.5);

    // 3. Generate Positions (Layers)
    const newTiles: Tile[] = [];
    
    // Pattern generation strategy:
    // Define grid slots (6x6 grid approx for 320px width)
    const cols = 6;
    const rows = 6;
    const offsetX = (BOARD_WIDTH - (cols * TILE_SIZE)) / 2;
    const offsetY = 20;

    // Layer 0: Base Grid
    // Layer 1: Offset Grid
    // Layer 2: Pyramid center
    // ...
    
    let tileIdx = 0;
    let layer = 0;
    
    while (tileIdx < totalTiles) {
        // Decide pattern for this layer
        const patternType = Math.floor(Math.random() * 3);
        
        if (patternType === 0) {
            // Full Grid (Sparse)
            for (let r = 0; r < rows && tileIdx < totalTiles; r++) {
                for (let c = 0; c < cols && tileIdx < totalTiles; c++) {
                    if (Math.random() > 0.4) {
                        newTiles.push({
                            id: `t-${tileIdx}`,
                            type: pool[tileIdx],
                            x: offsetX + c * TILE_SIZE,
                            y: offsetY + r * TILE_SIZE,
                            layer: layer,
                            isClickable: true,
                            status: 'board',
                            zIndex: layer
                        });
                        tileIdx++;
                    }
                }
            }
        } else if (patternType === 1) {
            // Offset Grid (Brick wall style)
            for (let r = 0; r < rows - 1 && tileIdx < totalTiles; r++) {
                for (let c = 0; c < cols - 1 && tileIdx < totalTiles; c++) {
                    if (Math.random() > 0.4) {
                        newTiles.push({
                            id: `t-${tileIdx}`,
                            type: pool[tileIdx],
                            x: offsetX + c * TILE_SIZE + TILE_SIZE/2,
                            y: offsetY + r * TILE_SIZE + TILE_SIZE/2,
                            layer: layer,
                            isClickable: true,
                            status: 'board',
                            zIndex: layer
                        });
                        tileIdx++;
                    }
                }
            }
        } else {
            // Center Concentrated
            const centerR = rows / 2;
            const centerC = cols / 2;
            // Spiral or random around center
            for (let i = 0; i < 8 && tileIdx < totalTiles; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * (TILE_SIZE * 2);
                newTiles.push({
                    id: `t-${tileIdx}`,
                    type: pool[tileIdx],
                    x: offsetX + centerC * TILE_SIZE + Math.cos(angle) * dist - TILE_SIZE/2,
                    y: offsetY + centerR * TILE_SIZE + Math.sin(angle) * dist - TILE_SIZE/2,
                    layer: layer,
                    isClickable: true,
                    status: 'board',
                    zIndex: layer
                });
                tileIdx++;
            }
        }
        
        layer++;
    }

    // Recalculate blockage immediately
    updateClickability(newTiles);
    setTiles(newTiles);
    setBar([]);
    setGameState('PLAYING');
  };

  const updateClickability = (currentTiles: Tile[]) => {
    // A tile is clickable if NO other tile in a higher layer overlaps it
    // Overlap condition: abs(x1 - x2) < size && abs(y1 - y2) < size
    
    // Optimization: Sort by layer desc to check from top
    // Actually, simple O(N^2) is fine for < 100 items.
    
    const boardTiles = currentTiles.filter(t => t.status === 'board');
    
    boardTiles.forEach(t1 => {
        let blocked = false;
        for (const t2 of boardTiles) {
            if (t2.layer > t1.layer) { // Only higher layers block lower
                const overlapX = Math.abs(t1.x - t2.x) < TILE_SIZE; // Simple box intersection
                const overlapY = Math.abs(t1.y - t2.y) < TILE_SIZE;
                if (overlapX && overlapY) {
                    blocked = true;
                    break;
                }
            }
        }
        t1.isClickable = !blocked;
    });
  };

  const handleTileClick = (clickedTile: Tile) => {
    if (gameState !== 'PLAYING' || !clickedTile.isClickable) return;

    if (bar.length >= BAR_CAPACITY) {
        // Bar full animation shake?
        return;
    }
    
    audio.playStep(); // Click sound

    // 1. Move to Bar
    const updatedTiles = tiles.map(t => 
        t.id === clickedTile.id ? { ...t, status: 'bar' as const } : t
    );
    
    // 2. Recalculate blockage on remaining board tiles
    updateClickability(updatedTiles);
    setTiles(updatedTiles);

    // 3. Logic for Bar Placement
    // Find where to insert in bar (group by type)
    // We want to insert next to same type if exists
    const currentBar = [...bar];
    let insertIndex = currentBar.length; // Default append
    
    // Find index of last tile of same type
    for (let i = currentBar.length - 1; i >= 0; i--) {
        if (currentBar[i].type === clickedTile.type) {
            insertIndex = i + 1;
            break;
        }
    }
    
    const newBar = [
        ...currentBar.slice(0, insertIndex),
        { ...clickedTile, status: 'bar' as const },
        ...currentBar.slice(insertIndex)
    ];
    setBar(newBar);

    // 4. Check Matches (after short delay for visual?)
    // Let's do instant check for responsiveness, maybe animate clear
    checkForMatch(newBar);
  };

  const checkForMatch = (currentBar: Tile[]) => {
    // Count types
    const counts: {[key: string]: number} = {};
    currentBar.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    let matchType: string | null = null;
    for (const type in counts) {
        if (counts[type] >= 3) {
            matchType = type;
            break;
        }
    }

    if (matchType) {
        // Remove 3 matching tiles
        setTimeout(() => {
            const tilesToRemove: string[] = [];
            let removedCount = 0;
            
            const nextBar = currentBar.filter(t => {
                if (t.type === matchType && removedCount < 3) {
                    tilesToRemove.push(t.id);
                    removedCount++;
                    return false;
                }
                return true;
            });
            
            audio.playScore(); // Match sound
            setBar(nextBar);
            setScore(prev => prev + 1); // +1 set cleared
            
            // Mark as cleared in main list (for win check)
            setTiles(prev => prev.map(t => tilesToRemove.includes(t.id) ? { ...t, status: 'cleared' } : t));
            
            // Check Win (All cleared)
            // Need to check state after this update... relying on updatedTiles logic
            // Since setTiles is async, we can check bar emptiness + board emptiness next render
            // Or calculate now:
            const remainingOnBoard = tiles.filter(t => t.status === 'board').length; 
            // Note: tiles here is stale closure "tiles" before handleTileClick? No, handleTileClick updated it?
            // Actually complex state sync. Let's use useEffect for Win/Loss check.
        }, 200); // Small delay for player to see the 3rd tile land
    } else {
        // No match, check Game Over
        if (currentBar.length >= BAR_CAPACITY) {
            audio.playGameOver();
            setGameState('GAME_OVER');
        }
    }
  };

  // Win/Loss Check Effect
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const remainingBoard = tiles.filter(t => t.status === 'board').length;
    const remainingBar = bar.length;
    
    if (remainingBoard === 0 && remainingBar === 0 && score > 0) {
        setGameState('WON');
        if (userProfile) {
            saveHighScore(userProfile, 'bee_match', score * 100);
            onGameOver();
        }
    }
  }, [tiles, bar, score]); // Dependency on state updates

  const shuffleBoard = () => {
      // Cheat/Tool: Shuffle remaining board tiles positions
      // Get all board tiles
      const boardTiles = tiles.filter(t => t.status === 'board');
      if (boardTiles.length === 0) return;

      // Shuffle positions (x, y, layer, zIndex)
      const positions = boardTiles.map(t => ({ x: t.x, y: t.y, layer: t.layer, zIndex: t.zIndex }));
      // Fisher-Yates shuffle positions
      for (let i = positions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      // Assign new positions to tiles
      const newTiles = tiles.map(t => {
          if (t.status === 'board') {
              const pos = positions.pop()!;
              return { ...t, x: pos.x, y: pos.y, layer: pos.layer, zIndex: pos.zIndex };
          }
          return t;
      });

      updateClickability(newTiles);
      setTiles(newTiles);
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[320/520] bg-green-50 rounded-xl overflow-hidden shadow-2xl border-4 border-green-600 select-none">
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" 
           style={{backgroundImage: 'radial-gradient(#15803d 2px, transparent 2px)', backgroundSize: '20px 20px'}}>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full h-16 bg-green-600 flex items-center justify-between px-4 shadow-md z-10">
         <div className="text-white font-black text-xl flex items-center gap-2">
            <Layers /> 第 {level} 关
         </div>
         <div className="bg-green-700/50 px-3 py-1 rounded-full text-white font-mono font-bold border border-green-500">
            Score: {score}
         </div>
      </div>

      {/* Game Area */}
      <div className="absolute top-16 left-0 w-full h-[360px] overflow-hidden">
         {tiles.map(tile => (
             tile.status === 'board' && (
                 <div
                    key={tile.id}
                    onClick={() => handleTileClick(tile)}
                    className={`absolute w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl shadow-sm transition-all duration-300 cursor-pointer 
                        ${tile.isClickable 
                            ? 'bg-white border-green-200 hover:-translate-y-1 hover:shadow-md' 
                            : 'bg-gray-300 border-gray-400 opacity-60 cursor-not-allowed grayscale'
                        }`}
                    style={{
                        left: tile.x,
                        top: tile.y,
                        zIndex: tile.zIndex,
                        backgroundColor: tile.isClickable ? (TILE_COLORS[tile.type as keyof typeof TILE_COLORS] || 'white') : '#e5e5e5',
                        // Add shadow based on layer to simulate depth
                        boxShadow: `0 ${2 + tile.layer}px ${4 + tile.layer}px rgba(0,0,0,0.2)`
                    }}
                 >
                    {tile.type}
                 </div>
             )
         ))}
      </div>

      {/* Control Bar (Tools) */}
      <div className="absolute bottom-[80px] w-full flex justify-center gap-4 px-4 pointer-events-none">
          {/* Only show tools in playing state */}
          {gameState === 'PLAYING' && (
              <button 
                onClick={shuffleBoard} 
                className="pointer-events-auto bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-400 active:scale-95 transition-all flex flex-col items-center gap-1 border-2 border-blue-600"
                title="洗牌"
              >
                 <Shuffle size={20} />
              </button>
          )}
      </div>

      {/* Collection Bar Area */}
      <div className="absolute bottom-0 w-full h-20 bg-[#854d0e] border-t-4 border-[#a16207] flex items-center justify-center gap-2 px-2 shadow-inner">
          {/* Slots */}
          <div className="flex gap-1 p-2 bg-[#451a03] rounded-xl border-2 border-[#78350f] shadow-inner">
             {Array.from({ length: BAR_CAPACITY }).map((_, idx) => {
                 const tile = bar[idx];
                 return (
                     <div key={idx} className="w-10 h-10 bg-[#2a1205] rounded-md border border-[#5c2809] flex items-center justify-center relative">
                        {tile && (
                            <div className="w-full h-full bg-white rounded-md border-2 border-green-200 flex items-center justify-center text-xl animate-in fade-in zoom-in duration-200 shadow-md"
                                 style={{ backgroundColor: TILE_COLORS[tile.type as keyof typeof TILE_COLORS] }}>
                                {tile.type}
                            </div>
                        )}
                     </div>
                 );
             })}
          </div>
      </div>

      {/* Start Screen - Lowered z-index to avoid blocking navbar */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 z-30 backdrop-blur-sm">
          <div className="text-5xl font-black mb-2 text-green-400 drop-shadow-lg text-center">Bee Match<br/><span className="text-2xl text-white">消消乐</span></div>
          <p className="mb-8 font-bold text-center text-neutral-200 text-sm leading-relaxed max-w-[240px]">
            点击三个相同的图案消除<br/>
            <span className="text-yellow-400">注意观察</span> 被遮挡的牌<br/>
            卡槽满7张则失败！
          </p>
          <Button onClick={() => initLevel(level)} className="animate-bounce shadow-xl scale-110 bg-green-500 hover:bg-green-400 border-none text-white font-black px-10 py-4 text-xl">
             <Play className="mr-2 fill-current" /> 开始挑战
          </Button>
        </div>
      )}

      {/* Won Screen - Lowered z-index */}
      {gameState === 'WON' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 z-30 animate-in fade-in zoom-in">
          <Trophy size={64} className="text-yellow-400 mb-4 animate-bounce" />
          <div className="text-4xl font-black mb-2 text-white">YOU WIN!</div>
          <p className="mb-6 text-green-300 font-bold">蜜蜂狗为你点赞！</p>
          <Button onClick={() => { setLevel(level + 1); initLevel(level + 1); }} className="w-full mb-3 py-4 text-lg">
             <Play className="mr-2" /> 下一关 (Lv.{level+1})
          </Button>
        </div>
      )}

      {/* Game Over Screen - Lowered z-index */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white p-6 z-30 animate-in fade-in zoom-in">
          <div className="text-4xl font-black mb-6 text-red-500">卡槽满了! 😭</div>
          
          <div className="bg-[#1f2937] border border-[#374151] rounded-2xl p-8 w-full mb-8 flex flex-col items-center shadow-2xl">
             <div className="text-xs text-neutral-500 uppercase font-bold mb-1 tracking-[0.2em]">Sets Cleared</div>
             <div className="text-6xl font-black text-green-400 font-mono tracking-tighter">{score}</div>
          </div>

          <Button onClick={() => initLevel(level)} className="w-full mb-3 py-4 text-lg bg-white text-black hover:bg-neutral-200 border-none font-bold">
             <RotateCcw className="mr-2" /> 重新开始
          </Button>
        </div>
      )}

    </div>
  );
};

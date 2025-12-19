
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit, updateFishingData, RodItem } from '../../services/userService';
import { saveHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import { ArrowLeft, ShoppingBag, BookOpen, Lock, Loader2, DollarSign, X, Anchor, Book, Battery, Zap } from 'lucide-react';

interface HoneyFishingProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
  onLoginRequest: () => void;
}

// ==========================================
// 🎮 游戏配置区域 (Game Configuration)
// ==========================================

// 角色贴图
const CHAR_SPRITE_URL = "https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/game%2F2%2FWilly..png?alt=media&token=4bf86376-e5f4-4177-b72e-6a1a9492e46e";

// 鱼竿配置
// Durability: # of catches before breaking
// Luck: Reduces wait time & Increases rare fish chance
const RODS = [
    { id: 0, name: "竹竿 (Bamboo)", barSize: 45, price: 50, color: "#d4a373", durability: 50, luck: 0 }, 
    { id: 1, name: "玻纤竿 (Fiberglass)", barSize: 60, price: 500, color: "#60a5fa", durability: 50, luck: 5 }, 
    { id: 2, name: "铱金竿 (Iridium)", barSize: 80, price: 2000, color: "#a855f7", durability: 100, luck: 15 } 
];

// 经验值公式: Level N -> N+1 需要的XP
const getXpForNextLevel = (level: number) => Math.floor(100 * Math.pow(1.1, level - 1));

// 计算总经验值 (用于排行榜)
// 公式: Σ(1到当前等级-1 的升级所需经验) + 当前持有经验
const calculateTotalXp = (level: number, currentXp: number) => {
    let total = 0;
    for (let l = 1; l < level; l++) {
        total += getXpForNextLevel(l);
    }
    return Math.floor(total + currentXp);
};

// 50种鱼类图鉴
const FISH_TYPES = [
    // Level 1-5 (Basic)
    { id: 0, name: "太阳鱼 (Sunfish)", price: 30, difficulty: 0.5, weight: 100, unlockLevel: 1, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/5/56/Sunfish.png", moveType: 'mixed' },
    { id: 1, name: "鲤鱼 (Carp)", price: 30, difficulty: 0.3, weight: 100, unlockLevel: 1, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/a/a8/Carp.png", moveType: 'mixed' },
    { id: 2, name: "鳀鱼 (Anchovy)", price: 30, difficulty: 0.5, weight: 90, unlockLevel: 2, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/7/79/Anchovy.png", moveType: 'dart' },
    { id: 3, name: "鲱鱼 (Herring)", price: 30, difficulty: 0.5, weight: 90, unlockLevel: 2, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/f/f1/Herring.png", moveType: 'dart' },
    { id: 4, name: "沙丁鱼 (Sardine)", price: 40, difficulty: 0.8, weight: 80, unlockLevel: 3, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/04/Sardine.png", moveType: 'dart' },
    { id: 5, name: "西鲱 (Shad)", price: 60, difficulty: 1.0, weight: 70, unlockLevel: 4, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/e/ef/Shad.png", moveType: 'smooth' },
    { id: 6, name: "小嘴鲈鱼 (Smallmouth)", price: 50, difficulty: 1.0, weight: 70, unlockLevel: 5, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/a/a5/Smallmouth_Bass.png", moveType: 'mixed' },
    
    // Level 6-15 (Intermediate)
    { id: 7, name: "大嘴鲈鱼 (Largemouth)", price: 100, difficulty: 1.5, weight: 60, unlockLevel: 6, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/1/11/Largemouth_Bass.png", moveType: 'mixed' },
    { id: 8, name: "虹鳟鱼 (Rainbow Trout)", price: 65, difficulty: 1.2, weight: 60, unlockLevel: 7, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/1/14/Rainbow_Trout.png", moveType: 'mixed' },
    { id: 9, name: "鲑鱼 (Salmon)", price: 75, difficulty: 1.5, weight: 50, unlockLevel: 8, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/e/e0/Salmon.png", moveType: 'mixed' },
    { id: 10, name: "金枪鱼 (Tuna)", price: 100, difficulty: 2.0, weight: 50, unlockLevel: 9, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/c/c5/Tuna.png", moveType: 'smooth' },
    { id: 11, name: "大比目鱼 (Halibut)", price: 80, difficulty: 1.8, weight: 50, unlockLevel: 10, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/02/Halibut.png", moveType: 'sinker' },
    { id: 12, name: "红鲷鱼 (Red Snapper)", price: 50, difficulty: 1.5, weight: 50, unlockLevel: 11, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/d/d3/Red_Snapper.png", moveType: 'mixed' },
    { id: 13, name: "罗非鱼 (Tilapia)", price: 75, difficulty: 1.8, weight: 45, unlockLevel: 12, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/7/73/Tilapia.png", moveType: 'mixed' },
    { id: 14, name: "鳗鱼 (Eel)", price: 85, difficulty: 2.2, weight: 40, unlockLevel: 13, icon: "🐍", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/9/91/Eel.png", moveType: 'smooth' },
    { id: 15, name: "鲷鱼 (Bream)", price: 45, difficulty: 1.2, weight: 60, unlockLevel: 14, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/82/Bream.png", moveType: 'smooth' },
    { id: 16, name: "梭子鱼 (Pike)", price: 100, difficulty: 2.0, weight: 40, unlockLevel: 15, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/3/31/Pike.png", moveType: 'dart' },

    // Level 16-30 (Advanced)
    { id: 17, name: "大头鱼 (Bullhead)", price: 75, difficulty: 2.5, weight: 35, unlockLevel: 16, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/d/db/Bullhead.png", moveType: 'smooth' },
    { id: 18, name: "鲢鱼 (Chub)", price: 50, difficulty: 1.5, weight: 50, unlockLevel: 17, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/b/bd/Chub.png", moveType: 'dart' },
    { id: 19, name: "大眼鱼 (Walleye)", price: 105, difficulty: 2.5, weight: 35, unlockLevel: 18, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/05/Walleye.png", moveType: 'smooth' },
    { id: 20, name: "鬼头鱼 (Ghostfish)", price: 45, difficulty: 2.0, weight: 40, unlockLevel: 19, icon: "👻", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/7/72/Ghostfish.png", moveType: 'mixed' },
    { id: 21, name: "河豚 (Pufferfish)", price: 200, difficulty: 3.5, weight: 25, unlockLevel: 20, icon: "🐡", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/b/ba/Pufferfish.png", moveType: 'floater' },
    { id: 22, name: "鱿鱼 (Squid)", price: 80, difficulty: 3.0, weight: 30, unlockLevel: 21, icon: "🦑", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/81/Squid.png", moveType: 'sinker' },
    { id: 23, name: "海参 (Sea Cucumber)", price: 75, difficulty: 1.5, weight: 40, unlockLevel: 22, icon: "🥒", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/a/a9/Sea_Cucumber.png", moveType: 'sinker' },
    { id: 24, name: "超海参 (Super Cucumber)", price: 250, difficulty: 3.5, weight: 15, unlockLevel: 23, icon: "🥒", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/d/d5/Super_Cucumber.png", moveType: 'sinker' },
    { id: 25, name: "木跃鱼 (Woodskip)", price: 75, difficulty: 2.0, weight: 30, unlockLevel: 24, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/9/97/Woodskip.png", moveType: 'mixed' },
    { id: 26, name: "鲶鱼 (Catfish)", price: 200, difficulty: 3.0, weight: 20, unlockLevel: 25, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/9/99/Catfish.png", moveType: 'mixed' },
    { id: 27, name: "狗鱼 (Lingcod)", price: 120, difficulty: 3.5, weight: 20, unlockLevel: 26, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/87/Lingcod.png", moveType: 'mixed' },
    { id: 28, name: "大比目鱼 (Flounder)", price: 100, difficulty: 2.0, weight: 35, unlockLevel: 27, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/85/Flounder.png", moveType: 'sinker' },
    { id: 29, name: "午夜鲤鱼 (Midnight Carp)", price: 150, difficulty: 2.5, weight: 25, unlockLevel: 28, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/e/ec/Midnight_Carp.png", moveType: 'mixed' },
    { id: 30, name: "鲟鱼 (Sturgeon)", price: 200, difficulty: 4.0, weight: 15, unlockLevel: 29, icon: "🦈", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/4/42/Sturgeon.png", moveType: 'mixed' },
    
    // Level 31-45 (Expert)
    { id: 31, name: "虎纹鳟鱼 (Tiger Trout)", price: 150, difficulty: 3.0, weight: 20, unlockLevel: 30, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/01/Tiger_Trout.png", moveType: 'dart' },
    { id: 32, name: "青花鱼 (Albacore)", price: 75, difficulty: 3.0, weight: 25, unlockLevel: 31, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/e/e1/Albacore.png", moveType: 'mixed' },
    { id: 33, name: "多莉鱼 (Dorado)", price: 100, difficulty: 3.0, weight: 20, unlockLevel: 32, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/1/18/Dorado.png", moveType: 'mixed' },
    { id: 34, name: "岩鱼 (Stonefish)", price: 300, difficulty: 3.5, weight: 10, unlockLevel: 33, icon: "🪨", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/03/Stonefish.png", moveType: 'sinker' },
    { id: 35, name: "冰柱鱼 (Ice Pip)", price: 500, difficulty: 4.0, weight: 8, unlockLevel: 34, icon: "❄️", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/6/63/Ice_Pip.png", moveType: 'dart' },
    { id: 36, name: "岩浆鳗鱼 (Lava Eel)", price: 700, difficulty: 4.5, weight: 5, unlockLevel: 35, icon: "🔥", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/1/12/Lava_Eel.png", moveType: 'mixed' },
    { id: 37, name: "沙鱼 (Sandfish)", price: 75, difficulty: 3.0, weight: 20, unlockLevel: 36, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/b/bb/Sandfish.png", moveType: 'mixed' },
    { id: 38, name: "蝎鲤 (Scorpion Carp)", price: 150, difficulty: 4.0, weight: 10, unlockLevel: 37, icon: "🦂", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/7/76/Scorpion_Carp.png", moveType: 'dart' },
    { id: 39, name: "比目鱼 (Halibut)", price: 80, difficulty: 2.0, weight: 30, unlockLevel: 38, icon: "🐟", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/0/02/Halibut.png", moveType: 'sinker' },
    { id: 40, name: "虚空鲑鱼 (Void Salmon)", price: 150, difficulty: 3.5, weight: 15, unlockLevel: 39, icon: "🌑", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/a/ad/Void_Salmon.png", moveType: 'mixed' },
    { id: 41, name: "史莱姆鱼 (Slimejack)", price: 100, difficulty: 3.0, weight: 20, unlockLevel: 40, icon: "🟢", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/3/34/Slimejack.png", moveType: 'dart' },
    { id: 42, name: "午夜鱿鱼 (Midnight Squid)", price: 100, difficulty: 3.0, weight: 20, unlockLevel: 41, icon: "🦑", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/83/Midnight_Squid.png", moveType: 'sinker' },
    { id: 43, name: "幽灵鱼 (Spook Fish)", price: 220, difficulty: 3.5, weight: 10, unlockLevel: 42, icon: "👻", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/8/8c/Spook_Fish.png", moveType: 'dart' },
    { id: 44, name: "水滴鱼 (Blobfish)", price: 500, difficulty: 3.0, weight: 8, unlockLevel: 43, icon: "💧", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/7/7f/Blobfish.png", moveType: 'floater' },
    
    // Level 46-50 (Legendary)
    { id: 45, name: "变种鲤鱼 (Mutant Carp)", price: 1000, difficulty: 5.0, weight: 5, unlockLevel: 45, icon: "☣️", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/c/cb/Mutant_Carp.png", moveType: 'dart' },
    { id: 46, name: "安康鱼 (Angler)", price: 900, difficulty: 4.5, weight: 5, unlockLevel: 46, icon: "🔦", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/b/bf/Angler.png", moveType: 'smooth' },
    { id: 47, name: "冰川鱼 (Glacierfish)", price: 1000, difficulty: 5.0, weight: 3, unlockLevel: 47, icon: "🧊", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/f/fd/Glacierfish.png", moveType: 'mixed' },
    { id: 48, name: "绯红鱼 (Crimsonfish)", price: 1500, difficulty: 5.0, weight: 3, unlockLevel: 48, icon: "🔴", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/d/dc/Crimsonfish.png", moveType: 'mixed' },
    { id: 49, name: "传说之鱼 (Legend)", price: 5000, difficulty: 6.0, weight: 1, unlockLevel: 50, icon: "👑", imageUrl: "https://stardewvalleywiki.com/mediawiki/images/1/10/Legend.png", moveType: 'dart' },
];

const BAIT_PRICE = 2; // Price per single bait

type FishingPhase = 'IDLE' | 'CHARGING' | 'CASTING' | 'WAITING' | 'BITE' | 'MINIGAME' | 'CAUGHT' | 'MISSED';

export const HoneyFishing: React.FC<HoneyFishingProps> = ({ userProfile, onGameOver, onLoginRequest }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishImagesRef = useRef<Record<number, HTMLImageElement>>({});
  
  // UI States
  const [view, setView] = useState<'SCENE' | 'INVENTORY' | 'SHOP' | 'POKEDEX'>('SCENE');
  const [phase, setPhase] = useState<FishingPhase>('IDLE');
  
  // Data States
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  
  const [inventory, setInventory] = useState<{ id: string, typeId: number, name: string, price: number, rarity: number }[]>([]);
  const [unlockedFish, setUnlockedFish] = useState<number[]>([]);
  const [rodLevel, setRodLevel] = useState(0); // Legacy: used for visual determination if activeRodId missing
  const [baitCount, setBaitCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  
  // New States for Features
  const [ownedRods, setOwnedRods] = useState<RodItem[]>([]);
  const [activeRodId, setActiveRodId] = useState<string>('starter');
  const [buyBaitAmount, setBuyBaitAmount] = useState<number>(5);
  
  // Game Logic States
  const [chargePower, setChargePower] = useState(0); 
  const [bobberDist, setBobberDist] = useState(0);   
  const chargeRef = useRef({ dir: 1, val: 0 });      
  const requestRef = useRef<number>(0);              
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Minigame Ref
  const gameRef = useRef({
      fishPos: 50,       
      fishVelocity: 0,   
      fishTarget: 50,    
      fishMoveTimer: 0,  
      barPos: 80,        
      barVelocity: 0,    
      progress: 30,      
      currentFishId: 0,
      barSize: 20,
      difficulty: 1,
      moveType: 'mixed',
      isRunning: false,
      isMouseDown: false,
      animationId: 0,
      lastFrameTime: 0
  });

  useEffect(() => {
      if (userProfile?.fishingData) {
          setInventory(userProfile.fishingData.inventory || []);
          setRodLevel(userProfile.fishingData.rodLevel || 0);
          setBaitCount(userProfile.fishingData.baitCount || 0);
          setLevel(userProfile.fishingData.level || 1);
          setXp(userProfile.fishingData.xp || 0);
          setUnlockedFish(userProfile.fishingData.unlockedFish || []);
          
          // Load new data structures
          // Default start durability set to 50
          setOwnedRods(userProfile.fishingData.rods || [{ id: 'starter', typeId: 0, durability: 50, maxDurability: 50 }]);
          setActiveRodId(userProfile.fishingData.activeRodId || 'starter');
      }
      setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
      FISH_TYPES.forEach(fish => {
          const img = new Image();
          img.src = fish.imageUrl;
          fishImagesRef.current[fish.id] = img;
      });
  }, []);

  // --- LOOP MANAGEMENT ---
  useEffect(() => {
      if (phase === 'CHARGING') {
          chargeRef.current.val = 0;
          chargeRef.current.dir = 1;
          setChargePower(0);

          const chargeLoop = () => {
              let next = chargeRef.current.val + (2 * chargeRef.current.dir); 
              if (next >= 100) { next = 100; chargeRef.current.dir = -1; }
              if (next <= 0) { next = 0; chargeRef.current.dir = 1; }
              
              chargeRef.current.val = next;
              setChargePower(next); 
              requestRef.current = requestAnimationFrame(chargeLoop);
          };
          requestRef.current = requestAnimationFrame(chargeLoop);
      } else {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [phase]);

  // --- MINIGAME LOOP ---
  useEffect(() => {
      if (phase === 'MINIGAME') {
          // Get current rod stats
          const currentRod = ownedRods.find(r => r.id === activeRodId) || ownedRods[0];
          const rodType = RODS[currentRod.typeId];
          
          // Filter available fish based on user Level
          const availableFish = FISH_TYPES.filter(f => f.unlockLevel <= level);
          
          // Luck influence on Rarity (Price)
          // Higher luck = higher chance for expensive fish
          const luck = rodType.luck;
          
          const totalWeight = availableFish.reduce((acc, f) => {
              // Weight formula: Base weight + Luck Bonus for Expensive fish
              let weight = f.weight;
              if (f.price > 100) {
                  weight += luck * 5; // Boost expensive fish weight by luck
              }
              return acc + weight;
          }, 0);

          let rand = Math.random() * totalWeight;
          let selectedFish = availableFish[0] || FISH_TYPES[0];
          
          for (const fish of availableFish) {
              let weight = fish.weight;
              if (fish.price > 100) weight += luck * 5;
              
              rand -= weight;
              if (rand <= 0) {
                  selectedFish = fish;
                  break;
              }
          }

          // Difficulty scaling based on Price
          // Cheap fish (30g) -> factor 0.15. Expensive (5000g) -> factor 25.
          const priceFactor = selectedFish.price / 200; 

          gameRef.current = {
              ...gameRef.current,
              fishPos: 80,
              fishVelocity: 0,
              fishTarget: 80,
              fishMoveTimer: 0,
              barPos: 85, 
              barVelocity: 0,
              progress: 30, 
              currentFishId: selectedFish.id,
              barSize: rodType.barSize / 3, // Normalized bar size 
              difficulty: 0.5 + priceFactor, // Base + Price Scaling
              moveType: selectedFish.moveType as any,
              isRunning: true,
              lastFrameTime: performance.now()
          };
          
          gameLoop();
      }
      return () => {
          cancelAnimationFrame(gameRef.current.animationId);
      };
  }, [phase, level]); 

  const showNotif = (msg: string, type: 'success' | 'error' | 'info') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 2000);
  };

  const saveProgress = async (
      newInv?: any[], 
      newRod?: RodItem[], 
      newBait?: number, 
      newXp?: number, 
      newLevel?: number, 
      newUnlockedFish?: number[],
      newActiveRodId?: string
  ) => {
      if (!userProfile) return;
      const data: any = {
          inventory: newInv !== undefined ? newInv : inventory,
          rods: newRod !== undefined ? newRod : ownedRods,
          baitCount: newBait !== undefined ? newBait : baitCount,
          xp: newXp !== undefined ? newXp : xp,
          level: newLevel !== undefined ? newLevel : level,
          unlockedFish: newUnlockedFish !== undefined ? newUnlockedFish : unlockedFish,
          activeRodId: newActiveRodId !== undefined ? newActiveRodId : activeRodId
      };
      
      // Legacy field update for visuals if needed (rodLevel)
      // Find current active rod type
      const activeRod = (data.rods || []).find((r: any) => r.id === data.activeRodId);
      if (activeRod) data.rodLevel = activeRod.typeId;

      if (newInv) setInventory(newInv);
      if (newRod !== undefined) setOwnedRods(newRod);
      if (newBait !== undefined) setBaitCount(newBait);
      if (newXp !== undefined) setXp(newXp);
      if (newLevel !== undefined) setLevel(newLevel);
      if (newUnlockedFish !== undefined) setUnlockedFish(newUnlockedFish);
      if (newActiveRodId !== undefined) setActiveRodId(newActiveRodId);
      
      await updateFishingData(userProfile.uid, data);
      await refreshProfile();
  };

  // --- INTERACTIONS ---

  const startMiniGame = () => {
      setPhase('MINIGAME');
  };

  const handleActionDown = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault(); 
      if (!userProfile) { onLoginRequest(); return; }
      
      // 1. Minigame Control (Global)
      if (phase === 'MINIGAME') {
          gameRef.current.isMouseDown = true;
          audio.playStep();
          return;
      }

      if (phase === 'IDLE') {
          if (baitCount <= 0) { showNotif("缺少鱼饵! 请去商店购买", 'error'); return; }
          
          // Check Rod Durability
          const currentRod = ownedRods.find(r => r.id === activeRodId);
          if (!currentRod || currentRod.durability <= 0) {
              showNotif("鱼竿已损坏! 请去背包切换或商店购买", 'error');
              return;
          }

          setPhase('CHARGING');
      } else if (phase === 'WAITING') {
          cancelFishing("太早了!"); 
      } else if (phase === 'BITE') {
          startMiniGame(); 
      }
  };

  const handleActionUp = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();

      // 1. Minigame Control (Global)
      if (phase === 'MINIGAME') {
          gameRef.current.isMouseDown = false;
          return;
      }

      if (phase === 'CHARGING') {
          const finalPower = chargeRef.current.val;
          // Optimistically update bait
          setBaitCount(prev => prev - 1);
          saveProgress(undefined, undefined, baitCount - 1); 
          
          setPhase('CASTING');
          setBobberDist(20 + (finalPower / 100) * 80); 
          audio.playShoot(); 

          setTimeout(() => {
              setPhase('WAITING');
              startWaiting();
          }, 500);
      }
  };

  const startWaiting = () => {
      // Calculate Wait Time based on Luck
      const currentRod = ownedRods.find(r => r.id === activeRodId) || ownedRods[0];
      const rodType = RODS[currentRod.typeId];
      const luck = rodType.luck;

      // Base max wait is 60s. Luck reduces max wait by 2s per point. Min 5s.
      const maxWait = Math.max(5000, 60000 - (luck * 2000)); 
      const minWait = 2000;
      
      const waitTime = minWait + Math.random() * (maxWait - minWait);
      
      waitTimerRef.current = setTimeout(() => {
          setPhase('BITE');
          audio.playScore(); 
          if (navigator.vibrate) navigator.vibrate(200);
          
          biteTimerRef.current = setTimeout(() => {
              if (phase === 'BITE') { 
                  cancelFishing("鱼跑了...");
              }
          }, 1200); 
      }, waitTime);
  };

  const cancelFishing = (reason: string) => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      if (biteTimerRef.current) clearTimeout(biteTimerRef.current);
      
      setPhase('MISSED');
      showNotif(reason, 'error');
      setTimeout(() => setPhase('IDLE'), 1000);
  };

  // --- MINIGAME LOGIC ---

  const handleMiniGameCatch = () => {
      gameRef.current.isRunning = false;
      cancelAnimationFrame(gameRef.current.animationId);
      audio.playScore();
      
      const fishType = FISH_TYPES[gameRef.current.currentFishId];
      const newFish = {
          id: Date.now().toString(),
          typeId: fishType.id,
          name: fishType.name,
          price: fishType.price,
          rarity: fishType.difficulty
      };
      
      // Update Inventory
      const newInv = [...inventory, newFish];
      
      // Unlock Fish in Pokedex if new
      let newUnlocked = [...unlockedFish];
      if (!newUnlocked.includes(fishType.id)) {
          newUnlocked.push(fishType.id);
      }

      // XP Logic
      let xpGain = Math.floor(fishType.price * 0.5); // XP based on fish value
      let nextLevel = level;
      let nextXp = xp + xpGain;
      let xpNeeded = getXpForNextLevel(level);
      
      if (nextXp >= xpNeeded && level < 50) {
          nextLevel++;
          nextXp -= xpNeeded;
          showNotif(`升级了! Lv.${nextLevel}`, 'success');
      } else {
          showNotif(`+${xpGain} XP`, 'info');
      }

      // Rod Durability Logic
      const newRods = ownedRods.map(r => {
          if (r.id === activeRodId) {
              return { ...r, durability: Math.max(0, r.durability - 1) };
          }
          return r;
      });
      
      // Check if rod broke
      const currentRod = newRods.find(r => r.id === activeRodId);
      if (currentRod && currentRod.durability === 0) {
          showNotif("鱼竿损坏了!", 'error');
      }

      // Save Data
      saveProgress(newInv, newRods, undefined, nextXp, nextLevel, newUnlocked);
      
      // Update Leaderboard with Total XP
      if (userProfile) {
          const totalXp = calculateTotalXp(nextLevel, nextXp);
          saveHighScore(userProfile, 'honey_fishing', totalXp).catch(console.error);
      }
      
      setPhase('CAUGHT');
      setTimeout(() => setPhase('IDLE'), 2500);
  };

  const handleMiniGameLose = () => {
      gameRef.current.isRunning = false;
      cancelAnimationFrame(gameRef.current.animationId);
      audio.playGameOver();
      setPhase('MISSED');
      showNotif("鱼跑了...", 'error');
      setTimeout(() => setPhase('IDLE'), 1500);
  };

  const gameLoop = () => {
      if (phase !== 'MINIGAME') return;
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
      
      const now = performance.now();
      const elapsed = now - gameRef.current.lastFrameTime;
      if (elapsed < 16) return; 
      gameRef.current.lastFrameTime = now;
      
      const game = gameRef.current;
      
      // Fish AI - Dynamic Difficulty
      if (game.fishMoveTimer <= 0) {
          if (game.moveType === 'floater') {
              game.fishTarget = game.fishPos + (Math.random() - 0.5) * 60; 
              game.fishMoveTimer = Math.random() * 20 + 10;
          } else if (game.moveType === 'dart') {
              game.fishTarget = Math.random() * 100;
              game.fishMoveTimer = Math.random() * 20 + 5; 
          } else {
              game.fishTarget = Math.random() * 100; 
              // Higher difficulty = Faster direction changes
              game.fishMoveTimer = Math.max(5, 40 - game.difficulty * 8); 
          }
      } else {
          game.fishMoveTimer--;
      }
      
      // Speed scales with difficulty
      let speed = 0.5 + game.difficulty * 0.2;
      if (game.moveType === 'dart') speed *= 1.5;
      
      if (game.fishPos < game.fishTarget) game.fishPos += speed;
      if (game.fishPos > game.fishTarget) game.fishPos -= speed;
      
      // Add jitter for hard fish
      game.fishPos += (Math.random() - 0.5) * (game.difficulty * 0.8);
      game.fishPos = Math.max(0, Math.min(100, game.fishPos));

      // Bar Physics
      if (game.isMouseDown) {
          game.barVelocity -= 0.6; 
      } else {
          game.barVelocity += 0.5; 
      }
      game.barVelocity *= 0.94; 
      game.barPos += game.barVelocity;
      
      if (game.barPos < 0) { game.barPos = 0; game.barVelocity = 0; }
      if (game.barPos > 100 - game.barSize) { game.barPos = 100 - game.barSize; game.barVelocity *= -0.4; }

      // Catch Logic
      const fishTop = game.fishPos - 2;
      const fishBottom = game.fishPos + 2;
      const barTop = game.barPos;
      const barBottom = game.barPos + game.barSize;
      
      const isCatching = (fishBottom > barTop && fishTop < barBottom);
      
      if (isCatching) {
          game.progress += 0.5; 
      } else {
          game.progress -= 0.3; 
      }
      
      game.progress = Math.max(0, Math.min(100, game.progress));
      
      if (game.progress >= 100) handleMiniGameCatch();
      else if (game.progress <= 0) handleMiniGameLose();
      
      drawMiniGame();
  };

  const drawMiniGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const game = gameRef.current;
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
      // BG
      ctx.fillStyle = '#2d1b0e'; 
      ctx.fillRect(0, 0, w, h);
      
      const barX = 15;
      const barW = 30;
      const barH = h - 30;
      const barY = 15;
      
      // Water
      ctx.fillStyle = '#1e3a8a'; 
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#3b82f6'; 
      ctx.fillRect(barX + 2, barY + 2, barW - 4, barH - 4);
      
      // Bar
      const greenH = (game.barSize / 100) * barH;
      const greenY = barY + (game.barPos / 100) * barH;
      
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(barX + 4, greenY, barW - 8, greenH);
      
      // Fish
      const fishY = barY + (game.fishPos / 100) * barH;
      const fishObj = FISH_TYPES[game.currentFishId];
      const fishImg = fishImagesRef.current[fishObj.id];

      if (fishImg && fishImg.complete && fishImg.naturalHeight !== 0) {
          const iconSize = 24;
          ctx.drawImage(fishImg, barX + 3, fishY - iconSize/2, iconSize, iconSize);
      } else {
          ctx.font = '20px serif';
          ctx.fillStyle = '#FFF';
          ctx.fillText(fishObj.icon, barX + 5, fishY + 5);
      }
      
      // Progress
      const progX = barX + barW + 8;
      const progW = 8;
      const progH = barH;
      
      ctx.fillStyle = '#451a03';
      ctx.fillRect(progX, barY, progW, progH);
      
      const fillH = (game.progress / 100) * progH;
      ctx.fillStyle = game.progress > 80 ? '#22c55e' : game.progress > 30 ? '#eab308' : '#ef4444';
      ctx.fillRect(progX, barY + progH - fillH, progW, fillH);
  };

  // --- SHOP ---

  const sellFish = async (index: number) => {
      if (isTransactionPending || !userProfile) return;
      setIsTransactionPending(true);
      try {
          const fish = inventory[index];
          if (!fish) return;
          
          await deductCredit(userProfile.uid, -fish.price); 
          setCredits(prev => prev + fish.price);
          
          const newInv = inventory.filter((_, i) => i !== index);
          await saveProgress(newInv);
          
          audio.playScore();
          refreshProfile();
      } catch (e) {
          showNotif("出售失败", 'error');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const sellAllFish = async () => {
      if (isTransactionPending || inventory.length === 0 || !userProfile) return;
      setIsTransactionPending(true);
      try {
          const totalValue = inventory.reduce((sum, f) => sum + f.price, 0);
          
          await deductCredit(userProfile.uid, -totalValue);
          setCredits(prev => prev + totalValue);
          await saveProgress([]);
          
          audio.playScore();
          refreshProfile();
          showNotif(`全部出售! 获得 ${totalValue} 蜂蜜`, 'success');
      } catch (e) {
          showNotif("交易失败", 'error');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const buyBait = async () => {
      if (isTransactionPending || !userProfile) return;
      if (buyBaitAmount <= 0) return;
      
      const cost = buyBaitAmount * BAIT_PRICE;
      if (credits < cost) {
          showNotif("蜂蜜不足", 'error');
          return;
      }

      setIsTransactionPending(true);
      try {
          const success = await deductCredit(userProfile.uid, cost);
          if (success) {
              setCredits(prev => prev - cost);
              const newBait = baitCount + buyBaitAmount;
              setBaitCount(newBait);
              await saveProgress(undefined, undefined, newBait);
              showNotif(`购买成功 +${buyBaitAmount} 鱼饵`, 'success');
              refreshProfile();
              audio.playStep();
          } else {
              showNotif("交易失败", 'error');
          }
      } catch (e) {
          showNotif("系统错误", 'error');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const buyRod = async (rodId: number) => {
      if (isTransactionPending || !userProfile) return;
      const rod = RODS[rodId];
      if (credits < rod.price) {
          showNotif("蜂蜜不足", 'error');
          return;
      }
      
      setIsTransactionPending(true);
      try {
          const success = await deductCredit(userProfile.uid, rod.price);
          if (success) {
              setCredits(prev => prev - rod.price);
              
              // Add new rod instance to inventory
              const newRodItem = {
                  id: Date.now().toString(),
                  typeId: rod.id,
                  durability: rod.durability,
                  maxDurability: rod.durability
              };
              const newRods = [...ownedRods, newRodItem];
              setOwnedRods(newRods);
              
              await saveProgress(undefined, newRods);
              showNotif(`购买成功: ${rod.name}`, 'success');
              refreshProfile();
              audio.playStep();
          } else {
              showNotif("交易失败", 'error');
          }
      } catch (e) {
          showNotif("系统错误", 'error');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const equipRod = async (rodItemId: string) => {
      setActiveRodId(rodItemId);
      // Find type to set rodLevel for visuals
      const rod = ownedRods.find(r => r.id === rodItemId);
      if (rod) {
          setRodLevel(rod.typeId);
          await saveProgress(undefined, undefined, undefined, undefined, undefined, undefined, rodItemId);
          showNotif("装备成功", 'success');
      }
  };

  // --- RENDER ---

  let spriteX = 0; 
  let spriteY = 0; 
  
  if (phase === 'IDLE') {
      spriteX = 0; 
      spriteY = 32; 
  }
  else if (phase === 'WAITING') {
      spriteX = 0;
      spriteY = 32;
  }
  else if (phase === 'CHARGING') {
      const shake = Math.floor(Date.now() / 50) % 2;
      spriteX = shake === 0 ? 0 : 16; 
      spriteY = 32;
  }
  else if (phase === 'CASTING') {
      spriteX = 16 * 2; 
      spriteY = 32;
  }
  else if (phase === 'BITE' || phase === 'MINIGAME') {
      spriteX = 16; 
      spriteY = 32;
  }
  else if (phase === 'CAUGHT') {
      spriteY = 0; // Front
      spriteX = 0;
  }

  // Visual rod color
  const activeRodItem = ownedRods.find(r => r.id === activeRodId);
  const activeRodType = activeRodItem ? RODS[activeRodItem.typeId] : RODS[0];
  const activeRodColor = activeRodType.color;

  let rodRotation = -20; 
  if (phase === 'CHARGING') rodRotation = -45 - (chargePower/100) * 30; 
  if (phase === 'CASTING') rodRotation = 10; 
  if (phase === 'WAITING') rodRotation = 10; 
  if (phase === 'BITE') rodRotation = 25; 
  if (phase === 'MINIGAME') rodRotation = 10 + Math.sin(Date.now() / 100) * 10; 

  const xpNeeded = getXpForNextLevel(level);
  const xpPercent = Math.min(100, (xp / xpNeeded) * 100);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto min-h-[500px] bg-[#fdf6e3] rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-800 relative font-sans select-none touch-none">
        
        {/* Auth Blocking Overlay */}
        {!userProfile && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="bg-white p-4 rounded-full mb-6 shadow-2xl scale-110">
                    <Lock size={40} className="text-amber-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 drop-shadow-md">开启钓鱼之旅</h2>
                <p className="text-white/90 mb-8 text-lg font-medium leading-relaxed max-w-[260px]">
                    登录后即可购买鱼竿、收集稀有图鉴，成为垂钓大师！
                </p>
                <Button onClick={onLoginRequest} className="px-10 py-4 text-xl shadow-xl w-full max-w-xs">
                    立即登录存档
                </Button>
            </div>
        )}

        {/* --- SCENE VIEW --- */}
        {view === 'SCENE' && (
            <div className="w-full h-[500px] relative overflow-hidden bg-[#64b5f6]">
                <div className="absolute inset-0 z-0">
                    <div className="w-[200%] h-[200%] absolute top-0 left-0 bg-[#4fc3f7] opacity-30 animate-pulse" 
                         style={{backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '30px 30px'}}>
                    </div>
                </div>

                {/* Dock */}
                <div className="absolute bottom-0 left-[10%] w-4 h-[100px] bg-[#3e2723] z-0"></div>
                <div className="absolute bottom-0 left-[35%] w-4 h-[100px] bg-[#3e2723] z-0"></div>

                {/* Platform (Wide) */}
                <div className="absolute bottom-[100px] left-0 w-[40%] h-[70px] z-10 bg-[#5d4037] border-t-4 border-r-4 border-b-8 border-[#3e2723] shadow-xl"
                     style={{
                         backgroundImage: 'repeating-linear-gradient(90deg, #5d4037, #5d4037 10px, #4e342e 10px, #4e342e 12px)'
                     }}>
                </div>

                {/* Character & Rod Container */}
                <div className="absolute bottom-[128px] left-[35%] -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none scale-[3] origin-bottom">
                    <div className="relative w-[16px] h-[32px]">
                        
                        {/* Rod - HIDDEN when IDLE or CAUGHT */}
                        {phase !== 'IDLE' && phase !== 'CAUGHT' && (
                            <div 
                                className="absolute top-[18px] left-[4px] w-[45px] h-[1px] origin-left transition-transform duration-200"
                                style={{ 
                                    transform: `rotate(${rodRotation}deg)`,
                                    backgroundColor: activeRodColor
                                }}
                            >
                                {/* Charging Line (Gravity) */}
                                {phase === 'CHARGING' && (
                                    <div 
                                        className="absolute right-0 top-0 w-[1px] bg-white/80 origin-top"
                                        style={{
                                            height: '35px', 
                                            transform: `rotate(${-rodRotation + 90}deg)`
                                        }}
                                    >
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                        <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 w-1 h-2 bg-gray-300"></div>
                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 border-b border-l border-gray-400 rounded-bl-full transform -rotate-45"></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Character Sprite */}
                        <div 
                            style={{
                                width: '16px',
                                height: '32px',
                                backgroundImage: `url(${CHAR_SPRITE_URL})`,
                                backgroundPosition: `-${spriteX}px -${spriteY}px`,
                                imageRendering: 'pixelated',
                                transform: phase === 'CHARGING' ? `translateX(${Math.sin(Date.now()/50)}px)` : 'none'
                            }}
                        />

                        {/* --- FISHING LINE SVG (Inside Scaled Container) --- */}
                        {/* Drawn only when rod is active but not charging (charging uses div) */}
                        {(phase === 'CASTING' || phase === 'WAITING' || phase === 'BITE' || phase === 'MINIGAME') && (
                            <svg 
                                className="absolute top-0 left-0 overflow-visible pointer-events-none"
                                width="100" height="100"
                            >
                                {/* Rod Tip Calc */}
                                {(() => {
                                    const rodPivotX = 4;
                                    const rodPivotY = 18;
                                    const rodLength = 45;
                                    const rodAngleRad = (rodRotation * Math.PI) / 180;
                                    const tipX = rodPivotX + rodLength * Math.cos(rodAngleRad);
                                    const tipY = rodPivotY + rodLength * Math.sin(rodAngleRad);
                                    const bobberX = tipX + (bobberDist * 0.1); 
                                    const bobberY = tipY + bobberDist;
                                    const slack = (phase === 'WAITING') ? 20 : 5;
                                    const cpX = (tipX + bobberX) / 2;
                                    const cpY = (tipY + bobberY) / 2 + slack;
                                    
                                    return (
                                        <>
                                            <path 
                                                d={`M ${tipX},${tipY} Q ${cpX},${cpY} ${bobberX},${bobberY}`} 
                                                fill="none" 
                                                stroke="rgba(255,255,255,0.8)" 
                                                strokeWidth="0.5"
                                            />
                                            <circle cx={bobberX} cy={bobberY} r="1.5" fill="red" stroke="white" strokeWidth="0.5" />
                                        </>
                                    );
                                })()}
                            </svg>
                        )}
                        
                        {/* Caught Fish Display */}
                        {phase === 'CAUGHT' && (
                            <div className="absolute -top-[35px] left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-2 zoom-in duration-300 flex flex-col items-center z-50">
                                <div className="bg-white/90 p-1 rounded-full shadow-md backdrop-blur-sm border border-white">
                                    {FISH_TYPES[gameRef.current.currentFishId]?.imageUrl ? (
                                        <img src={FISH_TYPES[gameRef.current.currentFishId].imageUrl} className="w-5 h-5 object-contain pixelated" />
                                    ) : (
                                        <span className="text-lg">{FISH_TYPES[gameRef.current.currentFishId].icon}</span>
                                    )}
                                </div>
                                <div className="text-[4px] font-bold text-white bg-green-600 px-1 rounded mt-0.5 whitespace-nowrap">
                                    {FISH_TYPES[gameRef.current.currentFishId].name}
                                </div>
                            </div>
                        )}
                        
                        {phase === 'BITE' && (
                            <div className="absolute -top-6 left-1 text-[8px] font-black text-yellow-400 animate-bounce bg-white/80 rounded-full w-4 h-4 flex items-center justify-center border border-black">!</div>
                        )}
                    </div>
                </div>

                {/* 5. Click Layer (Global) */}
                <div 
                    className="absolute inset-0 z-10 cursor-pointer"
                    onMouseDown={handleActionDown}
                    onMouseUp={handleActionUp}
                    onMouseLeave={handleActionUp}
                    onTouchStart={handleActionDown}
                    onTouchEnd={handleActionUp}
                ></div>

                {/* 6. HUD */}
                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none z-30">
                    <div className="flex flex-col gap-2">
                        {/* Level & XP */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-black flex items-center justify-center border-2 border-white shadow-md z-10">
                                {level}
                            </div>
                            <div className="h-4 bg-black/40 rounded-full w-24 overflow-hidden border border-white/20 backdrop-blur-md">
                                <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${xpPercent}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-black/40 backdrop-blur-md text-white px-4 py-1.5 rounded-xl border border-white/20 flex items-center gap-3 shadow-lg">
                            <span className="text-lg">🍯</span> 
                            <span className="font-mono font-bold text-sm text-yellow-400">{credits}</span>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md text-white px-4 py-1.5 rounded-xl border border-white/20 flex items-center gap-3 shadow-lg">
                            <span className="text-lg">🪱</span> 
                            <span className="font-mono font-bold text-sm text-red-400">{baitCount}</span>
                        </div>
                        
                        {/* Active Rod Durability Display */}
                        {activeRodItem && (
                            <div className="bg-black/40 backdrop-blur-md text-white px-4 py-1.5 rounded-xl border border-white/20 flex items-center gap-3 shadow-lg mt-1">
                                <span className="text-lg"><Battery size={16} className={activeRodItem.durability < 5 ? "text-red-500" : "text-green-400"}/></span>
                                <div className="flex flex-col w-full">
                                    <span className="text-[8px] uppercase font-bold text-neutral-400">{activeRodType.name}</span>
                                    <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${activeRodItem.durability < 10 ? 'bg-red-500' : 'bg-green-400'}`} 
                                            style={{ width: `${(activeRodItem.durability / (activeRodItem.maxDurability || activeRodType.durability)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2 pointer-events-auto">
                        <button onClick={() => setView('POKEDEX')} className="bg-purple-500 p-2.5 rounded-xl shadow-xl border-b-4 border-purple-700 text-white hover:scale-105 active:scale-95 transition-all">
                            <Book size={20}/>
                        </button>
                        <button onClick={() => setView('INVENTORY')} className="bg-white/90 p-2.5 rounded-xl shadow-xl border-b-4 border-neutral-300 text-amber-900 hover:scale-105 active:scale-95 transition-all">
                            <BookOpen size={20}/>
                        </button>
                        <button onClick={() => setView('SHOP')} className="bg-brand-yellow p-2.5 rounded-xl shadow-xl border-b-4 border-yellow-600 text-black hover:scale-105 active:scale-95 transition-all">
                            <ShoppingBag size={20}/>
                        </button>
                    </div>
                </div>

                {/* 7. Text Hint */}
                <div className="absolute bottom-8 w-full text-center pointer-events-none z-20">
                    {phase === 'IDLE' && <span className="text-white font-bold drop-shadow-md animate-pulse bg-black/30 px-3 py-1 rounded-full">按住屏幕抛竿</span>}
                    {phase === 'WAITING' && <span className="text-white/90 font-bold drop-shadow-md bg-black/30 px-3 py-1 rounded-full">等待咬钩...</span>}
                    {phase === 'BITE' && <span className="text-yellow-300 font-black text-xl drop-shadow-md animate-bounce">点击!</span>}
                </div>
                
                {/* 8. Minigame UI */}
                {phase === 'MINIGAME' && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-[#3e2723] border-4 border-[#5d4037] rounded-lg shadow-2xl p-1 flex items-center animate-in slide-in-from-left-10 duration-200 pointer-events-none">
                        <canvas 
                            ref={canvasRef} 
                            width={70} 
                            height={300} 
                            className="bg-[#1a1a1a] rounded border-2 border-[#2d1b0e]"
                        />
                        <div className="absolute -right-2 top-4 w-4 h-8 bg-[#8d6e63] border border-[#3e2723] rounded-r-md"></div>
                        <div className="absolute -right-2 bottom-4 w-4 h-8 bg-[#8d6e63] border border-[#3e2723] rounded-r-md"></div>
                    </div>
                )}
            </div>
        )}

        {/* --- POKEDEX VIEW --- */}
        {view === 'POKEDEX' && (
            <div className="w-full h-[500px] bg-[#fdf2f8] flex flex-col">
                <div className="p-4 bg-purple-500 text-white font-bold flex items-center gap-3 shadow-md">
                    <button onClick={() => setView('SCENE')}><ArrowLeft/></button>
                    <span>鱼类图鉴 ({unlockedFish.length}/50)</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-3 gap-2">
                        {FISH_TYPES.map((fish) => {
                            const isCaught = unlockedFish.includes(fish.id);
                            const isUnlocked = level >= fish.unlockLevel;
                            
                            return (
                                <div key={fish.id} className={`aspect-[4/5] rounded-xl border flex flex-col items-center justify-center p-1 relative ${isCaught ? 'bg-white border-purple-200 shadow-sm' : 'bg-gray-200 border-gray-300'}`}>
                                    {isUnlocked ? (
                                        <>
                                            <div className={`w-10 h-10 flex items-center justify-center mb-1 ${!isCaught ? 'opacity-30 grayscale contrast-0' : ''}`}>
                                                {fish.imageUrl ? <img src={fish.imageUrl} className="w-full h-full object-contain pixelated"/> : fish.icon}
                                            </div>
                                            {isCaught ? (
                                                <>
                                                    <div className="text-[10px] font-bold text-center leading-tight truncate w-full px-1 text-slate-800">
                                                        {fish.name.split(' ')[0]}
                                                    </div>
                                                    <div className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1 border border-amber-100 flex items-center gap-1">
                                                        {fish.price} 🍯
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-[8px] text-gray-400 text-center font-bold">???</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-400 h-full w-full">
                                            <Lock size={16} className="mb-1"/>
                                            <span className="text-[10px] font-bold">Lv.{fish.unlockLevel}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* --- INVENTORY VIEW (Equipment & Bag) --- */}
        {view === 'INVENTORY' && (
            <div className="w-full h-[500px] bg-[#fffbeb] flex flex-col">
                <div className="p-4 bg-amber-500 text-white font-bold flex items-center gap-3 shadow-md">
                    <button onClick={() => setView('SCENE')}><ArrowLeft/></button>
                    <span>背包</span>
                    <button 
                        onClick={sellAllFish} 
                        disabled={isTransactionPending || inventory.length === 0}
                        className="ml-auto text-xs bg-white text-amber-600 px-3 py-1 rounded-full font-bold shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        {isTransactionPending ? <Loader2 className="animate-spin" size={14}/> : "卖出所有鱼"}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Equipment Section */}
                    <div>
                        <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Anchor size={18}/> 装备 (鱼竿)</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {ownedRods.map((rodItem) => {
                                const rodType = RODS[rodItem.typeId];
                                const isActive = rodItem.id === activeRodId;
                                const isBroken = rodItem.durability <= 0;
                                const maxDurability = rodItem.maxDurability || rodType.durability;
                                
                                return (
                                    <div key={rodItem.id} className={`p-3 rounded-xl border-2 flex items-center justify-between ${isActive ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-300' : 'bg-white border-neutral-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">
                                                🎣
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-neutral-800">{rodType.name}</div>
                                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                                    <span className={isBroken ? "text-red-500 font-bold" : ""}>耐久: {rodItem.durability}/{maxDurability}</span>
                                                    <span className="text-purple-500 font-bold">幸运: +{rodType.luck}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            disabled={isActive || isBroken || isTransactionPending} 
                                            variant={isActive ? 'primary' : 'outline'}
                                            onClick={() => equipRod(rodItem.id)}
                                            // Force explicit colors to handle the fixed light background even if parent app is in dark mode
                                            className={`text-xs px-3 py-1 h-8 ${!isActive && !isBroken ? 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100 hover:text-black hover:border-neutral-400' : ''}`}
                                        >
                                            {isActive ? "使用中" : isBroken ? "已损坏" : "装备"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Fish Inventory */}
                    <div>
                        <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><BookOpen size={18}/> 渔获</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {inventory.length === 0 && (
                                <div className="col-span-3 text-center text-neutral-400 py-4 text-sm">背包空空如也...</div>
                            )}
                            {inventory.map((fish, idx) => {
                                const fishType = FISH_TYPES.find(f => f.id === fish.typeId);
                                return (
                                    <div key={idx} className="bg-white p-2 rounded-xl border border-amber-200 shadow-sm flex flex-col items-center gap-1 relative group">
                                        <div className="text-3xl w-10 h-10 flex items-center justify-center">
                                            {fishType?.imageUrl ? (
                                                <img src={fishType.imageUrl} alt={fish.name} className="w-full h-full object-contain pixelated" onError={(e) => { e.currentTarget.style.display='none'; }}/>
                                            ) : null}
                                            <span className={fishType?.imageUrl ? "hidden" : "block"}>{fishType?.icon || '🐟'}</span>
                                        </div>
                                        <div className="font-bold text-xs text-amber-900 truncate w-full text-center">{fish.name}</div>
                                        <div className="text-[10px] bg-green-100 text-green-700 px-2 rounded-full font-mono">
                                            +{fish.price}
                                        </div>
                                        
                                        <button 
                                            onClick={() => sellFish(idx)}
                                            disabled={isTransactionPending}
                                            className="absolute inset-0 bg-black/60 rounded-xl hidden group-hover:flex items-center justify-center text-white font-bold text-xs disabled:cursor-not-allowed"
                                        >
                                            {isTransactionPending ? <Loader2 className="animate-spin"/> : <><DollarSign size={16}/> 卖出</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- SHOP VIEW --- */}
        {view === 'SHOP' && (
            <div className="w-full h-[500px] bg-[#f0f9ff] flex flex-col">
                <div className="p-4 bg-blue-500 text-white font-bold flex items-center gap-3 shadow-md">
                    <button onClick={() => setView('SCENE')}><ArrowLeft/></button>
                    <span>威利的商店</span>
                    <div className="ml-auto font-mono text-sm bg-black/20 px-2 py-1 rounded">
                        {credits} 🍯
                    </div>
                </div>

                <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {/* Custom Bait Purchase */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><span className="text-2xl">🪱</span> 购买鱼饵</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">没有鱼饵是钓不到鱼的。单价: {BAIT_PRICE} 🍯</p>
                        
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                min="1" 
                                max="100" 
                                value={buyBaitAmount}
                                onChange={(e) => setBuyBaitAmount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 p-2 border rounded-xl text-center font-bold bg-slate-50 text-black"
                            />
                            <Button size="sm" onClick={buyBait} className="flex-1" disabled={isTransactionPending}>
                                {isTransactionPending ? <Loader2 className="animate-spin mx-auto"/> : `购买 (${buyBaitAmount * BAIT_PRICE} 🍯)`}
                            </Button>
                        </div>
                    </div>

                    {/* Rod Shop */}
                    <h3 className="font-bold text-slate-500 text-sm uppercase tracking-wider ml-1">购买新装备</h3>
                    {RODS.map((rod, idx) => (
                        <div key={rod.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden`}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-700">{rod.name}</h3>
                                <span className="text-orange-500 font-bold font-mono">{rod.price} 🍯</span>
                            </div>
                            
                            <div className="w-full h-2 bg-slate-100 rounded-full mb-2 overflow-hidden">
                                <div className="h-full bg-blue-400" style={{width: `${(rod.barSize / 100) * 100}%`}}></div>
                            </div>
                            
                            <div className="flex flex-col gap-1 mb-3">
                                <span className="text-xs text-slate-400 flex justify-between"><span>绿条宽度:</span> <span>{rod.barSize}px</span></span>
                                <span className="text-xs text-slate-400 flex justify-between"><span>耐久度:</span> <span>{rod.durability}次</span></span>
                                <span className="text-xs text-slate-400 flex justify-between"><span>幸运值:</span> <span className="text-purple-500">+{rod.luck}</span></span>
                            </div>
                            
                            <Button size="sm" onClick={() => buyRod(rod.id)} disabled={isTransactionPending} className="w-full">
                                {isTransactionPending ? <Loader2 className="animate-spin"/> : "购买"}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {notification && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-max">
                <div className={`px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-bold animate-in zoom-in fade-in duration-200 border ${
                    notification.type === 'success' ? 'bg-green-600 text-white border-green-400' :
                    notification.type === 'error' ? 'bg-red-600 text-white border-red-400' :
                    'bg-neutral-800 text-white border-neutral-600'
                }`}>
                    {notification.msg}
                </div>
            </div>
        )}

    </div>
  );
};

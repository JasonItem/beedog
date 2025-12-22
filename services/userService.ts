
import { db, storage } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, query, orderBy, limit, runTransaction } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import { DivinationResult } from "./geminiService";

// --- Types ---

export interface RodItem {
    id: string; // Unique instance ID
    typeId: number; // 0: Bamboo, 1: Fiberglass, 2: Iridium
    durability: number;
    maxDurability: number;
}

export interface FishingSaveData {
  rodLevel: number; // Deprecated, kept for legacy compatibility (visuals)
  activeRodId?: string; // ID of the currently equipped rod
  rods?: RodItem[]; // List of owned rods
  baitCount: number;
  level: number; // Current Player Level (1-50)
  xp: number; // Current XP
  inventory: { id: string, typeId: number, name: string, price: number, rarity: number }[]; // Caught fish kept
  unlockedFish: number[]; // Pokedex (IDs of fish caught)
}

// NEW: Farm Game Types
export interface FarmPlot {
  id: number; // 0-8
  cropId: string | null; // null if empty
  plantedAt: number; // Timestamp
  status: 'EMPTY' | 'GROWING' | 'READY'; // Helper status, mainly derived from time
}

export interface FarmSaveData {
  level: number;
  xp: number;
  plots: FarmPlot[];
}

// NEW: Trading Game Types
export interface TradingPosition {
  id: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  margin: number;
  leverage: number;
  size: number;
  liquidationPrice: number;
  timestamp: number;
}

export interface TradingSaveData {
    positions: TradingPosition[];
}

export interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  avatarUrl?: string; 
  credits: number;
  is_admin?: number; // 0 = User, 1 = Admin
  lastCheckInDate?: string; // ISO Date string YYYY-MM-DD
  lastGamePlayedDate?: string; // ISO Date string YYYY-MM-DD
  dailyGameRewards?: Record<string, string>; // Map of gameId -> YYYY-MM-DD
  fishingData?: FishingSaveData;
  farmData?: FarmSaveData;
  tradingData?: TradingSaveData; // NEW: Trading Positions
  productUsage?: Record<string, number>; // NEW: Map of productId -> count purchased
}

export interface DivinationRecord extends DivinationResult {
  date: string; // YYYY-MM-DD
  timestamp: number;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data() as any;
    
    // Migration: If credits doesn't exist (old user), initialize it.
    if (typeof data.credits === 'undefined') {
        await updateDoc(docRef, { credits: 0 });
        data.credits = 0;
    }

    return data as UserProfile;
  }
  return null;
};

/**
 * Ensures a user profile exists.
 */
export const ensureUserProfile = async (user: User) => {
  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      nickname: user.displayName || "新蜜蜂",
      credits: 0, 
      is_admin: 0,
      dailyGameRewards: {},
      fishingData: { 
          rodLevel: 0, 
          baitCount: 0, 
          level: 1, 
          xp: 0, 
          inventory: [], 
          unlockedFish: [],
          rods: [{ id: 'starter', typeId: 0, durability: 50, maxDurability: 50 }],
          activeRodId: 'starter'
      },
      farmData: { level: 1, xp: 0, plots: Array(9).fill(null).map((_, i) => ({ id: i, cropId: null, plantedAt: 0, status: 'EMPTY' })) },
      tradingData: { positions: [] },
      productUsage: {}
    };

    if (user.photoURL) {
      newProfile.avatarUrl = user.photoURL;
    }

    await setDoc(docRef, newProfile);
    return newProfile;
  } else {
    // Existing User Sync
    const updates: any = {};
    const currentData = docSnap.data();
    
    // Sync Avatar
    const isCustomUpload = currentData.avatarUrl && currentData.avatarUrl.includes("firebasestorage.googleapis.com");
    if (user.photoURL && (!currentData.avatarUrl || !isCustomUpload)) {
       if (currentData.avatarUrl !== user.photoURL) {
           updates.avatarUrl = user.photoURL;
       }
    }
    
    if (typeof currentData.credits === 'undefined') updates.credits = 0;
    
    // Init fishing data if missing
    if (!currentData.fishingData) {
        updates.fishingData = { 
            rodLevel: 0, 
            baitCount: 0, 
            level: 1, 
            xp: 0, 
            inventory: [], 
            unlockedFish: [],
            rods: [{ id: 'starter', typeId: 0, durability: 50, maxDurability: 50 }],
            activeRodId: 'starter'
        };
    }
    
    // Init farm data if missing
    if (!currentData.farmData) {
        updates.farmData = { 
            level: 1, 
            xp: 0, 
            plots: Array(9).fill(null).map((_, i) => ({ id: i, cropId: null, plantedAt: 0, status: 'EMPTY' })) 
        };
    }

    // Init trading data if missing
    if (!currentData.tradingData) {
        updates.tradingData = { positions: [] };
    }

    // Init product usage if missing
    if (!currentData.productUsage) {
        updates.productUsage = {};
    }
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(docRef, updates);
    }
    
    return { ...currentData, ...updates } as UserProfile;
  }
};

export const updateUserNickname = async (uid: string, nickname: string) => {
  const docRef = doc(db, "users", uid);
  await setDoc(docRef, {
    uid,
    nickname
  }, { merge: true });
};

// ... (Existing uploadUserAvatar, deductCredit, performDailyCheckIn, completeDailyGameMission, claimPerGameDailyReward, saveDivinationResult, getDivinationHistory) ...
export const uploadUserAvatar = async (uid: string, file: File): Promise<string> => {
  const storageRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { avatarUrl: downloadUrl });
  return downloadUrl;
};

export const deductCredit = async (uid: string, amount: number = 1): Promise<boolean> => {
  const docRef = doc(db, "users", uid);
  try {
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw "User does not exist";
      const data = docSnap.data();
      const currentCredits = typeof data.credits === 'number' ? data.credits : 0;
      if (amount > 0 && currentCredits < amount) throw "Insufficient funds";
      const newCredits = currentCredits - amount;
      transaction.update(docRef, { credits: newCredits });
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const performDailyCheckIn = async (uid: string): Promise<{ success: boolean; message: string }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return { success: false, message: "用户不存在" };
  const data = docSnap.data() as UserProfile;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (data.lastCheckInDate === today) return { success: false, message: "今天已经签到过了" };
  await updateDoc(docRef, { credits: increment(100), lastCheckInDate: today });
  return { success: true, message: "签到成功！获得 100 罐蜂蜜！" };
};

export const completeDailyGameMission = async (uid: string): Promise<{ success: boolean; message: string; earned: number }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return { success: false, message: "User not found", earned: 0 };
  const data = docSnap.data() as UserProfile;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (data.lastGamePlayedDate === today) return { success: false, message: "Mission already completed", earned: 0 };
  await updateDoc(docRef, { credits: increment(500), lastGamePlayedDate: today });
  return { success: true, message: "每日首玩任务完成！", earned: 500 };
};

export const claimPerGameDailyReward = async (uid: string, gameId: string): Promise<{ success: boolean; earned: number }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return { success: false, earned: 0 };
  const data = docSnap.data() as UserProfile;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rewards = data.dailyGameRewards || {};
  if (rewards[gameId] === today) return { success: false, earned: 0 };
  await setDoc(docRef, { credits: increment(10), dailyGameRewards: { [gameId]: today } }, { merge: true });
  return { success: true, earned: 10 };
};

export const saveDivinationResult = async (uid: string, result: DivinationResult) => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const docRef = doc(db, "users", uid, "divination_history", dateStr);
  const record: DivinationRecord = { ...result, date: dateStr, timestamp: Date.now() };
  await setDoc(docRef, record);
  return record;
};

export const getDivinationHistory = async (uid: string): Promise<DivinationRecord[]> => {
  const coll = collection(db, "users", uid, "divination_history");
  const q = query(coll, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  const history: DivinationRecord[] = [];
  snapshot.forEach((doc) => { history.push(doc.data() as DivinationRecord); });
  return history;
};

export const updateFishingData = async (uid: string, newData: Partial<FishingSaveData>) => {
    const docRef = doc(db, "users", uid);
    const updates: any = {};
    if (newData.rodLevel !== undefined) updates["fishingData.rodLevel"] = newData.rodLevel;
    if (newData.activeRodId !== undefined) updates["fishingData.activeRodId"] = newData.activeRodId;
    if (newData.rods !== undefined) updates["fishingData.rods"] = newData.rods;
    if (newData.baitCount !== undefined) updates["fishingData.baitCount"] = newData.baitCount;
    if (newData.level !== undefined) updates["fishingData.level"] = newData.level;
    if (newData.xp !== undefined) updates["fishingData.xp"] = newData.xp;
    if (newData.inventory !== undefined) updates["fishingData.inventory"] = newData.inventory;
    if (newData.unlockedFish !== undefined) updates["fishingData.unlockedFish"] = newData.unlockedFish;
    await updateDoc(docRef, updates);
};

/**
 * Update Farm Data
 */
export const updateFarmData = async (uid: string, newData: Partial<FarmSaveData>) => {
    const docRef = doc(db, "users", uid);
    const updates: any = {};
    if (newData.level !== undefined) updates["farmData.level"] = newData.level;
    if (newData.xp !== undefined) updates["farmData.xp"] = newData.xp;
    if (newData.plots !== undefined) updates["farmData.plots"] = newData.plots;
    await updateDoc(docRef, updates);
};

/**
 * NEW: Update Trading Positions
 */
export const updateTradingPositions = async (uid: string, positions: TradingPosition[]) => {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { "tradingData.positions": positions });
};

export const getHoneyLeaderboard = async (limitCount: number = 50): Promise<UserProfile[]> => {
  try {
    const q = query(collection(db, "users"), orderBy("credits", "desc"), limit(limitCount));
    const snapshot = await getDocs(q);
    const users: UserProfile[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as UserProfile);
    });
    return users;
  } catch (error) {
    console.warn("Failed to fetch leaderboard", error);
    return [];
  }
};

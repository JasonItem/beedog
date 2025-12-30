
import { db, storage } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, query, orderBy, limit, runTransaction } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import { DivinationResult } from "./geminiService";

// Define and export missing interfaces used by components
export interface DivinationRecord extends DivinationResult {
  date: string;
  timestamp: number;
}

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

export interface RodItem {
  id: string;
  typeId: number;
  durability: number;
  maxDurability?: number;
}

export interface FarmPlot {
  id: number;
  cropId: string | null;
  plantedAt: number;
  status: 'EMPTY' | 'GROWING' | 'READY';
}

export interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  avatarUrl?: string; 
  credits: number;
  chessPoints: number; 
  gomokuPoints: number; 
  is_admin?: number; 
  lastCheckInDate?: string; 
  lastGamePlayedDate?: string; 
  dailyGameRewards?: Record<string, string>; 
  fishingData?: {
    inventory?: any[];
    rods?: RodItem[];
    baitCount?: number;
    level?: number;
    xp?: number;
    unlockedFish?: number[];
    activeRodId?: string;
    rodLevel?: number;
  };
  farmData?: {
    plots?: FarmPlot[];
    level?: number;
    xp?: number;
  };
  tradingData?: {
    positions?: TradingPosition[];
  }; 
  productUsage?: Record<string, number>; 
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as any;
    if (typeof data.credits === 'undefined') { await updateDoc(docRef, { credits: 0 }); data.credits = 0; }
    if (typeof data.chessPoints === 'undefined') { await updateDoc(docRef, { chessPoints: 0 }); data.chessPoints = 0; }
    if (typeof data.gomokuPoints === 'undefined') { await updateDoc(docRef, { gomokuPoints: 0 }); data.gomokuPoints = 0; }
    return data as UserProfile;
  }
  return null;
};

export const ensureUserProfile = async (user: User) => {
  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    const newProfile: UserProfile = {
      uid: user.uid, email: user.email, nickname: user.displayName || "新蜜蜂",
      credits: 0, chessPoints: 0, gomokuPoints: 0, is_admin: 0, dailyGameRewards: {},
      productUsage: {}
    };
    if (user.photoURL) newProfile.avatarUrl = user.photoURL;
    await setDoc(docRef, newProfile);
    return newProfile;
  } else {
    const updates: any = {};
    const currentData = docSnap.data();
    if (user.photoURL && !currentData.avatarUrl) updates.avatarUrl = user.photoURL;
    if (typeof currentData.credits === 'undefined') updates.credits = 0;
    if (typeof currentData.chessPoints === 'undefined') updates.chessPoints = 0;
    if (typeof currentData.gomokuPoints === 'undefined') updates.gomokuPoints = 0;
    if (Object.keys(updates).length > 0) await updateDoc(docRef, updates);
    return { ...currentData, ...updates } as UserProfile;
  }
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
      transaction.update(docRef, { credits: currentCredits - amount });
    });
    return true;
  } catch (e) { return false; }
};

export const performDailyCheckIn = async (uid: string): Promise<{ success: boolean; message: string }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return { success: false, message: "用户不存在" };
  const data = docSnap.data() as UserProfile;
  const today = new Date().toISOString().split('T')[0];
  if (data.lastCheckInDate === today) return { success: false, message: "今天已经签到过了" };
  await updateDoc(docRef, { credits: increment(100), lastCheckInDate: today });
  return { success: true, message: "签到成功！获得 100 罐蜂蜜！" };
};

export const completeDailyGameMission = async (uid: string) => {
  const docRef = doc(db, "users", uid);
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDoc(docRef);
  if (snap.exists() && snap.data().lastGamePlayedDate !== today) {
      await updateDoc(docRef, { credits: increment(500), lastGamePlayedDate: today });
      return { success: true, earned: 500 };
  }
  return { success: false, earned: 0 };
};

export const claimPerGameDailyReward = async (uid: string, gameId: string) => {
  const docRef = doc(db, "users", uid);
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDoc(docRef);
  if (snap.exists()) {
      const rewards = snap.data().dailyGameRewards || {};
      if (rewards[gameId] !== today) {
          await updateDoc(docRef, { credits: increment(10), [`dailyGameRewards.${gameId}`]: today });
          return { success: true, earned: 10 };
      }
  }
  return { success: false, earned: 0 };
};

export const getHoneyLeaderboard = async (limitCount: number = 50): Promise<UserProfile[]> => {
  const q = query(collection(db, "users"), orderBy("credits", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  const users: UserProfile[] = [];
  snap.forEach(d => users.push(d.data() as UserProfile));
  return users;
};
export const updateUserNickname = async (uid: string, nickname: string) => {
  await updateDoc(doc(db, "users", uid), { nickname });
};
export const uploadUserAvatar = async (uid: string, file: File) => {
  const refS = ref(storage, `avatars/${uid}`);
  await uploadBytes(refS, file);
  const url = await getDownloadURL(refS);
  await updateDoc(doc(db, "users", uid), { avatarUrl: url });
  return url;
};

/**
 * Update fishing data using nested path updates to prevent field replacement
 */
export const updateFishingData = async (uid: string, data: any) => {
  const updates: any = {};
  Object.keys(data).forEach(key => {
    updates[`fishingData.${key}`] = data[key];
  });
  await updateDoc(doc(db, "users", uid), updates);
};

/**
 * Update farm data using nested path updates to prevent field replacement
 * This fixes the bug where planting (which only updates 'plots') would clear 'xp' and 'level'.
 */
export const updateFarmData = async (uid: string, data: any) => {
  const updates: any = {};
  Object.keys(data).forEach(key => {
    updates[`farmData.${key}`] = data[key];
  });
  await updateDoc(doc(db, "users", uid), updates);
};

export const updateTradingPositions = async (uid: string, data: any) => {
  await updateDoc(doc(db, "users", uid), { "tradingData.positions": data });
};

export const saveDivinationResult = async (uid: string, data: DivinationResult): Promise<DivinationRecord> => {
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const record: DivinationRecord = { ...data, date: today, timestamp };
    await setDoc(doc(db, "users", uid, "divination_history", today), record);
    return record;
};

export const getDivinationHistory = async (uid: string): Promise<DivinationRecord[]> => {
    const snap = await getDocs(query(collection(db, "users", uid, "divination_history"), orderBy("timestamp", "desc")));
    const history: DivinationRecord[] = [];
    snap.forEach(d => history.push(d.data() as DivinationRecord));
    return history;
};

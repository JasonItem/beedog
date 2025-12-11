
import { db, storage } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, query, orderBy, runTransaction } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import { DivinationResult } from "./geminiService";

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
        // Give legacy users 0 credits to start (per new rule)
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
      credits: 0, // Initial sign-up bonus changed to 0
      is_admin: 0, // Default to normal user
      dailyGameRewards: {}
      // lastCheckInDate left undefined so they can check-in immediately if desired, 
      // or we can treat sign-up as first check-in. Let's let them check-in manually for the dopamine hit.
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
    
    // Logic: Sync Avatar on login to fix broken X/Twitter links
    // Check if the current stored avatar is a custom upload (hosted on Firebase Storage)
    const isCustomUpload = currentData.avatarUrl && currentData.avatarUrl.includes("firebasestorage.googleapis.com");

    // If it's NOT a custom upload, allow syncing from the auth provider (e.g. Twitter/X)
    // This ensures that if X changes the URL or it expires, we get the new one on next login.
    if (user.photoURL && (!currentData.avatarUrl || !isCustomUpload)) {
       if (currentData.avatarUrl !== user.photoURL) {
           updates.avatarUrl = user.photoURL;
       }
    }
    
    // Migration check for credits
    if (typeof currentData.credits === 'undefined') {
      updates.credits = 0;
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

/**
 * Uploads a user avatar to Firebase Storage and updates the Firestore profile.
 */
export const uploadUserAvatar = async (uid: string, file: File): Promise<string> => {
  // Create a storage reference: avatars/<uid>
  // This overwrites the existing file, which is good for saving space.
  const storageRef = ref(storage, `avatars/${uid}`);
  
  // Upload the file
  await uploadBytes(storageRef, file);
  
  // Get the download URL
  const downloadUrl = await getDownloadURL(storageRef);
  
  // Update Firestore
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    avatarUrl: downloadUrl
  });

  return downloadUrl;
};

/**
 * Deducts credits from the user using a transaction to prevent race conditions.
 * @param uid User ID
 * @param amount Amount to deduct (positive) or add (negative)
 * @returns true if successful, false if insufficient funds or error
 */
export const deductCredit = async (uid: string, amount: number = 1): Promise<boolean> => {
  const docRef = doc(db, "users", uid);

  try {
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw "User does not exist";
      }

      const data = docSnap.data();
      // Ensure credits is a number, default to 0 if missing
      const currentCredits = typeof data.credits === 'number' ? data.credits : 0;

      // Only check sufficient funds if we are deducting (amount > 0)
      // If we are adding credits (amount < 0), we always allow it
      if (amount > 0 && currentCredits < amount) {
        throw "Insufficient funds";
      }

      const newCredits = currentCredits - amount;
      transaction.update(docRef, { credits: newCredits });
    });
    return true;
  } catch (e) {
    // console.error("Credit transaction failed:", e); // Optional logging
    return false;
  }
};

/**
 * Performs daily check-in to get credits.
 */
export const performDailyCheckIn = async (uid: string): Promise<{ success: boolean; message: string }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return { success: false, message: "用户不存在" };

  const data = docSnap.data() as UserProfile;
  
  // Get Local Date String (YYYY-MM-DD) to fix timezone issue
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  if (data.lastCheckInDate === today) {
    return { success: false, message: "今天已经签到过了，明天再来吧！" };
  }

  await updateDoc(docRef, {
    credits: increment(100), // Increased from 10 to 100
    lastCheckInDate: today
  });

  return { success: true, message: "签到成功！获得 100 罐蜂蜜！" };
};

/**
 * Completes the "Play Daily Game" mission (Global).
 */
export const completeDailyGameMission = async (uid: string): Promise<{ success: boolean; message: string; earned: number }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return { success: false, message: "User not found", earned: 0 };

  const data = docSnap.data() as UserProfile;
  
  // Get Local Date String (YYYY-MM-DD)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  if (data.lastGamePlayedDate === today) {
    return { success: false, message: "Mission already completed today", earned: 0 };
  }

  await updateDoc(docRef, {
    credits: increment(500), // Increased from 10 to 500
    lastGamePlayedDate: today
  });

  return { success: true, message: "每日首玩任务完成！", earned: 500 };
};

/**
 * Claim reward for playing a SPECIFIC game for the first time today.
 * Returns earned amount (10 or 0).
 */
export const claimPerGameDailyReward = async (uid: string, gameId: string): Promise<{ success: boolean; earned: number }> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return { success: false, earned: 0 };

  const data = docSnap.data() as UserProfile;
  
  // Get Local Date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  const rewards = data.dailyGameRewards || {};

  if (rewards[gameId] === today) {
    return { success: false, earned: 0 };
  }

  // Update specific game key in the map
  // Use setDoc with merge to ensure nested field update works even if map was empty
  await setDoc(docRef, {
    credits: increment(10),
    dailyGameRewards: {
        [gameId]: today
    }
  }, { merge: true });

  return { success: true, earned: 10 };
};

/**
 * Saves a divination result to history.
 * Subcollection: users/{uid}/divination_history/{date}
 */
export const saveDivinationResult = async (uid: string, result: DivinationResult) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const docRef = doc(db, "users", uid, "divination_history", dateStr);
  
  const record: DivinationRecord = {
    ...result,
    date: dateStr,
    timestamp: Date.now()
  };

  await setDoc(docRef, record);
  return record;
};

/**
 * Fetches the user's divination history.
 */
export const getDivinationHistory = async (uid: string): Promise<DivinationRecord[]> => {
  const coll = collection(db, "users", uid, "divination_history");
  // Order by date descending (newest first)
  const q = query(coll, orderBy("date", "desc"));
  
  const snapshot = await getDocs(q);
  const history: DivinationRecord[] = [];
  
  snapshot.forEach((doc) => {
    history.push(doc.data() as DivinationRecord);
  });
  
  return history;
};

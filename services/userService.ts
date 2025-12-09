
import { db, storage } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import { DivinationResult } from "./geminiService";

export interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  avatarUrl?: string; 
  credits: number;
  lastCheckInDate?: string; // ISO Date string YYYY-MM-DD
  lastGamePlayedDate?: string; // ISO Date string YYYY-MM-DD
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
        // Give legacy users 10 credits to start
        await updateDoc(docRef, { credits: 10 });
        data.credits = 10;
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
      credits: 10, // Initial sign-up bonus
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
    if (user.photoURL && !docSnap.data().avatarUrl) {
       // Only sync google/twitter photo if user hasn't set a custom one?
       // For now, let's strictly prefer what's in DB unless it's missing.
       updates.avatarUrl = user.photoURL;
    }
    
    // Migration check
    const data = docSnap.data();
    if (typeof data.credits === 'undefined') {
      updates.credits = 10;
    }
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(docRef, updates);
    }
    
    return { ...data, ...updates } as UserProfile;
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
 * Deducts credits from the user. Returns true if successful, false if insufficient funds.
 * @param uid User ID
 * @param amount Amount to deduct (default 1)
 */
export const deductCredit = async (uid: string, amount: number = 1): Promise<boolean> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return false;

  const data = docSnap.data();
  const currentCredits = typeof data.credits === 'number' ? data.credits : 0;

  if (currentCredits >= amount) {
    await updateDoc(docRef, {
      credits: increment(-amount)
    });
    return true;
  }
  return false;
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
    credits: increment(10),
    lastCheckInDate: today
  });

  return { success: true, message: "签到成功！获得 10 罐蜂蜜！" };
};

/**
 * Completes the "Play Daily Game" mission.
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
    credits: increment(10),
    lastGamePlayedDate: today
  });

  return { success: true, message: "每日首玩任务完成！", earned: 10 };
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

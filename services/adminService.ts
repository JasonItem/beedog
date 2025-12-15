
import { db } from "../firebaseConfig";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, limit, where, writeBatch, increment, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { UserProfile } from "./userService";
import { GameScore } from "./gameService";

// Helper to check if current user is admin on client-side (Security is enforced by Firestore Rules)
// Since we don't have direct access to auth state here, we rely on the component passing the profile
// or the backend rules rejecting the request.

/**
 * Fetch all users (Admin only) with Pagination
 */
export const adminGetAllUsers = async (
    lastDoc?: QueryDocumentSnapshot, 
    pageSize: number = 20
): Promise<{ users: UserProfile[], lastVisible: QueryDocumentSnapshot | null }> => {
  try {
    let q = query(collection(db, "users"), orderBy("credits", "desc"), limit(pageSize));
    
    if (lastDoc) {
        q = query(collection(db, "users"), orderBy("credits", "desc"), startAfter(lastDoc), limit(pageSize));
    }

    const snapshot = await getDocs(q);
    const users: UserProfile[] = [];
    snapshot.forEach(doc => {
      users.push(doc.data() as UserProfile);
    });
    
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    return { users, lastVisible };
  } catch (error) {
    console.error("Admin: Failed to fetch users", error);
    throw error;
  }
};

/**
 * Search user by nickname (Admin only)
 */
export const adminSearchUsers = async (searchTerm: string): Promise<UserProfile[]> => {
  try {
    // Firestore doesn't support partial text search natively well.
    // We will exact match or rely on client side filtering if the list is small.
    // For this implementation, let's fetch recent users and filter client side or exact match ID.
    
    // Try to find by UID first
    const docRef = doc(db, "users", searchTerm);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return [docSnap.data() as UserProfile];
    }

    // Fallback: Fetch a batch and filter (Not efficient for production but works for small apps)
    const q = query(collection(db, "users"), limit(200));
    const snapshot = await getDocs(q);
    const users: UserProfile[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as UserProfile;
      if (data.nickname.toLowerCase().includes(searchTerm.toLowerCase())) {
          users.push(data);
      }
    });
    return users;
  } catch (error) {
    console.error("Admin: Search failed", error);
    throw error;
  }
};

/**
 * Update user profile (Admin only)
 */
export const adminUpdateUser = async (uid: string, data: Partial<UserProfile>) => {
  try {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, data);
  } catch (error) {
    console.error("Admin: Update user failed", error);
    throw error;
  }
};

/**
 * Batch update user credits (Admin only)
 * Uses WriteBatch for atomicity.
 * @param uids Array of user IDs
 * @param amount Amount to adjust or set
 * @param mode 'adjust' (increment/decrement) or 'set' (overwrite)
 */
export const adminBatchUpdateCredits = async (uids: string[], amount: number, mode: 'adjust' | 'set' = 'adjust') => {
  try {
    // Firestore batch limit is 500
    const BATCH_SIZE = 500;
    
    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
        const chunk = uids.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(uid => {
          const ref = doc(db, "users", uid);
          if (mode === 'set') {
            // Overwrite the credits value
            batch.update(ref, { credits: amount });
          } else {
            // If amount is positive, we add. If negative, we subtract.
            // Using increment allows concurrency safety.
            batch.update(ref, { credits: increment(amount) });
          }
        });

        await batch.commit();
    }
  } catch (error) {
    console.error("Admin: Batch update credits failed", error);
    throw error;
  }
};

/**
 * Delete user data from Firestore (Admin only)
 * Note: This does NOT delete the Auth account (requires Cloud Functions).
 */
export const adminDeleteUser = async (uid: string) => {
  try {
    const ref = doc(db, "users", uid);
    await deleteDoc(ref);
  } catch (error) {
    console.error("Admin: Delete user failed", error);
    throw error;
  }
};

/**
 * Update a specific game score manually (Admin only)
 */
export const adminUpdateScore = async (gameId: string, userId: string, newScore: number) => {
  try {
    const ref = doc(db, "games", gameId, "leaderboard", userId);
    await updateDoc(ref, { score: newScore });
  } catch (error) {
    console.error("Admin: Update score failed", error);
    throw error;
  }
};

/**
 * Delete a score entry (Admin only)
 */
export const adminDeleteScore = async (gameId: string, userId: string) => {
  try {
    const ref = doc(db, "games", gameId, "leaderboard", userId);
    await deleteDoc(ref);
  } catch (error) {
    console.error("Admin: Delete score failed", error);
    throw error;
  }
};

/**
 * Clear entire leaderboard for a game (Admin only)
 */
export const adminClearLeaderboard = async (gameId: string) => {
  try {
    const ref = collection(db, "games", gameId, "leaderboard");
    const snapshot = await getDocs(ref);
    
    // Firestore batch limit is 500 operations
    const BATCH_SIZE = 500;
    const docs = snapshot.docs;
    
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }
  } catch (error) {
    console.error("Admin: Clear leaderboard failed", error);
    throw error;
  }
};

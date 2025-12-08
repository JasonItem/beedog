import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { UserProfile } from "./userService";

export interface GameScore {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  score: number;
  timestamp: any;
}

/**
 * Saves a score if it is a personal best for the user in the specific game.
 * Uses a subcollection structure: games/{gameId}/leaderboard/{userId}
 */
export const saveHighScore = async (userProfile: UserProfile, gameId: string, score: number): Promise<boolean> => {
  if (!userProfile) return false;

  // Use a subcollection path to group scores by game automatically.
  // Path: games/{gameId}/leaderboard/{userId}
  // This avoids the need for composite indexes.
  const scoreRef = doc(db, "games", gameId, "leaderboard", userProfile.uid);
  const scoreSnap = await getDoc(scoreRef);

  let isNewRecord = false;
  let needsProfileUpdate = false;
  const currentData = scoreSnap.data();

  if (scoreSnap.exists()) {
    // Check if new score is higher than existing score
    if (score > (currentData?.score || 0)) {
      isNewRecord = true;
    } else {
        // If not a new record, check if profile info (avatar/nickname) is outdated
        // This ensures the leaderboard always shows the latest user info
        if (currentData?.nickname !== userProfile.nickname || currentData?.avatarUrl !== (userProfile.avatarUrl || null)) {
            needsProfileUpdate = true;
        }
    }
  } else {
    isNewRecord = true;
  }

  if (isNewRecord) {
    await setDoc(scoreRef, {
      userId: userProfile.uid,
      nickname: userProfile.nickname,
      avatarUrl: userProfile.avatarUrl || null,
      score: score,
      timestamp: Timestamp.now()
    });
    return true;
  } else if (needsProfileUpdate) {
      // Just update the metadata without changing the score
      await updateDoc(scoreRef, {
          nickname: userProfile.nickname,
          avatarUrl: userProfile.avatarUrl || null
      });
  }

  return false;
};

/**
 * Fetches the top scores for a specific game.
 * No composite index required because we query a specific subcollection path and sort by one field.
 */
export const getLeaderboard = async (gameId: string, limitCount: number = 20): Promise<GameScore[]> => {
  const q = query(
    collection(db, "games", gameId, "leaderboard"),
    orderBy("score", "desc"),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const scores: GameScore[] = [];

  querySnapshot.forEach((doc) => {
    scores.push(doc.data() as GameScore);
  });

  return scores;
};
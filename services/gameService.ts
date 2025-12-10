
import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, Timestamp, getCountFromServer, increment } from "firebase/firestore";
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
 * Returns true if a new high score was set.
 */
export const saveHighScore = async (userProfile: UserProfile, gameId: string, score: number): Promise<boolean> => {
  if (!userProfile) return false;

  try {
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
  } catch (error) {
    console.warn(`Failed to save high score for ${gameId}:`, error);
  }

  return false;
};

/**
 * Updates a cumulative score (adds to existing).
 * Used for grinding games like Coin Pusher.
 */
export const updateCumulativeScore = async (userProfile: UserProfile, gameId: string, earnedAmount: number): Promise<void> => {
  if (!userProfile || earnedAmount <= 0) return;

  try {
    const scoreRef = doc(db, "games", gameId, "leaderboard", userProfile.uid);
    const scoreSnap = await getDoc(scoreRef);

    if (scoreSnap.exists()) {
      await updateDoc(scoreRef, {
        score: increment(earnedAmount),
        nickname: userProfile.nickname,
        avatarUrl: userProfile.avatarUrl || null,
        timestamp: Timestamp.now()
      });
    } else {
      await setDoc(scoreRef, {
        userId: userProfile.uid,
        nickname: userProfile.nickname,
        avatarUrl: userProfile.avatarUrl || null,
        score: earnedAmount,
        timestamp: Timestamp.now()
      });
    }
  } catch (error) {
    console.warn(`Failed to update cumulative score for ${gameId}:`, error);
  }
};

/**
 * Gets a specific user's score for a game.
 */
export const getUserHighScore = async (gameId: string, userId: string): Promise<number> => {
  try {
    const scoreRef = doc(db, "games", gameId, "leaderboard", userId);
    const scoreSnap = await getDoc(scoreRef);
    if (scoreSnap.exists()) {
      return scoreSnap.data().score || 0;
    }
  } catch (error) {
    console.warn(`Failed to get user score for ${gameId}:`, error);
  }
  return 0;
};

/**
 * Fetches the top scores for a specific game.
 * No composite index required because we query a specific subcollection path and sort by one field.
 */
export const getLeaderboard = async (gameId: string, limitCount: number = 20): Promise<GameScore[]> => {
  try {
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
  } catch (error) {
    console.warn(`Failed to fetch leaderboard for ${gameId}`, error);
    return [];
  }
};

/**
 * Gets the total number of players (documents) in a game's leaderboard.
 */
export const getPlayerCount = async (gameId: string): Promise<number> => {
  try {
    const coll = collection(db, "games", gameId, "leaderboard");
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  } catch (error) {
    // console.error(`Failed to get count for ${gameId}`, error); // Silenced to prevent spam
    return 0;
  }
};

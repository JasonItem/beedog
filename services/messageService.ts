
import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, limit, startAfter, Timestamp, writeBatch, QueryDocumentSnapshot } from "firebase/firestore";
import { UserProfile } from "./userService";

export interface Message {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl?: string;
  content: string;
  timestamp: any;
}

const COLLECTION_NAME = "messages";

/**
 * Add a new message (Authenticated users)
 */
export const addMessage = async (user: UserProfile, content: string) => {
  if (!content.trim()) throw new Error("Content cannot be empty");
  
  await addDoc(collection(db, COLLECTION_NAME), {
    userId: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl || null,
    content: content.trim().slice(0, 500), // Limit to 500 chars
    timestamp: Timestamp.now()
  });
};

/**
 * Fetch messages with pagination (Public)
 */
export const getMessages = async (
  lastDoc?: QueryDocumentSnapshot, 
  pageSize: number = 10
): Promise<{ messages: Message[], lastVisible: QueryDocumentSnapshot | null }> => {
  let q = query(
    collection(db, COLLECTION_NAME), 
    orderBy("timestamp", "desc"), 
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(
        collection(db, COLLECTION_NAME), 
        orderBy("timestamp", "desc"), 
        startAfter(lastDoc), 
        limit(pageSize)
    );
  }

  const snapshot = await getDocs(q);
  const messages: Message[] = [];
  snapshot.forEach(doc => {
    messages.push({ id: doc.id, ...doc.data() } as Message);
  });

  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible };
};

/**
 * Delete a message (Admin only)
 */
export const deleteMessage = async (messageId: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, messageId));
};

/**
 * Batch delete messages (Admin only)
 */
export const adminBatchDeleteMessages = async (ids: string[]) => {
  const batch = writeBatch(db);
  ids.forEach(id => {
    const ref = doc(db, COLLECTION_NAME, id);
    batch.delete(ref);
  });
  await batch.commit();
};

import { db } from "../firebaseConfig";
import { 
    doc, 
    setDoc, 
    updateDoc, 
    Timestamp,
    increment,
    collection,
    query,
    where,
    onSnapshot,
    limit,
    getDocs,
    getDoc,
    orderBy,
    startAfter,
    QueryDocumentSnapshot
} from "firebase/firestore";
import { UserProfile } from "./userService";
import { saveScore } from "./gameService";

export type GomokuSide = 1 | 2; // 1: Black (Bee), 2: White (Wasp)

export interface GomokuRoom {
    id: string;
    code: string;
    status: 'waiting' | 'ready' | 'playing' | 'finished';
    players: {
        black: string | null;
        white: string | null;
    };
    playerData: {
        black: { nickname: string; avatar?: string; points: number; credits: number } | null;
        white: { nickname: string; avatar?: string; points: number; credits: number } | null;
    };
    turn: GomokuSide;
    board: number[]; // 225 elements for 15x15
    history: number[];
    lastMoveAt: any;
    winner: string | null;
    winReason: 'five_in_a_row' | 'surrender' | 'escape' | null;
    host: string;
    wager: number;
}

export const getGomokuTierInfo = (points: number = 0) => {
    const TIERS = [
      { name: '青铜', color: 'text-orange-700', bg: 'bg-orange-700/10' },
      { name: '白银', color: 'text-slate-400', bg: 'bg-slate-400/10' },
      { name: '黄金', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
      { name: '铂金', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
      { name: '钻石', color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { name: '大师', color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { name: '宗师', color: 'text-pink-500', bg: 'bg-pink-500/10' },
      { name: '王者', color: 'text-red-500', bg: 'bg-red-500/20' }
    ];
    const POINTS_PER_STAR = 50;
    const STARS_PER_TIER = 5;
    const POINTS_PER_TIER = POINTS_PER_STAR * STARS_PER_TIER;
    let tierIdx = Math.floor(points / POINTS_PER_TIER);
    if (tierIdx >= TIERS.length) tierIdx = TIERS.length - 1;
    const tier = TIERS[tierIdx];
    const stars = Math.floor((points % POINTS_PER_TIER) / POINTS_PER_STAR);
    return { ...tier, stars: tierIdx === TIERS.length - 1 ? '∞' : stars + 1, points };
};

export const checkWin = (board: number[], idx: number, side: number) => {
    const r = Math.floor(idx / 15);
    const c = idx % 15;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
        let count = 1;
        // Forward
        for (let i = 1; i < 5; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr * 15 + nc] === side) count++;
            else break;
        }
        // Backward
        for (let i = 1; i < 5; i++) {
            const nr = r - dr * i, nc = c - dc * i;
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr * 15 + nc] === side) count++;
            else break;
        }
        if (count >= 5) return true;
    }
    return false;
};

export const createGomokuRoom = async (user: UserProfile, wager: number = 0): Promise<string> => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const roomRef = doc(db, "gomoku_rooms", code);
    const initialRoom: GomokuRoom = {
        id: code, code, status: 'waiting',
        players: { black: user.uid, white: null },
        playerData: {
            black: { nickname: user.nickname, avatar: user.avatarUrl, points: user.gomokuPoints || 0, credits: user.credits },
            white: null
        },
        turn: 1, board: new Array(225).fill(0), history: [],
        lastMoveAt: Timestamp.now(), winner: null, winReason: null, host: user.uid, wager
    };
    await setDoc(roomRef, initialRoom);
    return code;
};

export const settleOwnGomokuStats = async (user: UserProfile, isWinner: boolean, wager: number) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const freshUser = snap.data() as UserProfile;

    const updates: any = {};
    if (isWinner && wager > 0) updates.credits = increment(wager * 2);
    
    const currentPoints = freshUser.gomokuPoints || 0;
    if (isWinner) updates.gomokuPoints = increment(10);
    else updates.gomokuPoints = increment(currentPoints >= 10 ? -10 : -currentPoints);

    await updateDoc(userRef, updates);
    const finalPoints = isWinner ? currentPoints + 10 : Math.max(0, currentPoints - 10);
    await saveScore(freshUser, 'gomoku', finalPoints);
};

export const subscribeGomokuRooms = (callback: (rooms: GomokuRoom[]) => void) => {
    const q = query(collection(db, "gomoku_rooms"), where("status", "==", "waiting"), limit(20));
    return onSnapshot(q, (snap) => {
        const rooms: GomokuRoom[] = [];
        snap.forEach(d => rooms.push(d.data() as GomokuRoom));
        callback(rooms);
    });
};

export const getGomokuMatchHistory = async (uid: string, lastDoc?: QueryDocumentSnapshot, pageSize: number = 10): Promise<{ rooms: GomokuRoom[], lastVisible: QueryDocumentSnapshot | null }> => {
    // Note: To filter by status and order by time, firestore requires a composite index. 
    // To keep it simple and index-free, we fetch finished rooms and filter client side.
    const q = query(collection(db, "gomoku_rooms"), where("status", "==", "finished"), limit(50));
    const snap = await getDocs(q);
    const allRooms: GomokuRoom[] = [];
    snap.forEach(doc => {
        const data = doc.data() as GomokuRoom;
        if (data.players.black === uid || data.players.white === uid) allRooms.push(data);
    });
    const sorted = allRooms.sort((a, b) => (b.lastMoveAt?.seconds || 0) - (a.lastMoveAt?.seconds || 0));
    
    // For "infinite scroll" feeling without complex pagination for this simple app, 
    // we just return the full list up to 50 items. 
    return { rooms: sorted, lastVisible: null };
};

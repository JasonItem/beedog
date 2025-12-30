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
    orderBy,
    deleteDoc,
    startAfter,
    QueryDocumentSnapshot,
    getDoc
} from "firebase/firestore";
import { UserProfile } from "./userService";
import { saveScore } from "./gameService";

export type Side = 'red' | 'black';

export interface ChessPiece {
    id: string; // Unique ID for animation tracking
    type: 'che' | 'ma' | 'xiang' | 'shi' | 'shuai' | 'pao' | 'bing';
    side: Side;
}

export interface ChessRoom {
    id: string;
    code: string;
    status: 'waiting' | 'ready' | 'playing' | 'finished';
    players: {
        red: string | null;
        black: string | null;
    };
    playerData: {
        red: { nickname: string; avatar?: string; score: number; credits: number; points: number } | null;
        black: { nickname: string; avatar?: string; score: number; credits: number; points: number } | null;
    };
    turn: Side;
    board: (ChessPiece | null)[]; 
    history: string[]; // Store JSON snapshots of previous board states
    undoUsed: {
        red: boolean;
        black: boolean;
    };
    lastMoveAt: any;
    lastAction?: { type: 'move' | 'capture' | 'check' | 'undo'; at: number; by: string; toIdx?: number }; 
    winner: string | null;
    winReason: 'checkmate' | 'surrender' | 'escape' | null;
    host: string;
    wager: number;
    lastEffect?: { type: '吃' | '将'; at: number }; 
}

// --- Tier Logic ---

export const getTierInfo = (points: number = 0) => {
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
    const POINTS_PER_TIER = POINTS_PER_STAR * STARS_PER_TIER; // 250

    let tierIdx = Math.floor(points / POINTS_PER_TIER);
    if (tierIdx >= TIERS.length) tierIdx = TIERS.length - 1;
    
    const tier = TIERS[tierIdx];
    const stars = Math.floor((points % POINTS_PER_TIER) / POINTS_PER_STAR);
    
    return {
        ...tier,
        stars: tierIdx === TIERS.length - 1 ? '∞' : stars + 1,
        points
    };
};

export const posToIdx = (r: number, c: number) => r * 9 + c;
export const idxToPos = (idx: number) => ({ r: Math.floor(idx / 9), c: idx % 9 });

export const getInitialBoard = (): (ChessPiece | null)[] => {
    const board = new Array(90).fill(null);
    const setPiece = (r: number, c: number, type: ChessPiece['type'], side: Side, id: string) => {
        board[r * 9 + c] = { type, side, id };
    };

    // Black pieces (Top)
    setPiece(0, 0, 'che', 'black', 'b_che1'); setPiece(0, 1, 'ma', 'black', 'b_ma1'); setPiece(0, 2, 'xiang', 'black', 'b_xi1'); setPiece(0, 3, 'shi', 'black', 'b_sh1');
    setPiece(0, 4, 'shuai', 'black', 'b_king'); setPiece(0, 5, 'shi', 'black', 'b_sh2'); setPiece(0, 6, 'xiang', 'black', 'b_xi2'); setPiece(0, 7, 'ma', 'black', 'b_ma2'); setPiece(0, 8, 'che', 'black', 'b_che2');
    setPiece(2, 1, 'pao', 'black', 'b_pao1'); setPiece(2, 7, 'pao', 'black', 'b_pao2');
    setPiece(3, 0, 'bing', 'black', 'b_bin1'); setPiece(3, 2, 'bing', 'black', 'b_bin2'); setPiece(3, 4, 'bing', 'black', 'b_bin3'); setPiece(3, 6, 'bing', 'black', 'b_bin4'); setPiece(3, 8, 'bing', 'black', 'b_bin5');

    // Red pieces (Bottom)
    setPiece(9, 0, 'che', 'red', 'r_che1'); setPiece(9, 1, 'ma', 'red', 'r_ma1'); setPiece(9, 2, 'xiang', 'red', 'r_xi1'); setPiece(9, 3, 'shi', 'red', 'r_sh1');
    setPiece(9, 4, 'shuai', 'red', 'r_king'); setPiece(9, 5, 'shi', 'red', 'r_sh2'); setPiece(9, 6, 'xiang', 'red', 'r_xi2'); setPiece(9, 7, 'ma', 'red', 'r_ma2'); setPiece(9, 8, 'che', 'red', 'r_che2');
    setPiece(7, 1, 'pao', 'red', 'r_pao1'); setPiece(7, 7, 'pao', 'red', 'r_pao2');
    setPiece(6, 0, 'bing', 'red', 'r_bin1'); setPiece(6, 2, 'bing', 'red', 'r_bin2'); setPiece(6, 4, 'bing', 'red', 'r_bin3'); setPiece(6, 6, 'bing', 'red', 'r_bin4'); setPiece(6, 8, 'bing', 'red', 'r_bin5');

    return board;
};

export const getRawMoves = (idx: number, board: (ChessPiece | null)[]): number[] => {
    const piece = board[idx];
    if (!piece) return [];
    const { r, c } = idxToPos(idx);
    const moves: number[] = [];

    const isOwn = (targetIdx: number) => {
        if (targetIdx < 0 || targetIdx >= 90) return true;
        return board[targetIdx]?.side === piece.side;
    };
    const isEmpty = (targetIdx: number) => {
        if (targetIdx < 0 || targetIdx >= 90) return false;
        return !board[targetIdx];
    };

    switch (piece.type) {
        case 'che': {
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    const target = posToIdx(nr, nc);
                    if (isEmpty(target)) {
                        moves.push(target);
                    } else {
                        if (!isOwn(target)) moves.push(target);
                        break;
                    }
                    nr += dr; nc += dc;
                }
            }
            break;
        }
        case 'ma': {
            const mDirs = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
            for (const [dr, dc] of mDirs) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
                const legR = r + (Math.abs(dr) === 2 ? dr / 2 : 0);
                const legC = c + (Math.abs(dc) === 2 ? dc / 2 : 0);
                if (board[posToIdx(legR, legC)]) continue;
                const target = posToIdx(nr, nc);
                if (!isOwn(target)) moves.push(target);
            }
            break;
        }
        case 'pao': {
            const pDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of pDirs) {
                let nr = r + dr, nc = c + dc;
                let over = false;
                while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    const target = posToIdx(nr, nc);
                    if (!over) {
                        if (isEmpty(target)) moves.push(target);
                        else over = true;
                    } else {
                        if (!isEmpty(target)) {
                            if (!isOwn(target)) moves.push(target);
                            break;
                        }
                    }
                    nr += dr; nc += dc;
                }
            }
            break;
        }
        case 'xiang': {
            const xDirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
            for (const [dr, dc] of xDirs) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
                if (piece.side === 'red' && nr < 5) continue;
                if (piece.side === 'black' && nr > 4) continue;
                if (board[posToIdx(r + dr / 2, c + dc / 2)]) continue;
                const target = posToIdx(nr, nc);
                if (!isOwn(target)) moves.push(target);
            }
            break;
        }
        case 'shi': {
            const sDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            for (const [dr, dc] of sDirs) {
                const nr = r + dr, nc = c + dc;
                if (nc < 3 || nc > 5) continue;
                if (piece.side === 'red' && nr < 7) continue;
                if (piece.side === 'black' && nr > 2) continue;
                const target = posToIdx(nr, nc);
                if (!isOwn(target)) moves.push(target);
            }
            break;
        }
        case 'shuai': {
            const kDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of kDirs) {
                const nr = r + dr, nc = c + dc;
                if (nc < 3 || nc > 5) continue;
                if (piece.side === 'red' && nr < 7) continue;
                if (piece.side === 'black' && nr > 2) continue;
                const target = posToIdx(nr, nc);
                if (!isOwn(target)) moves.push(target);
            }
            break;
        }
        case 'bing': {
            const forwardStep = piece.side === 'red' ? -1 : 1;
            const nr = r + forwardStep;
            if (nr >= 0 && nr < 10) {
                const fTarget = posToIdx(nr, c);
                if (!isOwn(fTarget)) moves.push(fTarget);
            }
            const hasCrossedRiver = piece.side === 'red' ? r <= 4 : r >= 5;
            if (hasCrossedRiver) {
                const sideDirs = [-1, 1]; 
                for (const dc of sideDirs) {
                    const nc = c + dc;
                    if (nc >= 0 && nc < 9) {
                        const sTarget = posToIdx(r, nc);
                        if (!isOwn(sTarget)) moves.push(sTarget);
                    }
                }
            }
            break;
        }
    }
    return moves;
};

export const isCheck = (side: Side, board: (ChessPiece | null)[]): boolean => {
    if (!board) return false;
    const kingIdx = board.findIndex(p => p?.type === 'shuai' && p.side === side);
    if (kingIdx === -1) return false;
    for (let i = 0; i < 90; i++) {
        const piece = board[i];
        if (piece && piece.side !== side) {
            const moves = getRawMoves(i, board);
            if (moves.includes(kingIdx)) return true;
        }
    }
    const opponentSide: Side = side === 'red' ? 'black' : 'red';
    const opponentKingIdx = board.findIndex(p => p?.type === 'shuai' && p.side === opponentSide);
    if (opponentKingIdx === -1) return false;
    const kPos = idxToPos(kingIdx);
    const okPos = idxToPos(opponentKingIdx);
    if (kPos.c === okPos.c) {
        let blocked = false;
        const minR = Math.min(kPos.r, okPos.r);
        const maxR = Math.max(kPos.r, okPos.r);
        for (let r = minR + 1; r < maxR; r++) {
            if (board[posToIdx(r, kPos.c)]) { blocked = true; break; }
        }
        if (!blocked) return true;
    }
    return false;
};

export const getLegalMoves = (idx: number, board: (ChessPiece | null)[]): number[] => {
    const piece = board[idx];
    if (!piece) return [];
    const rawMoves = getRawMoves(idx, board);
    return rawMoves.filter(targetIdx => {
        const nextBoard = [...board];
        nextBoard[targetIdx] = piece;
        nextBoard[idx] = null;
        return !isCheck(piece.side, nextBoard);
    });
};

export const hasAnyLegalMoves = (side: Side, board: (ChessPiece | null)[]): boolean => {
    for (let i = 0; i < 90; i++) {
        const piece = board[i];
        if (piece && piece.side === side) {
            const moves = getLegalMoves(i, board);
            if (moves.length > 0) return true;
        }
    }
    return false;
};

export const createChessRoom = async (user: UserProfile, wager: number = 0): Promise<string> => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const roomRef = doc(db, "chess_rooms", code);
    const initialRoom: ChessRoom = {
        id: code, code, status: 'waiting',
        players: { red: user.uid, black: null },
        playerData: {
            red: { 
                nickname: user.nickname || "匿名蜜蜂", 
                avatar: user.avatarUrl || "", 
                score: user.credits || 0, 
                credits: user.credits || 0,
                points: user.chessPoints || 0
            },
            black: null
        },
        turn: 'red', board: getInitialBoard(), history: [],
        undoUsed: { red: false, black: false },
        lastMoveAt: Timestamp.now(), winner: null, winReason: null, host: user.uid, wager: wager
    };
    await setDoc(roomRef, initialRoom);
    return code;
};

export const startChessGame = async (roomId: string) => {
    await updateDoc(doc(db, "chess_rooms", roomId), { status: 'playing', lastMoveAt: Timestamp.now() });
};

export const settleOwnChessStats = async (user: UserProfile, isWinner: boolean, wager: number) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const freshUser = snap.data() as UserProfile;
    const updates: any = {};
    if (isWinner && wager > 0) updates.credits = increment(wager * 2);
    if (isWinner) updates.chessPoints = increment(10);
    else {
        const currentPoints = freshUser.chessPoints || 0;
        const decrement = currentPoints >= 10 ? -10 : -currentPoints;
        updates.chessPoints = increment(decrement);
    }
    await updateDoc(userRef, updates);
    const finalPoints = isWinner ? (freshUser.chessPoints || 0) + 10 : Math.max(0, (freshUser.chessPoints || 0) - 10);
    await saveScore(freshUser, 'bee_chess', finalPoints);
};

export const subscribeToWaitingRooms = (callback: (rooms: ChessRoom[]) => void) => {
    const q = query(collection(db, "chess_rooms"), where("status", "==", "waiting"), limit(20));
    return onSnapshot(q, (snapshot) => {
        const rooms: ChessRoom[] = [];
        snapshot.forEach(doc => rooms.push(doc.data() as ChessRoom));
        callback(rooms);
    });
};

export const getUserMatchHistory = async (uid: string): Promise<{ rooms: ChessRoom[] }> => {
    const q = query(collection(db, "chess_rooms"), where("status", "==", "finished"), limit(50));
    const snap = await getDocs(q);
    const allRooms: ChessRoom[] = [];
    snap.forEach(doc => {
        const data = doc.data() as ChessRoom; 
        if (data.players.black === uid || data.players.red === uid) allRooms.push(data);
    });
    const sorted = allRooms.sort((a, b) => (b.lastMoveAt?.seconds || 0) - (a.lastMoveAt?.seconds || 0));
    return { rooms: sorted };
};

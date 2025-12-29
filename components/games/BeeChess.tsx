import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../../services/userService';
import { 
    ChessRoom, 
    Side, 
    settleChessGame,
    startChessGame,
    getLegalMoves,
    isCheck,
    idxToPos,
    getInitialBoard,
    subscribeToWaitingRooms,
    getUserMatchHistory,
    posToIdx,
    hasAnyLegalMoves,
    getTierInfo,
    ChessPiece
} from '../../services/chessService';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { deductCredit } from '../../services/userService';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { 
    Copy, Check, Loader2, Trophy, ShieldAlert, User, LogOut, Sword, Coins, Play, Share2, AlertCircle, Zap, Users, Search, History, Home, PlusCircle, Trash2, X as XIcon, Lock, AlertTriangle, Minimize2, Sparkles, Star
} from 'lucide-react';
import { createChessRoom } from '../../services/chessService';

interface BeeChessProps {
    userProfile: UserProfile | null;
    onGameOver: () => void;
}

type Tab = 'LOBBY' | 'CREATE' | 'PROFILE';

const RED_LABELS: Record<string, string> = {
    'che': '俥', 'ma': '傌', 'xiang': '相', 'shi': '仕', 'shuai': '帅', 'pao': '炮', 'bing': '兵'
};
const BLACK_LABELS: Record<string, string> = {
    'che': '車', 'ma': '馬', 'xiang': '象', 'shi': '士', 'shuai': '将', 'pao': '砲', 'bing': '卒'
};

export const BeeChess: React.FC<BeeChessProps> = ({ userProfile, onGameOver }) => {
    const [activeTab, setActiveTab] = useState<Tab>('LOBBY');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [room, setRoom] = useState<ChessRoom | null>(null);
    const [loading, setLoading] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [wagerInput, setWagerInput] = useState<number>(500);
    const [mySide, setMySide] = useState<Side | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [legalMoves, setLegalMoves] = useState<number[]>([]);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [bigEffect, setBigEffect] = useState<'吃' | '将' | null>(null);
    const [waitingRooms, setWaitingRooms] = useState<ChessRoom[]>([]);
    const [matchHistory, setMatchHistory] = useState<ChessRoom[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [confirmQuitStage, setConfirmQuitStage] = useState(0); 
    
    // Win Animation States
    const [showVictoryAnim, setShowVictoryAnim] = useState(false);
    const [animFinished, setAnimFinished] = useState(false);

    const roomIdRef = useRef<string | null>(null);
    const roomRef = useRef<ChessRoom | null>(null);
    const userRef = useRef<UserProfile | null>(userProfile);
    const hasPaidRef = useRef(false);
    const lastActionAtRef = useRef<number>(0);
    const rewardClaimedRef = useRef<boolean>(false);
    const confirmTimerRef = useRef<any>(null);

    useEffect(() => { userRef.current = userProfile; }, [userProfile]);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
    useEffect(() => { roomRef.current = room; }, [room]);

    useEffect(() => {
        if (!userProfile) return;
        const unsubscribe = subscribeToWaitingRooms(setWaitingRooms);
        return () => unsubscribe();
    }, [userProfile]);

    useEffect(() => {
        if (activeTab === 'PROFILE' && userProfile) {
            setHistoryLoading(true);
            getUserMatchHistory(userProfile.uid)
                .then(res => setMatchHistory(res.rooms))
                .finally(() => setHistoryLoading(false));
        }
    }, [activeTab, userProfile]);

    useEffect(() => {
        if (!roomId || !userProfile) { 
            hasPaidRef.current = false; 
            rewardClaimedRef.current = false; 
            setAnimFinished(false);
            setShowVictoryAnim(false);
            return; 
        }
        const unsubscribe = onSnapshot(doc(db, "chess_rooms", roomId), (docSnap) => {
            if (docSnap.exists()) {
                const roomData = docSnap.data() as ChessRoom;
                setRoom(roomData);

                // --- AUDIO & EFFECT TRIGGER ---
                if (roomData.lastAction && roomData.lastAction.at > lastActionAtRef.current) {
                    lastActionAtRef.current = roomData.lastAction.at;
                    
                    // Only play audio if the action was made by the opponent (local user plays it in handleTileClick)
                    if (roomData.lastAction.by !== userProfile.uid) {
                        if (roomData.lastAction.type === 'capture') audio.playScore();
                        else if (roomData.lastAction.type === 'move') audio.playStep();
                    }

                    if (roomData.lastAction.type === 'check') {
                        setBigEffect('将');
                        audio.playJump();
                        setTimeout(() => setBigEffect(null), 800);
                    }
                }

                if (roomData.lastEffect && roomData.lastEffect.at > lastActionAtRef.current) {
                    // Legacy support
                    setBigEffect(roomData.lastEffect.type);
                    setTimeout(() => setBigEffect(null), 800);
                }

                // 检测游戏结束并触发特效
                if (roomData.status === 'finished' && !animFinished && !showVictoryAnim) {
                    if (roomData.winReason === 'checkmate') {
                        setShowVictoryAnim(true);
                        audio.playScore();
                        setTimeout(() => {
                            setShowVictoryAnim(false);
                            setAnimFinished(true);
                        }, 2500);
                    } else {
                        setAnimFinished(true);
                    }
                }

                if (roomData.status === 'finished' && roomData.winner === userProfile.uid && !rewardClaimedRef.current) {
                    rewardClaimedRef.current = true;
                    // Find loser
                    const loserUid = roomData.winner === roomData.players.red ? roomData.players.black : roomData.players.red;
                    if (loserUid) {
                        settleChessGame(roomData.id, userProfile.uid, loserUid, roomData.wager);
                    }
                }

                if (userRef.current) {
                    const isRed = roomData.players.red === userRef.current.uid;
                    setMySide(isRed ? 'red' : 'black');
                    if (roomData.status === 'playing' && !isRed && !hasPaidRef.current && roomData.wager > 0) {
                        hasPaidRef.current = true;
                        deductCredit(userRef.current.uid, roomData.wager).then(s => {
                            if (s) showNotif(`已下注 ${roomData.wager} 蜂蜜`);
                        });
                    }
                }
            } else { 
                setRoomId(null); 
                setRoom(null); 
                setAnimFinished(false);
                setShowVictoryAnim(false);
            }
        });
        return () => unsubscribe();
    }, [roomId, userProfile, animFinished, showVictoryAnim]);

    const performCleanup = async (targetId: string, currentRoom: ChessRoom | null, u: UserProfile | null) => {
        if (!u || !targetId) return;
        const docRef = doc(db, "chess_rooms", targetId);
        try {
            if (currentRoom?.status === 'playing') {
                const opponent = u.uid === currentRoom.players.red ? currentRoom.players.black : currentRoom.players.red;
                if (opponent) await updateDoc(docRef, { status: 'finished', winner: opponent, winReason: 'escape' });
            } else if (currentRoom?.host === u.uid) {
                await deleteDoc(docRef);
            } else if (currentRoom && currentRoom.players.black === u.uid) {
                await updateDoc(docRef, { "players.black": null, "playerData.black": null, status: 'waiting' });
            }
        } catch (e) { console.error("Chess Cleanup failed", e); }
    };

    useEffect(() => {
        const handleBrowserCleanup = () => { if (roomIdRef.current) performCleanup(roomIdRef.current, roomRef.current, userRef.current); };
        window.addEventListener('beforeunload', handleBrowserCleanup);
        return () => {
            window.removeEventListener('beforeunload', handleBrowserCleanup);
            handleBrowserCleanup();
        };
    }, []);

    const handleHost = async () => {
        if (!userProfile) return;
        if (wagerInput < 500) { setError("最低下注门槛为 500"); return; }
        if (wagerInput > userProfile.credits) { setError(`余额不足`); return; }
        setLoading(true);
        try { const code = await createChessRoom(userProfile, wagerInput); setRoomId(code); } 
        catch (e) { setError("创建失败"); } finally { setLoading(false); }
    };

    const handleJoin = async (targetCode?: string) => {
        const code = targetCode || joinCode;
        if (!userProfile || !code) return;
        setLoading(true);
        try {
            const roomRef = doc(db, "chess_rooms", code);
            const snap = await getDoc(roomRef);
            if (!snap.exists()) { setError("房间不存在"); return; }
            const data = snap.data() as ChessRoom;
            if (data.players.red === userProfile.uid) { setRoomId(code); return; }
            if (data.status !== 'waiting') { setError("无法加入"); return; }
            if (userProfile.credits < data.wager) { setError(`余额不足`); return; }
            await updateDoc(roomRef, { 
                "players.black": userProfile.uid, 
                "playerData.black": { 
                    nickname: userProfile.nickname || "匿名玩家", 
                    avatar: userProfile.avatarUrl || "", 
                    score: userProfile.credits || 0, 
                    credits: userProfile.credits,
                    points: userProfile.chessPoints || 0
                }, 
                status: 'ready', 
                lastMoveAt: Timestamp.now() 
            });
            setRoomId(code);
        } catch (e) { setError("加入失败"); } finally { setLoading(false); }
    };

    const handleStartGame = async () => {
        if (!room || !userProfile || room.status !== 'ready') return;
        setLoading(true);
        try {
            if (room.wager > 0 && !hasPaidRef.current) {
                const success = await deductCredit(userProfile.uid, room.wager);
                if (!success) { setError("支付失败"); setLoading(false); return; }
                hasPaidRef.current = true;
            }
            await startChessGame(room.id);
            audio.playJump();
        } catch (e) { setError("开始失败"); } finally { setLoading(false); }
    };

    const handleTileClick = async (idx: number) => {
        if (!room || !mySide || room.status !== 'playing' || room.turn !== mySide) return;
        const piece = room.board[idx];
        if (piece && piece.side === mySide) {
            setSelectedIdx(idx);
            setLegalMoves(getLegalMoves(idx, room.board));
            audio.playStep();
            return;
        }
        if (selectedIdx !== null && legalMoves.includes(idx)) {
            const newBoard = [...room.board];
            const movingPiece = newBoard[selectedIdx];
            const targetPiece = newBoard[idx];
            newBoard[idx] = movingPiece;
            newBoard[selectedIdx] = null;
            const nextTurn = room.turn === 'red' ? 'black' : 'red';
            const updates: any = { 
                board: newBoard, 
                turn: nextTurn, 
                lastMoveAt: Timestamp.now(),
                lastAction: { 
                    at: Date.now(), 
                    by: userProfile?.uid,
                    type: targetPiece ? 'capture' : 'move'
                }
            };

            const isTargetKing = targetPiece?.type === 'shuai';
            const opponentHasMoves = !hasAnyLegalMoves(nextTurn, newBoard);

            if (isTargetKing || opponentHasMoves) {
                updates.status = 'finished';
                updates.winner = userProfile?.uid;
                updates.winReason = 'checkmate';
            } else {
                if (targetPiece) {
                    updates.lastEffect = { type: '吃', at: Date.now() };
                    audio.playScore();
                } else if (isCheck(nextTurn, newBoard)) {
                    updates.lastAction.type = 'check';
                    audio.playJump();
                } else {
                    audio.playStep();
                }
            }
            await updateDoc(doc(db, "chess_rooms", room.id), updates);
            setSelectedIdx(null); setLegalMoves([]);
        } else { setSelectedIdx(null); setLegalMoves([]); }
    };

    const handleQuitRoom = async () => {
        if (confirmQuitStage === 0) {
            setConfirmQuitStage(1);
            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
            confirmTimerRef.current = setTimeout(() => setConfirmQuitStage(0), 3000);
            return;
        }
        const id = roomId; const r = room; const u = userProfile;
        if (id) await performCleanup(id, r, u);
        setRoomId(null); setRoom(null); setConfirmQuitStage(0);
    };

    const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

    const renderBoard = (isInteractive: boolean = true) => {
        if (!room) return null;
        
        // Find all moveable pieces for local turn
        const isMyTurn = room.turn === mySide;
        const moveableIndices = isMyTurn ? room.board.map((p, i) => (p && p.side === mySide && getLegalMoves(i, room.board).length > 0) ? i : -1).filter(i => i !== -1) : [];

        return (
            <div className="relative aspect-[9/10] w-full max-w-[400px] mx-auto bg-[#fce9b2] rounded-xl border-4 border-[#854d0e] shadow-2xl overflow-hidden">
                {bigEffect && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[100px] font-black text-red-600 z-[100] drop-shadow-2xl animate-in zoom-in pointer-events-none" style={{textShadow: '0 0 20px rgba(255,0,0,0.5)'}}>{bigEffect}</div>}
                <div className="absolute inset-0 p-[5.5%] pointer-events-none">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 8 9" preserveAspectRatio="none">
                        {[0,1,2,3,4,5,6,7,8].map(i => (<line key={`v-${i}`} x1={i} y1="0" x2={i} y2="9" stroke="#854d0e" strokeWidth="0.04" />))}
                        {[0,1,2,3,4,5,6,7,8,9].map(i => (<line key={`h-${i}`} x1="0" y1={i} x2="8" y2={i} stroke="#854d0e" strokeWidth="0.04" />))}
                        <line x1="3" y1="0" x2="5" y2="2" stroke="#854d0e" strokeWidth="0.04" /><line x1="5" y1="0" x2="3" y2="2" stroke="#854d0e" strokeWidth="0.04" />
                        <line x1="3" y1="7" x2="5" y2="9" stroke="#854d0e" strokeWidth="0.04" /><line x1="5" y1="7" x2="3" y2="9" stroke="#854d0e" strokeWidth="0.04" />
                        <line x1="0" y1="4" x2="8" y2="4" stroke="#854d0e" strokeWidth="0.08" /><line x1="0" y1="5" x2="8" y2="5" stroke="#854d0e" strokeWidth="0.08" />
                    </svg>
                    <div className="absolute top-[44.5%] left-0 w-full h-[11%] flex items-center justify-around font-black text-[#854d0e]/40 text-lg md:text-xl tracking-widest px-4">
                        <span>楚 河</span>
                        <span>汉 界</span>
                    </div>
                </div>
                
                {/* 棋子渲染层 - 独立于网格以实现动画 */}
                <div className="absolute inset-0 p-[5.5%] z-20">
                    <div className="relative w-full h-full">
                        {room.board.map((piece, idx) => {
                            if (!piece) return null;
                            const { r, c } = idxToPos(idx);
                            
                            // UI Coordinate calculation
                            const displayRi = mySide === 'red' ? r : 9 - r;
                            const displayCi = mySide === 'red' ? c : 8 - c;
                            
                            const isSelected = selectedIdx === idx;
                            const isMoveable = isInteractive && moveableIndices.includes(idx) && !isSelected;
                            const canClick = isInteractive && piece.side === mySide && room.turn === mySide;

                            return (
                                <div 
                                    key={piece.id} // Use piece.id for stable identification during move animations
                                    onClick={() => isInteractive && handleTileClick(idx)} 
                                    className={`absolute w-[11.1%] aspect-square rounded-full border-2 flex items-center justify-center font-black text-lg md:text-xl shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out z-20 
                                        ${piece.side === 'red' ? 'bg-red-500 text-white border-red-800' : 'bg-neutral-800 text-yellow-500 border-neutral-900'} 
                                        ${isSelected ? 'scale-110 ring-4 ring-yellow-500 z-40 shadow-2xl' : ''} 
                                        ${isMoveable ? 'ring-2 ring-yellow-400/50 animate-pulse' : ''}
                                        ${canClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : 'cursor-default'}
                                    `} 
                                    style={{ 
                                        top: `${(displayRi / 9) * 100}%`, 
                                        left: `${(displayCi / 8) * 100}%` 
                                    }}
                                >
                                    {piece.side === 'red' ? RED_LABELS[piece.type] : BLACK_LABELS[piece.type]}
                                </div>
                            );
                        })}
                        
                        {/* 合法落点提示 */}
                        {isInteractive && legalMoves.map(moveIdx => {
                            const { r, c } = idxToPos(moveIdx);
                            const displayRi = mySide === 'red' ? r : 9 - r;
                            const displayCi = mySide === 'red' ? c : 8 - c;
                            const hasTarget = !!room.board[moveIdx];
                            return (
                                <div key={`move-${moveIdx}`} onClick={() => handleTileClick(moveIdx)} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-30 cursor-pointer w-[11.1%] aspect-square" style={{ top: `${(displayRi / 9) * 100}%`, left: `${(displayCi / 8) * 100}%` }}>
                                    {hasTarget ? <div className="w-10 h-10 border-4 border-green-500 rounded-full animate-ping"></div> : <div className="w-3 h-3 bg-green-500 rounded-full opacity-80 shadow-[0_0_10px_green]"></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {!isInteractive && (
                    <div className="absolute inset-0 z-[60] bg-black/10 flex items-center justify-center backdrop-blur-[1px] transition-all">
                        {room.status === 'ready' && room.host === userProfile?.uid && (
                             <Button onClick={handleStartGame} className="py-6 px-10 text-2xl animate-bounce shadow-2xl bg-brand-yellow text-black border-4 border-black font-black rounded-2xl active:scale-95" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin"/> : <><Play className="mr-2 fill-current"/> 开始对战</>}
                             </Button>
                        )}
                        {room.status === 'ready' && room.host !== userProfile?.uid && (
                            <div className="bg-black/80 text-yellow-400 px-8 py-4 rounded-2xl font-black text-xl border-4 border-yellow-500/50 animate-pulse shadow-2xl">
                                等待房主开球...
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!userProfile) {
        return (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 z-50">
                <div className="bg-white p-4 rounded-full mb-6 shadow-2xl scale-110"><Lock size={40} className="text-amber-500" /></div>
                <h2 className="text-3xl font-black text-white mb-4 drop-shadow-md">开启象棋博弈</h2>
                <p className="text-white/90 mb-8 text-lg font-medium leading-relaxed max-w-[260px]">联机对战需要登录账号。立即登录即可创建房间并设置筹码！</p>
                <div className="w-full max-w-xs space-y-3">
                    <div className="bg-white/10 border border-white/20 p-4 rounded-2xl text-left">
                        <h4 className="text-white font-bold text-sm mb-1 flex items-center gap-2"><Zap size={14}/> 游戏规则:</h4>
                        <ul className="text-xs text-neutral-300 space-y-1">
                            <li>• 创建房间最低门槛为 500 蜂蜜</li>
                            <li>• 赢家获得全部奖池 (筹码 x2)</li>
                            <li>• 竞技对战需要双方持有足够蜂蜜</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    if (roomId) {
        const isHost = room?.host === userProfile?.uid;
        const inCheck = room ? isCheck(room.turn, room.board) : false;
        const isMyTurn = room?.turn === mySide;
        const isReady = room?.status === 'ready';
        const isPlaying = room?.status === 'playing';

        const redTier = getTierInfo(room?.playerData?.red?.points || 0);
        const blackTier = getTierInfo(room?.playerData?.black?.points || 0);

        return (
            <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300 max-w-md mx-auto">
                {/* Checkmate Full-screen Anim */}
                {showVictoryAnim && (
                    <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none overflow-hidden">
                        <div className="relative animate-in zoom-in duration-500 flex flex-col items-center">
                            <Sparkles size={120} className="text-brand-yellow absolute -top-16 animate-pulse opacity-50" />
                            <h1 className="text-[120px] md:text-[160px] font-black text-white tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: '4px #fbbf24', textShadow: '0 0 50px rgba(251,191,36,0.6)' }}>
                                绝杀
                            </h1>
                            <div className="bg-brand-yellow text-black px-8 py-2 rounded-full font-black text-2xl tracking-[0.5em] -mt-8 shadow-2xl animate-bounce">
                                CHECKMATE
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-[#121212] rounded-3xl p-4 shadow-xl border border-neutral-100 dark:border-white/5 flex items-center justify-between w-full z-10">
                    <div className="flex items-center gap-2 max-w-[40%]">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#222] overflow-hidden border-2 border-red-500/50">
                            {room?.playerData?.red?.avatar ? <img src={room.playerData.red.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><User size={20}/></div>}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black text-red-500 truncate">{room?.playerData?.red?.nickname || '红方'}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[9px] font-black px-1.5 rounded-sm ${redTier.bg} ${redTier.color}`}>{redTier.name} {redTier.stars}<Star size={8} className="inline ml-0.5 fill-current"/></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Wager</div>
                        <div className="text-sm font-black text-yellow-600">{room?.wager || 0} 🍯</div>
                    </div>
                    <div className="flex items-center gap-2 text-right max-w-[40%]">
                        <div className="min-w-0 text-right">
                            <div className="text-xs font-black text-neutral-400 truncate">{room?.playerData?.black?.nickname || '黑方'}</div>
                            {room?.playerData?.black && (
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className={`text-[9px] font-black px-1.5 rounded-sm ${blackTier.bg} ${blackTier.color}`}>{blackTier.name} {blackTier.stars}<Star size={8} className="inline ml-0.5 fill-current"/></span>
                                </div>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#222] overflow-hidden border-2 border-neutral-500/50">
                            {room?.playerData?.black?.avatar ? <img src={room.playerData.black.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><User size={20}/></div>}
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                    {room?.status === 'waiting' ? (
                         <div className="flex flex-col items-center justify-center text-center gap-6 py-10 z-10 bg-white/5 rounded-3xl border border-dashed border-white/10 p-6">
                            <div className="w-20 h-20 bg-brand-yellow/10 rounded-full flex items-center justify-center text-brand-yellow animate-pulse"><Share2 size={40} /></div>
                            <div><h3 className="text-2xl font-black dark:text-white">等待对手加入</h3><p className="text-neutral-500 text-sm mt-1">请将房间号发送给好友加入对局</p></div>
                            <div className="bg-white dark:bg-white/5 p-6 rounded-3xl border-2 border-brand-yellow shadow-2xl">
                                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">房间号</div>
                                <div className="text-4xl font-black text-brand-yellow tracking-[0.2em] font-mono">{room.code}</div>
                            </div>
                            <div className="w-full space-y-2">
                                <Button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="w-full py-3">{copied ? <><Check className="mr-2"/> 已复制</> : <><Copy className="mr-2"/> 复制房号</>}</Button>
                                <Button variant="ghost" onClick={handleQuitRoom} className={`w-full py-3 font-bold transition-all relative z-[100] ${confirmQuitStage === 1 ? 'bg-red-600 text-white shadow-lg scale-105' : 'text-red-500'}`}>{confirmQuitStage === 1 ? '确定解散并退出？' : '解散房间'}</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                             <div className="flex justify-center gap-4 items-center h-8">
                                {isPlaying && (
                                    <>
                                        <div className={`px-4 py-1.5 rounded-full font-black text-xs shadow-lg border-2 transition-all ${room.turn === 'red' ? 'bg-red-500 border-red-400 text-white' : 'bg-neutral-800 border-neutral-700 text-yellow-500'}`}>{isMyTurn ? '轮到你了' : `等待对手...`}</div>
                                        {inCheck && <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-lg animate-bounce border border-red-400">将军！</div>}
                                    </>
                                )}
                                {isReady && <div className="px-4 py-1.5 rounded-full font-black text-xs shadow-lg border-2 bg-neutral-800 border-neutral-700 text-yellow-500">准备就绪</div>}
                             </div>
                             {renderBoard(isPlaying)}
                             <div className="mt-2">
                                <Button variant="ghost" onClick={handleQuitRoom} className={`w-full py-4 font-bold transition-all relative z-[100] ${confirmQuitStage === 1 ? 'bg-red-600 text-white shadow-lg scale-105' : 'text-red-500'}`}>
                                    {confirmQuitStage === 1 ? (isPlaying ? '确定认输并退出？' : '确定退出？') : (isPlaying ? '认输并退出' : (isHost ? '解散房间' : '退出房间'))}
                                </Button>
                             </div>
                        </div>
                    )}
                </div>
                {room?.status === 'finished' && animFinished && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-[200]">
                        <Trophy size={100} className="text-brand-yellow mb-4 animate-bounce" />
                        <h3 className="text-5xl font-black text-white mb-2">{room.winner === userProfile?.uid ? "获胜!" : "惜败"}</h3>
                        <div className="bg-white/10 p-8 rounded-[2.5rem] border border-white/20 text-center w-full max-w-xs mb-8">
                            <div className="text-xs font-bold text-neutral-300 uppercase mb-2">对战结算</div>
                            <div className={`text-5xl font-black mb-4 ${room.winner === userProfile?.uid ? 'text-green-400' : 'text-red-400'}`}>
                                {room.winner === userProfile?.uid ? (room.wager > 0 ? `+${room.wager * 2}` : "+0") : (room.wager > 0 ? `-${room.wager}` : "-0")} 🍯
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`px-3 py-1 rounded-lg font-black text-sm flex items-center gap-1 ${room.winner === userProfile?.uid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    <Zap size={14} className={room.winner === userProfile?.uid ? '' : 'rotate-180'}/>
                                    段位积分 {room.winner === userProfile?.uid ? '+10' : '-10'}
                                </span>
                            </div>
                        </div>
                        <Button onClick={() => { setRoomId(null); setRoom(null); onGameOver(); }} className="w-full max-w-xs py-5 text-2xl rounded-3xl">返回大厅</Button>
                    </div>
                )}
            </div>
        );
    }

    const myTier = getTierInfo(userProfile?.chessPoints || 0);

    return (
        <div className="w-full max-w-sm mx-auto min-h-[600px] flex flex-col gap-4 animate-in fade-in duration-300 relative pb-24 z-10">
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 10px; }`}</style>
            {notification && (<div className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] w-max bg-black/80 text-yellow-400 px-4 py-2 rounded-full font-bold text-sm border border-yellow-500/50 shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4"><AlertCircle size={16}/> {notification}</div>)}
            <div className="flex bg-neutral-200 dark:bg-[#222] p-1 rounded-2xl mb-4">
                <button onClick={() => setActiveTab('LOBBY')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'LOBBY' ? 'bg-white dark:bg-[#444] text-black dark:text-white shadow' : 'text-neutral-500'}`}><Home size={18}/> 大厅</button>
                <button onClick={() => setActiveTab('CREATE')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'CREATE' ? 'bg-white dark:bg-[#444] text-black dark:text-white shadow' : 'text-neutral-500'}`}><PlusCircle size={18}/> 创建</button>
                <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'PROFILE' ? 'bg-white dark:bg-[#444] text-black dark:text-white shadow' : 'text-neutral-500'}`}><User size={18}/> 我的</button>
            </div>
            {activeTab === 'LOBBY' && (
                <div className="flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-6 shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col gap-4">
                        <div className="flex gap-2">
                            <input type="number" placeholder="输入房号" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="flex-1 bg-neutral-100 dark:bg-[#222] border-2 border-transparent focus:border-brand-yellow rounded-xl px-4 py-3 outline-none font-bold text-center dark:text-white" />
                            <Button onClick={() => handleJoin()} disabled={loading || !joinCode} className="px-6">{loading ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}</Button>
                        </div>
                        {error && <div className="text-red-500 text-center text-xs font-bold flex items-center justify-center gap-1 bg-red-50 dark:bg-red-900/20 py-2 rounded-lg"><ShieldAlert size={14}/> {error}</div>}
                    </div>
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-6 shadow-xl border border-neutral-200 dark:border-white/10">
                        <h3 className="font-black text-sm flex items-center gap-2 dark:text-white mb-4"><Users size={16} className="text-brand-yellow"/> 等待中对局</h3>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                            {waitingRooms.length === 0 ? <div className="text-center py-12 text-neutral-500 text-xs">暂无待加入的房间</div> : waitingRooms.map(r => {
                                const tier = getTierInfo(r.playerData.red?.points || 0);
                                return (
                                    <div key={r.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#222] rounded-2xl border border-neutral-100 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-neutral-200 overflow-hidden">{r.playerData.red?.avatar ? <img src={r.playerData.red.avatar} className="w-full h-full object-cover"/> : <User size={16}/>}</div>
                                            <div>
                                                <div className="text-sm font-black dark:text-white">{r.playerData.red?.nickname}</div>
                                                <span className={`text-[8px] font-black px-1 rounded-sm ${tier.bg} ${tier.color}`}>{tier.name} {tier.stars}★</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right text-sm font-black text-brand-yellow">{(r.wager || 0) * 2} <Coins size={12} className="inline"/></div>
                                            <button onClick={() => handleJoin(r.code)} className="bg-brand-yellow text-black px-4 py-2 rounded-xl text-xs font-black shadow-lg">加入</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'CREATE' && (
                <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-8 shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col gap-8">
                    <div className="text-center"><PlusCircle size={60} className="text-brand-yellow mx-auto mb-4" /><h2 className="text-3xl font-black dark:text-white">创建新对局</h2></div>
                    <div className="bg-neutral-50 dark:bg-[#222] p-6 rounded-[2rem] border border-neutral-100 dark:border-white/5">
                        <label className="text-xs font-bold text-neutral-400 uppercase mb-4 block flex items-center gap-1"><Coins size={14}/> 设定对战筹码 (WAGER)</label>
                        <div className="flex gap-2 mb-4">{[500, 1000, 2000].map(amt => (<button key={amt} onClick={() => setWagerInput(amt)} className={`flex-1 py-3 rounded-xl text-sm font-black border transition-all ${wagerInput === amt ? 'bg-brand-yellow border-brand-yellow text-black' : 'bg-white dark:bg-[#333] border-neutral-200 dark:border-[#444]'}`}>{amt}</button>))}</div>
                        <input type="number" value={wagerInput} onChange={e => setWagerInput(Math.min(userProfile?.credits || 0, Math.max(500, parseInt(e.target.value) || 500)))} className="w-full bg-white dark:bg-[#333] border-2 border-transparent focus:border-brand-yellow rounded-xl px-5 py-4 outline-none font-black text-lg dark:text-white" />
                        <p className="text-[10px] text-neutral-500 mt-2 text-center">最低下注门槛: 500 🍯</p>
                    </div>
                    <Button onClick={handleHost} className="w-full py-5 text-xl rounded-2xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "立即创建房间"}</Button>
                </div>
            )}
            {activeTab === 'PROFILE' && (
                <div className="flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-8 shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-neutral-100 p-1 border-4 border-brand-yellow mb-4 overflow-hidden">{userProfile.avatarUrl ? <img src={userProfile.avatarUrl} className="w-full h-full object-cover rounded-full" /> : '🐶'}</div>
                        <h2 className="text-2xl font-black dark:text-white">{userProfile.nickname}</h2>
                        
                        <div className={`mt-2 px-4 py-1.5 rounded-full font-black text-sm flex items-center gap-2 ${myTier.bg} ${myTier.color} border-2 border-current/20`}>
                            <Trophy size={14}/> {myTier.name} {myTier.stars} 星
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mt-8">
                            <div className="bg-neutral-50 dark:bg-[#222] p-4 rounded-2xl text-center">
                                <div className="text-xs text-neutral-400 font-bold mb-1">段位积分</div>
                                <div className="text-xl font-black text-purple-500">{userProfile.chessPoints || 0}</div>
                            </div>
                            <div className="bg-neutral-50 dark:bg-[#222] p-4 rounded-2xl text-center">
                                <div className="text-xs text-neutral-400 font-bold mb-1">胜场</div>
                                <div className="text-xl font-black text-green-400">{matchHistory.filter(m => m.winner === userProfile.uid).length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-6 shadow-xl border border-neutral-200 dark:border-white/10">
                        <h3 className="font-black text-sm flex items-center gap-2 dark:text-white mb-4"><History size={16} className="text-brand-yellow"/> 最近战绩</h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {matchHistory.map(m => {
                                const isWin = m.winner === userProfile.uid;
                                return (<div key={m.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#222] rounded-2xl border border-neutral-100 dark:border-white/5"><div className="flex items-center gap-3"><div className={`px-2 py-1 rounded text-[10px] font-black ${isWin ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{isWin ? 'WIN' : 'LOSE'}</div><div className="text-xs font-bold dark:text-white">{userProfile.uid === m.players.red ? (m.playerData.black?.nickname || '匿名') : (m.playerData.red?.nickname || '房主')}</div></div><div className={`font-mono text-sm font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>{isWin ? `+${m.wager*2}` : `-${m.wager}`} 🍯</div></div>);
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

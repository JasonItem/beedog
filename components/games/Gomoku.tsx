import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { 
    GomokuRoom, 
    GomokuSide, 
    createGomokuRoom, 
    checkWin, 
    settleOwnGomokuStats, 
    getGomokuTierInfo, 
    subscribeGomokuRooms,
    getGomokuMatchHistory
} from '../../services/gomokuService';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { audio } from '../../services/audioService';
import { Button } from '../Button';
import { 
    Loader2, Trophy, User, Home, PlusCircle, Search, History, Share2, Copy, Check, Star, Zap, Lock, AlertCircle, ShieldAlert, Coins, RotateCcw
} from 'lucide-react';

interface GomokuProps {
    userProfile: UserProfile | null;
    onGameOver: () => void;
}

export const Gomoku: React.FC<GomokuProps> = ({ userProfile, onGameOver }) => {
    const myTier = getGomokuTierInfo(userProfile?.gomokuPoints || 0);
    const [activeTab, setActiveTab] = useState<'LOBBY' | 'CREATE' | 'PROFILE'>('LOBBY');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [room, setRoom] = useState<GomokuRoom | null>(null);
    const [loading, setLoading] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [wagerInput, setWagerInput] = useState(500);
    const [mySide, setMySide] = useState<GomokuSide | null>(null);
    const [waitingRooms, setWaitingRooms] = useState<GomokuRoom[]>([]);
    const [matchHistory, setMatchHistory] = useState<GomokuRoom[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [confirmQuitStage, setConfirmQuitStage] = useState(0);
    const [confirmUndoStage, setConfirmUndoStage] = useState(0);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasPaidRef = useRef(false);
    const rewardClaimedRef = useRef(false);
    const lastActionAtRef = useRef<number>(0);

    useEffect(() => {
        if (!userProfile) return;
        return subscribeGomokuRooms(setWaitingRooms);
    }, [userProfile]);

    useEffect(() => {
        if (activeTab === 'PROFILE' && userProfile) {
            setHistoryLoading(true);
            getGomokuMatchHistory(userProfile.uid)
                .then(res => setMatchHistory(res.rooms))
                .finally(() => setHistoryLoading(false));
        }
    }, [activeTab, userProfile]);

    useEffect(() => {
        if (!roomId || !userProfile) {
            hasPaidRef.current = false;
            rewardClaimedRef.current = false;
            return;
        }
        const unsub = onSnapshot(doc(db, "gomoku_rooms", roomId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as GomokuRoom;
                setRoom(data);
                const side = data.players.black === userProfile.uid ? 1 : (data.players.white === userProfile.uid ? 2 : null);
                setMySide(side as GomokuSide);

                if (data.lastAction && data.lastAction.at > lastActionAtRef.current) {
                    lastActionAtRef.current = data.lastAction.at;
                    if (data.lastAction.type === 'undo') {
                        showNotif(data.lastAction.by === userProfile.uid ? "已悔棋成功" : "对方已悔棋", 'info');
                        audio.playJump();
                    }
                }

                if (data.status === 'playing' && side === 2 && !hasPaidRef.current && data.wager > 0) {
                    hasPaidRef.current = true;
                    deductCredit(userProfile.uid, data.wager).catch(console.error);
                }

                if (data.status === 'finished' && !rewardClaimedRef.current) {
                    rewardClaimedRef.current = true;
                    const isIWin = data.winner === userProfile.uid;
                    settleOwnGomokuStats(userProfile, isIWin, data.wager);
                }
                
                if (data.history.length > (room?.history.length || 0)) audio.playStep();
            } else {
                setRoomId(null);
                setRoom(null);
            }
        }, (err) => {
            console.error("Gomoku Room Listener Error:", err);
            showNotif("连接中断，请重试");
        });
        return unsub;
    }, [roomId, userProfile]);

    const handleHost = async () => {
        if (!userProfile) return;
        if (wagerInput < 500) { showNotif("最低下注门槛为 500"); return; }
        if (wagerInput > userProfile.credits) { showNotif("余额不足"); return; }
        setLoading(true);
        try {
            const code = await createGomokuRoom(userProfile, wagerInput);
            setRoomId(code);
        } catch (e) { showNotif("创建失败"); }
        finally { setLoading(false); }
    };

    const handleJoin = async (code?: string) => {
        const target = code || joinCode;
        if (!userProfile || !target) return;
        setLoading(true);
        try {
            const ref = doc(db, "gomoku_rooms", target);
            const snap = await getDoc(ref);
            if (!snap.exists()) { showNotif("房间不存在"); return; }
            const data = snap.data() as GomokuRoom;
            if (userProfile.credits < data.wager) { showNotif("余额不足"); return; }
            await updateDoc(ref, {
                "players.white": userProfile.uid,
                "playerData.white": { nickname: userProfile.nickname, avatar: userProfile.avatarUrl || "", points: userProfile.gomokuPoints || 0, credits: userProfile.credits },
                status: 'ready'
            });
            setRoomId(target);
        } catch (e) { showNotif("加入失败"); }
        finally { setLoading(false); }
    };

    const handleStart = async () => {
        if (!room || !userProfile) return;
        setLoading(true);
        try {
            if (room.wager > 0) {
                const s = await deductCredit(userProfile.uid, room.wager);
                if (!s) { showNotif("支付失败"); setLoading(false); return; }
                hasPaidRef.current = true;
            }
            await updateDoc(doc(db, "gomoku_rooms", room.id), { status: 'playing' });
        } catch (e) { showNotif("启动失败"); }
        finally { setLoading(false); }
    };

    const handleMove = async (idx: number) => {
        if (!room || room.status !== 'playing' || room.turn !== mySide || room.board[idx] !== 0) return;
        
        const newBoard = [...room.board];
        newBoard[idx] = mySide;
        const win = checkWin(newBoard, idx, mySide);
        
        const updates: any = {
            board: newBoard,
            history: [...room.history, idx],
            turn: mySide === 1 ? 2 : 1,
            lastMoveAt: Timestamp.now(),
            lastAction: { type: 'move', by: userProfile?.uid, at: Date.now() }
        };

        if (win) {
            updates.status = 'finished';
            updates.winner = userProfile?.uid;
            updates.winReason = 'five_in_a_row';
        }

        await updateDoc(doc(db, "gomoku_rooms", room.id), updates);
    };

    const handleUndo = async () => {
        if (!room || !userProfile || !mySide || room.status !== 'playing' || room.history.length < 2 || room.turn !== mySide) return;
        
        const sideKey = mySide === 1 ? 'black' : 'white';
        if (room.undoUsed[sideKey]) { showNotif("每局只能悔棋一次"); return; }
        
        const undoCost = Math.floor(room.wager / 2);
        if (confirmUndoStage === 0) {
            setConfirmUndoStage(1);
            setTimeout(() => setConfirmUndoStage(0), 3000);
            return;
        }

        if (userProfile.credits < undoCost) { showNotif("余额不足"); return; }

        setLoading(true);
        try {
            const success = await deductCredit(userProfile.uid, undoCost);
            if (!success) { showNotif("支付失败"); return; }

            const newHistory = [...room.history];
            const last1 = newHistory.pop(); // Opponent's last move
            const last2 = newHistory.pop(); // My last move
            const newBoard = [...room.board];
            if (last1 !== undefined) newBoard[last1] = 0;
            if (last2 !== undefined) newBoard[last2] = 0;

            await updateDoc(doc(db, "gomoku_rooms", room.id), {
                board: newBoard,
                history: newHistory,
                [`undoUsed.${sideKey}`]: true,
                lastMoveAt: Timestamp.now(),
                lastAction: { type: 'undo', by: userProfile.uid, at: Date.now() }
            });
        } catch (e) { showNotif("操作失败"); }
        finally { setLoading(false); setConfirmUndoStage(0); }
    };

    const handleQuit = async () => {
        if (confirmQuitStage === 0) {
            setConfirmQuitStage(1);
            setTimeout(() => setConfirmQuitStage(0), 3000);
            return;
        }

        const isHost = room?.host === userProfile?.uid;

        if (room?.status === 'playing') {
            const opp = mySide === 1 ? room.players.white : room.players.black;
            await updateDoc(doc(db, "gomoku_rooms", room.id), { status: 'finished', winner: opp, winReason: 'escape' });
        } else {
            if (isHost) {
                await deleteDoc(doc(db, "gomoku_rooms", room!.id));
            } else {
                await updateDoc(doc(db, "gomoku_rooms", room!.id), {
                    "players.white": null,
                    "playerData.white": null,
                    status: 'waiting'
                });
            }
        }
        setRoomId(null);
        setConfirmQuitStage(0);
    };

    const showNotif = (msg: string, type: 'error' | 'info' = 'error') => {
        setError(msg);
        setTimeout(() => setError(null), 3000);
    }

    if (roomId) {
        const isMyTurn = room?.turn === mySide;
        const isHost = room?.host === userProfile?.uid;
        const blackTier = getGomokuTierInfo(room?.playerData.black?.points || 0);
        const whiteTier = getGomokuTierInfo(room?.playerData.white?.points || 0);
        const undoCost = room ? Math.floor(room.wager / 2) : 0;
        const myUndoUsed = room && mySide ? (mySide === 1 ? room.undoUsed.black : room.undoUsed.white) : false;
        const canUndo = isMyTurn && (room?.history.length || 0) >= 2 && !myUndoUsed;

        return (
            <div className="w-full flex flex-col gap-4 animate-in fade-in max-w-lg mx-auto">
                <div className="bg-white dark:bg-[#121212] rounded-3xl p-4 shadow-xl border border-neutral-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-yellow-500 shadow-lg">🐝</div>
                        <div>
                            <div className="text-xs font-black dark:text-white truncate max-w-[80px]">{room?.playerData.black?.nickname}</div>
                            <div className={`text-[8px] font-bold px-1 rounded ${blackTier.bg} ${blackTier.color}`}>{blackTier.name}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-neutral-400">WAGER</div>
                        <div className="text-sm font-black text-amber-600">{room?.wager} 🍯</div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                        <div>
                            <div className="text-xs font-black dark:text-white truncate max-w-[80px]">{room?.playerData.white?.nickname || '等待中'}</div>
                            {room?.playerData.white && <div className={`text-[8px] font-bold px-1 rounded ${whiteTier.bg} ${whiteTier.color}`}>{whiteTier.name}</div>}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center border-2 border-neutral-400">🦟</div>
                    </div>
                </div>

                {room?.status === 'waiting' ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/20">
                        <Share2 size={48} className="text-brand-yellow animate-pulse mb-4"/>
                        <h3 className="text-xl font-black dark:text-white">房间号: {room.code}</h3>
                        <Button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="mt-4">
                            {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? '已复制' : '复制房号'}
                        </Button>
                        <Button variant="ghost" onClick={handleQuit} className={`mt-2 ${confirmQuitStage === 1 ? 'text-white bg-red-600' : 'text-red-500'}`}>
                             {confirmQuitStage === 1 ? '确定解散？' : '解散房间'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className={`px-5 py-2 rounded-full font-black text-sm shadow-xl border-2 border-white/20 transition-all ${isMyTurn ? 'bg-brand-yellow text-black' : 'bg-neutral-800 text-white'}`}>
                            {room?.status === 'ready' ? '等待开始' : (isMyTurn ? '轮到你了' : '对方正在思考...')}
                        </div>

                        {/* Error Notification Bar with High Contrast */}
                        {error && (
                            <div className="bg-brand-yellow text-black p-3 rounded-2xl text-sm font-black w-full text-center shadow-[0_0_15px_rgba(251,191,36,0.5)] border-2 border-black/10 animate-pulse">
                                <Zap size={16} fill="black" className="inline mr-2"/> {error}
                            </div>
                        )}

                        <div className="relative aspect-square w-full max-w-[480px] gomoku-board rounded-lg border-4 border-[#8b4513] shadow-2xl p-1 grid grid-cols-15 grid-rows-15">
                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundSize: 'calc(100% / 14) calc(100% / 14)', backgroundImage: 'linear-gradient(#8b4513 1px, transparent 1px), linear-gradient(90deg, #8b4513 1px, transparent 1px)', margin: 'calc(100% / 30)' }}></div>
                            {room?.board.map((val, idx) => (
                                <div key={idx} onClick={() => handleMove(idx)} className="relative flex items-center justify-center cursor-pointer hover:bg-black/5 rounded-full z-10">
                                    {val !== 0 && (
                                        <div className={`w-[90%] h-[90%] rounded-full flex items-center justify-center text-lg md:text-xl shadow-md animate-in zoom-in duration-200 ${val === 1 ? 'bg-neutral-900 border-2 border-yellow-500' : 'bg-white border-2 border-neutral-400'}`}>
                                            {val === 1 ? '🐝' : '🦟'}
                                        </div>
                                    )}
                                    {[112, 48, 56, 168, 176].includes(idx) && val === 0 && <div className="w-1.5 h-1.5 bg-[#8b4513] rounded-full"></div>}
                                </div>
                            ))}
                        </div>

                        <div className="w-full flex gap-2">
                            {room?.status === 'playing' && (
                                <Button 
                                    variant="outline" 
                                    onClick={handleUndo} 
                                    disabled={!canUndo || loading}
                                    className={`flex-1 py-3 border-2 ${confirmUndoStage === 1 ? 'bg-amber-100 border-amber-500 text-amber-900' : 'border-neutral-300 dark:border-white/10 dark:text-white'}`}
                                >
                                    <RotateCcw size={16} className="mr-1"/>
                                    {confirmUndoStage === 1 ? `确定支付 ${undoCost} 🍯?` : (myUndoUsed ? '悔棋已用' : `悔棋 (${undoCost} 🍯)`)}
                                </Button>
                            )}
                            <Button variant="ghost" onClick={handleQuit} className={`flex-1 py-3 ${confirmQuitStage === 1 ? 'bg-red-600 text-white' : 'text-red-500 border-2 border-transparent'}`}>
                                {confirmQuitStage === 1 
                                    ? (room?.status === 'playing' ? '确定认输？' : '确定退出？') 
                                    : (room?.status === 'playing' ? '投子认输' : (isHost ? '解散房间' : '退出房间'))
                                }
                            </Button>
                        </div>
                        {room?.status === 'ready' && isHost && (
                            <Button onClick={handleStart} className="w-full py-4 text-xl">开始对战</Button>
                        )}
                    </div>
                )}

                {room?.status === 'finished' && (
                    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                        <Trophy size={80} className="text-brand-yellow mb-4 animate-bounce" />
                        <h2 className="text-5xl font-black text-white mb-2">{room.winner === userProfile?.uid ? '大获全胜' : '棋差一着'}</h2>
                        <div className="bg-white/10 p-8 rounded-3xl border border-white/20 w-full max-w-xs mb-8">
                             <div className={`text-4xl font-black ${room.winner === userProfile?.uid ? 'text-green-400' : 'text-red-400'}`}>
                                {room.winner === userProfile?.uid ? `+${room.wager * 2}` : `0`} 🍯
                             </div>
                             <div className="mt-4 text-white font-bold flex items-center justify-center gap-2">
                                <Zap size={16} className="text-yellow-400"/> 段位积分 {room.winner === userProfile?.uid ? '+10' : '-10'}
                             </div>
                        </div>
                        <Button onClick={() => { setRoomId(null); onGameOver(); }} className="w-full max-w-xs py-4 text-xl">返回大厅</Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-4 animate-in fade-in relative pb-24">
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 10px; }`}</style>
            <div className="flex bg-neutral-200 dark:bg-[#222] p-1 rounded-2xl">
                {(['LOBBY', 'CREATE', 'PROFILE'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === t ? 'bg-white dark:bg-[#444] text-black dark:text-white shadow' : 'text-neutral-500'}`}>
                        {t === 'LOBBY' ? <><Home size={14}/> 大厅</> : (t === 'CREATE' ? <><PlusCircle size={14}/> 创建</> : <><User size={14}/> 战绩</>)}
                    </button>
                ))}
            </div>

            {activeTab === 'LOBBY' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-[#121212] p-4 rounded-3xl shadow-lg border border-neutral-200 dark:border-white/5 flex gap-2">
                        <input type="number" placeholder="输入6位房号" value={joinCode} onChange={e=>setJoinCode(e.target.value)} className="flex-1 bg-neutral-100 dark:bg-[#222] rounded-xl px-4 font-bold outline-none dark:text-white" />
                        <Button onClick={() => handleJoin()} disabled={joinCode.length !== 6}><Search size={18}/></Button>
                    </div>
                    <div className="bg-white dark:bg-[#121212] p-4 rounded-3xl shadow-lg border border-neutral-200 dark:border-white/5">
                        <h4 className="text-xs font-black text-neutral-400 mb-4 flex items-center gap-2"><Zap size={14}/> 正在等待对手</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {waitingRooms.length === 0 ? <div className="text-center py-8 text-neutral-500 text-xs">暂无房间</div> : waitingRooms.map(r => (
                                <div key={r.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#222] rounded-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">🐝</div>
                                        <div className="text-sm font-bold dark:text-white">{r.playerData.black?.nickname}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs font-black text-amber-600">{r.wager} 🍯</div>
                                        <button onClick={() => handleJoin(r.code)} className="bg-brand-yellow text-black px-3 py-1.5 rounded-xl text-xs font-black">加入</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'CREATE' && (
                <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl shadow-xl border border-neutral-200 dark:border-white/5 flex flex-col gap-6">
                    <div className="text-center"><PlusCircle size={48} className="text-brand-yellow mx-auto mb-2"/><h3 className="text-xl font-black dark:text-white">创建五子棋对局</h3></div>
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-neutral-400 uppercase flex items-center gap-1"><Coins size={14}/> 设置本局筹码 (最低 500)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[500, 1000, 5000].map(amt => (
                                <button key={amt} onClick={() => setWagerInput(amt)} className={`py-2 rounded-xl text-sm font-bold border transition-all ${wagerInput === amt ? 'bg-brand-yellow border-brand-yellow text-black' : 'dark:text-white border-neutral-700'}`}>{amt}</button>
                            ))}
                        </div>
                        <input 
                            type="number" 
                            value={wagerInput} 
                            onChange={e => setWagerInput(Math.max(500, parseInt(e.target.value) || 0))} 
                            className="w-full bg-neutral-100 dark:bg-[#222] p-3 rounded-xl font-bold dark:text-white outline-none border-2 border-transparent focus:border-brand-yellow" 
                        />
                        <p className="text-[10px] text-neutral-500 text-center">创建房间最低需要 500 🍯 筹码</p>
                    </div>
                    <Button onClick={handleHost} className="py-4 text-lg">立即开房</Button>
                </div>
            )}

            {activeTab === 'PROFILE' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-6 shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-neutral-100 p-1 border-4 border-brand-yellow mb-3 overflow-hidden">
                            {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} className="w-full h-full object-cover rounded-full" /> : '🐶'}
                        </div>
                        <h2 className="text-xl font-black dark:text-white">{userProfile?.nickname}</h2>
                        
                        <div className={`mt-2 px-3 py-1 rounded-full font-black text-xs flex items-center gap-2 ${myTier.bg} ${myTier.color} border border-current/20`}>
                            <Trophy size={12}/> {myTier.name} {myTier.stars} 星
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mt-6">
                            <div className="bg-neutral-50 dark:bg-[#222] p-3 rounded-2xl text-center border border-neutral-100 dark:border-white/5">
                                <div className="text-[10px] text-neutral-400 font-bold mb-1">段位积分</div>
                                <div className="text-lg font-black text-purple-500">{userProfile?.gomokuPoints || 0}</div>
                            </div>
                            <div className="bg-neutral-50 dark:bg-[#222] p-3 rounded-2xl text-center border border-neutral-100 dark:border-white/5">
                                <div className="text-[10px] text-neutral-400 font-bold mb-1">胜场</div>
                                <div className="text-lg font-black text-green-400">{matchHistory.filter(m => m.winner === userProfile?.uid).length}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-[#121212] rounded-[2rem] p-6 shadow-xl border border-neutral-200 dark:border-white/10">
                        <h3 className="font-black text-sm flex items-center gap-2 dark:text-white mb-4"><History size={16} className="text-brand-yellow"/> 最近战绩</h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {historyLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-yellow" /></div>
                            ) : matchHistory.length === 0 ? (
                                <div className="text-center py-10 text-neutral-500 text-xs italic">暂无对战记录</div>
                            ) : matchHistory.map(m => {
                                const isWin = m.winner === userProfile?.uid;
                                const opponent = userProfile?.uid === m.players.black ? m.playerData.white : m.playerData.black;
                                return (
                                    <div key={m.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#222] rounded-2xl border border-neutral-100 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`px-2 py-1 rounded text-[10px] font-black ${isWin ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                                {isWin ? 'WIN' : 'LOSE'}
                                            </div>
                                            <div className="text-xs font-bold dark:text-white truncate max-w-[100px]">
                                                {opponent?.nickname || '匿名对手'}
                                            </div>
                                        </div>
                                        <div className={`font-mono text-sm font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                                            {isWin ? `+${m.wager*2}` : `-${m.wager}`} 🍯
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            
            {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-500 p-3 rounded-xl text-xs font-bold flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
        </div>
    );
};

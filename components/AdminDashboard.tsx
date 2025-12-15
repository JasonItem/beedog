
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminGetAllUsers, adminSearchUsers, adminUpdateUser, adminDeleteUser, adminUpdateScore, adminDeleteScore, adminBatchUpdateCredits, adminClearLeaderboard } from '../services/adminService';
import { getLeaderboard, GameScore } from '../services/gameService';
import { GAMES } from './MiniGamesHub';
import { UserProfile } from '../services/userService';
import { Shield, Search, Edit2, Trash2, Save, X, RotateCcw, AlertTriangle, CheckCircle, Database, Zap, Plus, Minus, CheckSquare, Square, Settings, Sliders } from 'lucide-react';
import { Button } from './Button';

// Internal Modal Component for Edits
const EditModal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-neutral-200 dark:border-[#333]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold dark:text-white">{title}</h3>
                    <button onClick={onClose}><X size={20} className="text-neutral-500" /></button>
                </div>
                {children}
            </div>
        </div>
    );
};

export const AdminDashboard: React.FC = () => {
    const { userProfile, refreshProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'USERS' | 'GAMES'>('USERS');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

    // Users State
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editForm, setEditForm] = useState({ nickname: '', credits: 0, is_admin: 0 });
    
    // Batch Operations State
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchAmount, setBatchAmount] = useState<string>('10');
    const [batchMode, setBatchMode] = useState<'adjust' | 'set'>('adjust');

    // Games State
    const [selectedGameId, setSelectedGameId] = useState(GAMES[0].id);
    const [scores, setScores] = useState<GameScore[]>([]);
    const [editingScore, setEditingScore] = useState<GameScore | null>(null);
    const [scoreVal, setScoreVal] = useState(0);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);

    // Initial Load
    useEffect(() => {
        if (activeTab === 'USERS') {
            loadUsers();
        } else {
            loadScores();
        }
    }, [activeTab, selectedGameId]);

    const showNotif = (msg: string, type: 'success' | 'error') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // --- USER ACTIONS ---
    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await adminGetAllUsers();
            setUsers(data);
            setSelectedUserIds(new Set()); // Reset selections
        } catch (e) {
            showNotif("加载用户失败 (权限不足?)", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            loadUsers();
            return;
        }
        setIsLoading(true);
        try {
            const data = await adminSearchUsers(searchTerm);
            setUsers(data);
            setSelectedUserIds(new Set());
        } catch (e) {
            showNotif("搜索失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (uid: string) => {
        // Warning: Direct delete without extra confirm dialog to avoid sandbox issues
        try {
            await adminDeleteUser(uid);
            setUsers(prev => prev.filter(u => u.uid !== uid));
            setSelectedUserIds(prev => {
                const next = new Set(prev);
                next.delete(uid);
                return next;
            });
            showNotif("用户已删除", 'success');
        } catch (e) {
            showNotif("删除失败", 'error');
        }
    };

    const openEditUser = (user: UserProfile) => {
        setEditingUser(user);
        setEditForm({ 
            nickname: user.nickname, 
            credits: user.credits, 
            is_admin: user.is_admin || 0 
        });
    };

    const saveUser = async () => {
        if (!editingUser) return;
        try {
            await adminUpdateUser(editingUser.uid, editForm);
            setUsers(prev => prev.map(u => u.uid === editingUser.uid ? { ...u, ...editForm } : u));
            setEditingUser(null);
            
            // If editing self, refresh profile
            if (editingUser.uid === userProfile?.uid) {
                await refreshProfile();
            }
            
            showNotif("用户信息已更新", 'success');
        } catch (e) {
            showNotif("更新失败", 'error');
        }
    };

    // --- BATCH ACTIONS ---
    const toggleSelectUser = (uid: string) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedUserIds.size === users.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(users.map(u => u.uid)));
        }
    };

    const handleBatchSubmit = async () => {
        const amount = parseInt(batchAmount);
        if (isNaN(amount)) {
            showNotif("请输入有效的金额", 'error');
            return;
        }
        
        setIsLoading(true);
        try {
            await adminBatchUpdateCredits(Array.from(selectedUserIds), amount, batchMode);
            
            // Force reload from server to ensure consistency
            await loadUsers();
            
            // If current user was in selection, refresh their profile UI
            if (userProfile && selectedUserIds.has(userProfile.uid)) {
                await refreshProfile();
            }
            
            setIsBatchModalOpen(false);
            setBatchAmount('10');
            setBatchMode('adjust');
            setSelectedUserIds(new Set()); // Clear selection
            showNotif("批量修改成功！", 'success');
        } catch (e) {
            console.error(e);
            showNotif("批量操作失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- GAME ACTIONS ---
    const loadScores = async () => {
        setIsLoading(true);
        try {
            // Get top 100 for admin management
            const data = await getLeaderboard(selectedGameId, 100);
            setScores(data);
        } catch (e) {
            showNotif("加载排行榜失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteScore = async (userId: string) => {
        try {
            await adminDeleteScore(selectedGameId, userId);
            setScores(prev => prev.filter(s => s.userId !== userId));
            showNotif("记录已删除", 'success');
        } catch (e) {
            showNotif("删除失败", 'error');
        }
    };

    const handleClearLeaderboard = async () => {
        setIsLoading(true);
        try {
            await adminClearLeaderboard(selectedGameId);
            setScores([]);
            setIsClearModalOpen(false);
            showNotif("排行榜已清空", 'success');
        } catch (e) {
            showNotif("清空失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const openEditScore = (score: GameScore) => {
        setEditingScore(score);
        setScoreVal(score.score);
    };

    const saveScoreVal = async () => {
        if (!editingScore) return;
        try {
            await adminUpdateScore(selectedGameId, editingScore.userId, scoreVal);
            setScores(prev => prev.map(s => s.userId === editingScore.userId ? { ...s, score: scoreVal } : s));
            setEditingScore(null);
            showNotif("分数已更新", 'success');
        } catch (e) {
            showNotif("更新失败", 'error');
        }
    };

    if (!userProfile || userProfile.is_admin !== 1) {
        return (
            <div className="min-h-screen pt-32 flex flex-col items-center text-neutral-500">
                <Shield size={64} className="mb-4 text-red-500" />
                <h1 className="text-2xl font-bold dark:text-white">访问被拒绝</h1>
                <p>您没有管理员权限。</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-neutral-100 dark:bg-[#050505]">
            <div className="container mx-auto px-4 max-w-7xl">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-black dark:text-white flex items-center gap-2">
                        <Shield className="text-red-500" /> 管理员后台
                    </h1>
                    {notification && (
                        <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {notification.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
                            {notification.msg}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-neutral-200 dark:border-[#333] pb-1">
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`px-6 py-3 font-bold text-lg rounded-t-xl transition-all ${activeTab === 'USERS' ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white border-b-2 border-brand-yellow' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                    >
                        用户管理
                    </button>
                    <button 
                        onClick={() => setActiveTab('GAMES')}
                        className={`px-6 py-3 font-bold text-lg rounded-t-xl transition-all ${activeTab === 'GAMES' ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white border-b-2 border-brand-yellow' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                    >
                        游戏排行榜
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-b-2xl rounded-tr-2xl p-6 shadow-xl border border-neutral-200 dark:border-[#333]">
                    
                    {/* --- USERS TAB --- */}
                    {activeTab === 'USERS' && (
                        <div>
                            {/* Toolbar */}
                            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
                                {/* Search */}
                                <div className="flex gap-2 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                        <input 
                                            type="text" 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="搜索昵称或 UID..."
                                            className="w-full bg-neutral-50 dark:bg-[#2a2a2a] border border-neutral-200 dark:border-[#444] rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white"
                                        />
                                    </div>
                                    <Button onClick={handleSearch} size="sm">搜索</Button>
                                    <Button onClick={loadUsers} variant="outline" size="sm"><RotateCcw size={18}/></Button>
                                </div>

                                {/* Batch Actions */}
                                {selectedUserIds.size > 0 && (
                                    <div className="flex items-center gap-3 bg-brand-yellow/10 border border-brand-yellow/30 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-right-5">
                                        <span className="text-sm font-bold text-brand-yellow">已选 {selectedUserIds.size} 人</span>
                                        <Button size="sm" onClick={() => setIsBatchModalOpen(true)} className="flex items-center gap-1 h-8">
                                            <Zap size={14}/> 批量调整蜂蜜
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a] text-neutral-500 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="p-3 w-10">
                                                <button onClick={toggleSelectAll} className="flex items-center">
                                                    {selectedUserIds.size > 0 && selectedUserIds.size === users.length ? <CheckSquare size={18} className="text-brand-yellow"/> : <Square size={18} className="text-neutral-400"/>}
                                                </button>
                                            </th>
                                            <th className="p-3 rounded-tl-lg">User</th>
                                            <th className="p-3">Credits</th>
                                            <th className="p-3">Role</th>
                                            <th className="p-3">Last Active</th>
                                            <th className="p-3 rounded-tr-lg text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 dark:divide-[#333]">
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="p-8 text-center">加载中...</td></tr>
                                        ) : users.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-neutral-500">未找到用户</td></tr>
                                        ) : (
                                            users.map(u => (
                                                <tr key={u.uid} className={`hover:bg-neutral-50 dark:hover:bg-[#252525] ${selectedUserIds.has(u.uid) ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                                                    <td className="p-3">
                                                        <button onClick={() => toggleSelectUser(u.uid)}>
                                                            {selectedUserIds.has(u.uid) ? <CheckSquare size={18} className="text-brand-yellow"/> : <Square size={18} className="text-neutral-400"/>}
                                                        </button>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-neutral-200 overflow-hidden">
                                                                {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🐶</div>}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-black dark:text-white">{u.nickname}</div>
                                                                <div className="text-[10px] text-neutral-400 font-mono">{u.uid}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-brand-yellow">{u.credits}</td>
                                                    <td className="p-3">
                                                        {u.is_admin === 1 ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold border border-red-200">Admin</span> : <span className="bg-neutral-100 dark:bg-[#333] text-neutral-500 px-2 py-0.5 rounded text-xs">User</span>}
                                                    </td>
                                                    <td className="p-3 text-neutral-500 text-xs">{u.lastCheckInDate || '-'}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => openEditUser(u)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                            <button onClick={() => handleDeleteUser(u.uid)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- GAMES TAB --- */}
                    {activeTab === 'GAMES' && (
                        <div>
                            <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
                                <label className="font-bold dark:text-white whitespace-nowrap">选择游戏:</label>
                                <select 
                                    value={selectedGameId} 
                                    onChange={(e) => setSelectedGameId(e.target.value)}
                                    className="bg-neutral-50 dark:bg-[#2a2a2a] border border-neutral-200 dark:border-[#444] rounded-xl px-4 py-2 outline-none dark:text-white flex-1 md:flex-none md:w-64"
                                >
                                    {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <div className="ml-auto flex gap-2">
                                    <Button onClick={() => setIsClearModalOpen(true)} variant="outline" size="sm" className="text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20">
                                        <Trash2 size={16} className="mr-1"/> 一键清空
                                    </Button>
                                    <Button onClick={() => loadScores()} variant="outline" size="sm"><RotateCcw size={18}/></Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a] text-neutral-500 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="p-3 rounded-tl-lg">Rank</th>
                                            <th className="p-3">User</th>
                                            <th className="p-3">Score</th>
                                            <th className="p-3">Date</th>
                                            <th className="p-3 rounded-tr-lg text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 dark:divide-[#333]">
                                        {isLoading ? (
                                            <tr><td colSpan={5} className="p-8 text-center">加载中...</td></tr>
                                        ) : scores.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-neutral-500">无记录</td></tr>
                                        ) : (
                                            scores.map((s, idx) => (
                                                <tr key={s.userId} className="hover:bg-neutral-50 dark:hover:bg-[#252525]">
                                                    <td className="p-3 font-bold text-neutral-500">#{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-neutral-200 overflow-hidden">
                                                                {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover" /> : null}
                                                            </div>
                                                            <span className="font-bold text-black dark:text-white">{s.nickname}</span>
                                                            <span className="text-[10px] text-neutral-400 font-mono">({s.userId.slice(0,4)}...)</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-mono font-black text-brand-yellow text-lg">{s.score}</td>
                                                    <td className="p-3 text-xs text-neutral-500">
                                                        {s.timestamp?.seconds ? new Date(s.timestamp.seconds * 1000).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => openEditScore(s)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                            <button onClick={() => handleDeleteScore(s.userId)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit User Modal */}
            <EditModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="编辑用户">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-white">昵称</label>
                        <input 
                            type="text" 
                            value={editForm.nickname} 
                            onChange={(e) => setEditForm({...editForm, nickname: e.target.value})}
                            className="w-full p-2 border rounded-lg dark:bg-[#333] dark:border-[#444] dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-white">蜂蜜余额</label>
                        <input 
                            type="number" 
                            value={editForm.credits} 
                            onChange={(e) => setEditForm({...editForm, credits: parseInt(e.target.value) || 0})}
                            className="w-full p-2 border rounded-lg dark:bg-[#333] dark:border-[#444] dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-white">权限</label>
                        <select 
                            value={editForm.is_admin} 
                            onChange={(e) => setEditForm({...editForm, is_admin: parseInt(e.target.value)})}
                            className="w-full p-2 border rounded-lg dark:bg-[#333] dark:border-[#444] dark:text-white"
                        >
                            <option value={0}>普通用户</option>
                            <option value={1}>管理员</option>
                        </select>
                    </div>
                    <Button onClick={saveUser} className="w-full mt-4"><Save size={18} className="mr-2"/> 保存更改</Button>
                </div>
            </EditModal>

            {/* Edit Score Modal */}
            <EditModal isOpen={!!editingScore} onClose={() => setEditingScore(null)} title="修改分数">
                <div className="space-y-4">
                    <p className="text-sm text-neutral-500">正在修改 {editingScore?.nickname} 在 {GAMES.find(g=>g.id===selectedGameId)?.name} 的分数</p>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-white">新分数</label>
                        <input 
                            type="number" 
                            value={scoreVal} 
                            onChange={(e) => setScoreVal(parseInt(e.target.value) || 0)}
                            className="w-full p-2 border rounded-lg dark:bg-[#333] dark:border-[#444] dark:text-white font-mono text-lg"
                        />
                    </div>
                    <Button onClick={saveScoreVal} className="w-full mt-4"><Save size={18} className="mr-2"/> 保存分数</Button>
                </div>
            </EditModal>

            {/* Batch Credits Modal */}
            <EditModal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="批量管理蜂蜜">
                <div className="space-y-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl text-sm border border-yellow-200 dark:border-yellow-800">
                        <p className="font-bold text-yellow-800 dark:text-yellow-200">已选中 {selectedUserIds.size} 名用户</p>
                        <p className="text-yellow-700 dark:text-yellow-300 mt-1">此操作将对所有选中的用户进行余额变更。</p>
                    </div>
                    
                    <div className="space-y-4">
                        {/* Mode Selection */}
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-white">操作类型</label>
                            <div className="flex bg-neutral-100 dark:bg-[#333] p-1 rounded-xl">
                                <button 
                                    onClick={() => setBatchMode('adjust')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${batchMode === 'adjust' ? 'bg-white dark:bg-[#444] shadow text-brand-yellow' : 'text-neutral-500 dark:text-neutral-400'}`}
                                >
                                    <Sliders size={14}/> 调整 (增/减)
                                </button>
                                <button 
                                    onClick={() => setBatchMode('set')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${batchMode === 'set' ? 'bg-white dark:bg-[#444] shadow text-blue-500' : 'text-neutral-500 dark:text-neutral-400'}`}
                                >
                                    <Settings size={14}/> 设置 (统一修改)
                                </button>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-white">
                                {batchMode === 'adjust' ? '调整数量 (正数增加，负数减少)' : '设置数量 (统一修改为)'}
                            </label>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setBatchAmount((parseInt(batchAmount || '0') - 100).toString())} className="p-2 bg-neutral-100 dark:bg-[#333] rounded-lg hover:bg-neutral-200 dark:hover:bg-[#444] dark:text-white"><Minus size={16}/></button>
                                <input 
                                    type="number" 
                                    value={batchAmount} 
                                    onChange={(e) => setBatchAmount(e.target.value)}
                                    className="flex-1 p-3 border rounded-xl dark:bg-[#333] dark:border-[#444] dark:text-white font-mono text-center text-lg font-bold outline-none focus:ring-2 focus:ring-brand-yellow"
                                />
                                <button onClick={() => setBatchAmount((parseInt(batchAmount || '0') + 100).toString())} className="p-2 bg-neutral-100 dark:bg-[#333] rounded-lg hover:bg-neutral-200 dark:hover:bg-[#444] dark:text-white"><Plus size={16}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" onClick={() => setIsBatchModalOpen(false)}>取消</Button>
                        <Button onClick={handleBatchSubmit} className={batchMode === 'set' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-brand-yellow text-black hover:bg-yellow-400'}>
                            {batchMode === 'set' ? '确认修改' : '确认调整'}
                        </Button>
                    </div>
                </div>
            </EditModal>

            {/* Clear Leaderboard Modal */}
            <EditModal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="确认清空排行榜">
                <div className="space-y-6">
                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl text-sm border border-red-200 dark:border-red-800 flex gap-3">
                        <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={24} />
                        <div>
                            <p className="font-bold text-red-800 dark:text-red-200">危险操作</p>
                            <p className="text-red-700 dark:text-red-300 mt-1">
                                您即将清空 <span className="font-bold underline">{GAMES.find(g => g.id === selectedGameId)?.name}</span> 的所有玩家分数记录。
                                <br/><br/>
                                此操作不可撤销！
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>取消</Button>
                        <Button onClick={handleClearLeaderboard} className="bg-red-600 hover:bg-red-700 text-white border-none">
                            确认清空
                        </Button>
                    </div>
                </div>
            </EditModal>

        </div>
    );
};

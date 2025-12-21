
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { adminGetAllUsers, adminSearchUsers, adminUpdateUser, adminDeleteUser, adminUpdateScore, adminDeleteScore, adminBatchUpdateCredits, adminClearLeaderboard } from '../services/adminService';
import { getProducts, saveProduct, deleteProduct, getOrders, updateOrderStatus, adminBatchUpdateOrderStatus, uploadProductImage, Product, Order, FormFieldConfig } from '../services/shopService';
import { getMessages, deleteMessage, adminBatchDeleteMessages, Message } from '../services/messageService'; // Import Message Service
import { getLeaderboard, GameScore } from '../services/gameService';
import { GAMES } from './MiniGamesHub';
import { UserProfile } from '../services/userService';
import { Shield, Search, Edit2, Trash2, Save, X, RotateCcw, AlertTriangle, CheckCircle, Database, Zap, Plus, Minus, CheckSquare, Square, Settings, Sliders, ShoppingBag, Package, List, Eye, ArrowLeft, ArrowRight, Upload, Image as ImageIcon, Loader2, Lock, Download, Filter, MessageSquare } from 'lucide-react';
import { Button } from './Button';
import { QueryDocumentSnapshot } from 'firebase/firestore';

// Internal Modal Component for Edits
const EditModal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className={`bg-white dark:bg-[#1e1e1e] rounded-2xl w-full ${maxWidth} p-6 shadow-2xl border border-neutral-200 dark:border-[#333] max-h-[90vh] flex flex-col`}>
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-xl font-bold dark:text-white">{title}</h3>
                    <button onClick={onClose}><X size={20} className="text-neutral-500" /></button>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const AdminDashboard: React.FC = () => {
    const { userProfile, refreshProfile } = useAuth();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'USERS' | 'GAMES' | 'SHOP_PRODUCTS' | 'SHOP_ORDERS' | 'MESSAGES'>('USERS');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
    const [permissionError, setPermissionError] = useState(false);

    // Users State
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editForm, setEditForm] = useState({ nickname: '', credits: 0, is_admin: 0 });
    
    // User Pagination
    const [userPage, setUserPage] = useState(1);
    const [userCursors, setUserCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);
    
    // Batch Operations State (Users)
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

    // Shop State
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [viewOrder, setViewOrder] = useState<Order | null>(null);
    const productFileInputRef = useRef<HTMLInputElement>(null);
    
    // Order Filters & Batch
    const [orderFilters, setOrderFilters] = useState({ productId: 'all', status: 'all', userId: '' });
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [orderPage, setOrderPage] = useState(1);
    const [orderCursors, setOrderCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);

    // Messages State
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
    const [msgPage, setMsgPage] = useState(1);
    const [msgCursors, setMsgCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);

    // Initial Load
    useEffect(() => {
        setPermissionError(false);
        if (activeTab === 'USERS') loadUsers();
        else if (activeTab === 'GAMES') loadScores();
        else if (activeTab === 'SHOP_PRODUCTS') loadProducts();
        else if (activeTab === 'SHOP_ORDERS') {
            loadProducts(); 
            loadOrders();
        } else if (activeTab === 'MESSAGES') {
            loadMessages();
        }
    }, [activeTab, selectedGameId]);

    const showNotif = (msg: string, type: 'success' | 'error') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // --- USER ACTIONS ---
    const loadUsers = async (pageIndex = 0) => {
        setIsLoading(true);
        try {
            const cursor = userCursors[pageIndex];
            const { users: data, lastVisible } = await adminGetAllUsers(cursor || undefined, 20);
            
            setUsers(data);
            setSelectedUserIds(new Set()); // Reset selections on page change
            
            const newCursors = [...userCursors];
            newCursors[pageIndex + 1] = lastVisible;
            setUserCursors(newCursors);
            setUserPage(pageIndex + 1);

        } catch (e: any) {
            console.error(e);
            if (e.code === 'permission-denied') setPermissionError(true);
            else showNotif("加载用户失败", 'error');
        } finally { setIsLoading(false); }
    };

    const handleUserPageChange = (dir: number) => {
        const newPageIdx = userPage - 1 + dir;
        if (newPageIdx < 0) return;
        loadUsers(newPageIdx);
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) { loadUsers(0); return; }
        setIsLoading(true);
        try {
            const data = await adminSearchUsers(searchTerm);
            setUsers(data);
            setSelectedUserIds(new Set());
            setUserCursors([null]); 
            setUserPage(1);
        } catch (e) { showNotif("搜索失败", 'error'); } finally { setIsLoading(false); }
    };
    const handleDeleteUser = async (uid: string) => {
        try {
            await adminDeleteUser(uid);
            setUsers(prev => prev.filter(u => u.uid !== uid));
            showNotif("用户已删除", 'success');
        } catch (e) { showNotif("删除失败", 'error'); }
    };
    const openEditUser = (user: UserProfile) => {
        setEditingUser(user);
        setEditForm({ nickname: user.nickname, credits: user.credits, is_admin: user.is_admin || 0 });
    };
    const saveUser = async () => {
        if (!editingUser) return;
        try {
            await adminUpdateUser(editingUser.uid, editForm);
            setUsers(prev => prev.map(u => u.uid === editingUser.uid ? { ...u, ...editForm } : u));
            setEditingUser(null);
            showNotif("更新成功", 'success');
        } catch (e) { showNotif("更新失败", 'error'); }
    };
    // Batch Logic
    const toggleSelectUser = (uid: string) => {
        setSelectedUserIds(prev => { const next = new Set(prev); if (next.has(uid)) next.delete(uid); else next.add(uid); return next; });
    };
    const toggleSelectAll = () => {
        const allOnPage = users.map(u => u.uid);
        const allSelected = allOnPage.every(uid => selectedUserIds.has(uid));
        
        if (allSelected) {
            setSelectedUserIds(prev => {
                const next = new Set(prev);
                allOnPage.forEach(uid => next.delete(uid));
                return next;
            });
        } else {
            setSelectedUserIds(prev => {
                const next = new Set(prev);
                allOnPage.forEach(uid => next.add(uid));
                return next;
            });
        }
    };
    const handleBatchSubmit = async () => {
        setIsLoading(true);
        try {
            await adminBatchUpdateCredits(Array.from(selectedUserIds), parseInt(batchAmount), batchMode);
            await loadUsers(userPage - 1); 
            setIsBatchModalOpen(false);
            showNotif("批量操作成功", 'success');
        } catch (e) { showNotif("批量操作失败", 'error'); } finally { setIsLoading(false); }
    };

    // --- GAME ACTIONS ---
    const loadScores = async () => {
        setIsLoading(true);
        try {
            const data = await getLeaderboard(selectedGameId, 100);
            setScores(data);
        } catch (e) { showNotif("加载失败", 'error'); } finally { setIsLoading(false); }
    };
    const handleDeleteScore = async (userId: string) => {
        try {
            await adminDeleteScore(selectedGameId, userId);
            setScores(prev => prev.filter(s => s.userId !== userId));
            showNotif("删除成功", 'success');
        } catch (e) { showNotif("删除失败", 'error'); }
    };
    const handleClearLeaderboard = async () => {
        setIsLoading(true);
        try {
            await adminClearLeaderboard(selectedGameId);
            setScores([]);
            setIsClearModalOpen(false);
            showNotif("清空成功", 'success');
        } catch (e) { showNotif("清空失败", 'error'); } finally { setIsLoading(false); }
    };
    const openEditScore = (score: GameScore) => { setEditingScore(score); setScoreVal(score.score); };
    const saveScoreVal = async () => {
        if (!editingScore) return;
        try {
            await adminUpdateScore(selectedGameId, editingScore.userId, scoreVal);
            setScores(prev => prev.map(s => s.userId === editingScore.userId ? { ...s, score: scoreVal } : s));
            setEditingScore(null);
            showNotif("更新成功", 'success');
        } catch (e) { showNotif("更新失败", 'error'); }
    };

    // --- MESSAGE ACTIONS (NEW) ---
    const loadMessages = async (pageIndex = 0) => {
        setIsLoading(true);
        try {
            const cursor = msgCursors[pageIndex];
            const { messages: data, lastVisible } = await getMessages(cursor || undefined, 20);
            
            setMessages(data);
            setSelectedMsgIds(new Set()); 
            
            const newCursors = [...msgCursors];
            newCursors[pageIndex + 1] = lastVisible;
            setMsgCursors(newCursors);
            setMsgPage(pageIndex + 1);
        } catch (e: any) {
            console.error(e);
            showNotif("加载留言失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMsgPageChange = (dir: number) => {
        const newPageIdx = msgPage - 1 + dir;
        if (newPageIdx < 0) return;
        loadMessages(newPageIdx);
    };

    const handleDeleteMessage = async (id: string) => {
        if (!confirm("确定删除此留言?")) return;
        try {
            await deleteMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
            showNotif("留言已删除", 'success');
        } catch (e) { showNotif("删除失败", 'error'); }
    };

    const toggleSelectMsg = (id: string) => {
        setSelectedMsgIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const toggleSelectAllMsgs = () => {
        const allOnPage = messages.map(m => m.id);
        const allSelected = allOnPage.every(id => selectedMsgIds.has(id));
        if (allSelected) {
            setSelectedMsgIds(prev => { const next = new Set(prev); allOnPage.forEach(id => next.delete(id)); return next; });
        } else {
            setSelectedMsgIds(prev => { const next = new Set(prev); allOnPage.forEach(id => next.add(id)); return next; });
        }
    };

    const handleBatchDeleteMsgs = async () => {
        if (selectedMsgIds.size === 0) return;
        if (!confirm(`确定删除选中的 ${selectedMsgIds.size} 条留言?`)) return;
        
        setIsLoading(true);
        try {
            await adminBatchDeleteMessages(Array.from(selectedMsgIds));
            // Reload current page
            await loadMessages(msgPage - 1);
            showNotif("批量删除成功", 'success');
        } catch (e) {
            showNotif("批量删除失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- SHOP ACTIONS ---
    const loadProducts = async () => {
        // No loading spinner here to avoid flashing when switching tabs if already cached or parallel loading
        try {
            const { products: data } = await getProducts(false, undefined, 50); 
            setProducts(data);
        } catch (e: any) { 
            console.error(e);
            if (e.code === 'permission-denied') setPermissionError(true);
        }
    };

    const loadOrders = async (pageIndex = 0) => {
        setIsLoading(true);
        setSelectedOrderIds(new Set()); // Reset selections on refresh/page change
        try {
            const cursor = orderCursors[pageIndex];
            const { orders: data, lastVisible } = await getOrders(undefined, cursor || undefined, 20, {
                productId: orderFilters.productId !== 'all' ? orderFilters.productId : undefined,
                status: orderFilters.status !== 'all' ? orderFilters.status : undefined,
                userId: orderFilters.userId.trim() || undefined
            });
            
            setOrders(data);
            
            const newCursors = [...orderCursors];
            newCursors[pageIndex + 1] = lastVisible;
            setOrderCursors(newCursors);
            setOrderPage(pageIndex + 1);
        } catch (e: any) { 
            console.error(e);
            if (e.code === 'permission-denied') {
                setPermissionError(true);
                showNotif("权限不足: 无法加载订单", 'error');
            } else {
                showNotif("加载订单失败", 'error'); 
            }
        } finally { setIsLoading(false); }
    };

    const handleOrderPageChange = (dir: number) => {
        const newPageIdx = orderPage - 1 + dir;
        if (newPageIdx < 0) return;
        loadOrders(newPageIdx);
    };

    // Batch Order Operations
    const toggleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const toggleSelectAllOrders = () => {
        const allOnPage = orders.map(o => o.id);
        const allSelected = allOnPage.every(id => selectedOrderIds.has(id));
        if (allSelected) {
            setSelectedOrderIds(prev => {
                const next = new Set(prev);
                allOnPage.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedOrderIds(prev => {
                const next = new Set(prev);
                allOnPage.forEach(id => next.add(id));
                return next;
            });
        }
    };

    const handleBatchStatusUpdate = async (status: 'pending' | 'completed' | 'rejected') => {
        if (selectedOrderIds.size === 0) return;
        setIsLoading(true);
        try {
            await adminBatchUpdateOrderStatus(Array.from(selectedOrderIds), status);
            // Update local state
            setOrders(prev => prev.map(o => selectedOrderIds.has(o.id) ? { ...o, status } : o));
            showNotif(`已更新 ${selectedOrderIds.size} 个订单状态`, 'success');
            setSelectedOrderIds(new Set()); // clear selection
        } catch (e) {
            console.error(e);
            showNotif("批量更新失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (selectedOrderIds.size === 0) return;
        
        // Filter orders that are selected
        const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
        
        const headers = ["Order ID", "Product", "Price", "User Nickname", "User ID", "Status", "Date", "Form Data"];
        const csvContent = [
            headers.join(","),
            ...selectedOrders.map(o => {
                const date = o.timestamp?.seconds ? new Date(o.timestamp.seconds * 1000).toLocaleString() : '';
                
                // Format Form Data: "Label:Value Label2:Value2"
                let formDataStr = "";
                const product = products.find(p => p.id === o.productId);
                
                if (o.formData) {
                    if (product && product.formSchema) {
                        // Use schema labels order
                        formDataStr = product.formSchema.map(field => {
                            const val = o.formData[field.key];
                            return val ? `${field.label}:${val}` : null;
                        }).filter(Boolean).join(' ');
                    } else {
                        // Fallback to keys
                        formDataStr = Object.entries(o.formData).map(([k, v]) => `${k}:${v}`).join(' ');
                    }
                }
                
                formDataStr = formDataStr.replace(/"/g, '""'); // Escape quotes for CSV

                return [
                    o.id,
                    `"${o.productName}"`,
                    o.priceSnapshot,
                    `"${o.userNickname}"`,
                    o.userId,
                    o.status,
                    `"${date}"`,
                    `"${formDataStr}"`
                ].join(",");
            })
        ].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Product Handlers
    const handleSaveProduct = async () => {
        if (!editingProduct || !editingProduct.name) {
            showNotif("请填写商品名称", 'error');
            return;
        }
        setIsLoading(true);
        try {
            // Ensure numbers
            const productToSave: Product = {
                ...editingProduct as Product,
                price: Number(editingProduct.price) || 0,
                stock: Number(editingProduct.stock) || 0,
                limitPerUser: Number(editingProduct.limitPerUser) || 0,
            };

            await saveProduct(productToSave, !editingProduct.id);
            await loadProducts();
            setEditingProduct(null);
            showNotif("商品已保存", 'success');
        } catch (e: any) { 
            console.error(e);
            if (e.code === 'permission-denied') showNotif("权限拒绝：请检查 Security Rules", 'error');
            else showNotif(`保存失败: ${e.message || '未知错误'}`, 'error'); 
        } finally { setIsLoading(false); }
    };

    const handleDeleteProduct = async (id: string) => {
        if(!confirm("确定删除该商品吗?")) return;
        try {
            await deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
            showNotif("商品已删除", 'success');
        } catch (e) { showNotif("删除失败", 'error'); }
    };

    const handleChangeOrderStatus = async (id: string, status: any) => {
        try {
            await updateOrderStatus(id, status);
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
            if (viewOrder && viewOrder.id === id) setViewOrder(prev => prev ? {...prev, status} : null);
            showNotif("订单状态已更新", 'success');
        } catch (e) { showNotif("更新失败", 'error'); }
    };

    const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const currentCount = editingProduct?.images?.length || 0;
        if (currentCount + files.length > 5) {
            showNotif("最多只能上传5张图片", 'error');
            return;
        }
        
        setIsLoading(true);
        try {
            const newUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const url = await uploadProductImage(files[i]);
                newUrls.push(url);
            }
            
            setEditingProduct(prev => {
                const updatedImages = [...(prev?.images || []), ...newUrls];
                return {
                    ...prev!,
                    images: updatedImages,
                    imageUrl: (!prev?.imageUrl && updatedImages.length > 0) ? updatedImages[0] : (prev?.imageUrl || updatedImages[0])
                };
            });
            showNotif("图片上传成功", 'success');
        } catch(e) {
            console.error(e);
            showNotif("上传失败", 'error');
        } finally {
            setIsLoading(false);
            if (productFileInputRef.current) productFileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        setEditingProduct(prev => {
            if (!prev || !prev.images) return prev;
            const newImages = [...prev.images];
            const removedUrl = newImages.splice(index, 1)[0];
            let newPrimary = prev.imageUrl;
            if (prev.imageUrl === removedUrl) {
                newPrimary = newImages.length > 0 ? newImages[0] : '';
            }
            return { ...prev, images: newImages, imageUrl: newPrimary };
        });
    };

    // --- FORM BUILDER HELPERS ---
    const addFormField = () => {
        setEditingProduct(prev => ({
            ...prev,
            formSchema: [...(prev?.formSchema || []), { key: `field_${Date.now()}`, label: '新字段', type: 'text', required: true }]
        }));
    };

    const updateFormField = (index: number, field: Partial<FormFieldConfig>) => {
        setEditingProduct(prev => {
            const newSchema = [...(prev?.formSchema || [])];
            newSchema[index] = { ...newSchema[index], ...field };
            return { ...prev, formSchema: newSchema };
        });
    };

    const removeFormField = (index: number) => {
        setEditingProduct(prev => {
            const newSchema = [...(prev?.formSchema || [])];
            newSchema.splice(index, 1);
            return { ...prev, formSchema: newSchema };
        });
    };

    // Helper to get product info for order view
    const getProductInfoForOrder = (order: Order) => {
        const product = products.find(p => p.id === order.productId);
        // Fallback to order's snapshot if product deleted or not loaded yet
        return {
            name: product?.name || order.productName,
            image: order.productImage || product?.imageUrl || '',
            schema: product?.formSchema || []
        };
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

    const allPageUsersSelected = users.length > 0 && users.every(u => selectedUserIds.has(u.uid));
    const allPageOrdersSelected = orders.length > 0 && orders.every(o => selectedOrderIds.has(o.id));
    const allPageMsgsSelected = messages.length > 0 && messages.every(m => selectedMsgIds.has(m.id));

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

                {/* Permission Warning */}
                {permissionError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-md">
                        <p className="font-bold flex items-center gap-2"><Lock size={18}/> 权限错误 (Permission Denied)</p>
                        <p>无法读取数据库。请确保您的 Firebase Firestore Rules 配置正确。</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6 border-b border-neutral-200 dark:border-[#333] pb-1">
                    {[
                        { id: 'USERS', label: '用户管理', icon: null },
                        { id: 'GAMES', label: '游戏榜单', icon: null },
                        { id: 'MESSAGES', label: '留言管理', icon: <MessageSquare size={16}/> },
                        { id: 'SHOP_PRODUCTS', label: '商品管理', icon: <ShoppingBag size={16}/> },
                        { id: 'SHOP_ORDERS', label: '订单管理', icon: <List size={16}/> },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 font-bold text-sm md:text-base rounded-t-xl transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white border-b-2 border-brand-yellow' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-b-2xl rounded-tr-2xl p-6 shadow-xl border border-neutral-200 dark:border-[#333] min-h-[500px]">
                    
                    {/* --- USERS TAB --- */}
                    {activeTab === 'USERS' && (
                        <div>
                            {/* ... (Existing Users Tab UI) ... */}
                            <div className="flex gap-2 mb-4 justify-between">
                                <div className="flex gap-2">
                                    <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="搜索用户..." className="border p-2 rounded dark:bg-[#333] dark:text-white"/>
                                    <Button onClick={handleSearch} size="sm">搜索</Button>
                                    {selectedUserIds.size > 0 && <Button onClick={() => setIsBatchModalOpen(true)} size="sm">批量操作 ({selectedUserIds.size})</Button>}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button onClick={() => handleUserPageChange(-1)} disabled={userPage <= 1} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowLeft size={16}/></button>
                                    <span className="text-sm">Page {userPage}</span>
                                    <button onClick={() => handleUserPageChange(1)} disabled={users.length < 20} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowRight size={16}/></button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a]">
                                        <tr>
                                            <th className="p-2 w-10">
                                                <button onClick={toggleSelectAll}>
                                                    {allPageUsersSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                </button>
                                            </th>
                                            <th className="p-2">User</th>
                                            <th className="p-2">Credits</th>
                                            <th className="p-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.uid} className="border-b dark:border-[#333]">
                                                <td className="p-2"><button onClick={() => toggleSelectUser(u.uid)}>{selectedUserIds.has(u.uid) ? <CheckSquare size={16}/> : <Square size={16}/>}</button></td>
                                                <td className="p-2">{u.nickname} <span className="text-xs text-gray-400">({u.uid.slice(0,4)})</span></td>
                                                <td className="p-2">{u.credits}</td>
                                                <td className="p-2 flex gap-2">
                                                    <button onClick={() => openEditUser(u)}><Edit2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- GAMES TAB --- */}
                    {activeTab === 'GAMES' && (
                        <div>
                             {/* ... (Existing Games Tab UI) ... */}
                             <div className="flex gap-2 mb-4">
                                <select value={selectedGameId} onChange={e=>setSelectedGameId(e.target.value)} className="border p-2 rounded dark:bg-[#333] dark:text-white">
                                    {GAMES.map(g => <option key={g.id} value={g.id}>{t(g.nameKey)}</option>)}
                                </select>
                                <Button onClick={loadScores} size="sm">刷新</Button>
                                <Button onClick={() => setIsClearModalOpen(true)} variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    清空榜单
                                </Button>
                             </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a]"><tr><th className="p-2">Rank</th><th className="p-2">User</th><th className="p-2">Score</th><th className="p-2">Action</th></tr></thead>
                                    <tbody>
                                        {scores.map((s, i) => (
                                            <tr key={s.userId} className="border-b dark:border-[#333]">
                                                <td className="p-2">{i+1}</td>
                                                <td className="p-2">{s.nickname}</td>
                                                <td className="p-2">{s.score}</td>
                                                <td className="p-2 flex gap-2">
                                                    <button onClick={() => openEditScore(s)}><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteScore(s.userId)}><Trash2 size={16} className="text-red-500"/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    )}

                    {/* --- MESSAGES TAB (NEW) --- */}
                    {activeTab === 'MESSAGES' && (
                        <div>
                            <div className="flex gap-2 mb-4 justify-between items-center">
                                <div className="flex gap-2">
                                    <Button onClick={() => loadMessages(0)} size="sm" variant="outline"><RotateCcw size={16}/></Button>
                                    {selectedMsgIds.size > 0 && (
                                        <Button onClick={handleBatchDeleteMsgs} size="sm" className="bg-red-600 text-white hover:bg-red-500">
                                            批量删除 ({selectedMsgIds.size})
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button onClick={() => handleMsgPageChange(-1)} disabled={msgPage <= 1} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowLeft size={16}/></button>
                                    <span className="text-sm">Page {msgPage}</span>
                                    <button onClick={() => handleMsgPageChange(1)} disabled={messages.length < 20} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowRight size={16}/></button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300 table-fixed">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a]">
                                        <tr>
                                            <th className="p-2 w-10">
                                                <button onClick={toggleSelectAllMsgs}>
                                                    {allPageMsgsSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                </button>
                                            </th>
                                            <th className="p-2 w-32">用户</th>
                                            <th className="p-2 w-2/3">内容</th>
                                            <th className="p-2 w-32">时间</th>
                                            <th className="p-2 w-16">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {messages.map(m => (
                                            <tr key={m.id} className="border-b dark:border-[#333] hover:bg-neutral-50 dark:hover:bg-[#252525]">
                                                <td className="p-2 align-top">
                                                    <button onClick={() => toggleSelectMsg(m.id)}>
                                                        {selectedMsgIds.has(m.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                    </button>
                                                </td>
                                                <td className="p-2 align-top">
                                                    <div className="font-bold truncate">{m.nickname}</div>
                                                    <div className="text-xs text-gray-400 font-mono">{m.userId.slice(0, 6)}</div>
                                                </td>
                                                <td className="p-2 align-top break-words">
                                                    {m.content}
                                                </td>
                                                <td className="p-2 align-top text-xs text-gray-500">
                                                    {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleString() : ''}
                                                </td>
                                                <td className="p-2 align-top">
                                                    <button onClick={() => handleDeleteMessage(m.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- SHOP PRODUCTS TAB --- */}
                    {activeTab === 'SHOP_PRODUCTS' && (
                        <div>
                            {/* ... (Existing Product Tab UI) ... */}
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg dark:text-white">商品列表</h3>
                                <Button onClick={() => setEditingProduct({ name: '', price: 0, stock: 0, imageUrl: '', images: [], isActive: true, formSchema: [], limitPerUser: 0 })} className="flex items-center gap-2">
                                    <Plus size={18}/> 添加商品
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {products.map(p => (
                                    <div key={p.id} className="border border-neutral-200 dark:border-[#333] rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-[#252525]">
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                                                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover"/> : <Package className="w-full h-full p-4 text-gray-400"/>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold dark:text-white line-clamp-1">{p.name}</h4>
                                                <div className="text-sm text-brand-yellow font-mono">{p.price} 蜂蜜</div>
                                                <div className="text-xs text-gray-500">库存: {p.stock}</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-auto pt-2 border-t dark:border-[#333]">
                                            <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.isActive ? '上架中' : '已下架'}
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingProduct(p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded"><Edit2 size={16}/></button>
                                                <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- SHOP ORDERS TAB (UPDATED) --- */}
                    {activeTab === 'SHOP_ORDERS' && (
                        <div>
                            <div className="flex flex-col gap-4 mb-6">
                                {/* Toolbar */}
                                <div className="flex flex-wrap justify-between items-center gap-3">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-lg dark:text-white">订单管理</h3>
                                        <Button onClick={() => loadOrders(0)} variant="outline" size="sm"><RotateCcw size={16}/></Button>
                                    </div>
                                    
                                    {/* Batch Actions */}
                                    {selectedOrderIds.size > 0 && (
                                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                                            <Button size="sm" onClick={handleExportCSV} className="bg-blue-600 text-white hover:bg-blue-500"><Download size={16} className="mr-1"/> 导出 CSV</Button>
                                            <Button size="sm" onClick={() => handleBatchStatusUpdate('completed')} className="bg-green-600 text-white hover:bg-green-500">批量发货</Button>
                                            <Button size="sm" onClick={() => handleBatchStatusUpdate('rejected')} className="bg-red-600 text-white hover:bg-red-500">批量拒绝</Button>
                                        </div>
                                    )}
                                </div>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 dark:bg-[#252525] rounded-xl items-center border border-neutral-200 dark:border-[#333]">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Filter size={16}/> 筛选:
                                    </div>
                                    <select 
                                        className="text-sm p-2 rounded border dark:bg-[#333] dark:text-white"
                                        value={orderFilters.productId}
                                        onChange={e => setOrderFilters({...orderFilters, productId: e.target.value})}
                                    >
                                        <option value="all">所有商品</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    
                                    <select 
                                        className="text-sm p-2 rounded border dark:bg-[#333] dark:text-white"
                                        value={orderFilters.status}
                                        onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}
                                    >
                                        <option value="all">所有状态</option>
                                        <option value="pending">处理中</option>
                                        <option value="completed">已完成</option>
                                        <option value="rejected">已拒绝</option>
                                    </select>

                                    <input 
                                        className="text-sm p-2 rounded border dark:bg-[#333] dark:text-white min-w-[150px]"
                                        placeholder="用户 ID (User UID)"
                                        value={orderFilters.userId}
                                        onChange={e => setOrderFilters({...orderFilters, userId: e.target.value})}
                                    />
                                    
                                    <Button size="sm" onClick={() => loadOrders(0)}>应用筛选</Button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm dark:text-neutral-300">
                                    <thead className="bg-neutral-50 dark:bg-[#2a2a2a] uppercase text-xs font-bold text-gray-500">
                                        <tr>
                                            <th className="p-3 w-10">
                                                <button onClick={toggleSelectAllOrders}>
                                                    {allPageOrdersSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                </button>
                                            </th>
                                            <th className="p-3">Order ID</th>
                                            <th className="p-3">User</th>
                                            <th className="p-3">Item</th>
                                            <th className="p-3">Price</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 dark:divide-[#333]">
                                        {orders.map(order => (
                                            <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-[#252525]">
                                                <td className="p-3">
                                                    <button onClick={() => toggleSelectOrder(order.id)}>
                                                        {selectedOrderIds.has(order.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                    </button>
                                                </td>
                                                <td className="p-3 font-mono text-xs text-gray-400">{order.id.slice(0,8)}...</td>
                                                <td className="p-3">
                                                    <div className="font-bold">{order.userNickname}</div>
                                                    <div className="text-xs text-gray-400">{order.userId.slice(0,6)}...</div>
                                                </td>
                                                <td className="p-3">{order.productName}</td>
                                                <td className="p-3 font-mono">{order.priceSnapshot}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        order.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button size="sm" variant="outline" onClick={() => setViewOrder(order)} className="text-xs h-7 px-2">
                                                        <Eye size={14} className="mr-1"/> 查看详情
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination for Orders */}
                            <div className="flex gap-2 items-center justify-end mt-4">
                                <button onClick={() => handleOrderPageChange(-1)} disabled={orderPage <= 1} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowLeft size={16}/></button>
                                <span className="text-sm">Page {orderPage}</span>
                                <button onClick={() => handleOrderPageChange(1)} disabled={orders.length < 20} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"><ArrowRight size={16}/></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* Product Edit Modal (Unchanged) */}
            <EditModal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={editingProduct?.id ? "编辑商品" : "添加商品"} maxWidth="max-w-2xl">
                {/* ... (Existing form content) ... */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-bold mb-1 dark:text-white">商品名称</label><input className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct!, name: e.target.value})} /></div>
                        <div><label className="block text-sm font-bold mb-1 dark:text-white">所需蜂蜜</label><input type="number" className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editingProduct?.price || 0} onChange={e => setEditingProduct({...editingProduct!, price: parseInt(e.target.value)})} /></div>
                        <div><label className="block text-sm font-bold mb-1 dark:text-white">库存数量</label><input type="number" className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editingProduct?.stock || 0} onChange={e => setEditingProduct({...editingProduct!, stock: parseInt(e.target.value)})} /></div>
                        <div><label className="block text-sm font-bold mb-1 dark:text-white">每人限购</label><input type="number" className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editingProduct?.limitPerUser || 0} onChange={e => setEditingProduct({...editingProduct!, limitPerUser: parseInt(e.target.value)})} /></div>
                        <div><label className="block text-sm font-bold mb-1 dark:text-white">状态</label><select className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editingProduct?.isActive ? 'true' : 'false'} onChange={e => setEditingProduct({...editingProduct!, isActive: e.target.value === 'true'})}><option value="true">上架</option><option value="false">下架</option></select></div>
                        <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1 dark:text-white flex justify-between">商品图片 <span className="text-xs font-normal text-gray-500">{editingProduct?.images?.length || 0}/5</span></label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {editingProduct?.images?.map((url, idx) => (
                                    <div key={idx} className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden group border border-gray-200"><img src={url} className="w-full h-full object-cover" /><button onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>{idx === 0 && <span className="absolute bottom-0 left-0 bg-black/50 text-white text-[8px] px-1 w-full text-center">主图</span>}</div>
                                ))}
                                {(editingProduct?.images?.length || 0) < 5 && (
                                    <button onClick={() => productFileInputRef.current?.click()} disabled={isLoading} className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-brand-yellow hover:text-brand-yellow transition-colors">{isLoading ? <Loader2 className="animate-spin" size={20}/> : <Upload size={20}/>}<span className="text-[10px] mt-1">上传</span></button>
                                )}
                            </div>
                            <input type="file" ref={productFileInputRef} className="hidden" accept="image/*" multiple onChange={handleProductImageUpload} />
                            <div className="flex gap-2"><input className="w-full p-2 border rounded text-xs dark:bg-[#333] dark:text-white" placeholder="或直接输入图片 URL" onKeyDown={(e) => { if(e.key === 'Enter') { const val = (e.target as HTMLInputElement).value; if(val) { setEditingProduct(prev => ({ ...prev!, images: [...(prev?.images || []), val], imageUrl: (!prev?.imageUrl ? val : prev.imageUrl) })); (e.target as HTMLInputElement).value = ''; } } }} /></div>
                        </div>
                        <div className="col-span-2"><label className="block text-sm font-bold mb-1 dark:text-white">商品描述</label><textarea className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" rows={3} value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct!, description: e.target.value})} /></div>
                    </div>
                    <div className="border-t pt-4 dark:border-[#444]"><div className="flex justify-between items-center mb-4"><h4 className="font-bold dark:text-white">订单表单配置</h4><Button size="sm" onClick={addFormField} variant="outline" className="text-xs"><Plus size={14}/> 添加字段</Button></div><div className="space-y-3">{editingProduct?.formSchema?.map((field, idx) => (<div key={idx} className="flex gap-2 items-center bg-neutral-50 dark:bg-[#252525] p-2 rounded-lg"><input placeholder="Key" className="w-1/4 p-1 text-xs border rounded dark:bg-[#333] dark:text-white" value={field.key} onChange={e => updateFormField(idx, {key: e.target.value})} /><input placeholder="Label" className="w-1/4 p-1 text-xs border rounded dark:bg-[#333] dark:text-white" value={field.label} onChange={e => updateFormField(idx, {label: e.target.value})} /><select className="w-1/4 p-1 text-xs border rounded dark:bg-[#333] dark:text-white" value={field.type} onChange={e => updateFormField(idx, {type: e.target.value as any})}><option value="text">文本</option><option value="number">数字</option><option value="email">邮箱</option><option value="select">下拉选</option></select><label className="flex items-center gap-1 text-xs whitespace-nowrap dark:text-white"><input type="checkbox" checked={field.required} onChange={e => updateFormField(idx, {required: e.target.checked})} /> 必填</label><button onClick={() => removeFormField(idx)} className="text-red-500 p-1"><Trash2 size={14}/></button>{field.type === 'select' && (<input placeholder="选项用逗号隔开" className="w-full mt-1 col-span-full p-1 text-xs border rounded dark:bg-[#333] dark:text-white" value={field.options?.join(',') || ''} onChange={e => updateFormField(idx, {options: e.target.value.split(',')})} />)}</div>))}</div></div>
                    <Button onClick={handleSaveProduct} className="w-full py-3 text-lg font-bold" disabled={isLoading}>{isLoading ? "上传中..." : "保存商品"}</Button>
                </div>
            </EditModal>

            {/* Order View Modal (Updated with Logic) */}
            {viewOrder && (() => {
                const prodInfo = getProductInfoForOrder(viewOrder);
                return (
                    <EditModal isOpen={!!viewOrder} onClose={() => setViewOrder(null)} title="订单详情">
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-[#252525] p-3 rounded-lg border dark:border-[#444] flex gap-4 items-center">
                                <div className="w-16 h-16 bg-white dark:bg-black rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-[#555] flex items-center justify-center">
                                    {prodInfo.image ? (
                                        <img src={prodInfo.image} className="w-full h-full object-cover" alt="Product" />
                                    ) : (
                                        <Package className="text-gray-300" size={24} />
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">商品</div>
                                    <div className="font-bold dark:text-white text-lg">{viewOrder.productName}</div>
                                    <div className="text-brand-yellow font-mono font-bold">{viewOrder.priceSnapshot} 蜂蜜</div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-gray-500">用户</div>
                                    <div className="dark:text-white font-medium">{viewOrder.userNickname}</div>
                                    <div className="text-xs text-gray-400 font-mono">{viewOrder.userId}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">下单时间</div>
                                    <div className="dark:text-white font-mono text-sm">
                                        {viewOrder.timestamp?.seconds ? new Date(viewOrder.timestamp.seconds * 1000).toLocaleString() : ''}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4 dark:border-[#444]">
                                <h4 className="font-bold mb-2 dark:text-white">表单数据</h4>
                                <div className="space-y-2">
                                    {Object.entries(viewOrder.formData).map(([key, val]) => {
                                        // Translate key to label using product schema if available
                                        const fieldDef = prodInfo.schema?.find(f => f.key === key);
                                        const label = fieldDef ? fieldDef.label : key;
                                        return (
                                            <div key={key} className="flex justify-between border-b border-gray-100 dark:border-[#333] pb-1">
                                                <span className="text-gray-500 text-sm">{label}:</span>
                                                <span className="font-medium dark:text-white text-right">{val}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-2">
                                {viewOrder.status === 'pending' && (
                                    <>
                                        <Button onClick={() => handleChangeOrderStatus(viewOrder.id, 'completed')} className="flex-1 bg-green-600 hover:bg-green-500 text-white">标记完成</Button>
                                        <Button onClick={() => handleChangeOrderStatus(viewOrder.id, 'rejected')} className="flex-1 bg-red-600 hover:bg-red-500 text-white">拒绝订单</Button>
                                    </>
                                )}
                                {viewOrder.status !== 'pending' && (
                                    <div className="w-full text-center py-2 font-bold text-gray-500 bg-gray-100 dark:bg-[#333] rounded-lg">
                                        订单已{viewOrder.status === 'completed' ? '完成' : '拒绝'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </EditModal>
                );
            })()}

            {/* ... (Other Modals: Clear Leaderboard, Batch User, Edit User - Unchanged) ... */}
            {isClearModalOpen && (
                <EditModal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="清空榜单">
                    <div className="text-center mb-6">
                        <AlertTriangle size={48} className="mx-auto text-red-500 mb-2"/>
                        <h3 className="text-xl font-bold dark:text-white">确定要清空榜单吗?</h3>
                        <p className="text-sm text-gray-500 mt-2">此操作将永久删除当前选中游戏的所有玩家分数记录，不可恢复。</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsClearModalOpen(false)} className="flex-1">取消</Button>
                        <Button onClick={handleClearLeaderboard} className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin"/> : "确认清空"}</Button>
                    </div>
                </EditModal>
            )}
            
            {isBatchModalOpen && (
                <EditModal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="批量管理蜂蜜">
                     <div className="space-y-6">
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl text-sm border border-yellow-200 dark:border-yellow-800">
                            <p className="font-bold text-yellow-800 dark:text-yellow-200">已选中 {selectedUserIds.size} 名用户</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex bg-neutral-100 dark:bg-[#333] p-1 rounded-xl">
                                <button onClick={() => setBatchMode('adjust')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${batchMode === 'adjust' ? 'bg-white dark:bg-[#444] shadow' : ''}`}>调整</button>
                                <button onClick={() => setBatchMode('set')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${batchMode === 'set' ? 'bg-white dark:bg-[#444] shadow' : ''}`}>设置</button>
                            </div>
                            <input type="number" value={batchAmount} onChange={e => setBatchAmount(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-[#333] dark:text-white font-mono text-center text-lg font-bold"/>
                        </div>
                        <Button onClick={handleBatchSubmit} className="w-full">确认</Button>
                    </div>
                </EditModal>
            )}
            
            {editingUser && (
                <EditModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="编辑用户">
                    <div className="space-y-4">
                        <div><label className="block text-sm font-bold">昵称</label><input className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})}/></div>
                        <div><label className="block text-sm font-bold">积分</label><input type="number" className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editForm.credits} onChange={e => setEditForm({...editForm, credits: parseInt(e.target.value)})}/></div>
                        <div><label className="block text-sm font-bold">权限</label><select className="w-full p-2 border rounded dark:bg-[#333] dark:text-white" value={editForm.is_admin} onChange={e => setEditForm({...editForm, is_admin: parseInt(e.target.value)})}> <option value={0}>User</option><option value={1}>Admin</option></select></div>
                        <Button onClick={saveUser} className="w-full">保存</Button>
                    </div>
                </EditModal>
            )}
        </div>
    );
};

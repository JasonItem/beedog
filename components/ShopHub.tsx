
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProducts, purchaseProduct, Product, getOrders, Order } from '../services/shopService';
import { ShoppingBag, X, Loader2, Package, Tag, AlertCircle, CheckCircle, Info, History } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../context/LanguageContext';

interface ShopHubProps {
  onLoginRequest: () => void;
}

export const ShopHub: React.FC<ShopHubProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  
  const [view, setView] = useState<'STORE' | 'MY_ORDERS'>('STORE');
  const [products, setProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Checkout Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [buying, setBuying] = useState(false);
  const [resultMsg, setResultMsg] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
      if (view === 'MY_ORDERS' && user) {
          loadOrders();
      }
  }, [view, user]);

  const loadProducts = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
          // getProducts(true) adds `where("isActive", "==", true)`
          // This matches typical Security Rules for public access.
          const { products: data } = await getProducts(true); 
          setProducts(data);
      } catch(e: any) {
          console.error(e);
          if (e.code === 'failed-precondition') {
              setErrorMsg("Database index required. Please contact admin.");
          } else if (e.code === 'permission-denied') {
              setErrorMsg("Access denied. Please login.");
          } else {
              setErrorMsg("Failed to load products.");
          }
      } finally {
          setLoading(false);
      }
  };

  const loadOrders = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const { orders: data } = await getOrders(user.uid);
          setMyOrders(data);
      } catch(e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const openCheckout = (product: Product) => {
      if (!user) {
          onLoginRequest();
          return;
      }
      setSelectedProduct(product);
      setFormData({});
      setResultMsg(null);
  };

  const handleInputChange = (key: string, value: string) => {
      setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmitOrder = async () => {
      if (!user || !userProfile || !selectedProduct) return;
      
      // Validate Required Fields
      for (const field of selectedProduct.formSchema) {
          if (field.required && !formData[field.key]?.trim()) {
              setResultMsg({ success: false, msg: `Missing field: ${field.label}` });
              return;
          }
      }

      setBuying(true);
      setResultMsg(null);

      try {
          const result = await purchaseProduct(
              user.uid,
              userProfile.nickname,
              selectedProduct.id,
              formData
          );
          
          if (result.success) {
              await refreshProfile(); // Update credits & usage
              loadProducts(); // Update stock display
              setTimeout(() => {
                  setSelectedProduct(null); // Close modal after delay
                  setResultMsg(null);
              }, 2000);
          }
          setResultMsg({ success: result.success, msg: result.message });
      } catch (e) {
          setResultMsg({ success: false, msg: "System Error" });
      } finally {
          setBuying(false);
      }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 bg-neutral-50 dark:bg-[#050505]">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="text-center md:text-left">
                <h1 className="text-4xl font-black dark:text-white flex items-center gap-2 justify-center md:justify-start">
                    <ShoppingBag className="text-brand-yellow" /> {t('shop.title')}
                </h1>
                <p className="text-neutral-500 mt-2">{t('shop.subtitle')}</p>
            </div>
            
            <div className="flex gap-4 items-center">
                {userProfile && (
                    <div className="bg-white dark:bg-[#161616] px-4 py-2 rounded-xl shadow-sm border border-neutral-200 dark:border-[#333] flex items-center gap-2">
                        <span>🍯</span>
                        <span className="font-mono font-bold dark:text-white">{userProfile.credits}</span>
                    </div>
                )}
                <div className="flex bg-neutral-200 dark:bg-[#222] p-1 rounded-xl">
                    <button 
                        onClick={() => setView('STORE')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'STORE' ? 'bg-white dark:bg-[#444] shadow text-black dark:text-white' : 'text-neutral-500'}`}
                    >
                        {t('shop.tab.store')}
                    </button>
                    <button 
                        onClick={() => {
                            if (!user) onLoginRequest();
                            else setView('MY_ORDERS');
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${view === 'MY_ORDERS' ? 'bg-white dark:bg-[#444] shadow text-black dark:text-white' : 'text-neutral-500'}`}
                    >
                        {t('shop.tab.orders')}
                    </button>
                </div>
            </div>
        </div>

        {/* STORE VIEW */}
        {view === 'STORE' && (
            <>
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-yellow" size={48}/></div>
                ) : errorMsg ? (
                    <div className="text-center py-20 text-red-500 flex flex-col items-center gap-4">
                        <AlertCircle size={48} />
                        <p>{errorMsg}</p>
                        <Button size="sm" onClick={loadProducts}>Retry</Button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 text-neutral-400 flex flex-col items-center gap-4">
                        <Package size={64} strokeWidth={1} />
                        <p>{t('shop.empty')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map(product => {
                            const isSoldOut = product.stock <= 0;
                            const isLimitReached = userProfile && product.limitPerUser && product.limitPerUser > 0 && (userProfile.productUsage?.[product.id] || 0) >= product.limitPerUser;
                            const disabled = isSoldOut || isLimitReached;
                            
                            return (
                                <div key={product.id} className="bg-white dark:bg-[#161616] rounded-3xl overflow-hidden border border-neutral-200 dark:border-[#333] shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group">
                                    {/* Image */}
                                    <div className="aspect-[4/3] bg-neutral-100 dark:bg-[#222] relative overflow-hidden">
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                <span className="text-white font-black text-2xl uppercase border-4 border-white px-4 py-2 transform -rotate-12">{t('shop.sold_out')}</span>
                                            </div>
                                        )}
                                        {isLimitReached && !isSoldOut && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                <span className="text-white font-black text-xl border-2 border-white px-3 py-1">{t('shop.limit_reached')}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="p-6 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xl font-bold dark:text-white line-clamp-1" title={product.name}>{product.name}</h3>
                                            <div className="flex flex-col items-end">
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 text-brand-yellow px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                                                    {t('shop.stock')}: {product.stock}
                                                </div>
                                                {product.limitPerUser && product.limitPerUser > 0 && (
                                                    <span className="text-[10px] text-red-500 mt-1 font-bold">{t('shop.limit', {n: product.limitPerUser})}</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <p className="text-neutral-500 text-sm line-clamp-3 mb-6 flex-1">
                                            {product.description}
                                        </p>
                                        
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-100 dark:border-[#333]">
                                            <div className="text-2xl font-black font-mono text-brand-yellow">
                                                {product.price} <span className="text-sm text-neutral-400 font-sans font-bold">🍯</span>
                                            </div>
                                            <Button 
                                                onClick={() => openCheckout(product)} 
                                                disabled={!!disabled}
                                                className={disabled ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : ''}
                                            >
                                                {isSoldOut ? t('shop.sold_out') : isLimitReached ? t('shop.limit_reached') : t('shop.redeem')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        )}

        {/* MY ORDERS VIEW */}
        {view === 'MY_ORDERS' && (
            <div className="bg-white dark:bg-[#161616] rounded-3xl p-6 border border-neutral-200 dark:border-[#333] shadow-xl min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-yellow" size={32}/></div>
                ) : myOrders.length === 0 ? (
                    <div className="text-center py-20 text-neutral-400">{t('shop.empty_orders')}</div>
                ) : (
                    <div className="space-y-4">
                        {myOrders.map(order => (
                            <div key={order.id} className="border border-neutral-100 dark:border-[#333] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-neutral-100 dark:bg-[#333] rounded-xl text-neutral-500">
                                        <Package size={24}/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold dark:text-white text-lg">{order.productName}</h4>
                                        <div className="text-xs text-neutral-400 flex gap-3 mt-1">
                                            <span className="flex items-center gap-1"><History size={12}/> {new Date(order.timestamp.seconds * 1000).toLocaleString()}</span>
                                            <span className="font-mono">ID: {order.id.slice(0, 8)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-right">
                                        <div className="text-xs text-neutral-400 font-bold uppercase">{t('shop.order.paid')}</div>
                                        <div className="font-mono font-black text-brand-yellow">{order.priceSnapshot} 🍯</div>
                                    </div>
                                    
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1
                                        ${order.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' : 
                                          order.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' : 
                                          'bg-blue-50 text-blue-600 border-blue-200'}
                                    `}>
                                        {order.status === 'completed' && <CheckCircle size={12}/>}
                                        {order.status === 'rejected' && <AlertCircle size={12}/>}
                                        {order.status === 'pending' && <Loader2 size={12} className="animate-spin"/>}
                                        {t(`shop.order.status.${order.status}`)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

      </div>

      {/* Checkout Modal */}
      {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-[#333] relative flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-neutral-100 dark:border-[#333] flex justify-between items-start">
                      <div>
                          <h2 className="text-2xl font-black dark:text-white">{t('shop.confirm.title')}</h2>
                          <p className="text-sm text-neutral-500 mt-1">{t('shop.confirm.desc')}</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-[#333] rounded-full text-neutral-500"><X size={20}/></button>
                  </div>

                  {/* Product Summary */}
                  <div className="p-6 bg-neutral-50 dark:bg-[#111] flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-xl bg-white overflow-hidden border border-neutral-200 shrink-0">
                          <img src={selectedProduct.imageUrl} className="w-full h-full object-cover"/>
                      </div>
                      <div>
                          <h3 className="font-bold dark:text-white">{selectedProduct.name}</h3>
                          <div className="text-brand-yellow font-mono font-black text-lg">{selectedProduct.price} 🍯</div>
                      </div>
                  </div>

                  {/* Dynamic Form */}
                  <div className="p-6 overflow-y-auto flex-1">
                      {selectedProduct.formSchema.length === 0 ? (
                          <p className="text-center text-neutral-500 italic">No extra info needed.</p>
                      ) : (
                          <div className="space-y-4">
                              {selectedProduct.formSchema.map((field) => (
                                  <div key={field.key}>
                                      <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                                          {field.label}
                                          {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </label>
                                      
                                      {field.type === 'select' ? (
                                          <select
                                              value={formData[field.key] || ''}
                                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                                              className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-[#333] border-transparent focus:bg-white focus:ring-2 focus:ring-brand-yellow outline-none transition-all dark:text-white"
                                          >
                                              <option value="">Select...</option>
                                              {field.options?.map(opt => (
                                                  <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          <input 
                                              type={field.type}
                                              value={formData[field.key] || ''}
                                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                                              placeholder={field.placeholder || `${field.label}`}
                                              className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-[#333] border-transparent focus:bg-white focus:ring-2 focus:ring-brand-yellow outline-none transition-all dark:text-white"
                                          />
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      {/* Result Message */}
                      {resultMsg && (
                          <div className={`mt-4 p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${resultMsg.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {resultMsg.success ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                              {resultMsg.msg}
                          </div>
                      )}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-neutral-100 dark:border-[#333] flex gap-3">
                      <Button variant="ghost" onClick={() => setSelectedProduct(null)} className="flex-1">Cancel</Button>
                      <Button 
                        onClick={handleSubmitOrder} 
                        disabled={buying || (userProfile?.credits || 0) < selectedProduct.price}
                        className="flex-[2] flex items-center justify-center gap-2"
                      >
                          {buying ? <Loader2 className="animate-spin"/> : <Tag size={18}/>}
                          {buying ? t('shop.confirm.processing') : t('shop.confirm.btn')}
                      </Button>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
};

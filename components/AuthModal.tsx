
import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  TwitterAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { ensureUserProfile, updateUserNickname, performDailyCheckIn, uploadUserAvatar } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { X, LogOut, Zap, LayoutDashboard, Twitter, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle, Link as LinkIcon, ArrowRight, Loader2, CalendarCheck, Camera, RefreshCw, Target, Edit2, Check } from 'lucide-react';
import { Button } from './Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'profile';
  onOpenMissions?: () => void; // Optional callback to switch to mission modal
}

type AuthView = 'login' | 'register' | 'forgot-pass' | 'verify-email' | 'set-nickname' | 'profile' | 'bind-email';
type LoadingMethod = 'twitter' | 'email' | 'general' | 'upload' | 'resend' | 'update_name' | null;

// Helper to translate Firebase errors
const getFirebaseErrorMessage = (error: any): string => {
  if (!error || !error.code) return '发生未知错误，请重试';
  switch (error.code) {
    case 'auth/popup-closed-by-user': return '登录已取消';
    case 'auth/user-not-found': return '账号或密码错误';
    case 'auth/wrong-password': return '账号或密码错误';
    case 'auth/invalid-credential': return '账号或密码错误'; // New generic error for wrong auth
    case 'auth/invalid-login-credentials': return '账号或密码错误'; // Another variant
    case 'auth/email-already-in-use': return '该邮箱已被注册。';
    case 'auth/invalid-email': return '邮箱格式不正确';
    case 'auth/weak-password': return '密码太弱，请至少使用6位字符';
    case 'auth/too-many-requests': return '尝试次数过多，请稍后再试';
    case 'auth/network-request-failed': return '网络连接失败，请检查网络';
    default: return `操作失败 (${error.code})`;
  }
};

// --- Helper Components ---
const SocialButton = ({ onClick, icon: Icon, label, variant = 'twitter', loading, disabled }: any) => (
    <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full font-bold text-lg py-3 rounded-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border ${
            variant === 'twitter'
                ? 'bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-transparent'
                : 'bg-white text-black dark:bg-[#222] dark:text-white border-neutral-200 dark:border-[#444] hover:bg-neutral-50 dark:hover:bg-[#333]'
        }`}
    >
      {loading ? <Loader2 className="animate-spin" size={20} /> : <Icon size={20} fill={variant === 'twitter' ? 'currentColor' : 'none'} />}
      {label}
    </button>
);

const InputField = ({ type, placeholder, value, onChange, icon: Icon, disabled }: any) => (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
        <Icon size={18} />
      </div>
      <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all dark:text-white text-sm disabled:opacity-50"
      />
    </div>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode: initialMode, onOpenMissions }) => {
  const { user, userProfile, logout, refreshProfile } = useAuth();

  // State
  const [view, setView] = useState<AuthView>('login');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Specific loading state
  const [loadingMethod, setLoadingMethod] = useState<LoadingMethod>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  
  // Nickname Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNickname, setTempNickname] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setLoadingMethod(null);
      setCheckInLoading(false);
      setIsEditingName(false); // Reset edit mode

      if (user) {
        if (!user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
          setView('verify-email');
        } else if (!userProfile?.nickname || userProfile.nickname === "新蜜蜂") {
          setView('set-nickname');
        } else {
          setView('profile');
        }
      } else {
        setView('login');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = async () => {
    if (view === 'verify-email' && auth.currentUser && !auth.currentUser.emailVerified) {
      await logout();
    }
    onClose();
  };

  // --- Handlers ---
  const handleTwitterLogin = async () => {
    setLoadingMethod('twitter');
    setError('');
    const provider = new TwitterAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user);
      await refreshProfile();
      onClose();
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleEmailRegister = async () => {
    if (!email || !password) return setError("请填写完整信息");
    setLoadingMethod('email');
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setSuccessMsg(`验证邮件已发送至 ${email}，请查收链接激活账号。`);
      setView('verify-email');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return setError("请填写完整信息");
    setLoadingMethod('email');
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        setView('verify-email');
        return;
      }
      const profile = await ensureUserProfile(userCredential.user);
      if (!profile || !profile.nickname || profile.nickname === "新蜜蜂") {
        setView('set-nickname');
      } else {
        await refreshProfile();
        onClose();
      }
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setLoadingMethod('resend');
    setError('');
    setSuccessMsg('');
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccessMsg("验证邮件已重新发送！");
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  // Helper to validate and sanitize nickname
  const validateNickname = (name: string): { valid: boolean; msg?: string } => {
      const trimmed = name.trim();
      if (!trimmed) return { valid: false, msg: "昵称不能为空" };
      if (trimmed.length < 2 || trimmed.length > 16) return { valid: false, msg: "昵称长度需在 2-16 字符之间" };
      
      // XSS Protection & Character Whitelist
      // Allowed: Chinese, English letters, Numbers, Underscore, Hyphen
      const regex = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/;
      if (!regex.test(trimmed)) return { valid: false, msg: "昵称包含非法字符（仅限中英文、数字、下划线）" };
      
      return { valid: true };
  };

  const handleSetNickname = async () => {
    const valCheck = validateNickname(nickname);
    if (!valCheck.valid) return setError(valCheck.msg!);
    if (!auth.currentUser) return;
    
    setLoadingMethod('general');
    try {
      await updateUserNickname(auth.currentUser.uid, nickname.trim());
      await refreshProfile();
      onClose();
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleUpdateNickname = async () => {
      const valCheck = validateNickname(tempNickname);
      if (!valCheck.valid) return setError(valCheck.msg!);
      if (!auth.currentUser) return;

      setLoadingMethod('update_name');
      try {
          await updateUserNickname(auth.currentUser.uid, tempNickname.trim());
          await refreshProfile();
          setIsEditingName(false);
          setSuccessMsg("昵称修改成功");
          setTimeout(() => setSuccessMsg(""), 3000);
      } catch (err: any) {
          setError("修改失败，请稍后再试");
      } finally {
          setLoadingMethod(null);
      }
  };

  const handleForgotPassword = async () => {
    if (!email) return setError("请输入邮箱地址");
    setLoadingMethod('general');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("重置密码邮件已发送");
      setTimeout(() => setView('login'), 3000);
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleLinkTwitter = async () => {
    if (!auth.currentUser) return;
    setLoadingMethod('twitter');
    try {
      const provider = new TwitterAuthProvider();
      await linkWithPopup(auth.currentUser, provider);
      setSuccessMsg("推特账号绑定成功！");
      await refreshProfile();
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleLinkEmail = async () => {
    if (!email || !password) return setError("请填写要绑定的邮箱和新密码");
    if (!auth.currentUser) return;
    setLoadingMethod('email');
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(auth.currentUser, credential);
      await sendEmailVerification(auth.currentUser);
      setSuccessMsg("邮箱绑定成功！验证邮件已发送。");
      setView('profile');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setView('login');
    setSuccessMsg('');
    setError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return setError("图片大小不能超过 2MB");
    setLoadingMethod('upload');
    try {
      await uploadUserAvatar(user.uid, file);
      setSuccessMsg("头像上传成功！");
      await refreshProfile();
    } catch (err: any) {
      setError("上传失败，请重试");
    } finally {
      setLoadingMethod(null);
    }
  };

  const isGlobalLoading = loadingMethod !== null && loadingMethod !== 'resend';

  return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#161616] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-[#333] relative flex flex-col max-h-[90vh]">

          {/* Header Button */}
          <button onClick={handleClose} className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-[#222] text-neutral-500 transition-colors">
            <X size={20} />
          </button>

          <div className="p-8 overflow-y-auto custom-scrollbar">

            {/* Header Text */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black dark:text-white mb-2">
                {view === 'login' && '欢迎回来'}
                {view === 'register' && '加入蜂群'}
                {view === 'forgot-pass' && '找回密码'}
                {view === 'verify-email' && '验证邮箱'}
                {view === 'set-nickname' && '设置昵称'}
                {view === 'profile' && '个人中心'}
                {view === 'bind-email' && '绑定邮箱'}
              </h2>
              <p className="text-sm text-neutral-500">
                {view === 'login' && '登录体验好玩的蜜蜂狗生态'}
                {view === 'register' && '注册专属账号，开始 Meme 之旅'}
                {view === 'profile' && '管理您的账户与绑定'}
              </p>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-start gap-2 border border-red-100 dark:border-red-900/30">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="mb-6 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-xl text-sm flex items-start gap-2 border border-green-100 dark:border-green-900/30">
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
            )}

            {/* VIEW: LOGIN */}
            {view === 'login' && (
                <div className="space-y-4">
                  <SocialButton onClick={handleTwitterLogin} icon={Twitter} label="使用 X (Twitter) 登录" loading={loadingMethod === 'twitter'} disabled={isGlobalLoading} />
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200 dark:border-[#333]"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#161616] px-2 text-neutral-400">或者邮箱登录</span></div>
                  </div>
                  <div className="space-y-3">
                    <InputField type="email" placeholder="邮箱地址" value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                    <InputField type="password" placeholder="密码" value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-neutral-500 mt-2">
                    <button onClick={() => setView('forgot-pass')} className="hover:text-black dark:hover:text-white" disabled={isGlobalLoading}>忘记密码?</button>
                  </div>
                  <Button onClick={handleEmailLogin} className="w-full mt-2" disabled={isGlobalLoading}>
                    {loadingMethod === 'email' ? '登录中...' : '登录'}
                  </Button>
                  <p className="text-center text-sm text-neutral-500 mt-4">
                    还没有账号? <button onClick={() => setView('register')} className="text-brand-yellow font-bold hover:underline" disabled={isGlobalLoading}>立即注册</button>
                  </p>
                </div>
            )}

            {/* VIEW: REGISTER */}
            {view === 'register' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <InputField type="email" placeholder="输入您的邮箱" value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                    <InputField type="password" placeholder="设置密码 (至少6位)" value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                  </div>
                  <Button onClick={handleEmailRegister} className="w-full mt-4" disabled={isGlobalLoading}>
                    {loadingMethod === 'email' ? '创建中...' : '注册账号'}
                  </Button>
                  <p className="text-center text-sm text-neutral-500 mt-4">
                    已有账号? <button onClick={() => setView('login')} className="text-brand-yellow font-bold hover:underline" disabled={isGlobalLoading}>去登录</button>
                  </p>
                </div>
            )}

            {/* VIEW: PROFILE */}
            {view === 'profile' && userProfile && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    {/* Avatar Upload */}
                    <div
                        className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-4xl shadow-xl mb-4 border-4 border-white dark:border-[#333] overflow-hidden relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                      {loadingMethod === 'upload' ? (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                            <Loader2 className="animate-spin text-white" />
                          </div>
                      ) : (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Camera className="text-white" />
                          </div>
                      )}
                      {userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/> : '🐶'}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/gif" onChange={handleFileChange} />
                    
                    {/* Nickname Editing */}
                    {isEditingName ? (
                        <div className="flex items-center gap-2 mb-1 w-full max-w-[200px]">
                            <input 
                                type="text"
                                value={tempNickname}
                                onChange={(e) => setTempNickname(e.target.value)}
                                className="w-full bg-neutral-100 dark:bg-[#333] border border-neutral-200 dark:border-[#444] rounded-lg px-2 py-1 text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white"
                                autoFocus
                                placeholder="输入新昵称"
                            />
                            <button 
                                onClick={handleUpdateNickname} 
                                disabled={loadingMethod === 'update_name'}
                                className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                                {loadingMethod === 'update_name' ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                            </button>
                            <button 
                                onClick={() => setIsEditingName(false)} 
                                disabled={loadingMethod === 'update_name'}
                                className="p-1.5 bg-neutral-200 dark:bg-[#444] text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-[#555] transition-colors"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mb-1 group">
                            <h3 className="text-2xl font-bold dark:text-white">{userProfile.nickname}</h3>
                            <button 
                                onClick={() => {
                                    setTempNickname(userProfile.nickname);
                                    setIsEditingName(true);
                                    setError(""); 
                                }}
                                className="opacity-50 group-hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-[#333] p-1 rounded-full transition-all text-neutral-500 dark:text-neutral-400"
                            >
                                <Edit2 size={14}/>
                            </button>
                        </div>
                    )}
                    
                    <p className="text-neutral-500 text-xs bg-neutral-100 dark:bg-[#222] px-2 py-0.5 rounded text-center">ID: {userProfile.uid}</p>
                  </div>

                  {/* Stats & Missions Link */}
                  <div className="bg-neutral-50 dark:bg-[#222] rounded-xl p-4 border border-neutral-100 dark:border-[#333]">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 text-brand-yellow rounded-lg">
                          🍯
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500">剩余蜂蜜</div>
                          <div className="font-bold text-xl dark:text-white">
                            {userProfile.credits}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mission Center Shortcut */}
                    {onOpenMissions && (
                        <Button
                            onClick={onOpenMissions}
                            className="w-full flex items-center gap-2 justify-center"
                            variant="primary"
                        >
                            <Target size={18} /> 去任务中心领蜂蜜
                        </Button>
                    )}
                  </div>

                  {/* Account Linking */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">账号绑定</h4>
                    
                    {/* Twitter Linking */}
                    {auth.currentUser?.providerData.some(p => p.providerId === 'twitter.com') ? (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                          <div className="flex items-center gap-2 text-sm font-bold"><Twitter size={16} /> 已绑定 Twitter</div>
                          <CheckCircle size={16} />
                        </div>
                    ) : (
                        <button onClick={handleLinkTwitter} disabled={isGlobalLoading} className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-[#222] hover:bg-neutral-100 dark:hover:bg-[#2a2a2a] transition-colors border border-neutral-200 dark:border-[#333]">
                          <div className="flex items-center gap-2 text-sm font-medium dark:text-neutral-300"><Twitter size={16} /> 绑定 Twitter 账号</div>
                          <LinkIcon size={14} className="text-neutral-400" />
                        </button>
                    )}

                    {/* Email Linking */}
                    {auth.currentUser?.providerData.some(p => p.providerId === 'password') ? (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">
                          <div className="flex items-center gap-2 text-sm font-bold"><Mail size={16} /> 已绑定邮箱</div>
                          <CheckCircle size={16} />
                        </div>
                    ) : (
                        <button onClick={() => setView('bind-email')} disabled={isGlobalLoading} className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-[#222] hover:bg-neutral-100 dark:hover:bg-[#2a2a2a] transition-colors border border-neutral-200 dark:border-[#333]">
                          <div className="flex items-center gap-2 text-sm font-medium dark:text-neutral-300"><Mail size={16} /> 绑定邮箱</div>
                          <LinkIcon size={14} className="text-neutral-400" />
                        </button>
                    )}
                  </div>

                  <div className="h-px bg-neutral-100 dark:bg-[#333] my-4"></div>
                  <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleLogout} disabled={isGlobalLoading}>
                      <LogOut className="mr-2" size={18} /> 退出登录
                    </Button>
                  </div>
                </div>
            )}

            {/* Other views omitted for brevity as they are unchanged logic */}
            {view === 'verify-email' && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600"><Mail size={32} /></div>
                  <div className="text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed">验证链接已发送至 <span className="font-bold text-black dark:text-white">{email || auth.currentUser?.email}</span><br/>请检查收件箱。</div>
                  <Button onClick={handleResendVerification} className="w-full" disabled={loadingMethod === 'resend'}>{loadingMethod === 'resend' ? "发送中..." : "重新发送验证邮件"}</Button>
                  <Button onClick={handleLogout} variant="outline" className="w-full">返回登录</Button>
                </div>
            )}
            
            {view === 'set-nickname' && (
                <div className="space-y-6">
                  <p className="text-sm text-neutral-500 text-center">给自己起一个响亮的代号吧！</p>
                  <InputField type="text" placeholder="例如: 钻石手金毛" value={nickname} onChange={setNickname} icon={UserIcon} disabled={isGlobalLoading} />
                  <Button onClick={handleSetNickname} className="w-full" disabled={isGlobalLoading}>{loadingMethod === 'general' ? '提交中...' : '开始旅程'}</Button>
                </div>
            )}

            {view === 'forgot-pass' && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-500 mb-2">输入邮箱，我们将向您发送重置链接。</p>
                  <InputField type="email" placeholder="邮箱地址" value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                  <Button onClick={handleForgotPassword} className="w-full" disabled={isGlobalLoading}>{loadingMethod === 'general' ? '发送中...' : '发送重置邮件'}</Button>
                  <button onClick={() => setView('login')} className="w-full text-center text-sm text-neutral-500 mt-2 hover:text-black dark:hover:text-white">返回登录</button>
                </div>
            )}

            {view === 'bind-email' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl text-xs text-yellow-800 dark:text-yellow-200 border border-yellow-100 dark:border-yellow-900/30">绑定邮箱后需验证邮箱。</div>
                  <div className="space-y-3">
                    <InputField type="email" placeholder="要绑定的邮箱" value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                    <InputField type="password" placeholder="设置登录密码" value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={() => setView('profile')} className="flex-1" disabled={isGlobalLoading}>取消</Button>
                    <Button onClick={handleLinkEmail} className="flex-1" disabled={isGlobalLoading}>{loadingMethod === 'email' ? '绑定中...' : '绑定'}</Button>
                  </div>
                </div>
            )}

          </div>
        </div>
      </div>
  );
};

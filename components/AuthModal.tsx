
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
import { doc, updateDoc } from 'firebase/firestore'; // Import Firestore functions
import { auth, db } from '../firebaseConfig'; // Import db
import { ensureUserProfile, updateUserNickname, performDailyCheckIn, uploadUserAvatar } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { X, LogOut, Zap, LayoutDashboard, Twitter, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle, Link as LinkIcon, ArrowRight, Loader2, CalendarCheck, Camera, RefreshCw, Target, Edit2, Check, Copy } from 'lucide-react';
import { Button } from './Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'profile';
  onOpenMissions?: () => void;
}

type AuthView = 'login' | 'register' | 'forgot-pass' | 'verify-email' | 'set-nickname' | 'profile' | 'bind-email';
type LoadingMethod = 'twitter' | 'email' | 'general' | 'upload' | 'resend' | 'update_name' | null;

const getFirebaseErrorMessage = (error: any): string => {
  if (!error || !error.code) return 'An unknown error occurred.';
  switch (error.code) {
    case 'auth/popup-closed-by-user': return 'Login canceled';
    case 'auth/user-not-found': return 'User not found or password wrong';
    case 'auth/wrong-password': return 'Wrong password';
    case 'auth/invalid-credential': return 'Invalid credentials'; 
    case 'auth/invalid-login-credentials': return 'Invalid credentials'; 
    case 'auth/email-already-in-use': return 'Email already in use';
    case 'auth/invalid-email': return 'Invalid email format';
    case 'auth/weak-password': return 'Password should be at least 6 chars';
    case 'auth/too-many-requests': return 'Too many requests, try again later';
    case 'auth/network-request-failed': return 'Network error';
    default: return `Error (${error.code})`;
  }
};

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
  const { t } = useLanguage();

  const [view, setView] = useState<AuthView>('login');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingMethod, setLoadingMethod] = useState<LoadingMethod>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [tempNickname, setTempNickname] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setLoadingMethod(null);
      setIsEditingName(false); 
      setIdCopied(false);

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
    if (!email || !password) return setError("Please fill all fields");
    setLoadingMethod('email');
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setSuccessMsg(`Verification email sent to ${email}`);
      setView('verify-email');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return setError("Please fill all fields");
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

  const handleSetNickname = async () => {
    if (!nickname.trim()) return setError("Nickname cannot be empty");
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
      if (!tempNickname.trim()) return setError("Invalid nickname");
      if (!auth.currentUser) return;
      setLoadingMethod('update_name');
      try {
          await updateUserNickname(auth.currentUser.uid, tempNickname.trim());
          await refreshProfile();
          setIsEditingName(false);
          setSuccessMsg("Nickname updated");
          setTimeout(() => setSuccessMsg(""), 3000);
      } catch (err: any) {
          setError("Update failed");
      } finally {
          setLoadingMethod(null);
      }
  };

  const handleForgotPassword = async () => {
    if (!email) return setError("Please enter email");
    setLoadingMethod('general');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("Reset email sent");
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
      setSuccessMsg("Twitter linked!");
      await refreshProfile();
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleLinkEmail = async () => {
    if (!email || !password) return setError("Fill email and new password");
    if (!auth.currentUser) return;
    setLoadingMethod('email');
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(auth.currentUser, credential);
      await sendEmailVerification(auth.currentUser);
      
      // Update email in Firestore Profile
      const docRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(docRef, { email: email });

      setSuccessMsg("Email linked! Verification sent.");
      await refreshProfile();
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
    if (file.size > 2 * 1024 * 1024) return setError("Max size 2MB");
    setLoadingMethod('upload');
    try {
      await uploadUserAvatar(user.uid, file);
      setSuccessMsg("Avatar uploaded!");
      await refreshProfile();
    } catch (err: any) {
      setError("Upload failed");
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleCopyId = () => {
    if (!userProfile) return;
    navigator.clipboard.writeText(userProfile.uid);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  const isGlobalLoading = loadingMethod !== null && loadingMethod !== 'resend';

  return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#161616] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-[#333] relative flex flex-col max-h-[90vh]">

          <button onClick={handleClose} className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-[#222] text-neutral-500 transition-colors">
            <X size={20} />
          </button>

          <div className="p-8 overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black dark:text-white mb-2">
                {view === 'login' && t('auth.welcome')}
                {view === 'register' && t('auth.join')}
                {view === 'profile' && t('profile.title')}
                {view === 'set-nickname' && 'Set Nickname'}
                {view === 'bind-email' && t('profile.bind_email')}
                {view === 'forgot-pass' && t('auth.forgot_title')}
              </h2>
              <p className="text-sm text-neutral-500">
                {view === 'login' && t('auth.login_desc')}
                {view === 'register' && t('auth.register_desc')}
                {view === 'profile' && t('profile.manage')}
                {view === 'forgot-pass' && t('auth.forgot_desc')}
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
                  <SocialButton onClick={handleTwitterLogin} icon={Twitter} label={t('auth.twitter')} loading={loadingMethod === 'twitter'} disabled={isGlobalLoading} />
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200 dark:border-[#333]"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#161616] px-2 text-neutral-400">{t('auth.or')}</span></div>
                  </div>
                  <div className="space-y-3">
                    <InputField type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                    <InputField type="password" placeholder={t('auth.pwd_placeholder')} value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-neutral-500 mt-2">
                    <button onClick={() => setView('forgot-pass')} className="hover:text-black dark:hover:text-white" disabled={isGlobalLoading}>{t('auth.forgot_pwd')}</button>
                  </div>
                  <Button onClick={handleEmailLogin} className="w-full mt-2" disabled={isGlobalLoading}>
                    {loadingMethod === 'email' ? '...' : t('auth.login_btn')}
                  </Button>
                  <p className="text-center text-sm text-neutral-500 mt-4">
                    {t('auth.no_account')} <button onClick={() => setView('register')} className="text-brand-yellow font-bold hover:underline" disabled={isGlobalLoading}>{t('auth.go_register')}</button>
                  </p>
                </div>
            )}

            {/* VIEW: REGISTER */}
            {view === 'register' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <InputField type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                    <InputField type="password" placeholder={t('auth.pwd_placeholder')} value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                  </div>
                  <Button onClick={handleEmailRegister} className="w-full mt-4" disabled={isGlobalLoading}>
                    {loadingMethod === 'email' ? '...' : t('auth.register_btn')}
                  </Button>
                  <p className="text-center text-sm text-neutral-500 mt-4">
                    {t('auth.has_account')} <button onClick={() => setView('login')} className="text-brand-yellow font-bold hover:underline" disabled={isGlobalLoading}>{t('auth.go_login')}</button>
                  </p>
                </div>
            )}

            {/* VIEW: FORGOT PASSWORD */}
            {view === 'forgot-pass' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <InputField type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                  </div>
                  <Button onClick={handleForgotPassword} className="w-full mt-4" disabled={isGlobalLoading}>
                    {loadingMethod === 'general' ? '...' : t('auth.send_reset')}
                  </Button>
                  <button onClick={() => setView('login')} className="w-full text-center text-sm text-neutral-500 hover:text-black dark:hover:text-white mt-4">
                    {t('auth.back_login')}
                  </button>
                </div>
            )}

            {/* VIEW: PROFILE */}
            {view === 'profile' && userProfile && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-4xl shadow-xl mb-4 border-4 border-white dark:border-[#333] overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      {loadingMethod === 'upload' ? (<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" /></div>) : (<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"><Camera className="text-white" /></div>)}
                      {userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/> : '🐶'}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/gif" onChange={handleFileChange} />
                    
                    {isEditingName ? (
                        <div className="flex gap-2 items-center w-full max-w-xs mb-1">
                             <input value={tempNickname} onChange={e=>setTempNickname(e.target.value)} className="bg-neutral-50 dark:bg-[#222] border rounded p-1 text-sm flex-1 dark:text-white"/>
                             <button onClick={handleUpdateNickname} className="text-green-500 p-1"><Check size={16}/></button>
                             <button onClick={()=>setIsEditingName(false)} className="text-red-500 p-1"><X size={16}/></button>
                        </div>
                    ) : (
                        <h3 className="text-2xl font-bold dark:text-white flex items-center gap-2 mb-1">
                            {userProfile.nickname} 
                            <button onClick={()=>{setTempNickname(userProfile.nickname); setIsEditingName(true);}} className="text-neutral-400 hover:text-brand-yellow"><Edit2 size={16}/></button>
                        </h3>
                    )}
                    
                    {/* User ID Display */}
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <div className="text-[10px] text-neutral-400 font-mono bg-neutral-100 dark:bg-[#222] px-3 py-1 rounded-full flex items-center gap-2 border border-neutral-200 dark:border-[#333]">
                           <span>UID: {userProfile.uid.slice(0, 6)}...{userProfile.uid.slice(-4)}</span>
                           <button 
                             onClick={handleCopyId} 
                             className="hover:text-brand-yellow transition-colors"
                             title="Copy UID"
                           >
                             {idCopied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                           </button>
                        </div>
                    </div>

                    <p className="text-neutral-500 text-xs font-medium">
                        {userProfile.email || user?.email || t('profile.no_email')}
                    </p>
                  </div>
                  
                  <div className="bg-neutral-50 dark:bg-[#222] rounded-xl p-4 border border-neutral-100 dark:border-[#333]">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 text-brand-yellow rounded-lg">🍯</div>
                        <div><div className="text-xs text-neutral-500">{t('profile.honey_balance')}</div><div className="font-bold text-xl dark:text-white">{userProfile.credits}</div></div>
                      </div>
                    </div>
                  </div>

                  {/* Bind Accounts Section */}
                  <div className="space-y-2">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">{t('profile.linked_acc')}</h4>
                      {user?.providerData.some(p => p.providerId === 'twitter.com') ? (
                          <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30">
                              <Twitter size={18} />
                              <span className="font-bold text-sm">{t('profile.bind_x_done')}</span>
                          </div>
                      ) : (
                          <button onClick={handleLinkTwitter} disabled={isGlobalLoading} className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-[#222] hover:bg-neutral-100 dark:hover:bg-[#333] transition-all border border-neutral-200 dark:border-[#333] text-left">
                              <Twitter size={18} className="text-neutral-500"/>
                              <span className="font-bold text-sm dark:text-neutral-300">{t('profile.bind_x')}</span>
                          </button>
                      )}
                      
                      {/* Check both providerData OR if userProfile has email (since we sync it) */}
                      {(user?.providerData.some(p => p.providerId === 'password') || userProfile.email || user?.email) ? (
                          <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30">
                              <Mail size={18} />
                              <span className="font-bold text-sm">{t('profile.bind_email_done')}</span>
                          </div>
                      ) : (
                          <button onClick={() => setView('bind-email')} disabled={isGlobalLoading} className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-[#222] hover:bg-neutral-100 dark:hover:bg-[#333] transition-all border border-neutral-200 dark:border-[#333] text-left">
                              <Mail size={18} className="text-neutral-500"/>
                              <span className="font-bold text-sm dark:text-neutral-300">{t('profile.bind_email')}</span>
                          </button>
                      )}
                  </div>

                  <div className="space-y-2 pt-4">
                    <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleLogout} disabled={isGlobalLoading}>
                      <LogOut className="mr-2" size={18} /> {t('profile.logout')}
                    </Button>
                  </div>
                </div>
            )}
            
            {/* Bind Email View */}
            {view === 'bind-email' && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <InputField type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={setEmail} icon={Mail} disabled={isGlobalLoading} />
                        <InputField type="password" placeholder={t('auth.pwd_placeholder')} value={password} onChange={setPassword} icon={Lock} disabled={isGlobalLoading} />
                    </div>
                    <Button onClick={handleLinkEmail} className="w-full mt-4" disabled={isGlobalLoading}>
                        {loadingMethod === 'email' ? '...' : t('profile.bind_email')}
                    </Button>
                    <button onClick={() => setView('profile')} className="w-full text-center text-sm text-neutral-500 hover:text-black dark:hover:text-white mt-2">
                        Cancel
                    </button>
                </div>
            )}
            
            {/* Set Nickname View (unchanged logic just kept for completeness) */}
             {view === 'set-nickname' && (
                 <div className="space-y-4">
                     <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                         Choose a unique display name for the community.
                     </p>
                     <InputField type="text" placeholder="Nickname" value={nickname} onChange={setNickname} icon={UserIcon} disabled={isGlobalLoading} />
                     <Button onClick={handleSetNickname} className="w-full mt-4" disabled={isGlobalLoading}>
                         {loadingMethod === 'general' ? '...' : 'Start Journey'}
                     </Button>
                 </div>
             )}

          </div>
        </div>
      </div>
  );
};

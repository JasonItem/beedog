import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Rocket,
  Zap,
  Heart,
  Shield,
  Anchor,
  Sun,
  Moon,
  ArrowRight,
  Wallet,
  Users,
  BarChart3,
  Image as ImageIcon,
  Copy,
  Check,
  MessageCircle,
  TrendingUp,
  Twitter,
  Repeat,
  Share,
  UserCircle,
  Bot,
  Gamepad2,
  View, ChartNoAxesColumn, Send,
  ChevronLeft, MoreHorizontal, Mic, Smile, Plus,
  Globe,
  Sparkles,
  Target,
  ShoppingBag,
  Languages,
  Calendar
} from 'lucide-react';
import { Button } from './components/Button';
import { StatsChart } from './components/StatsChart';
import { RoadmapPhase, SectionId } from './types';
import { AuthModal } from './components/AuthModal';
import { AIToolbox } from './components/AIToolbox';
import { MiniGamesHub } from './components/MiniGamesHub';
import { BeeDogChat } from './components/BeeDogChat';
import { MissionCenter } from './components/MissionCenter';
import { AdminDashboard } from './components/AdminDashboard';
import { ShopHub } from './components/ShopHub';
import { MessageBoard } from './components/MessageBoard';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';

type ViewState = 'landing' | 'toolbox' | 'games' | 'admin' | 'shop';

const App: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [copied, setCopied] = useState(false);
  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'profile'>('login');
  
  // Mission Center State
  const [isMissionOpen, setIsMissionOpen] = useState(false);

  // Admin Check
  const isAdmin = userProfile?.is_admin === 1;

  // Dynamic Roadmap Data based on Language
  const ROADMAP_DATA: RoadmapPhase[] = [
    {
      phase: t('roadmap.p1.phase'),
      title: t('roadmap.p1.title'),
      items: [t('roadmap.p1.i1'), t('roadmap.p1.i2'), t('roadmap.p1.i3'), t('roadmap.p1.i4')],
      status: 'completed'
    },
    {
      phase: t('roadmap.p2.phase'),
      title: t('roadmap.p2.title'),
      items: [t('roadmap.p2.i1'), t('roadmap.p2.i2'), t('roadmap.p2.i3'), t('roadmap.p2.i4')],
      status: 'current'
    },
    {
      phase: t('roadmap.p3.phase'),
      title: t('roadmap.p3.title'),
      items: [t('roadmap.p3.i1'), t('roadmap.p3.i2'), t('roadmap.p3.i3'), t('roadmap.p3.i4')],
      status: 'upcoming'
    }
  ];

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);
  
  const toggleLanguage = () => {
      setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const navigateToSection = (id: string) => {
    if (currentView !== 'landing') {
      setCurrentView('landing');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const navigateToToolbox = () => {
    setCurrentView('toolbox');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  }

  const navigateToGames = () => {
    setCurrentView('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  }

  const navigateToShop = () => {
    setCurrentView('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  }

  const navigateToAdmin = () => {
    setCurrentView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText("0x2eb08a8fe215f72e01e089c1cd8c4c4937414444");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openLogin = () => {
    setAuthMode('login');
    setIsAuthModalOpen(true);
  };

  const openProfile = () => {
    setAuthMode('profile');
    setIsAuthModalOpen(true);
  };

  const openMissions = () => {
    if (!user) {
        openLogin();
    } else {
        setIsMissionOpen(true);
    }
  };

  return (
    <div className={`min-h-screen text-neutral-900 dark:text-white transition-colors duration-500 font-sans ${currentView === 'landing' ? 'honey-pattern' : ''}`}>
      
      {/* Navbar */}
      <nav className={`fixed top-4 left-0 right-0 z-[60] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${scrolled ? 'px-4' : 'px-4 md:px-8'}`}>
        <div 
          className={`
            max-w-7xl mx-auto rounded-full border transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${scrolled 
              ? 'bg-white/70 dark:bg-black/70 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg py-3 px-6' 
              : 'bg-transparent border-transparent py-4 px-2'
            }
          `}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateToSection(SectionId.HERO)}>
              <div className="relative group">
                <div className="absolute inset-0 rounded-full blur-md group-hover:blur-lg transition-all"></div>
                <img src="/image/site/logo.png" alt="Logo" className="w-10 h-10 relative z-10 transform group-hover:rotate-12 transition-transform" />
              </div>
              <span className="text-xl font-display font-black tracking-tight hidden sm:block">{t('brand.name')}</span>
            </div>

            <div className="hidden md:flex gap-1 bg-white/50 dark:bg-black/20 p-1 rounded-full backdrop-blur-md border border-white/20 dark:border-white/5">
              <button onClick={() => navigateToSection('narrative')} className="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-all">{t('nav.origin')}</button>
              <button onClick={() => navigateToSection('community-board')} className="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-all">{t('nav.board')}</button>
              <button 
                onClick={navigateToGames} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'games' ? 'bg-brand-yellow text-black shadow-md' : 'hover:bg-white dark:hover:bg-white/10'}`}
              >
                <Gamepad2 size={16} /> {t('nav.games')}
              </button>
              <button 
                onClick={navigateToToolbox} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'toolbox' ? 'bg-brand-yellow text-black shadow-md' : 'text-brand-orange hover:bg-white dark:hover:bg-white/10'}`}
              >
                <Bot size={16} /> {t('nav.tools')}
              </button>
              <button 
                onClick={navigateToShop} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'shop' ? 'bg-brand-yellow text-black shadow-md' : 'hover:bg-white dark:hover:bg-white/10'}`}
              >
                <ShoppingBag size={16} /> {t('nav.shop')}
              </button>
              {isAdmin && (
                  <button 
                    onClick={navigateToAdmin} 
                    className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'admin' ? 'bg-red-600 text-white shadow-md' : 'text-red-600 hover:bg-white dark:hover:bg-white/10'}`}
                  >
                    <Shield size={16} /> {t('nav.admin')}
                  </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleLanguage} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-neutral-300 font-bold text-xs flex items-center justify-center w-10">
                {language === 'zh' ? 'EN' : '中'}
              </button>
              
              <button onClick={toggleTheme} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-neutral-300">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {user ? (
                 <div className="flex items-center gap-2">
                    {/* Mission Button */}
                    <button onClick={openMissions} className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white dark:hover:bg-white/10 text-brand-yellow transition-all" title={t('nav.missions')}>
                        <Target size={22} className="fill-brand-yellow/20"/>
                    </button>

                    <div className="flex items-center gap-2 cursor-pointer pl-1 pr-1.5 py-1 rounded-full hover:bg-white dark:hover:bg-neutral-800 transition-all border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700" onClick={openProfile}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-yellow to-orange-400 p-0.5">
                        <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden">
                            {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🐶</div>}
                        </div>
                        </div>
                    </div>
                 </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={openLogin} className="hidden sm:flex">
                  {t('nav.login')}
                </Button>
              )}
              
              <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-4 right-4 mt-2 p-4 rounded-3xl glass shadow-2xl animate-in slide-in-from-top-5 space-y-2 origin-top">
            <button onClick={() => navigateToSection('narrative')} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold">{t('nav.origin')}</button>
            <button onClick={() => navigateToSection('community-board')} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold">{t('nav.board')}</button>
            <button onClick={navigateToGames} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2"><Gamepad2 size={18}/> {t('nav.games')}</button>
            <button onClick={navigateToToolbox} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-brand-orange flex items-center gap-2"><Bot size={18}/> {t('nav.tools')}</button>
            <button onClick={navigateToShop} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-green-600 flex items-center gap-2"><ShoppingBag size={18}/> {t('nav.shop')}</button>
             {isAdmin && (
                <button onClick={navigateToAdmin} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-red-600 flex items-center gap-2"><Shield size={18}/> {t('nav.admin')}</button>
             )}
             {user ? (
               <>
                 <button onClick={openMissions} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2 text-brand-yellow">
                    <Target size={20} /> {t('nav.missions')}
                 </button>
                 <button onClick={openProfile} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2 border-t border-black/5 dark:border-white/5 mt-2 pt-4">
                    <UserCircle size={20} /> {t('nav.profile')} ({userProfile?.nickname})
                 </button>
               </>
             ) : (
                <Button onClick={openLogin} className="w-full mt-4">{t('nav.login')}</Button>
             )}
             <div className="flex justify-center pt-4 border-t border-black/5 dark:border-white/5 mt-2">
                 <button onClick={toggleLanguage} className="flex items-center gap-2 text-sm font-bold text-neutral-500">
                     <Languages size={16}/> {t('nav.switch')}
                 </button>
             </div>
          </div>
        )}
      </nav>

      {/* --- CONDITIONAL RENDERING --- */}
      
      {currentView === 'toolbox' ? (
        <AIToolbox onLoginRequest={openLogin} />
      ) : currentView === 'games' ? (
        <MiniGamesHub onLoginRequest={openLogin} />
      ) : currentView === 'shop' ? (
        <ShopHub onLoginRequest={openLogin} />
      ) : currentView === 'admin' ? (
        <AdminDashboard />
      ) : (
        <>
          {/* Hero Section */}
          <section id={SectionId.HERO} className="relative min-h-screen flex items-center justify-center pt-24 overflow-hidden">
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-yellow/30 rounded-full blur-[80px] animate-blob mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
                <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-brand-orange/30 rounded-full blur-[80px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen opacity-60"></div>
            </div>
            
            <div className="container mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 border border-brand-orange/30 backdrop-blur-md animate-fade-in-up">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-orange"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">{t('hero.tag')}</span>
                </div>
                
                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-display font-black leading-[0.9] tracking-tighter animate-fade-in-up [animation-delay:200ms]">
                  {t('hero.title.1')}<br/>
                  <span className="clip-text-image">{t('hero.title.2')}</span>
                </h1>
                
                <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up [animation-delay:400ms]">
                  {t('hero.desc')}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up [animation-delay:600ms]">
                  <Button onClick={() => window.open(`https://gmgn.ai/bsc/token/0x2eb08a8fe215f72e01e089c1cd8c4c4937414444`, "_blank")} size="lg" className="px-8">
                    <Zap className="mr-2 fill-current" /> {t('hero.buy')}
                  </Button>
                  <Button onClick={() => window.open(`https://t.me/mifenggoutg`, "_blank")} variant="outline" size="lg" className="px-8">
                    <MessageCircle className="mr-2" /> {t('hero.telegram')}
                  </Button>
                </div>
              </div>

              <div className="relative h-[500px] w-full flex items-center justify-center perspective-1000 animate-fade-in-up [animation-delay:800ms]">
                 <div className="relative w-[300px] h-[400px] sm:w-[350px] sm:h-[450px]">
                    <div className="group absolute top-12 -left-20 sm:-left-32 w-[90%] h-[90%] z-10 transition-all duration-500 transform -rotate-12 hover:rotate-0 hover:scale-105 hover:z-30">
                       <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-3 border border-white/20 animate-float-delayed opacity-90">
                          <img src="/image/site/beedog2.png" className="w-full h-[85%] object-cover rounded-2xl" />
                          <div className="mt-3 flex items-center gap-2 px-2">
                              <Heart size={16} className="text-red-500 fill-red-500" />
                              <span className="text-xs font-bold text-neutral-400">12.5k Likes</span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="group absolute top-24 -right-20 sm:-right-32 w-[90%] h-[90%] z-10 transition-all duration-500 transform rotate-12 hover:rotate-0 hover:scale-105 hover:z-30">
                       <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-3 border border-white/20 animate-float opacity-90">
                          <img src="/image/site/beedog3.png" className="w-full h-[85%] object-cover rounded-2xl" />
                          <div className="mt-3 flex items-center gap-2 px-2">
                              <MessageCircle size={16} className="text-blue-500 fill-blue-500" />
                              <span className="text-xs font-bold text-neutral-400">8.2k Comments</span>
                          </div>
                       </div>
                    </div>

                    <div className="absolute top-0 left-0 w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-[0_20px_60px_-15px_rgba(255,215,0,0.3)] p-3 border-4 border-brand-yellow transform hover:scale-105 transition-all duration-500 z-20">
                       <img src="/image/site/beedog.jpg" className="w-full h-[85%] object-cover rounded-2xl" />
                       <div className="mt-3 px-2">
                          <div className="text-lg font-black font-display">BeeDog.meme</div>
                          <div className="text-xs text-neutral-400 font-mono">The stickiest coin on chain.</div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* Narrative Section */}
          <section id="narrative" className="py-32 relative overflow-hidden">
            <div className="container mx-auto px-4">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-6xl font-display font-black mb-6">
                  {t('narrative.title')}<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-orange">{t('narrative.subtitle')}</span>
                </h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div className="relative">
                   <div className="absolute inset-0 bg-gradient-to-tr from-brand-yellow/20 to-transparent rounded-full blur-[100px]"></div>
                   <div className="relative z-10 glass-card rounded-[2.5rem] p-2 overflow-hidden transform rotate-2 hover:rotate-0 transition-all duration-500 shadow-2xl">
                      <img src="/image/site/dybg.png" className="w-full rounded-[2rem]" />
                   </div>
                </div>

                <div className="space-y-12">
                   <div className="space-y-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-4">
                         <TrendingUp size={28} />
                      </div>
                      <h3 className="text-3xl font-bold dark:text-white">{t('narrative.card1.title')}</h3>
                      <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {t('narrative.card1.desc')}
                      </p>
                   </div>

                   <div className="space-y-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-500 mb-4">
                         <MessageCircle size={28} />
                      </div>
                      <h3 className="text-3xl font-bold dark:text-white">{t('narrative.card2.title')}</h3>
                      <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {t('narrative.card2.desc')}
                      </p>
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Community Section */}
          <section id="community" className="py-32 bg-neutral-100 dark:bg-[#080808]">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-display font-black mb-4 dark:text-white">{t('comm.title')}</h2>
                <p className="text-neutral-500 text-xl">{t('comm.subtitle')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                 <div className="md:col-span-2 bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 md:p-12 border border-neutral-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-yellow/10 rounded-full blur-[80px] group-hover:bg-brand-yellow/20 transition-all"></div>
                    <div className="relative z-10">
                       <div className="w-14 h-14 bg-brand-yellow rounded-2xl flex items-center justify-center mb-6 text-black shadow-lg shadow-yellow-500/20">
                          <Users size={28} />
                       </div>
                       <h3 className="text-3xl font-bold mb-4 dark:text-white">{t('comm.cto.title')}</h3>
                       <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-xl">
                          {t('comm.cto.desc')}
                       </p>
                    </div>
                 </div>

                 <div className="md:row-span-2 bg-brand-yellow rounded-[2.5rem] p-8 border border-yellow-400 relative overflow-hidden group text-black flex flex-col justify-between">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="relative z-10">
                       <div className="w-14 h-14 bg-black/10 rounded-2xl flex items-center justify-center mb-6 text-black">
                          <ImageIcon size={28} />
                       </div>
                       <h3 className="text-3xl font-bold mb-4">{t('comm.meme.title')}</h3>
                       <p className="text-lg opacity-80 mb-6">
                          {t('comm.meme.desc')}
                       </p>
                       <p className="text-sm font-bold border-l-4 border-black pl-4 py-1 bg-white/20 backdrop-blur-sm rounded-r-lg">
                          {t('comm.meme.quote')}
                       </p>
                    </div>
                    <div className="relative z-10 mt-4">
                        <button onClick={navigateToToolbox} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                            <Sparkles size={18} /> {t('comm.meme.btn')}
                        </button>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-white/5 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px]"></div>
                    <div className="relative z-10">
                       <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                          <Shield size={24} />
                       </div>
                       <h3 className="text-xl font-bold mb-2 dark:text-white">{t('comm.shield.title')}</h3>
                       <p className="text-neutral-500 text-sm">
                          {t('comm.shield.desc')}
                       </p>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-white/5 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-[40px]"></div>
                    <div className="relative z-10">
                       <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-500 rounded-2xl flex items-center justify-center mb-4">
                          <Globe size={24} />
                       </div>
                       <h3 className="text-xl font-bold mb-2 dark:text-white">{t('comm.global.title')}</h3>
                       <p className="text-neutral-500 text-sm">
                          {t('comm.global.desc')}
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* Message Board */}
          <MessageBoard onLoginRequest={openLogin} />

          {/* Tokenomics */}
          <section id={SectionId.TOKENOMICS} className="py-32 bg-white dark:bg-black">
            <div className="container mx-auto px-4">
              <div className="grid lg:grid-cols-12 gap-16 items-center">
                <div className="lg:col-span-5 space-y-8">
                  <h2 className="text-4xl md:text-6xl font-display font-black dark:text-white">{t('token.title')}</h2>
                  <p className="text-xl text-neutral-600 dark:text-neutral-400">
                    {t('token.desc')}
                  </p>
                  <div className="space-y-4">
                    <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-white/5">
                      <div className="text-sm text-neutral-500 mb-1 font-bold uppercase tracking-wider">{t('token.supply')}</div>
                      <div className="text-3xl font-mono font-black dark:text-white">1,000,000,000</div>
                    </div>
                    <div 
                      className="p-6 rounded-3xl bg-brand-yellow text-black shadow-lg shadow-yellow-500/20 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95 group" 
                      onClick={copyToClipboard}
                    >
                      <div className="flex justify-between items-center mb-2">
                         <div className="text-sm font-bold opacity-70 uppercase tracking-wider">{t('token.contract')}</div>
                         {copied ? <Check size={18} /> : <Copy size={18} className="opacity-50 group-hover:opacity-100"/>}
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-black break-all leading-tight">
                        0x2eb08a8fe215f72e01...4444
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <div className="bg-neutral-50 dark:bg-[#111] rounded-[3rem] p-8 border border-neutral-200 dark:border-white/5 shadow-2xl">
                    <StatsChart isDark={darkMode} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Roadmap */}
          <section id={SectionId.ROADMAP} className="py-32 relative bg-[#050505] overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="container mx-auto px-4 relative z-10">
              <div className="text-center mb-20">
                   <span className="text-brand-yellow font-mono text-sm tracking-widest uppercase mb-2 block">The Journey</span>
                   <h2 className="text-4xl md:text-6xl font-display font-black text-white">{t('roadmap.title')}</h2>
              </div>
              <div className="relative max-w-5xl mx-auto">
                  <div className="grid md:grid-cols-3 h-full gap-6">
                      {ROADMAP_DATA.map((phase, idx) => (
                          <div key={idx} className="relative group h-full">
                              <div className={`relative bg-neutral-900/80 backdrop-blur-xl border p-8 rounded-3xl transition-all duration-500 hover:-translate-y-2 h-full flex flex-col
                                  ${phase.status === 'current' ? 'border-brand-yellow/50 shadow-lg shadow-brand-yellow/10' : 'border-white/10 hover:border-white/20'}`}>
                                  <div className="mb-4">
                                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider
                                          ${phase.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                            phase.status === 'current' ? 'bg-brand-yellow/20 text-brand-yellow' : 
                                            'bg-neutral-800 text-neutral-400'}`}>
                                          {phase.phase}
                                      </span>
                                  </div>
                                  <h3 className="text-2xl font-bold text-white mb-4">{phase.title}</h3>
                                  <ul className="space-y-3 mt-auto">
                                      {phase.items.map((item, i) => (
                                          <li key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                                              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${phase.status === 'completed' ? 'bg-green-50' : 'bg-neutral-600'}`}></div>
                                              <span className={phase.status === 'completed' ? 'line-through opacity-50' : ''}>{item}</span>
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-black py-20 border-t border-neutral-200 dark:border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                 <img src="/image/site/logo.png" className="w-8 h-8" />
                 <span className="font-display font-black text-xl dark:text-white">{t('brand.name')}</span>
              </div>
              <p className="text-neutral-500 max-w-xs text-sm">
                {t('footer.desc')}
              </p>
            </div>
            <div className="flex gap-4">
              <a href="https://x.com/beedog_bsc" target="_blank" className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                <Twitter size={20} />
              </a>
              <a href="https://t.me/mifenggoutg" target="_blank" className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                <Send size={20} />
              </a>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-neutral-100 dark:border-white/5 text-center text-xs text-neutral-400">
            <p className="mb-2">{t('footer.risk')}</p>
            <p>{t('footer.copy')}</p>
          </div>
        </div>
      </footer>
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} mode={authMode} onOpenMissions={() => { setIsAuthModalOpen(false); setIsMissionOpen(true); }}/>
      <MissionCenter isOpen={isMissionOpen} onClose={() => setIsMissionOpen(false)} onNavigateToGames={navigateToGames} />
      <BeeDogChat />
    </div>
  );
};

export default App;

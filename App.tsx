
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
  ShoppingBag
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
import { MessageBoard } from './components/MessageBoard'; // New Import
import { useAuth } from './context/AuthContext';

// ... (Data constants unchanged) ...
const ROADMAP_DATA: RoadmapPhase[] = [
  {
    phase: "起步阶段",
    title: "网络爆火",
    items: ["抖音/TikTok 播放量破亿", "微信表情包下载量激增", "社区 CTO (接管) 项目", "去中心化公平发射"],
    status: 'completed'
  },
  {
    phase: "成长阶段",
    title: "文化输出",
    items: ["蜜蜂狗 周边实体玩偶", "KOL 病毒式传播", "持有者突破 10,00+", "Meme创意大赛"],
    status: 'current'
  },
  {
    phase: "最终阶段",
    title: "爆发增长",
    items: ["币安阿尔法上市", "蜜蜂狗慈善基金 (救助流浪狗)", "币安合约上市", "成为 Meme 界的顶流 IP"],
    status: 'upcoming'
  }
];

type ViewState = 'landing' | 'toolbox' | 'games' | 'admin' | 'shop';

const App: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
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
                <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" alt="Logo" className="w-10 h-10 relative z-10 transform group-hover:rotate-12 transition-transform" />
              </div>
              <span className="text-xl font-display font-black tracking-tight hidden sm:block">蜜蜂狗</span>
            </div>

            <div className="hidden md:flex gap-1 bg-white/50 dark:bg-black/20 p-1 rounded-full backdrop-blur-md border border-white/20 dark:border-white/5">
              <button onClick={() => navigateToSection('narrative')} className="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-all">起源</button>
              <button onClick={() => navigateToSection('community-board')} className="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-all">留言板</button>
              <button 
                onClick={navigateToGames} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'games' ? 'bg-brand-yellow text-black shadow-md' : 'hover:bg-white dark:hover:bg-white/10'}`}
              >
                <Gamepad2 size={16} /> 游戏
              </button>
              <button 
                onClick={navigateToToolbox} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'toolbox' ? 'bg-brand-yellow text-black shadow-md' : 'text-brand-orange hover:bg-white dark:hover:bg-white/10'}`}
              >
                <Bot size={16} /> AI 工具
              </button>
              <button 
                onClick={navigateToShop} 
                className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'shop' ? 'bg-brand-yellow text-black shadow-md' : 'hover:bg-white dark:hover:bg-white/10'}`}
              >
                <ShoppingBag size={16} /> 商店
              </button>
              {isAdmin && (
                  <button 
                    onClick={navigateToAdmin} 
                    className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${currentView === 'admin' ? 'bg-red-600 text-white shadow-md' : 'text-red-600 hover:bg-white dark:hover:bg-white/10'}`}
                  >
                    <Shield size={16} /> 后台
                  </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-neutral-300">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {user ? (
                 <div className="flex items-center gap-2">
                    {/* Mission Button */}
                    <button onClick={openMissions} className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white dark:hover:bg-white/10 text-brand-yellow transition-all" title="任务中心">
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
                  登录
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
            <button onClick={() => navigateToSection('narrative')} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold">起源故事</button>
            <button onClick={() => navigateToSection('community-board')} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold">留言板</button>
            <button onClick={navigateToGames} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2"><Gamepad2 size={18}/> 小游戏</button>
            <button onClick={navigateToToolbox} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-brand-orange flex items-center gap-2"><Bot size={18}/> AI 工具箱</button>
            <button onClick={navigateToShop} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-green-600 flex items-center gap-2"><ShoppingBag size={18}/> 商店</button>
             {isAdmin && (
                <button onClick={navigateToAdmin} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold text-red-600 flex items-center gap-2"><Shield size={18}/> 管理后台</button>
             )}
             {user ? (
               <>
                 <button onClick={openMissions} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2 text-brand-yellow">
                    <Target size={20} /> 任务中心
                 </button>
                 <button onClick={openProfile} className="w-full p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left font-bold flex items-center gap-2 border-t border-black/5 dark:border-white/5 mt-2 pt-4">
                    <UserCircle size={20} /> 个人中心 ({userProfile?.nickname})
                 </button>
               </>
             ) : (
                <Button onClick={openLogin} className="w-full mt-4">立即登录</Button>
             )}
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
            {/* Improved Aurora Mesh Gradient Background */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-yellow/30 rounded-full blur-[80px] animate-blob mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
                <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-brand-orange/30 rounded-full blur-[80px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen opacity-60"></div>
                <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] bg-pink-500/20 rounded-full blur-[60px] animate-pulse-glow mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
            </div>
            
            <div className="container mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              
              <div className="text-center lg:text-left space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 border border-brand-orange/30 backdrop-blur-md animate-fade-in-up">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-orange"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">火爆全网的狗狗表情包</span>
                </div>
                
                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-display font-black leading-[0.9] tracking-tighter animate-fade-in-up [animation-delay:200ms]">
                  脸肿了<br/>
                  <span className="clip-text-image">但更强了</span>
                </h1>
                
                <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up [animation-delay:400ms]">
                  从抖音热榜到加密世界。我们是 <span className="font-bold text-brand-yellow">$蜜蜂狗</span>。
                  生活虽然有时候会蛰你一下，但我们依然微笑面对。
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up [animation-delay:600ms]">
                  <Button onClick={() => window.open(`https://gmgn.ai/bsc/token/0x2eb08a8fe215f72e01e089c1cd8c4c4937414444`, "_blank")} size="lg" className="px-8">
                    <Zap className="mr-2 fill-current" /> 立即购买
                  </Button>
                  <Button onClick={() => window.open(`https://t.me/mifenggoutg`, "_blank")} variant="outline" size="lg" className="px-8">
                    <MessageCircle className="mr-2" /> 加入电报群
                  </Button>
                </div>
              </div>

              {/* Hero Visuals - 3D Floating Composition */}
              <div className="relative h-[500px] w-full flex items-center justify-center perspective-1000 animate-fade-in-up [animation-delay:800ms]">
                 <div className="relative w-[300px] h-[400px] sm:w-[350px] sm:h-[450px]">
                    {/* Back Card (Left) */}
                    <div className="group absolute top-12 -left-20 sm:-left-32 w-[90%] h-[90%] z-10 transition-all duration-500 transform -rotate-12 hover:rotate-0 hover:scale-105 hover:z-30">
                       <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-3 border border-white/20 animate-float-delayed opacity-90">
                          <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog2.png?alt=media&token=dc5a47ef-573b-4b0a-bbb9-1876767a2147" className="w-full h-[85%] object-cover rounded-2xl grayscale-[30%] group-hover:grayscale-0 transition-all" />
                          <div className="mt-3 flex items-center gap-2 px-2">
                              <Heart size={16} className="text-red-500 fill-red-500" />
                              <span className="text-xs font-bold text-neutral-400">12.5k Likes</span>
                          </div>
                       </div>
                    </div>
                    
                    {/* Back Card (Right) */}
                    <div className="group absolute top-24 -right-20 sm:-right-32 w-[90%] h-[90%] z-10 transition-all duration-500 transform rotate-12 hover:rotate-0 hover:scale-105 hover:z-30">
                       <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-3 border border-white/20 animate-float opacity-90">
                          <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog3.png?alt=media&token=492461bc-6c44-4a69-bd59-d33736e1bce7" className="w-full h-[85%] object-cover rounded-2xl grayscale-[30%] group-hover:grayscale-0 transition-all" />
                          <div className="mt-3 flex items-center gap-2 px-2">
                              <MessageCircle size={16} className="text-blue-500 fill-blue-500" />
                              <span className="text-xs font-bold text-neutral-400">8.2k Comments</span>
                          </div>
                       </div>
                    </div>

                    {/* Main Card (Center) */}
                    <div className="absolute top-0 left-0 w-full h-full bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-[0_20px_60px_-15px_rgba(255,215,0,0.3)] p-3 border-4 border-brand-yellow transform hover:scale-105 transition-all duration-500 z-20">
                       <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog.jpg?alt=media&token=a4a2e58d-a413-422d-aa1f-98ae61af5d8b" className="w-full h-[85%] object-cover rounded-2xl" />
                       <div className="mt-3 px-2">
                          <div className="text-lg font-black font-display">BeeDog.meme</div>
                          <div className="text-xs text-neutral-400 font-mono">The stickiest coin on chain.</div>
                       </div>
                       
                       {/* Floating Badge */}
                       <div className="absolute -top-4 -right-4 bg-brand-orange text-white px-4 py-2 rounded-full font-bold shadow-lg transform rotate-12 animate-bounce">
                          #1 Trending
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* Narrative Section - Immersive Storytelling */}
          <section id="narrative" className="py-32 relative">
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm -z-10"></div>
            <div className="container mx-auto px-4">
              
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-6xl font-display font-black mb-6">
                  不仅仅是 Meme<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-orange">这是我们的精神图腾</span>
                </h2>
              </div>

              <div className="grid lg:grid-cols-2 gap-16 items-center">
                {/* Visual Side */}
                <div className="relative">
                   <div className="absolute inset-0 bg-gradient-to-tr from-brand-yellow/20 to-transparent rounded-full blur-[100px]"></div>
                   <div className="relative z-10 glass-card rounded-[2.5rem] p-2 overflow-hidden transform rotate-2 hover:rotate-0 transition-all duration-500">
                      <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fdybg.png?alt=media&token=d6139884-4351-4795-91ae-895a02f8cbfa" className="w-full rounded-[2rem]" />
                      
                      {/* Floating UI Elements */}
                      <div className="absolute bottom-8 left-8 right-8 glass rounded-2xl p-4 flex items-center justify-between">
                         <div>
                            <div className="font-bold text-sm">@蜜蜂狗</div>
                            <div className="text-xs opacity-70">抖音热门 · 12.5M 播放</div>
                         </div>
                         <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                            <Heart fill="currentColor" size={20} />
                         </div>
                      </div>
                   </div>
                </div>

                {/* Text Side */}
                <div className="space-y-12">
                   <div className="space-y-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-4">
                         <TrendingUp size={28} />
                      </div>
                      <h3 className="text-3xl font-bold">抖音/TikTok 爆火起源</h3>
                      <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        一切始于一只好奇心太重的修勾。它只是想尝尝蜂蜜的味道，结果变成了全网最“圆润”的狗子。
                        #蜜蜂狗标签在抖音和 TikTok 上获得了十亿次播放，它那种<span className="text-brand-orange font-bold">“滑稽但又无辜”</span>的眼神，击中了无数人的心。
                      </p>
                   </div>

                   <div className="space-y-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-500 mb-4">
                         <MessageCircle size={28} />
                      </div>
                      <h3 className="text-3xl font-bold">微信社交货币</h3>
                      <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        在微信上，蜜蜂狗已经成为了年轻人的<span className="text-brand-yellow font-bold">“赛博替身”</span>。
                        当你不想上班时，当你被生活“蛰”了一下时，一张蜜蜂狗表情包胜过千言万语。它是我们表达情绪的一种方式。
                      </p>
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Community Section - Bento Grid */}
          <section id="community" className="py-32 bg-neutral-100 dark:bg-[#080808]">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-display font-black mb-4">蜜蜂狗社区</h2>
                <p className="text-neutral-500 text-xl">去中心化，社区驱动，永不 Rug。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                 {/* Large Card */}
                 <div className="md:col-span-2 bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 md:p-12 border border-neutral-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-yellow/10 rounded-full blur-[80px] group-hover:bg-brand-yellow/20 transition-all"></div>
                    <div className="relative z-10">
                       <div className="w-14 h-14 bg-brand-yellow rounded-2xl flex items-center justify-center mb-6 text-black shadow-lg shadow-yellow-500/20">
                          <Users size={28} />
                       </div>
                       <h3 className="text-3xl font-bold mb-4">100% 社区接管 (CTO)</h3>
                       <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-md">
                          没有 VC，没有项目方，没有老鼠仓。就像蜜蜂筑巢一样，每一个 $蜜蜂狗 的持有者都在为社区添砖加瓦。
                       </p>
                    </div>
                 </div>

                 {/* Tall Card - Meme Potential (Updated) */}
                 <div className="md:row-span-2 bg-brand-yellow rounded-[2.5rem] p-8 border border-yellow-400 relative overflow-hidden group text-black flex flex-col justify-between">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

                    <div className="relative z-10">
                       <div className="w-14 h-14 bg-black/10 rounded-2xl flex items-center justify-center mb-6 text-black">
                          <ImageIcon size={28} />
                       </div>
                       <h3 className="text-3xl font-bold mb-4">无限 Meme 潜力</h3>
                       <p className="text-lg opacity-80 mb-6">
                          素材库每天更新，二创内容层出不穷。每一个表情包都是传播的种子。
                       </p>
                       <p className="text-sm font-bold border-l-4 border-black pl-4 py-1 bg-white/20 backdrop-blur-sm rounded-r-lg">
                          "一张好图胜过千言万语，蜜蜂狗 就是最好的语言。"
                       </p>
                    </div>
                    
                    {/* Button to Toolbox instead of just images */}
                    <div className="relative z-10 mt-4">
                        <button onClick={navigateToToolbox} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                            <Sparkles size={18} /> 去制作表情包
                        </button>
                    </div>
                 </div>

                 {/* Small Card */}
                 <div className="bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-white/5 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px]"></div>
                    <div className="relative z-10">
                       <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                          <Shield size={24} />
                       </div>
                       <h3 className="text-xl font-bold mb-2">抗击打能力强</h3>
                       <p className="text-neutral-500 text-sm">
                          经历过市场的毒打，脸虽然肿了，但钻石手从未松开。
                       </p>
                    </div>
                 </div>

                 {/* Small Card */}
                 <div className="bg-white dark:bg-[#121212] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-white/5 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-[40px]"></div>
                    <div className="relative z-10">
                       <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-500 rounded-2xl flex items-center justify-center mb-4">
                          <Globe size={24} />
                       </div>
                       <h3 className="text-xl font-bold mb-2">全球共识</h3>
                       <p className="text-neutral-500 text-sm">
                          不分国界，每个人都能看懂这只肿脸狗的委屈。
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* Message Board Section - Replaces Social Buzz */}
          <MessageBoard onLoginRequest={openLogin} />

          {/* Tokenomics */}
          <section id={SectionId.TOKENOMICS} className="py-32 bg-white dark:bg-black">
            <div className="container mx-auto px-4">
              <div className="grid lg:grid-cols-12 gap-16 items-center">
                <div className="lg:col-span-5 space-y-8">
                  <h2 className="text-4xl md:text-6xl font-display font-black">代币经济学</h2>
                  <p className="text-xl text-neutral-600 dark:text-neutral-400">
                    简单、透明、公平。<br/>
                    没有复杂的税收，社区钱包所有代币始于1BNB。
                  </p>
                  
                  <div className="space-y-4">
                    <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-white/5">
                      <div className="text-sm text-neutral-500 mb-1 font-bold uppercase tracking-wider">Total Supply</div>
                      <div className="text-3xl font-mono font-black">1,000,000,000</div>
                    </div>
                    
                    <div 
                      className="p-6 rounded-3xl bg-brand-yellow text-black shadow-lg shadow-yellow-500/20 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95 group" 
                      onClick={copyToClipboard}
                    >
                      <div className="flex justify-between items-center mb-2">
                         <div className="text-sm font-bold opacity-70 uppercase tracking-wider">Contract Address (BNB)</div>
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

          {/* Roadmap (Redesigned) */}
          <section id={SectionId.ROADMAP} className="py-32 relative bg-[#050505] overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            <div className="container mx-auto px-4 relative z-10">
              <div className="text-center mb-20">
                   <span className="text-brand-yellow font-mono text-sm tracking-widest uppercase mb-2 block">The Journey</span>
                   <h2 className="text-4xl md:text-6xl font-display font-black text-white">未来计划</h2>
              </div>

              <div className="relative max-w-5xl mx-auto">
                  <div className="grid md:grid-cols-3 h-full gap-6">
                      {ROADMAP_DATA.map((phase, idx) => (
                          <div key={idx} className="relative group h-full">
                              {/* Content Card */}
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
                                              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${phase.status === 'completed' ? 'bg-green-500' : 'bg-neutral-600'}`}></div>
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
                 <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" className="w-8 h-8" />
                 <span className="font-display font-black text-xl">蜜蜂狗</span>
              </div>
              <p className="text-neutral-500 max-w-xs text-sm">
                Web3 世界最粘人的肿脸狗狗。<br/>社区接管，永不 Rug。
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
            <p className="mb-2">加密货币具有高风险，请注意投资风险，喜欢并且买入，使用不影响生活的钱。</p>
            <p>© 2025 蜜蜂狗社区. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} mode={authMode} onOpenMissions={() => { setIsAuthModalOpen(false); setIsMissionOpen(true); }}/>
      
      {/* Mission Center */}
      <MissionCenter isOpen={isMissionOpen} onClose={() => setIsMissionOpen(false)} onNavigateToGames={navigateToGames} />
      
      {/* Floating Chat */}
      <BeeDogChat />
    </div>
  );
};

export default App;

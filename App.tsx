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
  View, ChartNoAxesColumn, Send
} from 'lucide-react';
import { Button } from './components/Button';
import { StatsChart } from './components/StatsChart';
import { RoadmapPhase, SectionId } from './types';
import { AuthModal } from './components/AuthModal';
import { AIToolbox } from './components/AIToolbox';
import { MiniGamesHub } from './components/MiniGamesHub';
import { useAuth } from './context/AuthContext';

// --- DATA ---
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
    items: ["BeeDog 周边实体玩偶", "KOL 病毒式传播", "持有者突破 10,00+", "Meme创意大赛"],
    status: 'current'
  },
  {
    phase: "最终阶段",
    title: "爆发增长",
    items: ["币安阿尔法上市", "蜜蜂狗慈善基金 (救助流浪狗)", "币安合约上市", "成为 Meme 界的顶流 IP"],
    status: 'upcoming'
  }
];

// Mock Twitter/X Data
const TWEETS_DATA = [
  {
    id: 1,
    name: "蜜蜂狗 Beedog",
    handle: "@beedog_bsc",
    avatar: "https://pbs.twimg.com/profile_images/1975858091808944128/9O5tEdqX_400x400.jpg",
    content: "BSC现在有一点点枯，但咱大可不必急躁。\n" +
        "欢迎在苦苦枯坐的你\n" +
        "来听听、来看看，关于蜜蜂狗的故事❤️",
    image: "https://pbs.twimg.com/media/G4AhozbWAAAIcSh?format=jpg&name=medium",
    time: "Last edited\n" +
        "3:36 PM · Oct 24, 2025",
    url:"https://x.com/beedog_bsc/status/1981625901994373447?t=Y9wEKZC-KhZGrV5AVkzwBw&s=19",
    views: '14.6K'
  },
  {
    id: 2,
    name: "April",
    handle: "@xxxApril_D13",
    avatar: "https://pbs.twimg.com/profile_images/1884747607098146817/Monp3AwR_400x400.jpg",
    content: "Gm ❄️\n" +
        "\n" +
        "我的哈基米很ok #okxdex \n" +
        "#蜜蜂狗 竟然也3M了\n" +
        "迁移在bsc的第一天买入已经10x\n" +
        "毅力最强社区之一",
    image: "https://pbs.twimg.com/media/G3EdLnDbYAAIryx?format=jpg&name=medium",
    time: "11:19 PM · Oct 12, 2025",
    url:"https://x.com/xxxApril_D13/status/1977393805423755718",
    views: '23.1K'
  },
  {
    id: 3,
    name: "CryptoCat | 猫姐 🐈",
    handle: "@Crypto_Cat888",
    avatar: "https://pbs.twimg.com/profile_images/1995408731694366720/C8mvQZhf_400x400.jpg",
    content: "今天很多建设标开始慢慢地回调了\n" +
        "\n" +
        "甚至最近出来了很多借“建设之名”快速收割的\n" +
        "\n" +
        "潮水退却才会知道谁在裸泳\n" +
        "\n" +
        "优秀的社区会在磨砺中愈发强大并脱颖而出\n" +
        "\n" +
        "如果一个人借这波建设，你得想清楚这个人会坚持几天，别人我不知道，蜜蜂狗已经整整坚持了100天➕\n" +
        "\n" +
        "Hold and Build\n",
    image: "https://pbs.twimg.com/media/G3ISxw_aAAEVGB9?format=jpg&name=small",
    time: "5:12 PM · Oct 13, 2025",
    url:"https://x.com/Crypto_Cat888/status/1977663837882253399?t=Ur2uMhp6koomjKFxjZD80w&s=19",
    views: '23.1K'
  },
  {
    id: 4,
    name: "ming_lau",
    handle: "@minglaugodel",
    avatar: "https://pbs.twimg.com/profile_images/1868326100621000704/qUtDgzr5_400x400.jpg",
    content: "蜜蜂狗的社区气氛我感觉也是一个100m的潜力币\n" +
        "虽然说社区 build都挺扯淡\n" +
        "但还是有点不同的\n" +
        "lowb当初就很有趣，10多万人群每天聊天记录翻不到头\n" +
        "只不过时机不对\n" +
        "在没有庄的情况下，最高400m\n" +
        "放现在，币安alpha肯定上了\n" +
        "合约可能也上了",
    image: "https://pbs.twimg.com/media/G3tFUptXkAALyhz?format=jpg&name=medium",
    time: "6:07 PM · Oct 15, 2025",
    url:"https://x.com/minglaugodel/status/1978402359211344065",
    views: '7,427'
  },
  {
    id: 5,
    name: "老八只白嫖",
    handle: "@BTCOld8",
    avatar: "https://pbs.twimg.com/profile_images/1565584872776691712/VI-6Hvzd_400x400.jpg",
    content: "感谢蜜蜂狗 \n" +
        "@beedog_bsc\n" +
        "项目方的空投，你们的热情我感受到了！\n" +
        "\n" +
        "之前在SOL链的时候就重点关注过 #蜜蜂狗 社区，以为他们不建设了，没想到一直都很有韧性，几天前就迁移到了BSC上继续建设\n" +
        "\n" +
        "该团队也是很大气，给很多国人KOL都发放了空投，秉持一姐把筹码散出去的原则，想打造真正拥有共识体系的社区\n" +
        "\n" +
        "目前市值百万以内，不算高，BSC的土狗 #meme 热度还在持续，就这格局至少值个千万级市值，感兴趣的兄弟可以关注一下！\n",
    image: "https://pbs.twimg.com/media/G2-g3cLbwAY9Qd0?format=jpg&name=900x900",
    time: "7:39 PM · Oct 11, 2025",
    url:"https://x.com/BTCOld8/status/1976975826303275445?t=pZn0n6zaOLtxkz9PZnOYCA&s=19",
    views: '23.7K'
  }
];

type ViewState = 'landing' | 'toolbox' | 'games';

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
      // Small delay to allow render before scrolling
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
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

  return (
    <div className="min-h-screen text-neutral-900 dark:text-neutral-100 overflow-x-hidden transition-colors duration-300 honey-pattern font-sans selection:bg-brand-yellow selection:text-black">
      
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${scrolled ? 'glass shadow-sm py-3' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateToSection(SectionId.HERO)}>
            <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" alt="Logo" className="w-10 h-10 rounded-xl shadow-lg transform hover:rotate-12 transition-transform" />
            <span className="text-xl font-black tracking-tight dark:text-white">蜜蜂狗</span>
          </div>

          <div className="hidden md:flex gap-8 text-sm font-semibold items-center text-neutral-600 dark:text-neutral-300">
            <button onClick={() => navigateToSection('narrative')} className="hover:text-brand-yellow transition-colors">起源故事</button>
            <button onClick={() => navigateToSection('community')} className="hover:text-brand-yellow transition-colors">社区力量</button>
            <button onClick={() => navigateToSection('social')} className="hover:text-brand-yellow transition-colors">社媒热议</button>
            
            {/* New Games Link */}
            <button 
              onClick={navigateToGames} 
              className={`flex items-center gap-1 transition-colors ${currentView === 'games' ? 'text-brand-yellow' : 'text-neutral-600 dark:text-neutral-300 hover:text-brand-yellow'}`}
            >
              <Gamepad2 size={18} /> 小游戏
            </button>

            {/* AI Toolbox Link */}
            <button 
              onClick={navigateToToolbox} 
              className={`flex items-center gap-1 transition-colors ${currentView === 'toolbox' ? 'text-brand-yellow' : 'text-brand-orange hover:text-brand-yellow'}`}
            >
              <Bot size={18} /> AI 工具箱
            </button>
            
            <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700"></div>
            
            <button onClick={toggleTheme} className="p-2 hover:bg-neutral-100 dark:hover:bg-[#222] rounded-full transition">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Auth Button */}
            {user ? (
               <div className="flex items-center gap-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#222] p-1 pr-3 rounded-full transition" onClick={openProfile}>
                  <div className="w-8 h-8 rounded-full bg-brand-yellow flex items-center justify-center overflow-hidden border border-neutral-200">
                    {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} className="w-full h-full object-cover" /> : '🐶'}
                  </div>
                  <span className="font-bold max-w-[100px] truncate">{userProfile?.nickname || '蜜蜂狗'}</span>
               </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={openLogin}>
                登录
              </Button>
            )}
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button onClick={toggleTheme}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full glass border-b border-neutral-200 dark:border-[#222] p-6 flex flex-col gap-4 animate-in slide-in-from-top-5">
            <button onClick={() => navigateToSection('narrative')} className="text-lg font-bold text-left">起源故事</button>
            <button onClick={() => navigateToSection('community')} className="text-lg font-bold text-left">社区力量</button>
            <button onClick={navigateToGames} className="text-lg font-bold text-left flex items-center gap-2">
              <Gamepad2 size={20} /> 小游戏
            </button>
            <button onClick={navigateToToolbox} className="text-lg font-bold text-brand-orange text-left flex items-center gap-2">
              <Bot size={20} /> AI 工具箱
            </button>
             {user ? (
               <button onClick={openProfile} className="flex items-center gap-2 text-lg font-bold">
                  <UserCircle /> 个人中心 ({userProfile?.nickname})
               </button>
             ) : (
                <Button onClick={openLogin} className="w-full">立即登录</Button>
             )}
          </div>
        )}
      </nav>

      {/* --- CONDITIONAL RENDERING --- */}
      
      {currentView === 'toolbox' ? (
        <AIToolbox onLoginRequest={openLogin} />
      ) : currentView === 'games' ? (
        <MiniGamesHub onLoginRequest={openLogin} />
      ) : (
        <>
          {/* Hero Section */}
          <section id={SectionId.HERO} className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] bg-yellow-400/20 rounded-full blur-[100px] -z-10 animate-blob"></div>
            
            <div className="container mx-auto px-4 text-center relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in-up border border-orange-200 dark:border-orange-800">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                火爆全网的狗狗表情包
              </div>
              
              <h1 className="text-5xl md:text-8xl font-black mb-6 leading-tight tracking-tight">
                脸肿了，<br className="md:hidden"/>但
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-600 mx-2">更强了</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                从抖音热榜到加密世界。我们是 <span className="font-bold text-brand-yellow">$蜜蜂狗</span>。
                <br/>
                生活虽然有时候会蛰你一下，但我们依然微笑面对。
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button onClick={() => window.open(`https://gmgn.ai/bsc/token/0x2eb08a8fe215f72e01e089c1cd8c4c4937414444`, "_blank")} size="lg" className="text-lg px-8 py-4 shadow-xl shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-shadow">
                  <Zap className="mr-2 fill-current" /> 立即购买
                </Button>
                <Button onClick={() => window.open(`https://t.me/mifenggoutg`, "_blank")} variant="outline" size="lg" className="text-lg px-8 py-4 backdrop-blur-sm">
                  <MessageCircle className="mr-2" /> 加入电报群
                </Button>
              </div>

              {/* Hero Visuals */}
              <div className="mt-24 relative max-w-4xl mx-auto">
                <div className="relative z-10 grid grid-cols-3 gap-4 items-end animate-float">
                    <div className="transform translate-y-12 -rotate-6 transition-transform hover:scale-105 duration-300">
                      <div className="bg-white dark:bg-[#161616] p-2 rounded-2xl shadow-xl transform rotate-3">
                          <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog2.png?alt=media&token=dc5a47ef-573b-4b0a-bbb9-1876767a2147" alt="Bee Dog" className="rounded-xl grayscale-[50%] hover:grayscale-0 transition-all" />
                          <div className="p-2 text-center text-xs font-bold text-neutral-500">蜜蜂狗</div>
                      </div>
                    </div>
                    <div className="z-20 transform scale-125 transition-transform hover:scale-150 duration-300">
                      <div className="bg-white dark:bg-[#161616] p-2 rounded-2xl shadow-2xl border-4 border-brand-yellow">
                          <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog.jpg?alt=media&token=a4a2e58d-a413-422d-aa1f-98ae61af5d8b" alt="Bee Dog" className="rounded-xl" />
                          <div className="p-2 text-center text-sm font-black bg-brand-yellow text-black mt-2 rounded-lg">蜜蜂狗!!</div>
                      </div>
                    </div>
                    <div className="transform translate-y-12 rotate-6 transition-transform hover:scale-105 duration-300">
                      <div className="bg-white dark:bg-[#161616] p-2 rounded-2xl shadow-xl transform -rotate-3">
                          <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbeedog3.png?alt=media&token=492461bc-6c44-4a69-bd59-d33736e1bce7" alt="Meme Dog" className="rounded-xl grayscale-[50%] hover:grayscale-0 transition-all" />
                          <div className="p-2 text-center text-xs font-bold text-neutral-500">这也是蜜蜂狗!</div>
                      </div>
                    </div>
                </div>
                {/* Background decorative elements */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-32 bg-yellow-400/20 blur-3xl rounded-[100%] -z-10"></div>
              </div>
            </div>
          </section>

          {/* Narrative & Cultural Impact */}
          <section id="narrative" className="py-24 relative bg-white/50 dark:bg-black/20">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-black mb-6 dark:text-white">
                    不仅仅是一个 Meme<br/>这是我们的<span className="text-brand-yellow">精神图腾</span>
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
                        <TrendingUp className="text-red-500" /> 抖音/TikTok 爆火起源
                    </h3>
                    <p className="text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        一切始于一只好奇心太重的修勾。它只是想尝尝蜂蜜的味道，结果变成了全网最“圆润”的狗子。
                        #蜜蜂狗标签在抖音和 TikTok 上获得了十亿次播放，它那种<b>“滑稽但又无辜”</b>的眼神，击中了无数人的心。
                    </p>
                  </div>
                  <div className="bg-black rounded-2xl p-4 rotate-2 shadow-2xl">
                    <div className="aspect-[9/16] bg-[#161616] rounded-xl flex items-center justify-center text-neutral-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10"></div>
                        <div className="absolute bottom-16 left-4 z-20 text-white">
                          <p className="font-bold text-sm">@蜜蜂狗</p>
                          <p className="text-xs opacity-80">脸肿了... 求安慰 🍯 #蜜蜂狗 #萌宠 #搞笑 #小狗</p>
                        </div>
                        <div className="absolute right-2 bottom-20 z-20 flex flex-col gap-4 text-white items-center">
                          <Heart className="fill-red-500 text-red-500" /> <span className="text-xs">1.2M</span>
                          <MessageCircle /> <span className="text-xs">50k</span>
                        </div>
                        <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fdybg.png?alt=media&token=d6139884-4351-4795-91ae-895a02f8cbfa" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-center md:flex-row-reverse">
                  <div className="order-2 md:order-1 grid grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-[#161616] p-4 rounded-xl shadow-lg rounded-tl-none border border-neutral-100 dark:border-[#333]">
                        <p className="text-sm font-bold mb-2">朋友：你是说你一觉睡醒就这样了?</p>
                        <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbq1.png?alt=media&token=fe995021-c7d9-4306-95db-feb1b45a5f2c" className="rounded-lg mb-1 w-24 h-24 object-cover" />
                      </div>
                      <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl shadow-lg rounded-tr-none border border-green-200 dark:border-green-800 mt-8">
                        <p className="text-sm font-bold mb-2">亲爱的：我错了原谅我吧！</p>
                        <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Fbq2.png?alt=media&token=65fe4349-b3e4-451e-a4ca-ca61700de56d" className="rounded-lg mb-1 w-24 h-24 object-cover" />
                      </div>
                  </div>
                  <div className="order-1 md:order-2 space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
                        <MessageCircle className="text-green-500" /> 微信社交货币
                    </h3>
                    <p className="text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        在微信上，蜜蜂狗已经成为了年轻人的<b>“赛博替身”</b>。
                        <br/><br/>
                        当你不想上班时，当你被生活“蛰”了一下时，当你需要朋友的安慰时，一张蜜蜂狗表情包胜过千言万语。、它是我们表达情绪的一种方式。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Community Section */}
          <section id="community" className="py-24 relative overflow-hidden bg-brand-yellow/10">
            <div className="container mx-auto px-4">
              <div className="glass-card rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-yellow rounded-full mix-blend-multiply filter blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 transform translate-x-1/2 translate-y-1/2 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl"></div>
                </div>

                <div className="text-center max-w-3xl mx-auto relative z-10">
                  <h2 className="text-3xl md:text-5xl font-black mb-6 dark:text-white">
                    <p>社区接管 (CTO)</p>
                    <span className="text-brand-orange">我们是蜂群</span>
                  </h2>
                  <p className="text-lg text-neutral-700 dark:text-neutral-200 mb-10 leading-relaxed">
                    没有 VC，没有项目方，没有老鼠仓。
                    <br/>
                    就像蜜蜂筑巢一样，每一个 $蜜蜂狗 的持有者都在为社区添砖加瓦。
                    不管是做表情包、剪视频、还是在推特上“嗡嗡”叫，我们正在建立加密世界最粘人的社区。
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl shadow-sm hover:-translate-y-1 transition-transform">
                      <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center text-yellow-600 mb-4">
                          <Shield size={24} />
                      </div>
                      <h4 className="font-bold text-lg mb-2 dark:text-white">抗击打能力强</h4>
                      <p className="text-sm text-neutral-500">经历过市场的毒打，脸虽然肿了，但钻石手从未松开。</p>
                    </div>
                    <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl shadow-sm hover:-translate-y-1 transition-transform">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 mb-4">
                          <Users size={24} />
                      </div>
                      <h4 className="font-bold text-lg mb-2 dark:text-white">去中心化</h4>
                      <p className="text-sm text-neutral-500">100% 社区驱动，每一只蜜蜂都有投票权。</p>
                    </div>
                    <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl shadow-sm hover:-translate-y-1 transition-transform">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                          <ImageIcon size={24} />
                      </div>
                      <h4 className="font-bold text-lg mb-2 dark:text-white">无限 Meme 潜力</h4>
                      <p className="text-sm text-neutral-500">素材库每天更新，二创内容层出不穷。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Social Buzz (Twitter/X Feed Replacement) */}
          <section id="social" className="py-24 bg-neutral-50 dark:bg-[#0A0A0A]">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-black mb-4 dark:text-white flex items-center justify-center gap-3">
                  <Twitter className="fill-current text-blue-400" size={40} />
                  社媒热议
                </h2>
                <p className="text-neutral-500">看看大家在 X (Twitter) 上怎么说 #蜜蜂狗</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
                {/* CTA Card */}
                <div className="bg-white dark:bg-[#111] rounded-2xl p-6 shadow-md border border-neutral-100 dark:border-[#222] flex flex-col items-center justify-center text-center gap-4 hover:border-brand-yellow transition-colors group">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-2 group-hover:scale-110 transition-transform">
                    <Twitter size={32} />
                  </div>
                  <h3 className="font-bold text-xl dark:text-white">加入讨论</h3>
                  <p className="text-neutral-500 text-sm">发布你的蜜蜂狗 Meme，带上 <span className="text-brand-yellow">#蜜蜂狗</span> 标签！</p>
                  <Button onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent("#蜜蜂狗 to the moon!🐝🐕")}`, "_blank")} variant="outline" size="sm" className="mt-2">去发推</Button>
                </div>

                {/* Tweets */}
                {TWEETS_DATA.map((tweet) => (
                  <div onClick={() => window.open(`${tweet.url}`, "_blank")} key={tweet.id} className="bg-white dark:bg-[#111] rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-neutral-100 dark:border-[#222] flex flex-col hover:-translate-y-1 cursor-pointer transition-transform">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-3">
                          <img src={tweet.avatar} alt={tweet.name} className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-[#333]" />
                          <div>
                              <div className="flex items-center gap-1">
                                <h4 className="font-bold text-neutral-900 dark:text-white">{tweet.name}</h4>
                              </div>
                              <p className="text-neutral-400 text-sm">{tweet.handle}</p>
                          </div>
                        </div>
                        <Twitter size={16} className="text-neutral-300 dark:text-neutral-600" />
                    </div>
                    
                    <p className="text-neutral-800 dark:text-neutral-200 mb-4 text-base leading-relaxed whitespace-pre-line">
                        {tweet.content}
                    </p>

                    {tweet.image && (
                        <div className="rounded-xl overflow-hidden mb-4 border border-neutral-100 dark:border-[#222]">
                          <img src={tweet.image} alt="Tweet media" className="w-full h-48 md:h-56 object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-neutral-100 dark:border-[#222] flex items-center justify-between text-neutral-400 text-sm">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 hover:text-red-500 cursor-pointer transition-colors">
                              <ChartNoAxesColumn size={16} /> <span>{tweet.views}</span>
                          </div>
                        </div>
                        <View onClick={() => window.open(`${tweet.url}`, "_blank")} size={16} className="hover:text-brand-yellow cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Tokenomics & Contract */}
          <section id={SectionId.TOKENOMICS} className="py-24 relative overflow-hidden">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-12 gap-12">
                <div className="md:col-span-5 flex flex-col justify-center">
                  <h2 className="text-4xl font-black mb-6 dark:text-white">代币经济学</h2>
                  <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">
                    简单、透明。没有复杂的税收，社区钱包所有代币始于1BNB。
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-[#333]">
                      <div className="text-sm text-neutral-500 mb-1">总供应量</div>
                      <div className="text-2xl font-mono font-bold dark:text-white">1,000,000,000</div>
                    </div>
                    <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-[#333] flex justify-between items-center group cursor-pointer" onClick={copyToClipboard}>
                      <div>
                        <div className="text-sm text-neutral-500 mb-1">合约地址 (CA)</div>
                        <div className="font-mono font-bold text-neutral-800 dark:text-neutral-200 break-all text-sm md:text-base">0x2eb08a8fe215f72e01......4444</div>
                      </div>
                      <div className="bg-neutral-100 dark:bg-[#262626] p-2 rounded-lg group-hover:bg-brand-yellow group-hover:text-black transition-colors">
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-7 bg-white dark:bg-[#111] rounded-[2rem] p-8 shadow-xl border border-neutral-100 dark:border-[#222]">
                  <StatsChart isDark={darkMode} />
                </div>
              </div>
            </div>
          </section>

          {/* Roadmap */}
          <section id={SectionId.ROADMAP} className="py-24 bg-brand-yellow dark:bg-yellow-900/10">
            <div className="container mx-auto px-4">
              <h2 className="text-4xl font-black text-center mb-16 dark:text-brand-yellow">未来计划</h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                {ROADMAP_DATA.map((phase, idx) => (
                  <div key={idx} className={`relative bg-white dark:bg-[#111] p-8 rounded-3xl shadow-lg border-2 ${phase.status === 'current' ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-transparent dark:border-[#222]'}`}>
                    <div className="absolute -top-5 left-8 px-4 py-2 bg-black text-white text-sm font-bold rounded-lg shadow-lg">
                      {phase.phase}
                    </div>
                    <h3 className="text-2xl font-bold mt-4 mb-6 dark:text-white">{phase.title}</h3>
                    <ul className="space-y-3">
                      {phase.items.map((item, i) => (
                        <li key={i} className={`flex items-start gap-3 text-sm font-medium ${phase.status === 'completed' ? 'text-neutral-400 line-through' : 'text-neutral-700 dark:text-neutral-300'}`}>
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${phase.status === 'current' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-300'}`}></div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-black py-16 border-t border-neutral-200 dark:border-[#222]">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-black mb-2 dark:text-white">蜜蜂狗</h3>
              <p className="text-neutral-500 max-w-xs">
                Web3 世界最粘人的肿脸狗狗，社区接管，永不 Rug。
              </p>
            </div>
            
            <div className="flex gap-6">
              <a  href="https://x.com/beedog_bsc" className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#161616] flex items-center justify-center hover:bg-brand-yellow hover:text-black transition-all dark:text-white">
                <Twitter size={20} />
              </a>
              <a  href="https://t.me/mifenggoutg" className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#161616] flex items-center justify-center hover:bg-brand-yellow hover:text-black transition-all dark:text-white">
                <Send size={20} />
              </a>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-neutral-100 dark:border-[#222] text-center text-sm text-neutral-400">
            <p className="mb-2">加密货币具有高风险，请注意投资风险，喜欢并且买入，使用不影响生活的钱。</p>
            <p>© 2025 蜜蜂狗社区. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} mode={authMode} />
    </div>
  );
};

export default App;
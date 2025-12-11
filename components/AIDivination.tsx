
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { deductCredit, saveDivinationResult, getDivinationHistory, DivinationRecord } from '../services/userService';
import { getAIDivination, DivinationResult } from '../services/geminiService';
import { Sparkles, Zap, RotateCcw, Calendar, Compass, TrendingUp, Heart, Activity, User, Hash, MapPin, Palette, Loader2, Lock, Clock, Map } from 'lucide-react';

interface AIDivinationProps {
  onLoginRequest: () => void;
}

export const AIDivination: React.FC<AIDivinationProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  
  // Form State
  const [name, setName] = useState("");
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [birthYear, setBirthYear] = useState(1990);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthDay, setBirthDay] = useState(1);
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DivinationResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Record<string, DivinationRecord>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const resultRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const COST = 10; // 10 Honey per fortune

  // Current Date Helper
  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const hasCalculatedToday = !!history[todayStr];

  // Helper arrays for Selects
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i); // 1920 to Now
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  
  const timeOptions = [
      { val: "", label: "时辰不清楚 (Unknown)" },
      { val: "23:00-01:00", label: "子时 (23:00-01:00)" },
      { val: "01:00-03:00", label: "丑时 (01:00-03:00)" },
      { val: "03:00-05:00", label: "寅时 (03:00-05:00)" },
      { val: "05:00-07:00", label: "卯时 (05:00-07:00)" },
      { val: "07:00-09:00", label: "辰时 (07:00-09:00)" },
      { val: "09:00-11:00", label: "巳时 (09:00-11:00)" },
      { val: "11:00-13:00", label: "午时 (11:00-13:00)" },
      { val: "13:00-15:00", label: "未时 (13:00-15:00)" },
      { val: "15:00-17:00", label: "申时 (15:00-17:00)" },
      { val: "17:00-19:00", label: "酉时 (17:00-19:00)" },
      { val: "19:00-21:00", label: "戌时 (19:00-21:00)" },
      { val: "21:00-23:00", label: "亥时 (21:00-23:00)" },
  ];

  useEffect(() => {
    if (user) {
        setHistoryLoading(true);
        getDivinationHistory(user.uid).then(records => {
            const map: Record<string, DivinationRecord> = {};
            records.forEach(r => map[r.date] = r);
            setHistory(map);
            
            // Auto-load today if exists
            if (map[todayStr]) {
                setResult(map[todayStr]);
            }
        }).finally(() => setHistoryLoading(false));
    }
  }, [user]);

  const handleDivinate = async () => {
    if (!user || !userProfile) {
      onLoginRequest();
      return;
    }

    if (hasCalculatedToday) {
        // Just view result (should already be loaded, but safety check)
        if (history[todayStr]) setResult(history[todayStr]);
        return;
    }

    if (userProfile.credits < COST) {
      setError(`蜂蜜不足！需要 ${COST} 罐蜂蜜。请在个人中心每日签到获取更多。`);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    
    // Scroll to result on mobile
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const allowed = await deductCredit(user.uid, COST);
      if (!allowed) throw new Error("Credit deduction failed");
      await refreshProfile();

      const dateStr = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

      // Simulate a bit of "calculating" time for UX
      const minWait = new Promise(resolve => setTimeout(resolve, 2000));
      const apiCall = getAIDivination(
          {
              date: dateStr,
              type: calendarType,
              time: birthTime,
              location: birthLocation
          }, 
          name || userProfile.nickname || "有缘人"
      );
      
      const [_, data] = await Promise.all([minWait, apiCall]);
      
      // Save to history
      const record = await saveDivinationResult(user.uid, data);
      
      // Update state
      setHistory(prev => ({ ...prev, [record.date]: record }));
      setResult(data);

    } catch (err) {
      console.error(err);
      
      // Refund Logic
      if (user) {
          await deductCredit(user.uid, -COST);
          await refreshProfile();
          setError("天机不可泄露... (请求失败，蜂蜜已退还，请重试)");
      } else {
          setError("请求失败，请检查网络。");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-indexed
      
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const daysArray = [];
      // Empty slots
      for(let i=0; i<firstDay; i++) daysArray.push(null);
      // Days
      for(let i=1; i<=daysInMonth; i++) daysArray.push(i);

      return (
          <div className="grid grid-cols-7 gap-2 text-center text-sm">
              {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-neutral-400 text-xs font-bold py-2">{d}</div>
              ))}
              {daysArray.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`}></div>;
                  
                  const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const record = history[dateKey];
                  const isToday = dateKey === todayStr;
                  const isSelected = result && 'date' in result && (result as DivinationRecord).date === dateKey;

                  return (
                      <button 
                        key={day}
                        onClick={() => {
                            if (record) setResult(record);
                        }}
                        disabled={!record}
                        className={`
                            aspect-square rounded-full flex flex-col items-center justify-center relative transition-all
                            ${isToday ? 'border border-brand-yellow' : ''}
                            ${record 
                                ? isSelected ? 'bg-purple-600 text-white shadow-lg scale-110' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50' 
                                : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }
                        `}
                      >
                          <span className="font-bold">{day}</span>
                          {record && <div className="w-1 h-1 bg-current rounded-full mt-0.5"></div>}
                      </button>
                  );
              })}
          </div>
      );
  };

  return (
    <div id="ai-divination" className="py-24 bg-white rounded-2xl dark:bg-[#0A0A0A] border-t border-neutral-100 dark:border-[#222]">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-100 dark:border-purple-800">
            <Compass size={14} /> AI 玄学实验室
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 dark:text-white">
           蜜蜂狗 <span className="text-purple-500">大师</span>
          </h2>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
            结合传统命理八字与流年运势。精准推演今日吉凶。
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Input Controls & History */}
          <div className="lg:col-span-5 space-y-6">
             <div className="bg-white dark:bg-[#111] rounded-3xl p-6 md:p-8 shadow-xl border border-neutral-100 dark:border-[#222]">
                
                <div className="space-y-6">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2 flex items-center gap-2">
                           <User size={16} className="text-purple-500"/> 你的称呼 (可选)
                        </label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例如: 钻石手杰克"
                            className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white"
                        />
                    </div>

                    {/* Date Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                               <Calendar size={16} className="text-purple-500"/> 出生日期 (必填)
                            </label>
                            
                            {/* Calendar Type Toggle */}
                            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                                <button 
                                    onClick={() => setCalendarType('solar')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${calendarType === 'solar' ? 'bg-white dark:bg-[#333] shadow text-purple-600 dark:text-purple-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                    阳历
                                </button>
                                <button 
                                    onClick={() => setCalendarType('lunar')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${calendarType === 'lunar' ? 'bg-white dark:bg-[#333] shadow text-purple-600 dark:text-purple-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                    阴历
                                </button>
                            </div>
                        </div>

                        {/* Custom Date Selectors */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="relative">
                                <select 
                                    value={birthYear} 
                                    onChange={(e) => setBirthYear(parseInt(e.target.value))}
                                    className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-mono"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}年</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-xs">▼</div>
                            </div>
                            <div className="relative">
                                <select 
                                    value={birthMonth} 
                                    onChange={(e) => setBirthMonth(parseInt(e.target.value))}
                                    className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-mono"
                                >
                                    {months.map(m => <option key={m} value={m}>{m}月</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-xs">▼</div>
                            </div>
                            <div className="relative">
                                <select 
                                    value={birthDay} 
                                    onChange={(e) => setBirthDay(parseInt(e.target.value))}
                                    className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-mono"
                                >
                                    {days.map(d => <option key={d} value={d}>{d}日</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-xs">▼</div>
                            </div>
                        </div>
                    </div>

                    {/* Precision (Optional) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                               <Clock size={12}/> 出生时辰
                            </label>
                            <div className="relative">
                                <select 
                                    value={birthTime} 
                                    onChange={(e) => setBirthTime(e.target.value)}
                                    className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-3 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                                >
                                    {timeOptions.map(t => <option key={t.label} value={t.val}>{t.label}</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-xs">▼</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                               <Map size={12}/> 出生地点
                            </label>
                            <input 
                                type="text"
                                value={birthLocation}
                                onChange={(e) => setBirthLocation(e.target.value)}
                                placeholder="例如: 杭州"
                                className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-neutral-100 dark:bg-[#222] my-4"></div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        {error && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold text-center border border-red-100 dark:border-red-900/30">
                                {error}
                            </div>
                        )}

                        <button 
                            onClick={handleDivinate}
                            disabled={loading || hasCalculatedToday}
                            className={`w-full text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3
                                ${hasCalculatedToday 
                                    ? 'bg-neutral-400 cursor-default shadow-none' 
                                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20 hover:shadow-purple-600/40 hover:-translate-y-1 active:translate-y-0 active:shadow-none'
                                }
                            `}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : hasCalculatedToday ? <Lock size={18}/> : <Compass />}
                            {loading ? "大师排盘中..." : hasCalculatedToday ? "今日已算 (查看右侧)" : "开始测算"}
                            {!loading && !hasCalculatedToday && <span className="text-xs font-normal bg-black/20 px-2 py-0.5 rounded-md ml-1 opacity-80">-{COST} 蜂蜜</span>}
                        </button>
                        {hasCalculatedToday && (
                            <p className="text-center text-xs text-neutral-400 mt-2">天机不可泄露，一日只算一卦。</p>
                        )}
                    </div>
                </div>
             </div>
             
             {/* History Calendar */}
             <div className="bg-white dark:bg-[#111] rounded-3xl p-6 shadow-sm border border-neutral-100 dark:border-[#222]">
                 <h3 className="font-bold dark:text-white mb-4 flex items-center gap-2">
                     <Calendar size={18} className="text-brand-yellow"/> 运势记录
                 </h3>
                 {historyLoading ? (
                     <div className="flex justify-center py-8"><Loader2 className="animate-spin text-neutral-400"/></div>
                 ) : (
                     renderCalendar()
                 )}
             </div>

             {!user && (
                <p className="text-center text-xs text-neutral-400">
                  <span className="cursor-pointer hover:text-purple-500 underline" onClick={onLoginRequest}>登录</span> 后即可使用测算功能
                </p>
             )}
          </div>

          {/* Right Column: Result Display */}
          <div className="lg:col-span-7 flex flex-col h-full" ref={resultRef}>
             
             {/* Main Card Container */}
             <div className="bg-white dark:bg-[#111] rounded-3xl p-2 shadow-xl border border-neutral-100 dark:border-[#222] min-h-[500px] flex flex-col relative overflow-hidden">
                 
                 {/* Status Bar */}
                 <div className="absolute top-6 left-6 z-20 flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${loading ? 'bg-purple-500/80 text-white' : result ? 'bg-green-500/80 text-white' : 'bg-black/10 dark:bg-white/10 text-neutral-500 dark:text-neutral-300'}`}>
                       {loading ? '测算中...' : result ? '测算完成' : '等待测算'}
                    </div>
                 </div>

                 {/* Credit Badge */}
                 <div className="absolute bottom-6 right-6 z-20">
                    <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-lg border border-white/20 dark:text-white flex items-center gap-2">
                       🍯
                       剩余蜂蜜: <span className="text-brand-yellow">{userProfile?.credits || 0}</span>
                    </div>
                 </div>

                 {/* Content Area */}
                 <div className="bg-neutral-100 dark:bg-[#161616] flex-1 rounded-2xl relative flex items-center justify-center overflow-hidden">
                     {/* Background Pattern */}
                     <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
                          style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                     </div>

                     {!result && !loading && (
                         <div className="text-neutral-300 dark:text-neutral-700 font-bold text-2xl z-10 flex flex-col items-center">
                            <Compass size={64} className="mb-4 opacity-50"/>
                            <p>PREVIEW</p>
                            <p className="text-sm font-normal opacity-50 mt-2">请在左侧输入信息并开始</p>
                         </div>
                     )}

                     {loading && (
                        <div className="flex flex-col items-center gap-6 z-10">
                            <div className="relative">
                               <div className="w-24 h-24 rounded-full border-4 border-neutral-200 dark:border-[#333]"></div>
                               <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                  <Sparkles className="text-purple-500 animate-pulse" />
                               </div>
                            </div>
                            <p className="text-neutral-500 dark:text-neutral-400 font-bold animate-pulse text-sm">蜜蜂狗大师正在排盘...</p>
                        </div>
                     )}

                     {result && (
                         <div className="w-full h-full p-4 md:p-8 overflow-y-auto custom-scrollbar flex justify-center">
                             {/* THE MYSTICAL CARD */}
                             <div 
                                ref={cardRef}
                                className="relative bg-[#1A1025] rounded-[2rem] overflow-hidden w-full max-w-sm border border-white/5"
                                style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)' }}
                             >
                                {/* Decorative Header Pattern */}
                                <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-purple-900/60 to-transparent pointer-events-none"></div>
                                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 pointer-events-none" 
                                     style={{ background: 'radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, rgba(0,0,0,0) 70%)' }}>
                                </div>

                                <div className="relative z-10 p-6 flex flex-col h-full min-h-[500px]">
                                    
                                    {/* 1. Header: Fortune Level */}
                                    <div className="text-center mb-8 mt-4">
                                        <div className="text-purple-300 font-bold text-xs tracking-[0.3em] uppercase mb-2 opacity-80">今日运势</div>
                                        
                                        <h2 
                                          className="text-5xl font-black text-[#FCD34D] font-serif py-1" 
                                          style={{ textShadow: '0 4px 20px rgba(251, 191, 36, 0.4)' }}
                                        >
                                            {result.fortuneLevel}
                                        </h2>
                                        
                                        <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-purple-400 to-transparent mx-auto mt-4 opacity-50"></div>
                                    </div>

                                    {/* 2. Key Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-8">
                                        {[
                                            { icon: Palette, label: "幸运色", val: result.luckyColor },
                                            { icon: Hash, label: "幸运数", val: result.luckyNumber },
                                            { icon: MapPin, label: "财神位", val: result.luckyDirection }
                                        ].map((item, idx) => (
                                            <div key={idx} className="bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center border border-white/5">
                                                <item.icon size={16} className="text-purple-300 mb-2 opacity-80"/>
                                                <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                                                <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                                    {item.val}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 3. Scores Bars */}
                                    <div className="space-y-4 mb-8 px-1">
                                         {[
                                             { icon: TrendingUp, label: "财运指数", val: result.scores.wealth, color: "#facc15" }, // Yellow
                                             { icon: Heart, label: "桃花指数", val: result.scores.love, color: "#f472b6" }, // Pink
                                             { icon: Activity, label: "健康指数", val: result.scores.health, color: "#4ade80" } // Green
                                         ].map((stat, idx) => (
                                             <div key={idx}>
                                                 <div className="flex justify-between text-xs text-gray-300 mb-1.5 font-medium">
                                                     <div className="flex items-center gap-1.5">
                                                         <stat.icon size={12} style={{ color: stat.color }}/> 
                                                         {stat.label}
                                                     </div>
                                                     <span className="font-mono opacity-80">{stat.val}%</span>
                                                 </div>
                                                 <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                     <div 
                                                        className="h-full rounded-full transition-all duration-1000" 
                                                        style={{ width: `${stat.val}%`, backgroundColor: stat.color, boxShadow: `0 0 8px ${stat.color}40` }}
                                                     ></div>
                                                 </div>
                                             </div>
                                         ))}
                                    </div>

                                    {/* 4. Analysis */}
                                    <div className="relative mb-auto bg-black/20 rounded-2xl p-4 border border-white/5">
                                        <h4 className="text-[#FCD34D] font-bold mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                                            <Sparkles size={12} className="fill-current"/> 大师解读
                                        </h4>
                                        <p className="text-sm text-gray-300 leading-relaxed text-justify opacity-90 font-sans">
                                            {result.analysis}
                                        </p>
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-6 mt-4 flex justify-end items-center gap-2 text-[10px] text-gray-500 border-t border-white/5">
                                        <span>蜜蜂狗 AI 生成(beedog.fun)</span>
                                    </div>

                                </div>
                             </div>
                         </div>
                     )}
                 </div>
             </div>

          </div>

        </div>
      </div>
    </div>
  );
};


import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateGroupSelfie } from '../services/geminiService';
import { deductCredit } from '../services/userService';
import { Upload, Camera, Download, RefreshCw, Trash2, Plus, Image as ImageIcon, Sparkles, Zap, Users } from 'lucide-react';

interface GroupSelfieGeneratorProps {
  onLoginRequest: () => void;
}

const STYLE_PRESETS = [
  "统一为第一张图的风格 (Unify to Match First Image)",
  "保持各自原本画风 (Keep Original Styles)",
  "日系动漫风格 (Japanese Anime)",
  "皮克斯 3D 风格 (Pixar 3D)",
  "真实摄影风格 (Realistic Photo)",
  "美漫风格 (American Comic)"
];

const BACKGROUND_PRESETS = [
  "繁华街道 (Busy Street)",
  "阳光海滩 (Sunny Beach)",
  "赛博朋克城市 (Cyberpunk City)",
  "居家客厅 (Cozy Living Room)",
  "森林公园 (Forest Park)",
  "纯色背景 (Solid Color)"
];

interface CharacterSlot {
  id: string;
  image: string | null;
}

export const GroupSelfieGenerator: React.FC<GroupSelfieGeneratorProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  
  // State for characters (Max 5)
  const [characters, setCharacters] = useState<CharacterSlot[]>([
    { id: '1', image: null },
    { id: '2', image: null }
  ]);
  
  const [style, setStyle] = useState(STYLE_PRESETS[0]);
  const [customStyle, setCustomStyle] = useState("");
  const [background, setBackground] = useState(BACKGROUND_PRESETS[0]);
  const [customBackground, setCustomBackground] = useState("");

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const COST = 30;

  const handleSlotClick = (id: string) => {
    setActiveSlotId(id);
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeSlotId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacters(prev => prev.map(c => 
          c.id === activeSlotId ? { ...c, image: reader.result as string } : c
        ));
        setActiveSlotId(null);
        // Clear input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const addSlot = () => {
    if (characters.length < 5) {
      setCharacters(prev => [...prev, { id: String(Date.now()), image: null }]);
    }
  };

  const removeSlot = (id: string) => {
    if (characters.length > 1) {
      setCharacters(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleGenerate = async () => {
    if (!user || !userProfile) {
      onLoginRequest();
      return;
    }

    const filledSlots = characters.filter(c => c.image !== null);
    if (filledSlots.length === 0) {
      setError("请至少上传一张角色图片");
      return;
    }

    setLoading(true);
    setError('');
    
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const allowed = await deductCredit(user.uid, COST);
      if (!allowed) {
        setError(`蜂蜜不足！需要 ${COST} 罐蜂蜜。请在个人中心每日签到获取更多。`);
        setLoading(false);
        return;
      }
      await refreshProfile();

      const finalStyle = customStyle || style;
      const finalBg = customBackground || background;
      
      const images = filledSlots.map(c => c.image!);

      const result = await generateGroupSelfie(
        images,
        finalStyle,
        finalBg
      );

      setGeneratedImage(result);

    } catch (err: any) {
      console.error("Selfie Generation Failed:", err);
      // Refund Logic
      if (user) {
          await deductCredit(user.uid, -COST);
          await refreshProfile();
          setError("生成失败 (网络错误)，蜂蜜已退还。请重试。");
      } else {
          setError("生成失败，请检查网络。");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `beedog-selfie-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="py-24 bg-white rounded-2xl dark:bg-[#0A0A0A] border-t border-neutral-100 dark:border-[#222]">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-bold uppercase tracking-wider mb-4 border border-pink-100 dark:border-pink-800">
            <Users size={14} /> 多人联动神器
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 dark:text-white">
             BeeDog <span className="text-pink-500">一键合影</span>
          </h2>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
            上传多个 Meme 或角色 (最多5个)，AI 自动生成高角度自拍合影。
            <br className="hidden md:block" />
            支持统一画风或混搭，让不同次元的角色同框！
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Config */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#111] rounded-3xl p-6 md:p-8 shadow-xl border border-neutral-100 dark:border-[#222]">
              
              {/* 1. Character Uploads */}
              <div className="mb-8">
                 <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                      1. 上传角色 ({characters.filter(c => c.image).length}/{characters.length})
                    </label>
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                 </div>
                 
                 <div className="grid grid-cols-3 gap-3">
                    {characters.map((char, idx) => (
                      <div key={char.id} className="relative group">
                         <div 
                           onClick={() => handleSlotClick(char.id)}
                           className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${
                             char.image 
                               ? 'border-pink-500 bg-[#161616]' 
                               : 'border-neutral-200 dark:border-[#333] bg-neutral-50 dark:bg-[#161616] hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-[#222]'
                           }`}
                         >
                           {char.image ? (
                             <img src={char.image} className="w-full h-full object-cover" />
                           ) : (
                             <>
                               <Plus className="text-neutral-400 mb-1" />
                               <span className="text-[10px] text-neutral-400 font-bold">角色 {idx + 1}</span>
                             </>
                           )}
                         </div>
                         
                         {/* Remove Button */}
                         {characters.length > 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeSlot(char.id); }}
                              className="absolute -top-2 -right-2 bg-white dark:bg-[#333] text-neutral-500 hover:text-red-500 rounded-full p-1 shadow-md border border-neutral-100 dark:border-[#444] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                         )}
                      </div>
                    ))}
                    
                    {/* Add Slot Button */}
                    {characters.length < 5 && (
                      <button 
                        onClick={addSlot}
                        className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 dark:border-[#333] bg-transparent hover:border-pink-400 hover:text-pink-500 text-neutral-400 flex flex-col items-center justify-center transition-all"
                      >
                         <Plus size={24} />
                         <span className="text-[10px] font-bold mt-1">增加位</span>
                      </button>
                    )}
                 </div>
              </div>

              {/* 2. Style */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
                  2. 整体画风
                </label>
                <div className="space-y-2 mb-3">
                  {STYLE_PRESETS.map(s => (
                    <label key={s} className="flex items-center gap-2 p-3 rounded-xl border border-neutral-100 dark:border-[#333] bg-neutral-50 dark:bg-[#161616] cursor-pointer hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-colors">
                       <input 
                         type="radio" 
                         name="style" 
                         value={s} 
                         checked={style === s && !customStyle} 
                         onChange={() => { setStyle(s); setCustomStyle(""); }}
                         className="text-pink-500 focus:ring-pink-500"
                       />
                       <span className="text-xs font-bold dark:text-neutral-300">{s}</span>
                    </label>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                  placeholder="自定义画风 (例如: 梵高油画风格)"
                  className={`w-full bg-neutral-50 dark:bg-[#222] border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-white ${customStyle ? 'border-pink-500 ring-1 ring-pink-500' : 'border-neutral-200 dark:border-[#333]'}`}
                />
              </div>

              {/* 3. Background */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
                  3. 拍照场景
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                   {BACKGROUND_PRESETS.map(bg => (
                      <button 
                        key={bg}
                        onClick={() => { setBackground(bg); setCustomBackground(""); }}
                        className={`text-xs p-2 rounded-lg font-bold border transition-all ${
                           background === bg && !customBackground
                           ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-500 text-pink-700 dark:text-pink-300'
                           : 'bg-neutral-50 dark:bg-[#222] border-transparent dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#333]'
                        }`}
                      >
                        {bg}
                      </button>
                   ))}
                </div>
                <input 
                  type="text" 
                  value={customBackground}
                  onChange={(e) => setCustomBackground(e.target.value)}
                  placeholder="自定义场景 (例如: 宇宙飞船驾驶舱)"
                  className={`w-full bg-neutral-50 dark:bg-[#222] border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-white ${customBackground ? 'border-pink-500 ring-1 ring-pink-500' : 'border-neutral-200 dark:border-[#333]'}`}
                />
              </div>

            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-7 flex flex-col h-full" ref={resultRef}>
            
            {/* Preview Window */}
            <div className="bg-white dark:bg-[#111] rounded-3xl p-2 shadow-xl border border-neutral-100 dark:border-[#222] flex-1 flex flex-col min-h-[500px] relative overflow-hidden">
                {/* Status Bar */}
                <div className="absolute top-6 left-6 z-20 flex gap-2">
                   <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${loading ? 'bg-pink-500/80 text-white' : generatedImage ? 'bg-green-500/80 text-white' : 'bg-black/10 dark:bg-white/10 text-neutral-500 dark:text-neutral-300'}`}>
                      {loading ? 'AI 合成中...' : generatedImage ? '合影完成' : '等待生成'}
                   </div>
                </div>
                
                {/* Main Canvas */}
                <div className="bg-neutral-100 dark:bg-[#161616] flex-1 rounded-2xl relative flex items-center justify-center overflow-hidden group">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
                         style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                    </div>

                    {loading ? (
                      <div className="flex flex-col items-center gap-6 z-10">
                        <div className="relative">
                           <div className="w-24 h-24 rounded-full border-4 border-neutral-200 dark:border-[#333]"></div>
                           <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles className="text-pink-500 animate-pulse" />
                           </div>
                        </div>
                        <p className="text-neutral-500 dark:text-neutral-400 font-bold animate-pulse text-sm">正在调整最佳自拍角度...</p>
                      </div>
                    ) : generatedImage ? (
                      <img src={generatedImage} alt="Generated Selfie" className="max-w-full max-h-full object-contain shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.02]" />
                    ) : (
                      <div className="text-neutral-300 dark:text-neutral-700 font-bold text-2xl z-10 flex flex-col items-center">
                        <Camera size={64} className="mb-4 opacity-50"/>
                        <p>PREVIEW</p>
                        <p className="text-sm font-normal opacity-50 mt-2">请上传角色并点击生成</p>
                      </div>
                    )}
                </div>

                {/* Credit Badge */}
                <div className="absolute bottom-6 right-6 z-20">
                   <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-lg border border-white/20 dark:text-white flex items-center gap-2">
                      🍯
                      剩余蜂蜜: <span className="text-brand-yellow">{userProfile?.credits || 0}</span>
                   </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold text-center border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2">
                ⚠️ {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col md:flex-row gap-4">
               {!generatedImage ? (
                 <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex-1 bg-pink-500 hover:bg-pink-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                 >
                   {loading ? <RefreshCw className="animate-spin" /> : <Camera />}
                   生成合影 <span className="text-xs font-normal opacity-70 ml-1">(-{COST} 蜂蜜)</span>
                 </button>
               ) : (
                 <>
                   <button 
                    onClick={downloadImage}
                    className="flex-1 bg-white dark:bg-[#222] hover:bg-neutral-50 dark:hover:bg-[#333] text-black dark:text-white font-bold text-lg py-4 rounded-2xl border border-neutral-200 dark:border-[#333] shadow-sm hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                   >
                     <Download size={20} /> 下载图片
                   </button>
                   <button 
                    onClick={() => setGeneratedImage(null)}
                    className="flex-1 bg-black text-white dark:bg-white dark:text-black font-bold text-lg py-4 rounded-2xl shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                   >
                     <RefreshCw size={20} /> 重置
                   </button>
                 </>
               )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

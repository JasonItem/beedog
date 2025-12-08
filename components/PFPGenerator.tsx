import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { generatePfpVariation } from '../services/geminiService';
import { deductCredit } from '../services/userService';
import { Upload, Download, RefreshCw, Wand2, Layers, VenetianMask, Image as ImageIcon, Trash2, Sparkles, Zap } from 'lucide-react';

interface PFPGeneratorProps {
  onLoginRequest: () => void;
}

const PRESETS = {
  theme: ["火影忍者", "海贼王", "漫威宇宙", "哈利波特", "星球大战", "原神"],
  background: ["保持原背景", "纯色摄影棚", "赛博朋克城", "像素森林", "8-Bit 太空", "阳光沙滩", "动漫教室"],
  head: ["无", "棒球帽", "针织帽", "黄金皇冠", "天使光环", "猫耳", "电竞耳机"],
  eyes: ["默认", "酷黑墨镜", "近视眼镜", "海盗眼罩", "镭射眼", "大哭", "眨眼"],
  outfit: ["休闲T恤", "商务西装", "街头卫衣", "日式和服", "骑士盔甲", "宇航服", "侦探风衣"],
  item: ["无", "勇者之剑", "魔法棒", "电吉他", "咖啡杯", "智能手机", "鲜花束"]
};

export const PFPGenerator: React.FC<PFPGeneratorProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [mode, setMode] = useState<'character' | 'parts'>('character');
  
  // Custom Inputs State
  const [theme, setTheme] = useState("");
  const [role, setRole] = useState("");
  const [details, setDetails] = useState("");
  const [background, setBackground] = useState("保持原背景");

  // Parts Mode Inputs
  const [head, setHead] = useState("无");
  const [eyes, setEyes] = useState("默认");
  const [outfit, setOutfit] = useState("休闲T恤");
  const [item, setItem] = useState("无");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isRef = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isRef) setRefImage(reader.result as string);
        else setBaseImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!user || !userProfile) {
      onLoginRequest();
      return;
    }

    if (!baseImage) {
      setError("请先上传底图");
      return;
    }

    setLoading(true);
    setError('');
    
    // Scroll to result on mobile
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const allowed = await deductCredit(user.uid);
      if (!allowed) {
        setError("蜂蜜额度不足！请在个人中心每日签到获取更多额度。");
        setLoading(false);
        return;
      }
      await refreshProfile();

      let prompt = "";
      
      if (mode === 'character') {
        const themePart = theme ? `from the "${theme}" universe` : "";
        const rolePart = role ? `dressed as ${role}` : "dressed in a unique costume";
        prompt = `Transform the character to look like they are ${rolePart} ${themePart}.`;
        if (details) prompt += ` Specific details: ${details}.`;
      } else {
        const parts = [];
        if (head && head !== "无") parts.push(`wearing a ${head}`);
        if (eyes && eyes !== "默认" && eyes !== "无") parts.push(`with ${eyes}`);
        if (outfit && outfit !== "无") parts.push(`wearing ${outfit}`);
        if (item && item !== "无") parts.push(`holding a ${item}`);
        
        if (parts.length > 0) {
           prompt = `Dress the character with the following items: ${parts.join(", ")}.`;
        } else {
           prompt = "Keep the character's original appearance but improve quality.";
        }
      }

      if (background && background !== "保持原背景") {
        prompt += ` Change the background to a ${background} style, ensuring it matches the character's lighting.`;
      } else {
        prompt += ` Keep the original background exactly as it is.`;
      }

      const result = await generatePfpVariation(
        baseImage,
        prompt,
        refImage
      );

      setGeneratedImage(result);

    } catch (err: any) {
      setError("生成失败，请重试或检查网络");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `beedog-pfp-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const PresetChips = ({ options, current, onSelect }: { options: string[], current: string, onSelect: (val: string) => void }) => (
    <div className="flex flex-wrap gap-2 mb-3">
      {options.map(opt => (
        <button 
          key={opt}
          onClick={() => onSelect(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
            current === opt 
              ? 'bg-brand-yellow text-black border-brand-yellow shadow-md transform scale-105' 
              : 'bg-white dark:bg-[#262626] text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-[#444] hover:border-brand-yellow hover:text-brand-yellow'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div id="pfp-generator" className="py-24 bg-white dark:bg-[#0A0A0A] border-t border-neutral-100 dark:border-[#222]">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100 dark:border-blue-800">
            <Sparkles size={14} /> AI 创意工坊
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 dark:text-white">
             BeeDog <span className="text-brand-yellow">PFP 生成器</span>
          </h2>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
            上传你的照片，一键 Cosplay 或自由穿搭。保持原图构图，只换造型。
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex justify-center mb-10">
          <div className="bg-neutral-100 dark:bg-[#161616] p-1.5 rounded-2xl inline-flex shadow-inner border border-neutral-200 dark:border-[#333]">
            <button 
              onClick={() => setMode('character')}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${
                mode === 'character' 
                  ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-md transform scale-105' 
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
              }`}
            >
              <VenetianMask size={18} /> 角色扮演
            </button>
            <button 
              onClick={() => setMode('parts')}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${
                mode === 'parts' 
                  ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-md transform scale-105' 
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
              }`}
            >
              <Layers size={18} /> 自由搭配
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#111] rounded-3xl p-6 md:p-8 shadow-xl shadow-neutral-100/50 dark:shadow-none border border-neutral-100 dark:border-[#222]">
              
              {/* CHARACTER MODE UI */}
              {mode === 'character' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  {/* 1. Theme */}
                  <div>
                    <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex justify-between">
                      <span>1. 选择主题</span>
                      <span className="text-neutral-400 font-normal text-xs">Theme</span>
                    </label>
                    <PresetChips options={PRESETS.theme} current={theme} onSelect={setTheme} />
                    <input 
                      type="text" 
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="或输入自定义主题..."
                      className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow transition-all dark:text-white"
                    />
                  </div>

                  {/* 2. Role */}
                  <div>
                    <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex justify-between">
                      <span>2. 扮演角色</span>
                      <span className="text-neutral-400 font-normal text-xs">Role</span>
                    </label>
                    <input 
                      type="text" 
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="输入角色名字 (如: 钢铁侠)"
                      className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-yellow transition-all dark:text-white"
                    />
                  </div>

                  {/* 3. Details */}
                  <div>
                    <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex justify-between">
                      <span>3. 细节描述</span>
                      <span className="text-neutral-400 font-normal text-xs">Details</span>
                    </label>
                    <textarea 
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="红色盔甲，手里拿着香蕉..."
                      rows={3}
                      className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow transition-all resize-none dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* PARTS MODE UI */}
              {mode === 'parts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Head */}
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">头部 Head</label>
                    <PresetChips options={PRESETS.head} current={head} onSelect={setHead} />
                    <input type="text" value={head} onChange={e => setHead(e.target.value)} placeholder="自定义头部..." className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white" />
                  </div>

                  {/* Eyes */}
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">眼部 Eyes</label>
                    <PresetChips options={PRESETS.eyes} current={eyes} onSelect={setEyes} />
                    <input type="text" value={eyes} onChange={e => setEyes(e.target.value)} placeholder="自定义眼部..." className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white" />
                  </div>

                  {/* Outfit */}
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">服饰 Outfit</label>
                    <PresetChips options={PRESETS.outfit} current={outfit} onSelect={setOutfit} />
                    <input type="text" value={outfit} onChange={e => setOutfit(e.target.value)} placeholder="自定义服饰..." className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white" />
                  </div>

                  {/* Item */}
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">道具 Item</label>
                    <PresetChips options={PRESETS.item} current={item} onSelect={setItem} />
                    <input type="text" value={item} onChange={e => setItem(e.target.value)} placeholder="自定义道具..." className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow dark:text-white" />
                  </div>
                </div>
              )}

              <div className="h-px bg-neutral-100 dark:bg-[#222] my-8"></div>

              {/* Reference Image */}
              <div>
                <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
                  参考图 (可选) <span className="text-neutral-400 font-normal">Reference</span>
                </label>
                <div 
                  onClick={() => refFileInputRef.current?.click()}
                  className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all relative ${
                    refImage 
                      ? 'border-brand-yellow bg-yellow-50 dark:bg-yellow-900/10' 
                      : 'border-neutral-200 dark:border-[#333] bg-neutral-50 dark:bg-[#222] hover:border-brand-yellow hover:bg-white dark:hover:bg-[#2a2a2a]'
                  }`}
                >
                  {refImage ? (
                    <>
                      <img src={refImage} className="h-full w-full object-contain p-2 rounded-xl" alt="Ref" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRefImage(null); }}
                        className="absolute top-2 right-2 bg-white text-red-500 p-1 rounded-full shadow-sm hover:bg-red-50 border border-neutral-200"
                      >
                        <Trash2 size={12}/>
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-neutral-400 text-xs">
                      <ImageIcon className="mx-auto mb-1 opacity-50" size={20} />
                      点击上传服装/风格参考图
                    </div>
                  )}
                  <input ref={refFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, true)} />
                </div>
              </div>

              {/* Background */}
              <div className="mt-6">
                <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
                  背景风格 <span className="text-neutral-400 font-normal">Background</span>
                </label>
                <PresetChips options={PRESETS.background} current={background} onSelect={setBackground} />
                <input 
                  type="text" 
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  placeholder="自定义背景描述..."
                  className="w-full bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow transition-all dark:text-white"
                />
              </div>

            </div>
          </div>

          {/* Right Column: Preview & Action */}
          <div className="lg:col-span-7 flex flex-col h-full" ref={resultRef}>
            
            {/* Upload Area */}
            <div className="mb-6 bg-white dark:bg-[#111] rounded-3xl p-6 shadow-sm border border-neutral-100 dark:border-[#222]">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-yellow text-black flex items-center justify-center text-xs font-bold">1</span>
                    <span className="font-bold text-sm dark:text-white">上传底图 (必需)</span>
                 </div>
                 {baseImage && (
                    <button onClick={() => setBaseImage(null)} className="text-red-500 text-xs flex items-center hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                       <Trash2 size={12} className="mr-1"/>清除
                    </button>
                 )}
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`h-48 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all duration-300 ${
                    baseImage ? 'border-brand-yellow bg-[#111]' : 'border-neutral-200 dark:border-[#333] bg-neutral-50 dark:bg-[#161616] hover:border-brand-yellow hover:bg-yellow-50 dark:hover:bg-[#222]'
                }`}
              >
                {baseImage ? (
                  <img src={baseImage} className="h-full object-contain" alt="Base" />
                ) : (
                  <div className="text-center text-neutral-400 group-hover:text-brand-yellow transition-colors">
                    <Upload className="mx-auto mb-3" size={32} />
                    <span className="font-bold text-sm">点击或拖拽上传图片</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e)} />
              </div>
            </div>

            {/* Preview Window */}
            <div className="bg-white dark:bg-[#111] rounded-3xl p-2 shadow-xl border border-neutral-100 dark:border-[#222] flex-1 flex flex-col min-h-[500px] relative overflow-hidden">
                {/* Status Bar */}
                <div className="absolute top-6 left-6 z-20 flex gap-2">
                   <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${loading ? 'bg-yellow-500/80 text-white' : generatedImage ? 'bg-green-500/80 text-white' : 'bg-black/10 dark:bg-white/10 text-neutral-500 dark:text-neutral-300'}`}>
                      {loading ? '生成中...' : generatedImage ? '生成完毕' : '等待指令'}
                   </div>
                </div>
                
                {/* Main Canvas */}
                <div className="bg-neutral-100 dark:bg-[#161616] flex-1 rounded-2xl relative flex items-center justify-center overflow-hidden group">
                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
                         style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                    </div>

                    {loading ? (
                      <div className="flex flex-col items-center gap-6 z-10">
                        <div className="relative">
                           <div className="w-24 h-24 rounded-full border-4 border-neutral-200 dark:border-[#333]"></div>
                           <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-brand-yellow border-t-transparent animate-spin"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles className="text-brand-yellow animate-pulse" />
                           </div>
                        </div>
                        <p className="text-neutral-500 dark:text-neutral-400 font-bold animate-pulse text-sm">AI 正在施展魔法...</p>
                      </div>
                    ) : generatedImage ? (
                      <img src={generatedImage} alt="Generated PFP" className="max-w-full max-h-full object-contain shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.02]" />
                    ) : baseImage ? (
                      <div className="relative z-10 opacity-40 grayscale transition-all duration-500 group-hover:opacity-60 group-hover:grayscale-0">
                        <img src={baseImage} alt="Base Preview" className="max-w-full max-h-[400px] object-contain blur-[2px] group-hover:blur-0" />
                      </div>
                    ) : (
                      <div className="text-neutral-300 dark:text-neutral-700 font-bold text-2xl z-10 flex flex-col items-center">
                        <ImageIcon size={48} className="mb-2 opacity-50"/>
                        PREVIEW
                      </div>
                    )}
                </div>

                {/* Credit Badge */}
                <div className="absolute bottom-6 right-6 z-20">
                   <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-lg border border-white/20 dark:text-white flex items-center gap-2">
                      <Zap size={12} className="text-brand-yellow fill-brand-yellow"/>
                      可用额度: <span className="text-brand-yellow">{userProfile?.credits || 0}</span>
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
                  className="flex-1 bg-brand-yellow hover:bg-yellow-300 text-black font-black text-lg py-4 rounded-2xl shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                 >
                   {loading ? <RefreshCw className="animate-spin" /> : <Wand2 />}
                   立即生成 <span className="text-xs font-normal opacity-70 ml-1">(-1 额度)</span>
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

            {!user && (
              <p className="text-center mt-4 text-xs text-neutral-400">
                <span className="cursor-pointer hover:text-brand-yellow underline" onClick={onLoginRequest}>登录</span> 后即可使用生成功能
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
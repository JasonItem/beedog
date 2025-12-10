
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateSingleSticker } from '../services/geminiService';
import { deductCredit } from '../services/userService';
import { zipStickers } from '../services/stickerUtils';
import { Upload, Sparkles, Trash2, Package, Plus, X, Palette, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface MemeGeneratorProps {
  onLoginRequest: () => void;
}

const DEFAULT_LABELS = [
  "开心 / 点赞", 
  "暴怒 / 破防", 
  "大哭 / 亏钱", 
  "暴富 / 镭射眼", 
  "震惊 / 懵逼", 
  "喜爱 / 色色"
];

const STYLES = [
  "保持原图风格",
  "Q版 / 粘土风 (Cute 3D)",
  "日漫线条 (Anime Line)",
  "复古像素 (8-bit)",
  "美漫夸张 (Western Cartoon)",
  "极简矢量 (Flat Vector)"
];

interface StickerResult {
  label: string;
  status: 'waiting' | 'loading' | 'success' | 'error';
  url?: string;
  errorMsg?: string;
}

export const MemeGenerator: React.FC<MemeGeneratorProps> = ({ onLoginRequest }) => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [baseImage, setBaseImage] = useState<string | null>(null);
  
  // Results State
  const [results, setResults] = useState<StickerResult[]>([]);
  
  // Config State
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [newLabel, setNewLabel] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [customStyle, setCustomStyle] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const COST = 6;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBaseImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    if (labels.length >= 9) {
      setError("最多支持 9 个表情标签");
      setTimeout(() => setError(''), 3000);
      return;
    }
    setLabels([...labels, newLabel.trim()]);
    setNewLabel("");
  };

  const handleRemoveLabel = (index: number) => {
    const updated = labels.filter((_, i) => i !== index);
    setLabels(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddLabel();
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

    if (labels.length === 0) {
      setError("请至少添加 1 个表情标签");
      return;
    }

    setIsGenerating(true);
    setError('');
    
    // Initialize results state placeholders
    const initialResults: StickerResult[] = labels.map(label => ({
      label,
      status: 'waiting'
    }));
    setResults(initialResults);
    
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    let successCount = 0;

    try {
      // Deduct credit once for the batch
      const allowed = await deductCredit(user.uid, COST);
      if (!allowed) {
        setError(`蜂蜜不足！需要 ${COST} 罐蜂蜜。请在个人中心每日签到获取更多。`);
        setIsGenerating(false);
        setResults([]);
        return;
      }
      await refreshProfile();

      const stylePrompt = customStyle || (selectedStyle === "保持原图风格" ? "Original Style" : selectedStyle);

      // Sequential Generation Loop
      for (let i = 0; i < initialResults.length; i++) {
        // Update current item to loading
        setResults(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'loading' };
          return next;
        });

        try {
          const stickerUrl = await generateSingleSticker(baseImage, labels[i], stylePrompt);
          
          // Update current item to success
          setResults(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'success', url: stickerUrl };
            return next;
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to generate ${labels[i]}:`, err);
          // Update current item to error
          setResults(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'error', errorMsg: "生成失败" };
            return next;
          });
        }
      }

      // Check for total failure (e.g., Network Error affecting all requests)
      if (successCount === 0 && initialResults.length > 0) {
          // Refund full amount if EVERYTHING failed
          await deductCredit(user.uid, -COST);
          await refreshProfile();
          setError("生成全部失败 (可能是网络错误)，蜂蜜已全额退还。");
      }

    } catch (err: any) {
      setError("任务初始化失败，请重试");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    const successfulStickers = results
      .filter(r => r.status === 'success' && r.url)
      .map(r => ({ label: r.label, data: r.url! }));

    if (successfulStickers.length === 0) return;

    try {
      const zipBlob = await zipStickers(successfulStickers);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `beedog_stickers_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError("打包下载失败");
    }
  };

  const hasResults = results.length > 0;
  const successCount = results.filter(r => r.status === 'success').length;

  return (
    <div id="meme-generator" className="py-24 bg-white rounded-2xl dark:bg-[#0A0A0A] border-t border-neutral-100 dark:border-[#222]">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-100 dark:border-purple-800">
            <Sparkles size={14} /> 表情包神器
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 dark:text-white">
             BeeDog <span className="text-purple-500">Meme 制造机</span>
          </h2>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
            上传形象，AI 逐个生成全套表情包，一键打包下载，<span className="text-brand-yellow font-bold">无需切割</span>。
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Upload & Config */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-[#111] rounded-3xl p-6 shadow-xl border border-neutral-100 dark:border-[#222]">
              
              {/* 1. Upload */}
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                    <span className="font-bold text-sm dark:text-white">上传角色底图</span>
                 </div>
                 {baseImage && (
                    <button onClick={() => setBaseImage(null)} className="text-red-500 text-xs flex items-center hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                       <Trash2 size={12} className="mr-1"/>清除
                    </button>
                 )}
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`h-40 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all duration-300 ${
                    baseImage ? 'border-purple-500 bg-[#111]' : 'border-neutral-200 dark:border-[#333] bg-neutral-50 dark:bg-[#161616] hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-[#222]'
                }`}
              >
                {baseImage ? (
                  <img src={baseImage} className="h-full object-contain" alt="Base" />
                ) : (
                  <div className="text-center text-neutral-400 group-hover:text-purple-500 transition-colors">
                    <Upload className="mx-auto mb-3" size={32} />
                    <span className="font-bold text-sm">点击上传角色图片</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              
              <div className="h-px bg-neutral-100 dark:bg-[#222] my-6"></div>

              {/* 2. Style Selector */}
              <div className="mb-6">
                 <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                    <span className="font-bold text-sm dark:text-white">选择风格</span>
                    <Palette size={14} className="text-neutral-400"/>
                 </div>
                 <div className="grid grid-cols-2 gap-2 mb-3">
                    {STYLES.map(style => (
                       <button 
                         key={style}
                         onClick={() => { setSelectedStyle(style); setCustomStyle(""); }}
                         className={`text-xs p-2 rounded-lg font-bold border transition-all ${
                            selectedStyle === style && !customStyle
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-neutral-50 dark:bg-[#222] border-transparent dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#333]'
                         }`}
                       >
                         {style}
                       </button>
                    ))}
                 </div>
                 <input 
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="或输入自定义风格 (如: 赛博朋克)"
                    className={`w-full bg-neutral-50 dark:bg-[#222] border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white ${customStyle ? 'border-purple-500 ring-1 ring-purple-500' : 'border-neutral-200 dark:border-[#333]'}`}
                 />
              </div>

              <div className="h-px bg-neutral-100 dark:bg-[#222] my-6"></div>

              {/* 3. Label Editor */}
              <div>
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                        <span className="font-bold text-sm dark:text-white">定义表情 ({labels.length})</span>
                    </div>
                 </div>
                 
                 {/* Tag List */}
                 <div className="flex flex-wrap gap-2 mb-4 min-h-[80px] content-start bg-neutral-50 dark:bg-[#161616] p-3 rounded-xl border border-neutral-100 dark:border-[#333]">
                    {labels.map((label, idx) => (
                      <div key={idx} className="bg-white dark:bg-[#222] border border-neutral-200 dark:border-[#444] pl-3 pr-1 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm animate-in fade-in zoom-in duration-200">
                         <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
                         <button onClick={() => handleRemoveLabel(idx)} className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-neutral-400 transition-colors">
                           <X size={12}/>
                         </button>
                      </div>
                    ))}
                    {labels.length === 0 && (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs italic">
                        添加表情标签，例如 "大笑"
                      </div>
                    )}
                 </div>

                 {/* Input */}
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={labels.length >= 9 ? "已达上限" : "添加新表情 (回车)"}
                      disabled={labels.length >= 9}
                      className="flex-1 bg-neutral-50 dark:bg-[#222] border border-neutral-200 dark:border-[#333] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white disabled:opacity-50"
                    />
                    <button 
                      onClick={handleAddLabel}
                      disabled={!newLabel.trim() || labels.length >= 9}
                      className="bg-purple-500 text-white p-2 rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                 </div>
                 <p className="text-[10px] text-neutral-400 mt-2 ml-1">
                    提示: 表情将逐一生成，数量越多耗时越长。
                 </p>
              </div>

              {/* Generate Button */}
              <div className="mt-6">
                {error && (
                   <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                     <AlertCircle size={14} /> {error}
                   </div>
                )}

                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-purple-500 hover:bg-purple-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {isGenerating ? '正在逐个生成...' : '开始制作'} 
                  {!isGenerating && <span className="text-xs font-normal opacity-70 ml-1">(-{COST} 蜂蜜)</span>}
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: Result Grid */}
          <div className="lg:col-span-8 flex flex-col h-full" ref={resultRef}>
            
            <div className="bg-neutral-50 dark:bg-[#111] rounded-3xl p-6 shadow-inner border border-neutral-200 dark:border-[#222] min-h-[600px] flex flex-col">
                
                {/* Header / Status */}
                <div className="flex justify-between items-center mb-6">
                   <h3 className="font-black text-xl dark:text-white flex items-center gap-2">
                      <Package className="text-purple-500" /> 
                      生成结果 
                      {hasResults && <span className="text-sm font-normal text-neutral-500 ml-2">({successCount}/{labels.length})</span>}
                   </h3>
                   {/* Credit Badge */}
                   <div className="bg-white dark:bg-black px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border border-neutral-200 dark:border-[#333] dark:text-white flex items-center gap-2">
                      <Zap size={12} className="text-brand-yellow fill-brand-yellow"/>
                      剩余蜂蜜: <span className="text-brand-yellow">{userProfile?.credits || 0}</span>
                   </div>
                </div>

                {/* Main Grid Content */}
                <div className="flex-1">
                  {!hasResults ? (
                     <div className="h-full flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-700 pointer-events-none">
                        <Sparkles size={64} className="mb-4 opacity-50"/>
                        <p className="text-xl font-bold">等待开始</p>
                        <p className="text-sm opacity-70">点击左侧“开始制作”按钮</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {results.map((item, idx) => (
                           <div key={idx} className="aspect-square bg-white dark:bg-[#161616] rounded-2xl border border-neutral-200 dark:border-[#333] shadow-sm flex flex-col overflow-hidden relative group">
                              
                              {/* Content */}
                              <div className="flex-1 relative flex items-center justify-center p-2">
                                 {/* Background Checkerboard for Transparency */}
                                 <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>

                                 {item.status === 'success' && item.url ? (
                                    <img src={item.url} alt={item.label} className="max-w-full max-h-full object-contain animate-in fade-in zoom-in duration-300" />
                                 ) : item.status === 'loading' ? (
                                    <div className="flex flex-col items-center gap-2">
                                       <Loader2 className="animate-spin text-purple-500" size={32} />
                                       <span className="text-xs text-purple-500 font-bold">绘制中...</span>
                                    </div>
                                 ) : item.status === 'error' ? (
                                    <div className="flex flex-col items-center gap-2 text-red-400">
                                       <AlertCircle size={32} />
                                       <span className="text-xs font-bold">失败</span>
                                    </div>
                                 ) : (
                                    <div className="flex flex-col items-center gap-2 text-neutral-300 dark:text-neutral-700">
                                       <div className="w-8 h-8 rounded-full border-2 border-current border-dashed"></div>
                                       <span className="text-xs font-bold">等待中</span>
                                    </div>
                                 )}
                              </div>

                              {/* Footer Label */}
                              <div className="bg-neutral-50 dark:bg-[#222] border-t border-neutral-100 dark:border-[#333] py-2 px-3 flex justify-between items-center">
                                 <span className="text-xs font-bold truncate flex-1 dark:text-white" title={item.label}>{item.label}</span>
                                 {item.status === 'success' && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
                </div>

                {/* Action Bar */}
                {hasResults && (
                   <div className="mt-6 flex gap-4 pt-4 border-t border-neutral-200 dark:border-[#333]">
                      <button 
                         onClick={handleDownloadZip}
                         disabled={isGenerating || successCount === 0}
                         className="flex-1 bg-brand-yellow hover:bg-yellow-300 text-black font-bold py-3 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                         <Package size={20} />
                         打包下载 (ZIP)
                      </button>
                      
                      <button 
                         onClick={() => { setResults([]); setIsGenerating(false); }}
                         disabled={isGenerating}
                         className="px-6 bg-white dark:bg-[#222] text-black dark:text-white font-bold py-3 rounded-xl border border-neutral-200 dark:border-[#333] hover:bg-neutral-50 transition-all disabled:opacity-50"
                      >
                         重置
                      </button>
                   </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

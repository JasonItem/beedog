
import React, { useState } from 'react';
import { PFPGenerator } from './PFPGenerator';
import { MemeGenerator } from './MemeGenerator';
import { GroupSelfieGenerator } from './GroupSelfieGenerator';
import { ArrowLeft, Sparkles, Image as ImageIcon, SmilePlus, Users, ArrowRight } from 'lucide-react';

interface AIToolboxProps {
  onLoginRequest: () => void;
}

type ToolId = 'pfp' | 'meme' | 'selfie' | null;

export const AIToolbox: React.FC<AIToolboxProps> = ({ onLoginRequest }) => {
  const [activeTool, setActiveTool] = useState<ToolId>(null);

  const renderBackHeader = () => (
    <div className="container mx-auto px-4 mb-8">
      <button 
        onClick={() => setActiveTool(null)}
        className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-yellow transition-colors font-bold group px-4 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        返回工具箱
      </button>
    </div>
  );

  if (activeTool === 'pfp') {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-white dark:bg-[#050505]">
        {renderBackHeader()}
        <div className="container mx-auto px-4 animate-in fade-in slide-in-from-bottom-4">
           <PFPGenerator onLoginRequest={onLoginRequest} />
        </div>
      </div>
    );
  }

  if (activeTool === 'meme') {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-white dark:bg-[#050505]">
        {renderBackHeader()}
        <div className="container mx-auto px-4 animate-in fade-in slide-in-from-bottom-4">
           <MemeGenerator onLoginRequest={onLoginRequest} />
        </div>
      </div>
    );
  }

  if (activeTool === 'selfie') {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-white dark:bg-[#050505]">
        {renderBackHeader()}
        <div className="container mx-auto px-4 animate-in fade-in slide-in-from-bottom-4">
           <GroupSelfieGenerator onLoginRequest={onLoginRequest} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20 bg-white dark:bg-[#050505]">
      <div className="container mx-auto px-4">
        
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-yellow/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 border border-brand-yellow/30">
            <Sparkles size={14} className="fill-brand-yellow text-brand-yellow" />
            BeeDog AI Lab
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black mb-6 dark:text-white">
            AI <span className="text-brand-yellow">工具箱</span>
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
            利用最新的 AI 技术，释放你的 BeeDog 创造力。更多功能正在开发中...
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* Tool 1 */}
          <div 
            onClick={() => setActiveTool('pfp')}
            className="group relative bg-white dark:bg-[#161616] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] group-hover:bg-orange-500/20 transition-all"></div>
            
            <div className="w-16 h-16 bg-gradient-to-br from-brand-yellow to-orange-500 rounded-2xl flex items-center justify-center text-black mb-8 shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
              <ImageIcon size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-3 dark:text-white">PFP 生成器</h3>
            <p className="text-neutral-500 mb-8 min-h-[48px]">
              上传你的照片或宠物图，一键 Cosplay 成各种角色。
            </p>
            <div className="flex items-center text-brand-orange font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
              立即使用 <ArrowRight size={16} className="ml-2" />
            </div>
          </div>

          {/* Tool 2 */}
          <div 
            onClick={() => setActiveTool('meme')}
            className="group relative bg-white dark:bg-[#161616] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px] group-hover:bg-purple-500/20 transition-all"></div>
            
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
              <SmilePlus size={32} />
            </div>
            <div className="flex justify-between items-start mb-3">
               <h3 className="text-2xl font-bold dark:text-white">表情包制造机</h3>
               <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HOT</span>
            </div>
            <p className="text-neutral-500 mb-8 min-h-[48px]">
              AI 自动生成一套情绪表情包，并自动切割打包 ZIP。
            </p>
            <div className="flex items-center text-purple-500 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
              立即使用 <ArrowRight size={16} className="ml-2" />
            </div>
          </div>

          {/* Tool 3 */}
          <div 
            onClick={() => setActiveTool('selfie')}
            className="group relative bg-white dark:bg-[#161616] rounded-[2.5rem] p-8 border border-neutral-200 dark:border-[#333] shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-[40px] group-hover:bg-pink-500/20 transition-all"></div>
            
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-pink-500/20 group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <div className="flex justify-between items-start mb-3">
               <h3 className="text-2xl font-bold dark:text-white">一键合影工具</h3>
               <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
            </div>
            <p className="text-neutral-500 mb-8 min-h-[48px]">
              上传最多5个角色，AI 自动生成高角度俯拍自拍合影。
            </p>
            <div className="flex items-center text-pink-500 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
              立即使用 <ArrowRight size={16} className="ml-2" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

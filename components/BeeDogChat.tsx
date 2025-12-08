
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { chatWithBeeDog } from '../services/geminiService';
import { ChatMessage } from '../types';

export const BeeDogChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '汪嗡！我是 BeeDog。想知道关于“蜜蜂金”的秘密吗？🐝🐶' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await chatWithBeeDog(userText);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      // Error handled in service
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-[#1a1a1a] w-80 sm:w-96 mb-4 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right animate-in fade-in slide-in-from-bottom-10 border border-neutral-200 dark:border-[#333]">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-yellow to-orange-400 p-4 flex justify-between items-center relative overflow-hidden">
            {/* Decorative pattern */}
            <div className="absolute inset-0 bg-white/10 opacity-20" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '8px 8px'}}></div>
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white/50 shadow-sm">
                   <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" alt="BeeDog" className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="font-black text-black text-lg leading-tight">BeeDog 助手</h3>
                <p className="text-black/60 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                  在线中
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)} 
              className="bg-black/10 hover:bg-black/20 text-black p-2 rounded-full transition-colors relative z-10"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="h-80 overflow-y-auto p-4 bg-neutral-100 dark:bg-[#0f0f0f] space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar for Model */}
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#262626] flex-shrink-0 flex items-center justify-center mt-1 border border-neutral-200 dark:border-[#333] overflow-hidden">
                      <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" className="w-6 h-6 object-cover" />
                    </div>
                  )}

                  {/* Bubble */}
                  <div 
                    className={`p-3.5 text-sm shadow-sm relative group break-words ${
                      msg.role === 'user' 
                        ? 'bg-brand-yellow text-black rounded-2xl rounded-tr-none' 
                        : 'bg-white dark:bg-[#262626] text-neutral-800 dark:text-neutral-200 rounded-2xl rounded-tl-none border border-neutral-200 dark:border-[#333]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start w-full">
                 <div className="flex max-w-[85%] gap-2">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#262626] flex-shrink-0 flex items-center justify-center mt-1 border border-neutral-200 dark:border-[#333]">
                      <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" className="w-6 h-6 object-cover opacity-50" />
                    </div>
                    <div className="bg-white dark:bg-[#262626] p-4 rounded-2xl rounded-tl-none border border-neutral-200 dark:border-[#333] flex gap-1 items-center">
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-[#1a1a1a] border-t border-neutral-200 dark:border-[#333]">
            <div className="flex gap-2 items-center bg-neutral-100 dark:bg-[#262626] rounded-full px-4 py-2 border border-transparent focus-within:border-brand-yellow focus-within:ring-2 focus-within:ring-brand-yellow/20 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="跟蜜蜂狗聊两句..."
                className="flex-1 bg-transparent focus:outline-none text-sm dark:text-white placeholder-neutral-400"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="text-neutral-400 hover:text-brand-yellow disabled:opacity-50 transition-colors p-1"
              >
                <Send size={20} />
              </button>
            </div>
            <div className="text-[10px] text-center text-neutral-400 mt-2 transform scale-90 origin-bottom">
              BeeDog AI 可能会产生幻觉，请勿作为投资建议。
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group relative flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-300
          ${isOpen ? 'bg-neutral-800 rotate-90 scale-90' : 'bg-brand-yellow hover:-translate-y-1 hover:scale-105'}
        `}
      >
        {isOpen ? (
          <X size={32} className="text-white" />
        ) : (
          <>
            <MessageCircle size={32} className="text-black fill-black/10" />
            {/* Notification Dot */}
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
            </span>
          </>
        )}
      </button>
    </div>
  );
};

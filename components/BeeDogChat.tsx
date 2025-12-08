
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { chatWithBeeDog } from '../services/geminiService';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

export const BeeDogChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '汪嗡！我是蜜蜂狗。想知道关于我的故事吗？🐝🐶' }
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
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end font-sans">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 mb-4 rounded-3xl bg-white/95 dark:bg-[#121212]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right animate-in fade-in slide-in-from-bottom-10 border border-neutral-200 dark:border-white/10 ring-1 ring-black/5">
          
          {/* Header (Minimalist) */}
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-black/20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center overflow-hidden border border-neutral-200 dark:border-white/10">
                   <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" alt="BeeDog" className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#121212] animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white leading-none mb-1">
                   蜜蜂狗
                </h3>
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                  在线
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="h-96 overflow-y-auto p-4 space-y-5 scroll-smooth custom-scrollbar bg-neutral-50/50 dark:bg-black/20">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar for Model */}
                  {msg.role === 'model' && (
                    <div className="w-6 h-6 rounded-full bg-white dark:bg-[#262626] flex-shrink-0 flex items-center justify-center mt-1 border border-neutral-200 dark:border-[#333] overflow-hidden">
                      <img src="https://firebasestorage.googleapis.com/v0/b/beedogpage.firebasestorage.app/o/site%2Flogo.png?alt=media&token=84f2313f-9225-4e55-a3f2-4f3498e649ce" className="w-4 h-4 object-cover" />
                    </div>
                  )}

                  {/* Bubble */}
                  <div 
                    className={`px-4 py-2.5 text-sm shadow-sm relative group break-words leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-black text-white dark:bg-white dark:text-black rounded-2xl rounded-tr-none font-medium' 
                        : 'bg-white dark:bg-[#1e1e1e] text-neutral-800 dark:text-neutral-200 rounded-2xl rounded-tl-none border border-neutral-100 dark:border-white/5'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.text
                    ) : (
                      /* Markdown Rendering for AI */
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-500 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-black dark:text-white" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="text-neutral-700 dark:text-neutral-300" {...props} />,
                          code: ({node, inline, className, children, ...props}: any) => {
                            return inline ? (
                              <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px] text-pink-600 dark:text-pink-400 border border-black/5 dark:border-white/5" {...props}>{children}</code>
                            ) : (
                              <div className="my-2 rounded-lg overflow-hidden bg-[#1e1e1e] border border-white/10 shadow-lg">
                                <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                                </div>
                                <pre className="p-3 overflow-x-auto text-xs font-mono text-neutral-300 custom-scrollbar">
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                              </div>
                            )
                          }
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start w-full animate-pulse">
                 <div className="flex max-w-[85%] gap-2">
                    <div className="w-6 h-6 rounded-full bg-transparent flex-shrink-0"></div>
                    <div className="bg-white dark:bg-[#1e1e1e] px-4 py-3 rounded-2xl rounded-tl-none border border-neutral-100 dark:border-white/5 flex gap-1 items-center shadow-sm">
                      <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area (Minimalist) */}
          <div className="p-3 bg-white dark:bg-[#121212] border-t border-neutral-100 dark:border-white/5">
            <div className="flex gap-2 items-center bg-neutral-100 dark:bg-[#1e1e1e] rounded-[1.25rem] px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent focus:outline-none text-sm text-neutral-900 dark:text-white placeholder-neutral-400"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className={`
                  p-1.5 rounded-full transition-all duration-200
                  ${!inputValue.trim() ? 'text-neutral-400' : 'bg-brand-yellow text-black shadow-md hover:scale-105 hover:shadow-lg'}
                `}
              >
                <Send size={16} fill={!inputValue.trim() ? "none" : "currentColor"} className={inputValue.trim() ? "ml-0.5" : ""} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-500 z-50
          ${isOpen ? 'bg-neutral-900 dark:bg-white rotate-90' : 'bg-brand-yellow hover:-translate-y-1 hover:shadow-yellow-500/40'}
        `}
      >
        {isOpen ? (
          <X size={24} className="text-white dark:text-black" />
        ) : (
          <>
            <MessageCircle size={28} className="text-black" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white dark:border-[#121212]"></span>
            </span>
          </>
        )}
      </button>
    </div>
  );
};

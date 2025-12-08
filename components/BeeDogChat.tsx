import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Cpu } from 'lucide-react';
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-comic">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-[#161616] border-4 border-black dark:border-brand-yellow rounded-2xl shadow-2xl w-80 sm:w-96 mb-4 overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right animate-in fade-in slide-in-from-bottom-10">
          {/* Header */}
          <div className="bg-brand-yellow p-4 border-b-4 border-black dark:border-brand-yellow flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-full border-2 border-black">
                <Cpu size={20} className="text-black" />
              </div>
              <h3 className="font-bold text-lg text-black">BeeDog AI 助手</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-yellow-500 rounded p-1 transition text-black">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 bg-yellow-50 dark:bg-[#0A0A0A] space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] p-3 rounded-xl border-2 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 border-black text-white rounded-br-none' 
                      : 'bg-white dark:bg-[#262626] border-black dark:border-[#444] text-black dark:text-gray-100 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#262626] border-2 border-black dark:border-[#444] p-3 rounded-xl rounded-bl-none text-sm animate-pulse text-gray-500 dark:text-gray-300">
                  BeeDog 正在思考... 嗡...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white dark:bg-[#161616] border-t-4 border-black dark:border-brand-yellow flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="问问蜂蜜在哪里..."
              className="flex-1 bg-gray-100 dark:bg-[#262626] dark:text-white border-2 border-gray-300 dark:border-[#444] rounded-lg px-3 py-2 focus:outline-none focus:border-brand-yellow text-sm transition-colors"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading}
              className="bg-black dark:bg-brand-yellow text-yellow-400 dark:text-black p-2 rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity font-bold"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-brand-yellow text-black border-4 border-black dark:border-white p-4 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#FFF] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_#FFF] transition-all duration-200 flex items-center justify-center group"
      >
        {isOpen ? <X size={32} /> : <MessageCircle size={32} className="group-hover:animate-bounce" />}
      </button>
    </div>
  );
};
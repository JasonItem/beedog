
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { addMessage, getMessages, Message } from '../services/messageService';
import { Button } from './Button';
import { MessageCircle, Send, Loader2, User, Zap, AlertTriangle } from 'lucide-react';

interface MessageBoardProps {
  onLoginRequest: () => void;
}

// Helper to sanitize input (Extra precaution, though React escapes by default)
const sanitizeInput = (text: string) => {
  return text.replace(/<[^>]*>?/gm, '');
};

// Colors for random danmaku styling
const DANMAKU_COLORS = [
  'bg-white dark:bg-[#222] border-neutral-200 dark:border-[#444]',
  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
];

export const MessageBoard: React.FC<MessageBoardProps> = ({ onLoginRequest }) => {
  const { user, userProfile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initial Load - Fetch more messages for the "wall" effect
  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Fetch larger batch for danmaku density
      const { messages: newMsgs } = await getMessages(undefined, 50);
      setMessages(newMsgs);
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newMessage.trim() || !userProfile) return;
    
    // 1. Sanitize
    const cleanMessage = sanitizeInput(newMessage);
    if (!cleanMessage) {
        setError("输入内容无效");
        return;
    }

    setPosting(true);
    setError(null);
    try {
      await addMessage(userProfile, cleanMessage);
      setNewMessage("");
      // Refresh list to show new message immediately
      await loadMessages();
    } catch (e) {
      console.error(e);
      setError("发送失败，请稍后重试");
    } finally {
      setPosting(false);
    }
  };

  // Divide messages into "Tracks" for Danmaku effect
  const TRACK_COUNT = 6;
  const getTrackMessages = (trackIndex: number) => {
      return messages.filter((_, idx) => idx % TRACK_COUNT === trackIndex);
  };

  return (
    <section id="community-board" className="py-24 bg-neutral-100 dark:bg-[#080808] relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
           <div className="text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-display font-black mb-2 flex items-center gap-3 justify-center md:justify-start">
                 <MessageCircle className="text-brand-yellow" size={40}/> 社区留言板
              </h2>
              <p className="text-neutral-500">
                  听听家人们都在聊什么
              </p>
           </div>
           
           {/* Post Input Area - Floating outside the board */}
           <div className="w-full md:w-auto flex-1 max-w-md">
              {user ? (
                  <div className="bg-white dark:bg-[#161616] p-1.5 rounded-full shadow-xl border border-neutral-200 dark:border-[#333] flex items-center gap-2">
                      <div className="pl-4 flex-1">
                          <input 
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                            placeholder="发送弹幕..."
                            className="w-full bg-transparent focus:outline-none text-sm dark:text-white placeholder-neutral-400"
                            maxLength={100}
                          />
                      </div>
                      <Button 
                        size="sm" 
                        onClick={handlePost} 
                        disabled={posting || !newMessage.trim()}
                        className="rounded-full px-6"
                      >
                          {posting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16} />}
                      </Button>
                  </div>
              ) : (
                  <Button onClick={onLoginRequest} variant="secondary" className="w-full shadow-lg">
                      登录发送弹幕
                  </Button>
              )}
              {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
           </div>
        </div>

        {/* --- THE PHYSICAL BOARD CONTAINER --- */}
        <div className="relative w-full h-[500px] bg-[#1a1a1a] rounded-3xl border-[12px] border-[#333] shadow-2xl overflow-hidden flex flex-col justify-center group">
            
            {/* Board Texture & Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-20" 
                 style={{
                     backgroundImage: `
                        linear-gradient(#444 1px, transparent 1px),
                        linear-gradient(90deg, #444 1px, transparent 1px)
                     `,
                     backgroundSize: '40px 40px'
                 }}>
            </div>
            
            {/* Screws (Visual Candy) */}
            <div className="absolute top-4 left-4 w-4 h-4 rounded-full bg-[#111] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center"><div className="w-2 h-0.5 bg-[#444] rotate-45"></div></div>
            <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-[#111] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center"><div className="w-2 h-0.5 bg-[#444] rotate-45"></div></div>
            <div className="absolute bottom-4 left-4 w-4 h-4 rounded-full bg-[#111] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center"><div className="w-2 h-0.5 bg-[#444] rotate-45"></div></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-[#111] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center"><div className="w-2 h-0.5 bg-[#444] rotate-45"></div></div>

            {/* Empty State */}
            {!loading && messages.length === 0 && (
                <div className="text-center relative z-10 opacity-50 flex flex-col items-center">
                    <MessageCircle size={64} className="text-neutral-600 mb-4"/>
                    <p className="text-neutral-500 font-bold text-xl">暂无弹幕</p>
                    <p className="text-neutral-600 text-sm">快来发送第一条吧！</p>
                </div>
            )}

            {/* DANMAKU TRACKS */}
            <div className="absolute inset-0 flex flex-col justify-evenly py-8 overflow-hidden">
                {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => {
                    const trackMessages = getTrackMessages(trackIdx);
                    // Fixed: No longer duplicating messages multiple times to avoid the "appear 3 times" bug
                    // If the list is short, it will just have a gap until it loops.
                    const displayMessages = trackMessages;

                    if (displayMessages.length === 0) return null;

                    // Increased duration slightly because we are now traversing 100vw + content width
                    const duration = 20 + (trackIdx % 3) * 5; // 20s, 25s, 30s speeds
                    const delay = (trackIdx % 2) * -10; // Stagger start

                    return (
                        <div key={trackIdx} className="relative w-full h-12 flex items-center overflow-hidden">
                            <div 
                                className="flex gap-8 absolute whitespace-nowrap animate-danmaku hover:[animation-play-state:paused]"
                                style={{ 
                                    animationDuration: `${duration}s`,
                                    animationDelay: `${delay}s`
                                    // Removed 'left' style as keyframes handle position now
                                }}
                            >
                                {displayMessages.map((msg, i) => {
                                    // Pseudo-random styling based on ID or index
                                    const styleIdx = (msg.content.length + i) % DANMAKU_COLORS.length;
                                    const styleClass = DANMAKU_COLORS[styleIdx];
                                    
                                    return (
                                        <div 
                                            key={`${msg.id}-${i}`}
                                            className={`
                                                inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border backdrop-blur-md select-none transition-transform hover:scale-110 cursor-default
                                                ${styleClass}
                                            `}
                                        >
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 border border-black/10 shrink-0">
                                                {msg.avatarUrl ? (
                                                    <img src={msg.avatarUrl} className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><User size={12}/></div>
                                                )}
                                            </div>
                                            <span className="font-bold text-sm text-neutral-800 dark:text-white whitespace-nowrap">
                                                {msg.content}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Overlay Reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none rounded-2xl"></div>
        </div>
        
        <div className="text-center mt-4 text-xs text-neutral-400">
            <span className="flex items-center justify-center gap-1"><AlertTriangle size={12}/> 注意：所有留言均公开，请文明发言。</span>
        </div>

      </div>
    </section>
  );
};

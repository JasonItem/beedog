
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit } from '../../services/userService';
import { saveScore, getUserHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { TrendingUp, TrendingDown, Activity, Wallet, Lock, Skull, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MoonOrDoomProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Data Structure for K-Line
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Position {
  id: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  margin: number;
  leverage: number;
  size: number; // margin * leverage
  liquidationPrice: number;
  timestamp: number;
}

export const MoonOrDoom: React.FC<MoonOrDoomProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- UI State ---
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [marginInput, setMarginInput] = useState<string>('10');
  const [leverage, setLeverage] = useState<number>(10);
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [cumulativePnL, setCumulativePnL] = useState(0); 
  const [currentPrice, setCurrentPrice] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  // Interaction Locks
  const [isTransactionPending, setIsTransactionPending] = useState(false); // For Open Position
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set()); // For Close Position (per ID)
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'win' | 'loss' | 'info' | 'liq'} | null>(null);

  // Constants
  const CANVAS_WIDTH = 340;
  const CANVAS_HEIGHT = 280;
  const MAX_LEVERAGE = 125;
  const CANDLE_WIDTH = 5;
  const CANDLE_SPACING = 3;
  const MAX_CANDLES = Math.floor(CANVAS_WIDTH / (CANDLE_WIDTH + CANDLE_SPACING));
  // REMOVED SPREAD FEE
  const SYMBOL = 'BNBUSDT';
  
  // --- Game Loop Refs ---
  const gameRef = useRef({
    candles: [] as Candle[],
    currentCandle: null as Candle | null,
    
    price: 0,
    
    // Timers
    animationId: 0,
    
    positions: [] as Position[], 
    currentCumulativePnL: 0,
    ws: null as WebSocket | null
  });

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.uid) {
      getUserHighScore('moon_doom', userProfile.uid).then(score => {
        gameRef.current.currentCumulativePnL = score;
        setCumulativePnL(score);
      });
    }
  }, [userProfile?.uid]);

  // Init Real Data
  useEffect(() => {
    initRealMarket();
    startLoop();

    return () => {
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
      if (gameRef.current.ws) gameRef.current.ws.close();
    };
  }, []);

  const initRealMarket = async () => {
      try {
          // 1. Fetch History via REST (to fill the chart immediately)
          const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=1s&limit=${MAX_CANDLES}`);
          const data = await response.json();
          
          const history: Candle[] = data.map((k: any) => ({
              time: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4])
          }));

          // Take the last one as current active candle
          const lastCandle = history.pop();
          
          gameRef.current.candles = history;
          if (lastCandle) {
            gameRef.current.currentCandle = lastCandle;
            gameRef.current.price = lastCandle.close;
            setCurrentPrice(lastCandle.close);
          }

          // 2. Connect WebSocket for Live Updates
          connectWebSocket();

      } catch (e) {
          console.error("Failed to fetch market data", e);
          showNotif("无法连接真实市场数据", 'loss');
      }
  };

  const connectWebSocket = () => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@kline_1s`);
      
      ws.onopen = () => {
          setIsConnected(true);
      };

      ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          const k = msg.k; // Kline object
          
          const candle: Candle = {
              time: k.t,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c)
          };

          gameRef.current.price = candle.close;
          setCurrentPrice(candle.close);
          gameRef.current.currentCandle = candle;

          // If candle closed, push to history
          if (k.x) {
              gameRef.current.candles.push(candle);
              if (gameRef.current.candles.length > MAX_CANDLES) {
                  gameRef.current.candles.shift();
              }
          }

          // Check Liquidations immediately on price update
          checkLiquidations(candle.close);
      };

      ws.onclose = () => {
          setIsConnected(false);
          // Simple reconnect logic could go here
      };

      gameRef.current.ws = ws;
  };

  const checkLiquidations = (newPrice: number) => {
      // Only liquidate active positions
      for (let i = gameRef.current.positions.length - 1; i >= 0; i--) {
          const pos = gameRef.current.positions[i];
          
          // Liquidation Logic
          // Long: Price drops below Liq
          if (pos.type === 'LONG' && newPrice <= pos.liquidationPrice) {
              liquidatePosition(pos, i);
          } 
          // Short: Price rises above Liq
          else if (pos.type === 'SHORT' && newPrice >= pos.liquidationPrice) {
              liquidatePosition(pos, i);
          }
      }
  };

  const startLoop = () => {
      loop();
  };

  const showNotif = (msg: string, type: 'win' | 'loss' | 'info' | 'liq') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 2500);
  };

  // --- CONTROLS ---

  const handleSetMargin = (val: string) => {
      if (val === '') { setMarginInput(''); return; }
      const num = parseInt(val);
      if (!isNaN(num) && num >= 0) setMarginInput(num.toString());
  };

  // --- TRADING LOGIC ---

  const openPosition = async (type: 'LONG' | 'SHORT') => {
      if (!userProfile) return;
      if (isTransactionPending) return; // Lock check
      if (!isConnected) {
          showNotif("正在连接交易所...", 'info');
          return;
      }
      
      const margin = parseInt(marginInput);
      
      if (isNaN(margin) || margin <= 0) {
          showNotif("请输入有效的保证金", 'info');
          return;
      }
      if (credits < margin) {
          showNotif("蜂蜜余额不足!", 'loss');
          return;
      }

      setIsTransactionPending(true);

      try {
        // 1. Deduct Margin
        const success = await deductCredit(userProfile.uid, margin);
        if (!success) {
            showNotif("交易失败", 'loss');
            return;
        }
        
        setCredits(prev => prev - margin);
        refreshProfile();

        // 2. Create Position - NO SPREAD (Zero Fee)
        const currentMarketPrice = gameRef.current.price;
        const entryPrice = currentMarketPrice;

        const size = margin * leverage;
        
        // Calculate Liquidation Price (Simulated Isolation Margin)
        // Liquidation happens when margin is exhausted (~80% loss usually in real crypto, let's say 90% here)
        // Long Liq: Entry * (1 - 1/Lev)
        let liquidationPrice = 0;
        if (type === 'LONG') {
            liquidationPrice = entryPrice * (1 - (1/leverage) * 0.9);
        } else {
            liquidationPrice = entryPrice * (1 + (1/leverage) * 0.9);
        }

        const newPos: Position = {
            id: Date.now(),
            type,
            entryPrice,
            margin,
            leverage,
            size,
            liquidationPrice,
            timestamp: Date.now()
        };

        gameRef.current.positions.unshift(newPos);
        setActivePositions([...gameRef.current.positions]);
        
        audio.playShoot();
        showNotif(`${leverage}x 开仓! (价格 ${entryPrice.toFixed(2)})`, 'info');
        
      } catch (e) {
          console.error(e);
          showNotif("系统错误", 'loss');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const closePosition = async (id: number) => {
      if (!userProfile) return;
      if (closingIds.has(id)) return; // Prevent double clicking on same position

      // Mark as closing
      setClosingIds(prev => {
          const next = new Set(prev);
          next.add(id);
          return next;
      });

      try {
          const posIndex = gameRef.current.positions.findIndex(p => p.id === id);
          if (posIndex === -1) return;

          const pos = gameRef.current.positions[posIndex];
          // Close price = Market Price (No Spread)
          const closePrice = gameRef.current.price;
          
          // Calculate PnL
          let pnlPercent = 0;
          if (pos.type === 'LONG') {
              pnlPercent = (closePrice - pos.entryPrice) / pos.entryPrice;
          } else {
              pnlPercent = (pos.entryPrice - closePrice) / pos.entryPrice;
          }
          
          const pnlAmount = Math.floor(pos.size * pnlPercent);
          const returnAmount = pos.margin + pnlAmount;

          if (returnAmount > 0) {
              // Add money back (negative deduction)
              await deductCredit(userProfile.uid, -returnAmount); 
          }
          
          try {
              gameRef.current.currentCumulativePnL += pnlAmount;
              await saveScore(userProfile, 'moon_doom', Math.floor(gameRef.current.currentCumulativePnL));
              setCumulativePnL(Math.floor(gameRef.current.currentCumulativePnL));
          } catch (e) { console.error(e); }

          setCredits(prev => Math.max(0, prev + returnAmount));
          refreshProfile();
          
          if (pnlAmount > 0) {
              audio.playScore();
              showNotif(`止盈! +${pnlAmount} 蜂蜜`, 'win');
          } else {
              audio.playStep();
              showNotif(`止损! ${pnlAmount} 蜂蜜`, 'loss');
          }

          gameRef.current.positions.splice(posIndex, 1);
          setActivePositions([...gameRef.current.positions]);
          
          onGameOver();
      } catch (error) {
          console.error("Close position error", error);
      } finally {
          // Unmark
          setClosingIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
          });
      }
  };

  const liquidatePosition = async (pos: Position, index: number) => {
      // Immediate removal to prevent double liquidation visual
      if (index > -1 && gameRef.current.positions[index]?.id === pos.id) {
          gameRef.current.positions.splice(index, 1);
          setActivePositions([...gameRef.current.positions]);
          
          audio.playGameOver();
          showNotif(`爆仓! -${pos.margin} 蜂蜜`, 'liq');
          
          if (userProfile) {
              gameRef.current.currentCumulativePnL -= pos.margin;
              saveScore(userProfile, 'moon_doom', Math.floor(gameRef.current.currentCumulativePnL));
              setCumulativePnL(Math.floor(gameRef.current.currentCumulativePnL));
              onGameOver();
          }
      }
  };

  // --- RENDERING ---

  const drawChart = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background Grid
      ctx.fillStyle = '#09090b'; 
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 0; y < CANVAS_HEIGHT; y+=40) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); }
      for (let x = 0; x < CANVAS_WIDTH; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); }
      ctx.stroke();

      const { candles, currentCandle } = gameRef.current;
      const allData = [...candles];
      if (currentCandle) allData.push(currentCandle);

      if (allData.length < 2) return;

      // Calculate Scale (Viewport Window)
      let min = Infinity, max = -Infinity;
      // Look only at recent candles to auto-scale
      const visibleData = allData.slice(-MAX_CANDLES);
      visibleData.forEach(c => {
          if (c.low < min) min = c.low;
          if (c.high > max) max = c.high;
      });
      
      // Auto-scale padding
      const padding = (max - min) * 0.1 || 10;
      const drawMin = min - padding;
      const drawMax = max + padding;
      const priceRange = drawMax - drawMin || 1;

      const getY = (val: number) => CANVAS_HEIGHT - ((val - drawMin) / priceRange) * CANVAS_HEIGHT;

      // Draw Entry Lines for Active Positions
      gameRef.current.positions.forEach(pos => {
          const y = getY(pos.entryPrice);
          const liqY = getY(pos.liquidationPrice);
          
          // Entry Line
          if (y >= 0 && y <= CANVAS_HEIGHT) {
              ctx.strokeStyle = '#a1a1aa';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 2]);
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
              ctx.setLineDash([]);
              
              ctx.fillStyle = '#a1a1aa';
              ctx.font = '9px sans-serif';
              ctx.fillText(`${pos.leverage}x Entry`, 2, y - 4);
          }
          
          // Liquidation Line (Danger)
          if (liqY >= 0 && liqY <= CANVAS_HEIGHT) {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.beginPath(); ctx.moveTo(0, liqY); ctx.lineTo(CANVAS_WIDTH, liqY); ctx.stroke();
              ctx.setLineDash([]);
              
              ctx.fillStyle = '#ef4444';
              ctx.textAlign = 'right';
              ctx.fillText(`LIQ ${pos.liquidationPrice.toFixed(2)}`, CANVAS_WIDTH - 2, liqY - 4);
              ctx.textAlign = 'left';
          }
      });

      // Draw Candles
      const candleWidth = CANDLE_WIDTH;
      const spacing = CANDLE_SPACING;
      
      let x = CANVAS_WIDTH - (candleWidth/2) - 60; // Padding right for price label

      for (let i = allData.length - 1; i >= 0; i--) {
          const c = allData[i];
          const xPos = x;
          
          const yOpen = getY(c.open);
          const yClose = getY(c.close);
          const yHigh = getY(c.high);
          const yLow = getY(c.low);
          
          const isGreen = c.close >= c.open;
          const color = isGreen ? '#22c55e' : '#ef4444';
          
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          
          // Wick
          ctx.beginPath();
          ctx.moveTo(xPos, yHigh);
          ctx.lineTo(xPos, yLow);
          ctx.stroke();
          
          // Body
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1); 
          
          ctx.fillRect(xPos - candleWidth/2, bodyTop, candleWidth, bodyHeight);
          
          x -= (candleWidth + spacing);
          if (x < -10) break; 
      }

      // Current Price Line
      const currentY = getY(gameRef.current.price);
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([1, 1]);
      ctx.beginPath(); ctx.moveTo(0, currentY); ctx.lineTo(CANVAS_WIDTH, currentY); ctx.stroke();
      ctx.setLineDash([]);

      // Price Bubble
      ctx.fillStyle = '#222';
      ctx.fillRect(CANVAS_WIDTH - 60, currentY - 10, 60, 20);
      ctx.fillStyle = gameRef.current.price >= (allData[allData.length-2]?.close || 0) ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(gameRef.current.price.toFixed(2), CANVAS_WIDTH - 4, currentY + 4);
      ctx.textAlign = 'left';
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);
    // Draw every frame, data updates via WebSocket async
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawChart(ctx);
    }
  };

  // Helper to calc live PnL for list
  const getPnL = (pos: Position) => {
      const price = currentPrice;
      const exitPrice = price; // No spread on exit either

      let pnlPercent = 0;
      if (pos.type === 'LONG') {
          pnlPercent = (exitPrice - pos.entryPrice) / pos.entryPrice;
      } else {
          pnlPercent = (pos.entryPrice - exitPrice) / pos.entryPrice;
      }
      
      const roe = pnlPercent * pos.leverage;
      const pnlValue = Math.floor(pos.margin * roe);
      return { pnlValue, roe };
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      
      {/* 1. Header & Wallet */}
      <div className="w-full bg-neutral-900 rounded-2xl p-3 border border-white/10 shadow-lg flex justify-between items-center">
          <div className="flex items-center gap-2">
              <div className="bg-yellow-500/20 p-1.5 rounded-lg text-yellow-500">
                  <Wallet size={16} />
              </div>
              <div className="leading-tight">
                  <div className="text-[10px] text-neutral-400 font-bold uppercase">可用余额</div>
                  <div className="text-base font-mono font-black text-white">{credits} 🍯</div>
              </div>
          </div>
          <div className={`text-right ${cumulativePnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <div className="text-[10px] text-neutral-500 uppercase font-bold">总盈亏 (PnL)</div>
              <div className="font-mono font-bold text-sm">{cumulativePnL > 0 ? '+' : ''}{cumulativePnL}</div>
          </div>
      </div>

      {/* 2. Chart Canvas */}
      <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-800">
        
        {/* Status Indicator */}
        <div className={`absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold ${isConnected ? 'text-green-500' : 'text-red-500'} z-10 bg-black/50 px-2 py-1 rounded-full`}>
            {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
            {isConnected ? 'LIVE: BNB/USDT' : '连接中...'}
        </div>

        <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT} 
            className="w-full h-auto block"
        />
        
        {/* Notification Toast */}
        {notification && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-max pointer-events-none">
                <div className={`
                    rounded-2xl px-6 py-3 shadow-2xl border-2 flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-200
                    ${notification.type === 'win' ? 'bg-green-600 border-green-400 text-white' : 
                      notification.type === 'loss' ? 'bg-orange-600 border-orange-400 text-white' : 
                      notification.type === 'liq' ? 'bg-red-700 border-red-500 text-white' :
                      'bg-neutral-800 border-neutral-500 text-white'}
                `}>
                    <div className="flex items-center gap-2">
                        {notification.type === 'win' ? <TrendingUp size={24} /> : 
                         notification.type === 'loss' ? <TrendingDown size={24} /> : 
                         notification.type === 'liq' ? <Skull size={24}/> : <Activity size={24}/>}
                        <span className="font-black text-xl tracking-tight">{notification.msg}</span>
                    </div>
                </div>
            </div>
        )}

        {!userProfile && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6 text-center">
                <Lock size={32} className="text-yellow-500 mb-3" />
                <h3 className="font-bold text-white text-lg">需要登录</h3>
                <p className="text-xs text-neutral-400 mb-4">登录后即可体验全真模拟合约交易</p>
            </div>
        )}
      </div>
      
      {/* Risk Warning (Updated: Removed fee warning) */}
      <div className="w-full bg-red-900/30 border border-red-500/30 rounded-lg p-2 flex items-start gap-2 text-[10px] text-red-300">
         <AlertCircle size={12} className="mt-0.5 shrink-0"/>
         <span>真实行情模式 (BNB/USDT) | 免手续费 | 高风险提示：请谨慎控制杠杆。</span>
      </div>

      {/* 3. Trading Controls */}
      <div className="w-full bg-neutral-900 rounded-2xl p-4 border border-white/5 space-y-4">
          
          {/* Top Row: Leverage & Margin */}
          <div className="grid grid-cols-2 gap-4">
              {/* Leverage Slider */}
              <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-400">
                      <span>杠杆 Leverage</span>
                      <span className={`${leverage > 50 ? 'text-red-500' : 'text-yellow-500'}`}>{leverage}x</span>
                  </div>
                  <input 
                      type="range" 
                      min="1" max={MAX_LEVERAGE} 
                      value={leverage} 
                      onChange={(e) => setLeverage(parseInt(e.target.value))}
                      className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                      <span>1x</span><span>50x</span><span>100x</span><span className="text-red-500">125x</span>
                  </div>
              </div>

              {/* Margin Input */}
              <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-400">保证金 Margin</div>
                  <div className="flex items-center bg-neutral-800 rounded-lg border border-neutral-700 focus-within:border-yellow-500 transition-colors">
                      <input 
                          type="number" 
                          value={marginInput}
                          onChange={(e) => handleSetMargin(e.target.value)}
                          className="w-full bg-transparent text-white text-sm font-bold p-2 outline-none text-right"
                      />
                      <span className="text-[10px] text-gray-500 pr-2">🍯</span>
                  </div>
              </div>
          </div>

          {/* Info Row */}
          <div className="flex justify-between text-[10px] text-gray-500 bg-black/20 p-2 rounded-lg">
              <span>仓位价值: <span className="text-gray-300 font-mono">{(parseInt(marginInput || '0') * leverage).toLocaleString()}</span></span>
              <span>强平距离: <span className="text-gray-300 font-mono">{(100 / leverage).toFixed(2)}%</span></span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!userProfile || parseInt(marginInput) <= 0 || parseInt(marginInput) > credits || !isConnected || isTransactionPending}
                onClick={() => openPosition('LONG')}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-lg flex flex-col items-center leading-none shadow-lg active:scale-95 transition-transform border-b-4 border-green-800 active:border-b-0 active:translate-y-1 relative"
              >
                  {isTransactionPending ? (
                      <Loader2 className="animate-spin" size={24} />
                  ) : (
                      <>
                        <span className="flex items-center gap-1"><TrendingUp size={16}/> 做多 (Long)</span>
                        <span className="text-[9px] font-normal opacity-70 mt-1">看涨</span>
                      </>
                  )}
              </button>
              
              <button
                disabled={!userProfile || parseInt(marginInput) <= 0 || parseInt(marginInput) > credits || !isConnected || isTransactionPending}
                onClick={() => openPosition('SHORT')}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-lg flex flex-col items-center leading-none shadow-lg active:scale-95 transition-transform border-b-4 border-red-800 active:border-b-0 active:translate-y-1 relative"
              >
                  {isTransactionPending ? (
                      <Loader2 className="animate-spin" size={24} />
                  ) : (
                      <>
                        <span className="flex items-center gap-1"><TrendingDown size={16}/> 做空 (Short)</span>
                        <span className="text-[9px] font-normal opacity-70 mt-1">看跌</span>
                      </>
                  )}
              </button>
          </div>
      </div>

      {/* 4. Positions List */}
      <div className="w-full space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">当前持仓 ({activePositions.length})</h3>
          
          {activePositions.length === 0 ? (
              <div className="text-center py-8 text-neutral-600 text-sm border border-dashed border-neutral-800 rounded-xl">
                  暂无持仓
              </div>
          ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {activePositions.map((pos) => {
                      const { pnlValue, roe } = getPnL(pos);
                      const isProfit = pnlValue >= 0;
                      const isClosing = closingIds.has(pos.id);
                      
                      return (
                          <div key={pos.id} className="bg-neutral-800 rounded-xl p-3 border-l-4 border-l-gray-600 relative overflow-hidden animate-in slide-in-from-right-2">
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${pos.type === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <div className={`text-sm font-black flex items-center gap-1 ${pos.type === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                          {pos.type === 'LONG' ? '做多' : '做空'} {pos.leverage}x
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                          Entry: {pos.entryPrice.toFixed(2)} | Liq: <span className="text-orange-500">{pos.liquidationPrice.toFixed(2)}</span>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-lg font-black font-mono leading-none ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                          {isProfit ? '+' : ''}{pnlValue}
                                      </div>
                                      <div className={`text-[10px] font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                          {(roe * 100).toFixed(2)}%
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                  <div className="text-[10px] text-gray-500">
                                      保证金: <span className="text-gray-300">{pos.margin}</span>
                                  </div>
                                  <button 
                                    onClick={() => closePosition(pos.id)}
                                    disabled={isClosing}
                                    className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-1"
                                  >
                                      {isClosing ? <Loader2 size={12} className="animate-spin"/> : "平仓"}
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

    </div>
  );
};

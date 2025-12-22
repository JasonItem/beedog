
import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, deductCredit, updateTradingPositions, TradingPosition } from '../../services/userService';
import { saveScore, getUserHighScore } from '../../services/gameService';
import { audio } from '../../services/audioService';
import { TrendingUp, TrendingDown, Activity, Wallet, Lock, Skull, AlertCircle, Wifi, Globe, ChevronDown, Loader2, Plus, Minus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MoonOrDoomProps {
  userProfile: UserProfile | null;
  onGameOver: () => void;
}

// Updated Data Structure for K-Line
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number; // Added Volume
}

const SOURCES = [
    { name: 'Binance', url: 'wss://stream.binance.com:9443/ws/bnbusdt@kline_1m', type: 'kline' },
    { name: 'OKX', url: 'wss://ws.okx.com:8443/public', type: 'kline' },
    { name: 'Gate.io', url: 'wss://api.gateio.ws/ws/v4/', type: 'kline' }
];

// Binance REST API for initial history
const HISTORY_URL = 'https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=1m&limit=200';

export const MoonOrDoom: React.FC<MoonOrDoomProps> = ({ userProfile, onGameOver }) => {
  const { refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- UI State ---
  const [credits, setCredits] = useState(userProfile?.credits || 0);
  const [marginInput, setMarginInput] = useState<string>('10');
  const [leverage, setLeverage] = useState<number>(10);
  const [activePositions, setActivePositions] = useState<TradingPosition[]>([]);
  const [cumulativePnL, setCumulativePnL] = useState(0); 
  const [currentPrice, setCurrentPrice] = useState(0);
  const [sourceName, setSourceName] = useState(SOURCES[0].name);
  const [isConnected, setIsConnected] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  
  // Interaction Locks
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set());
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'win' | 'loss' | 'info' | 'liq'} | null>(null);

  // Constants
  const CANVAS_WIDTH = 340;
  const CANVAS_HEIGHT = 350;
  const MAX_LEVERAGE = 1000;
  
  // --- Game Loop Refs ---
  const gameRef = useRef({
    candles: [] as Candle[],
    currentCandle: null as Candle | null,
    
    price: 0,
    lastValidPrice: 0,
    lastMessageTime: 0,
    
    // Chart View State
    scale: 10, // Pixels per candle (Zoom)
    offset: 0, // Pixels shift (Pan). Positive = see history (move candles right). Negative = see future (move candles left).
    isDragging: false,
    lastDragX: 0,
    hoverX: -1,
    hoverY: -1,
    
    // Timers
    animationId: 0,
    
    positions: [] as TradingPosition[], 
    currentCumulativePnL: 0,
    ws: null as WebSocket | null,
    activeSourceIndex: 0,
    unmounted: false
  });

  const hasInitializedPositions = useRef(false);

  useEffect(() => {
    setCredits(userProfile?.credits || 0);
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.uid) {
      getUserHighScore('moon_doom', userProfile.uid).then(score => {
        gameRef.current.currentCumulativePnL = score;
        setCumulativePnL(score);
      });
      
      // Load Positions if not initialized
      if (!hasInitializedPositions.current && userProfile.tradingData?.positions) {
          const savedPositions = userProfile.tradingData.positions;
          if (savedPositions.length > 0) {
             setActivePositions(savedPositions);
             gameRef.current.positions = savedPositions;
          }
          hasInitializedPositions.current = true;
      }
    }
  }, [userProfile?.uid]); // Only depend on UID change for initial load

  // Init Data
  useEffect(() => {
    gameRef.current.unmounted = false;
    
    const init = async () => {
        await fetchHistory();
        connectToSource(0);
        startLoop();
    };

    init();

    return () => {
      gameRef.current.unmounted = true;
      if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
      if (gameRef.current.ws) {
          gameRef.current.ws.onclose = null;
          gameRef.current.ws.close();
          gameRef.current.ws = null;
      }
    };
  }, []);

  const fetchHistory = async () => {
      try {
          const res = await fetch(HISTORY_URL);
          const data = await res.json();
          // Binance format: [open_time, open, high, low, close, volume, close_time, ...]
          if (Array.isArray(data)) {
            const historyCandles: Candle[] = data.map((d: any) => ({
                time: d[0],
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                vol: parseFloat(d[5])
            }));
            
            if (historyCandles.length > 0) {
                const last = historyCandles.pop()!;
                gameRef.current.candles = historyCandles;
                gameRef.current.currentCandle = last;
                
                gameRef.current.lastValidPrice = last.close;
                gameRef.current.price = last.close;
                setCurrentPrice(last.close);
            }
          }
      } catch (e) {
          console.error("Failed to fetch K-line history", e);
      }
  };

  const connectToSource = (index: number) => {
      if (gameRef.current.unmounted) return;
      
      if (gameRef.current.ws) {
          gameRef.current.ws.onclose = null;
          gameRef.current.ws.close();
          gameRef.current.ws = null;
      }

      const safeIndex = index % SOURCES.length;
      gameRef.current.activeSourceIndex = safeIndex;
      const source = SOURCES[safeIndex];
      
      setSourceName(source.name);
      setIsConnected(false);

      try {
          const ws = new WebSocket(source.url);
          gameRef.current.ws = ws;

          ws.onopen = () => {
              if (gameRef.current.unmounted) return;
              setIsConnected(true);
              gameRef.current.lastMessageTime = Date.now();

              if (source.name === 'OKX') {
                  const msg = JSON.stringify({
                      "op": "subscribe",
                      "args": [{"channel": "candle1m", "instId": "BNB-USDT"}]
                  });
                  ws.send(msg);
              } else if (source.name === 'Gate.io') {
                  const msg = JSON.stringify({
                      "time": Math.floor(Date.now() / 1000),
                      "channel": "spot.candlesticks",
                      "event": "subscribe",
                      "payload": ["1m", "BNB_USDT"]
                  });
                  ws.send(msg);
              }
          };

          ws.onmessage = (event) => {
              if (gameRef.current.unmounted) return;
              gameRef.current.lastMessageTime = Date.now();
              handleMessage(event, source.name);
          };

          ws.onclose = () => {
              if (gameRef.current.unmounted) return;
              setIsConnected(false);
              setTimeout(() => {
                  if (!gameRef.current.unmounted) connectToSource(safeIndex + 1);
              }, 1000);
          };

      } catch (e) {
          setTimeout(() => connectToSource(safeIndex + 1), 1000);
      }
  };

  const handleMessage = (event: MessageEvent, source: string) => {
      try {
          const data = JSON.parse(event.data);
          let newCandle: Candle | null = null;
          let isClosed = false;

          if (source === 'Binance') {
              if (data.e === 'kline') {
                  const k = data.k;
                  newCandle = {
                      time: k.t,
                      open: parseFloat(k.o),
                      high: parseFloat(k.h),
                      low: parseFloat(k.l),
                      close: parseFloat(k.c),
                      vol: parseFloat(k.v)
                  };
                  isClosed = k.x;
              }
          } else if (source === 'OKX') {
              if (data.data && data.data[0]) {
                  const k = data.data[0];
                  newCandle = {
                      time: parseInt(k[0]),
                      open: parseFloat(k[1]),
                      high: parseFloat(k[2]),
                      low: parseFloat(k[3]),
                      close: parseFloat(k[4]),
                      vol: parseFloat(k[5])
                  };
              }
          } else if (source === 'Gate.io') {
              if (data.event === 'update' && data.result) {
                  const k = data.result;
                  newCandle = {
                      time: parseInt(k.t) * 1000,
                      open: parseFloat(k.o),
                      high: parseFloat(k.h),
                      low: parseFloat(k.l),
                      close: parseFloat(k.c),
                      vol: parseFloat(k.v)
                  };
              }
          }

          if (newCandle) {
              if (gameRef.current.lastValidPrice > 0) {
                  const deviation = Math.abs(newCandle.close - gameRef.current.lastValidPrice) / gameRef.current.lastValidPrice;
                  if (deviation > 0.3) return; 
              }
              gameRef.current.lastValidPrice = newCandle.close;
              
              updatePrice(newCandle.close);
              updateCandle(newCandle, isClosed);
          }
      } catch (e) {
          // Ignore
      }
  };

  const updateCandle = (candle: Candle, forceClose: boolean) => {
      const { currentCandle } = gameRef.current;

      if (!currentCandle) {
          gameRef.current.currentCandle = candle;
          return;
      }

      if (candle.time > currentCandle.time) {
          gameRef.current.candles.push(currentCandle);
          if (gameRef.current.candles.length > 500) gameRef.current.candles.shift();
          gameRef.current.currentCandle = candle;
      } else {
          gameRef.current.currentCandle = candle;
          if (forceClose) {
              gameRef.current.candles.push(candle);
              if (gameRef.current.candles.length > 500) gameRef.current.candles.shift();
              gameRef.current.currentCandle = null;
          }
      }
  };

  const updatePrice = (price: number) => {
      gameRef.current.price = price;
      setCurrentPrice(price);
      checkLiquidations(price);
  };

  const checkLiquidations = (newPrice: number) => {
      for (let i = gameRef.current.positions.length - 1; i >= 0; i--) {
          const pos = gameRef.current.positions[i];
          if ((pos.type === 'LONG' && newPrice <= pos.liquidationPrice) || 
              (pos.type === 'SHORT' && newPrice >= pos.liquidationPrice)) {
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

  const handleZoom = (delta: number) => {
      // Zoom limits: 2px (zoom out) to 50px (zoom in)
      const newScale = Math.max(2, Math.min(50, gameRef.current.scale + delta));
      gameRef.current.scale = newScale;
  };

  // --- RENDERING ---

  const renderCanvas = (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas;
      const { candles, currentCandle, scale, offset, hoverX, hoverY, positions } = gameRef.current;
      
      const allData = [...candles];
      if (currentCandle) allData.push(currentCandle);

      if (allData.length < 2) {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#333';
          ctx.font = '12px sans-serif';
          ctx.fillText("Waiting for data...", width/2 - 40, height/2);
          return;
      }

      // --- LAYOUT ---
      const priceH = height * 0.75;
      const volH = height * 0.25;
      const volY = priceH;
      const candleUnit = scale * 1.2;

      // --- CALCULATE VISIBLE RANGE ---
      const total = allData.length;
      let startIndex = Math.floor(total - 1 - (width + offset + scale) / candleUnit);
      let endIndex = Math.ceil(total - 1 - (offset - scale) / candleUnit);

      // Clamp to valid array bounds
      startIndex = Math.max(0, startIndex);
      endIndex = Math.min(total, endIndex + 1); // +1 for slice exclusive
      
      const visibleCandles = allData.slice(startIndex, endIndex);
      
      // --- SCALE Y ---
      let minPrice = Infinity, maxPrice = -Infinity;
      let maxVol = 0;
      
      visibleCandles.forEach(c => {
          if (c.low < minPrice) minPrice = c.low;
          if (c.high > maxPrice) maxPrice = c.high;
          if (c.vol > maxVol) maxVol = c.vol;
      });
      
      const range = maxPrice - minPrice || 1;
      const paddedMin = minPrice - range * 0.1;
      const paddedMax = maxPrice + range * 0.1;
      const paddedRange = paddedMax - paddedMin;

      const getPriceY = (p: number) => priceH - ((p - paddedMin) / paddedRange) * priceH;
      const getVolHeight = (v: number) => (v / (maxVol || 1)) * (volH - 10);

      // --- DRAW BACKGROUND ---
      ctx.fillStyle = '#09090b'; 
      ctx.fillRect(0, 0, width, height);
      
      // Grid
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
          const y = (priceH / 5) * i;
          ctx.moveTo(0, y); ctx.lineTo(width, y);
      }
      ctx.moveTo(0, volY); ctx.lineTo(width, volY);
      ctx.stroke();

      // --- DRAW CANDLES ---
      let hovered: Candle | null = null;

      for (let i = startIndex; i < endIndex; i++) {
          const c = allData[i];
          // X Calculation: Aligned to right edge, shifted by offset
          const x = width - (total - 1 - i) * candleUnit + offset - (scale/2);
          
          // Double check visibility
          if (x < -scale || x > width + scale) continue;

          // Hit Test
          if (hoverX >= x - scale/2 && hoverX <= x + scale + scale/2) {
              hovered = c;
          }

          const isGreen = c.close >= c.open;
          const color = isGreen ? '#22c55e' : '#ef4444';
          
          // Volume
          const vH = getVolHeight(c.vol);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x, height - vH, scale, vH);
          ctx.globalAlpha = 1.0;

          // Wick
          const yHigh = getPriceY(c.high);
          const yLow = getPriceY(c.low);
          const center = x + scale / 2;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(center, yHigh);
          ctx.lineTo(center, yLow);
          ctx.stroke();

          // Body
          const yOpen = getPriceY(c.open);
          const yClose = getPriceY(c.close);
          const bodyY = Math.min(yOpen, yClose);
          const bodyH = Math.max(Math.abs(yOpen - yClose), 1);
          
          ctx.fillStyle = color;
          ctx.fillRect(x, bodyY, scale, bodyH);
      }

      // --- POSITIONS ---
      positions.forEach(pos => {
          const y = getPriceY(pos.entryPrice);
          if (y >= 0 && y <= priceH) {
              ctx.strokeStyle = '#3b82f6';
              ctx.setLineDash([4, 4]);
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = '#3b82f6';
              ctx.font = '10px sans-serif';
              ctx.fillText(`${pos.leverage}x`, 5, y - 4);
          }
      });

      // --- CURRENT PRICE ---
      const currY = getPriceY(gameRef.current.price);
      if (currY >= 0 && currY <= priceH) {
          ctx.strokeStyle = '#fff';
          ctx.setLineDash([2, 2]);
          ctx.beginPath(); ctx.moveTo(0, currY); ctx.lineTo(width, currY); ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = '#222';
          ctx.fillRect(width - 60, currY - 10, 60, 20);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'right';
          ctx.fillText(gameRef.current.price.toFixed(2), width - 5, currY + 4);
          ctx.textAlign = 'left';
      }

      // --- CROSSHAIR & TOOLTIP ---
      if (hovered && hoverX > 0 && hoverY > 0 && hoverY < height) {
          const cx = width - (allData.length - 1 - allData.indexOf(hovered)) * candleUnit + offset;
          
          // Crosshair
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
          ctx.moveTo(0, hoverY); ctx.lineTo(width, hoverY);
          ctx.stroke();
          ctx.setLineDash([]);

          // --- SMART TOOLTIP POSITIONING ---
          const dateStr = new Date(hovered.time).toLocaleTimeString();
          const infoLines = [
              `T: ${dateStr}`,
              `O: ${hovered.open.toFixed(2)}`,
              `H: ${hovered.high.toFixed(2)}`,
              `L: ${hovered.low.toFixed(2)}`,
              `C: ${hovered.close.toFixed(2)}`,
              `V: ${hovered.vol.toFixed(2)}`
          ];

          const boxW = 110;
          const boxH = 95;
          
          // Default: Right of cursor
          let boxX = hoverX + 15;
          let boxY = hoverY + 15;

          // 1. Avoid Right Edge
          if (boxX + boxW > width) {
              boxX = hoverX - boxW - 15;
          }
          
          // 2. Avoid Bottom Edge
          if (boxY + boxH > height) {
              boxY = hoverY - boxH - 15;
          }
          
          // 3. Avoid Top Left Overlap (Where Source Selector UI is)
          // Selector is approx at (8, 8) with size ~100x30
          if (boxX < 130 && boxY < 50) {
              // If overlapping top-left, push it down below the selector area
              boxY = Math.max(boxY, 50);
          }

          // Draw Box
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.strokeStyle = '#444';
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Draw Text
          ctx.font = '10px monospace';
          infoLines.forEach((line, i) => {
              // Color Close price based on trend
              const isColor = (i===4 && hovered!.close >= hovered!.open) ? '#22c55e' : (i===4) ? '#ef4444' : '#ccc';
              ctx.fillStyle = isColor;
              ctx.fillText(line, boxX + 10, boxY + 18 + i * 14);
          });
      }
  };

  const loop = () => {
    gameRef.current.animationId = requestAnimationFrame(loop);
    
    // Connection watchdog
    const now = Date.now();
    if (isConnected && gameRef.current.lastMessageTime > 0 && now - gameRef.current.lastMessageTime > 5000) {
        if (gameRef.current.ws) gameRef.current.ws.close();
        gameRef.current.lastMessageTime = 0;
    }

    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderCanvas(ctx);
    }
  };

  // Helper to calc live PnL for list
  const getPnL = (pos: TradingPosition) => {
      const price = currentPrice;
      const exitPrice = price; 

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

  // --- TRADING LOGIC ACTIONS (Redundant decls removed in this clean version, used inline) ---
  const openPosition = async (type: 'LONG' | 'SHORT') => {
      if (!userProfile) return;
      if (isTransactionPending) return;
      if (gameRef.current.price === 0) {
          showNotif("等待价格数据...", 'info');
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
        const success = await deductCredit(userProfile.uid, margin);
        if (!success) { showNotif("交易失败", 'loss'); return; }
        
        setCredits(prev => prev - margin);
        refreshProfile();

        const currentMarketPrice = gameRef.current.price;
        const newPos: TradingPosition = {
            id: Date.now(),
            type,
            entryPrice: currentMarketPrice,
            margin,
            leverage,
            size: margin * leverage,
            liquidationPrice: type === 'LONG' 
                ? currentMarketPrice * (1 - (1/leverage) * 0.9) 
                : currentMarketPrice * (1 + (1/leverage) * 0.9),
            timestamp: Date.now()
        };

        gameRef.current.positions.unshift(newPos);
        setActivePositions([...gameRef.current.positions]);
        
        // Save
        updateTradingPositions(userProfile.uid, gameRef.current.positions);
        
        audio.playShoot();
        showNotif(`${leverage}x 开仓!`, 'info');
      } catch (e) {
          console.error(e);
          showNotif("系统错误", 'loss');
      } finally {
          setIsTransactionPending(false);
      }
  };

  const closePosition = async (id: number) => {
      if (!userProfile) return;
      if (closingIds.has(id)) return;
      setClosingIds(prev => { const next = new Set(prev); next.add(id); return next; });
      try {
          const posIndex = gameRef.current.positions.findIndex(p => p.id === id);
          if (posIndex === -1) return;
          const pos = gameRef.current.positions[posIndex];
          const { pnlValue } = getPnL(pos);
          const returnAmount = pos.margin + pnlValue;

          if (returnAmount > 0) await deductCredit(userProfile.uid, -returnAmount); 
          
          try {
              gameRef.current.currentCumulativePnL += pnlValue;
              await saveScore(userProfile, 'moon_doom', Math.floor(gameRef.current.currentCumulativePnL));
              setCumulativePnL(Math.floor(gameRef.current.currentCumulativePnL));
          } catch (e) { console.error(e); }

          setCredits(prev => Math.max(0, prev + returnAmount));
          refreshProfile();
          
          if (pnlValue > 0) { audio.playScore(); showNotif(`止盈! +${pnlValue} 蜂蜜`, 'win'); } 
          else { audio.playStep(); showNotif(`止损! ${pnlValue} 蜂蜜`, 'loss'); }

          gameRef.current.positions.splice(posIndex, 1);
          setActivePositions([...gameRef.current.positions]);
          
          // Save
          updateTradingPositions(userProfile.uid, gameRef.current.positions);

          onGameOver();
      } catch (error) { console.error(error); } 
      finally { setClosingIds(prev => { const next = new Set(prev); next.delete(id); return next; }); }
  };

  const liquidatePosition = async (pos: TradingPosition, index: number) => {
      if (index > -1 && gameRef.current.positions[index]?.id === pos.id) {
          gameRef.current.positions.splice(index, 1);
          setActivePositions([...gameRef.current.positions]);
          audio.playGameOver();
          showNotif(`爆仓! -${pos.margin} 蜂蜜`, 'liq');
          if (userProfile) {
              gameRef.current.currentCumulativePnL -= pos.margin;
              saveScore(userProfile, 'moon_doom', Math.floor(gameRef.current.currentCumulativePnL));
              setCumulativePnL(Math.floor(gameRef.current.currentCumulativePnL));
              
              // Save
              updateTradingPositions(userProfile.uid, gameRef.current.positions);
              
              onGameOver();
          }
      }
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
        
        {/* Status Indicator & Manual Selector */}
        <div className="absolute top-2 left-2 z-10 flex gap-2 pointer-events-none">
            <div className="relative pointer-events-auto">
                <button 
                    onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}
                    className={`flex items-center gap-1.5 text-[10px] font-bold bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 hover:bg-black/80 transition-all ${isConnected ? 'text-green-400' : 'text-orange-400'}`}
                >
                    {isConnected ? <Wifi size={12}/> : <Globe size={12} className="animate-spin"/>}
                    <span>{sourceName} (1m)</span>
                    <ChevronDown size={12} className={`transition-transform ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown Menu */}
                {isSourceMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden shadow-xl w-32 flex flex-col z-20 animate-in fade-in zoom-in duration-200">
                        <div className="text-[9px] text-neutral-500 font-bold uppercase px-3 py-2 bg-black/20">Select Source</div>
                        {SOURCES.map((src, idx) => (
                            <button
                                key={src.name}
                                onClick={() => {
                                    connectToSource(idx);
                                    setIsSourceMenuOpen(false);
                                }}
                                className={`px-3 py-2.5 text-left text-[10px] font-bold hover:bg-white/10 flex justify-between items-center border-b border-white/5 last:border-0 ${sourceName === src.name ? 'text-brand-yellow bg-white/5' : 'text-neutral-400'}`}
                            >
                                {src.name}
                                {sourceName === src.name && <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow shadow-[0_0_5px_#fbbf24]"></div>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1 pointer-events-auto">
            <button onClick={() => handleZoom(-2)} className="bg-black/60 text-white p-1.5 rounded-lg border border-white/10 hover:bg-black/80"><Minus size={12}/></button>
            <button onClick={() => handleZoom(2)} className="bg-black/60 text-white p-1.5 rounded-lg border border-white/10 hover:bg-black/80"><Plus size={12}/></button>
        </div>

        <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT} 
            className="w-full h-auto block cursor-crosshair touch-none"
            onMouseDown={(e) => { gameRef.current.isDragging = true; gameRef.current.lastDragX = e.clientX; }}
            onMouseMove={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                gameRef.current.hoverX = e.clientX - rect.left;
                gameRef.current.hoverY = e.clientY - rect.top;
                
                if (gameRef.current.isDragging) {
                    const dx = e.clientX - gameRef.current.lastDragX;
                    gameRef.current.offset += dx;
                    gameRef.current.lastDragX = e.clientX;
                }
            }}
            onMouseUp={() => { gameRef.current.isDragging = false; }}
            onMouseLeave={() => { gameRef.current.isDragging = false; gameRef.current.hoverX = -1; }}
            onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -2 : 2;
                handleZoom(delta);
            }}
            onTouchStart={(e) => {
                gameRef.current.isDragging = true;
                gameRef.current.lastDragX = e.touches[0].clientX;
                const rect = canvasRef.current?.getBoundingClientRect();
                if(rect) {
                    gameRef.current.hoverX = e.touches[0].clientX - rect.left;
                    gameRef.current.hoverY = e.touches[0].clientY - rect.top;
                }
            }}
            onTouchMove={(e) => {
                const touch = e.touches[0];
                const dx = touch.clientX - gameRef.current.lastDragX;
                gameRef.current.offset += dx;
                gameRef.current.lastDragX = touch.clientX;
                
                const rect = canvasRef.current?.getBoundingClientRect();
                if(rect) {
                    gameRef.current.hoverX = touch.clientX - rect.left;
                    gameRef.current.hoverY = touch.clientY - rect.top;
                }
            }}
            onTouchEnd={() => { gameRef.current.isDragging = false; }}
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
                <h3 className="text-xl font-bold mb-2 text-white">需要登录</h3>
                <p className="text-sm text-neutral-400 mb-4">登录后即可体验全真模拟合约交易</p>
            </div>
        )}
      </div>
      
      {/* Risk Warning */}
      <div className="w-full bg-red-900/30 border border-red-500/30 rounded-lg p-2 flex items-start gap-2 text-[10px] text-red-300">
         <AlertCircle size={12} className="mt-0.5 shrink-0"/>
         <span>真实行情模式 | 免手续费 | 高风险提示：请谨慎控制杠杆。</span>
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
                      <span>1x</span><span>100x</span><span>500x</span><span className="text-red-500">1000x</span>
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

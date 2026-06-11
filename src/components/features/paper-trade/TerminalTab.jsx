import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { useSymbolSearch } from '../../../hooks/useSymbolSearch'
import { INR } from '../../../lib/utils'
import { Search, Loader2, Minus, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { LOT_SIZES } from '../../../lib/constants'

const INDEX_CONFIG = {
  'NIFTY': { name: 'NIFTY 50', tv: 'NSE:NIFTY', yf: '^NSEI', step: 50 },
  'BANKNIFTY': { name: 'BANKNIFTY', tv: 'NSE:BANKNIFTY', yf: '^NSEBANK', step: 100 },
  'SENSEX': { name: 'SENSEX', tv: 'BSE:SENSEX', yf: '^BSESN', step: 100 }
}

// ── TradingView Chart Widget ───────────────────────────────────────────────
let tvScriptLoadingPromise

function TerminalChart({ symbol }) {
  const onLoadScriptRef = useRef()
  const containerId = 'tv_terminal_chart'

  useEffect(() => {
    onLoadScriptRef.current = createWidget
    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script')
        script.id = 'tradingview-widget-loading-script'
        script.src = 'https://s3.tradingview.com/tv.js'
        script.type = 'text/javascript'
        script.onload = resolve
        document.head.appendChild(script)
      })
    }
    tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current())
    return () => { onLoadScriptRef.current = null }
  }, [])

  useEffect(() => {
    if (window.TradingView && window.TradingView.widget) {
      createWidget()
    }
  }, [symbol])

  function createWidget() {
    if (!document.getElementById(containerId) || !window.TradingView) return
    new window.TradingView.widget({
      autosize: true,
      symbol: symbol,
      interval: '5',
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: 'rgba(11, 13, 18, 1)', // match var(--bg-body)
      gridColor: 'rgba(255, 255, 255, 0.05)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: containerId,
      toolbar_bg: 'rgba(11, 13, 18, 1)',
    })
  }

  return (
    <div className="w-full h-full border border-border rounded-lg overflow-hidden bg-bg-body">
      <div id={containerId} className="w-full h-full" />
    </div>
  )
}

// ── Mock Options Chain & Order Panel ──────────────────────────────────────────
export default function TerminalTab({ onTradeAdded, availableCapital }) {
  const { user } = useAuth()
  
  // Terminal State
  const [index, setIndex] = useState('NIFTY')
  const [spotPrice, setSpotPrice] = useState(22400) // Mock initial
  const [strikes, setStrikes] = useState([])
  
  // Selected Contract for Order Box
  const [selectedContract, setSelectedContract] = useState(null)
  const [qty, setQty] = useState(LOT_SIZES['NIFTY'])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const activeConfig = INDEX_CONFIG[index]

  // Live Spot Fetching (using our safe yfinance proxy)
  useEffect(() => {
    let isMounted = true
    const fetchSpot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yfinance-proxy?ticker=${encodeURIComponent(activeConfig.yf)}&period1=${Math.floor(Date.now()/1000 - 86400)}&period2=${Math.floor(Date.now()/1000)}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
        const data = await res.json()
        const chart = data?.chart?.result?.[0]
        if (chart?.meta?.regularMarketPrice && isMounted) {
          const currentSpot = chart.meta.regularMarketPrice
          setSpotPrice(currentSpot)
          
          // Generate 5 strike prices around ATM
          const step = activeConfig.step
          const atm = Math.round(currentSpot / step) * step
          setStrikes([atm - step*2, atm - step, atm, atm + step, atm + step*2])
        }
      } catch (e) {
        // silently fail or retry
      }
    }
    fetchSpot()
    const interval = setInterval(fetchSpot, 10000) // Every 10s
    return () => { isMounted = false; clearInterval(interval) }
  }, [index])

  // Mock Option Premium Calc
  // A very simplified mock logic for paper trading. ATM = ~100. ITM increases linearly. OTM decreases.
  const calcPremium = (strike, type, spot) => {
    let intrinsic = 0
    if (type === 'CE') intrinsic = Math.max(0, spot - strike)
    if (type === 'PE') intrinsic = Math.max(0, strike - spot)
    const timeValue = Math.max(0, 100 - Math.abs(spot - strike) / 2) // Fake time/volatility value
    return Math.max(0.5, intrinsic + timeValue).toFixed(2)
  }

  const handleSelectContract = (strike, type) => {
    const lotSize = LOT_SIZES[index]
    const name = index
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + (4 - expiry.getDay() + 7) % 7 || 7) // Next Thursday roughly
    const expiryStr = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    
    setQty(lotSize)
    setSelectedContract({
      symbol: `${name} ${expiryStr} ${strike} ${type}`,
      underlying: index,
      strike,
      type,
      lotSize
    })
  }

  const handlePlaceOrder = async (tradeType) => {
    if (!selectedContract) return
    const price = calcPremium(selectedContract.strike, selectedContract.type, spotPrice)
    const orderCost = Number(price) * qty
    if (availableCapital !== undefined && orderCost > availableCapital) {
      toast.error(`Insufficient capital. Order costs ${INR(orderCost)} but only ${INR(availableCapital)} available.`)
      return
    }
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.from('paper_trades').insert({
        user_id: user.id,
        symbol: selectedContract.symbol,
        trade_type: tradeType,
        instrument: selectedContract.type === 'CE' || selectedContract.type === 'PE' ? 'option' : 'futures',
        quantity: qty,
        entry_price: Number(price),
        status: 'open',
        notes: 'Terminal Mock Option Trade'
      }).select().single()

      if (error) throw error
      toast.success(`Placing ${tradeType.toUpperCase()} order for ${selectedContract.symbol}`)
      setSelectedContract(null)
      if (onTradeAdded) onTradeAdded()
    } catch (e) {
      toast.error('Failed to place order: ' + e.message)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4 fade-in">
      {/* LEFT: Trading View Chart */}
      <div className="flex-1 min-w-[60%] flex flex-col">
        <div className="flex gap-2 mb-3">
          {Object.entries(INDEX_CONFIG).map(([key, config]) => (
            <button 
              key={key}
              className={`btn btn-sm ${index === key ? 'bg-accent/20 text-accent border-accent/30 shadow-[0_0_15px_rgba(96,165,250,0.15)]' : 'bg-black/20 text-text-muted hover:text-white'}`} 
              onClick={() => { setIndex(key); setQty(LOT_SIZES[key]); setSelectedContract(null); }}
            >
              {config.name}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 px-4 py-1.5 glass-panel !rounded-full !py-1 !px-3 shadow-[0_0_10px_rgba(255,255,255,0.02)]">
            <span className="text-[10px] text-text-muted font-bold tracking-widest">SPOT</span> 
            <span className="font-mono font-bold text-white tracking-tight">{spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="flex-1">
          <TerminalChart symbol={activeConfig.tv} />
        </div>
      </div>

      {/* RIGHT: Options Chain & Order Panel */}
      <div className="w-[380px] flex flex-col gap-4">
        {/* Mock Options Chain */}
        <div className="flex-1 glass-panel flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
          <div className="p-3 border-b border-white/5 bg-black/40 backdrop-blur-md flex justify-between items-center z-10">
            <h3 className="font-head font-bold tracking-tight text-white text-sm flex items-center gap-2">
              <span className="opacity-80">⛓️</span> Options Chain
            </h3>
            <span className="text-[9px] font-mono tracking-widest text-accent uppercase bg-accent/10 px-2 py-0.5 rounded border border-accent/20">Mock UI</span>
          </div>
          
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Header */}
            <div className="grid grid-cols-3 text-[10px] tracking-widest font-bold text-text-muted border-b border-white/5 p-2 bg-black/60 sticky top-0 z-10 backdrop-blur-md">
              <div className="text-left pl-2">CALLS</div>
              <div className="text-center text-white/50">STRIKE</div>
              <div className="text-right pr-2">PUTS</div>
            </div>
            
            {/* Rows */}
            {strikes.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs flex justify-center"><Loader2 className="animate-spin w-4 h-4 text-accent"/></div>
            ) : (
              strikes.map((strike, i) => {
                const cePrice = calcPremium(strike, 'CE', spotPrice)
                const pePrice = calcPremium(strike, 'PE', spotPrice)
                const isAtm = Math.abs(strike - spotPrice) < activeConfig.step
                
                return (
                  <div key={strike} className={`grid grid-cols-3 text-[13px] font-mono border-b border-white/5 hover:bg-white/5 transition-colors ${isAtm ? 'bg-accent/5 shadow-[inset_0_0_20px_rgba(96,165,250,0.05)]' : ''}`}>
                    <div 
                      className={`p-2.5 text-left cursor-pointer transition-colors ${spotPrice > strike ? 'text-green drop-shadow-[0_0_5px_rgba(52,211,153,0.3)] bg-green/5 hover:bg-green/10' : 'text-text hover:text-white'}`}
                      onClick={() => handleSelectContract(strike, 'CE')}
                    >
                      {cePrice}
                    </div>
                    <div className="p-2.5 text-center bg-black/40 mx-0.5 border-x border-white/5 text-white font-bold relative flex items-center justify-center">
                      {isAtm && <div className="absolute left-1 w-1 h-3/4 bg-accent/50 rounded-full"></div>}
                      {strike}
                    </div>
                    <div 
                      className={`p-2.5 text-right cursor-pointer transition-colors ${spotPrice < strike ? 'text-red drop-shadow-[0_0_5px_rgba(248,113,113,0.3)] bg-red/5 hover:bg-red/10' : 'text-text hover:text-white'}`}
                      onClick={() => handleSelectContract(strike, 'PE')}
                    >
                      {pePrice}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Order Panel */}
        {selectedContract ? (
          <div className="glass-panel border-l-[4px] border-l-accent p-5 relative overflow-hidden animate-in slide-in-from-bottom-2 fade-in group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-accent/20 transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div>
                <div className="font-head font-bold text-[16px] text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{selectedContract.symbol}</div>
                <div className="text-[11px] font-mono text-text-dim mt-1">LOT SIZE: <span className="text-white">{selectedContract.lotSize}</span></div>
              </div>
              <button 
                className="text-text-dim hover:text-white transition-colors bg-white/5 hover:bg-white/10 w-6 h-6 rounded-full flex items-center justify-center"
                onClick={() => setSelectedContract(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="flex justify-between items-center bg-black/40 p-3.5 rounded-lg border border-white/5 shadow-inner mb-5 relative z-10">
              <div className="text-[10px] font-bold tracking-widest text-text-muted">LIVE PRICE</div>
              <div className="font-mono font-bold text-[18px] text-accent drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">
                {INR(calcPremium(selectedContract.strike, selectedContract.type, spotPrice))}
              </div>
            </div>

            <div className="mb-5 relative z-10">
              <label className="text-[10px] font-bold tracking-widest text-text-muted mb-2 block">QUANTITY</label>
              <div className="flex gap-2">
                <button 
                  className="w-11 h-11 flex items-center justify-center bg-black/40 border border-white/5 rounded-md hover:bg-white/5 transition-colors text-text-muted hover:text-white"
                  onClick={() => setQty(Math.max(selectedContract.lotSize, qty - selectedContract.lotSize))}
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  value={qty}
                  readOnly
                  className="flex-1 bg-black/20 border border-white/5 rounded-md text-center font-bold font-mono text-[16px] text-white shadow-inner" 
                />
                <button 
                  className="w-11 h-11 flex items-center justify-center bg-black/40 border border-white/5 rounded-md hover:bg-white/5 transition-colors text-text-muted hover:text-white"
                  onClick={() => setQty(qty + selectedContract.lotSize)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="text-[10px] font-mono text-text-dim mt-1.5 text-center">LOTS: {qty / selectedContract.lotSize}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
              <button 
                onClick={() => handlePlaceOrder('buy')}
                disabled={isSubmitting}
                className="btn !bg-green !text-black border-transparent hover:!bg-[#34d399] flex justify-center w-full py-3 shadow-[0_0_20px_rgba(52,211,153,0.2)] hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] transition-all font-bold tracking-widest text-[12px]"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'BUY'}
              </button>
              <button 
                onClick={() => handlePlaceOrder('sell')}
                disabled={isSubmitting}
                className="btn !bg-red !text-white border-transparent hover:!bg-[#f87171] flex justify-center w-full py-3 shadow-[0_0_20px_rgba(248,113,113,0.2)] hover:shadow-[0_0_30px_rgba(248,113,113,0.4)] transition-all font-bold tracking-widest text-[12px]"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'SELL'}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-[240px] glass-panel border-dashed border-white/10 flex flex-col items-center justify-center p-6 text-center text-text-muted">
            <span className="text-3xl mb-3 opacity-80 filter drop-shadow-md">🖱️</span>
            <span className="text-[12px] font-bold tracking-widest text-text mb-2">NO CONTRACT SELECTED</span>
            <span className="text-[11px] leading-relaxed max-w-[200px]">Click on any Call (CE) or Put (PE) premium in the Options Chain above to open the order panel.</span>
          </div>
        )}
      </div>
    </div>
  )
}

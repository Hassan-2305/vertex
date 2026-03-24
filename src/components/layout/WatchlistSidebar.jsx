import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { INR } from '../../lib/utils'
import toast from 'react-hot-toast'
import { BellRing, BellOff, Loader2, Plus, X, AlertTriangle } from 'lucide-react'

// Fetch live price from Yahoo Finance
async function fetchLivePrice(symbol) {
  try {
    const ticker = symbol.includes('.') || symbol.startsWith('^') ? symbol : `${symbol}.NS`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null
  } catch {
    return null
  }
}

// ── Search stocks + Live quotes ───────────────────────────────────────────────
const SEARCH_CACHE = new Map()

async function searchWithQuotes(query, signal) {
  if (!query || query.length < 2) return []
  const key = query.trim().toLowerCase()
  if (SEARCH_CACHE.has(key)) return SEARCH_CACHE.get(key)
  try {
    // 1. Search for matching symbols
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-IN&region=IN&quotesCount=6&newsCount=0`
    const searchRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(searchUrl)}`, { signal })
    const searchData = await searchRes.json()
    const matches = (searchData?.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' && (q.exchange === 'NSI' || q.exchange === 'BSE' || q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO')))
      .slice(0, 5)

    if (!matches.length) return []

    // 2. Fetch live prices via v8 charting (since v7 quotes API is blocked)
    const results = await Promise.all(matches.map(async (q) => {
      let price = null
      let changePercent = 0
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(q.symbol)}?interval=1d&range=1d`
        const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal })
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta
        if (meta && meta.regularMarketPrice && meta.chartPreviousClose) {
          price = meta.regularMarketPrice
          changePercent = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        }
      } catch (err) {
        // ignore individual chart fail
      }
      return {
        symbol: q.symbol,
        ticker: q.symbol.replace(/\.(NS|BO)$/, ''),
        name: q.longName || q.shortName || q.symbol,
        exchange: q.exchange === 'NSI' ? 'NSE' : 'BSE',
        price,
        changePercent
      }
    }))
    
    SEARCH_CACHE.set(key, results)
    return results
  } catch (e) {
    if (e.name === 'AbortError') return null
    return []
  }
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function WatchlistSidebar() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [prices, setPrices] = useState({})
  
  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [targetType, setTargetType] = useState('above') // 'above' | 'below'
  const [targetPrice, setTargetPrice] = useState('')
  const [adding, setAdding] = useState(false)

  // Live search state
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchTerm = useDebounce(newSymbol, 300)

  useEffect(() => {
    if (debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    const ctrl = new AbortController()
    setIsSearching(true)
    searchWithQuotes(debouncedSearchTerm, ctrl.signal).then(res => {
      if (res !== null) {
        setSearchResults(res)
        setIsSearching(false)
      }
    })
    return () => ctrl.abort()
  }, [debouncedSearchTerm])

  const loadWatchlist = async () => {
    const { data } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      
    if (data) setItems(data)
    setLoading(false)
    return data || []
  }

  // Initial load
  useEffect(() => {
    if (user?.id) loadWatchlist()
  }, [user?.id])

  // Poll prices and check alerts every 60s
  useEffect(() => {
    if (!items.length) return
    let isMounted = true

    const poll = async () => {
      const symbols = [...new Set(items.map(i => i.symbol))]
      const newPrices = { ...prices }
      let alertTriggered = false

      for (const sym of symbols) {
        const p = await fetchLivePrice(sym)
        if (p !== null) newPrices[sym] = p
      }

      if (!isMounted) return
      setPrices(newPrices)

      // Check alerts
      items.forEach(async (item) => {
        if (!item.is_active || !newPrices[item.symbol]) return

        const currentPrice = newPrices[item.symbol]
        const target = Number(item.target_price)
        let hit = false

        if (item.target_type === 'above' && currentPrice >= target) hit = true
        if (item.target_type === 'below' && currentPrice <= target) hit = true

        if (hit) {
          alertTriggered = true
          toast.custom((t) => (
            <div className={`bg-bg-card border-l-4 border-l-amber p-4 rounded-lg shadow-xl flex items-start gap-3 w-80 max-w-full ${t.visible ? 'animate-in slide-in-from-right fade-in' : 'animate-out fade-out'}`}>
              <BellRing className="w-5 h-5 text-amber shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-head font-semibold text-text mb-1">Price Alert: {item.symbol}</h4>
                <p className="text-sm text-text-muted">Target {item.target_type} {INR(target)} hit!</p>
                <p className="text-xl font-medium text-text mt-2">{INR(currentPrice)}</p>
              </div>
            </div>
          ), { duration: 8000 })
          
          // Disable alert in DB so it doesn't fire constantly
          await supabase.from('watchlists').update({ is_active: false }).eq('id', item.id)
        }
      })

      if (alertTriggered) loadWatchlist() // refresh list to show disabled alerts
    }

    poll() // Fire immediately
    const interval = setInterval(poll, 60000) // Then every 60s
    return () => { isMounted = false; clearInterval(interval) }
  }, [items]) // Re-run effect when items array changes (so new items get polled)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newSymbol.trim() || !targetPrice) return
    setAdding(true)
    
    // Test if symbol is valid (fetch preview price)
    const p = await fetchLivePrice(newSymbol.trim().toUpperCase())
    if (p === null) {
      toast.error('Invalid symbol or Yahoo Finance error.')
      setAdding(false)
      return
    }

    const { error } = await supabase.from('watchlists').insert({
      user_id: user.id,
      symbol: newSymbol.trim().toUpperCase(),
      target_price: Number(targetPrice),
      target_type: targetType,
      is_active: true
    })

    if (error) {
      console.error("Watchlist Add Error:", error)
      toast.error('Failed to set alert: ' + error.message)
    } else {
      toast.success(`Alert set for ${newSymbol.toUpperCase()}`)
      setNewSymbol('')
      setTargetPrice('')
      setShowAdd(false)
      loadWatchlist() // Reload
      // Pre-fill price cache
      setPrices(prev => ({ ...prev, [newSymbol.trim().toUpperCase()]: p }))
    }
    setAdding(false)
  }

  const removeAlert = async (id) => {
    await supabase.from('watchlists').delete().eq('id', id)
    loadWatchlist()
  }

  const toggleAlert = async (id, currentStatus) => {
    await supabase.from('watchlists').update({ is_active: !currentStatus }).eq('id', id)
    loadWatchlist()
  }

  return (
    <div className="w-[280px] bg-[#04080c] border-l border-white/5 flex flex-col shrink-0">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/[0.03] to-transparent">
        <div>
          <h3 className="font-head font-semibold text-text text-[15px] flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
            <BellRing className="w-4 h-4 text-accent" /> Watchlist Alerts
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5 tracking-wide">LIVE NSE/BSE TRACKER</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 flex items-center justify-center bg-accent/10 text-accent rounded-md hover:bg-accent hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(56,189,248,0.1)] hover:shadow-[0_0_15px_rgba(56,189,248,0.4)]"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-border bg-bg-elevated/50 animate-in slide-in-from-top-2">
          <div className="space-y-3">
            <div style={{ position: 'relative' }}>
              <label className="text-[11px] mb-1 block">Symbol Search</label>
              <div className="relative">
                 <input 
                   placeholder="e.g. RELIANCE, TCS" 
                   value={newSymbol} 
                   onChange={e => {
                     setNewSymbol(e.target.value)
                     if (e.target.value.length < 2) setSearchResults([])
                   }} 
                   className="h-8 text-xs w-full px-3 bg-black/40 border border-white/10 rounded-md focus:border-accent focus:shadow-[inset_0_0_15px_rgba(56,189,248,0.1)] outline-none transition-all text-white font-mono"
                   required 
                   autoComplete="off"
                 />
                 {isSearching && <Loader2 className="absolute right-2 top-2.5 w-3 h-3 animate-spin text-accent" />}
              </div>
              {/* Dropdown Results */}
              {searchResults.length > 0 && newSymbol.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                  {searchResults.map(s => {
                    const isUp = s.changePercent >= 0
                    return (
                      <button
                        key={s.symbol}
                        type="button"
                        onClick={() => {
                          setNewSymbol(s.ticker)
                          setSearchResults([])
                        }}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-bg-elevated border-b border-border transition-colors group"
                      >
                        <div className="overflow-hidden">
                          <div className="font-head text-xs font-semibold text-text flex items-center gap-1.5">
                            {s.ticker} <span className="text-[9px] text-text-muted bg-bg px-1 rounded">{s.exchange}</span>
                          </div>
                          <div className="text-[10px] text-text-muted truncate mt-0.5">{s.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-mono text-text">₹{s.price?.toLocaleString('en-IN') || '--'}</div>
                          <div className={`text-[10px] font-mono ${isUp ? 'text-green' : 'text-red'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(s.changePercent || 0).toFixed(2)}%
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <div>
                <label className="text-[11px]">Condition</label>
                <select 
                  value={targetType} 
                  onChange={e => setTargetType(e.target.value)}
                  className="h-8 text-xs p-[0_8px]"
                >
                  <option value="above">≥</option>
                  <option value="below">≤</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] mb-1 block">Target Price (₹)</label>
                <input 
                  type="number" 
                  step="0.05"
                  placeholder="3200.00" 
                  value={targetPrice} 
                  onChange={e => setTargetPrice(e.target.value)} 
                  className="h-8 text-xs font-mono w-full px-2 bg-black/40 border border-white/10 rounded-md outline-none focus:border-accent focus:shadow-[inset_0_0_15px_rgba(56,189,248,0.1)] transition-all text-white"
                  required 
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={adding}
              className="w-full btn btn-primary py-1.5 justify-center text-xs h-8"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set Alert'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-text-muted animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-text-dim mx-auto mb-3" />
            <p className="text-sm text-text-muted">No alerts set.</p>
            <p className="text-[11px] text-text-dim mt-1">Add symbols to get notified.</p>
          </div>
        ) : (
          items.map(item => {
            const currentPrice = prices[item.symbol]
            const isHit = !item.is_active // Assuming if it's inactive it was hit/disabled
            const target = Number(item.target_price)
            
            // Calculate distance to target
            let progress = 0
            if (currentPrice) {
              const distance = Math.abs(currentPrice - target)
              const spread = currentPrice * 0.1 // Assume 10% spread for progress bar
              progress = Math.max(0, Math.min(100, 100 - (distance / spread * 100)))
            }

            return (
              <div key={item.id} className={`p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${isHit ? 'bg-black/30 border-white/5 opacity-60' : 'bg-black/40 border-white/10 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'}`}>
                {/* Background progress bar */}
                {item.is_active && progress > 0 && (
                  <div className="absolute bottom-0 left-0 h-1 bg-accent/20 rounded-b-xl overflow-hidden w-full">
                    <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${progress}%` }} />
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-2">
                  <div className="font-head font-semibold text-text text-sm">
                    {item.symbol}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => toggleAlert(item.id, item.is_active)}
                      className="p-1 rounded hover:bg-bg-card text-text-muted transition-colors"
                      title={item.is_active ? "Disable alert" : "Re-enable alert"}
                    >
                      {item.is_active ? <BellOff className="w-3.5 h-3.5" /> : <BellRing className="w-3.5 h-3.5 text-accent" />}
                    </button>
                    <button 
                      onClick={() => removeAlert(item.id)}
                      className="p-1 rounded hover:bg-red-dim hover:text-red text-text-muted transition-colors"
                      title="Delete alert"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Live Price</div>
                    <div className="font-mono text-[14px] font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                      {currentPrice ? INR(currentPrice) : <span className="text-text-dim text-xs">Loading...</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Target</div>
                    <div className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${isHit ? 'bg-bg-card border-white/10 text-text-muted' : 'bg-accent/10 border-accent/30 text-accent drop-shadow-[0_0_5px_rgba(56,189,248,0.3)]'}`}>
                      {item.target_type === 'above' ? '≥' : '≤'} {INR(target)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

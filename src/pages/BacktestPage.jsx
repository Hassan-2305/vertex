import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { runCustomBacktest } from '../lib/ruleEvaluator.js'
import { useSymbolSearch } from '../hooks/useSymbolSearch'
import { Search, Loader2, Play, CheckCircle, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react'

const STRATEGIES = [
  { id: 'ema_cross', name: 'EMA Crossover', desc: 'Buy when 9 EMA crosses above 21 EMA' },
  { id: 'rsi_reversal', name: 'RSI Reversal', desc: 'Buy RSI < 30, sell RSI > 70' },
  { id: 'macd', name: 'MACD Signal', desc: 'Buy on MACD bullish crossover' },
  { id: 'bb_breakout', name: 'Bollinger Breakout', desc: 'Buy above upper band breakout' },
]

// Indicator calculation functions
function calcEMA(data, period) {
  const k = 2 / (period + 1)
  let ema = data[0]
  return data.map(v => { ema = v * k + ema * (1 - k); return ema })
}

function calcRSI(data, period = 14) {
  const gains = [], losses = []
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  return gains.map((_, i) => {
    if (i < period) return 50
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period
    if (avgLoss === 0) return 100
    return 100 - (100 / (1 + avgGain / avgLoss))
  })
}

function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast)
  const emaSlow = calcEMA(data, slow)
  const macdLine = emaFast.map((v, i) => v - emaSlow[i])
  const signalLine = calcEMA(macdLine, signal)
  return { macdLine, signalLine }
}

function calcBollingerBands(data, period = 20, multiplier = 2) {
  return data.map((_, i) => {
    if (i < period) return { upper: data[i], lower: data[i], middle: data[i] }
    const slice = data.slice(i - period, i)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
    return { upper: mean + multiplier * std, lower: mean - multiplier * std, middle: mean }
  })
}

function runBacktest(stratId, prices, dates) {
  const closes = prices.map(p => p.close)
  let signals = []

  if (stratId === 'ema_cross') {
    const ema9 = calcEMA(closes, 9), ema21 = calcEMA(closes, 21)
    for (let i = 1; i < closes.length; i++) {
      if (ema9[i - 1] <= ema21[i - 1] && ema9[i] > ema21[i]) signals.push({ i, type: 'buy' })
      if (ema9[i - 1] >= ema21[i - 1] && ema9[i] < ema21[i]) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'rsi_reversal') {
    const rsi = calcRSI(closes)
    for (let i = 1; i < rsi.length; i++) {
      if (rsi[i - 1] >= 30 && rsi[i] < 30) signals.push({ i, type: 'buy' })
      if (rsi[i - 1] <= 70 && rsi[i] > 70) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'macd') {
    const { macdLine, signalLine } = calcMACD(closes)
    for (let i = 1; i < closes.length; i++) {
      if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) signals.push({ i, type: 'buy' })
      if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'bb_breakout') {
    const bands = calcBollingerBands(closes)
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] <= bands[i - 1].upper && closes[i] > bands[i].upper) signals.push({ i, type: 'buy' })
      if (closes[i - 1] >= bands[i - 1].middle && closes[i] < bands[i].middle) signals.push({ i, type: 'sell' })
    }
  }

  let capital = 100000, inPosition = false, entryPrice = 0, trades = [], equity = []
  for (let i = 0; i < closes.length; i++) {
    const sig = signals.find(s => s.i === i)
    if (sig?.type === 'buy' && !inPosition) { inPosition = true; entryPrice = closes[i] }
    if (sig?.type === 'sell' && inPosition) {
      const pnl = (closes[i] - entryPrice) / entryPrice
      capital *= (1 + pnl)
      trades.push({ entry: entryPrice, exit: closes[i], pnl, date: dates[i] })
      inPosition = false
    }
    equity.push({ date: dates[i], value: Math.round(inPosition ? capital * (closes[i] / entryPrice) : capital) })
  }
  const wins = trades.filter(t => t.pnl > 0)
  return {
    equity, trades,
    totalReturn: ((capital - 100000) / 100000) * 100,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    totalTrades: trades.length,
    maxDrawdown: equity.length ? (() => {
      let peak = equity[0].value, maxDD = 0
      equity.forEach(e => { peak = Math.max(peak, e.value); maxDD = Math.max(maxDD, (peak - e.value) / peak * 100) })
      return maxDD
    })() : 0,
  }
}

export default function BacktestPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('preset')

  const [symbol, setSymbol] = useState('^NSEI')
  const [showSymbolSearch, setShowSymbolSearch] = useState(false)
  const { results: searchResults, isSearching } = useSymbolSearch(showSymbolSearch ? symbol : '')
  
  const [fromDate, setFromDate] = useState('2022-01-01')
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  
  const [stratId, setStratId] = useState('ema_cross')

  const [aiText, setAiText] = useState('')
  const [parsedStrategy, setParsedStrategy] = useState(null)
  const [parsing, setParsing] = useState(false)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = searchParams.get('strategy')
    const sym = searchParams.get('symbol')
    if (s && STRATEGIES.some(st => st.id === s)) {
      setStratId(s)
      setTab('preset')
    }
    if (sym) setSymbol(sym)
  }, [searchParams])

  const parseStrategy = async () => {
    if (!aiText.trim()) return
    setParsing(true); setError(''); setParsedStrategy(null); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strategy-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ mode: 'parse_strategy', text: aiText })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse strategy')
      
      const strat = data.strategy
      setParsedStrategy(strat)
      
      if (strat.symbol) setSymbol(strat.symbol)
      if (strat.fromDate) setFromDate(strat.fromDate)
      if (strat.toDate) setToDate(strat.toDate)
    } catch (err) {
      setError(err.message)
    }
    setParsing(false)
  }

  const run = async () => {
    if (tab === 'ai' && !parsedStrategy) {
      setError('Please parse your AI strategy first before running.')
      return
    }
    setLoading(true); setError(''); setResult(null)
    try {
      const ticker = symbol.trim() || '^NSEI'
      const p1 = Math.floor(new Date(fromDate)/1000)
      const p2 = Math.floor(new Date(toDate)/1000)
      
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yfinance-proxy?ticker=${encodeURIComponent(ticker)}&period1=${p1}&period2=${p2}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch historical data')
      
      const chart = data?.chart?.result?.[0]
      if (!chart) throw new Error('No data found for this symbol. Try adding .NS for NSE stocks (e.g. RELIANCE.NS)')

      const timestamps = chart.timestamp
      const closes = chart.indicators.quote[0].close
      const highs = chart.indicators.quote[0].high
      const lows = chart.indicators.quote[0].low
      const volumes = chart.indicators.quote[0].volume

      const combined = timestamps
        .map((t, i) => ({
          close: closes[i],
          high: highs?.[i],
          low: lows?.[i],
          volume: volumes?.[i],
          date: new Date(t * 1000).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        }))
        .filter(p => p.close != null && !isNaN(p.close))

      if (combined.length < 30) throw new Error('Not enough data to run a backtest. Try a longer date range.')

      const prices = combined.map(p => ({ close: p.close, high: p.high, low: p.low, volume: p.volume }))
      const dates = combined.map(p => p.date)

      let res2, stratName
      if (tab === 'ai') {
        res2 = runCustomBacktest(parsedStrategy, prices, dates)
        stratName = parsedStrategy.name || 'AI Custom Strategy'
      } else {
        res2 = runBacktest(stratId, prices, dates)
        stratName = STRATEGIES.find(s => s.id === stratId)?.name
      }
      
      setResult({ ...res2, symbol: ticker, stratName })

      await supabase.from('backtest_results').insert({
        user_id: user.id, symbol: ticker, from_date: fromDate, to_date: toDate,
        total_trades: res2.totalTrades, winning_trades: Math.round(res2.winRate / 100 * res2.totalTrades),
        win_rate: res2.winRate, total_return_pct: res2.totalReturn, max_drawdown_pct: res2.maxDrawdown,
        equity_curve: res2.equity
      })
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="h-full flex fade-in">
      {/* Left Config Panel - 380px */}
      <div className="w-[380px] shrink-0 bg-[#111118] border-r border-white/[0.07] p-5 overflow-y-auto">
        <div className="mb-5">
          <h1 className="font-head text-[22px] font-semibold text-white tracking-tight">Backtest</h1>
          <p className="text-text-muted text-[12px] mt-1">Test strategies on real NSE/BSE data</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 p-1 bg-[#0a0a0f] rounded-lg border border-white/[0.07] mb-5">
          <button 
            onClick={() => setTab('preset')} 
            className={`flex-1 py-2 px-3 text-[12px] font-medium rounded-md transition-all duration-150 ${tab === 'preset' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
          >
            Preset Strategies
          </button>
          <button 
            onClick={() => setTab('ai')} 
            className={`flex-1 py-2 px-3 text-[12px] font-medium rounded-md transition-all duration-150 ${tab === 'ai' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
          >
            AI Custom
          </button>
        </div>

        {tab === 'ai' ? (
          <div className="mb-5">
            <label className="block text-[12px] font-medium text-text-muted mb-2">Describe your strategy</label>
            <textarea
              placeholder="e.g. Buy when 9 EMA crosses above 21 EMA and RSI > 50..."
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              className="w-full h-[100px] p-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] resize-none focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
            <button 
              className="w-full mt-3 py-2.5 bg-[#18181f] border border-white/[0.07] rounded-lg text-white text-[13px] font-medium hover:bg-[#1f1f28] transition-colors flex items-center justify-center gap-2"
              onClick={parseStrategy} 
              disabled={parsing}
            >
              {parsing ? <><Loader2 size={14} className="animate-spin" /> Parsing...</> : 'Parse Rules'}
            </button>
            
            {parsedStrategy && (
              <div className="mt-4 p-3 bg-[rgba(79,142,247,0.05)] border border-[rgba(79,142,247,0.25)] rounded-lg">
                <div className="text-[13px] font-semibold text-[#4f8ef7] mb-1">{parsedStrategy.name || 'Parsed Rules'}</div>
                <div className="text-[11px] text-text-muted leading-relaxed">
                  Entry: {parsedStrategy.entry?.conditions?.length || 0} conditions | Exit: {parsedStrategy.exit?.conditions?.length || 0} conditions
                  {parsedStrategy.stopLoss && <span> | SL: {parsedStrategy.stopLoss}%</span>}
                  {parsedStrategy.takeProfit && <span> | TP: {parsedStrategy.takeProfit}%</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-[12px] font-medium text-text-muted mb-2">Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGIES.map(st => (
                <button
                  key={st.id}
                  onClick={() => setStratId(st.id)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                    stratId === st.id 
                      ? 'bg-[rgba(79,142,247,0.08)] border-[rgba(79,142,247,0.3)] shadow-[0_0_15px_rgba(79,142,247,0.1)]' 
                      : 'bg-[#0a0a0f] border-white/[0.07] hover:border-white/[0.14]'
                  }`}
                >
                  <div className={`text-[13px] font-medium mb-0.5 ${stratId === st.id ? 'text-[#4f8ef7]' : 'text-white'}`}>{st.name}</div>
                  <div className="text-[10px] text-text-muted leading-snug">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Search */}
        <div className="mb-4 relative">
          <label className="block text-[12px] font-medium text-text-muted mb-2">Symbol</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              placeholder="Search symbol..." 
              value={symbol} 
              onChange={e => { setSymbol(e.target.value); setShowSymbolSearch(true) }} 
              onFocus={() => setShowSymbolSearch(true)}
              onBlur={() => setTimeout(() => setShowSymbolSearch(false), 200)}
              className="w-full py-2.5 px-3 pl-9 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
            {isSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}
          </div>
          
          {showSymbolSearch && symbol.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181f] border border-white/[0.07] rounded-lg overflow-hidden z-50 shadow-xl">
              {searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div 
                    key={res.symbol} 
                    onClick={() => { setSymbol(res.symbol); setShowSymbolSearch(false) }}
                    className="p-3 border-b border-white/[0.03] cursor-pointer hover:bg-[#1f1f28] transition-colors"
                  >
                    <div className="text-[13px] font-medium text-white">{res.symbol}</div>
                    <div className="text-[11px] text-text-muted">{res.name}</div>
                  </div>
                ))
              ) : !isSearching ? (
                <div className="p-3 text-[12px] text-text-muted">Use "{symbol}" as custom ticker</div>
              ) : null}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-2">From</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={e => setFromDate(e.target.value)} 
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-2">To</label>
            <input 
              type="date" 
              value={toDate} 
              onChange={e => setToDate(e.target.value)} 
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.3)] rounded-lg text-[#f7614f] text-[12px]">
            {error}
          </div>
        )}

        <button 
          className="w-full py-3 bg-[#4f8ef7] rounded-lg text-white text-[14px] font-semibold hover:bg-[#5d9af8] transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,142,247,0.25)]"
          onClick={run} 
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Running...</> : <><Play size={16} /> Run Backtest</>}
        </button>
      </div>

      {/* Right Results Panel */}
      <div className="flex-1 p-6 overflow-y-auto bg-[#0a0a0f]">
        {!result ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#111118] border border-white/[0.07] flex items-center justify-center mb-4">
              <BarChart3 size={28} className="text-text-muted" />
            </div>
            <div className="text-[16px] font-medium text-white mb-2">No Results Yet</div>
            <div className="text-[13px] text-text-muted max-w-[280px]">Configure your strategy on the left and click "Run Backtest" to see results</div>
          </div>
        ) : (
          <div className="fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="font-head text-[18px] font-semibold text-white">{result.symbol}</div>
              <span className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[rgba(79,142,247,0.1)] border border-[rgba(79,142,247,0.3)] text-[#4f8ef7]">
                {result.stratName}
              </span>
              <span className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[rgba(52,212,138,0.1)] border border-[rgba(52,212,138,0.3)] text-[#34d48a] flex items-center gap-1">
                <CheckCircle size={12} /> Saved to history
              </span>
              {result.totalTrades === 0 && (
                <span className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[rgba(247,184,79,0.1)] border border-[rgba(247,184,79,0.3)] text-[#f7b84f]">
                  No trades generated
                </span>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total Return', value: result.totalReturn.toFixed(2) + '%', icon: result.totalReturn >= 0 ? TrendingUp : TrendingDown, color: result.totalReturn >= 0 ? '#34d48a' : '#f7614f' },
                { label: 'Win Rate', value: result.winRate.toFixed(1) + '%', icon: Activity, color: 'white' },
                { label: 'Trades', value: result.totalTrades, icon: BarChart3, color: 'white' },
                { label: 'Max Drawdown', value: result.maxDrawdown.toFixed(2) + '%', icon: TrendingDown, color: '#f7614f' },
              ].map((m, i) => (
                <div key={i} className="bg-[#111118] border border-white/[0.07] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <m.icon size={14} className="text-text-dim" />
                    <div className="text-[10px] font-bold tracking-wider text-text-muted uppercase">{m.label}</div>
                  </div>
                  <div className="text-[22px] font-bold font-mono tabular-nums" style={{ color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Equity Curve */}
            <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-5 mb-5">
              <div className="text-[13px] font-medium text-white mb-4">Equity Curve - Starting Capital: 1,00,000</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equity} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.floor(result.equity.length / 8)} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => (v/1000).toFixed(0) + 'k'} axisLine={false} tickLine={false} />
                    <Tooltip 
                      formatter={v => [v.toLocaleString('en-IN'), 'Portfolio']} 
                      contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12 }} 
                    />
                    <ReferenceLine y={100000} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="value" stroke={result.totalReturn >= 0 ? '#34d48a' : '#f7614f'} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trade Log */}
            {result.trades.length > 0 && (
              <div className="bg-[#111118] border border-white/[0.07] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.07] text-[13px] font-medium text-white">
                  Trade Log ({result.trades.length} closed trades)
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-black/40 sticky top-0">
                      <tr>
                        <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Exit Date</th>
                        <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Entry Price</th>
                        <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Exit Price</th>
                        <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Return %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} className="border-b border-white/[0.03]">
                          <td className="p-3 px-4 text-[13px] text-white font-mono">{t.date}</td>
                          <td className="p-3 px-4 text-[13px] text-white font-mono tabular-nums">{t.entry.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className="p-3 px-4 text-[13px] text-white font-mono tabular-nums">{t.exit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className={`p-3 px-4 text-[13px] font-mono font-medium tabular-nums ${t.pnl >= 0 ? 'text-[#34d48a]' : 'text-[#f7614f]'}`}>
                            {t.pnl >= 0 ? '+' : ''}{(t.pnl * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

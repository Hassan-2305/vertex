import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { runCustomBacktest } from '../lib/ruleEvaluator.js'
import { useSymbolSearch } from '../hooks/useSymbolSearch'
import { Search, Loader2 } from 'lucide-react'

const STRATEGIES = [
  { id: 'ema_cross', name: 'EMA Crossover', desc: 'Buy when 9 EMA crosses above 21 EMA, sell when crosses below' },
  { id: 'rsi_reversal', name: 'RSI Reversal', desc: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)' },
  { id: 'macd', name: 'MACD Signal', desc: 'Buy on MACD bullish crossover, sell on bearish crossover' },
  { id: 'bb_breakout', name: 'Bollinger Breakout', desc: 'Buy above upper band, sell when price falls below middle band' },
  { id: 'supertrend', name: 'Supertrend', desc: 'Popular trend-following indicator (ATR 10, Multiplier 3)' },
  { id: 'vwap_dev', name: 'VWAP Deviation', desc: 'Buy when price drops deeply below VWAP, mean reversion' },
]

// ── Indicators ───────────────────────────────────────────────────────────────
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

function calcATR(highs, lows, closes, period = 10) {
  const tr = [highs[0] - lows[0]]
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i]
    const hpc = Math.abs(highs[i] - closes[i - 1])
    const lpc = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(hl, hpc, lpc))
  }
  return calcEMA(tr, period)
}

function calcSupertrend(highs, lows, closes, period = 10, multiplier = 3) {
  const atr = calcATR(highs, lows, closes, period)
  let st = [], isUp = true
  let finalUpper = 0, finalLower = 0
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { st.push({ value: closes[0], isUp }); continue }
    
    const hl2 = (highs[i] + lows[i]) / 2
    let basicUpper = hl2 + multiplier * atr[i]
    let basicLower = hl2 - multiplier * atr[i]

    if (basicUpper < finalUpper || closes[i - 1] > finalUpper) finalUpper = basicUpper
    if (basicLower > finalLower || closes[i - 1] < finalLower) finalLower = basicLower

    if (st[i - 1] && st[i - 1].value === finalUpper && closes[i] > finalUpper) isUp = true
    if (st[i - 1] && st[i - 1].value === finalLower && closes[i] < finalLower) isUp = false

    st.push({ value: isUp ? finalLower : finalUpper, isUp })
  }
  return st
}

function calcVWAP(highs, lows, closes, volumes) {
  let cumVol = 0, cumVolPrice = 0
  return closes.map((c, i) => {
    const tp = (highs[i] + lows[i] + c) / 3
    const vol = volumes[i] || 1 // Fallback if no volume data
    cumVol += vol
    cumVolPrice += tp * vol
    return cumVolPrice / cumVol
  })
}

// ── Core backtest engine ─────────────────────────────────────────────────────
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
    // FIXED: MACD now actually implemented
    const { macdLine, signalLine } = calcMACD(closes)
    for (let i = 1; i < closes.length; i++) {
      if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) signals.push({ i, type: 'buy' })
      if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'bb_breakout') {
    // FIXED: Bollinger Breakout now actually implemented
    const bands = calcBollingerBands(closes)
    for (let i = 1; i < closes.length; i++) {
      // Buy above upper band (momentum breakout)
      if (closes[i - 1] <= bands[i - 1].upper && closes[i] > bands[i].upper) signals.push({ i, type: 'buy' })
      // Sell when price drops back below middle band
      if (closes[i - 1] >= bands[i - 1].middle && closes[i] < bands[i].middle) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'supertrend') {
    const highs = prices.map(p => p.high || p.close)
    const lows = prices.map(p => p.low || p.close)
    const st = calcSupertrend(highs, lows, closes)
    for (let i = 1; i < closes.length; i++) {
      if (!st[i - 1].isUp && st[i].isUp) signals.push({ i, type: 'buy' })
      if (st[i - 1].isUp && !st[i].isUp) signals.push({ i, type: 'sell' })
    }
  } else if (stratId === 'vwap_dev') {
    const highs = prices.map(p => p.high || p.close)
    const lows = prices.map(p => p.low || p.close)
    const volumes = prices.map(p => p.volume || 1)
    const vwap = calcVWAP(highs, lows, closes, volumes)
    for (let i = 1; i < closes.length; i++) {
      const dev = (closes[i] - vwap[i]) / vwap[i]
      if (dev < -0.05) signals.push({ i, type: 'buy' }) // Buy if price is >5% below VWAP
      if (dev > 0) signals.push({ i, type: 'sell' }) // Sell when back at or above VWAP
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
  const [tab, setTab] = useState('preset') // 'ai' or 'preset'

  // Symbol and Dates state
  const [symbol, setSymbol] = useState('^NSEI')
  const [showSymbolSearch, setShowSymbolSearch] = useState(false)
  const { results: searchResults, isSearching } = useSymbolSearch(showSymbolSearch ? symbol : '')
  
  const [fromDate, setFromDate] = useState('2022-01-01')
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  
  // Preset state
  const [stratId, setStratId] = useState('ema_cross')

  // AI Custom state
  const [aiText, setAiText] = useState('')
  const [parsedStrategy, setParsedStrategy] = useState(null)
  const [parsing, setParsing] = useState(false)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill from StrategyAI navigation (?strategy=ema_cross&symbol=RELIANCE.NS)
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
      
      // Auto-update form fields if AI found them
      if (strat.symbol) {
        setSymbol(strat.symbol)
      }
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

      // FIXED: filter timestamps and closes together so indices stay aligned
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

      // Only save to DB when we have a valid result
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
    <div style={{ padding: '1.5rem', maxWidth: 1000 }} className="fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={s.pageTitle}>Backtest Engine</h1>
        <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Test strategies on real NSE/BSE historical data · Free · No API key needed</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setTab('ai')} style={{ background: 'transparent', border: 'none', color: tab === 'ai' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '0 8px 8px 8px', borderBottom: tab === 'ai' ? '2px solid var(--accent)' : '2px solid transparent', transform: 'translateY(17px)' }}>🤖 AI Custom Strategy</button>
          <button onClick={() => setTab('preset')} style={{ background: 'transparent', border: 'none', color: tab === 'preset' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '0 8px 8px 8px', borderBottom: tab === 'preset' ? '2px solid var(--accent)' : '2px solid transparent', transform: 'translateY(17px)' }}>📋 Preset Strategies</button>
        </div>

        {tab === 'ai' ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Describe your strategy in plain English</label>
            <textarea
              placeholder="e.g. Buy when 9 EMA crosses above 21 EMA and RSI > 50. Sell when 9 EMA crosses below 21 EMA. Stop loss 2%, take profit 6%."
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              style={{ width: '100%', height: 80, padding: 12, background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', resize: 'vertical', fontSize: 13, marginBottom: 12 }}
            />
            <button className="btn btn-secondary" onClick={parseStrategy} disabled={parsing} style={{ width: '100%', justifyContent: 'center' }}>
              {parsing ? <><span className="spinner" style={{ marginRight: 8, width: 14, height: 14 }} /> Parsing strategy...</> : '⚡ Parse Rules'}
            </button>
            
            {parsedStrategy && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid var(--accent-border)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>{parsedStrategy.name || 'Parsed Rules Engine'}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {parsedStrategy.description && <div style={{ marginBottom: 8 }}>{parsedStrategy.description}</div>}
                  <div style={{ color: 'var(--text-muted)' }}>
                    • Entry logic: {parsedStrategy.entry?.logic} group ({parsedStrategy.entry?.conditions?.length || 0} conditions)
                    <br />
                    • Exit logic: {parsedStrategy.exit?.logic} group ({parsedStrategy.exit?.conditions?.length || 0} conditions)
                    {parsedStrategy.stopLoss != null && <><br/>• Stop loss: {parsedStrategy.stopLoss}%</>}
                    {parsedStrategy.takeProfit != null && <><br/>• Take profit: {parsedStrategy.takeProfit}%</>}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Strategy</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STRATEGIES.map(st => (
                <div key={st.id} onClick={() => setStratId(st.id)}
                  style={{ ...s.stratCard, ...(stratId === st.id ? s.stratCardActive : {}) }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: stratId === st.id ? 'var(--accent)' : 'var(--text)' }}>{st.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{st.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16, marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Symbol Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input 
                placeholder="Search symbol (e.g. RELIANCE, TCS)..." 
                value={symbol} 
                onChange={e => { setSymbol(e.target.value); setShowSymbolSearch(true) }} 
                onFocus={() => setShowSymbolSearch(true)}
                onBlur={() => setTimeout(() => setShowSymbolSearch(false), 200)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text)' }} 
              />
              {isSearching && <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-muted)' }} />}
            </div>
            
            {showSymbolSearch && (symbol.length >= 2) && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 50, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                {searchResults.length > 0 ? (
                  searchResults.map(res => (
                    <div 
                      key={res.symbol} 
                      onClick={() => { setSymbol(res.symbol); setShowSymbolSearch(false) }}
                      style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      className="hover-bg-muted"
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{res.symbol}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{res.name}</div>
                    </div>
                  ))
                ) : !isSearching ? (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Use "{symbol}" custom ticker</div>
                ) : null}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>From date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>To date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
        </div>

        {error && <div style={s.errBox}>{error}</div>}
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
          {loading ? <><span className="spinner" style={{ marginRight: 8 }} /> Fetching data & running backtest...</> : '▶  Run backtest'}
        </button>
      </div>

      {result && (
        <div className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{result.symbol}</div>
            <span className="badge badge-blue">{result.stratName}</span>
            {result.totalTrades === 0 && (
              <span className="badge badge-amber">No trades generated — try a different date range or strategy</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.25rem' }}>
            {[
              { label: 'Total return', value: result.totalReturn.toFixed(2) + '%', color: result.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Win rate', value: result.winRate.toFixed(1) + '%', color: 'var(--text)' },
              { label: 'Total trades', value: result.totalTrades, color: 'var(--text)' },
              { label: 'Max drawdown', value: result.maxDrawdown.toFixed(2) + '%', color: 'var(--red)' },
            ].map((m, i) => (
              <div key={i} style={s.metricCard}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-head)', color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Equity curve — ₹1,00,000 starting capital</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={result.equity} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.floor(result.equity.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => '₹' + (v/1000).toFixed(0) + 'k'} />
                <Tooltip formatter={v => ['₹' + v.toLocaleString('en-IN'), 'Portfolio']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={100000} stroke="var(--text-dim)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="value" stroke={result.totalReturn >= 0 ? 'var(--green)' : 'var(--red)'} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {result.trades.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                Trade Log ({result.trades.length} closed trades)
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={s.th}>Exit Date</th>
                      <th style={s.th}>Entry Price</th>
                      <th style={s.th}>Exit Price</th>
                      <th style={s.th}>Return %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={s.td}>{t.date}</td>
                        <td style={s.td}>₹{t.entry.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={s.td}>₹{t.exit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={{ ...s.td, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
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
  )
}

const s = {
  pageTitle: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 600, color: 'var(--text)' },
  stratCard: { padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' },
  stratCardActive: { background: 'var(--accent-dim)', borderColor: 'var(--accent-border)' },
  metricCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' },
  errBox: { background: 'var(--red-dim)', border: '1px solid rgba(247,97,79,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12, marginBottom: 14 },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', fontSize: 13, verticalAlign: 'middle', color: 'var(--text)' }
}

import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { INR } from '../lib/utils'
import AddHoldingModal from '../components/portfolio/AddHoldingModal'
import AddBrokerModal from '../components/portfolio/AddBrokerModal'
import StockChartModal from '../components/portfolio/StockChartModal'
import AddFnoEntryModal from '../components/portfolio/AddFnoEntryModal'
import { Trash2, TrendingUp, TrendingDown, RefreshCw, Plus, Layers, Pencil } from 'lucide-react'
import { fetchCurrentPrice } from '../lib/tradeUtils'
import toast from 'react-hot-toast'

const PCT = v => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'

const BROKER_COLORS = {
  groww: { bg: 'rgba(52,212,138,0.1)', border: 'rgba(52,212,138,0.3)', text: '#34d48a' },
  indmoney: { bg: 'rgba(79,142,247,0.1)', border: 'rgba(79,142,247,0.3)', text: '#4f8ef7' },
  zerodha: { bg: 'rgba(247,184,79,0.1)', border: 'rgba(247,184,79,0.3)', text: '#f7b84f' },
}

// Mini sparkline component for metric cards
function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null
  return (
    <div className="absolute inset-0 opacity-[0.08] overflow-hidden rounded-xl pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function PortfolioPage() {
  const { user } = useAuth()
  const [brokers, setBrokers] = useState([])
  const [holdings, setHoldings] = useState([])
  const [fnoEntries, setFnoEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [merging, setMerging] = useState(false)
  const [showAddHolding, setShowAddHolding] = useState(false)
  const [showAddBroker, setShowAddBroker] = useState(false)
  const [showAddFno, setShowAddFno] = useState(false)
  const [editHolding, setEditHolding] = useState(null)
  const [editFnoEntry, setEditFnoEntry] = useState(null)
  const [chartHolding, setChartHolding] = useState(null)
  const [filter, setFilter] = useState('all')
  const [assetFilter, setAssetFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table')
  const [livePrices, setLivePrices] = useState({})

  // Automatic Price Polling
  useEffect(() => {
    if (holdings.length === 0) return
    
    let isMounted = true
    const pollPortfolioPrices = async () => {
      const uniqueSymbols = Array.from(new Set(holdings.map(h => h.symbol)))
      const results = await Promise.all(
        uniqueSymbols.map(async (s) => {
          const h = holdings.find(x => x.symbol === s)
          const instrument = h?.holding_type?.toLowerCase() === 'f&o' ? 'option' : 'stock'
          const price = await fetchCurrentPrice(s, instrument)
          return { symbol: s, price }
        })
      )

      if (!isMounted) return
      setLivePrices(prev => {
        const next = { ...prev }
        results.forEach(({ symbol, price }) => {
          if (price !== null) next[symbol] = price
        })
        return next
      })
    }

    pollPortfolioPrices()
    const interval = setInterval(pollPortfolioPrices, 30000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [holdings.length])

  const load = async () => {
    setLoading(true)
    const [{ data: b }, { data: h }, { data: f }] = await Promise.all([
      supabase.from('broker_accounts').select('*').eq('user_id', user.id),
      supabase.from('holdings').select('*, broker_accounts(broker_name, display_name)').eq('user_id', user.id),
      supabase.from('fno_journal').select('*').eq('user_id', user.id).order('date', { ascending: false })
    ])
    setBrokers(b || [])
    setHoldings(h || [])
    setFnoEntries(f || [])
    setLoading(false)
  }

  const refreshPrices = async () => {
    if (holdings.length === 0) return
    setRefreshing(true)
    const updates = await Promise.all(
      holdings.map(async h => {
        const instrument = h.holding_type?.toLowerCase() === 'f&o' ? 'option' : 'stock'
        const price = await fetchCurrentPrice(h.symbol, instrument)
        return { id: h.id, price }
      })
    )
    await Promise.all(
      updates
        .filter(u => u.price !== null)
        .map(u => supabase.from('holdings').update({ current_price: u.price }).eq('id', u.id))
    )
    await load()
    setRefreshing(false)
  }

  const deleteHolding = async (id) => {
    const tid = toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Delete this holding?</p>
          <div className="flex gap-2">
            <button
              onClick={async () => { toast.dismiss(t.id); await supabase.from('holdings').delete().eq('id', id); await load() }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[rgba(247,97,79,0.15)] border border-[rgba(247,97,79,0.3)] text-[#f7614f] hover:bg-[rgba(247,97,79,0.25)] transition-colors"
            >Delete</button>
            <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">Cancel</button>
          </div>
        </div>
      ),
      { duration: 8000 }
    )
  }

  const mergeDuplicates = async () => {
    const groups = {}
    holdings.forEach(h => {
      const key = `${h.symbol}__${h.broker_account_id}`
      if (!groups[key]) groups[key] = []
      groups[key].push(h)
    })
    const dupes = Object.values(groups).filter(g => g.length > 1)
    if (dupes.length === 0) { toast('No duplicate holdings found.'); return }

    setMerging(true)
    for (const group of dupes) {
      const totalQty = group.reduce((s, h) => s + Number(h.quantity), 0)
      const weightedAvg = group.reduce((s, h) => s + Number(h.avg_buy_price) * Number(h.quantity), 0) / totalQty
      const latestPrice = group.reduce((max, h) => Math.max(max, Number(h.current_price || 0)), 0)
      const [keep, ...remove] = group
      await supabase.from('holdings').update({
        quantity: totalQty,
        avg_buy_price: parseFloat(weightedAvg.toFixed(4)),
        current_price: latestPrice || keep.current_price,
      }).eq('id', keep.id)
      await Promise.all(remove.map(h => supabase.from('holdings').delete().eq('id', h.id)))
    }
    await load()
    setMerging(false)
  }

  useEffect(() => { load() }, [user.id])

  const filtered = holdings.filter(h => {
    const matchBroker = filter === 'all' || h.broker_accounts?.broker_name?.toLowerCase() === filter
    const matchAsset = assetFilter === 'all' || h.holding_type?.toLowerCase() === assetFilter.toLowerCase()
    return matchBroker && matchAsset
  })

  const totalInvested = filtered.reduce((s, h) => s + Number(h.avg_buy_price) * Number(h.quantity), 0)
  const currentValue = filtered.reduce((s, h) => {
    const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
    return s + Number(price) * Number(h.quantity)
  }, 0)
  const totalPnL = currentValue - totalInvested
  const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  const brokerNames = [...new Set(brokers.map(b => b.broker_name))]
  const rawAssetClasses = ['All', 'Equity', 'Mutual Fund', 'F&O', ...new Set(holdings.map(h => h.holding_type?.trim()).filter(Boolean))]
  const assetClasses = rawAssetClasses.filter((v, i, a) => a.findIndex(t => t.toLowerCase() === v.toLowerCase()) === i)

  const isFno = assetFilter.toLowerCase() === 'f&o'

  // F&O calculations
  const totalFnoPnL = fnoEntries.reduce((s, e) => s + Number(e.pnl), 0)
  const fnoGreenDays = fnoEntries.filter(e => Number(e.pnl) >= 0).length
  const fnoWinRate = fnoEntries.length > 0 ? (fnoGreenDays / fnoEntries.length) * 100 : 0
  const fnoBestDay = fnoEntries.length > 0 ? Math.max(...fnoEntries.map(e => Number(e.pnl))) : 0
  const fnoWorstDay = fnoEntries.length > 0 ? Math.min(...fnoEntries.map(e => Number(e.pnl))) : 0

  const fnoChartData = useMemo(() => {
    return [...fnoEntries].reverse().map(e => ({
      date: new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      pnl: Number(e.pnl)
    }))
  }, [fnoEntries])

  // Sparkline data for metric cards — use real holdings count trend if available
  const sparklineData = useMemo(() => {
    return filtered.map((h, i) => {
      const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
      return { value: Number(price) * Number(h.quantity) }
    })
  }, [filtered, livePrices])

  const chartData = useMemo(() => {
    if (!holdings.length) return { allocation: [], pnlData: [] }
    
    const allocMap = {}
    filtered.forEach(h => {
      const type = h.holding_type.toUpperCase()
      const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
      const val = Number(price) * Number(h.quantity)
      allocMap[type] = (allocMap[type] || 0) + val
    })
    const allocation = Object.entries(allocMap).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)
    
    const pnlData = filtered.map(h => {
      const invested = Number(h.avg_buy_price) * Number(h.quantity)
      const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
      const current = Number(price) * Number(h.quantity)
      return { symbol: h.symbol, pnl: current - invested, invested }
    }).sort((a, b) => b.pnl - a.pnl)

    return { allocation, pnlData }
  }, [filtered])

  const PIE_COLORS = ['#4f8ef7', '#34d48a', '#f7b84f', '#a855f7']

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="spinner w-7 h-7" />
    </div>
  )

  return (
    <div className="p-6 max-w-[1100px] mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="font-head text-[22px] font-semibold text-white tracking-tight">Portfolio</h1>
          <p className="text-text-muted text-[12px] mt-1">Unified view across Groww, INDmoney &amp; Zerodha</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            className="btn btn-sm flex items-center gap-1.5" 
            onClick={refreshPrices} 
            disabled={refreshing || holdings.length === 0}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {(() => {
            const seen = {}; holdings.forEach(h => { seen[h.symbol] = (seen[h.symbol] || 0) + 1 })
            return Object.values(seen).some(c => c > 1)
          })() && !isFno && (
            <button 
              className="btn btn-sm" 
              onClick={mergeDuplicates} 
              disabled={merging}
              style={{ borderColor: 'rgba(79,142,247,0.25)', color: '#4f8ef7', background: 'rgba(79,142,247,0.08)' }}
            >
              <Layers size={12} className="mr-1.5" />
              Average out
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowAddBroker(true)}>Manage brokers</button>
          {!isFno ? (
            <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setShowAddHolding(true)} disabled={brokers.length === 0}>
              <Plus size={12} /> Add holding
            </button>
          ) : (
            <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setShowAddFno(true)}>
              <Plus size={12} /> Log Daily F&amp;O
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {(isFno ? [
          { label: 'Net F&O P&L', value: INR(Math.abs(totalFnoPnL)), sub: totalFnoPnL >= 0 ? 'Profitable' : 'Loss-making', pnl: totalFnoPnL },
          { label: 'Win Rate', value: `${fnoWinRate.toFixed(1)}%`, sub: `${fnoGreenDays} green / ${fnoEntries.length - fnoGreenDays} red` },
          { label: 'Best Day', value: INR(fnoBestDay), sub: 'Highest single day', pnl: fnoBestDay },
          { label: 'Worst Day', value: INR(Math.abs(fnoWorstDay)), sub: 'Biggest drawdown', pnl: fnoWorstDay },
        ] : [
          { label: 'Total Invested', value: INR(totalInvested), sub: `${filtered.length} holdings` },
          { label: 'Current Value', value: INR(currentValue), sub: totalPnL >= 0 ? 'Up from invested' : 'Down from invested' },
          { label: 'Today P&L', value: INR(Math.abs(totalPnL)), sub: PCT(pnlPct), pnl: totalPnL },
          { label: 'Overall Return', value: PCT(pnlPct), sub: `${brokers.length} accounts linked`, pnl: totalPnL },
        ]).map((m, i) => (
          <div 
            key={i} 
            className="relative bg-[#111118] border border-white/[0.07] rounded-xl p-5 overflow-hidden group hover:border-white/[0.14] transition-all duration-150"
          >
            <MiniSparkline data={sparklineData} color={m.pnl !== undefined ? (m.pnl >= 0 ? '#34d48a' : '#f7614f') : '#4f8ef7'} />
            <div className="relative z-10">
              <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-2">{m.label}</div>
              <div className={`text-[24px] font-bold font-mono tracking-tight tabular-nums ${m.pnl !== undefined ? (m.pnl >= 0 ? 'text-[#34d48a]' : 'text-[#f7614f]') : 'text-white'}`}>
                {m.pnl !== undefined && m.pnl >= 0 && m.label !== 'Overall Return' && '+'}
                {m.value}
              </div>
              <div className="text-[11px] text-text-dim mt-1.5 font-mono">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      {brokers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start flex-wrap gap-4 mb-4">
          <div className="flex flex-col gap-3">
            {/* Asset Class Filter */}
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[10px] text-text-muted mr-1">Asset:</span>
              {assetClasses.map(a => {
                const active = assetFilter.toLowerCase() === a.toLowerCase()
                return (
                  <button 
                    key={a} 
                    onClick={() => setAssetFilter(a.toLowerCase())} 
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all duration-150 capitalize ${
                      active 
                        ? 'bg-[rgba(79,142,247,0.1)] border-[rgba(79,142,247,0.3)] text-[#4f8ef7]' 
                        : 'bg-transparent border-white/[0.07] text-text-muted hover:border-white/[0.14] hover:text-white'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>

            {/* Broker Filter */}
            {!isFno && (
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="text-[10px] text-text-muted mr-1">Broker:</span>
                {['all', ...brokerNames].map(b => {
                  const active = filter === b
                  const colors = BROKER_COLORS[b] || {}
                  return (
                    <button 
                      key={b} 
                      onClick={() => setFilter(b)} 
                      className="px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all duration-150 capitalize"
                      style={{ 
                        background: active ? (colors.bg || 'rgba(79,142,247,0.1)') : 'transparent', 
                        borderColor: active ? (colors.border || 'rgba(79,142,247,0.3)') : 'rgba(255,255,255,0.07)', 
                        color: active ? (colors.text || '#4f8ef7') : 'var(--text-muted)' 
                      }}
                    >
                      {b}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="flex bg-[#111118] p-0.5 rounded-lg border border-white/[0.07]">
            <button 
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 ${viewMode === 'table' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
            >
              Table
            </button>
            <button 
              onClick={() => setViewMode('charts')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 ${viewMode === 'charts' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
            >
              Charts
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {isFno ? (
        <div className="flex flex-col gap-6">
          {fnoEntries.length === 0 ? (
            <div className="bg-[#111118] border border-dashed border-white/[0.14] rounded-xl h-[300px] flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl mb-4 opacity-60">&#128212;</div>
              <div className="text-[14px] font-semibold text-white mb-2">No Journal Entries Yet</div>
              <div className="text-[12px] text-text-muted leading-relaxed max-w-[250px] mb-4">Log your daily net P&amp;L for Options and Futures trading.</div>
              <button className="btn btn-primary" onClick={() => setShowAddFno(true)}>+ Log Daily F&amp;O</button>
            </div>
          ) : (
            <>
              {/* F&O Daily Chart */}
              <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-5">
                <h3 className="text-[13px] font-medium text-white mb-4">Daily P&amp;L Progression</h3>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fnoChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip 
                        cursor={{ fill: '#18181f' }}
                        formatter={(val) => [INR(val), 'Net P&L']}
                        contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.07)" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {fnoChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#34d48a' : '#f7614f'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* F&O Table */}
              <div className="bg-[#111118] border border-white/[0.07] rounded-xl overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/[0.07]">
                      <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Date</th>
                      <th className="p-3 px-4 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider">Net P&amp;L</th>
                      <th className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Notes</th>
                      <th className="p-3 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fnoEntries.map(e => {
                      const isUp = Number(e.pnl) >= 0
                      return (
                        <tr key={e.id} className="border-b border-white/[0.03] hover:bg-[#18181f] transition-colors">
                          <td className="p-3 px-4 text-[13px] font-mono">
                            {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className={`p-3 px-4 text-right text-[13px] font-mono font-medium tabular-nums ${isUp ? 'text-[#34d48a]' : 'text-[#f7614f]'}`}>
                            {isUp ? '+' : ''}{INR(e.pnl)}
                          </td>
                          <td className="p-3 px-4 text-[12px] text-text-muted">
                            {e.notes || '-'}
                          </td>
                          <td className="p-3 px-4">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditFnoEntry(e)}
                                className="p-1 text-text-muted hover:text-[#4f8ef7] transition-colors"
                                title="Edit entry"
                              >
                                <Pencil size={13} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm('Delete this entry?')) {
                                    await supabase.from('fno_journal').delete().eq('id', e.id)
                                    load()
                                  }
                                }}
                                className="p-1 text-text-muted hover:text-[#f7614f] transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111118] border border-dashed border-white/[0.14] rounded-xl h-[350px] flex flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl mb-4 opacity-60">&#128200;</div>
          <div className="text-[14px] font-semibold text-white mb-2">
            {brokers.length === 0 ? 'Add a broker first' : 'No holdings yet'}
          </div>
          <div className="text-[12px] text-text-muted leading-relaxed max-w-[280px] mb-4">
            {brokers.length === 0 ? 'Connect a broker to automatically sync your holdings.' : 'Add your stocks and mutual funds to track your portfolio'}
          </div>
          <button className="btn btn-primary" onClick={() => brokers.length === 0 ? setShowAddBroker(true) : setShowAddHolding(true)}>
            {brokers.length === 0 ? 'Connect broker' : '+ Add holding'}
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-[#111118] border border-white/[0.07] rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black/40 border-b border-white/[0.07]">
                {['Stock / Fund', 'Broker', 'Type', 'Qty', 'Avg Price', 'Current', 'Invested', 'Value', 'P&L', ''].map(col => (
                  <th key={col} className="p-3 px-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => {
                const invested = Number(h.avg_buy_price) * Number(h.quantity)
                const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
                const current = Number(price) * Number(h.quantity)
                const pnl = current - invested
                const pnlP = invested > 0 ? (pnl / invested) * 100 : 0
                const brokerKey = h.broker_accounts?.broker_name?.toLowerCase()
                const colors = BROKER_COLORS[brokerKey] || { bg: 'rgba(79,142,247,0.1)', border: 'rgba(79,142,247,0.3)', text: '#4f8ef7' }
                
                return (
                  <tr 
                    key={h.id} 
                    className="border-b border-white/[0.03] hover:bg-[#18181f] transition-colors cursor-pointer"
                    onClick={() => setChartHolding(h)}
                  >
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-[13px]">{h.symbol}</span>
                        {pnl >= 0 ? <TrendingUp size={12} className="text-[#34d48a]" /> : <TrendingDown size={12} className="text-[#f7614f]" />}
                      </div>
                      {h.company_name && <div className="text-[11px] text-text-muted mt-0.5">{h.company_name}</div>}
                    </td>
                    <td className="p-3 px-4">
                      <span 
                        className="px-2 py-1 text-[10px] font-medium rounded-md"
                        style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                      >
                        {h.broker_accounts?.display_name || h.broker_accounts?.broker_name}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-[rgba(79,142,247,0.1)] border border-[rgba(79,142,247,0.3)] text-[#4f8ef7]">
                        {h.holding_type}
                      </span>
                    </td>
                    <td className="p-3 px-4 font-mono text-[13px] tabular-nums">{h.quantity}</td>
                    <td className="p-3 px-4 font-mono text-[13px] tabular-nums">{INR(h.avg_buy_price)}</td>
                    <td className="p-3 px-4 font-mono text-[13px] tabular-nums">{INR(price)}</td>
                    <td className="p-3 px-4 font-mono text-[13px] tabular-nums">{INR(invested)}</td>
                    <td className="p-3 px-4 font-mono text-[13px] tabular-nums">{INR(current)}</td>
                    <td className="p-3 px-4">
                      <div className={`font-mono text-[13px] font-medium tabular-nums ${pnl >= 0 ? 'text-[#34d48a]' : 'text-[#f7614f]'}`}>
                        {pnl >= 0 ? '+' : ''}{INR(pnl)}
                      </div>
                      <div className={`text-[11px] font-mono ${pnl >= 0 ? 'text-[#34d48a]' : 'text-[#f7614f]'}`}>{PCT(pnlP)}</div>
                    </td>
                    <td className="p-3 px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditHolding(h)}
                        className="p-1 text-text-muted hover:text-white transition-colors"
                        title="Edit holding"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        onClick={() => deleteHolding(h.id)}
                        className="p-1 text-text-muted hover:text-[#f7614f] transition-colors ml-1"
                        title="Delete holding"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in">
          {/* Allocation Pie Chart */}
          <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-5">
            <h3 className="text-[13px] font-medium text-white mb-4">Asset Allocation</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.allocation}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [INR(val), 'Value']}
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {chartData.allocation.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-2 text-[11px] text-text-muted">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {entry.name} ({(entry.value / currentValue * 100).toFixed(1)}%)
                </div>
              ))}
            </div>
          </div>

          {/* P&L Bar Chart */}
          <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-5">
            <h3 className="text-[13px] font-medium text-white mb-4">P&amp;L by Holding</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.pnlData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="symbol" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} />
                  <Tooltip 
                    cursor={{ fill: '#18181f' }}
                    formatter={(val) => [INR(val), 'P&L']}
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                  />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.07)" />
                  <Bar dataKey="pnl" radius={4}>
                    {chartData.pnlData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#34d48a' : '#f7614f'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showAddBroker && <AddBrokerModal userId={user.id} brokers={brokers} onClose={() => { setShowAddBroker(false); load() }} />}
      {showAddHolding && <AddHoldingModal userId={user.id} brokers={brokers} onClose={() => { setShowAddHolding(false); load() }} />}
      {showAddFno && <AddFnoEntryModal userId={user.id} onClose={() => { setShowAddFno(false); load() }} />}
      {editFnoEntry && <AddFnoEntryModal userId={user.id} entry={editFnoEntry} onClose={() => { setEditFnoEntry(null); load() }} />}
      {editHolding && <AddHoldingModal userId={user.id} brokers={brokers} holding={editHolding} onClose={() => { setEditHolding(null); load() }} />}
      {chartHolding && <StockChartModal holding={chartHolding} onClose={() => setChartHolding(null)} />}
    </div>
  )
}

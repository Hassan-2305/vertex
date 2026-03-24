import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { INR } from '../lib/utils'
import AddHoldingModal from '../components/portfolio/AddHoldingModal'
import AddBrokerModal from '../components/portfolio/AddBrokerModal'
import StockChartModal from '../components/portfolio/StockChartModal'
import AddFnoEntryModal from '../components/portfolio/AddFnoEntryModal'
import { Trash2, TrendingUp, TrendingDown, Wallet, Activity, Loader2 } from 'lucide-react'
import { fetchCurrentPrice } from '../lib/tradeUtils'

const PCT = v => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'

const BROKER_TAG_CLASS = {
  groww: 'tag-groww',
  indmoney: 'tag-indm',
  zerodha: 'tag-zerodha',
}

// (Legacy fetchLivePrice removed, using tradeUtils instead)

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
  const [chartHolding, setChartHolding] = useState(null)
  const [filter, setFilter] = useState('all') // broker filter
  const [assetFilter, setAssetFilter] = useState('all') // asset class filter
  const [viewMode, setViewMode] = useState('table')
  const [livePrices, setLivePrices] = useState({})

  // Automatic Price Polling for Portfolio
  useEffect(() => {
    if (holdings.length === 0) return
    
    let isMounted = true
    const pollPortfolioPrices = async () => {
      const uniqueSymbols = Array.from(new Set(holdings.map(h => h.symbol)))
      const results = await Promise.all(
        uniqueSymbols.map(async (s) => {
          // Find instrument for this symbol (default to stock if not found)
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
    const interval = setInterval(pollPortfolioPrices, 30000) // Poll every 30s
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
    // Batch update in Supabase
    await Promise.all(
      updates
        .filter(u => u.price !== null)
        .map(u => supabase.from('holdings').update({ current_price: u.price }).eq('id', u.id))
    )
    await load()
    setRefreshing(false)
  }

  const deleteHolding = async (id) => {
    if (!confirm('Delete this holding?')) return
    await supabase.from('holdings').delete().eq('id', id)
    await load()
  }

  // Merge duplicate holdings (same symbol + same broker) into a single averaged position
  const mergeDuplicates = async () => {
    // Group by symbol+brokerAccountId
    const groups = {}
    holdings.forEach(h => {
      const key = `${h.symbol}__${h.broker_account_id}`
      if (!groups[key]) groups[key] = []
      groups[key].push(h)
    })
    const dupes = Object.values(groups).filter(g => g.length > 1)
    if (dupes.length === 0) { alert('No duplicate holdings found.'); return }

    setMerging(true)
    for (const group of dupes) {
      // Compute weighted average
      const totalQty = group.reduce((s, h) => s + Number(h.quantity), 0)
      const weightedAvg = group.reduce((s, h) => s + Number(h.avg_buy_price) * Number(h.quantity), 0) / totalQty
      const latestPrice = group.reduce((max, h) => Math.max(max, Number(h.current_price || 0)), 0)
      // Keep the first, delete the rest
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
    const matchAsset  = assetFilter === 'all' || h.holding_type?.toLowerCase() === assetFilter.toLowerCase()
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

  // F&O specific calculations
  const totalFnoPnL = fnoEntries.reduce((s, e) => s + Number(e.pnl), 0)
  const fnoGreenDays = fnoEntries.filter(e => Number(e.pnl) >= 0).length
  const fnoWinRate = fnoEntries.length > 0 ? (fnoGreenDays / fnoEntries.length) * 100 : 0
  const fnoBestDay = fnoEntries.length > 0 ? Math.max(...fnoEntries.map(e => Number(e.pnl))) : 0
  const fnoWorstDay = fnoEntries.length > 0 ? Math.min(...fnoEntries.map(e => Number(e.pnl))) : 0

  // F&O chart data
  const fnoChartData = useMemo(() => {
    return [...fnoEntries].reverse().map(e => ({
      date: new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      pnl: Number(e.pnl)
    }))
  }, [fnoEntries])

  // Prepare chart data for regular holdings
  const chartData = useMemo(() => {
    if (!holdings.length) return { allocation: [], pnlData: [] }
    
    // Allocation Pie Chart Data
    const allocMap = {}
    filtered.forEach(h => {
      const type = h.holding_type.toUpperCase()
      const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
      const val = Number(price) * Number(h.quantity)
      allocMap[type] = (allocMap[type] || 0) + val
    })
    const allocation = Object.entries(allocMap).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)
    
    // P&L Bar Chart Data
    const pnlData = filtered.map(h => {
      const invested = Number(h.avg_buy_price) * Number(h.quantity)
      const price = livePrices[h.symbol] || h.current_price || h.avg_buy_price
      const current = Number(price) * Number(h.quantity)
      return {
        symbol: h.symbol,
        pnl: current - invested,
        invested,
      }
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
    <div style={{ padding: '1.5rem', maxWidth: 1100 }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Portfolio</h1>
          <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Unified view across all your brokers</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={refreshPrices} disabled={refreshing || holdings.length === 0}>
            {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '↻'} Refresh prices
          </button>
          {/* Show Merge button if any symbol appears more than once */}
          {(() => {
            const seen = {}; holdings.forEach(h => { seen[h.symbol] = (seen[h.symbol] || 0) + 1 })
            return Object.values(seen).some(c => c > 1)
          })() && !isFno && (
            <button className="btn btn-sm" onClick={mergeDuplicates} disabled={merging}
              style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)', background: 'var(--accent-dim)' }}>
              {merging ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '⚡'} Average out
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowAddBroker(true)}>Manage brokers</button>
          {!isFno ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddHolding(true)} disabled={brokers.length === 0}>+ Add holding</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddFno(true)}>+ Log Daily F&O</button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: '2rem' }}>
        {(isFno ? [
          { label: 'Net F&O P&L', value: INR(Math.abs(totalFnoPnL)), sub: totalFnoPnL >= 0 ? 'Profitable' : 'Loss-making', pnl: totalFnoPnL },
          { label: 'Win Rate', value: `${fnoWinRate.toFixed(1)}%`, sub: `${fnoGreenDays} green / ${fnoEntries.length - fnoGreenDays} red` },
          { label: 'Best Day', value: INR(fnoBestDay), sub: 'Highest single day profit', pnl: fnoBestDay },
          { label: 'Worst Day', value: INR(Math.abs(fnoWorstDay)), sub: 'Biggest single day drawdown', pnl: fnoWorstDay },
        ] : [
          { label: 'Total invested', value: INR(totalInvested), sub: `${filtered.length} holdings` },
          { label: 'Current value', value: INR(currentValue), sub: totalPnL >= 0 ? '▲ up' : '▼ down' },
          { label: 'Total P&L', value: INR(Math.abs(totalPnL)), sub: PCT(pnlPct), pnl: totalPnL },
          { label: 'Accounts linked', value: brokers.length, sub: brokerNames.join(', ') || 'None yet' },
        ]).map((m, i) => (
          <div key={i} className="glass-panel p-5 group flex flex-col justify-center relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="text-[11px] font-bold tracking-widest text-text-muted mb-2 uppercase z-10">{m.label}</div>
            <div className={`text-[24px] font-bold font-mono tracking-tight z-10 ${m.pnl !== undefined ? (m.pnl >= 0 ? 'text-green drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-red drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]') : 'text-white'}`}>{m.value}</div>
            <div className="text-[11px] text-text-dim mt-1.5 z-10 font-mono tracking-wide">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs & View toggle */}
      {brokers.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {/* Asset Class Filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Asset Class:</span>
              {assetClasses.map(a => {
                const active = assetFilter.toLowerCase() === a.toLowerCase()
                return (
                  <button key={a} onClick={() => setAssetFilter(a.toLowerCase())} className={`btn btn-sm ${active ? 'bg-accent text-white border-accent hover:opacity-90' : 'bg-transparent text-text-muted border-border hover:border-accent hover:text-accent'}`}
                    style={{ transition: 'all 0.15s', textTransform: 'capitalize' }}>
                    {a}
                  </button>
                )
              })}
            </div>

            {/* Broker Filter */}
            {!isFno && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Accounts:</span>
                {['all', ...brokerNames].map(b => (
                  <button key={b} onClick={() => setFilter(b)} className="btn btn-sm"
                    style={{ background: filter === b ? 'var(--accent-dim)' : 'transparent', borderColor: filter === b ? 'var(--accent-border)' : 'var(--border)', color: filter === b ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: 2, borderRadius: 8, border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
            <button 
              onClick={() => setViewMode('table')}
              style={{ ...styles.viewBtn, background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'table' ? 'var(--text)' : 'var(--text-muted)' }}
            >
              Table
            </button>
            <button 
              onClick={() => setViewMode('charts')}
              style={{ ...styles.viewBtn, background: viewMode === 'charts' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'charts' ? 'var(--text)' : 'var(--text-muted)' }}
            >
              Charts
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isFno ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {fnoEntries.length === 0 ? (
            <div className="glass-panel border-dashed h-[300px] flex flex-col items-center justify-center p-6 text-center text-text-muted">
              <span className="text-4xl mb-4 opacity-80 filter drop-shadow-md">📔</span>
              <div className="text-[14px] font-bold tracking-widest text-text mb-2 uppercase">No Journal Entries Yet</div>
              <div className="text-[11px] leading-relaxed max-w-[250px] mb-4">Log your daily net P&L for Options and Futures trading.</div>
              <button className="btn btn-primary" onClick={() => setShowAddFno(true)}>+ Log Daily F&O</button>
            </div>
          ) : (
            <>
              {/* F&O Daily Chart */}
              <div className="glass-panel p-5">
                <h3 className="text-[13px] font-medium text-text mb-4">Daily P&L Progression</h3>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fnoChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip 
                        cursor={{ fill: 'var(--bg-elevated)' }}
                        formatter={(val) => [INR(val), 'Net P&L']}
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                      />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {fnoChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* F&O Table */}
              <div className="glass-panel overflow-hidden">
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      <th style={styles.th}>Date</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Net P&L</th>
                      <th style={styles.th}>Notes</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fnoEntries.map(e => {
                      const isUp = Number(e.pnl) >= 0
                      return (
                        <tr key={e.id} style={styles.tr}>
                          <td style={styles.td}>
                            {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                            {isUp ? '+' : ''}{INR(e.pnl)}
                          </td>
                          <td style={{ ...styles.td, color: 'var(--text-muted)', fontSize: 12 }}>
                            {e.notes || '-'}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <button 
                              onClick={async () => {
                                if (confirm('Delete this entry?')) {
                                  await supabase.from('fno_journal').delete().eq('id', e.id)
                                  load()
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
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
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel border-dashed h-[350px] flex flex-col items-center justify-center p-6 text-center text-text-muted">
          <span className="text-4xl mb-4 opacity-80 filter drop-shadow-md">📊</span>
          <div className="text-[14px] font-bold tracking-widest text-text mb-2 uppercase">
            {brokers.length === 0 ? 'Add a broker first' : 'No holdings yet'}
          </div>
          <div className="text-[11px] leading-relaxed max-w-[280px] mb-4">
            {brokers.length === 0 ? 'Connect a broker to automatically sync your holdings.' : 'Add your stocks and mutual funds to track your portfolio'}
          </div>
          <button className="btn btn-primary" onClick={() => brokers.length === 0 ? setShowAddBroker(true) : setShowAddHolding(true)}>
            {brokers.length === 0 ? 'Connect broker' : '+ Add holding'}
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-panel overflow-hidden">
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {['Stock / Fund', 'Broker', 'Type', 'Qty', 'Avg Price', 'Current', 'Invested', 'Value', 'P&L', ''].map(col => (
                  <th key={col} style={styles.th}>{col}</th>
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
                const tagClass = BROKER_TAG_CLASS[brokerKey] || 'badge badge-blue'
                return (
                  <tr key={h.id} style={{ ...styles.tr, cursor: 'pointer' }} className="group"
                    onClick={() => setChartHolding(h)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{h.symbol}</div>
                        <span style={{ fontSize: 9, color: 'var(--accent)', opacity: 0.6 }}>📈</span>
                      </div>
                      {h.company_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.company_name}</div>}
                    </td>
                    <td style={styles.td}>
                      <span className={tagClass}>
                        {h.broker_accounts?.display_name || h.broker_accounts?.broker_name}
                      </span>
                    </td>
                    <td style={styles.td}><span className="badge badge-blue" style={{ fontSize: 10 }}>{h.holding_type}</span></td>
                    <td style={styles.td}>{h.quantity}</td>
                    <td style={styles.td}>₹{Number(h.avg_buy_price).toLocaleString('en-IN')}</td>
                    <td style={styles.td}>₹{Number(livePrices[h.symbol] || h.current_price || h.avg_buy_price).toLocaleString('en-IN')}</td>
                    <td style={styles.td}>{INR(invested)}</td>
                    <td style={styles.td}>{INR(current)}</td>
                    <td style={styles.td}>
                      <div style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{pnl >= 0 ? '+' : ''}{INR(pnl)}</div>
                      <div style={{ fontSize: 11, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{PCT(pnlP)}</div>
                    </td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditHolding(h)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px', fontSize: 14 }}
                        title="Edit holding"
                      >✎</button>
                      <button
                        onClick={() => deleteHolding(h.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '2px 6px', fontSize: 14 }}
                        title="Delete holding"
                      >✕</button>
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
          <div className="glass-panel p-5">
            <h3 className="text-[13px] font-medium text-text mb-4">Asset Allocation</h3>
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
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
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
          <div className="glass-panel p-5">
            <h3 className="text-[13px] font-medium text-text mb-4">P&L by Holding</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.pnlData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="symbol" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={60} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-elevated)' }}
                    formatter={(val) => [INR(val), 'P&L']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                  />
                  <ReferenceLine x={0} stroke="var(--border)" />
                  <Bar dataKey="pnl" radius={4}>
                    {chartData.pnlData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
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
      {editHolding && <AddHoldingModal userId={user.id} brokers={brokers} holding={editHolding} onClose={() => { setEditHolding(null); load() }} />}
      {chartHolding && <StockChartModal holding={chartHolding} onClose={() => setChartHolding(null)} />}
    </div>
  )
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border)' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' },
  td: { padding: '14px 14px', fontSize: 13, verticalAlign: 'middle', fontFamily: 'var(--font-mono)' },
  viewBtn: { padding: '4px 12px', fontSize: 11, fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }
}

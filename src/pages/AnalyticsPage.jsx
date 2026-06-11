import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { VIRTUAL_CAPITAL } from '../lib/constants'
import { INR } from '../lib/utils'
import { TrendingUp, TrendingDown, Target, Activity, AlertCircle, BarChart2 } from 'lucide-react'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [timeframe, setTimeframe] = useState('all')

  const { data: trades, isLoading } = useQuery({
    queryKey: ['paper_trades', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('paper_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: true })
      return data || []
    },
    enabled: !!user?.id
  })

  const metrics = useMemo(() => {
    if (!trades?.length) return null

    // Filter by timeframe
    const now = new Date()
    const filteredTrades = trades.filter(t => {
      if (timeframe === 'all') return true
      const date = new Date(t.opened_at)
      if (timeframe === '7d') return (now - date) <= 7 * 24 * 60 * 60 * 1000
      if (timeframe === '30d') return (now - date) <= 30 * 24 * 60 * 60 * 1000
      if (timeframe === '90d') return (now - date) <= 90 * 24 * 60 * 60 * 1000
      return true
    })

    const closedTrades = filteredTrades.filter(t => t.status === 'closed')
    if (closedTrades.length === 0) return null

    const wins = closedTrades.filter(t => Number(t.pnl) > 0)
    const losses = closedTrades.filter(t => Number(t.pnl) < 0)
    
    const grossProfit = wins.reduce((sum, t) => sum + Number(t.pnl), 0)
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl), 0))
    
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss
    const winRate = (wins.length / closedTrades.length) * 100

    let currentCapital = VIRTUAL_CAPITAL
    let peakCapital = VIRTUAL_CAPITAL
    let maxDrawdown = 0

    const equityCurve = [{ date: 'Start', value: VIRTUAL_CAPITAL, pnl: 0 }]
    
    const processedDates = new Map() // Group by day

    closedTrades.forEach(t => {
      const pnl = Number(t.pnl)
      currentCapital += pnl
      if (currentCapital > peakCapital) peakCapital = currentCapital
      const dd = ((peakCapital - currentCapital) / peakCapital) * 100
      if (dd > maxDrawdown) maxDrawdown = dd

      const dateStr = new Date(t.closed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      
      if (processedDates.has(dateStr)) {
        processedDates.set(dateStr, processedDates.get(dateStr) + pnl)
      } else {
        processedDates.set(dateStr, pnl)
      }
    })

    // Build curve from grouped daily P&L
    let runningCap = VIRTUAL_CAPITAL
    Array.from(processedDates.entries()).forEach(([date, dailyPnl]) => {
      runningCap += dailyPnl
      equityCurve.push({ date, value: runningCap, pnl: dailyPnl })
    })

    const thisMonthPnL = closedTrades
      .filter(t => new Date(t.closed_at).getMonth() === new Date().getMonth())
      .reduce((sum, t) => sum + Number(t.pnl), 0)

    return {
      totalTrades: closedTrades.length,
      winRate,
      profitFactor,
      maxDrawdown,
      avgWin: wins.length ? grossProfit / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      expectancy: (wins.length ? grossProfit / wins.length : 0) * (winRate/100) - 
                  (losses.length ? grossLoss / losses.length : 0) * (1 - winRate/100),
      totalPnL: currentCapital - VIRTUAL_CAPITAL,
      thisMonthPnL,
      equityCurve
    }
  }, [trades, timeframe])

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="spinner w-8 h-8" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
        <div>
          <h1 className="font-head text-[22px] font-semibold text-text">Analytics Dashboard</h1>
          <p className="text-text-muted text-[13px] mt-1">Deep dive into your paper trading performance</p>
        </div>

        <div className="flex bg-bg-elevated p-1 rounded-lg border border-border">
          {[
            { id: '7d', label: '7D' },
            { id: '30d', label: '1M' },
            { id: '90d', label: '3M' },
            { id: 'all', label: 'All Time' },
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                timeframe === tf.id 
                  ? 'bg-accent text-white shadow-sm' 
                  : 'text-text-muted hover:text-text hover:bg-bg-card'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {!metrics ? (
        <div className="flex flex-col items-center justify-center p-16 bg-bg-card border border-border rounded-xl text-center">
          <BarChart2 className="w-12 h-12 text-text-dim mb-4" />
          <h3 className="font-head text-lg font-medium text-text mb-2">No data yet</h3>
          <p className="text-text-muted text-[13px] max-w-[300px]">
            Execute some paper trades to unlock your performance analytics dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <MetricCard 
              label="Net P&L" 
              value={INR(Math.abs(metrics.totalPnL))} 
              sub={metrics.totalPnL >= 0 ? 'Profitable' : 'Loss-making'} 
              color={metrics.totalPnL >= 0 ? 'text-green' : 'text-red'}
              icon={<Activity className="w-4 h-4 text-accent" />}
              prefix={metrics.totalPnL >= 0 ? '+' : '-'}
            />
            <MetricCard 
              label="Win Rate" 
              value={`${metrics.winRate.toFixed(1)}%`} 
              sub={`${metrics.totalTrades} closed trades`} 
              icon={<Target className="w-4 h-4 text-accent" />}
            />
            <MetricCard 
              label="Profit Factor" 
              value={metrics.profitFactor.toFixed(2)} 
              sub={metrics.profitFactor >= 1.5 ? 'Excellent' : metrics.profitFactor >= 1 ? 'Profitable' : 'Needs work'} 
              color={metrics.profitFactor >= 1 ? 'text-green' : 'text-amber'}
              icon={<TrendingUp className="w-4 h-4 text-accent" />}
            />
            <MetricCard 
              label="Max Drawdown" 
              value={`${metrics.maxDrawdown.toFixed(2)}%`} 
              sub="Peak to trough drop" 
              color="text-red"
              icon={<TrendingDown className="w-4 h-4 text-accent" />}
            />
          </div>

          {/* Equity Curve */}
          <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-head font-medium text-text">Cumulative Equity</h3>
                <p className="text-text-muted text-[11px] mt-0.5">Starting capital: {INR(VIRTUAL_CAPITAL)}</p>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-muted">This Month</div>
                <div className={`text-[13px] font-medium ${metrics.thisMonthPnL >= 0 ? 'text-green' : 'text-red'}`}>
                  {metrics.thisMonthPnL >= 0 ? '+' : ''}{INR(metrics.thisMonthPnL)}
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metrics.totalPnL >= 0 ? 'var(--green)' : 'var(--red)'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={metrics.totalPnL >= 0 ? 'var(--green)' : 'var(--red)'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                    axisLine={false} 
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={['dataMin - 1000', 'dataMax + 1000']}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={v => '₹' + (v/1000).toFixed(0) + 'k'}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={VIRTUAL_CAPITAL} stroke="var(--border)" strokeDasharray="3 3" />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={metrics.totalPnL >= 0 ? 'var(--green)' : 'var(--red)'} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          /* Secondary Metrics Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-center">
              <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Average Win</div>
              <div className="text-xl font-medium text-green">+{INR(metrics.avgWin)}</div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-center">
              <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Average Loss</div>
              <div className="text-xl font-medium text-red">-{INR(metrics.avgLoss)}</div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
              <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                Trade Expectancy
                <div className="group relative">
                  <AlertCircle className="w-3.5 h-3.5 text-text-dim cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-bg-elevated border border-border rounded-md text-[10px] text-text-muted opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                    Average expected return per trade based on your win rate and reward/risk ratio.
                  </div>
                </div>
              </div>
              <div className={`text-xl font-medium ${metrics.expectancy >= 0 ? 'text-green' : 'text-red'}`}>
                {metrics.expectancy >= 0 ? '+' : ''}{INR(metrics.expectancy)}
              </div>
              <div className="absolute right-[-10px] bottom-[-10px] opacity-5">
                <Target className="w-24 h-24" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, color = "text-text", icon, prefix = '' }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-3 md:p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="text-[11px] md:text-xs text-text-muted">{label}</div>
        <div className="bg-bg-elevated p-1.5 rounded-lg border border-border shrink-0">{icon}</div>
      </div>
      <div>
        <div className={`font-head text-lg md:text-2xl font-semibold mb-0.5 truncate ${color}`}>
          {prefix}{value}
        </div>
        <div className="text-[10px] md:text-[11px] text-text-muted truncate">{sub}</div>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-bg-card border border-border rounded-lg p-3 shadow-xl min-w-[140px]">
        <div className="text-[10px] text-text-muted mb-1.5">{label}</div>
        <div className="text-[13px] font-medium text-text mb-1">
          {INR(data.value)}
        </div>
        {data.pnl !== 0 && (
          <div className={`text-[11px] ${data.pnl >= 0 ? 'text-green' : 'text-red'}`}>
            {data.pnl >= 0 ? '+' : ''}{INR(data.pnl)} daily P&L
          </div>
        )}
      </div>
    )
  }
  return null
}

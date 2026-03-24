import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { VIRTUAL_CAPITAL } from '../lib/constants'
import { INR } from '../lib/utils'
import TradeCard from '../components/features/paper-trade/TradeCard'
import PaperTradeForm from '../components/features/paper-trade/PaperTradeForm'
import TerminalTab from '../components/features/paper-trade/TerminalTab'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, Activity, LayoutDashboard, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { fetchCurrentPrice } from '../lib/tradeUtils'

export default function PaperTradePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState('terminal') // 'terminal' | 'journal'
  const [tab, setTab] = useState('open')
  const [livePrices, setLivePrices] = useState({})

  // Centralized Live Price Polling
  useEffect(() => {
    const openTrades = trades.filter(t => t.status === 'open')
    if (!openTrades.length) {
      if (Object.keys(livePrices).length > 0) setLivePrices({})
      return
    }

    let isMounted = true
    const pollPrices = async () => {
      const uniqueSymbols = Array.from(new Set(openTrades.map(t => JSON.stringify({ s: t.symbol, i: t.instrument }))))
        .map(str => JSON.parse(str))

      const results = await Promise.all(
        uniqueSymbols.map(async ({ s, i }) => {
          const price = await fetchCurrentPrice(s, i)
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

    pollPrices()
    const interval = setInterval(pollPrices, 10000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [trades, queryClient]) // Depend on trades to re-evaluate symbols when they change

  // Fetch Trades
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['paper_trades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paper_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  // Realtime Subscriptions
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paper_trades', filter: `user_id=eq.${user.id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['paper_trades', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])

  // Place Order Mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (tradeData) => {
      const { data, error } = await supabase.from('paper_trades').insert({
        user_id: user.id,
        ...tradeData,
        status: 'open',
      }).select().single()
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Successfully placed ${data.trade_type} order for ${data.symbol}`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to place order')
    }
  })

  // Close Order Mutation
  const closeOrderMutation = useMutation({
    mutationFn: async ({ trade, exitPrice }) => {
      const pnl = trade.trade_type === 'buy'
        ? (exitPrice - trade.entry_price) * trade.quantity
        : (trade.entry_price - exitPrice) * trade.quantity
        
      const { error } = await supabase
        .from('paper_trades')
        .update({ 
          status: 'closed', 
          exit_price: exitPrice, 
          pnl, 
          closed_at: new Date().toISOString() 
        })
        .eq('id', trade.id)
        
      if (error) throw error
      return { trade, pnl }
    },
    onSuccess: ({ trade, pnl }) => {
      const isProfit = Number(pnl) >= 0
      toast.success(`Closed ${trade.symbol}. ${isProfit ? 'Profit' : 'Loss'}: ${INR(Math.abs(pnl))}`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to close order')
    }
  })

  const openTrades = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status === 'closed')

  const totalPnL = closedTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  
  const unrealisedPnL = openTrades.reduce((acc, t) => {
    const ltp = livePrices[t.symbol]
    if (!ltp) return acc
    const pnl = t.trade_type === 'buy'
      ? (ltp - t.entry_price) * t.quantity
      : (t.entry_price - ltp) * t.quantity
    return acc + pnl
  }, 0)

  const invested = openTrades.reduce((s, t) => s + Number(t.entry_price) * Number(t.quantity), 0)
  const available = VIRTUAL_CAPITAL + totalPnL - invested
  const accountValue = VIRTUAL_CAPITAL + totalPnL + unrealisedPnL

  // Calculate current win streak
  let currentStreak = 0
  for (let i = 0; i < closedTrades.length; i++) {
    if (Number(closedTrades[i].pnl) > 0) currentStreak++
    else break
  }

  // Reset all trades (wipe the session)
  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('paper_trades')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Paper trading session reset. Starting fresh with ₹10,00,000!')
      queryClient.invalidateQueries({ queryKey: ['paper_trades', user.id] })
    },
    onError: (e) => toast.error(e.message || 'Reset failed')
  })

  const handleReset = () => {
    if (!window.confirm('Reset your entire paper trading session? This will delete ALL open and closed trades. This cannot be undone.')) return
    resetMutation.mutate()
  }

  return (
    <div className={`mx-auto fade-in h-full relative ${viewMode === 'terminal' ? 'p-0 flex flex-col' : 'p-6 max-w-[1100px]'}`}>
      
      {/* Top Navigation */}
      <div className={`flex items-center justify-between mb-6 ${viewMode === 'terminal' ? 'px-6 py-4 glass-panel border-x-0 border-t-0 rounded-none z-10 relative' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-head text-[24px] font-bold tracking-tight text-text drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Paper Trade</h1>
            <span className="badge badge-green hidden sm:inline-flex">
              <div className="w-1.5 h-1.5 rounded-full bg-green" />
              Virtual · Zero risk
            </span>
          </div>

          <div className="h-5 w-[1px] bg-border mx-2 hidden sm:block"></div>
          
          <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/5 shadow-inner">
            <button 
              onClick={() => setViewMode('terminal')} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-300 ${viewMode === 'terminal' ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
            >
              <Activity size={16} /> F&O Terminal
            </button>
            <button 
              onClick={() => setViewMode('journal')} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-300 ${viewMode === 'journal' ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
            >
              <LayoutDashboard size={16} /> Dashboard
            </button>
          </div>
        </div>

        {viewMode === 'journal' && (
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending || trades.length === 0}
            className="btn btn-sm !border-red/30 !text-red !bg-red-dim hover:opacity-80 disabled:opacity-40"
          >
            {resetMutation.isPending ? <span className="spinner w-3 h-3" /> : '↺'} Reset session
          </button>
        )}
      </div>

      {viewMode === 'terminal' ? (
        <div className="flex-1 px-4 pb-4">
          <TerminalTab onTradeAdded={() => queryClient.invalidateQueries({ queryKey: ['paper_trades', user.id] })} />
        </div>
      ) : (
        <div className="fade-in animate-in slide-in-from-bottom-2">
          {/* Capital overview */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'ACCOUNT VALUE', value: INR(accountValue), sub: `ROI: ${((accountValue/VIRTUAL_CAPITAL - 1)*100).toFixed(2)}%`, icon: Wallet, color: 'text-white' },
          { label: 'REALISED P&L', value: INR(totalPnL), sub: totalPnL >= 0 ? 'Profit' : 'Loss', color: totalPnL >= 0 ? 'text-green' : 'text-red', icon: totalPnL >= 0 ? TrendingUp : TrendingDown },
          { label: 'UNREALISED P&L', value: INR(unrealisedPnL), sub: `${openTrades.length} open positions`, color: unrealisedPnL >= 0 ? 'text-green' : 'text-red', icon: Activity },
          { label: 'AVAIL. MARGIN', value: INR(Math.max(0, available)), sub: `Usage: ${((invested/VIRTUAL_CAPITAL)*100).toFixed(1)}%`, color: 'text-accent' },
          { label: 'WIN STREAK', value: `${currentStreak} 🔥`, sub: 'Consecutive winners', color: currentStreak >= 3 ? 'text-amber' : 'text-text' },
        ].map((m, i) => (
          <div key={i} className="glass-panel p-5 text-center md:text-left flex flex-col items-center md:items-start group hover:border-white/20 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              {m.icon && <m.icon size={12} className="text-text-dim" />}
              <div className="text-[10px] font-bold tracking-wider text-text-muted">{m.label}</div>
            </div>
            <div className={`text-[20px] font-bold font-head tracking-tight ${m.color || 'text-white'} drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>{m.value}</div>
            <div className="text-[11px] text-text-dim mt-1.5">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-5">
        {/* Order form */}
        <PaperTradeForm 
          onSubmit={(data) => placeOrderMutation.mutate(data)} 
          isSubmitting={placeOrderMutation.isPending} 
        />

        {/* Trades panel */}
        <div>
          <div className="flex gap-2 mb-4">
            {['open', 'closed'].map(t => (
              <button key={t} onClick={() => setTab(t)} 
                className={`btn btn-sm capitalize ${tab === t ? 'bg-accent-dim border-accent-border text-accent' : 'bg-transparent border-border text-text-muted'}`}>
                {t} ({t === 'open' ? openTrades.length : closedTrades.length})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            (tab === 'open' ? openTrades : closedTrades).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[240px] glass-panel border-dashed border-white/10">
                <div className="text-[32px] mb-3 opacity-80 filter drop-shadow-lg">{tab === 'open' ? '📋' : '📜'}</div>
                <div className="text-text-muted text-[13px] font-medium">No {tab} trades yet</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(tab === 'open' ? openTrades : closedTrades).map(t => (
                  <TradeCard 
                    key={t.id} 
                    trade={t} 
                    ltp={livePrices[t.symbol]}
                    onClose={(trade, exitPrice) => closeOrderMutation.mutateAsync({ trade, exitPrice })} 
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
        </div>
      )}
    </div>
  )
}

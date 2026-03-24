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
import { Loader2, Activity, LayoutDashboard, TrendingUp, TrendingDown, Wallet, DollarSign, RefreshCw } from 'lucide-react'
import { fetchCurrentPrice } from '../lib/tradeUtils'

export default function PaperTradePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState('terminal')
  const [tab, setTab] = useState('open')
  const [livePrices, setLivePrices] = useState({})

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
  }, [trades, queryClient])

  // Realtime Subscriptions
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paper_trades', filter: `user_id=eq.${user.id}` },
        () => {
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

  // Reset Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('paper_trades')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Paper trading session reset!')
      queryClient.invalidateQueries({ queryKey: ['paper_trades', user.id] })
    },
    onError: (e) => toast.error(e.message || 'Reset failed')
  })

  const handleReset = () => {
    if (!window.confirm('Reset your entire paper trading session? This will delete ALL trades.')) return
    resetMutation.mutate()
  }

  return (
    <div className={`mx-auto fade-in h-full relative ${viewMode === 'terminal' ? 'p-0 flex flex-col' : 'p-6 max-w-[1100px]'}`}>
      
      {/* Top Header */}
      <div className={`flex items-center justify-between mb-6 ${viewMode === 'terminal' ? 'px-6 py-4 bg-[#111118] border-b border-white/[0.07] z-10 relative' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-head text-[22px] font-semibold text-white tracking-tight">Paper Trading</h1>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[rgba(52,212,138,0.1)] border border-[rgba(52,212,138,0.3)] text-[#34d48a] flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#34d48a] animate-pulse" />
              Virtual - Zero Risk
            </span>
          </div>

          <div className="h-5 w-[1px] bg-white/[0.07] mx-2 hidden sm:block" />
          
          <div className="flex bg-[#0a0a0f] p-1 rounded-lg border border-white/[0.07]">
            <button 
              onClick={() => setViewMode('terminal')} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${viewMode === 'terminal' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
            >
              <Activity size={14} /> F&O Terminal
            </button>
            <button 
              onClick={() => setViewMode('journal')} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${viewMode === 'journal' ? 'bg-[#18181f] text-white' : 'text-text-muted hover:text-white'}`}
            >
              <LayoutDashboard size={14} /> Dashboard
            </button>
          </div>
        </div>

        {viewMode === 'journal' && (
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending || trades.length === 0}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.3)] text-[#f7614f] hover:bg-[rgba(247,97,79,0.15)] transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw size={12} className={resetMutation.isPending ? 'animate-spin' : ''} /> Reset session
          </button>
        )}
      </div>

      {viewMode === 'terminal' ? (
        <div className="flex-1 px-4 pb-4">
          <TerminalTab onTradeAdded={() => queryClient.invalidateQueries({ queryKey: ['paper_trades', user.id] })} />
        </div>
      ) : (
        <div className="fade-in">
          {/* Capital Metrics */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Virtual Capital', value: INR(VIRTUAL_CAPITAL), icon: Wallet, color: 'white' },
              { label: 'In Positions', value: INR(invested), icon: Activity, color: 'white' },
              { label: 'Available', value: INR(Math.max(0, available)), icon: DollarSign, color: '#4f8ef7' },
              { label: 'Realised P&L', value: INR(totalPnL), icon: totalPnL >= 0 ? TrendingUp : TrendingDown, pnl: totalPnL },
            ].map((m, i) => (
              <div key={i} className="bg-[#111118] border border-white/[0.07] rounded-xl p-5 hover:border-white/[0.14] transition-all duration-150">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon size={14} className="text-text-dim" />
                  <div className="text-[10px] font-bold tracking-wider text-text-muted uppercase">{m.label}</div>
                </div>
                <div className={`text-[22px] font-bold font-mono tabular-nums ${m.pnl !== undefined ? (m.pnl >= 0 ? 'text-[#34d48a]' : 'text-[#f7614f]') : `text-[${m.color}]`}`}>
                  {m.pnl !== undefined && m.pnl >= 0 && '+'}
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[380px_1fr] gap-5">
            {/* Order Form */}
            <PaperTradeForm 
              onSubmit={(data) => placeOrderMutation.mutate(data)} 
              isSubmitting={placeOrderMutation.isPending} 
            />

            {/* Trades Panel */}
            <div>
              <div className="flex gap-2 mb-4">
                {['open', 'closed'].map(t => (
                  <button 
                    key={t} 
                    onClick={() => setTab(t)} 
                    className={`px-4 py-2 text-[12px] font-medium rounded-lg border transition-all duration-150 capitalize ${
                      tab === t 
                        ? 'bg-[rgba(79,142,247,0.08)] border-[rgba(79,142,247,0.3)] text-[#4f8ef7]' 
                        : 'bg-transparent border-white/[0.07] text-text-muted hover:text-white hover:border-white/[0.14]'
                    }`}
                  >
                    {t} ({t === 'open' ? openTrades.length : closedTrades.length})
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4f8ef7]" />
                </div>
              ) : (
                (tab === 'open' ? openTrades : closedTrades).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[240px] bg-[#111118] border border-dashed border-white/[0.14] rounded-xl">
                    <div className="text-[32px] mb-3 opacity-60">{tab === 'open' ? '&#128203;' : '&#128220;'}</div>
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

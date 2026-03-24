import { useState, useEffect } from 'react'
import { INR, cn } from '../../../lib/utils'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import { MessageSquare, Save, Tag } from 'lucide-react'

export default function TradeCard({ trade, ltp: propLtp, onClose }) {
  const [exitPrice, setExitPrice] = useState('')
  const [closing, setClosing] = useState(false)
  const ltp = propLtp
  const ltpLoading = trade.status === 'open' && !ltp
  
  // Journal state
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(trade.notes || '')
  const [tags, setTags] = useState(trade.tags || [])
  const [savingNotes, setSavingNotes] = useState(false)
  const [newTag, setNewTag] = useState('')

  const tagOptions = ['FOMO', 'Revenge Trade', 'Followed Plan', 'Missed Entry', 'Great Exit', 'News Catalyst']

  const unrealisedPnL = ltp
    ? (trade.trade_type === 'buy'
      ? (ltp - trade.entry_price) * trade.quantity
      : (trade.entry_price - ltp) * trade.quantity)
    : null

  const pnlEstimate = exitPrice
    ? (trade.trade_type === 'buy' ? (Number(exitPrice) - trade.entry_price) : (trade.entry_price - Number(exitPrice))) * trade.quantity
    : null

  const saveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase.from('paper_trades').update({ notes, tags }).eq('id', trade.id)
    if (error) toast.error('Failed to save notes')
    else toast.success('Journal updated')
    setSavingNotes(false)
  }

  const toggleTag = (t) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  return (
    <div className="glass-panel p-[16px_18px] group hover:border-white/10 transition-all duration-300 relative overflow-hidden">
      {/* subtle status indicator line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[2px] opacity-50", trade.status === 'open' ? (unrealisedPnL >= 0 ? "bg-green" : "bg-red") : "bg-text-dim")} />
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex gap-2 items-center">
            <span className="font-head font-bold text-white text-[15px] tracking-tight">{trade.symbol}</span>
            <span className={cn("badge", trade.trade_type === 'buy' ? 'badge-green' : 'badge-red')}>
              {trade.trade_type}
            </span>
            <span className="badge badge-blue">{trade.instrument}</span>
          </div>
          <div className="text-[11px] font-mono text-text-dim mt-1.5 flex gap-2">
            {trade.strike_price && <span>STRK: <span className="text-text-muted">{trade.strike_price}</span></span>}
            {trade.expiry_date && <span>EXP: <span className="text-text-muted">{trade.expiry_date}</span></span>}
            <span>QTY: <span className="text-white">{trade.quantity}</span></span>
          </div>
        </div>

        {trade.status === 'closed' && (
          <div className="text-right">
            <div className={cn("text-[15px] font-mono font-bold tracking-tight", Number(trade.pnl) >= 0 ? "text-green drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" : "text-red drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]")}>
              {Number(trade.pnl) >= 0 ? '+' : ''}{INR(trade.pnl)}
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-0.5">EX: ₹{trade.exit_price}</div>
          </div>
        )}

        {/* Unrealised P&L for open trades */}
        {trade.status === 'open' && (
          <div className="text-right">
            {ltpLoading ? (
              <div className="text-[11px] text-text-dim font-mono animate-pulse">Fetching...</div>
            ) : ltp ? (
              <>
                <div className={cn("text-[15px] font-mono font-bold tracking-tight transition-colors duration-300", unrealisedPnL >= 0 ? "text-green drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" : "text-red drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]")}>
                  {unrealisedPnL >= 0 ? '+' : ''}{INR(unrealisedPnL)}
                </div>
                <div className="text-[11px] text-text-muted font-mono mt-0.5">LTP: ₹{ltp?.toLocaleString('en-IN')}</div>
              </>
            ) : (
              <div className="text-[11px] text-text-dim font-mono">LTP n/a</div>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex gap-5 text-[11px] font-mono text-text-dim", trade.status === 'open' ? "mb-4" : "")}>
        <span>EN: <span className="text-text-muted">₹{Number(trade.entry_price).toLocaleString('en-IN')}</span></span>
        <span>VAL: <span className="text-text-muted">{INR(Number(trade.entry_price) * trade.quantity)}</span></span>
        <span>{new Date(trade.opened_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {trade.status === 'open' && (
        <div className="flex gap-2 items-center bg-black/20 p-2 rounded-lg border border-white/5">
          <input
            type="number"
            placeholder="Exit price"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="flex-1 py-2 px-3 text-[13px] font-mono bg-transparent border border-white/10 rounded-md focus:border-accent-border focus:bg-white/5 outline-none transition-all placeholder:text-text-dim placeholder:font-sans"
          />
          {pnlEstimate !== null && (
            <span className={cn("text-[13px] font-mono font-bold min-w-[80px] text-right pr-2", pnlEstimate >= 0 ? "text-green" : "text-red")}>
              {pnlEstimate >= 0 ? '+' : ''}{INR(pnlEstimate)}
            </span>
          )}
          <button
            className="btn btn-sm !border-none !text-red !bg-red-dim hover:!bg-red hover:!text-white transition-all duration-300 disabled:opacity-30 px-4"
            onClick={async () => {
              if (!exitPrice) return
              setClosing(true)
              await onClose(trade, Number(exitPrice))
              setClosing(false)
            }}
            disabled={!exitPrice || closing}
          >
            {closing ? <span className="spinner w-3 h-3 border-t-red" /> : 'CLOSE'}
          </button>
        </div>
      )}

      {/* Journal Section for Closed Trades */}
      {trade.status === 'closed' && (
        <div className="mt-3 pt-3 border-t border-border">
          <button 
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> 
            {showNotes ? 'Hide Journal' : notes || tags.length > 0 ? 'Edit Journal' : 'Add Journal Notes'}
            {(!showNotes && tags.length > 0) && (
              <span className="ml-2 flex gap-1">
                {tags.slice(0, 2).map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-bg-elevated border border-border rounded text-[9px]">{t}</span>
                ))}
                {tags.length > 2 && <span className="text-[10px] text-text-dim">+{tags.length - 2}</span>}
              </span>
            )}
          </button>

          {showNotes && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-1">
              <label className="text-[11px] mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tagOptions.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors border ${
                      tags.includes(t) 
                        ? 'bg-accent text-white border-accent' 
                        : 'bg-bg border-border text-text-muted hover:text-text'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <form 
                  onSubmit={(e) => { e.preventDefault(); if (newTag && !tags.includes(newTag)) toggleTag(newTag); setNewTag('') }}
                  className="flex"
                >
                  <input 
                    placeholder="+ custom tag" 
                    value={newTag} onChange={e => setNewTag(e.target.value)}
                    className="w-24 px-1.5 py-1 text-[10px] bg-bg border border-border rounded-md outline-none focus:border-accent-border h-full"
                  />
                </form>
              </div>

              <div className="flex flex-col gap-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What went well? What went wrong? Log your lessons here..."
                  className="w-full text-xs p-2.5 bg-bg-elevated border border-border rounded-lg min-h-[80px] resize-y placeholder:text-text-muted/50"
                />
                <button 
                  onClick={saveNotes} 
                  disabled={savingNotes || (notes === trade.notes && JSON.stringify(tags) === JSON.stringify(trade.tags || []))}
                  className="self-end flex items-center gap-1.5 btn btn-sm bg-accent-dim text-accent border border-accent/20 hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingNotes ? <span className="spinner w-3 h-3" /> : <Save className="w-3.5 h-3.5" />}
                  Save Journal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

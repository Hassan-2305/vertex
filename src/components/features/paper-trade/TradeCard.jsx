import { useState } from 'react'
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
    <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-4 hover:border-white/[0.14] transition-all duration-150 relative overflow-hidden">
      {/* Status indicator line */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[2px]", 
        trade.status === 'open' 
          ? (unrealisedPnL >= 0 ? "bg-[#34d48a]" : "bg-[#f7614f]") 
          : "bg-text-dim"
      )} />
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex gap-2 items-center">
            <span className="font-head font-bold text-white text-[15px] tracking-tight">{trade.symbol}</span>
            <span className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-md",
              trade.trade_type === 'buy' 
                ? 'bg-[rgba(52,212,138,0.1)] border border-[rgba(52,212,138,0.3)] text-[#34d48a]' 
                : 'bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.3)] text-[#f7614f]'
            )}>
              {trade.trade_type}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[rgba(79,142,247,0.1)] border border-[rgba(79,142,247,0.3)] text-[#4f8ef7]">
              {trade.instrument}
            </span>
          </div>
          <div className="text-[11px] font-mono text-text-dim mt-1.5 flex gap-3">
            {trade.strike_price && <span>STRK: <span className="text-text-muted">{trade.strike_price}</span></span>}
            {trade.expiry_date && <span>EXP: <span className="text-text-muted">{trade.expiry_date}</span></span>}
            <span>QTY: <span className="text-white">{trade.quantity}</span></span>
          </div>
        </div>

        {trade.status === 'closed' && (
          <div className="text-right">
            <div className={cn(
              "text-[15px] font-mono font-bold tabular-nums", 
              Number(trade.pnl) >= 0 ? "text-[#34d48a]" : "text-[#f7614f]"
            )}>
              {Number(trade.pnl) >= 0 ? '+' : ''}{INR(trade.pnl)}
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-0.5">Exit: {trade.exit_price}</div>
          </div>
        )}

        {trade.status === 'open' && (
          <div className="text-right">
            {ltpLoading ? (
              <div className="text-[11px] text-text-dim font-mono animate-pulse">Fetching...</div>
            ) : ltp ? (
              <>
                <div className={cn(
                  "text-[15px] font-mono font-bold tabular-nums", 
                  unrealisedPnL >= 0 ? "text-[#34d48a]" : "text-[#f7614f]"
                )}>
                  {unrealisedPnL >= 0 ? '+' : ''}{INR(unrealisedPnL)}
                </div>
                <div className="text-[11px] text-text-muted font-mono mt-0.5">LTP: {ltp?.toLocaleString('en-IN')}</div>
              </>
            ) : (
              <div className="text-[11px] text-text-dim font-mono">LTP n/a</div>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex gap-4 text-[11px] font-mono text-text-dim", trade.status === 'open' ? "mb-3" : "")}>
        <span>Entry: <span className="text-text-muted">{Number(trade.entry_price).toLocaleString('en-IN')}</span></span>
        <span>Value: <span className="text-text-muted">{INR(Number(trade.entry_price) * trade.quantity)}</span></span>
        <span>{new Date(trade.opened_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {trade.status === 'open' && (
        <div className="flex gap-2 items-center bg-[#0a0a0f] p-2.5 rounded-lg border border-white/[0.07]">
          <input
            type="number"
            placeholder="Exit price"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="flex-1 py-2 px-3 text-[13px] font-mono bg-transparent border border-white/[0.07] rounded-lg text-white focus:border-[#4f8ef7]/50 focus:outline-none transition-colors placeholder:text-text-dim"
          />
          {pnlEstimate !== null && (
            <span className={cn(
              "text-[13px] font-mono font-bold min-w-[80px] text-right pr-2 tabular-nums", 
              pnlEstimate >= 0 ? "text-[#34d48a]" : "text-[#f7614f]"
            )}>
              {pnlEstimate >= 0 ? '+' : ''}{INR(pnlEstimate)}
            </span>
          )}
          <button
            className="px-4 py-2 text-[12px] font-medium rounded-lg bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.3)] text-[#f7614f] hover:bg-[#f7614f] hover:text-white transition-all duration-150 disabled:opacity-30"
            onClick={async () => {
              if (!exitPrice) return
              setClosing(true)
              await onClose(trade, Number(exitPrice))
              setClosing(false)
            }}
            disabled={!exitPrice || closing}
          >
            {closing ? <span className="w-3 h-3 border-2 border-t-transparent border-[#f7614f] rounded-full animate-spin inline-block" /> : 'CLOSE'}
          </button>
        </div>
      )}

      {/* Journal Section */}
      {trade.status === 'closed' && (
        <div className="mt-3 pt-3 border-t border-white/[0.07]">
          <button 
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted hover:text-white transition-colors"
          >
            <MessageSquare size={12} /> 
            {showNotes ? 'Hide Journal' : notes || tags.length > 0 ? 'Edit Journal' : 'Add Journal Notes'}
            {(!showNotes && tags.length > 0) && (
              <span className="ml-2 flex gap-1">
                {tags.slice(0, 2).map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-[#18181f] border border-white/[0.07] rounded text-[9px]">{t}</span>
                ))}
                {tags.length > 2 && <span className="text-[10px] text-text-dim">+{tags.length - 2}</span>}
              </span>
            )}
          </button>

          {showNotes && (
            <div className="mt-3">
              <label className="text-[11px] font-medium text-text-muted mb-1.5 flex items-center gap-1"><Tag size={12} /> Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tagOptions.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-medium transition-colors border",
                      tags.includes(t) 
                        ? 'bg-[#4f8ef7] text-white border-[#4f8ef7]' 
                        : 'bg-[#0a0a0f] border-white/[0.07] text-text-muted hover:text-white hover:border-white/[0.14]'
                    )}
                  >
                    {t}
                  </button>
                ))}
                <form 
                  onSubmit={(e) => { e.preventDefault(); if (newTag && !tags.includes(newTag)) toggleTag(newTag); setNewTag('') }}
                  className="flex"
                >
                  <input 
                    placeholder="+ custom" 
                    value={newTag} 
                    onChange={e => setNewTag(e.target.value)}
                    className="w-20 px-1.5 py-1 text-[10px] bg-[#0a0a0f] border border-white/[0.07] rounded-md text-white focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
                  />
                </form>
              </div>

              <div className="flex flex-col gap-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What went well? What went wrong?"
                  className="w-full text-[12px] p-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg min-h-[80px] resize-y text-white focus:border-[#4f8ef7]/50 focus:outline-none transition-colors placeholder:text-text-dim"
                />
                <button 
                  onClick={saveNotes} 
                  disabled={savingNotes || (notes === trade.notes && JSON.stringify(tags) === JSON.stringify(trade.tags || []))}
                  className="self-end flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-[rgba(79,142,247,0.08)] border border-[rgba(79,142,247,0.25)] text-[#4f8ef7] rounded-lg hover:bg-[rgba(79,142,247,0.12)] transition-colors disabled:opacity-50"
                >
                  {savingNotes ? <span className="w-3 h-3 border-2 border-t-transparent border-[#4f8ef7] rounded-full animate-spin inline-block" /> : <Save size={12} />}
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

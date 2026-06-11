import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { INR } from '../../lib/utils'

let tvScriptLoadingPromise

export default function StockChartModal({ holding, onClose }) {
  const onLoadScriptRef = useRef()
  // Clean symbol to ensure valid HTML ID
  const cleanSymbol = holding.symbol.replace(/[^a-zA-Z0-9]/g, '')
  const containerId = `tv_chart_${cleanSymbol}`

  // ── Init TradingView Advanced Widget ────────────────────────────────────────
  useEffect(() => {
    onLoadScriptRef.current = createWidget

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script')
        script.id = 'tradingview-widget-loading-script'
        script.src = 'https://s3.tradingview.com/tv.js'
        script.type = 'text/javascript'
        script.onload = resolve
        document.head.appendChild(script)
      })
    }

    tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current())

    return () => {
      onLoadScriptRef.current = null
    }

    function createWidget() {
      if (document.getElementById(containerId) && 'TradingView' in window) {
        const isLight = document.documentElement.classList.contains('light')
        new window.TradingView.widget({
          autosize: true,
          symbol: `NSE:${holding.symbol}`, // Prefix with NSE for Indian stocks (BSE often only has EOD data)
          interval: "15", // Default to 15m intraday, but all minute intervals will now be selectable
          timezone: "Asia/Kolkata",
          theme: isLight ? 'light' : 'dark',
          style: "1", // Candlestick
          locale: "in",
          enable_publishing: false,
          backgroundColor: isLight ? '#ffffff' : '#111118',
          gridColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)",
          hide_top_toolbar: false, // Essential for timeframes & drawing tools
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          toolbar_bg: isLight ? '#f9f9fb' : '#18181f',
        })
      }
    }
  }, [holding.symbol, containerId])

  // ── Close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Stats ───────────────────────────────────────────────────────────────────
  const invested  = Number(holding.avg_buy_price) * Number(holding.quantity)
  const current   = Number(holding.current_price || holding.avg_buy_price) * Number(holding.quantity)
  const pnl       = current - invested
  const pnlPct    = invested > 0 ? (pnl / invested) * 100 : 0
  const isUp      = pnl >= 0

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,6,12,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 1200, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)' }}>
        
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{holding.symbol}</span>
              <span style={{ fontSize: 11, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', padding: '2px 8px', borderRadius: 20 }}>
                {holding.holding_type}
              </span>
            </div>
            {holding.company_name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{holding.company_name}</div>}
          </div>

          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
              <div>
                 <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Price</div>
                 <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>₹{Number(holding.avg_buy_price).toLocaleString('en-IN')}</div>
              </div>
              <div>
                 <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L</div>
                 <div style={{ fontSize: 14, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                   {isUp ? '+' : ''}{INR(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                 </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Real TradingView Advanced Chart ── */}
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
          <div id={containerId} style={{ position: 'absolute', inset: 0 }} />
        </div>

      </div>
    </div>,
    document.body
  )
}

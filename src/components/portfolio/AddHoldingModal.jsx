import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Loader2, X } from 'lucide-react'
import { fetchCurrentPrice } from '../../lib/tradeUtils'

// ── In-memory response cache ──────────────────────────────────────────────────
const SEARCH_CACHE = new Map()

// ── Stock search via Yahoo Finance ────────────────────────────────────────────
async function searchStocks(query, signal) {
  if (!query || query.length < 2) return []
  const key = query.trim().toLowerCase()
  if (SEARCH_CACHE.has(key)) return SEARCH_CACHE.get(key)
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-IN&region=IN&quotesCount=10&newsCount=0&listsCount=0`
    // corsproxy.io is noticeably faster than allorigins.win
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal })
    const data = await res.json()
    const results = (data?.quotes || []).filter(q =>
      q.quoteType === 'EQUITY' &&
      (q.exchange === 'NSI' || q.exchange === 'BSE' || q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO'))
    ).map(q => ({
      symbol: q.symbol,
      ticker: q.symbol.replace(/\.(NS|BO)$/, ''),
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange === 'NSI' ? 'NSE' : 'BSE',
    }))
    SEARCH_CACHE.set(key, results)
    return results
  } catch (e) {
    if (e.name === 'AbortError') return null // cancelled, not an error
    return []
  }
}

// ── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ── Symbol Search Input Component ─────────────────────────────────────────────
function StockSearchInput({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selected, setSelected] = useState(false)
  const wrapperRef = useRef(null)
  const abortRef = useRef(null)          // holds the current AbortController
  const debouncedQuery = useDebounce(query, 180) // tighter debounce

  // Search whenever debounced query changes
  useEffect(() => {
    if (selected) return
    if (debouncedQuery.length < 2) { setResults([]); setShowDropdown(false); return }

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    searchStocks(debouncedQuery, controller.signal).then(r => {
      if (r === null) return // aborted — don't update state
      setResults(r)
      setShowDropdown(r.length > 0)
      setSearching(false)
    })
    return () => controller.abort()
  }, [debouncedQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (stock) => {
    setQuery(stock.ticker)
    setShowDropdown(false)
    setSelected(true)
    onChange(stock.symbol)          // update symbol field with full symbol (e.g. KAYNES.NS)
    onSelect(stock)                 // auto-fill company name + current price
  }

  const handleChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setSelected(false)
    onChange(v)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setSelected(false)
    onChange('')
    onSelect(null)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          style={{ paddingLeft: 30, paddingRight: query ? 28 : 12 }}
          placeholder="Search stocks… e.g. Kaynes"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          autoComplete="off"
        />
        {searching && (
          <Loader2 style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)', animation: 'spin 0.6s linear infinite' }} />
        )}
        {query && !searching && (
          <button
            type="button"
            onClick={clear}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
          >
            <X style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 200, overflow: 'hidden', maxHeight: 280, overflowY: 'auto'
        }}>
          {results.map(stock => (
            <button
              key={stock.symbol}
              type="button"
              onMouseDown={() => handleSelect(stock)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '9px 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>
                  {stock.ticker}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {stock.name}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px',
                borderRadius: 4, background: 'var(--accent-dim)',
                color: 'var(--accent)', border: '1px solid var(--accent-border)',
                flexShrink: 0, marginLeft: 8
              }}>
                {stock.exchange}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function AddHoldingModal({ userId, brokers, holding = null, onClose }) {
  const isEdit = holding !== null
  const [form, setForm] = useState({
    broker_account_id: holding?.broker_account_id || brokers[0]?.id || '',
    symbol: holding?.symbol || '',
    company_name: holding?.company_name || '',
    holding_type: holding?.holding_type || 'stock',
    quantity: holding?.quantity || '',
    avg_buy_price: holding?.avg_buy_price || '',
    current_price: holding?.current_price || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [existingHolding, setExistingHolding] = useState(null) // detected duplicate

  // Check for existing holding with same symbol+broker whenever symbol/broker changes
  useEffect(() => {
    if (isEdit || !form.symbol || !form.broker_account_id) { setExistingHolding(null); return }
    supabase
      .from('holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', form.symbol.toUpperCase())
      .eq('broker_account_id', form.broker_account_id)
      .maybeSingle()
      .then(({ data }) => setExistingHolding(data || null))
  }, [form.symbol, form.broker_account_id, isEdit, userId])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const newQty    = Number(form.quantity)
    const newPrice  = Number(form.avg_buy_price)
    const curPrice  = Number(form.current_price || form.avg_buy_price)

    let error
    if (isEdit) {
      // Plain edit – no merging needed
      const payload = {
        broker_account_id: form.broker_account_id,
        symbol: form.symbol.toUpperCase(),
        company_name: form.company_name,
        holding_type: form.holding_type,
        quantity: newQty,
        avg_buy_price: newPrice,
        current_price: curPrice,
      }
      ;({ error } = await supabase.from('holdings').update(payload).eq('id', holding.id))
    } else if (existingHolding) {
      // ── Weighted-average merge ──────────────────────────────────────────────
      const existQty   = Number(existingHolding.quantity)
      const existPrice = Number(existingHolding.avg_buy_price)
      const mergedQty  = existQty + newQty
      const mergedAvg  = (existQty * existPrice + newQty * newPrice) / mergedQty
      ;({ error } = await supabase.from('holdings').update({
        quantity:      mergedQty,
        avg_buy_price: parseFloat(mergedAvg.toFixed(4)),
        current_price: curPrice, // refresh current price
      }).eq('id', existingHolding.id))
    } else {
      // Brand-new holding
      ;({ error } = await supabase.from('holdings').insert({
        user_id: userId,
        broker_account_id: form.broker_account_id,
        symbol: form.symbol.toUpperCase(),
        company_name: form.company_name,
        holding_type: form.holding_type,
        quantity: newQty,
        avg_buy_price: newPrice,
        current_price: curPrice,
      }))
    }

    if (error) { setError(error.message); setLoading(false); return }
    onClose()
  }

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Called when user picks a result from the autocomplete
  const handleStockSelect = async (stock) => {
    if (!stock) return
    f('symbol', stock.ticker)
    f('company_name', stock.name)

    // Fetch live price automatically — use faster centralized utility
    setFetchingPrice(true)
    try {
      const price = await fetchCurrentPrice(stock.symbol, 'stock')
      if (price) {
        f('current_price', price.toFixed(2))
        f('avg_buy_price', prev => prev || price.toFixed(2)) // only pre-fill if empty
      }
    } catch {/* ignore */}
    setFetchingPrice(false)
  }

  return (
    <div style={overlay}>
      <div style={modal} className="fade-in">
        <div style={header}>
          <h2 style={title}>{isEdit ? 'Edit holding' : 'Add holding'}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        {error && <div style={errBox}>{error}</div>}

        {/* Merge-mode banner — shown when the entered symbol already exists */}
        {existingHolding && form.quantity && form.avg_buy_price && (() => {
          const eQty = Number(existingHolding.quantity)
          const eAvg = Number(existingHolding.avg_buy_price)
          const nQty = Number(form.quantity)
          const nAvg = Number(form.avg_buy_price)
          const mergedQty = eQty + nQty
          const mergedAvg = (eQty * eAvg + nQty * nAvg) / mergedQty
          return (
            <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚡ Averaging into existing position</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                <span>Existing: <b style={{ color: 'var(--text)' }}>{eQty} @ ₹{eAvg.toLocaleString('en-IN')}</b></span>
                <span>Adding: <b style={{ color: 'var(--text)' }}>{nQty} @ ₹{nAvg.toLocaleString('en-IN')}</b></span>
                <span>→ New avg: <b style={{ color: 'var(--accent)' }}>₹{mergedAvg.toFixed(2)}</b> ({mergedQty} shares)</span>
              </div>
            </div>
          )
        })()}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Broker account</label>
              <select value={form.broker_account_id} onChange={e => f('broker_account_id', e.target.value)} required>
                {brokers.map(b => <option key={b.id} value={b.id}>{b.display_name || b.broker_name}</option>)}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select value={form.holding_type} onChange={e => f('holding_type', e.target.value)}>
                <option value="stock">Stock</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="etf">ETF</option>
                <option value="fo">F&O</option>
              </select>
            </div>
          </div>

          {/* Smart Stock Search */}
          <div>
            <label>Search & select stock</label>
            <StockSearchInput
              value={form.symbol}
              onChange={(val) => f('symbol', val)}
              onSelect={handleStockSelect}
            />
          </div>

          {/* Company name auto-filled but editable */}
          <div>
            <label>Company / Fund name</label>
            <input
              placeholder="Auto-filled from search"
              value={form.company_name}
              onChange={e => f('company_name', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label>Quantity</label>
              <input type="number" placeholder="10" min="0" step="0.001" value={form.quantity} onChange={e => f('quantity', e.target.value)} required />
            </div>
            <div>
              <label>Avg buy price (₹)</label>
              <input type="number" placeholder="2800" min="0" step="0.01" value={form.avg_buy_price} onChange={e => f('avg_buy_price', e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Current price (₹)
                {fetchingPrice && <Loader2 style={{ width: 10, height: 10, animation: 'spin 0.6s linear infinite' }} />}
              </label>
              <input type="number" placeholder="Auto-fetched" min="0" step="0.01" value={form.current_price} onChange={e => f('current_price', e.target.value)} />
            </div>
          </div>

          {form.quantity && form.avg_buy_price && (
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--accent)' }}>
              Invested: ₹{(Number(form.quantity) * Number(form.avg_buy_price)).toLocaleString('en-IN')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : (isEdit ? 'Save changes' : 'Add holding')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 520 }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }
const title = { fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }
const closeBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }
const errBox = { background: 'var(--red-dim)', border: '1px solid rgba(247,97,79,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12, marginBottom: 12 }

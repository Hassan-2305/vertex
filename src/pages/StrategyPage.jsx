import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FlaskConical } from 'lucide-react'

const PROMPTS = [
  'Suggest a momentum strategy for Nifty 50 stocks',
  'What is a good intraday strategy for Bank Nifty?',
  'Explain a safe F&O strategy for beginners',
  'Create a swing trading strategy using RSI and EMA',
]

// Lightweight markdown renderer for AI responses
function renderMarkdown(text) {
  const lines = text.split('\n')
  const elements = []
  let key = 0

  for (const line of lines) {
    // Headings
    if (line.startsWith('### ')) {
      elements.push(<div key={key++} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginTop: 14, marginBottom: 4 }}>{inlineParse(line.slice(4))}</div>)
    } else if (line.startsWith('## ')) {
      elements.push(<div key={key++} style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginTop: 14, marginBottom: 4 }}>{inlineParse(line.slice(3))}</div>)
    } else if (line.startsWith('# ')) {
      elements.push(<div key={key++} style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 16, marginBottom: 6 }}>{inlineParse(line.slice(2))}</div>)
    // Bullet points
    } else if (/^[\*\-] /.test(line)) {
      elements.push(<div key={key++} style={{ paddingLeft: 16, marginBottom: 2, display: 'flex', gap: 6 }}><span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span><span>{inlineParse(line.slice(2))}</span></div>)
    // Numbered list
    } else if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split(/\.\s/)
      elements.push(<div key={key++} style={{ paddingLeft: 16, marginBottom: 2, display: 'flex', gap: 6 }}><span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 600 }}>{num}.</span><span>{inlineParse(rest.join('. '))}</span></div>)
    // Horizontal rule
    } else if (line.trim() === '---') {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />)
    // Empty line → spacer
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 6 }} />)
    // Regular paragraph
    } else {
      elements.push(<div key={key++} style={{ marginBottom: 2 }}>{inlineParse(line)}</div>)
    }
  }
  return elements
}

function inlineParse(text) {
  // Split on **bold** and *italic* patterns
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'var(--text)' }}>{part.slice(2, -2)}</strong>
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

// Detect the primary strategy type from an AI response
function detectStrategy(text) {
  const t = text.toLowerCase()
  // Order matters — check more specific ones first
  if (t.includes('supertrend')) return { id: 'supertrend', name: 'Supertrend' }
  if (t.includes('vwap')) return { id: 'vwap_dev', name: 'VWAP Deviation' }
  if (t.includes('bollinger') || t.includes('bb ') || t.includes('band')) return { id: 'bb_breakout', name: 'Bollinger Breakout' }
  if (t.includes('macd')) return { id: 'macd', name: 'MACD Signal' }
  if (t.includes('rsi') && (t.includes('revers') || t.includes('oversold') || t.includes('overbought'))) return { id: 'rsi_reversal', name: 'RSI Reversal' }
  if (t.includes('ema') || t.includes('moving average') || t.includes('crossover')) return { id: 'ema_cross', name: 'EMA Crossover' }
  if (t.includes('rsi')) return { id: 'rsi_reversal', name: 'RSI Reversal' }
  return null
}

// Detect which NSE symbol might be mentioned in the AI response
function detectSymbol(text) {
  const t = text.toUpperCase()
  const symbols = [
    { keywords: ['RELIANCE', 'RELIANCE INDUSTRIES'], sym: 'RELIANCE.NS' },
    { keywords: ['TCS', 'TATA CONSULTANCY'], sym: 'TCS.NS' },
    { keywords: ['INFOSYS', 'INFY'], sym: 'INFY.NS' },
    { keywords: ['HDFC BANK', 'HDFCBANK'], sym: 'HDFCBANK.NS' },
    { keywords: ['SBIN', 'STATE BANK', 'SBI'], sym: 'SBIN.NS' },
    { keywords: ['NIFTY 50', 'NIFTY50', 'NIFTY'], sym: '^NSEI' },
    { keywords: ['BANK NIFTY', 'BANKNIFTY'], sym: '^NSEBANK' },
    { keywords: ['BAJAJ FINANCE', 'BAJFINANCE'], sym: 'BAJFINANCE.NS' },
    { keywords: ['WIPRO'], sym: 'WIPRO.NS' },
  ]
  for (const { keywords, sym } of symbols) {
    if (keywords.some(k => t.includes(k))) return sym
  }
  return null
}

export default function StrategyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hi! I'm your Vertex Strategy AI. I can suggest trading strategies for Indian markets (NSE/BSE), help you build F&O strategies, explain indicators, and create backtestable rules.\n\nWhat kind of strategy are you looking for?"
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: msg })

      // FIXED: Call our Supabase Edge Function instead of the Anthropic API directly.
      // The API key lives securely in Supabase secrets, not in the browser.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strategy-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }

      const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])

      await supabase.from('strategies').insert({
        user_id: user.id,
        name: msg.slice(0, 60),
        description: reply.slice(0, 500),
        source: 'ai',
      })
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e.message || 'Failed to connect to Strategy AI. Make sure the ANTHROPIC_API_KEY is set in your Supabase project secrets.'}`
      }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1.5rem', gap: '1rem', maxWidth: 800 }}>
      <div>
        <h1 style={s.pageTitle}>Strategy AI</h1>
        <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Powered by Llama 3.3 via Groq · Indian markets specialist</p>
      </div>

      {messages.length === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PROMPTS.map((p, i) => (
            <button key={i} onClick={() => send(p)} style={s.promptCard}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p}</span>
            </button>
          ))}
        </div>
      )}

      <div style={s.chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.message, ...(m.role === 'user' ? s.userMsg : s.aiMsg) }}>
            {m.role === 'assistant' && (
              <div style={s.aiLabel}>
                <div style={s.aiDot} />
                Vertex AI
              </div>
            )}
            <div style={{ fontSize: 13, lineHeight: 1.7, color: m.role === 'user' ? 'white' : 'var(--text)' }}>
              {m.role === 'user' ? m.content : renderMarkdown(m.content)}
            </div>
            {m.role === 'assistant' && i > 0 && (() => {
              const strat = detectStrategy(m.content)
              if (!strat) return null
              const sym = detectSymbol(m.content)
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({ strategy: strat.id })
                      if (sym) params.set('symbol', sym)
                      navigate(`/backtest?${params.toString()}`)
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8, color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <FlaskConical size={13} />
                    Test "{strat.name}" on Backtest{sym ? ` · ${sym.replace('.NS', '')}` : ''}
                  </button>
                </div>
              )
            })()}
          </div>
        ))}
        {loading && (
          <div style={{ ...s.message, ...s.aiMsg }}>
            <div style={s.aiLabel}><div style={s.aiDot} />Vertex AI</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s ease infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.inputRow}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about trading strategies for Indian markets..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  )
}

const s = {
  pageTitle: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 600, color: 'var(--text)' },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 },
  message: { padding: '12px 14px', borderRadius: 10, maxWidth: '85%' },
  aiMsg: { background: 'var(--bg-card)', border: '1px solid var(--border)', alignSelf: 'flex-start', width: '100%', maxWidth: '100%' },
  userMsg: { background: 'var(--accent)', alignSelf: 'flex-end', borderRadius: '10px 10px 2px 10px' },
  aiLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 },
  aiDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease infinite' },
  inputRow: { display: 'flex', gap: 8 },
  promptCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' },
}

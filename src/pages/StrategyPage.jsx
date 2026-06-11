import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FlaskConical, Send, Sparkles } from 'lucide-react'

const PROMPTS = [
  { label: 'Momentum Strategy', text: 'Suggest a momentum strategy for Nifty 50 stocks' },
  { label: 'Intraday Bank Nifty', text: 'What is a good intraday strategy for Bank Nifty?' },
  { label: 'Safe F&O Strategy', text: 'Explain a safe F&O strategy for beginners' },
  { label: 'Swing Trading', text: 'Create a swing trading strategy using RSI and EMA' },
]

function renderMarkdown(text) {
  const lines = text.split('\n')
  const elements = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('### ')) {
      elements.push(<div key={key++} className="font-bold text-[14px] text-white mt-3.5 mb-1">{inlineParse(line.slice(4))}</div>)
    } else if (line.startsWith('## ')) {
      elements.push(<div key={key++} className="font-bold text-[15px] text-white mt-3.5 mb-1">{inlineParse(line.slice(3))}</div>)
    } else if (line.startsWith('# ')) {
      elements.push(<div key={key++} className="font-bold text-[16px] text-white mt-4 mb-1.5">{inlineParse(line.slice(2))}</div>)
    } else if (/^[\*\-] /.test(line)) {
      elements.push(<div key={key++} className="pl-4 mb-0.5 flex gap-1.5"><span className="text-[#4f8ef7] shrink-0">&#8226;</span><span>{inlineParse(line.slice(2))}</span></div>)
    } else if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split(/\.\s/)
      elements.push(<div key={key++} className="pl-4 mb-0.5 flex gap-1.5"><span className="text-[#4f8ef7] shrink-0 font-semibold">{num}.</span><span>{inlineParse(rest.join('. '))}</span></div>)
    } else if (line.trim() === '---') {
      elements.push(<hr key={key++} className="border-t border-white/[0.07] my-2" />)
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />)
    } else {
      elements.push(<div key={key++} className="mb-0.5">{inlineParse(line)}</div>)
    }
  }
  return elements
}

function inlineParse(text) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function detectStrategy(text) {
  const t = text.toLowerCase()
  if (t.includes('supertrend')) return { id: 'supertrend', name: 'Supertrend' }
  if (t.includes('vwap')) return { id: 'vwap_dev', name: 'VWAP Deviation' }
  if (t.includes('bollinger') || t.includes('bb ') || t.includes('band')) return { id: 'bb_breakout', name: 'Bollinger Breakout' }
  if (t.includes('macd')) return { id: 'macd', name: 'MACD Signal' }
  if (t.includes('rsi') && (t.includes('revers') || t.includes('oversold') || t.includes('overbought'))) return { id: 'rsi_reversal', name: 'RSI Reversal' }
  if (t.includes('ema') || t.includes('moving average') || t.includes('crossover')) return { id: 'ema_cross', name: 'EMA Crossover' }
  if (t.includes('rsi')) return { id: 'rsi_reversal', name: 'RSI Reversal' }
  return null
}

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

// Animated dot grid background
function DotGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, #4f8ef7 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />
    </div>
  )
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
        content: `Error: ${e.message || 'Failed to connect to Strategy AI.'}`
      }])
    }
    setLoading(false)
  }

  const showPrompts = messages.length === 1

  return (
    <div className="h-full flex relative">
      <DotGrid />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4 md:p-6 relative z-10">
        <div className="mb-4">
          <h1 className="font-head text-[22px] font-semibold text-white tracking-tight">Strategy AI</h1>
          <p className="text-text-muted text-[12px] mt-1">Powered by Llama 3.3 via Groq - Indian markets specialist</p>
        </div>

        {/* Prompt Suggestions (shown when empty) */}
        {showPrompts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {PROMPTS.map((p, i) => (
              <button 
                key={i} 
                onClick={() => send(p.text)} 
                className="p-4 bg-[#111118] border border-white/[0.07] rounded-xl text-left hover:border-white/[0.14] hover:bg-[#18181f] transition-all duration-150 group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles size={12} className="text-[#4f8ef7] opacity-60 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[12px] font-medium text-white">{p.label}</span>
                </div>
                <div className="text-[11px] text-text-muted leading-relaxed">{p.text}</div>
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : ''}`}
            >
              {m.role === 'assistant' ? (
                <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34d48a] animate-pulse" />
                    <span className="text-[10px] font-medium text-text-muted">Vertex AI</span>
                  </div>
                  <div className="text-[13px] leading-relaxed text-text-muted">
                    {renderMarkdown(m.content)}
                  </div>
                  
                  {/* Backtest CTA */}
                  {i > 0 && (() => {
                    const strat = detectStrategy(m.content)
                    if (!strat) return null
                    const sym = detectSymbol(m.content)
                    return (
                      <div className="mt-3 pt-3 border-t border-white/[0.07]">
                        <button
                          onClick={() => {
                            const params = new URLSearchParams({ strategy: strat.id })
                            if (sym) params.set('symbol', sym)
                            navigate(`/dashboard/backtest?${params.toString()}`)
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-[rgba(79,142,247,0.08)] border border-[rgba(79,142,247,0.25)] rounded-lg text-[#4f8ef7] text-[12px] font-medium hover:bg-[rgba(79,142,247,0.12)] transition-colors"
                        >
                          <FlaskConical size={13} />
                          Test "{strat.name}" on Backtest{sym ? ` - ${sym.replace('.NS', '')}` : ''}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="bg-[#4f8ef7] rounded-xl rounded-br-sm p-4">
                  <div className="text-[13px] leading-relaxed text-white">{m.content}</div>
                </div>
              )}
            </div>
          ))}
          
          {/* Typing Indicator */}
          {loading && (
            <div className="max-w-[85%]">
              <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34d48a] animate-pulse" />
                  <span className="text-[10px] font-medium text-text-muted">Vertex AI</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className="w-2 h-2 rounded-full bg-[#4f8ef7]"
                      style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about trading strategies for Indian markets..."
            disabled={loading}
            className="flex-1 py-3 px-4 bg-[#111118] border border-white/[0.07] rounded-xl text-white text-[13px] placeholder:text-text-dim focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
          />
          <button 
            className="px-4 bg-[#4f8ef7] rounded-xl text-white font-medium hover:bg-[#5d9af8] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,142,247,0.25)]"
            onClick={() => send()} 
            disabled={loading || !input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-center text-[10px] text-text-dim mt-2">Press Enter to send</div>
      </div>

      {/* Right Sidebar - Quick Prompts */}
      <div className="w-[180px] shrink-0 bg-[#111118] border-l border-white/[0.07] p-4 hidden lg:block">
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">Quick Prompts</div>
        <div className="space-y-2">
          {[
            'Top 5 momentum stocks',
            'Explain RSI indicator',
            'Best time to trade F&O',
            'Risk management tips',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => send(prompt)}
              className="w-full p-2.5 text-left text-[11px] text-text-muted bg-[#0a0a0f] border border-white/[0.07] rounded-lg hover:border-white/[0.14] hover:text-white transition-all duration-150"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

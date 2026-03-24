import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Shield, Cpu, TrendingUp } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await signUp(form.email, form.password, form.name)
        if (error) throw error
        setSuccess('Check your email to confirm your account!')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSuccess('Password reset link sent! Check your email.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Animated Terminal Grid Background */}
      <TerminalGrid />
      
      {/* Ghost Candlestick Chart Background */}
      <GhostCandlesticks />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Animated Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <AnimatedLogo />
          <TypewriterText text="Vertex" />
          <FadeInTagline />
        </div>

        {/* Glassmorphism Auth Card */}
        <div className="relative rounded-2xl p-8 fade-in" style={{
          background: 'rgba(17, 17, 24, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)'
        }}>
          {/* Login/Signup Tabs */}
          {mode !== 'forgot' && (
            <div className="flex gap-1 mb-8 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <button
                onClick={() => setMode('login')}
                className="flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-150"
                style={{
                  background: mode === 'login' ? 'var(--accent)' : 'transparent',
                  color: mode === 'login' ? '#0a0a0f' : 'var(--text-muted)'
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className="flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-150"
                style={{
                  background: mode === 'signup' ? 'var(--accent)' : 'transparent',
                  color: mode === 'signup' ? '#0a0a0f' : 'var(--text-muted)'
                }}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <h2 className="text-xl font-semibold text-center mb-6" style={{ fontFamily: 'var(--font-head)' }}>
              Reset Password
            </h2>
          )}

          {error && (
            <div className="mb-6 p-3 rounded-lg text-sm" style={{
              background: 'var(--red-dim)',
              border: '1px solid rgba(247, 97, 79, 0.3)',
              color: 'var(--red)'
            }}>
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-3 rounded-lg text-sm" style={{
              background: 'var(--green-dim)',
              border: '1px solid rgba(52, 212, 138, 0.3)',
              color: 'var(--green)'
            }}>
              {success}
            </div>
          )}

          <form onSubmit={handle} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label>Full Name</label>
                <input 
                  type="text" 
                  placeholder="Your name" 
                  value={form.name} 
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} 
                  required 
                />
              </div>
            )}
            <div>
              <label>Email</label>
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={form.email} 
                onChange={e => setForm(f => ({...f, email: e.target.value}))} 
                required 
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label>Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={form.password} 
                  onChange={e => setForm(f => ({...f, password: e.target.value}))} 
                  required 
                />
              </div>
            )}
            <button 
              type="submit" 
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-150 mt-2"
              style={{
                background: 'var(--accent)',
                color: '#0a0a0f',
                boxShadow: '0 0 20px rgba(79, 142, 247, 0.3)'
              }}
              disabled={loading}
            >
              {loading ? <span className="spinner" />
                : mode === 'login' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
              
              <button 
                onClick={async () => {
                  setLoading(true)
                  try {
                    const { error } = await signInWithGoogle()
                    if (error) throw error
                  } catch (err) {
                    setError(err.message)
                    setLoading(false)
                  }
                }}
                className="w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-3 transition-all duration-150 hover:border-white/20"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <div className="text-center mt-6">
            {mode === 'login' && (
              <button 
                onClick={() => setMode('forgot')} 
                className="text-sm transition-colors duration-150 hover:text-white"
                style={{ color: 'var(--text-muted)' }}
              >
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button 
                onClick={() => setMode('login')} 
                className="text-sm transition-colors duration-150"
                style={{ color: 'var(--accent)' }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap justify-center gap-3 mt-8 fade-in" style={{ animationDelay: '0.6s', opacity: 0 }}>
          <FeatureBadge icon={<TrendingUp size={14} />} text="NSE/BSE Live Data" />
          <FeatureBadge icon={<Cpu size={14} />} text="AI Strategy Engine" />
          <FeatureBadge icon={<Shield size={14} />} text="F&O Paper Trading" />
        </div>

        {/* Footer */}
        <p className="text-center mt-8 text-xs fade-in" style={{ 
          color: 'var(--text-dim)', 
          animationDelay: '0.8s', 
          opacity: 0 
        }}>
          Built for Indian markets · NSE · BSE · F&O
        </p>
      </div>
    </div>
  )
}

// Animated Logo Component with all effects
function AnimatedLogo() {
  const [isHovered, setIsHovered] = useState(false)
  const [particles, setParticles] = useState([])
  const particleIdRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const newParticle = {
        id: particleIdRef.current++,
        x: Math.random() * 40 - 20,
        delay: Math.random() * 0.5
      }
      setParticles(prev => [...prev.slice(-12), newParticle])
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div 
      className="relative float-animation cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Rotating Gradient Border */}
      <div className="absolute inset-[-8px] rounded-full rotate-gradient" style={{
        background: 'conic-gradient(from 0deg, transparent, rgba(79, 142, 247, 0.5), transparent, rgba(79, 142, 247, 0.3), transparent)',
        opacity: 0.6
      }} />
      
      {/* Glow Effect on Hover */}
      <div 
        className="absolute inset-[-20px] rounded-full transition-opacity duration-300"
        style={{
          background: 'radial-gradient(circle, rgba(79, 142, 247, 0.4) 0%, transparent 70%)',
          opacity: isHovered ? 1 : 0.3
        }}
      />

      {/* Particles Rising */}
      <div className="absolute inset-0 pointer-events-none overflow-visible">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute"
            style={{
              left: `calc(50% + ${particle.x}px)`,
              bottom: '10px',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: isHovered ? '#ffffff' : 'var(--accent)',
              boxShadow: `0 0 6px ${isHovered ? '#ffffff' : 'var(--accent)'}`,
              animation: `particleRise 1.5s ease-out forwards`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>

      {/* Main Logo SVG */}
      <div className={`relative z-10 ${isHovered ? 'glow-animation' : ''}`}>
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
          {/* Head/Circle */}
          <circle 
            cx="50" 
            cy="22" 
            r="12" 
            fill="var(--accent)"
            style={{
              filter: isHovered ? 'drop-shadow(0 0 15px rgba(79, 142, 247, 0.8))' : 'none',
              transition: 'filter 0.3s ease'
            }}
          />
          {/* V/Chevron Body */}
          <path 
            d="M20 38 L50 90 L80 38 L65 38 L50 68 L35 38 Z" 
            fill="var(--accent)"
            style={{
              filter: isHovered ? 'drop-shadow(0 0 20px rgba(79, 142, 247, 0.8))' : 'none',
              transition: 'filter 0.3s ease'
            }}
          />
          {/* Tip Glow Effect */}
          {isHovered && (
            <circle 
              cx="50" 
              cy="90" 
              r="8" 
              fill="rgba(79, 142, 247, 0.4)"
              style={{ filter: 'blur(8px)' }}
            />
          )}
        </svg>
      </div>
    </div>
  )
}

// Typewriter Text Component
function TypewriterText({ text }) {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index <= text.length) {
        setDisplayText(text.slice(0, index))
        index++
      } else {
        clearInterval(timer)
        setTimeout(() => setShowCursor(false), 1000)
      }
    }, 120)

    return () => clearInterval(timer)
  }, [text])

  return (
    <h1 
      className="text-4xl font-bold mt-6 tracking-wide"
      style={{ 
        fontFamily: 'var(--font-head)',
        color: 'var(--text)',
        textShadow: '0 0 30px rgba(79, 142, 247, 0.3)'
      }}
    >
      {displayText}
      <span 
        className="inline-block w-0.5 h-8 ml-1 align-middle"
        style={{
          background: showCursor ? 'var(--accent)' : 'transparent',
          animation: showCursor ? 'blink 0.8s infinite' : 'none'
        }}
      />
    </h1>
  )
}

// Fade-in Tagline Component
function FadeInTagline() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <p 
      className="text-sm mt-3 transition-all duration-700"
      style={{ 
        color: 'var(--text-muted)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)'
      }}
    >
      Institutional-grade trading for Indian markets
    </p>
  )
}

// Terminal Grid Background
function TerminalGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(79, 142, 247, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79, 142, 247, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }}
      />
      {/* Radial fade overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, #0a0a0f 70%)'
        }}
      />
    </div>
  )
}

// Ghost Candlesticks Background
function GhostCandlesticks() {
  const candles = Array.from({ length: 40 }, (_, i) => ({
    x: i * 30,
    height: 20 + Math.random() * 60,
    y: 100 + Math.random() * 200,
    isGreen: Math.random() > 0.5
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.05 }}>
      <svg 
        className="absolute bottom-0 left-0 w-[200%] h-full"
        style={{ animation: 'candlestickFloat 60s linear infinite' }}
      >
        {candles.map((candle, i) => (
          <g key={i}>
            {/* Wick */}
            <line
              x1={candle.x + 4}
              y1={candle.y - 10}
              x2={candle.x + 4}
              y2={candle.y + candle.height + 10}
              stroke={candle.isGreen ? '#34d48a' : '#f7614f'}
              strokeWidth="1"
            />
            {/* Body */}
            <rect
              x={candle.x}
              y={candle.y}
              width="8"
              height={candle.height}
              fill={candle.isGreen ? '#34d48a' : '#f7614f'}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

// Feature Badge Component
function FeatureBadge({ icon, text }) {
  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: 'rgba(79, 142, 247, 0.08)',
        border: '1px solid rgba(79, 142, 247, 0.2)',
        color: 'var(--accent)'
      }}
    >
      {icon}
      {text}
    </div>
  )
}

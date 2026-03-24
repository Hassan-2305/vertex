import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

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
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.box} className="fade-in">
        <div style={styles.logoRow}>
          <VertexLogo size={36} />
          <span style={styles.logoText}>Vertex</span>
        </div>

        <h1 style={styles.title}>
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </h1>
        <p style={styles.sub}>
          {mode === 'login' ? 'Sign in to your trading dashboard'
            : mode === 'signup' ? 'Start tracking your Indian portfolio'
            : 'Enter your email to receive a reset link'}
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <div>
              <label>Full name</label>
              <input type="text" placeholder="Hassan" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
          )}
          <div>
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4 }} disabled={loading}>
            {loading ? <span className="spinner" />
              : mode === 'login' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : 'Send reset link'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            
            <button 
              onClick={async () => {
                setLoading(true)
                setTimeout(() => navigate('/dashboard'), 500)
                try {
                  const { error } = await signInWithGoogle()
                  if (error) throw error
                } catch (err) {
                  setError(err.message)
                  setLoading(false)
                }
              }}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', 
                color: 'var(--text)', padding: '10px', borderRadius: 8, display: 'flex', 
                alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, 
                fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.15s'
              }}
              disabled={loading}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-active)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'login' && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Don't have an account?{' '}
                <button onClick={() => setMode('signup')} style={styles.linkBtn}>Sign up</button>
              </p>
              <button onClick={() => setMode('forgot')} style={{ ...styles.linkBtn, fontSize: 12 }}>
                Forgot password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} style={styles.linkBtn}>Sign in</button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} style={styles.linkBtn}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: '#03080c' },
  bg: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,189,248,0.15) 0%, rgba(41,106,132,0.05) 50%, transparent 80%)', pointerEvents: 'none' },
  box: { width: '100%', maxWidth: 420, background: 'rgba(10,20,29,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24, padding: '2.5rem', position: 'relative', zIndex: 1, boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' },
  logoText: { fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em', textShadow: '0 2px 15px rgba(255,255,255,0.15)' },
  title: { fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textAlign: 'center' },
  sub: { color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, textAlign: 'center' },
  errorBox: { background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '12px 16px', color: 'var(--red)', fontSize: 13, textShadow: '0 0 10px rgba(248,113,113,0.2)', marginBottom: 20 },
  successBox: { background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: '12px 16px', color: 'var(--green)', fontSize: 13, textShadow: '0 0 10px rgba(52,211,153,0.2)', marginBottom: 20 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, textShadow: '0 0 10px rgba(56,189,248,0.3)', transition: 'color 0.2s', fontWeight: 500 },
}

function VertexLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="filter drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]">
      <circle cx="12" cy="5.5" r="3.5" fill="#38bdf8" />
      <path d="M4 9.5 L12 22 L20 9.5 L15.5 9.5 L12 15 L8.5 9.5 Z" fill="#296a84" />
      <path d="M12 22 L20 9.5 L15.5 9.5 L12 15 Z" fill="#1b4d63" />
    </svg>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have an access token or PKCE code in the URL (Supabase recovery flow)
    const hash = window.location.hash
    const searchParams = new URLSearchParams(window.location.search)
    const hasAccessToken = hash && hash.includes('access_token')
    const hasCode = searchParams.has('code')

    if (!hasAccessToken && !hasCode) {
       // If no token or code, we might have arrived here by mistake or after a refresh
       // Supabase should have already set the session if coming from a recovery link
       supabase.auth.getSession().then(({ data: { session } }) => {
         if (!session) {
           setError('Invalid or expired reset link. Please request a new one.')
         }
       })
    }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      return setError('Passwords do not match')
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters')
    }

    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })
      if (error) throw error
      
      setSuccess('Password updated successfully! Redirecting to login...')
      setTimeout(() => {
        navigate('/auth')
      }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Background elements similar to AuthPage could be added here */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="relative rounded-2xl p-8" style={{
          background: 'rgba(17, 17, 24, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 rounded-full mb-4" style={{ background: 'rgba(79, 142, 247, 0.1)', border: '1px solid rgba(79, 142, 247, 0.2)' }}>
              <Lock className="text-accent" size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-2xl font-bold text-white">New Password</h2>
            <p className="text-sm text-gray-400 mt-2 text-center">Enter your new secure password below.</p>
          </div>

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

          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
                New Password
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-accent/50 transition-colors"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
                Confirm Password
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-accent/50 transition-colors"
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-150 mt-4"
              style={{
                background: 'var(--accent)',
                color: '#0a0a0f',
                boxShadow: '0 0 20px rgba(79, 142, 247, 0.3)'
              }}
              disabled={loading || success}
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

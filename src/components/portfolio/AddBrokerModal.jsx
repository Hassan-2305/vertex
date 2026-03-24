import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trash2 } from 'lucide-react'

const BROKERS = ['Groww', 'INDmoney', 'Zerodha', 'Upstox', 'Angel One', 'ICICI Direct', 'HDFC Securities', 'Other']

export default function AddBrokerModal({ userId, brokers = [], onClose }) {
  const [form, setForm] = useState({ broker_name: 'Groww', display_name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localBrokers, setLocalBrokers] = useState(brokers)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('broker_accounts').insert({
      user_id: userId,
      broker_name: form.broker_name,
      display_name: form.display_name || form.broker_name,
    }).select()
    if (error) { setError(error.message); setLoading(false); return }
    if (data) setLocalBrokers([...localBrokers, data[0]])
    setForm({ broker_name: 'Groww', display_name: '' })
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this broker account? This will not delete your actual holdings but they will lose their broker tag.')) return
    await supabase.from('broker_accounts').delete().eq('id', id)
    setLocalBrokers(localBrokers.filter(b => b.id !== id))
  }

  return (
    <div style={overlay}>
      <div style={modal} className="fade-in">
        <div style={header}>
          <h2 style={title}>Add broker account</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        {error && <div style={errBox}>{error}</div>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>Broker</label>
            <select value={form.broker_name} onChange={e => setForm(f => ({ ...f, broker_name: e.target.value }))}>
              {BROKERS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label>Display name (optional)</label>
            <input placeholder={`My ${form.broker_name}`} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Add'}
            </button>
          </div>
        </form>

        {localBrokers.length > 0 && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12 }}>Connected Accounts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {localBrokers.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.display_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.broker_name}</div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(247,97,79,0.3)', borderRadius: 6, padding: 6, cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 420 }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }
const title = { fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }
const closeBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }
const errBox = { background: 'var(--red-dim)', border: '1px solid rgba(247,97,79,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12, marginBottom: 14 }

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

export default function AddFnoEntryModal({ userId, entry, onClose }) {
  const isEdit = !!entry
  const [date, setDate] = useState(entry ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
  const [pnl, setPnl] = useState(entry ? String(entry.pnl) : '')
  const [notes, setNotes] = useState(entry ? (entry.notes || '') : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!date || pnl === '') return
    setLoading(true)
    setError('')

    let dbError
    if (isEdit) {
      ;({ error: dbError } = await supabase.from('fno_journal').update({
        date,
        pnl: Number(pnl),
        notes: notes.trim() || null
      }).eq('id', entry.id))
    } else {
      ;({ error: dbError } = await supabase.from('fno_journal').insert({
        user_id: userId,
        date,
        pnl: Number(pnl),
        notes: notes.trim() || null
      }))
    }

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }
    
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden' }} className="fade-in">
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
            {isEdit ? 'Edit F&O Entry' : 'Log F&O Daily P&L'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '10px 12px', borderRadius: 8, fontSize: 13, border: '1px solid rgba(247,97,79,0.3)' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Trade Date</label>
            <input 
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]} // prevent future dates
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Net Realized P&L (₹)</label>
            <input 
              type="number"
              step="any"
              placeholder="e.g. 1500 or -450"
              value={pnl}
              onChange={e => setPnl(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-mono)' }}
              required
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Enter a negative number for a losing day.</div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Notes / Tags (Optional)</label>
            <textarea 
              placeholder="e.g. Nifty Expiry, Overtraded, followed setup well"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, minHeight: 80, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : (isEdit ? 'Save Changes' : 'Log Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

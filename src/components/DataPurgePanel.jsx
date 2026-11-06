import { useState, useEffect } from 'react'
import { authFetch } from '../lib/authFetch'

const NAVY = '#00205B'
const font = 'Montserrat, sans-serif'

/**
 * Admin-only: see how much transcript and scoring data is stored, and delete it for good.
 * Deleting here cannot be undone. The server asks for the word DELETE before it acts.
 */
export default function DataPurgePanel() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState({})
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/user-actions?action=purge-counts', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load the counts')
      setGroups(body.groups || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const total = (g) => Object.values(g.counts).reduce((a, n) => a + (n || 0), 0)
  const chosen = groups.filter((g) => picked[g.key]).map((g) => g.key)
  const chosenRows = groups.filter((g) => picked[g.key]).reduce((a, g) => a + total(g), 0)

  async function purge() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await authFetch('/api/user-actions?action=purge-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: chosen, confirm }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'The delete failed')
      const failed = (body.results || []).filter((r) => r.error)
      const done = (body.results || []).filter((r) => !r.error).reduce((a, r) => a + (r.before || 0), 0)
      setMessage(failed.length
        ? `Deleted ${done} records. These tables could not be cleared: ${failed.map((f) => `${f.table} (${f.error})`).join('; ')}`
        : `Deleted ${done} records for good.`)
      setPicked({})
      setConfirm('')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ fontFamily: font }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: NAVY, marginBottom: 8 }}>Data &amp; Privacy</h1>
      <p style={{ fontSize: 13, color: '#6b7a99', lineHeight: 1.6, marginBottom: 20, maxWidth: 760 }}>
        This is every place the toolkit stores transcripts, answers, or scores. Deleting here removes the records from the database for good.
        There is no undo and no backup copy kept by the toolkit. Audio recordings are never stored, so there is nothing to delete for them.
      </p>

      {error && <div style={{ background: '#fff3e6', border: '1px solid #ffe0b2', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: NAVY, marginBottom: 16 }}>{error}</div>}
      {message && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#15803d', marginBottom: 16 }}>{message}</div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, maxWidth: 760 }}>
        {loading ? <div style={{ color: '#999', fontSize: 13 }}>Loading…</div> : (
          <>
            {groups.map((g) => (
              <label key={g.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f0f2f5', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!picked[g.key]} onChange={(e) => setPicked((p) => ({ ...p, [g.key]: e.target.checked }))} style={{ marginTop: 3 }} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: NAVY }}>{g.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>
                    {Object.entries(g.counts).map(([t, n]) => `${t}: ${n === null ? 'n/a' : n}`).join('  ·  ')}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{total(g)}</div>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setPicked(Object.fromEntries(groups.map((g) => [g.key, true])))}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e6ec', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Select everything</button>
              <button type="button" onClick={() => setPicked({})}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e6ec', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Clear selection</button>
            </div>

            {chosen.length > 0 && (
              <div style={{ marginTop: 18, padding: 14, border: '1px solid #fecaca', background: '#fff7f7', borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5, marginBottom: 10 }}>
                  You are about to delete about <strong>{chosenRows}</strong> records from {chosen.length} group{chosen.length === 1 ? '' : 's'}. This cannot be undone.
                  Type <strong>DELETE</strong> to continue.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE"
                    style={{ height: 36, borderRadius: 6, border: '1px solid #e2e6ec', padding: '0 12px', fontSize: 13, fontFamily: font, width: 140 }} />
                  <button type="button" disabled={busy || confirm !== 'DELETE'} onClick={purge}
                    style={{ height: 36, padding: '0 18px', background: '#b42318', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: font, cursor: busy || confirm !== 'DELETE' ? 'not-allowed' : 'pointer', opacity: busy || confirm !== 'DELETE' ? 0.5 : 1 }}>
                    {busy ? 'Deleting…' : 'Delete selected data'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

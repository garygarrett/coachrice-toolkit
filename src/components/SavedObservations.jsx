import { useState, useEffect } from 'react'
import { authFetch } from '../lib/authFetch'
import { emptyForm, missingItems } from '../lib/sof/formSpec'
import { observationTitle } from '../lib/sof/annotatedExport'
import ObservationViewer from './ObservationViewer'
import LoadingBar from './LoadingBar'

// Admin > History / Data: one person's saved Session Observation Forms, in progress and complete. Read only.
const C = { navy: '#00205B', border: '#e2e6ec', muted: '#6b7a99', soft: '#f0f2f5' }
const fmt = (d) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export default function SavedObservations({ userId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [record, setRecord] = useState(null)
  const [opening, setOpening] = useState('')

  useEffect(() => {
    let live = true
    setRows(null); setRecord(null); setError('')
    authFetch('/api/user-actions?action=obs-admin-list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    }).then(async (res) => {
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Could not load saved observations')
      if (live) setRows(j.data || [])
    }).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [userId])

  async function open(id) {
    setOpening(id); setError('')
    try {
      const res = await authFetch('/api/user-actions?action=obs-admin-get', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Could not open that observation')
      setRecord(j)
    } catch (e) { setError(e.message) }
    setOpening('')
  }

  if (record) return <ObservationViewer record={record} onBack={() => setRecord(null)} />

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Saved Session Observation Forms</div>
      {error && <div style={{ color: '#b42318', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      {rows === null && !error && <LoadingBar />}
      {rows && rows.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nothing saved right now.</div>}
      {rows && rows.map((r) => {
        const form = { ...emptyForm(), ...(r.form || {}) }
        const missing = missingItems(form).length
        return (
          <div key={r.id} onClick={() => open(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', background: opening === r.id ? C.soft : '#fff' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13.5 }}>{r.title || observationTitle(form)}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>Started {fmt(r.created_at)} · Last saved {fmt(r.updated_at)}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 10, background: missing ? '#fff1de' : '#edf7d0', color: missing ? '#a45a00' : '#4d5b00' }}>
              {missing ? 'In progress' : 'Complete'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{opening === r.id ? 'Opening…' : 'View'}</span>
          </div>
        )
      })}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Read only. &ldquo;Complete&rdquo; means every field of the ICF form is filled in; anything else shows as in progress.</div>
    </div>
  )
}

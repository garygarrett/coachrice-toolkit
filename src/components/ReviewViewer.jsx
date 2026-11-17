import { useState } from 'react'
import ReviewFields from './ReviewFields'
import { emptyReview, missingReviewItems } from '../lib/crf/crfSpec'
import { downloadCompetencyReview } from '../lib/crf/fillCrfDocx'

// Read-only view of one saved Competency Review Form (for admins). Nothing here can be edited or saved.
const C = { navy: '#00205B', gray: '#7C7E7F', border: '#e2e6ec' }
const font = "'Montserrat', sans-serif"
const btn = { fontFamily: font, fontWeight: 700, fontSize: 12, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.navy}`, background: '#fff', color: C.navy, cursor: 'pointer' }
const fmt = (d) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '')

export default function ReviewViewer({ record, onBack }) {
  const base = emptyReview()
  const review = { ...base, ...((record.data || {}).review || {}) }
  const missing = missingReviewItems(review)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div style={{ fontFamily: font }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={btn} onClick={onBack}>← Back</button>
        <button
          style={btn}
          disabled={busy}
          onClick={async () => { setBusy(true); setErr(''); try { await downloadCompetencyReview(review) } catch (e) { setErr(e.message || 'The download failed.') } setBusy(false) }}
        >
          {busy ? 'Preparing…' : 'Download ICF form (Word)'}
        </button>
        <span style={{ fontSize: 12, color: C.gray }}>
          {record.title} · {record.owner?.full_name || record.owner?.email || 'Unknown mentor coach'} · last saved {fmt(record.updated_at)} ·{' '}
          <strong style={{ color: missing.length ? '#b45f00' : '#5b6b0a' }}>{missing.length ? `In progress (${missing.length} items open)` : 'Complete'}</strong>
        </span>
      </div>
      {err && <div role="alert" style={{ color: '#a00', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <ReviewFields review={review} setReview={() => {}} readOnly />
    </div>
  )
}

import { useState } from 'react'
import { emptyForm, missingItems, COMPETENCIES, BEHAVIORS, RATINGS, QUALIFIERS, SELF_REVIEW } from '../lib/sof/formSpec'
import { segmentTurn } from '../lib/sof/annotatedTranscriptPdf'
import { downloadAnnotatedTranscript, downloadFilledForm, observationTitle } from '../lib/sof/annotatedExport'

// Read-only view of one saved Session Observation Form (for admins). Nothing here can be edited or saved.
const C = { navy: '#00205B', gray: '#7C7E7F', border: '#e2e6ec', soft: '#f0f2f5', lime: '#c9d647', orange: '#ff8200', muted: '#6b7a99' }
const font = "'Montserrat', sans-serif"
const box = { border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#fff' }
const h3 = { fontSize: 14, fontWeight: 800, color: C.navy, margin: '0 0 10px' }
const lab = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px' }
const btn = { fontFamily: font, fontWeight: 700, fontSize: 12, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.navy}`, background: '#fff', color: C.navy, cursor: 'pointer' }
const roleName = (r) => (r === 'coach' ? 'Coach' : r === 'client' ? 'Client' : 'Other')
const fmt = (d) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function Field({ name, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={lab}>{name}</div>
      <div style={{ fontSize: 13, color: '#0f1c3a', whiteSpace: 'pre-wrap' }}>{value || <span style={{ color: C.gray }}>Blank</span>}</div>
    </div>
  )
}

export default function ObservationViewer({ record, onBack }) {
  const d = record.data || {}
  const form = { ...emptyForm(), ...(d.form || {}) }
  const turns = d.turns || []
  const roles = d.roles || {}
  const ai = d.ai || null
  const missing = missingItems(form)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  async function run(kind, fn) {
    setBusy(kind); setErr('')
    try { await fn() } catch (e) { setErr(e.message || 'The download failed.') }
    setBusy('')
  }

  const codesByTurn = {}
  BEHAVIORS.forEach((b) => (form.evidence[b.id] || []).forEach((e) => {
    const t = turns.find((x) => x.id === e.turn)
    if (!t) return
    const at = e.quote ? t.text.indexOf(e.quote) : -1
    const list = (codesByTurn[t.id] = codesByTurn[t.id] || { marks: [], loose: new Set() })
    if (at >= 0) list.marks.push({ start: at, end: at + e.quote.length, codes: [b.id] })
    else list.loose.add(b.id)
  }))

  return (
    <div style={{ fontFamily: font }}>
      <button style={{ ...btn, marginBottom: 12 }} onClick={onBack}>← Back to the list</button>
      <div style={{ ...box, background: C.soft }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>{observationTitle(form)}</div>
        <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 10px' }}>
          Mentor coach: {record.owner?.full_name || record.owner?.email || 'Unknown'} · Started {fmt(record.created_at)} · Last saved {fmt(record.updated_at)}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 10, background: missing.length ? '#fff1de' : '#edf7d0', color: missing.length ? '#a45a00' : '#4d5b00' }}>
          {missing.length ? `In progress · ${missing.length} item${missing.length === 1 ? '' : 's'} still blank` : 'Complete'}
        </span>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Read only. This view cannot change the saved record.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button style={btn} disabled={!!busy} onClick={() => run('docx', () => downloadFilledForm(form))}>{busy === 'docx' ? 'Building…' : 'Download ICF form (.docx)'}</button>
          <button style={btn} disabled={!!busy || !turns.length} onClick={() => run('pdf', () => downloadAnnotatedTranscript({ form, turns, roles }))}>{busy === 'pdf' ? 'Making PDF…' : 'Download annotated transcript (PDF)'}</button>
        </div>
        {err && <div style={{ color: '#b42318', fontSize: 12, marginTop: 8 }}>{err}</div>}
        {missing.length > 0 && (
          <details style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>What is still blank</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </details>
        )}
      </div>

      <div style={box}>
        <h3 style={h3}>Administrative information</h3>
        <Field name="Mentor coach name" value={form.admin.name} />
        <Field name="Mentor coach email" value={form.admin.email} />
        <Field name="Client name" value={form.admin.clientName} />
        <Field name="Client email" value={form.admin.clientEmail} />
        <Field name="Date or ID of the client's session" value={form.admin.clientSession} />
        <Field name="Date of the mentor coaching session" value={form.admin.mentorSession} />
        <Field name="Level of the mentor coaching provider" value={form.level} />
        <Field name="Transcript has no timestamps" value={form.noTimestamps ? 'Yes' : 'No'} />
        <div style={lab}>Self-review checklist</div>
        {SELF_REVIEW.map((t, i) => <div key={i} style={{ fontSize: 12.5, margin: '3px 0' }}>{form.selfReview[i] ? '☑' : '☐'} {t}</div>)}
      </div>

      <div style={box}>
        <h3 style={h3}>Competency 1: Ethical practice qualifiers</h3>
        {QUALIFIERS.map((q) => (
          <div key={q.id} style={{ fontSize: 13, marginBottom: 6 }}>{q.text} <strong>{form.q[q.id] === 'observed' ? 'Observed' : form.q[q.id] === 'not_observed' ? 'Not Observed' : 'Not answered'}</strong></div>
        ))}
        <Field name="Comments" value={form.qComments} />
      </div>

      {COMPETENCIES.map((c) => (
        <div key={c.n} style={box}>
          <h3 style={h3}>Competency {c.n}: {c.name}</h3>
          {BEHAVIORS.filter((b) => b.comp === c.n).map((b) => {
            const s = ai?.behaviors?.[b.id]
            const items = form.evidence[b.id] || []
            return (
              <div key={b.id} style={{ borderTop: `1px solid ${C.soft}`, padding: '10px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{b.id} {b.text}</div>
                <div style={{ fontSize: 12.5, margin: '4px 0' }}>Rating: <strong>{RATINGS.find((r) => r.id === form.ratings[b.id])?.label || 'Not rated'}</strong></div>
                {s && <div style={{ fontSize: 12, color: C.muted }}>AI suggested: {RATINGS.find((r) => r.id === s.suggested)?.label || 'None'}. {s.note}</div>}
                {items.map((e) => <div key={e.id} style={{ fontSize: 12.5, margin: '4px 0 0 12px', paddingLeft: 8, borderLeft: `3px solid ${C.lime}` }}>{e.text}</div>)}
                {form.evidenceNotes[b.id] && <div style={{ fontSize: 12.5, marginTop: 4 }}><span style={lab}>Extra notes </span>{form.evidenceNotes[b.id]}</div>}
              </div>
            )
          })}
        </div>
      ))}

      <div style={box}>
        <h3 style={h3}>Strengths and areas for development</h3>
        {[['Strength', form.strengths], ['Development', form.development]].map(([name, list]) =>
          list.filter((x) => x.statement.trim() || x.comments.trim()).map((x) => (
            <div key={name + x.comp} style={{ marginBottom: 8 }}>
              <div style={lab}>{name} · Competency {x.comp}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{x.statement}</div>
              <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{x.comments}</div>
            </div>
          )))}
      </div>

      <div style={box}>
        <h3 style={h3}>Attestation</h3>
        <Field name="Attested" value={form.attested ? 'Yes' : 'No'} />
        <Field name="Printed name" value={form.printedName} />
        <Field name="Signature" value={form.signature} />
        <Field name="Date signed" value={form.dateSigned} />
      </div>

      <div style={box}>
        <h3 style={h3}>Transcript ({turns.length} turns)</h3>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Highlighted words are evidence the mentor coach selected. Orange tags name the behavior.</div>
        {turns.map((t) => {
          const info = codesByTurn[t.id]
          const segs = segmentTurn(t.text, info?.marks || [])
          return (
            <div key={t.id} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12.5, lineHeight: 1.55 }}>
              <div style={{ width: 90, flexShrink: 0, fontWeight: 700, color: roles[t.speaker] === 'coach' ? C.navy : C.gray }}>
                {roleName(roles[t.speaker])}<div style={{ fontWeight: 500, color: C.gray, fontSize: 11 }}>{t.time}</div>
              </div>
              <div style={{ flex: 1 }}>
                {t.pauseBefore >= 3 && <div style={{ color: C.orange, fontSize: 11 }}>pause {Math.round(t.pauseBefore)} sec</div>}
                {segs.map((g, i) => (
                  <span key={i}>
                    {g.hl ? <mark style={{ background: C.lime, padding: '1px 0' }}>{g.text}</mark> : g.text}
                    {g.hl && !(segs[i + 1] && segs[i + 1].hl) && <span style={{ color: C.orange, fontWeight: 800, fontSize: 10 }}> [{g.codes.join(', ')}]</span>}
                  </span>
                ))}
                {info?.loose.size > 0 && <span style={{ color: C.orange, fontWeight: 800, fontSize: 10 }}> [{[...info.loose].join(', ')}]</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { COMPETENCIES, BEHAVIORS, LEVELS, SELF_REVIEW, NEEDED, SESSION_ROWS, totalHours, demonstratedCount, withSuggestedMet } from '../lib/crf/crfSpec'

// The Competency Review Form fields. Used by the editing page and by the read-only admin viewer
// (readOnly disables every input).
const C = { navy: '#00205B', gray: '#7C7E7F', border: '#e2e6ec', soft: '#f0f2f5', orange: '#ff8200', sky: '#69cce6', green: '#c9d647' }
const font = "'Montserrat', sans-serif"
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, marginBottom: 18 }
const h2 = { fontSize: 16, color: C.navy, margin: '0 0 6px', fontWeight: 800 }
const small = { fontSize: 12, color: C.gray, lineHeight: 1.5 }
const input = { fontFamily: font, fontSize: 13, padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 4 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }

function Choice({ name, options, value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(on ? null : o.id)}
            style={{
              fontFamily: font, fontWeight: 700, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${on ? C.navy : C.border}`, background: on ? C.navy : '#fff', color: on ? '#fff' : C.navy,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const DEMO = [{ id: 'demonstrated', label: 'Proficiency Demonstrated' }, { id: 'not_yet', label: 'Proficiency Not Yet Demonstrated' }]
const YESNO = [{ id: 'yes', label: 'Yes. Proficiency has been demonstrated' }, { id: 'no', label: 'No. Proficiency has not yet been demonstrated' }]

const SHORT_RATING = { exceeds: 'Exceeds', meets: 'Meets', below: 'Below', does_not_meet: 'Does not meet', na: 'N/A' }

// sofs: [{ formNumber, id, form }] the participant's Session Observation Forms. onOpenSof(sof, behaviorId) opens one beside the review.
export default function ReviewFields({ review, setReview, readOnly = false, sofs = [], onOpenSof = null }) {
  const r = review
  const up = (patch) => setReview({ ...r, ...patch })
  const admin = (k, v) => up({ admin: { ...r.admin, [k]: v } })
  const lock = readOnly

  const setStatement = (id, comp, v) => {
    const next = { ...r, statements: { ...r.statements } }
    if (v) next.statements[id] = v; else delete next.statements[id]
    setReview(withSuggestedMet(next, comp))
  }
  const setFeedback = (kind, i, k, v) => up({ [kind]: r[kind].map((f, x) => (x === i ? { ...f, [k]: v } : f)) })

  const text = (id, lab, value, onChange, opts = {}) => (
    <div key={id}>
      <label style={label} htmlFor={id}>{lab}</label>
      <input id={id} style={input} value={value} disabled={lock} onChange={(e) => onChange(e.target.value)} {...opts} />
    </div>
  )

  return (
    <div>
      <div style={card} id="crf-info">
        <h2 style={h2}>Administrative information</h2>
        <div style={{ ...grid, marginTop: 12 }}>
          {text('crf-name', '1. Mentor coach name', r.admin.name, (v) => admin('name', v))}
          {text('crf-email', '2. Mentor coach email', r.admin.email, (v) => admin('email', v), { type: 'email' })}
          {text('crf-client', '3. Mentor coach client name', r.admin.clientName, (v) => admin('clientName', v))}
          {text('crf-client-email', '4. Mentor coach client email', r.admin.clientEmail, (v) => admin('clientEmail', v), { type: 'email' })}
          {text('crf-date', '5. Date of the competency skills review feedback session', r.admin.feedbackDate, (v) => admin('feedbackDate', v), { placeholder: 'MM/DD/YYYY' })}
        </div>
        <div style={{ marginTop: 14 }}>
          <span style={label}>6. Level of the mentor coaching services provided</span>
          <Choice name="Level" options={LEVELS.map((l) => ({ id: l, label: l }))} value={r.level} onChange={(v) => up({ level: v })} disabled={lock} />
        </div>
        <div style={{ ...grid, marginTop: 14 }}>
          {text('crf-hours-i', 'Total individual hours with client', r.individualHours, (v) => up({ individualHours: v }), { inputMode: 'decimal' })}
          {text('crf-hours-g', 'Total group hours with client', r.groupHours, (v) => up({ groupHours: v }), { inputMode: 'decimal' })}
          <div>
            <label style={label} htmlFor="crf-hours-t">7. Total hours with the client (adds up on its own)</label>
            <input id="crf-hours-t" style={{ ...input, background: C.soft }} value={totalHours(r)} readOnly />
          </div>
          {text('crf-observed', '8. Observed coaching sessions reviewed individually with the client', r.observedSessions, (v) => up({ observedSessions: v }), { inputMode: 'numeric' })}
        </div>
      </div>

      <div style={card} id="crf-self">
        <h2 style={h2}>Mentor coach self-review checklist</h2>
        <p style={small}>Complete this checklist before completing the form.</p>
        {SELF_REVIEW.map((t, i) => (
          <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, margin: '10px 0' }}>
            <input type="checkbox" disabled={lock} checked={!!r.selfReview[i]} onChange={(e) => up({ selfReview: r.selfReview.map((b, k) => (k === i ? e.target.checked : b)) })} />
            <span>{t}</span>
          </label>
        ))}
      </div>

      <div style={card} id="crf-log">
        <h2 style={h2}>Session log</h2>
        <p style={small}>List each observed coaching session you reviewed individually with the client (up to {SESSION_ROWS}).</p>
        {r.sessions.map((s, i) => (
          <div key={i} style={{ ...grid, gridTemplateColumns: '90px 1fr 1fr 1fr', alignItems: 'end', marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, paddingBottom: 10 }}>Session {i + 1}</div>
            {text(`crf-s-d${i}`, 'Date', s.date, (v) => up({ sessions: r.sessions.map((x, k) => (k === i ? { ...x, date: v } : x)) }))}
            {text(`crf-s-m${i}`, 'Modality (in-person, virtual, recorded)', s.modality, (v) => up({ sessions: r.sessions.map((x, k) => (k === i ? { ...x, modality: v } : x)) }))}
            {text(`crf-s-t${i}`, 'Duration (minutes)', s.duration, (v) => up({ sessions: r.sessions.map((x, k) => (k === i ? { ...x, duration: v } : x)) }))}
          </div>
        ))}
      </div>

      <div style={card} id="crf-c1">
        <h2 style={h2}>Competency 1: Demonstrates Ethical Practice</h2>
        <p style={small}>Understands and consistently applies coaching ethics and standards of coaching.</p>
        <p style={{ fontSize: 13, margin: '12px 0 8px' }}>I verify that the client has demonstrated understanding and consistent application of coaching ethics during the engagement.</p>
        <Choice name="Competency 1" options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={r.c1} onChange={(v) => up({ c1: v })} disabled={lock} />
        <label style={{ ...label, marginTop: 14 }} htmlFor="crf-c1-notes">Notes (e.g., confidentiality, boundaries, conflicts of interest)</label>
        <textarea id="crf-c1-notes" style={{ ...input, minHeight: 70 }} disabled={lock} value={r.c1Notes} onChange={(e) => up({ c1Notes: e.target.value })} />
      </div>

      <div style={card}>
        <h2 style={h2}>Competency 2: Embodies a Coaching Mindset</h2>
        <p style={small}>This competency has no behavioral statements. It develops over a coach&rsquo;s professional journey and is not rated on this form.</p>
      </div>

      {r.prefilledFrom?.length > 0 && (
        <div style={{ background: '#eef7fb', border: `1px solid ${C.sky}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.navy, marginBottom: 14 }}>
          Proficiency was pre-filled from Session Observation Form {r.prefilledFrom.map((n) => `#${n}`).join(', ')}:
          &ldquo;Demonstrated&rdquo; where any of those forms rated the behavior Meets or Exceeds the standard.
          You can change any answer{readOnly ? '' : ' below'}.
        </div>
      )}

      {COMPETENCIES.map((c) => {
        const items = BEHAVIORS.filter((b) => b.comp === c.n)
        const have = demonstratedCount(r, c.n)
        return (
          <div style={card} key={c.n} id={`crf-c${c.n}`}>
            <h2 style={h2}>Competency {c.n}: {c.name}</h2>
            <p style={small}>{c.definition}</p>
            {items.map((b) => (
              <div key={b.id} style={{ borderTop: `1px solid ${C.border}`, padding: '12px 0' }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}><strong style={{ color: C.navy }}>{b.id}</strong> {b.text}</div>
                {onOpenSof && sofs.some((x) => x.form?.ratings?.[b.id]) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '-2px 0 8px' }}>
                    <span style={{ fontSize: 11, color: C.gray }}>Session Observation Forms:</span>
                    {sofs.filter((x) => x.form?.ratings?.[b.id]).map((x) => {
                      const rt = x.form.ratings[b.id]
                      const good = rt === 'meets' || rt === 'exceeds'
                      return (
                        <button
                          key={x.formNumber}
                          type="button"
                          aria-label={`Open Session Observation Form #${x.formNumber} at ${b.id}`}
                          onClick={() => onOpenSof(x, b.id)}
                          style={{ fontFamily: font, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${good ? C.green : C.border}`, background: good ? '#f3f8d6' : C.soft, color: C.navy }}
                        >
                          #{x.formNumber} · {SHORT_RATING[rt] || rt}
                        </button>
                      )
                    })}
                  </div>
                )}
                <Choice name={b.id} options={DEMO} value={r.statements[b.id] || null} onChange={(v) => setStatement(b.id, c.n, v)} disabled={lock} />
              </div>
            ))}
            <div style={{ background: C.soft, borderRadius: 10, padding: '12px 14px', marginTop: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                Has the mentor coaching client demonstrated proficiency with at least {NEEDED[c.n]} of the statements?
                <span style={{ ...small, marginLeft: 8 }}>({have} of {items.length} marked Demonstrated)</span>
              </div>
              <Choice name={`Competency ${c.n} summary`} options={YESNO} value={r.competencyMet[c.n] || null} onChange={(v) => up({ competencyMet: { ...r.competencyMet, [c.n]: v } })} disabled={lock} />
            </div>
          </div>
        )
      })}

      {[['strengths', 'Areas of strengths'], ['development', 'Areas for development']].map(([kind, title]) => (
        <div style={card} key={kind} id={`crf-${kind}`}>
          <h2 style={h2}>Cumulative feedback: {title}</h2>
          <p style={small}>Provide clear, evidence-based feedback for 2-3 competencies.</p>
          {r[kind].map((f, i) => {
            const c = COMPETENCIES[i]
            return (
              <div key={c.n} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 6 }}>Competency {c.n}: {c.name}</div>
                <label style={label} htmlFor={`crf-${kind}-s${i}`}>Statement for feedback</label>
                <textarea id={`crf-${kind}-s${i}`} style={{ ...input, minHeight: 50 }} disabled={lock} value={f.statement} onChange={(e) => setFeedback(kind, i, 'statement', e.target.value)} />
                <label style={{ ...label, marginTop: 8 }} htmlFor={`crf-${kind}-c${i}`}>Feedback comments</label>
                <textarea id={`crf-${kind}-c${i}`} style={{ ...input, minHeight: 70 }} disabled={lock} value={f.comments} onChange={(e) => setFeedback(kind, i, 'comments', e.target.value)} />
              </div>
            )
          })}
        </div>
      ))}

      <div style={card} id="crf-sign">
        <h2 style={h2}>Signatures and attestations</h2>
        <p style={{ fontSize: 13, margin: '10px 0 8px' }}>Select the option that best reflects the client&rsquo;s demonstrated proficiency at the ACC level.</p>
        <Choice
          name="Overall"
          options={[
            { id: 'demonstrated', label: 'Has demonstrated proficiency at the ACC level in each competency area' },
            { id: 'not_yet', label: 'Has not yet demonstrated proficiency at the ACC level in each competency area' },
          ]}
          value={r.overall}
          onChange={(v) => up({ overall: v })}
          disabled={lock}
        />
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, margin: '16px 0' }}>
          <input type="checkbox" disabled={lock} checked={!!r.reviewed} onChange={(e) => up({ reviewed: e.target.checked })} />
          <span>The mentor coaching client has reviewed this form, and we discussed the feedback provided in real time.</span>
        </label>
        <div style={grid}>
          {text('crf-printed', 'Mentor coach’s printed name', r.printedName, (v) => up({ printedName: v }))}
          {text('crf-signature', 'Mentor coach’s signature (typed)', r.signature, (v) => up({ signature: v }))}
          {text('crf-signed', 'Date signed', r.dateSigned, (v) => up({ dateSigned: v }), { placeholder: 'MM/DD/YYYY' })}
        </div>
      </div>
    </div>
  )
}

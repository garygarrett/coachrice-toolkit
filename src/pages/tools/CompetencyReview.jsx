import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import ReviewFields from '../../components/ReviewFields'
import ObservationViewer from '../../components/ObservationViewer'
import { missingItems, emptyForm } from '../../lib/sof/formSpec'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../lib/authFetch'
import { emptyReview, prefillFromObservations, missingReviewItems } from '../../lib/crf/crfSpec'
import { downloadCompetencyReview } from '../../lib/crf/fillCrfDocx'

const C = { navy: '#00205B', gray: '#7C7E7F', white: '#FFFFFF', orange: '#ff8200', border: '#e2e6ec', soft: '#f0f2f5' }
const font = "'Montserrat', sans-serif"
const btn = (primary, disabled) => ({
  fontFamily: font, fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 8,
  border: primary ? 'none' : `1px solid ${C.navy}`, background: primary ? C.navy : C.white, color: primary ? C.white : C.navy,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, marginBottom: 18 }
const h2 = { fontSize: 16, color: C.navy, margin: '0 0 6px', fontWeight: 800 }
const small = { fontSize: 12, color: C.gray, lineHeight: 1.5 }
const input = { fontFamily: font, fontSize: 13, padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 4 }

const reviewTitle = (name) => (name ? `${name} - Competency Review Form` : 'Untitled competency review')
const az = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

// Lives inside the Session Observation page (same page, bottom half). The parent supplies the Layout.
// request: { participantId, n } opens (or starts) that participant's review whenever n changes.
// onStageChange('start' | 'form'): lets the parent hide its own top half while a review is open.
// onChanged(): called after a review is created, left, or deleted so the parent can refresh its lists.
export default function CompetencyReview({ request = null, onStageChange = null, onChanged = null }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'admin_tools'

  const [stage, setStage] = useState('start') // start | form
  const [cohorts, setCohorts] = useState([])
  const [saved, setSaved] = useState([])
  const [pickId, setPickId] = useState('')
  const [review, setReview] = useState(emptyReview())
  const [recordId, setRecordId] = useState(null)
  const [link, setLink] = useState(null) // { participantId, participantName }
  const [notice, setNotice] = useState('')
  const [sofs, setSofs] = useState([]) // the participant's saved Session Observation Forms [{ formNumber, id, form }]
  const [panelW, setPanelW] = useState(400) // width of the side panel in px; the coach can drag its left edge
  const [panel, setPanel] = useState(null) // side panel: { sof, focusId, record, error } or null
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dirty, setDirty] = useState(false)
  const snapshot = useRef(null)
  const handledRequest = useRef(0)

  const people = useMemo(
    () => cohorts.flatMap((c) => c.participants.map((p) => ({ ...p, cohortId: c.id, cohortName: c.name }))).sort(az),
    [cohorts],
  )
  const pickPerson = people.find((p) => p.id === pickId) || null
  const pickRequired = !isAdmin && people.length > 0

  async function call(action, body) {
    const res = await authFetch(`/api/user-actions?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { const e = new Error(json.error || 'Something went wrong.'); e.status = res.status; throw e }
    return json
  }

  const loadAll = useCallback(async () => {
    try {
      const [mine, list] = await Promise.all([call('cohort-mine'), call('crf-list')])
      setCohorts(mine.cohorts || [])
      setSaved(list.data || [])
    } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  const setForm = (next) => { setReview(next); setDirty(true) }

  // Fills mentor name/email and client name when they are still empty. Never overwrites typing.
  const withAutofill = (r, clientName) => {
    const admin = { ...r.admin }
    if (!admin.name.trim() && profile?.full_name) admin.name = profile.full_name
    if (!admin.email.trim() && profile?.email) admin.email = profile.email
    if (!admin.clientName.trim() && clientName) admin.clientName = clientName
    return { ...r, admin, printedName: r.printedName || admin.name }
  }

  async function sofsFor(participantId) {
    const { observations } = await call('crf-sofs', { participantId })
    const list = (observations || []).map((o) => ({ formNumber: o.form_number, id: o.id, form: o.form })).filter((o) => o.form)
    setSofs(list)
    return list
  }

  // Opens one Session Observation Form in the side panel (read only), scrolled to a behavior if given.
  async function openSof(sof, focusId = '') {
    setPanel({ sof, focusId, record: null, error: '' })
    try {
      const record = await call('crf-sof-get', { id: sof.id })
      setPanel((p) => (p && p.sof.id === sof.id ? { ...p, record } : p))
    } catch (e) {
      setPanel((p) => (p && p.sof.id === sof.id ? { ...p, error: e.message } : p))
    }
  }

  async function startFor(person) {
    setBusy('start'); setError(''); setNotice('')
    try {
      setSofs([]); setPanel(null)
      let r = withAutofill(emptyReview(), person?.name)
      if (person) {
        const sofs = await sofsFor(person.id)
        r = prefillFromObservations(r, sofs)
        setNotice(sofs.length
          ? `Pre-filled from Session Observation Form ${sofs.map((s) => `#${s.formNumber}`).join(', ')}. Change anything that needs it.`
          : 'This participant has no saved Session Observation Forms yet, so nothing was pre-filled.')
      }
      const out = await call('crf-save', { title: reviewTitle(person?.name), data: { review: r }, link: person ? { participantId: person.id } : undefined })
      setRecordId(out.id)
      setLink(person ? { participantId: person.id, participantName: person.name } : null)
      setReview(r); snapshot.current = JSON.stringify(r); setDirty(false)
      setStage('form')
      loadAll(); onChanged?.()
    } catch (e) { setError(e.message) }
    setBusy('')
  }

  async function openSaved(id) {
    setBusy('open'); setError(''); setNotice(''); setPanel(null); setSofs([])
    try {
      const rec = await call('crf-get', { id })
      const r = withAutofill({ ...emptyReview(), ...(rec.data?.review || {}) }, rec.participant_name)
      setRecordId(rec.id)
      setLink(rec.participant_id ? { participantId: rec.participant_id, participantName: rec.participant_name } : null)
      setReview(r); snapshot.current = JSON.stringify(rec.data?.review || {}); setDirty(JSON.stringify(r) !== snapshot.current)
      setStage('form')
      if (rec.participant_id) sofsFor(rec.participant_id).catch(() => setSofs([]))
    } catch (e) { setError(e.message) }
    setBusy('')
  }

  // The parent asks for a participant's review (By participant row): open it, or start it.
  useEffect(() => {
    if (request?.id && handledRequest.current !== request.n && profile) { handledRequest.current = request.n; openSaved(request.id); return }
    if (!request?.participantId || handledRequest.current === request.n || !profile || !people.length) return
    const person = people.find((p) => p.id === request.participantId)
    if (!person) return
    handledRequest.current = request.n
    const existing = saved.find((s) => s.participant_id === person.id)
    if (existing) openSaved(existing.id); else startFor(person)
  }, [request, profile, people, saved])

  useEffect(() => { onStageChange?.(stage) }, [stage])
  useEffect(() => () => onStageChange?.('start'), [])

  const save = useCallback(async (quiet) => {
    if (!recordId) return false
    if (!quiet) { setBusy('save'); setError('') }
    try {
      await call('crf-save', { id: recordId, title: reviewTitle(link?.participantName || review.admin.clientName), data: { review } })
      snapshot.current = JSON.stringify(review); setDirty(false)
      if (!quiet) setNotice('Saved.')
      return true
    } catch (e) {
      if (!quiet) setError(e.message)
      return false
    } finally { if (!quiet) setBusy('') }
  }, [recordId, review, link])

  // Autosave 30 seconds after any change.
  useEffect(() => {
    if (stage !== 'form' || !dirty) return undefined
    const t = setTimeout(() => { save(true) }, 30000)
    return () => clearTimeout(t)
  }, [stage, dirty, review, save])

  async function goBack() {
    if (dirty) {
      const ok = await save(true)
      if (!ok && !window.confirm('Your latest changes could not be saved. Leave anyway?')) return
    }
    setStage('start'); setRecordId(null); setLink(null); setNotice(''); setDirty(false); setSofs([]); setPanel(null)
    loadAll(); onChanged?.()
  }

  async function refreshFromSofs() {
    if (!link) return
    if (!window.confirm('Re-apply the Session Observation Form ratings? This replaces your Proficiency answers with what the forms show.')) return
    setBusy('refresh'); setError('')
    try {
      const sofs = await sofsFor(link.participantId)
      setForm(prefillFromObservations({ ...review, statements: {}, competencyMet: {} }, sofs))
      setNotice(sofs.length ? 'Proficiency answers were refreshed from the Session Observation Forms.' : 'No saved Session Observation Forms were found for this participant.')
    } catch (e) { setError(e.message) }
    setBusy('')
  }

  async function download() {
    setBusy('docx'); setError('')
    try { await downloadCompetencyReview(review) } catch (e) { setError(e.message || 'The download failed.') }
    setBusy('')
  }

  async function remove(id, title) {
    if (!window.confirm(`Delete "${title}" for good? This cannot be undone.`)) return
    try { await call('crf-delete', { id }); await loadAll(); onChanged?.() } catch (e) { setError(e.message) }
  }

  // The side panel is fixed to the right edge of the window. The form makes room for it by padding its right side,
  // using the real distance from the form to the window edge (page padding differs by screen).
  const rootRef = useRef(null)
  const [slack, setSlack] = useState({ left: 228, right: 0 })
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSlack({ left: r.left, right: Math.max(0, window.innerWidth - r.right) })
  }, [panel, vw])
  const FORM_MIN = 560
  const maxPanel = Math.max(300, vw - slack.left - FORM_MIN)
  const shownW = Math.max(300, Math.min(panelW, maxPanel))
  // Drag the left edge of the side panel to make it wider or narrower (the form keeps at least FORM_MIN px).
  const startDrag = (e) => {
    e.preventDefault()
    const move = (ev) => setPanelW(Math.max(300, Math.min(window.innerWidth - ev.clientX, Math.max(300, window.innerWidth - slack.left - FORM_MIN))))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const missing = useMemo(() => missingReviewItems(review), [review])
  const isDone = (row) => !!row.review && missingReviewItems({ ...emptyReview(), ...row.review }).length === 0
  const existingForPick = pickId ? saved.find((s) => s.participant_id === pickId) : null

  if (stage === 'form') {
    return (
      <>
        <div ref={rootRef} style={{ paddingRight: panel ? Math.max(0, shownW + 12 - slack.right) : 0 }}>
        <div style={{ maxWidth: 960, margin: panel ? 0 : '0 auto', fontFamily: font }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btn(false)} onClick={goBack}>← Back to my reviews</button>
            <button style={btn(true, busy === 'save')} disabled={busy === 'save'} onClick={() => save(false)}>{busy === 'save' ? 'Saving…' : 'Save progress'}</button>
            {link && <button style={btn(false, !!busy)} disabled={!!busy} onClick={refreshFromSofs}>Refresh from Session Observation Forms</button>}
            <button style={btn(false, busy === 'docx')} disabled={busy === 'docx'} onClick={download}>{busy === 'docx' ? 'Preparing…' : 'Download form (Word)'}</button>
            <span style={{ ...small, marginLeft: 'auto' }}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            {sofs.length > 0 && (
              <div style={{ flexBasis: '100%', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={small}>View a Session Observation Form beside this review:</span>
                {sofs.map((x) => {
                  const done = missingItems({ ...emptyForm(), ...x.form }).length === 0
                  const on = panel?.sof.id === x.id
                  return (
                    <button key={x.id} type="button" onClick={() => (on ? setPanel(null) : openSof(x))}
                      style={{ ...btn(on), padding: '5px 12px', fontSize: 12 }}>
                      SOF #{x.formNumber} · {done ? 'Complete' : 'In progress'}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <h1 style={{ fontSize: 20, color: C.navy, margin: 0 }}>{link ? `${link.participantName} – ` : ''}Competency Review Form</h1>
            <div style={small}>ICF Mentor Coaching Competency Review Form – ACC</div>
          </div>
          {notice && <div role="status" style={{ background: '#eef7fb', border: '1px solid #69cce6', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.navy, marginBottom: 12 }}>{notice}</div>}
          {error && <div role="alert" style={{ background: '#fdecec', border: '1px solid #e8a0a0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#8a1c1c', marginBottom: 12 }}>{error}</div>}
          <ReviewFields review={review} setReview={setForm} sofs={sofs} onOpenSof={openSof} />
          <div style={{ ...card, background: missing.length ? '#fff8f0' : '#f6fae6' }}>
            <h2 style={h2}>{missing.length ? `Still open (${missing.length})` : 'Everything is filled in'}</h2>
            {missing.length > 0 ? (
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 13 }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            ) : <p style={small}>Download the Word form, sign it, and save it as a PDF for your client.</p>}
          </div>
        </div>
        </div>
        {panel && (
          <aside role="complementary" aria-label={`SOF #${panel.sof.formNumber}`}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: shownW, background: '#fff', borderLeft: `1px solid ${C.border}`, boxShadow: '-6px 0 24px rgba(0,32,91,0.12)', zIndex: 30, display: 'flex', flexDirection: 'column', fontFamily: font }}>
            <div role="separator" aria-orientation="vertical" aria-label="Drag to resize the side panel" title="Drag to resize" onPointerDown={startDrag}
              style={{ position: 'absolute', left: -5, top: 0, bottom: 0, width: 10, cursor: 'col-resize', zIndex: 31 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, fontWeight: 800, color: C.navy, fontSize: 14 }}>SOF #{panel.sof.formNumber}</div>
              <button type="button" aria-label="Close side panel" onClick={() => setPanel(null)} style={{ ...btn(false), padding: '6px 12px', fontSize: 12 }}>Close ✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {panel.error && <div role="alert" style={{ color: '#8a1c1c', fontSize: 13 }}>{panel.error}</div>}
              {!panel.record && !panel.error && <div style={small}>Loading…</div>}
              {panel.record && <ObservationViewer record={panel.record} embedded focusId={panel.focusId} onBack={() => setPanel(null)} />}
            </div>
          </aside>
        )}
      </>
    )
  }

  return (
    <>
      <div style={{ fontFamily: font }}>
        {error && <div role="alert" style={{ background: '#fdecec', border: '1px solid #e8a0a0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#8a1c1c', marginBottom: 12 }}>{error}</div>}
        <div style={card}>
          <h2 style={h2}>Start a Competency Review Form</h2>
          <p style={small}>
            The Competency Review Form sums up a participant&rsquo;s Session Observation Forms. When you start it for a participant,
            each behavior is pre-filled as &ldquo;Proficiency Demonstrated&rdquo; if any of their Session Observation Forms rated it Meets or Exceeds the
            standard. You can change every answer, then download the original ICF Word form.
          </p>
          <div style={{ height: 12 }} />
          <label style={label} htmlFor="crf-participant">Who is this review for?{pickRequired ? ' *' : ''}</label>
          <select id="crf-participant" style={{ ...input, maxWidth: 420 }} value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">{pickRequired ? 'Choose a participant…' : isAdmin ? 'Not for a cohort participant' : 'Choose a participant…'}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}{cohorts.length > 1 ? ` (${p.cohortName})` : ''}</option>)}
          </select>
          {existingForPick && (
            <div style={{ marginTop: 12, background: '#fff8f0', border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <strong>{pickPerson?.name} already has a Competency Review Form.</strong>{' '}
              <button style={{ ...btn(false), padding: '6px 12px', fontSize: 12 }} onClick={() => openSaved(existingForPick.id)}>Open saved review</button>
            </div>
          )}
          {pickPerson && !existingForPick && pickPerson.review && !pickPerson.review.mine && (
            <div style={{ marginTop: 12, fontSize: 13 }}>{pickPerson.name}&rsquo;s review was already saved by another mentor coach.</div>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              style={btn(true, !!busy || (pickRequired && !pickPerson) || !!existingForPick || (!!pickPerson?.review && !pickPerson.review.mine))}
              disabled={!!busy || (pickRequired && !pickPerson) || !!existingForPick || (!!pickPerson?.review && !pickPerson.review.mine)}
              onClick={() => startFor(pickPerson)}
            >
              {busy === 'start' ? 'Starting…' : 'Start Competency Review Form'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

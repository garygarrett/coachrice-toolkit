import { useState, useEffect, useRef, useMemo } from 'react'
import Layout from '../../components/Layout'
import { authFetch } from '../../lib/authFetch'
import { aiJson } from '../../lib/ai'
import { parseTranscriptText, stamp } from '../../lib/sof/transcript'
import { buildAnnotatedTranscriptPdf } from '../../lib/sof/annotatedTranscriptPdf'
import { ensurePdfLibs, urlToDataUrl } from '../../lib/pdfLibs'
import logoWhite from '../../CoachRICE_White.png'
import { EVIDENCE_SYSTEM, buildEvidenceInput, validateEvidence } from '../../lib/sof/evidencePrompt'
import {
  RATINGS, LEVELS, SELF_REVIEW, QUALIFIERS, COMPETENCIES, BEHAVIORS, ATTESTATIONS,
  emptyForm, missingItems,
} from '../../lib/sof/formSpec'

const C = {
  navy: '#00205B', gray: '#7C7E7F', white: '#FFFFFF', sky: '#69cce6', blue: '#78b3e0',
  orange: '#ff8200', green: '#c9d647', border: '#e2e6ec', soft: '#f0f2f5',
}
const font = "'Montserrat', sans-serif"
const MAX_BYTES = 500 * 1024 * 1024
const TEMPLATE_URL = '/templates/icf-session-observation-form-acc.docx'

const btn = (primary, disabled) => ({
  fontFamily: font, fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 8,
  border: primary ? 'none' : `1px solid ${C.navy}`,
  background: primary ? C.navy : C.white, color: primary ? C.white : C.navy,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, marginBottom: 18 }
const h2 = { fontSize: 16, color: C.navy, margin: '0 0 6px', fontWeight: 800 }
const small = { fontSize: 12, color: C.gray, lineHeight: 1.5 }
const input = { fontFamily: font, fontSize: 13, padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 4 }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.onload = resolve
    el.onerror = () => reject(new Error('Could not load the PDF reader. Check your internet connection.'))
    document.head.appendChild(el)
  })
}

async function readPdfText(file) {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    text += content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n'
  }
  return cleanAudioToolPdfText(text)
}

// A PDF made by our Audio to Transcript tool starts with a header (logo band, file name, date, and optionally
// the speaker breakdown) and ends every page with a footer. None of that is the conversation, so leave it out.
function cleanAudioToolPdfText(text) {
  if (!/CoachRICE\s*\|\s*Doerr Institute for New Leaders/.test(text)) return text
  const sig = text.search(/CoachRICE\s*\|\s*Doerr Institute for New Leaders/)
  const rest = text.slice(sig)
  const m = rest.match(/\bTranscript\s+(?=\[?\d{1,2}:\d{2})/)
  const body = m ? rest.slice(m.index + m[0].length) : rest
  return body
    .replace(/Confidential\.\s*CoachRICE, Doerr Institute for New Leaders, Rice University/g, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/g, '\n')
}

const roleName = (r) => (r === 'coach' ? 'Coach' : r === 'client' ? 'Client' : 'Other')
const trim = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s)

function evidenceLine(turn, roles, quote) {
  const who = roleName(roles[turn.speaker])
  const where = turn.time ? `[${turn.time}]` : `[Turn ${turn.id}]`
  return `${where} ${who}: “${quote}”`
}

export default function SessionObservation() {
  const fileRef = useRef(null)
  const audioFileRef = useRef(null)
  const xhrRef = useRef(null)
  const audioEl = useRef(null)

  const [stage, setStage] = useState('input') // input | setup | analyzing | form
  const [pasted, setPasted] = useState('')
  const [file, setFile] = useState(null) // the transcript file
  const [playFile, setPlayFile] = useState(null) // optional recording to play next to a transcript
  const [progress, setProgress] = useState({ label: '', pct: 0 })
  const [error, setError] = useState('')

  const [turns, setTurns] = useState([])
  const [roles, setRoles] = useState({}) // speakerId -> coach | client | other
  const [audioUrl, setAudioUrl] = useState('')
  const [ai, setAi] = useState(null) // the AI's suggestions
  const [form, setForm] = useState(emptyForm())
  const [exporting, setExporting] = useState(false)
  const [active, setActive] = useState('A3.1')
  const [selection, setSelection] = useState(null) // { turnId, text }
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [draftId, setDraftId] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const autoCreated = useRef(false) // the first automatic save has been tried
  const lastSaved = useRef('') // what was last saved, to know if there are unsaved changes

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  useEffect(() => () => { xhrRef.current?.abort() }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  useEffect(() => { loadDrafts() }, [])

  const snapshot = useMemo(() => JSON.stringify({ form, roles, active }), [form, roles, active])
  const dirty = stage === 'form' && snapshot !== lastSaved.current
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Save a first copy as soon as the form opens, so nothing is lost even if the coach never presses Save.
  useEffect(() => {
    if (stage === 'form' && !draftId && !autoCreated.current) {
      autoCreated.current = true
      saveDraft(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, draftId])

  // Once an observation has been saved, keep it up to date while the coach works.
  useEffect(() => {
    if (!dirty || !draftId) return undefined
    const t = setTimeout(() => { saveDraft(true) }, 30000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, draftId])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setAdmin = (k, v) => setForm((f) => ({ ...f, admin: { ...f.admin, [k]: v } }))
  const missing = useMemo(() => missingItems(form), [form])
  const turnById = useMemo(() => Object.fromEntries(turns.map((t) => [t.id, t])), [turns])

  // ---------- Step 1: get a transcript ----------
  function pickFile(f) {
    setError('')
    if (!f) return
    if (!/\.(txt|pdf)$/i.test(f.name) && f.type !== 'text/plain' && f.type !== 'application/pdf') {
      setError('Please choose a .txt or .pdf transcript, or paste the text below.'); return
    }
    setFile(f)
  }

  function pickPlayFile(f) {
    if (!f) return
    const ok = f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|m4a|wav|mp4|mov|aac|ogg|flac|webm)$/i.test(f.name)
    if (!ok) { setError('That does not look like an audio file.'); return }
    setPlayFile(f)
  }

  function toSetup(t, audioFile) {
    const ids = [...new Set(t.map((x) => x.speaker))]
    const initial = {}
    ids.forEach((id) => {
      const lab = t.find((x) => x.speaker === id).label
      initial[id] = /coach/i.test(lab) ? 'coach' : /client|participant|coachee/i.test(lab) ? 'client' : ''
    })
    setTurns(t)
    setRoles(initial)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(audioFile ? URL.createObjectURL(audioFile) : '')
    set({ noTimestamps: !t.some((x) => x.time) })
    setStage('setup')
  }

  async function loadTranscript() {
    setError('')
    try {
      let text = pasted
      if (file) text = /\.pdf$/i.test(file.name) || file.type === 'application/pdf' ? await readPdfText(file) : await file.text()
      const t = parseTranscriptText(text)
      if (!t.length) throw new Error('No transcript text was found. Check the file or paste the text.')
      toSetup(t, playFile)
    } catch (e) {
      setError(e.message === 'Cancelled' ? '' : e.message || 'Something went wrong.')
      setStage('input')
    }
  }

  // ---------- Step 2: find evidence ----------
  const rolesReady = turns.length > 0 && [...new Set(turns.map((t) => t.speaker))].every((id) => roles[id])
  const hasCoach = Object.values(roles).includes('coach')

  async function findEvidence() {
    setError('')
    setStage('analyzing')
    setProgress({ label: 'Reading the transcript and finding evidence for each behavior… this takes about a minute.', pct: 0 })
    try {
      const parsed = await aiJson(
        'observation-evidence',
        { system: EVIDENCE_SYSTEM, messages: [{ role: 'user', content: buildEvidenceInput(turns, roles) }] },
        { validate: validateEvidence },
      )
      setAi(parsed)
      const evidence = {}
      let nextId = 1
      BEHAVIORS.forEach((b) => {
        evidence[b.id] = []
        for (const item of parsed.behaviors[b.id]?.evidence || []) {
          const turn = turnById[Number(item.turn)]
          if (!turn) continue
          let quote = String(item.quote || '').trim()
          if (!quote || !turn.text.includes(quote)) quote = trim(turn.text, 220) // never keep a quote that is not in the transcript
          evidence[b.id].push({ id: nextId++, turn: turn.id, quote, text: evidenceLine(turn, roles, quote) })
        }
        evidence[b.id].sort((a, c) => a.turn - c.turn)
      })
      setForm((f) => ({ ...f, evidence }))
      setActive('A3.1')
      setStage('form')
    } catch (e) {
      setError(e.message || 'The evidence search failed.')
      setStage('setup')
    }
  }

  // ---------- Evidence editing ----------
  function addEvidence(behaviorId, turn, quote) {
    setForm((f) => {
      const list = f.evidence[behaviorId] || []
      const id = Math.max(0, ...Object.values(f.evidence).flat().map((e) => e.id)) + 1
      const q = trim(quote, 400)
      return { ...f, evidence: { ...f.evidence, [behaviorId]: [...list, { id, turn: turn.id, quote: q, text: evidenceLine(turn, roles, q) }].sort((a, b) => a.turn - b.turn) } }
    })
  }
  function removeEvidence(behaviorId, id) {
    setForm((f) => ({ ...f, evidence: { ...f.evidence, [behaviorId]: (f.evidence[behaviorId] || []).filter((e) => e.id !== id) } }))
  }
  function editEvidence(behaviorId, id, text) {
    setForm((f) => ({ ...f, evidence: { ...f.evidence, [behaviorId]: (f.evidence[behaviorId] || []).map((e) => (e.id === id ? { ...e, text } : e)) } }))
  }
  function toggleTurn(turn) {
    const list = form.evidence[active] || []
    const hit = list.filter((e) => e.turn === turn.id)
    if (hit.length) hit.forEach((e) => removeEvidence(active, e.id))
    else addEvidence(active, turn, turn.text)
  }
  function addSelection() {
    if (!selection) return
    addEvidence(active, turnById[selection.turnId], selection.text)
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }
  function captureSelection() {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || !sel.anchorNode) { setSelection(null); return }
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement
    const el = node?.closest?.('[data-turn]')
    const endEl = (sel.focusNode?.nodeType === 1 ? sel.focusNode : sel.focusNode?.parentElement)?.closest?.('[data-turn]')
    if (!el || el !== endEl) { setSelection(null); return }
    setSelection({ turnId: Number(el.getAttribute('data-turn')), text: text.replace(/\s+/g, ' ') })
  }
  function seek(turn) {
    if (audioEl.current && turn.start != null) { audioEl.current.currentTime = turn.start; audioEl.current.play().catch(() => {}) }
  }

  // ---------- Save progress and come back later ----------
  async function loadDrafts() {
    try {
      const res = await authFetch('/api/user-actions?action=obs-list', { method: 'POST' })
      if (res.ok) setDrafts((await res.json()).data || [])
    } catch { /* the list is a convenience; ignore */ }
  }

  function draftTitle() {
    const a = form.admin
    if ((form.title || '').trim()) return form.title.trim()
    return [a.clientName.trim() || 'Untitled observation', a.clientSession.trim()].filter(Boolean).join(' – ')
  }

  // Transcript PDF with the selected evidence highlighted (same look as the Audio to Transcript PDF)
  async function downloadAnnotated() {
    setExporting(true); setNotice('')
    try {
      await ensurePdfLibs()
      let logoDataUrl = null
      try { logoDataUrl = await urlToDataUrl(logoWhite) } catch { /* the PDF still works without the logo */ }
      const marks = {}, loose = {}, timesByCode = {}
      const turnById = Object.fromEntries(turns.map((t) => [t.id, t]))
      BEHAVIORS.forEach((b) => (form.evidence[b.id] || []).forEach((e) => {
        const t = turnById[e.turn]
        if (!t) return
        const at = e.quote ? t.text.indexOf(e.quote) : -1
        if (at >= 0) (marks[t.id] = marks[t.id] || []).push({ start: at, end: at + e.quote.length, codes: [b.id] })
        else (loose[t.id] = loose[t.id] || new Set()).add(b.id)
        ;(timesByCode[b.id] = timesByCode[b.id] || new Map()).set(t.id, t.time || `Turn ${t.id}`)
      }))
      const colorOf = (role) => (role === 'coach' ? [0, 32, 91] : role === 'client' ? [46, 117, 182] : [124, 126, 127])
      const last = [...turns].reverse().find((t) => typeof t.start === 'number')
      const doc = buildAnnotatedTranscriptPdf({
        title: draftTitle(),
        dateText: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        durationText: last ? stamp(last.start) : '',
        logoDataUrl,
        turns: turns.map((t, i) => ({
          time: t.time, speaker: roleName(roles[t.speaker]), color: colorOf(roles[t.speaker]), text: t.text,
          pauseText: i > 0 && t.pauseBefore >= 3 ? `pause ${Math.round(t.pauseBefore)} sec` : '',
          marks: marks[t.id] || [], looseCodes: [...(loose[t.id] || [])],
        })),
        index: BEHAVIORS.map((b) => ({
          code: b.id, behavior: b.text, rating: RATINGS.find((r) => r.id === form.ratings[b.id])?.label || '',
          times: [...(timesByCode[b.id]?.entries() || [])].sort((a, c) => a[0] - c[0]).map(([, label]) => label).join(', '),
        })),
      })
      const base = draftTitle().replace(/[^\w\- ]+/g, '').trim() || 'observation'
      doc.save(`${base} - annotated transcript.pdf`)
    } catch (e) {
      setNotice(e.message || 'The PDF could not be made.')
    }
    setExporting(false)
  }

  async function saveDraft(quiet = false) {
    setSavingDraft(true)
    if (!quiet) setNotice('')
    const sent = snapshot
    try {
      const res = await authFetch('/api/user-actions?action=obs-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draftId, title: draftTitle(), data: { form, turns, roles, ai, active } }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `status ${res.status}`)
      setDraftId(body.id)
      lastSaved.current = sent
      setSavedAt(new Date())
      loadDrafts()
    } catch (e) {
      setNotice(`Could not save your progress: ${e.message}. Your work is still on this page. Use "Download form" to keep a copy.`)
    } finally {
      setSavingDraft(false)
    }
  }

  async function openDraft(id) {
    setError('')
    try {
      const res = await authFetch('/api/user-actions?action=obs-get', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const row = await res.json()
      if (!res.ok) throw new Error(row.error || 'Could not open that observation')
      const d = row.data || {}
      const f = { ...emptyForm(), ...d.form }
      setTurns(d.turns || [])
      setRoles(d.roles || {})
      setAi(d.ai || null)
      setForm(f)
      setActive(d.active || 'A3.1')
      setDraftId(row.id)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl('')
      lastSaved.current = JSON.stringify({ form: f, roles: d.roles || {}, active: d.active || 'A3.1' })
      setSavedAt(new Date(row.updated_at))
      setNotice('')
      setStage('form')
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteDraft(id, title) {
    if (!window.confirm(`Delete the saved observation "${title}"? This cannot be undone.`)) return
    try {
      const res = await authFetch('/api/user-actions?action=obs-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Could not delete it')
      if (id === draftId) resetAll()
      loadDrafts()
    } catch (e) {
      setError(e.message)
    }
  }

  function attachRecording(f) {
    if (!f) return
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(URL.createObjectURL(f))
  }

  // ---------- Save ----------
  async function save() {
    setSaving(true)
    setNotice('')
    try {
      const [{ fillObservationForm }, tpl] = await Promise.all([import('../../lib/sof/fillDocx'), fetch(TEMPLATE_URL)])
      if (!tpl.ok) throw new Error('Could not load the ICF form template.')
      const blob = await fillObservationForm(form, await tpl.arrayBuffer())
      const safe = (s) => s.replace(/[^\w\- ]+/g, '').trim()
      const name = ['Session Observation Form', safe(form.admin.clientName), safe(form.admin.clientSession)].filter(Boolean).join(' - ')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${name}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setNotice(missing.length ? `Saved. ${missing.length} item${missing.length === 1 ? ' is' : 's are'} still blank on the form (see the list at the bottom).` : 'Saved. The completed form is in your downloads.')
    } catch (e) {
      setNotice(`Could not save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    if (!window.confirm(draftId ? 'Close this observation and start a new one? Your saved progress stays in your list.' : 'Start over? Everything on this form will be cleared.')) return
    resetAll()
  }

  function resetAll() {
    setStage('input'); setTurns([]); setRoles({}); setAi(null); setForm(emptyForm()); setFile(null); setPlayFile(null)
    setPasted(''); setConsent(false); setNotice(''); setError('')
    setDraftId(null); setSavedAt(null); lastSaved.current = ''; autoCreated.current = false
  }

  // ---------- Pieces ----------
  const activeBehavior = BEHAVIORS.find((b) => b.id === active)
  const codesByTurn = useMemo(() => {
    const m = {}
    BEHAVIORS.forEach((b) => (form.evidence[b.id] || []).forEach((e) => { (m[e.turn] = m[e.turn] || new Set()).add(b.id) }))
    return m
  }, [form.evidence])

  function renderTurnText(turn) {
    const quotes = (form.evidence[active] || []).filter((e) => e.turn === turn.id).map((e) => e.quote).filter((q) => turn.text.includes(q))
    if (!quotes.length) return turn.text
    const marks = []
    quotes.forEach((q) => { const i = turn.text.indexOf(q); if (i >= 0) marks.push([i, i + q.length]) })
    marks.sort((a, b) => a[0] - b[0])
    const merged = []
    marks.forEach((m) => { const l = merged[merged.length - 1]; if (l && m[0] <= l[1]) l[1] = Math.max(l[1], m[1]); else merged.push([...m]) })
    const out = []
    let pos = 0
    merged.forEach(([s, e], i) => {
      if (s > pos) out.push(turn.text.slice(pos, s))
      out.push(<mark key={i} style={{ background: C.green, padding: '1px 0' }}>{turn.text.slice(s, e)}</mark>)
      pos = e
    })
    if (pos < turn.text.length) out.push(turn.text.slice(pos))
    return out
  }

  const radio = (checked, onChange, text, key) => (
    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, cursor: 'pointer' }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ marginTop: 3 }} /> <span>{text}</span>
    </label>
  )
  const check = (checked, onChange, text, key) => (
    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, cursor: 'pointer', marginBottom: 6 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} /> <span>{text}</span>
    </label>
  )
  const field = (text, value, onChange, props = {}) => (
    <div>
      <label style={label}>{text}</label>
      <input style={input} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  )

  // ---------- Screens ----------
  if (stage === 'input') {
    const ready = file || pasted.trim().length > 20
    return (
      <Layout active="observation" pageTitle="Session Observation Form Mentor Coaching">
        <div style={{ fontFamily: font, maxWidth: 960, margin: '0 auto', padding: 32 }}>
          {drafts.length > 0 && (
            <div style={card}>
              <h2 style={h2}>Continue a saved observation</h2>
              {error && <div style={{ color: '#b42318', fontSize: 13, margin: '8px 0' }}>{error}</div>}
              {drafts.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{d.title}</div>
                    <div style={small}>Last saved {new Date(d.updated_at).toLocaleString()}</div>
                  </div>
                  <button style={{ ...btn(true), padding: '7px 14px' }} onClick={() => openDraft(d.id)}>Open</button>
                  <button style={{ ...btn(false), padding: '7px 14px' }} onClick={() => deleteDraft(d.id, d.title)}>Delete</button>
                </div>
              ))}
            </div>
          )}
          <div style={card}>
            <h2 style={h2}>Start a session observation</h2>
            <p style={small}>
              Add the participant&rsquo;s coaching session as a transcript. The tool finds evidence for each ICF behavior
              and highlights it in the transcript. You edit the evidence, choose every rating, and save the completed ICF form.
            </p>
            <div style={{ height: 14 }} />

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
              style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 26, textAlign: 'center', cursor: 'pointer', background: C.soft }}
            >
              <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                {file ? file.name : 'Click to choose a .txt or .pdf transcript, or drop it here'}
              </div>
              <div style={small}>Speaker names and timestamps help. For example: [05:32] Coach: ...</div>
              <input ref={fileRef} type="file" hidden
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>

            {(
              <>
                <div style={{ ...small, margin: '14px 0 6px' }}>Paste the transcript here, or choose a file above:</div>
                <textarea style={{ ...input, minHeight: 130, resize: 'vertical' }} value={pasted} onChange={(e) => setPasted(e.target.value)}
                  placeholder={'[00:05] Coach: What would you like to focus on today?\n[00:11] Client: ...'} />
                {(
                  <>
                    <div style={{ ...small, margin: '14px 0 6px' }}>
                      Optional: add the recording to play along with the transcript as you review. It plays only on your computer and is not uploaded.
                    </div>
                    <button style={btn(false)} onClick={() => audioFileRef.current?.click()}>{playFile ? playFile.name : 'Choose recording to play'}</button>
                    <input ref={audioFileRef} type="file" accept="audio/*,video/mp4,video/quicktime,video/webm" hidden onChange={(e) => pickPlayFile(e.target.files?.[0])} />
                  </>
                )}
              </>
            )}

            <p style={{ ...small, marginTop: 14 }}>
              The transcript text is sent to Claude (Anthropic) to find evidence. Recordings are never stored. If you press Save progress, CoachRICE keeps the transcript text and your answers so you can finish later.
            </p>
            {error && <div style={{ color: '#b42318', fontSize: 13, margin: '12px 0' }}>{error}</div>}
            <div style={{ marginTop: 16 }}>
              <button style={btn(true, !ready)} disabled={!ready} onClick={loadTranscript}>Continue</button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (stage === 'analyzing') {
    return (
      <Layout active="observation" pageTitle="Session Observation Form Mentor Coaching">
        <div style={{ fontFamily: font, maxWidth: 960, margin: '0 auto', padding: 32 }}>
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 14 }}>{progress.label}</div>
            <div style={{ height: 8, background: C.soft, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress.pct || 100}%`, height: '100%', background: C.sky, transition: 'width .3s', opacity: progress.pct ? 1 : 0.5 }} />
            </div>
            {progress.pct > 0 && progress.pct < 100 && (
              <div style={{ marginTop: 16 }}><button style={btn(false)} onClick={() => xhrRef.current?.abort()}>Cancel</button></div>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  if (stage === 'setup') {
    const speakerIds = [...new Set(turns.map((t) => t.speaker))]
    return (
      <Layout active="observation" pageTitle="Session Observation Form Mentor Coaching">
        <div style={{ fontFamily: font, maxWidth: 960, margin: '0 auto', padding: 32 }}>
          <div style={card}>
            <h2 style={h2}>Who is who?</h2>
            <p style={small}>Tell the tool which speaker is the coach (the participant you are evaluating) and which is the client.</p>
            {speakerIds.map((id) => {
              const sample = turns.find((t) => t.speaker === id)
              return (
                <div key={id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                  <select style={{ ...input, width: 140 }} value={roles[id] || ''} onChange={(e) => setRoles((r) => ({ ...r, [id]: e.target.value }))}>
                    <option value="">Choose role…</option>
                    <option value="coach">Coach</option>
                    <option value="client">Client</option>
                    <option value="other">Other</option>
                  </select>
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <strong style={{ color: C.navy }}>{sample.label}</strong>
                    <div style={small}>{trim(sample.text, 160)}</div>
                  </div>
                </div>
              )
            })}
            <p style={{ ...small, marginTop: 14 }}>
              {turns.length} speaker turns found. {turns.some((t) => t.time) ? 'Timestamps found.' : 'No timestamps found, so the form will note that none were recorded.'}
            </p>
            {error && <div style={{ color: '#b42318', fontSize: 13, margin: '12px 0' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={btn(false)} onClick={() => setStage('input')}>Back</button>
              <button style={btn(true, !rolesReady || !hasCoach)} disabled={!rolesReady || !hasCoach} onClick={findEvidence}>Find evidence</button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // ---------- The form ----------
  const activeEvidence = form.evidence[active] || []
  const sug = ai?.behaviors?.[active]
  const q1Fail = form.q.q1 === 'not_observed' || form.q.q2 === 'not_observed'

  return (
    <Layout active="observation" pageTitle="Session Observation Form Mentor Coaching">
      <div style={{ fontFamily: font, maxWidth: 1400, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <label style={label} htmlFor="obs-title">Name of this observation</label>
        <input id="obs-title" style={{ ...input, fontSize: 16, fontWeight: 700, color: C.navy, maxWidth: 560 }} value={form.title || ''}
          onChange={(e) => set({ title: e.target.value })} placeholder="For example: Jordan R. – Session 2" maxLength={120} />
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,32,91,0.08)' }}>
        <button style={btn(true, savingDraft)} disabled={savingDraft} onClick={() => saveDraft(false)}>{savingDraft ? 'Saving…' : 'Save progress'}</button>
        <button style={btn(false, saving)} disabled={saving} onClick={save}>{saving ? 'Building form…' : 'Download form (.docx)'}</button>
        <button style={btn(false, exporting)} disabled={exporting} onClick={downloadAnnotated}>{exporting ? 'Making PDF…' : 'Download annotated transcript (PDF)'}</button>
        <span style={{ fontSize: 12, color: dirty ? C.orange : C.gray, fontWeight: 600 }}>
          {savingDraft ? 'Saving…' : dirty ? (draftId ? 'Unsaved changes (saves itself every 30 seconds)' : 'Saving soon…') : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </span>
        {notice && <span style={{ fontSize: 12, color: C.navy, fontWeight: 600, flexBasis: '100%' }}>{notice}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 5fr) minmax(380px, 7fr)', gap: 18, alignItems: 'start' }}>

        {/* Transcript */}
        <div style={{ ...card, padding: 0, position: 'sticky', top: 74, maxHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 800, color: C.navy, fontSize: 14 }}>Transcript</div>
            <div style={{ ...small, marginTop: 4 }}>
              Evidence for <strong style={{ color: C.navy }}>{activeBehavior.id}</strong> is highlighted. Use <strong>+</strong> to add a whole turn, or select words and press the button below.
            </div>
            {audioUrl && <audio ref={audioEl} src={audioUrl} controls style={{ width: '100%', marginTop: 10, height: 36 }} />}
            {!audioUrl && (
              <div style={{ marginTop: 10 }}>
                <button style={{ ...btn(false), padding: '6px 10px', fontSize: 12 }} onClick={() => audioFileRef.current?.click()}>Add recording to listen</button>
                <input ref={audioFileRef} type="file" accept="audio/*,video/mp4,video/quicktime,video/webm" hidden onChange={(e) => attachRecording(e.target.files?.[0])} />
              </div>
            )}
            <button style={{ ...btn(true, !selection), marginTop: 10, padding: '8px 12px', fontSize: 12 }} disabled={!selection} onClick={addSelection}>
              Add selected words to {activeBehavior.id}
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '8px 12px' }} onMouseUp={captureSelection} onKeyUp={captureSelection}>
            {turns.map((t) => {
              const on = activeEvidence.some((e) => e.turn === t.id)
              const codes = [...(codesByTurn[t.id] || [])].filter((c) => c !== active)
              const role = roles[t.speaker]
              return (
                <div key={t.id} id={`turn-${t.id}`} data-turn={t.id}
                  style={{ display: 'flex', gap: 8, padding: '8px 8px', margin: '3px 0', borderRadius: 8, fontSize: 12.5, lineHeight: 1.55,
                    background: on ? '#eef9fc' : 'transparent', borderLeft: `4px solid ${on ? C.sky : codes.length ? C.blue : 'transparent'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: role === 'coach' ? C.navy : C.gray, marginBottom: 2 }}>
                      {roleName(role)}
                      {t.time && (
                        <span onClick={() => seek(t)} title={audioUrl ? 'Play from here' : ''} style={{ marginLeft: 8, fontWeight: 600, color: C.gray, cursor: audioUrl ? 'pointer' : 'default', textDecoration: audioUrl ? 'underline' : 'none' }}>
                          {t.time}
                        </span>
                      )}
                      {t.pauseBefore >= 3 && <span style={{ marginLeft: 8, color: C.orange }}>pause {Math.round(t.pauseBefore)}s</span>}
                    </div>
                    <div>{renderTurnText(t)}</div>
                    {codes.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {codes.map((c) => (
                          <span key={c} onClick={() => setActive(c)} style={{ fontSize: 10, fontWeight: 700, background: C.soft, color: C.navy, padding: '1px 6px', borderRadius: 8, cursor: 'pointer' }}>{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button title={on ? `Remove from ${active}` : `Add to ${active}`} onClick={() => toggleTurn(t)}
                    style={{ border: `1px solid ${on ? C.sky : C.border}`, background: on ? C.sky : C.white, color: C.navy, width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontFamily: font, alignSelf: 'flex-start' }}>
                    {on ? '✓' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <div>
          <div style={{ ...card, background: C.navy, color: C.white, border: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>ICF Mentor Coaching Session Observation Form &ndash; ACC</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              Evidence below comes from the transcript. Edit it freely. The AI offers suggestions only: you choose every rating and every box.
            </div>
          </div>

          <div style={card}>
            <h2 style={h2}>Administrative Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {field('1. Mentor Coach Name', form.admin.name, (v) => setAdmin('name', v))}
              {field('2. Mentor Coach Email', form.admin.email, (v) => setAdmin('email', v), { type: 'email' })}
              {field('3. Mentor Coach Client Name', form.admin.clientName, (v) => setAdmin('clientName', v))}
              {field('4. Mentor Coach Client Email', form.admin.clientEmail, (v) => setAdmin('clientEmail', v), { type: 'email' })}
              {field('5. Date of Client’s Coaching Session or other Session Identification', form.admin.clientSession, (v) => setAdmin('clientSession', v))}
              {field('6. Date of Mentor Coaching Session', form.admin.mentorSession, (v) => setAdmin('mentorSession', v))}
            </div>
            <div style={{ ...label, marginTop: 14 }}>7. Level of the mentor coaching services provider</div>
            <div style={{ display: 'flex', gap: 18 }}>
              {LEVELS.map((l) => radio(form.level === l, () => set({ level: l }), l, l))}
            </div>
          </div>

          <div style={card}>
            <h2 style={h2}>Mentor Coach Self-Review Checklist</h2>
            <p style={small}>Complete this self-review checklist before completing the observation form.</p>
            {SELF_REVIEW.map((text, i) => check(form.selfReview[i], (v) => set({ selfReview: form.selfReview.map((b, j) => (j === i ? v : b)) }), text, i))}
          </div>

          <div style={card}>
            <h2 style={h2}>Competency 1: Demonstrates Ethical Practice</h2>
            <p style={small}>
              Listen to and evaluate the entire recording first. Select &ldquo;Observed&rdquo; when there was sufficient evidence that a qualifier was demonstrated, and
              &ldquo;Not Observed&rdquo; when it did not occur. If either qualifier is Not Observed, give context or examples and name the specific standard in the ICF Code of Ethics.
            </p>
            {QUALIFIERS.map((q) => {
              const s = ai?.[q.id]
              return (
                <div key={q.id} style={{ margin: '14px 0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{q.text}</div>
                  <div style={{ display: 'flex', gap: 22 }}>
                    {radio(form.q[q.id] === 'observed', () => set({ q: { ...form.q, [q.id]: 'observed' } }), 'Observed', 'o')}
                    {radio(form.q[q.id] === 'not_observed', () => set({ q: { ...form.q, [q.id]: 'not_observed' } }), 'Not Observed', 'n')}
                  </div>
                  {s && (
                    <div style={{ ...small, marginTop: 6, background: C.soft, borderRadius: 8, padding: '8px 10px' }}>
                      <strong>AI suggestion:</strong> {s.suggested === 'observed' ? 'Observed' : 'Not Observed'}. {s.note}
                      {(s.turns || []).filter((n) => turnById[n]).map((n) => (
                        <a key={n} href={`#turn-${n}`} style={{ marginLeft: 6, color: C.navy, fontWeight: 700 }}>turn {n}</a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <label style={label}>Comments {q1Fail ? '(required: a qualifier is Not Observed)' : ''}</label>
            <textarea style={{ ...input, minHeight: 90, borderColor: q1Fail && !form.qComments.trim() ? '#b42318' : C.border }}
              value={form.qComments} onChange={(e) => set({ qComments: e.target.value })} />
          </div>

          <div style={card}>
            <h2 style={h2}>Competency 2: Embodies a Coaching Mindset</h2>
            <p style={small}>There are no behavioral statements in this competency. It cannot be fully captured in a single moment in time.</p>
          </div>

          {COMPETENCIES.map((c) => (
            <div key={c.n} style={card}>
              <h2 style={h2}>Competency {c.n}: {c.name}</h2>
              <p style={small}>Definition: {c.definition}</p>
              {BEHAVIORS.filter((b) => b.comp === c.n).map((b) => {
                const isActive = b.id === active
                const s = ai?.behaviors?.[b.id]
                const items = form.evidence[b.id] || []
                return (
                  <div key={b.id} onClick={() => setActive(b.id)}
                    style={{ border: `2px solid ${isActive ? C.sky : C.border}`, borderRadius: 10, padding: 14, marginTop: 14, background: isActive ? '#f7fcfe' : C.white }}>
                    <div style={{ fontWeight: 700, color: C.navy, fontSize: 13.5, marginBottom: 8 }}>{b.id} {b.text}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                      {RATINGS.map((r) => radio(form.ratings[b.id] === r.id, () => set({ ratings: { ...form.ratings, [b.id]: r.id } }), <span title={r.hint}>{r.label}</span>, r.id))}
                    </div>
                    {s && (
                      <div style={{ ...small, marginTop: 8, background: C.soft, borderRadius: 8, padding: '8px 10px' }}>
                        <strong>AI suggestion:</strong> {RATINGS.find((r) => r.id === s.suggested)?.label || 'None'}. {s.note}
                        {form.ratings[b.id] !== s.suggested && RATINGS.some((r) => r.id === s.suggested) && (
                          <button onClick={(e) => { e.stopPropagation(); set({ ratings: { ...form.ratings, [b.id]: s.suggested } }) }}
                            style={{ marginLeft: 8, border: 'none', background: 'none', color: C.navy, fontWeight: 700, fontFamily: font, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                            Use this rating
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ ...label, marginTop: 12 }}>Evidence of Behavior</div>
                    {items.length === 0 && <div style={small}>No evidence yet. {isActive ? 'Use the + buttons in the transcript.' : 'Select this behavior, then use the + buttons in the transcript.'}</div>}
                    {items.map((e) => (
                      <div key={e.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <textarea style={{ ...input, minHeight: 54, resize: 'vertical' }} value={e.text} onChange={(ev) => editEvidence(b.id, e.id, ev.target.value)} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <a href={`#turn-${e.turn}`} title="Show in transcript" style={{ fontSize: 11, color: C.navy, fontWeight: 700, textAlign: 'center' }}>view</a>
                          <button title="Remove" onClick={(ev) => { ev.stopPropagation(); removeEvidence(b.id, e.id) }}
                            style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 6, cursor: 'pointer', width: 24, height: 24 }}>&times;</button>
                        </div>
                      </div>
                    ))}
                    <textarea style={{ ...input, minHeight: 40, resize: 'vertical', marginTop: 4 }} placeholder="Add your own notes (optional)"
                      value={form.evidenceNotes[b.id] || ''} onChange={(e) => set({ evidenceNotes: { ...form.evidenceNotes, [b.id]: e.target.value } })} />
                  </div>
                )
              })}
            </div>
          ))}

          <div style={card}>
            <h2 style={h2}>Observation Feedback</h2>
            <p style={small}>
              Provide detailed feedback with a minimum of 2&ndash;3 areas of strength and 2&ndash;3 areas for development. Support each with evidence
              (timestamps, quotes) and written feedback. Use as many competency rows as you need.
            </p>
            {[['Areas of Strengths', 'strengths'], ['Areas for Development', 'development']].map(([title, key]) => (
              <div key={key} style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, color: C.navy, fontSize: 14, marginBottom: 6 }}>{title}</div>
                {form[key].map((row, i) => {
                  const c = COMPETENCIES[i]
                  const upd = (patch) => set({ [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) })
                  return (
                    <div key={c.n} style={{ borderTop: `1px solid ${C.border}`, padding: '12px 0' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 6 }}>Competency {c.n}: {c.name}</div>
                      {field('Statement for Feedback', row.statement, (v) => upd({ statement: v }))}
                      <label style={{ ...label, marginTop: 8 }}>Feedback Comments</label>
                      <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={row.comments} onChange={(e) => upd({ comments: e.target.value })} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div style={card}>
            <h2 style={h2}>Mentor Coach Signature</h2>
            <p style={small}>By signing, I attest to the following:</p>
            <ul style={{ fontSize: 13, lineHeight: 1.55, paddingLeft: 20, margin: '8px 0 14px' }}>
              {ATTESTATIONS.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}
            </ul>
            {check(form.attested, (v) => set({ attested: v }), 'I attest to all four statements above.', 'att')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              {field('Mentor Coach’s Printed Name', form.printedName, (v) => set({ printedName: v }))}
              {field('Mentor Coach’s Signature (type your name)', form.signature, (v) => set({ signature: v }))}
              {field('Date Signed', form.dateSigned, (v) => set({ dateSigned: v }))}
            </div>
            <p style={{ ...small, marginTop: 10 }}>Digital or written signatures are both accepted by ICF. You can also print the saved form and sign it by hand.</p>
          </div>

          <div style={card}>
            <h2 style={h2}>Save</h2>
            {missing.length > 0 ? (
              <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>
                <strong>Still blank on the form ({missing.length}):</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                <div style={small}>You can save now and finish the form later in Word. The saved file keeps what you entered.</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, marginBottom: 12, color: '#2f6b1f', fontWeight: 700 }}>Everything on the form is complete.</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btn(false, savingDraft)} disabled={savingDraft} onClick={() => saveDraft(false)}>{savingDraft ? 'Saving…' : 'Save progress'}</button>
              <button style={btn(true, saving)} disabled={saving} onClick={save}>{saving ? 'Building form…' : 'Download form (.docx)'}</button>
              <button style={btn(false)} onClick={startOver}>{draftId ? 'Close' : 'Start over'}</button>
              {draftId && (
                <button style={{ ...btn(false), borderColor: '#b42318', color: '#b42318', marginLeft: 'auto' }} onClick={() => deleteDraft(draftId, draftTitle())}>
                  Delete this observation
                </button>
              )}
            </div>
            {notice && <div style={{ ...small, marginTop: 12, color: C.navy, fontWeight: 600 }}>{notice}</div>}
            <div style={{ ...small, marginTop: 10 }}>Save progress keeps your work in CoachRICE so you can come back later. Delete removes the saved copy, including the transcript, for good. Download form gives you the completed ICF Word file. Recordings are never stored; add the recording again when you reopen to listen.</div>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  )
}

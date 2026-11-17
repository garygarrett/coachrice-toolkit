import { useState, useEffect, useRef, useMemo } from 'react'
import CompetencyReview from './CompetencyReview'
import GuidedTour from '../../components/GuidedTour'
import TourHelpButton from '../../components/TourHelpButton'
import { HOME_TOUR, FORM_TOUR } from '../../lib/tourSteps'
import { tourSeen, markTourSeen } from '../../lib/tourSeen'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../lib/authFetch'
import { aiJson } from '../../lib/ai'
import { parseTranscriptText, stamp } from '../../lib/sof/transcript'
import { downloadAnnotatedTranscript, downloadFilledForm, observationTitle } from '../../lib/sof/annotatedExport'
import { EVIDENCE_SYSTEM, buildEvidenceInput, validateEvidence } from '../../lib/sof/evidencePrompt'
import {
  RATINGS, LEVELS, SELF_REVIEW, QUALIFIERS, COMPETENCIES, BEHAVIORS, ATTESTATIONS,
  emptyForm, missingItems,
} from '../../lib/sof/formSpec'
import { emptyReview, missingReviewItems } from '../../lib/crf/crfSpec'

const C = {
  navy: '#00205B', gray: '#7C7E7F', white: '#FFFFFF', sky: '#69cce6', blue: '#78b3e0',
  orange: '#ff8200', green: '#c9d647', border: '#e2e6ec', soft: '#f0f2f5',
}
const font = "'Montserrat', sans-serif"
// Short names for the competency side bar.
const SHORT = { 3: 'Agreements', 4: 'Trust & Safety', 5: 'Presence', 6: 'Active Listening', 7: 'Evokes Awareness', 8: 'Client Growth' }
// Mentor coaches do not get the AI's suggested ratings. Keep only the evidence (what the transcript highlights use).
function withoutSuggestions(ai) {
  if (!ai) return ai
  const behaviors = {}
  Object.entries(ai.behaviors || {}).forEach(([id, b]) => { behaviors[id] = { evidence: b?.evidence || [] } })
  return { behaviors }
}
// A to Z by participant name, ignoring capital letters.
const az = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
const MAX_BYTES = 500 * 1024 * 1024

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

// The name of an observation linked to a cohort participant. Complete/Incomplete follows the form as it is filled in.
function autoNameFor(link, form) {
  if (!link || !link.participantName || !link.formNumber) return ''
  const status = missingItems(form).length === 0 ? 'Complete' : 'Incomplete'
  return `${link.participantName} - SOF #${link.formNumber} (${status})`
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
  // "What would you like to create?": the bottom half of the start screen is either the Session Observation Form
  // or the Competency Review Form, on this same page. ?form=review (the old Competency Review link) starts on the review.
  const [tour, setTour] = useState(null) // 'home' | 'form' | null: the guided tour that is open
  const [listsLoaded, setListsLoaded] = useState({ drafts: false, cohorts: false }) // the home tour waits for these
  const [mode, setMode] = useState(() => (new URLSearchParams(window.location.search).get('form') === 'review' ? 'review' : 'sof'))
  const [crfRequest, setCrfRequest] = useState(() => {
    const pid = new URLSearchParams(window.location.search).get('participant')
    return pid ? { participantId: pid, n: 1 } : null
  })
  const [crfStage, setCrfStage] = useState('start')
  const [drafts, setDrafts] = useState([])
  const [reviews, setReviews] = useState([]) // this account's saved Competency Review Forms
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const { profile } = useAuth()
  const [cohorts, setCohorts] = useState([]) // cohorts this account is assigned to, with participants and which forms exist
  const [pick, setPick] = useState({ cohortId: '', participantId: '', formNumber: 0 }) // choice on the start screen
  const [link, setLink] = useState(null) // { cohortId, participantId, formNumber, participantName } for the observation being worked on
  const [relink, setRelink] = useState({ participantId: '', formNumber: 0 }) // choice in the "Participant and form" panel
  const [relinking, setRelinking] = useState(false)
  const [viewPersonId, setViewPersonId] = useState('') // participant chosen in the "By participant" dropdown
  const startCardRef = useRef(null)
  const [navActive, setNavActive] = useState('sec-info') // section highlighted in the side bar between transcript and form
  const navLockUntil = useRef(0) // after a side bar click, ignore scroll tracking until the smooth scroll ends
  const [cohortFilter, setCohortFilter] = useState('') // cohort chosen at the top of the page ('' = all cohorts)
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
  useEffect(() => { loadDrafts(); loadCohorts() }, [])

  // Fill in what we already know: the mentor coach's own name and email, and the participant's name as the client.
  // Only empty boxes are filled, so anything typed (or saved earlier) is never overwritten.
  useEffect(() => {
    if (stage !== 'setup' && stage !== 'form') return
    setForm((f) => {
      const a = f.admin || {}
      const next = { ...a }
      if (!(a.name || '').trim() && profile?.full_name) next.name = profile.full_name
      if (!(a.email || '').trim() && profile?.email) next.email = profile.email
      if (!(a.clientName || '').trim() && link?.participantName) next.clientName = link.participantName
      const same = next.name === a.name && next.email === a.email && next.clientName === a.clientName
      return same ? f : { ...f, admin: next }
    })
  }, [stage, profile, link])

  // Side bar: highlight the form section that is on screen.
  useEffect(() => {
    if (stage !== 'form' || typeof IntersectionObserver === 'undefined') return undefined
    const ids = ['sec-info', 'sec-c1', ...COMPETENCIES.map((c) => `sec-c${c.n}`), 'sec-sign']
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const seen = new Set()
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)))
      const first = ids.find((id) => seen.has(id))
      if (first && Date.now() > navLockUntil.current) setNavActive(first)
    }, { rootMargin: '-150px 0px -50% 0px' })
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [stage])

  // Saved observations split by the same rule used everywhere else: Complete = nothing left to fill in.
  const isCompleteDraft = (d) => missingItems({ ...emptyForm(), ...(d.form || {}) }).length === 0
  // The cohort selector at the top limits the lists below it. "All cohorts" shows everything, including forms not linked to a cohort.
  const shownDrafts = cohortFilter ? drafts.filter((d) => d.cohort_id === cohortFilter) : drafts
  const completedDrafts = shownDrafts.filter(isCompleteDraft)
  const inProgressDrafts = shownDrafts.filter((d) => !isCompleteDraft(d))
  // Saved Competency Review Forms join the same lists (tagged CRF), newest first together with the observations.
  const isCompleteReview = (r) => missingReviewItems({ ...emptyReview(), ...(r.review || {}) }).length === 0
  const shownReviews = (cohortFilter ? reviews.filter((r) => r.cohort_id === cohortFilter) : reviews).map((r) => ({ ...r, kind: 'crf' }))
  const byNewest = (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  const savedInProgress = [...inProgressDrafts.map((d) => ({ ...d, kind: 'sof' })), ...shownReviews.filter((r) => !isCompleteReview(r))].sort(byNewest)
  const savedCompleted = [...completedDrafts.map((d) => ({ ...d, kind: 'sof' })), ...shownReviews.filter(isCompleteReview)].sort(byNewest)
  async function deleteReview(id, title) {
    if (!window.confirm(`Delete "${title}" for good? This cannot be undone.`)) return
    try {
      const res = await authFetch('/api/user-actions?action=crf-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error('Could not delete it')
      loadDrafts(); loadCohorts()
    } catch (e) { setError(e.message) }
  }

  // A mentor coach who is assigned to a cohort must say who the observation is for.
  // Admins who are not mentor coaches may skip it.
  // Only admins see the AI's suggested ratings and may start an observation that is not for a participant.
  // While the profile is still loading, treat the person as a mentor coach so nothing flashes up.
  const isAdmin = profile?.role === 'admin' || profile?.role === 'admin_tools'

  // Guided tours: they start by themselves the first time a mentor coach or tool admin sees each screen. The buttons replay them.
  const startHomeTour = () => { setMode('sof'); setTimeout(() => setTour('home'), 80) }
  const closeTour = () => { if (profile?.id && tour) markTourSeen(profile.id, tour); setTour(null) }
  useEffect(() => {
    if (!profile?.id || (profile.role !== 'mentor' && profile.role !== 'admin_tools')) return undefined
    const which = stage === 'input' && mode === 'sof' && listsLoaded.drafts && listsLoaded.cohorts ? 'home' : stage === 'form' ? 'form' : null
    if (!which || tour || tourSeen(profile.id, which)) return undefined
    const t = setTimeout(() => setTour(which), 700)
    return () => clearTimeout(t)
  }, [profile?.id, profile?.role, stage, mode, listsLoaded, tour])
  // A link like /tools/session-observation?tour=home (used by FAQ / Guide) opens the home tour.
  useEffect(() => {
    if (profile?.id && listsLoaded.drafts && listsLoaded.cohorts && new URLSearchParams(window.location.search).get('tour') === 'home') {
      window.history.replaceState(null, '', window.location.pathname)
      startHomeTour()
    }
  }, [profile?.id, listsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickRequired = !isAdmin && cohorts.length > 0
  const pickPerson = cohorts.flatMap((c) => c.participants.map((p) => ({ ...p, cohortId: c.id }))).find((p) => p.id === pick.participantId) || null
  const pickCohort = cohorts.find((c) => c.id === pickPerson?.cohortId) || null
  const shownCohorts = cohortFilter ? cohorts.filter((c) => c.id === cohortFilter) : cohorts
  const pickTaken = pickPerson?.forms.find((f) => f.formNumber === pick.formNumber) || null // the chosen form number already has a saved observation
  const pickReady = pickPerson ? pick.formNumber > 0 && !pickTaken : !pickRequired

  // "Participant and form" panel on the form screen: change who a saved observation is for.
  const allPeople = cohorts.flatMap((c) => c.participants.map((p) => ({ ...p, cohortId: c.id })))
  const peopleAZ = allPeople.filter((p) => !cohortFilter || p.cohortId === cohortFilter).sort(az) // participants in the chosen cohort(s), A to Z
  const viewPerson = peopleAZ.find((p) => p.id === viewPersonId) || null
  const relinkPerson = allPeople.find((p) => p.id === relink.participantId)
    || (link && link.participantId === relink.participantId ? { id: link.participantId, name: link.participantName, cohortId: link.cohortId, forms: [] } : null)
  // A form number is taken if that participant has it saved, unless it is this very observation.
  const relinkTaken = (n) => {
    const e = relinkPerson?.forms.find((f) => f.formNumber === n)
    return !!e && !(e.mine && e.id === draftId)
  }
  const relinkChanged = relink.participantId !== (link?.participantId || '') || relink.formNumber !== (link?.formNumber || 0)
  const relinkValid = relink.participantId ? relink.formNumber > 0 && !relinkTaken(relink.formNumber) : !pickRequired
  useEffect(() => {
    setRelink({ participantId: link?.participantId || '', formNumber: link?.formNumber || 0 })
  }, [link])

  // Linked observations are named automatically. The saved copy (and every download) carries that name.
  const autoName = useMemo(() => autoNameFor(link, form), [link, form])
  const savedForm = autoName ? { ...form, title: autoName } : form

  const snapshot = useMemo(() => JSON.stringify({ form, roles, active, name: autoName }), [form, roles, active, autoName])
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
    // If this observation is for a cohort participant, fill in their name on the form.
    // The observation's own name is generated from the participant and form number.
    if (pickPerson && pick.formNumber) {
      setLink({ cohortId: pickPerson.cohortId, participantId: pickPerson.id, formNumber: pick.formNumber, participantName: pickPerson.name })
      setForm((f) => ({
        ...f,
        noTimestamps: !t.some((x) => x.time),
        admin: { ...f.admin, clientName: f.admin.clientName || pickPerson.name },
      }))
    } else {
      setLink(null)
      set({ noTimestamps: !t.some((x) => x.time) })
    }
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
      setAi(isAdmin ? parsed : withoutSuggestions(parsed))
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
      const rv = await authFetch('/api/user-actions?action=crf-list', { method: 'POST' })
      if (rv.ok) setReviews((await rv.json()).data || [])
    } catch { /* the list is a convenience; ignore */ } finally { setListsLoaded((l) => ({ ...l, drafts: true })) }
  }

  // "Start SOF #n" in the By participant panel: fill in the start card below and bring it into view.
  function startFormFor(person, n) {
    setPick({ cohortId: person.cohortId, participantId: person.id, formNumber: n })
    setTimeout(() => startCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // The participants assigned to this account (grouped by cohort), and which form numbers already exist.
  async function loadCohorts() {
    try {
      const res = await authFetch('/api/user-actions?action=cohort-mine', { method: 'POST' })
      if (!res.ok) return
      const list = ((await res.json()).cohorts || [])
        .map((c) => ({ ...c, participants: [...c.participants].sort(az) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      setCohorts(list)
      setViewPersonId((id) => (list.some((c) => c.participants.some((p) => p.id === id)) ? id : ''))
      setPick((p) => (list.some((c) => c.participants.some((x) => x.id === p.participantId)) ? p : { cohortId: '', participantId: '', formNumber: 0 }))
      setCohortFilter((id) => (list.some((c) => c.id === id) ? id : ''))
    } catch { /* the picker is optional for most accounts; ignore */ } finally { setListsLoaded((l) => ({ ...l, cohorts: true })) }
  }

  // Change the participant and form number of the observation that is open (also works for older, unlinked ones).
  async function applyRelink() {
    const person = relink.participantId ? relinkPerson : null
    const newLink = person ? { cohortId: person.cohortId, participantId: person.id, formNumber: relink.formNumber, participantName: person.name } : null
    const oldName = link?.participantName || ''
    // Keep the form's Client name in step: fill it if empty, or swap it if it still holds the old participant's name.
    const nextForm = (() => {
      const admin = { ...form.admin }
      const current = (admin.clientName || '').trim()
      if (newLink && (!current || current === oldName)) admin.clientName = newLink.participantName
      return { ...form, admin, title: newLink ? form.title : '' }
    })()
    setRelinking(true); setNotice('')
    try {
      if (draftId) {
        const res = await authFetch('/api/user-actions?action=obs-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draftId,
            participantId: newLink?.participantId || null,
            formNumber: newLink?.formNumber,
            title: newLink ? autoNameFor(newLink, nextForm) : observationTitle(nextForm),
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `status ${res.status}`)
      }
      setLink(newLink)
      setForm(nextForm)
      setNotice(newLink ? `This observation is now for ${newLink.participantName}, SOF #${newLink.formNumber}.` : 'This observation is no longer linked to a participant.')
      loadCohorts(); loadDrafts()
    } catch (e) {
      setNotice(`Could not change the participant: ${e.message}`)
    } finally {
      setRelinking(false)
    }
  }

  const draftTitle = () => observationTitle(savedForm)

  // Transcript PDF with the selected evidence highlighted (same look as the Audio to Transcript PDF)
  async function downloadAnnotated() {
    setExporting(true); setNotice('')
    try { await downloadAnnotatedTranscript({ form: savedForm, turns, roles }) }
    catch (e) { setNotice(e.message || 'The PDF could not be made.') }
    setExporting(false)
  }

  async function saveDraft(quiet = false) {
    setSavingDraft(true)
    if (!quiet) setNotice('')
    const sent = snapshot
    try {
      const res = await authFetch('/api/user-actions?action=obs-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draftId, title: draftTitle(), data: { form: savedForm, turns, roles, ai, active }, link }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `status ${res.status}`)
      setDraftId(body.id)
      lastSaved.current = sent
      setSavedAt(new Date())
      loadDrafts()
      return true
    } catch (e) {
      setNotice(`Could not save your progress: ${e.message}. Your work is still on this page. Use "Download form" to keep a copy.`)
      return false
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
      setAi(isAdmin ? (d.ai || null) : withoutSuggestions(d.ai || null))
      const openedLink = row.participant_id
        ? { cohortId: row.cohort_id, participantId: row.participant_id, formNumber: row.form_number, participantName: row.participant_name || '' }
        : null
      setLink(openedLink)
      setForm(f)
      setActive(d.active || 'A3.1')
      setDraftId(row.id)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl('')
      lastSaved.current = JSON.stringify({ form: f, roles: d.roles || {}, active: d.active || 'A3.1', name: autoNameFor(openedLink, f) })
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
      loadCohorts() // deleting frees that participant's form number again
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
      await downloadFilledForm(savedForm)
      setNotice(missing.length ? `Saved. ${missing.length} item${missing.length === 1 ? ' is' : 's are'} still blank on the form (see the list at the bottom).` : 'Saved. The completed form is in your downloads.')
    } catch (e) {
      setNotice(`Could not save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // "Back to my observations": save what is unsaved, then return to the start screen (the saved list refreshes).
  async function goBack() {
    if (dirty) {
      const saved = await saveDraft(true)
      if (!saved && !window.confirm('Your latest changes could not be saved. Leave this observation anyway?')) return
    }
    resetAll()
    loadDrafts()
  }

  function startOver() {
    if (!window.confirm(draftId ? 'Close this observation and start a new one? Your saved progress stays in your list.' : 'Start over? Everything on this form will be cleared.')) return
    resetAll()
  }

  function resetAll() {
    setStage('input'); setTurns([]); setRoles({}); setAi(null); setForm(emptyForm()); setFile(null); setPlayFile(null)
    setPasted(''); setNotice(''); setError('')
    setDraftId(null); setSavedAt(null); lastSaved.current = ''; autoCreated.current = false
    setLink(null); setPick((p) => ({ cohortId: p.cohortId, participantId: '', formNumber: 0 }))
    loadCohorts()
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
    const ready = (file || pasted.trim().length > 20) && pickReady
    const crfForm = mode === 'review' && crfStage === 'form' // an open review takes over the page, like an open observation
    return (
      <Layout active="observation" pageTitle={crfForm ? 'Competency Review Form Mentor Coaching' : 'Session Observation Form Mentor Coaching'}>
        {tour === 'home' && <GuidedTour steps={HOME_TOUR} onClose={closeTour} font={font} />}
        {!tour && !crfForm && <TourHelpButton onClick={startHomeTour} />}
        <div style={crfForm ? { fontFamily: font, padding: '16px 32px 32px' } : { fontFamily: font, maxWidth: 960, margin: '0 auto', padding: 32 }}>
          {!crfForm && (<>
          {cohorts.length > 1 && (
            <div data-tour="home-cohort" style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ ...label, margin: 0, fontSize: 14 }} htmlFor="obs-cohort">Cohort</label>
              <select id="obs-cohort" style={{ ...input, maxWidth: 320 }} value={cohortFilter}
                onChange={(e) => {
                  const id = e.target.value
                  setCohortFilter(id)
                  setViewPersonId('')
                  setPick((p) => (!id || allPeople.some((x) => x.id === p.participantId && x.cohortId === id) ? p : { cohortId: '', participantId: '', formNumber: 0 }))
                }}>
                <option value="">All cohorts</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span style={small}>Your saved forms and participants below show this cohort only.</span>
            </div>
          )}
          {(drafts.length > 0 || reviews.length > 0 || allPeople.length > 0) && (
            <div style={card} data-tour="home-saved">
              <h2 style={h2}>Your Saved Forms</h2>
              {error && <div style={{ color: '#b42318', fontSize: 13, margin: '8px 0' }}>{error}</div>}
              {[
                { key: 'progress', label: 'In progress', rows: savedInProgress, open: true, color: C.orange },
                { key: 'complete', label: 'Completed', rows: savedCompleted, open: false, color: '#7a8a16' },
              ].map((group) => (
                <details key={group.key} open={group.open} style={{ borderTop: `1px solid ${C.border}`, padding: '4px 0' }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 0', fontWeight: 800, color: C.navy, fontSize: 14, listStylePosition: 'inside' }}>
                    {group.label}
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: group.color, borderRadius: 10, padding: '2px 9px' }}>{group.rows.length}</span>
                  </summary>
                  {group.rows.length === 0 && (
                    <div style={{ ...small, padding: '0 0 12px' }}>{group.key === 'progress' ? 'Nothing in progress.' : 'No completed forms yet.'}</div>
                  )}
                  {group.rows.map((d) => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <div style={{ fontWeight: 700, color: C.navy }}>
                          {d.title}
                          {d.kind === 'crf'
                            ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.white, background: C.navy, borderRadius: 6, padding: '2px 8px' }}>CRF</span>
                            : d.form_number ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.navy, background: C.soft, borderRadius: 6, padding: '2px 8px' }}>SOF #{d.form_number}</span> : null}
                        </div>
                        <div style={small}>Last saved {new Date(d.updated_at).toLocaleString()}</div>
                      </div>
                      <button style={{ ...btn(true), padding: '7px 14px' }} onClick={() => (d.kind === 'crf' ? (setMode('review'), setCrfRequest({ id: d.id, n: Date.now() })) : openDraft(d.id))}>Open</button>
                      <button style={{ ...btn(false), padding: '7px 14px' }} onClick={() => (d.kind === 'crf' ? deleteReview(d.id, d.title) : deleteDraft(d.id, d.title))}>Delete</button>
                    </div>
                  ))}
                </details>
              ))}
              {peopleAZ.length > 0 && (
                <details data-tour="home-byparticipant" open={!!viewPerson} style={{ borderTop: `1px solid ${C.border}`, padding: '4px 0' }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 0', fontWeight: 800, color: C.navy, fontSize: 14, listStylePosition: 'inside' }}>
                    By participant
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: C.navy, borderRadius: 10, padding: '2px 9px' }}>{peopleAZ.length}</span>
                  </summary>
                  <div style={{ paddingBottom: 12 }}>
                    <label style={label} htmlFor="obs-by-participant">Choose a participant to see just their reports</label>
                    <select id="obs-by-participant" style={{ ...input, maxWidth: 420 }} value={viewPersonId} onChange={(e) => setViewPersonId(e.target.value)}>
                      <option value="">Choose a participant…</option>
                      {peopleAZ.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{cohorts.length > 1 && !cohortFilter ? ` (${cohorts.find((c) => c.id === p.cohortId)?.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {viewPerson && [1, 2, 3].map((n) => {
                    const mine = drafts.find((d) => d.participant_id === viewPerson.id && d.form_number === n)
                    const elsewhere = !mine && viewPerson.forms.find((f) => f.formNumber === n)
                    const done = mine ? isCompleteDraft(mine) : false
                    return (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <div style={{ fontWeight: 700, color: C.navy }}>
                            SOF #{n} · {viewPerson.name}
                            {mine && (
                              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: done ? '#7a8a16' : C.orange, borderRadius: 6, padding: '2px 8px' }}>
                                {done ? 'Complete' : 'In progress'}
                              </span>
                            )}
                          </div>
                          <div style={small}>
                            {mine ? `Last saved ${new Date(mine.updated_at).toLocaleString()}`
                              : elsewhere ? 'Saved by another mentor coach.'
                              : 'Not started.'}
                          </div>
                        </div>
                        {mine && <button style={{ ...btn(true), padding: '7px 14px' }} onClick={() => openDraft(mine.id)}>Open</button>}
                        {mine && <button style={{ ...btn(false), padding: '7px 14px' }} onClick={() => deleteDraft(mine.id, mine.title)}>Delete</button>}
                        {!mine && !elsewhere && <button style={{ ...btn(false), padding: '7px 14px' }} onClick={() => startFormFor(viewPerson, n)}>Start SOF #{n}</button>}
                      </div>
                    )
                  })}
                  {viewPerson && (() => {
                    const mineReview = reviews.find((r) => r.participant_id === viewPerson.id)
                    const elsewhereReview = !mineReview && viewPerson.review
                    const doneReview = mineReview ? missingReviewItems({ ...emptyReview(), ...(mineReview.review || {}) }).length === 0 : false
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <div style={{ fontWeight: 700, color: C.navy }}>
                            Competency Review Form · {viewPerson.name}
                            {mineReview && (
                              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: doneReview ? '#7a8a16' : C.orange, borderRadius: 6, padding: '2px 8px' }}>
                                {doneReview ? 'Complete' : 'In progress'}
                              </span>
                            )}
                          </div>
                          <div style={small}>
                            {mineReview ? `Last saved ${new Date(mineReview.updated_at).toLocaleString()}`
                              : elsewhereReview ? 'Saved by another mentor coach.'
                              : 'Not started. It is pre-filled from this participant’s Session Observation Forms.'}
                          </div>
                        </div>
                        {!elsewhereReview && (
                          <button style={{ ...btn(!!mineReview), padding: '7px 14px' }} onClick={() => { setMode('review'); setCrfRequest({ participantId: viewPerson.id, n: Date.now() }) }}>
                            {mineReview ? 'Open' : 'Start Competency Review'}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </details>
              )}
            </div>
          )}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} data-testid="form-choice" data-tour="home-choice">
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontWeight: 800, color: C.navy, fontSize: 14 }}>What would you like to create?</div>
            </div>
            <button style={btn(mode === 'sof')} aria-pressed={mode === 'sof'} onClick={() => setMode('sof')}>Session Observation Form</button>
            <button style={btn(mode === 'review')} aria-pressed={mode === 'review'} onClick={() => setMode('review')}>Competency Review Form</button>
          </div>
          </>)}
          <div ref={startCardRef}>
          {mode === 'review' ? (
            <CompetencyReview request={crfRequest} onStageChange={setCrfStage} onChanged={() => { loadDrafts(); loadCohorts() }} />
          ) : (
          <div style={card}>
            <h2 style={h2}>Start a Session Observation Form</h2>
            <p style={small}>
              Add the participant&rsquo;s coaching session as a transcript. The tool finds evidence for each ICF behavior
              and highlights it in the transcript. You edit the evidence, choose every rating, and save the completed ICF form.
            </p>
            <div style={{ height: 14 }} />

            {cohorts.length > 0 && (
              <div data-tour="home-who" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 18, background: C.soft }}>
                <div style={{ fontWeight: 800, color: C.navy, fontSize: 14, marginBottom: 12 }}>Who is this observation for?{pickRequired ? ' *' : ''}</div>
                <div>
                  <label style={label} htmlFor="obs-participant">Participant{shownCohorts.length === 1 ? ` (${shownCohorts[0].name})` : ''}</label>
                  <select id="obs-participant" style={{ ...input, maxWidth: 420 }} value={pick.participantId}
                    onChange={(e) => {
                      const person = allPeople.find((x) => x.id === e.target.value)
                      setPick({ cohortId: person?.cohortId || '', participantId: e.target.value, formNumber: 0 })
                    }}>
                    <option value="">{isAdmin ? 'Not for a cohort participant' : 'Choose a participant…'}</option>
                    {shownCohorts.length === 1
                      ? shownCohorts[0].participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                      : shownCohorts.map((c) => (
                        <optgroup key={c.id} label={c.name}>
                          {c.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                      ))}
                  </select>
                </div>
                {shownCohorts.length > 0 && shownCohorts.every((c) => c.participants.length === 0) && (
                  <div style={{ ...small, marginTop: 8 }}>No participants are assigned to you yet. Ask an admin to assign participants to you in Users / Access Codes &gt; Cohorts.</div>
                )}
                {pickPerson && (
                  <div style={{ marginTop: 14 }}>
                    <div style={label}>Session Observation Form</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {[1, 2, 3].map((n) => {
                        const existing = pickPerson.forms.find((f) => f.formNumber === n)
                        const chosen = pick.formNumber === n
                        return (
                          <button key={n} type="button" onClick={() => setPick((p) => ({ ...p, formNumber: n }))} aria-pressed={chosen}
                            style={{
                              fontFamily: font, fontWeight: 800, fontSize: 14, padding: '10px 22px', borderRadius: 10, cursor: 'pointer', minWidth: 150, textAlign: 'center',
                              border: `2px solid ${chosen ? (existing ? C.orange : C.navy) : C.border}`, background: chosen ? (existing ? '#fff7ed' : C.navy) : C.white,
                              color: chosen ? (existing ? '#9a3412' : C.white) : C.navy,
                            }}>
                            SOF #{n}
                            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginTop: 2, color: chosen && !existing ? '#dbe4f5' : C.muted }}>
                              {existing ? 'Already saved' : 'Not started'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {pickTaken && (
                      <div role="alert" style={{ marginTop: 12, border: `1px solid ${C.orange}`, background: '#fff7ed', color: '#9a3412', borderRadius: 10, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
                        <strong>SOF #{pick.formNumber} for {pickPerson.name} has already been saved</strong>
                        {pickTaken.mine ? ' by you.' : ' by another mentor coach.'} A participant can have only one of each form, so you cannot start another SOF #{pick.formNumber}.
                        {pickTaken.mine
                          ? ' Open the saved one to keep working on it, or choose a different form number.'
                          : ' Choose a different form number, or ask an admin if this one needs to be redone.'}
                        {pickTaken.mine && (
                          <div style={{ marginTop: 8 }}>
                            <button style={{ ...btn(false), padding: '6px 12px', fontSize: 12 }} onClick={() => openDraft(pickTaken.id)}>Open saved SOF #{pick.formNumber}</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontWeight: 800, color: C.navy, fontSize: 14, marginBottom: 8 }}>Transcript</div>
            <div
              data-tour="home-transcript"
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
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: 14, margin: '22px 0 6px' }}>Recording</div>
                    <div style={{ ...small, margin: '0 0 6px' }}>
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
            <div style={{ marginTop: 16 }} data-tour="home-continue">
              <button style={btn(true, !ready)} disabled={!ready} onClick={loadTranscript}>Continue</button>
              {!pickReady && (
                <span style={{ ...small, marginLeft: 12 }}>
                  {pickTaken ? `SOF #${pick.formNumber} is already saved. Choose a different form to continue.` : pickPerson ? 'Choose SOF #1, #2, or #3 to continue.' : 'Choose a participant and form to continue.'}
                </span>
              )}
            </div>
          </div>
          )}
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
      {tour === 'form' && <GuidedTour steps={FORM_TOUR} onClose={closeTour} font={font} />}
      {!tour && <TourHelpButton onClick={() => setTour('form')} />}
      <div style={{ fontFamily: font, maxWidth: 1400, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <label style={label} htmlFor="obs-title">Name of this observation</label>
        {autoName ? (
          <>
            <input id="obs-title" readOnly style={{ ...input, fontSize: 16, fontWeight: 700, color: C.navy, maxWidth: 640, background: C.soft }} value={autoName} />
            <div style={{ ...small, marginTop: 4 }}>Named automatically from the participant and form number. Complete or Incomplete updates as you fill in the form.</div>
          </>
        ) : (
          <input id="obs-title" style={{ ...input, fontSize: 16, fontWeight: 700, color: C.navy, maxWidth: 560 }} value={form.title || ''}
            onChange={(e) => set({ title: e.target.value })} placeholder="For example: Jordan R. – Session 2" maxLength={120} />
        )}
      </div>
      {(cohorts.length > 0 || link) && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14, background: C.soft }}>
          <div style={{ fontWeight: 800, color: C.navy, fontSize: 14, marginBottom: 2 }}>Participant and form</div>
          <div style={{ ...small, marginBottom: 10 }}>
            {link ? 'Change who this observation is for, or which form number it is.' : 'This observation is not linked to a participant yet. Choose one to link it.'}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 240 }}>
              <label style={label} htmlFor="relink-participant">Participant</label>
              <select id="relink-participant" style={input} value={relink.participantId}
                onChange={(e) => setRelink({ participantId: e.target.value, formNumber: e.target.value === link?.participantId ? link.formNumber : 0 })}>
                <option value="">{isAdmin ? 'Not linked to a participant' : 'Choose a participant…'}</option>
                {link && !allPeople.some((p) => p.id === link.participantId) && <option value={link.participantId}>{link.participantName}</option>}
                {cohorts.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {c.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {relink.participantId && (
              <div>
                <div style={label}>Form</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map((n) => {
                    const chosen = relink.formNumber === n
                    const taken = relinkTaken(n)
                    return (
                      <button key={n} type="button" aria-pressed={chosen} onClick={() => setRelink((r) => ({ ...r, formNumber: n }))}
                        style={{
                          fontFamily: font, fontWeight: 800, fontSize: 13, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: `2px solid ${chosen ? (taken ? C.orange : C.navy) : C.border}`, background: chosen ? (taken ? '#fff7ed' : C.navy) : C.white,
                          color: chosen ? (taken ? '#9a3412' : C.white) : C.navy,
                        }}>
                        SOF #{n}
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: chosen && !taken ? '#dbe4f5' : C.muted }}>{taken ? 'Already saved' : link && link.participantId === relink.participantId && link.formNumber === n ? 'Current' : 'Available'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <button style={btn(true, !relinkChanged || !relinkValid || relinking)} disabled={!relinkChanged || !relinkValid || relinking} onClick={applyRelink}>
              {relinking ? 'Updating…' : 'Update participant and form'}
            </button>
          </div>
          {relink.participantId && relink.formNumber > 0 && relinkTaken(relink.formNumber) && (
            <div role="alert" style={{ marginTop: 10, border: `1px solid ${C.orange}`, background: '#fff7ed', color: '#9a3412', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
              <strong>SOF #{relink.formNumber} for {relinkPerson?.name} has already been saved.</strong> A participant can have only one of each form. Choose a different form number.
            </div>
          )}
        </div>
      )}
      <div data-tour="form-toolbar" style={{ position: 'sticky', top: 0, zIndex: 30, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,32,91,0.08)' }}>
        <button style={btn(false, savingDraft)} disabled={savingDraft} onClick={goBack}>&larr; Back to my observations</button>
        <button style={btn(true, savingDraft)} disabled={savingDraft} onClick={() => saveDraft(false)}>{savingDraft ? 'Saving…' : 'Save progress'}</button>
        <button style={btn(false, saving)} disabled={saving} onClick={save}>{saving ? 'Building form…' : 'Download form (.docx)'}</button>
        <button style={btn(false, exporting)} disabled={exporting} onClick={downloadAnnotated}>{exporting ? 'Making PDF…' : 'Download annotated transcript (PDF)'}</button>
        <span style={{ fontSize: 12, color: dirty ? C.orange : C.gray, fontWeight: 600 }}>
          {savingDraft ? 'Saving…' : dirty ? (draftId ? 'Unsaved changes (saves itself every 30 seconds)' : 'Saving soon…') : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </span>
        {notice && <span style={{ fontSize: 12, color: C.navy, fontWeight: 600, flexBasis: '100%' }}>{notice}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 5fr) minmax(380px, 7fr) 64px', gap: 14, alignItems: 'start' }}>

        {/* Transcript */}
        <div data-tour="form-transcript" style={{ ...card, padding: 0, position: 'sticky', top: 74, maxHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
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
            {turns.map((t, ti) => {
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
                  <button data-tour={ti === 0 ? 'form-add-turn' : undefined} title={on ? `Remove from ${active}` : `Add to ${active}`} onClick={() => toggleTurn(t)}
                    style={{ border: `1px solid ${on ? C.sky : C.border}`, background: on ? C.sky : C.white, color: C.navy, width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontFamily: font, alignSelf: 'flex-start' }}>
                    {on ? '✓' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side bar on the right: jump to a competency (short labels; the full name shows on hover) */}
        <nav data-tour="form-jump" aria-label="Jump to a competency" style={{ gridColumn: 3, gridRow: 1, position: 'sticky', top: 74, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '6px 0 8px', textAlign: 'center' }}>Jump</div>
          {[
            { id: 'sec-info', label: 'Info', full: 'Form details', sub: '' },
            { id: 'sec-c1', label: '1', full: 'Competency 1 · Ethical Practice', sub: `${[form.q.q1, form.q.q2].filter(Boolean).length}/2` },
            ...COMPETENCIES.map((c) => {
              const mine = BEHAVIORS.filter((b) => b.comp === c.n)
              return { id: `sec-c${c.n}`, label: `${c.n}`, full: `Competency ${c.n} · ${SHORT[c.n]}`, sub: `${mine.filter((b) => form.ratings[b.id]).length}/${mine.length}`, first: mine[0]?.id }
            }),
            { id: 'sec-sign', label: 'Sign', full: 'Signature & save', sub: '' },
          ].map((it) => {
            const on = navActive === it.id
            return (
              <button key={it.id} type="button" title={it.sub ? `${it.full} (${it.sub} done)` : it.full} aria-label={it.sub ? `${it.full}, ${it.sub}` : it.full} aria-current={on ? 'true' : undefined}
                onClick={() => {
                  setNavActive(it.id)
                  navLockUntil.current = Date.now() + 1200
                  if (it.first) setActive(it.first)
                  document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{ display: 'block', width: '100%', textAlign: 'center', fontFamily: font, cursor: 'pointer', border: 'none', borderRight: `4px solid ${on ? C.sky : 'transparent'}`, background: on ? '#eef6ff' : 'transparent', borderRadius: 6, padding: '8px 2px', marginBottom: 2, color: C.navy }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{it.label}</span>
                {it.sub && <span style={{ display: 'block', fontSize: 11, color: C.gray, marginTop: 1 }}>{it.sub}</span>}
              </button>
            )
          })}
        </nav>

        {/* Form */}
        <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>
          <div style={{ ...card, background: C.navy, color: C.white, border: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>ICF Mentor Coaching Session Observation Form &ndash; ACC</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              Evidence below comes from the transcript. Edit it freely. The AI offers suggestions only: you choose every rating and every box.
            </div>
          </div>

          <div id="sec-info" style={{ ...card, scrollMarginTop: 100 }}>
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

          <div id="sec-c1" style={{ ...card, scrollMarginTop: 100 }}>
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
                  {s?.suggested && (
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
            <div key={c.n} id={`sec-c${c.n}`} style={{ ...card, scrollMarginTop: 100 }}>
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
                    {s?.suggested && (
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
              {(() => {
                const i = COMPETENCIES.findIndex((x) => x.n === c.n)
                return (
                  <div style={{ marginTop: 18, borderTop: `2px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: 14 }}>Observation feedback for Competency {c.n}</div>
                    <p style={{ ...small, margin: '4px 0 0' }}>
                      Support each with evidence (timestamps, quotes) and written feedback. Across all competencies the form needs at least 2 areas of strength and 2 areas for development.
                    </p>
                    {[['Areas of Strength', 'strengths'], ['Areas for Development', 'development']].map(([title, key]) => {
                      const row = form[key][i]
                      const upd = (patch) => set({ [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) })
                      return (
                        <div key={key} style={{ marginTop: 12, background: C.soft, borderRadius: 10, padding: 12 }}>
                          <div style={{ fontWeight: 800, color: C.navy, fontSize: 13, marginBottom: 6 }}>{title}</div>
                          {field('Statement for Feedback', row.statement, (v) => upd({ statement: v }))}
                          <label style={{ ...label, marginTop: 8 }}>Feedback Comments</label>
                          <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={row.comments} onChange={(e) => upd({ comments: e.target.value })} />
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ))}

          <div id="sec-sign" style={{ ...card, scrollMarginTop: 100 }}>
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

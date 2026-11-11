// Downloads for a Session Observation Form record. Used by the form itself and by the read-only admin viewer.
import { BEHAVIORS, RATINGS } from './formSpec'
import { stamp } from './transcript'
import { buildAnnotatedTranscriptPdf } from './annotatedTranscriptPdf'
import { ensurePdfLibs, urlToDataUrl } from '../pdfLibs'
import logoWhite from '../../CoachRICE_White.png'

const TEMPLATE_URL = '/templates/icf-session-observation-form-acc.docx'
const roleName = (r) => (r === 'coach' ? 'Coach' : r === 'client' ? 'Client' : 'Other')
const colorOf = (role) => (role === 'coach' ? [0, 32, 91] : role === 'client' ? [46, 117, 182] : [124, 126, 127])
const safe = (s) => String(s || '').replace(/[^\w\- ]+/g, '').trim()

// The name of a record: the typed name, else client name + session, else "Untitled observation".
export function observationTitle(form) {
  const a = form?.admin || {}
  if ((form?.title || '').trim()) return form.title.trim()
  return [(a.clientName || '').trim() || 'Untitled observation', (a.clientSession || '').trim()].filter(Boolean).join(' – ')
}

/** Transcript PDF with the selected evidence highlighted. */
export async function downloadAnnotatedTranscript({ form, turns, roles }) {
  await ensurePdfLibs()
  let logoDataUrl = null
  try { logoDataUrl = await urlToDataUrl(logoWhite) } catch { /* the PDF still works without the logo */ }
  const marks = {}, loose = {}, timesByCode = {}
  const turnById = Object.fromEntries(turns.map((t) => [t.id, t]))
  BEHAVIORS.forEach((b) => (form.evidence?.[b.id] || []).forEach((e) => {
    const t = turnById[e.turn]
    if (!t) return
    const at = e.quote ? t.text.indexOf(e.quote) : -1
    if (at >= 0) (marks[t.id] = marks[t.id] || []).push({ start: at, end: at + e.quote.length, codes: [b.id] })
    else (loose[t.id] = loose[t.id] || new Set()).add(b.id)
    ;(timesByCode[b.id] = timesByCode[b.id] || new Map()).set(t.id, t.time || `Turn ${t.id}`)
  }))
  const last = [...turns].reverse().find((t) => typeof t.start === 'number')
  const title = observationTitle(form)
  const doc = buildAnnotatedTranscriptPdf({
    title,
    dateText: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    durationText: last ? stamp(last.start) : '',
    logoDataUrl,
    turns: turns.map((t, i) => ({
      time: t.time, speaker: roleName(roles?.[t.speaker]), color: colorOf(roles?.[t.speaker]), text: t.text,
      pauseText: i > 0 && t.pauseBefore >= 3 ? `pause ${Math.round(t.pauseBefore)} sec` : '',
      marks: marks[t.id] || [], looseCodes: [...(loose[t.id] || [])],
    })),
    index: BEHAVIORS.map((b) => ({
      code: b.id, behavior: b.text, rating: RATINGS.find((r) => r.id === form.ratings?.[b.id])?.label || '',
      times: [...(timesByCode[b.id]?.entries() || [])].sort((a, c) => a[0] - c[0]).map(([, label]) => label).join(', '),
    })),
  })
  doc.save(`${safe(title) || 'observation'} - annotated transcript.pdf`)
}

/** The original ICF Word form, filled in. */
export async function downloadFilledForm(form) {
  const [{ fillObservationForm }, tpl] = await Promise.all([import('./fillDocx'), fetch(TEMPLATE_URL)])
  if (!tpl.ok) throw new Error('Could not load the ICF form template.')
  const blob = await fillObservationForm(form, await tpl.arrayBuffer())
  const name = ['Session Observation Form', safe(form.admin?.clientName), safe(form.admin?.clientSession)].filter(Boolean).join(' - ')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

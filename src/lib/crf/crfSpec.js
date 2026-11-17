// The ICF Mentor Coaching Competency Review Form (ACC) as data, plus the rule that
// pre-fills "Proficiency Demonstrated" from the Session Observation Forms.
import { BEHAVIORS, COMPETENCIES, LEVELS } from '../sof/formSpec'

export { BEHAVIORS, COMPETENCIES, LEVELS }

export const SELF_REVIEW = [
  'I hold an active ICF Mentor Coach Specialization (MCS) – ACC Level.',
  'I am not related to or have a known conflict of interest with the mentor coaching client.',
  'I have read, understand, and agree to follow the mentor coaching expectations as listed above.',
]

// How many statements must be demonstrated in each competency (two-thirds, as printed on ICF's form).
export const NEEDED = { 3: 3, 4: 2, 5: 3, 6: 2, 7: 2, 8: 2 }
export const SESSION_ROWS = 5

// Ratings in a Session Observation Form that count as "Proficiency Demonstrated".
const DEMONSTRATED = ['exceeds', 'meets']

export function emptyReview() {
  return {
    admin: { name: '', email: '', clientName: '', clientEmail: '', feedbackDate: '' },
    level: 'ACC',
    individualHours: '',
    groupHours: '',
    observedSessions: '',
    selfReview: [false, false, false],
    c1: null, // 'yes' | 'no'
    c1Notes: '',
    statements: {}, // behaviorId -> 'demonstrated' | 'not_yet'
    competencyMet: {}, // competency number -> 'yes' | 'no' (follows the statements until the coach changes it)
    sessions: Array.from({ length: SESSION_ROWS }, () => ({ date: '', modality: '', duration: '' })),
    strengths: COMPETENCIES.map((c) => ({ comp: c.n, statement: '', comments: '' })),
    development: COMPETENCIES.map((c) => ({ comp: c.n, statement: '', comments: '' })),
    overall: null, // 'demonstrated' | 'not_yet'
    reviewed: false,
    printedName: '',
    signature: '',
    dateSigned: '',
    prefilledFrom: [], // SOF form numbers the statements were pre-filled from
  }
}

export const totalHours = (r) => {
  const a = parseFloat(r.individualHours), b = parseFloat(r.groupHours)
  if (Number.isNaN(a) && Number.isNaN(b)) return ''
  const t = (Number.isNaN(a) ? 0 : a) + (Number.isNaN(b) ? 0 : b)
  return String(Math.round(t * 100) / 100)
}

export const demonstratedCount = (r, comp) =>
  BEHAVIORS.filter((b) => b.comp === comp && r.statements[b.id] === 'demonstrated').length

// What the "at least N statements" question should say, from the statements marked so far.
// Returns null until every statement of that competency has an answer.
export function suggestedMet(r, comp) {
  const items = BEHAVIORS.filter((b) => b.comp === comp)
  if (items.some((b) => !r.statements[b.id])) return null
  return demonstratedCount(r, comp) >= NEEDED[comp] ? 'yes' : 'no'
}

// Keeps each competency's Yes/No in step with its statements. Used when statements change.
export function withSuggestedMet(r, comp) {
  return { ...r, competencyMet: { ...r.competencyMet, [comp]: suggestedMet(r, comp) } }
}

/**
 * Pre-fills a review from the participant's Session Observation Forms.
 * sofs: [{ formNumber, form }] where form is a saved Session Observation Form (formSpec.emptyForm shape).
 * A statement is "demonstrated" if ANY of the forms rated it Exceeds or Meets. It is "not yet" if at least one
 * form rated it and none reached Meets. With no rating in any form, it stays blank for the coach.
 */
export function prefillFromObservations(base, sofs) {
  const r = { ...base, statements: { ...base.statements }, competencyMet: { ...base.competencyMet } }
  const forms = (sofs || []).filter((s) => s && s.form)
  BEHAVIORS.forEach((b) => {
    const given = forms.map((s) => s.form.ratings?.[b.id]).filter(Boolean)
    if (!given.length) return
    r.statements[b.id] = given.some((x) => DEMONSTRATED.includes(x)) ? 'demonstrated' : 'not_yet'
  })
  COMPETENCIES.forEach((c) => { r.competencyMet[c.n] = suggestedMet(r, c.n) })
  // Competency 1: yes only when every form that answered both qualifiers marked both Observed.
  const q = forms.map((s) => s.form.q).filter((x) => x && (x.q1 || x.q2))
  if (q.length) {
    const any = q.some((x) => x.q1 === 'not_observed' || x.q2 === 'not_observed')
    const all = q.every((x) => x.q1 === 'observed' && x.q2 === 'observed')
    r.c1 = any ? 'no' : all ? 'yes' : r.c1
  }
  // Session log: one row per form, in order, with the date of the client's session.
  const ordered = [...forms].sort((a, b) => a.formNumber - b.formNumber)
  ordered.slice(0, SESSION_ROWS).forEach((s, i) => {
    r.sessions = r.sessions.map((row, k) => (k === i && !row.date ? { ...row, date: s.form.admin?.clientSession || '' } : row))
  })
  if (ordered.length && !String(r.observedSessions).trim()) r.observedSessions = String(ordered.length)
  const lvl = ordered.find((s) => s.form.level)?.form.level
  if (lvl) r.level = lvl
  r.prefilledFrom = ordered.map((s) => s.formNumber)
  return r
}

export function missingReviewItems(r) {
  const out = []
  const a = r.admin
  if (!a.name.trim()) out.push('Mentor coach name')
  if (!a.email.trim()) out.push('Mentor coach email')
  if (!a.clientName.trim()) out.push('Client name')
  if (!a.clientEmail.trim()) out.push('Client email')
  if (!a.feedbackDate.trim()) out.push('Date of the feedback session')
  if (!r.level) out.push('Level of mentor coaching')
  if (!String(r.individualHours).trim() && !String(r.groupHours).trim()) out.push('Hours with the client')
  if (!String(r.observedSessions).trim()) out.push('Number of observed sessions reviewed')
  if (r.selfReview.some((b) => !b)) out.push('Self-review checklist (all three boxes)')
  if (!r.c1) out.push('Competency 1 verification')
  const open = BEHAVIORS.filter((b) => !r.statements[b.id])
  if (open.length) out.push(`Proficiency for ${open.map((b) => b.id).join(', ')}`)
  const noMet = COMPETENCIES.filter((c) => !r.competencyMet[c.n])
  if (noMet.length) out.push(`Yes/No question for Competency ${noMet.map((c) => c.n).join(', ')}`)
  const filled = (list) => list.filter((x) => x.statement.trim() || x.comments.trim()).length
  if (filled(r.strengths) < 2) out.push('At least 2 areas of strength')
  if (filled(r.development) < 2) out.push('At least 2 areas for development')
  if (!r.overall) out.push('Overall proficiency statement')
  if (!r.reviewed) out.push('Feedback review confirmation')
  if (!r.printedName.trim()) out.push('Printed name')
  if (!r.signature.trim()) out.push('Signature')
  if (!r.dateSigned.trim()) out.push('Date signed')
  return out
}

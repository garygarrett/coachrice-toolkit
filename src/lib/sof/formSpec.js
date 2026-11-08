// The ICF Session Observation Form (ACC) as data: every behavior, rating, and
// question the on-screen form asks. The Word template is filled from this.

export const RATINGS = [
  { id: 'exceeds', label: 'Exceeds Standard', hint: 'Exemplary demonstration' },
  { id: 'meets', label: 'Meets Standard', hint: 'Proficient demonstration' },
  { id: 'below', label: 'Below Standard', hint: 'Partial demonstration' },
  { id: 'does_not_meet', label: 'Does Not Meet Standard', hint: 'Not demonstrated' },
  { id: 'na', label: 'N/A', hint: 'No opportunity or not relevant (rare)' },
]

export const LEVELS = ['ACC', 'PCC', 'MCC']

export const SELF_REVIEW = [
  'I hold an active ICF Mentor Coach Specialization (MCS) - ACC.',
  'I am not related to or have a known conflict of interest with the mentor coaching client.',
  'I have read, understand, and agree to follow the mentor coaching expectations as listed above.',
]

export const QUALIFIERS = [
  { id: 'q1', text: 'Q1. Coach demonstrates alignment with the ICF Code of Ethics.' },
  { id: 'q2', text: 'Q2. Coach is in consistent alignment with the role of a coach.' },
]

export const COMPETENCIES = [
  { n: 3, name: 'Establishes and Maintains Agreements', definition: 'Partners with the client and relevant stakeholders to create clear agreements about the coaching relationship, process, plans, and goals. Establishes agreements for the overall coaching engagement as well as those for each coaching session.' },
  { n: 4, name: 'Cultivates Trust and Safety', definition: 'Partners with the client to create a safe, supportive environment that allows the client to share freely. Maintains a relationship of mutual respect and trust.' },
  { n: 5, name: 'Maintains Presence', definition: 'Is fully conscious and present with the client, employing a style that is open, flexible, grounded, and confident.' },
  { n: 6, name: 'Listens Actively', definition: 'Focuses on what the client is and is not saying to fully understand what is being communicated in the context of the client systems and to support client self-expression.' },
  { n: 7, name: 'Evokes Awareness', definition: 'Facilitates client insight and learning by using tools and techniques such as powerful questioning, silence, metaphor, or analogy.' },
  { n: 8, name: 'Facilitates Client Growth', definition: 'Partners with the client to transform learning and insight into action. Promotes client autonomy in the coaching process.' },
]

// Document order matters: it matches the rating groups in the Word template.
export const BEHAVIORS = [
  { id: 'A3.1', comp: 3, text: "Coach explores the client's topic with the client" },
  { id: 'A3.2', comp: 3, text: 'Coach and client reach agreement on what the client wants to accomplish as a session outcome.' },
  { id: 'A3.3', comp: 3, text: 'Coach explores the significance of the coaching outcome to the client.' },
  { id: 'A3.4', comp: 3, text: 'Coach attends to the agreed upon agenda throughout the session.' },
  { id: 'A4.1', comp: 4, text: "Coach acknowledges the client's work in the session." },
  { id: 'A4.2', comp: 4, text: 'Coach expresses respect, support, or concern for the client.' },
  { id: 'A4.3', comp: 4, text: 'Coach supports the client’s expression of feelings, perceptions, concerns, or beliefs.' },
  { id: 'A5.1', comp: 5, text: 'Coach is observant and responsive to the client.' },
  { id: 'A5.2', comp: 5, text: 'Coach demonstrates curiosity about the client, or their agenda, or both.' },
  { id: 'A5.3', comp: 5, text: 'Coach provides space for the client to lead during the session.' },
  { id: 'A5.4', comp: 5, text: 'Coach is silent to allow time for the client to reflect.' },
  { id: 'A6.1', comp: 6, text: 'Coach listens by recognizing feelings, perceptions, challenges, or beliefs.' },
  { id: 'A6.2', comp: 6, text: 'Coach inquires about, explores, or includes the client’s use of language.' },
  { id: 'A6.3', comp: 6, text: 'Coach summarizes or paraphrases what the client communicates to confirm the coach’s understanding.' },
  { id: 'A7.1', comp: 7, text: 'Coach supports the client in viewing the situation from different perspectives.' },
  { id: 'A7.2', comp: 7, text: 'Coach inquires about the client’s feelings, perceptions, behaviors, or beliefs.' },
  { id: 'A7.3', comp: 7, text: 'Coach asks clear, open-ended questions, one at a time.' },
  { id: 'A8.1', comp: 8, text: 'Coach asks questions about what the client has learned during the session.' },
  { id: 'A8.2', comp: 8, text: 'Coach supports the client to use their learning to plan next steps.' },
  { id: 'A8.3', comp: 8, text: 'Coach supports the client to close the session.' },
]

export const ATTESTATIONS = [
  'I have observed my client’s coaching session and provided a full, accurate, documented evaluation of their demonstrated coaching skills in this session, based on the ICF Minimum Skills Requirements for the specific credential level.',
  'I have reviewed the completed Client Session Observation form in real time with my mentor coaching client, and have discussed their skill demonstration in this session, areas of strength and opportunities for continued development.',
  'I have reviewed and discussed with my mentor coaching client their self-reflections completed prior to this session and after receiving my feedback from this session.',
  'In signing this form, I grant permission to my mentor coaching client to share this completed form with the ICF, if required for credentialing or credential renewal purposes.',
]

// A fresh, empty form.
export function emptyForm() {
  return {
    title: '', // the name shown in the saved list and on the exported PDF
    admin: { name: '', email: '', clientName: '', clientEmail: '', clientSession: '', mentorSession: '' },
    level: null,
    selfReview: [false, false, false],
    q: { q1: null, q2: null }, // 'observed' | 'not_observed'
    qComments: '',
    ratings: {}, // behaviorId -> rating id
    evidence: {}, // behaviorId -> [{ id, turn, text }]
    evidenceNotes: {}, // behaviorId -> extra typed notes
    strengths: COMPETENCIES.map((c) => ({ comp: c.n, statement: '', comments: '' })),
    development: COMPETENCIES.map((c) => ({ comp: c.n, statement: '', comments: '' })),
    noTimestamps: false, // true when the transcript has no timestamps
    attested: false,
    printedName: '',
    signature: '',
    dateSigned: '',
  }
}

// What is still missing for a complete form (the form can be saved anyway).
export function missingItems(f) {
  const out = []
  const a = f.admin
  if (!a.name.trim()) out.push('Mentor coach name')
  if (!a.email.trim()) out.push('Mentor coach email')
  if (!a.clientName.trim()) out.push('Client name')
  if (!a.clientEmail.trim()) out.push('Client email')
  if (!a.clientSession.trim()) out.push('Date or ID of the client’s session')
  if (!a.mentorSession.trim()) out.push('Date of the mentor coaching session')
  if (!f.level) out.push('Level of the mentor coaching provider')
  if (f.selfReview.some((b) => !b)) out.push('Self-review checklist (all three boxes)')
  if (!f.q.q1) out.push('Qualifier Q1')
  if (!f.q.q2) out.push('Qualifier Q2')
  if ((f.q.q1 === 'not_observed' || f.q.q2 === 'not_observed') && !f.qComments.trim()) {
    out.push('Competency 1 comments (required when a qualifier is Not Observed)')
  }
  const unrated = BEHAVIORS.filter((b) => !f.ratings[b.id])
  if (unrated.length) out.push(`Ratings for ${unrated.map((b) => b.id).join(', ')}`)
  const noEvidence = BEHAVIORS.filter((b) => f.ratings[b.id] && !evidenceText(f, b.id).trim())
  if (noEvidence.length) out.push(`Evidence for ${noEvidence.map((b) => b.id).join(', ')}`)
  const filled = (list) => list.filter((x) => x.statement.trim() || x.comments.trim()).length
  if (filled(f.strengths) < 2) out.push('At least 2 areas of strength')
  if (filled(f.development) < 2) out.push('At least 2 areas for development')
  if (!f.attested) out.push('Signature attestation')
  if (!f.printedName.trim()) out.push('Printed name')
  if (!f.signature.trim()) out.push('Signature')
  if (!f.dateSigned.trim()) out.push('Date signed')
  return out
}

// The evidence text that goes under a behavior: each evidence item, then notes.
export function evidenceText(f, id) {
  const items = (f.evidence[id] || []).map((e) => e.text.trim()).filter(Boolean)
  const note = (f.evidenceNotes[id] || '').trim()
  const lines = [...items, ...(note ? [note] : [])]
  if (f.noTimestamps && lines.length) lines.push('No timestamps were recorded in the session.')
  return lines.join('\n')
}

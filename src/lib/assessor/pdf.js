import { generateACCObservationReportPDF, SECTIONS } from '../accObservationReport'
import { VERSIONS, PASS_THRESHOLD } from './versions'

// "A3.1" / "3.1" -> "a3_1" (a safe id for the PDF generator)
const idFor = (code) => 'r_' + String(code).toLowerCase().replace(/\./g, '_')

function evidenceText(statement) {
  return (statement.evidence || [])
    .filter((e) => e && (e.timestamp || e.quote))
    .map((e) => `${e.timestamp ? e.timestamp + ': ' : ''}"${e.quote || ''}"`)
    .join('\n')
}

/**
 * Builds the assessment PDF in the same layout as the Transcript Reviewer's
 * ACC Observation Form, with each statement's rating (instead of
 * Observed / Not Observed) in the right-hand column.
 *
 * Returns the jsPDF document. Call .save('name.pdf') on it.
 * Needs window.jspdf and the jsPDF AutoTable plugin to be loaded.
 */
export function buildAssessorPdf({ versionId, evaluation, sourceName }) {
  const version = VERSIONS[versionId]
  const ev = evaluation || {}
  const ep = ev.ethical_practice || {}
  const sc = ev.score_calculation || {}
  const byCode = new Map((ev.behavioral_statements || []).map((s) => [s.code, s]))

  const observed = {}
  const evidenceNotes = {}
  const contraEvidenceNotes = {}
  const statementNotes = {}
  const sectionNotes = {}

  // Competency 1: the two qualifiers stay Observed / Not Observed (they decide pass or fail)
  observed.q1 = ep.icf_code_alignment || ''
  observed.q2 = ep.coach_role_alignment || ''
  observed.q3 = ep.coaching_skills_alignment || ''
  // Supporting evidence (timestamp + quote) and contra-evidence (the note) for each qualifier
  ;[['q1', 'icf_code_alignment'], ['q2', 'coach_role_alignment'], ['q3', 'coaching_skills_alignment']].forEach(([id, key]) => {
    const evText = evidenceText({ evidence: ep[`${key}_evidence`] })
    if (evText) evidenceNotes[id] = evText
    if (ep[`${key}_note`]) contraEvidenceNotes[id] = ep[`${key}_note`]
  })

  const sections = SECTIONS.map((section) => {
    const n = parseInt(section.number, 10)
    if (n === 1) {
      return {
        ...section,
        ratingHead: 'Observed/Not Observed',
        items: [
          { id: 'q1', text: '1. Coach demonstrates alignment with the ICF Code of Ethics.' },
          { id: 'q2', text: '2. Coach demonstrates consistent alignment with the role of “coach.”' },
          // The 2025 rubric has a third qualifier
          ...(version.qualifiers.length === 3
            ? [{ id: 'q3', text: '3. Coach uses key coaching skills such as trust, presence, active listening, and evoking awareness to facilitate the client’s own insights.' }]
            : []),
        ],
      }
    }
    if (n < 3) return section

    const items = version.statements
      .filter((s) => parseInt(s.code.replace(/^\D+/, ''), 10) === n)
      .map((s) => {
        const id = idFor(s.code)
        const found = byCode.get(s.code)
        observed[id] = found?.rating || ''
        if (found) {
          const evText = evidenceText(found)
          if (evText) evidenceNotes[id] = evText
          if (found.contra_evidence) contraEvidenceNotes[id] = found.contra_evidence
        }
        return { id, text: `${s.code} ${s.title}` }
      })

    const avg = sc[`competency_${n}_average`]
    if (typeof avg === 'number') sectionNotes[section.id] = `Average ${avg.toFixed(2)}`
    return { ...section, items, ratingHead: 'Rating' }
  })

  const summaryStrengths = (ev.strengths || [])
    .map((s, i) => `${i + 1}. ${s.competency_name || ''} (${s.code || ''}): ${s.explanation || ''}`)
    .join('\n\n')

  const summarySuggestions = (ev.suggestions || [])
    .map((s, i) => {
      let t = `${i + 1}. ${s.competency_name || ''} (${s.code || ''}): ${s.missed_opportunity || ''}`
      if (s.example_prompts && s.example_prompts.length) {
        t += '\nExample prompts: ' + s.example_prompts.map((p) => `"${p}"`).join(' / ')
      }
      return t
    })
    .join('\n\n')

  const extraSummaryRows = []
  if (ev.ethical_concerns && String(ev.ethical_concerns).trim().toLowerCase() !== 'none') {
    extraSummaryRows.push(['Ethical Concerns', String(ev.ethical_concerns)])
  }
  if (Array.isArray(ev.divergence_flags) && ev.divergence_flags.length) {
    extraSummaryRows.push([
      'Calibration Notes',
      ev.divergence_flags
        .map((d) => `${d.code}: rated ${d.ai_rating}; a human assessor might rate ${d.likely_human_rating}. ${d.reason || ''}`)
        .join('\n\n'),
    ])
  }

  const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  const fmt = (x) => (typeof x === 'number' ? x.toFixed(2) : '-')

  return generateACCObservationReportPDF({
    coachName: ev.coach_identifier || sourceName || 'Submitted Coach',
    assessorName: `Assessor (${version.id} version)`,
    sessionDate: dateStr,
    formTitle: 'ACC Performance Evaluation',
    sections,
    ratingHead: 'Rating',
    sectionNotes,
    scoreSummary: {
      finalScore: fmt(sc.final_score),
      result: sc.result === 'Pass' ? 'PASS' : 'BELOW PASSING STANDARD',
      rawScore: fmt(sc.raw_score),
      rubric: `${version.id} version: ${version.label}`,
      // The PDF font has no minus or multiplication sign, so spell the formula with plain characters
      note: `${version.formula.replace('−', '-').replace('×', 'x')}. Pass threshold ${PASS_THRESHOLD.toFixed(2)}, and ${version.qualifiers.length === 3 ? 'all three' : 'both'} ethical practice qualifiers must be Observed.`,
    },
    observed,
    evidenceNotes,
    contraEvidenceNotes,
    statementNotes,
    summaryStrengths,
    summarySuggestions,
    extraSummaryRows,
  })
}

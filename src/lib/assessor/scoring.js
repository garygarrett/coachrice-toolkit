import { VERSIONS, COMPETENCY_NUMBERS, PASS_THRESHOLD } from './versions'

// "3.1" or "A3.1" -> the code in this version's style ("3.1" for 2021, "A3.1" for 2025)
function normalizeCode(versionId, code) {
  const m = String(code ?? '').match(/(\d+)\.(\d+)/)
  return m ? `${VERSIONS[versionId].codePrefix}${m[1]}.${m[2]}` : String(code ?? '')
}

// Match a rating to one of this version's known labels, ignoring case and spacing.
function normalizeRating(versionId, rating) {
  const wanted = String(rating ?? '').trim().toLowerCase()
  return Object.keys(VERSIONS[versionId].ratings).find((label) => label.toLowerCase() === wanted) || null
}

/**
 * Checks the AI's answer has the sections the report needs. Returns a short
 * problem description, or null if it looks right. Used to ask the AI again
 * instead of showing a blank report.
 */
export function validateEvaluation(versionId, raw) {
  if (!raw || typeof raw !== 'object') return 'the answer was not a JSON object'
  const version = VERSIONS[versionId]
  if (!Array.isArray(raw.behavioral_statements)) return 'it has no behavioral_statements list'
  if (!raw.ethical_practice || typeof raw.ethical_practice !== 'object') return 'it has no ethical_practice section'

  const found = new Map()
  for (const s of raw.behavioral_statements) {
    const code = normalizeCode(versionId, s?.code)
    if (normalizeRating(versionId, s?.rating)) found.set(code, true)
  }
  const missing = version.statements.filter((s) => !found.has(s.code)).map((s) => s.code)
  if (missing.length > 0) return `these statements are missing or have an unknown rating: ${missing.join(', ')}`
  return null
}

/**
 * Cleans up the AI's answer and recalculates every score ourselves, so the
 * math on the report is always right whatever the AI wrote.
 */
export function recomputeScores(versionId, rawEval) {
  const version = VERSIONS[versionId]

  const statements = rawEval.behavioral_statements.map((s) => ({
    ...s,
    code: normalizeCode(versionId, s.code),
    rating: normalizeRating(versionId, s.rating) || s.rating,
  }))

  const byComp = Object.fromEntries(COMPETENCY_NUMBERS.map((n) => [n, []]))
  for (const s of statements) {
    const n = parseInt(String(s.code).replace(/^\D+/, ''), 10)
    const score = version.ratings[s.rating]
    if (n in byComp && typeof score === 'number') byComp[n].push(score)
  }

  const averages = {}
  const rated = []
  for (const n of COMPETENCY_NUMBERS) {
    const scores = byComp[n]
    averages[n] = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    if (scores.length) rated.push(averages[n])
  }

  const rawScore = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 1
  const finalScore = (rawScore - 1) * version.scoreMultiplier
  const round2 = (x) => Math.round(x * 100) / 100

  const ethics = rawEval.ethical_practice || {}
  const passes =
    finalScore >= PASS_THRESHOLD &&
    ethics.icf_code_alignment === 'Observed' &&
    ethics.coach_role_alignment === 'Observed'

  return {
    ...rawEval,
    behavioral_statements: statements,
    score_calculation: {
      competency_3_average: round2(averages[3]),
      competency_4_average: round2(averages[4]),
      competency_5_average: round2(averages[5]),
      competency_6_average: round2(averages[6]),
      competency_7_average: round2(averages[7]),
      competency_8_average: round2(averages[8]),
      raw_score: round2(rawScore),
      final_score: round2(finalScore),
      result: passes ? 'Pass' : 'Below Passing Standard',
    },
  }
}

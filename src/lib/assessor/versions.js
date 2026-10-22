// Settings for the two versions of the Internal Assessor, in one place.
//
//   2021 = ICF ACC BARS (March 2024)  - 19 statements, codes like "3.1",
//          6-level ratings, Final = (Raw - 1) x 2
//   2025 = ICF ACC BARS (Nov 2025)    - 20 statements, codes like "A3.1",
//          4-level ratings, N/A left out, Final = (Raw - 1) x 2.5
import { PROMPT_2021, PROMPT_2025 } from './prompts'

// Pull the statement list ("- 3.1: \"Title\"") out of a prompt so the titles
// are written down only once.
function statementsFrom(prompt) {
  return [...prompt.matchAll(/^- (A?\d\.\d): "(.*)"$/gm)].map((m) => ({ code: m[1], title: m[2] }))
}

export const PASS_THRESHOLD = 3.4

export const VERSIONS = {
  '2021': {
    id: '2021',
    label: 'ICF ACC BARS (March 2024)',
    shortLabel: '2021 version',
    toolKey: 'assessor-2021',
    promptConfigKey: 'ai_assessor_prompt',
    defaultPrompt: PROMPT_2021,
    codePrefix: '',
    statements: statementsFrom(PROMPT_2021),
    // Rating label -> score. N/A counts as 1 in this version.
    ratings: {
      'Exemplary': 6,
      'Extremely Proficient': 5,
      'Proficient': 4,
      'Sufficient': 3,
      'Not quite sufficient': 2,
      'Insufficient': 1,
      'N/A': 1,
    },
    scoreMultiplier: 2,
    formula: 'Final Score = (Raw − 1) × 2',
  },
  '2025': {
    id: '2025',
    label: 'ICF ACC BARS (Nov 2025)',
    shortLabel: '2025 version',
    toolKey: 'assessor-2025',
    promptConfigKey: 'ai_assessor_2025_prompt',
    defaultPrompt: PROMPT_2025,
    codePrefix: 'A',
    statements: statementsFrom(PROMPT_2025),
    // Rating label -> score. N/A is left out of the averages.
    ratings: {
      'Exceeds the Standard': 5,
      'Meets the Standard': 4,
      'Below the Standard': 2,
      'Does Not Meet Standard': 1,
      'N/A': null,
    },
    scoreMultiplier: 2.5,
    formula: 'Final Score = (Raw − 1) × 2.5',
  },
}

export const COMPETENCY_NUMBERS = [3, 4, 5, 6, 7, 8]

/**
 * Use the prompt saved in the database only if it still asks for the answer
 * format this tool reads. A stale saved prompt makes the AI answer in a
 * different shape, which used to produce blank reports. Otherwise use the
 * built-in prompt.
 */
export function pickPrompt(versionId, savedPrompt) {
  const version = VERSIONS[versionId]
  const saved = typeof savedPrompt === 'string' ? savedPrompt.trim() : ''
  const looksRight =
    saved.includes('"behavioral_statements"') &&
    saved.includes('"score_calculation"') &&
    saved.includes('"ethical_practice"') &&
    version.statements.every((s) => saved.includes(s.code))
  if (!looksRight) {
    if (saved) console.warn(`[assessor] The saved ${versionId} prompt does not match the expected answer format, so the built-in prompt is being used.`)
    return version.defaultPrompt
  }
  return saved
}

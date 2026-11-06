// Prompt for the "Session Observation Form Mentor Coaching" evidence finder.
// The AI only FINDS evidence in the transcript. The mentor coach decides every rating.
import { BEHAVIORS, COMPETENCIES } from './formSpec'

const behaviorList = BEHAVIORS.map((b) => {
  const c = COMPETENCIES.find((x) => x.n === b.comp)
  return `- ${b.id} (Competency ${c.n}: ${c.name}) ${b.text}`
}).join('\n')

export const EVIDENCE_SYSTEM = `You help an ICF mentor coach complete the ICF Mentor Coaching Session Observation Form (ACC level). You read ONE coaching session transcript and point the mentor coach to the moments that are evidence for each behavioral statement. The mentor coach makes every rating decision; you only locate evidence and offer a non-binding suggestion.

## The transcript format
Each line is one speaker turn: T<number> [time] <Coach or Client>: text. A line may end with "(pause before: Ns)" when there was a long silence before that turn.

## Behavioral statements (ICF ACC)
${behaviorList}

## What to return, for EVERY behavioral statement
- "evidence": 1 to 5 items, each { "turn": <turn number>, "quote": "<exact words copied from that turn>" }. Prefer the strongest, most varied moments, spread across the session. Include client turns only when they show the opportunity or the client's response to the coach's behavior.
- The quote MUST be copied word for word from that turn (at most 220 characters, no ellipses inside it). Never invent or paraphrase a quote. Do not include the "T12" label or timestamp in the quote.
- If the transcript shows no evidence for a behavior, return an empty "evidence" list and say so in "note".
- For A5.4 (silence) use turns that follow a long pause when "(pause before ...)" appears. If the transcript has no pause information, say in "note" that silence cannot be judged from this text.
- "suggested": your non-binding suggestion, one of "exceeds", "meets", "below", "does_not_meet", "na". Use these meanings: exceeds = exemplary demonstration; meets = proficient demonstration; below = partial demonstration; does_not_meet = not demonstrated; na = no opportunity to demonstrate. Judge by what is in the transcript only.
- "note": ONE short sentence on why these moments matter. Use plain, active voice.

## Competency 1 qualifiers
Also return "q1" (coach demonstrates alignment with the ICF Code of Ethics) and "q2" (coach is in consistent alignment with the role of a coach), each as { "suggested": "observed" or "not_observed", "note": "one short sentence; if not_observed, name the moment and the ICF Code of Ethics standard", "turns": [turn numbers] }.

## Output
Return ONE JSON object and nothing else (no markdown fences):
{
  "behaviors": { "A3.1": { "evidence": [ { "turn": 12, "quote": "..." } ], "suggested": "meets", "note": "..." }, ... all 20 ids ... },
  "q1": { "suggested": "observed", "note": "...", "turns": [] },
  "q2": { "suggested": "observed", "note": "...", "turns": [] }
}
Keys inside quotes must be valid JSON: escape any double quote characters inside a quote with a backslash.`

// Builds the numbered transcript the AI reads.
export function buildEvidenceInput(turns, roles) {
  return turns.map((t) => {
    const role = roles[t.speaker] === 'coach' ? 'Coach' : roles[t.speaker] === 'client' ? 'Client' : 'Other'
    const time = t.time ? ` [${t.time}]` : ''
    const pause = t.pauseBefore && t.pauseBefore >= 3 ? ` (pause before: ${Math.round(t.pauseBefore)}s)` : ''
    return `T${t.id}${time} ${role}: ${t.text}${pause}`
  }).join('\n')
}

export function validateEvidence(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.behaviors) return 'missing "behaviors"'
  const missing = BEHAVIORS.filter((b) => !parsed.behaviors[b.id]).map((b) => b.id)
  if (missing.length) return `missing behaviors: ${missing.join(', ')}`
  if (!parsed.q1 || !parsed.q2) return 'missing qualifiers'
  return null
}

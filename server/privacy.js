// Transcript Reviewer results must not keep the coach's name. The AI reads a name out of the transcript
// ("coach_identifier"); we show it to the person running the review, but never store it.
export function withoutCoachName(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) return evaluation
  const { coach_identifier, ...rest } = evaluation // eslint-disable-line no-unused-vars
  return rest
}

// Same, for a result kept as a JSON string. Anything that is not a JSON object is returned unchanged.
export function withoutCoachNameText(text) {
  if (typeof text !== 'string') return withoutCoachName(text)
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? JSON.stringify(withoutCoachName(parsed)) : text
  } catch {
    return text
  }
}

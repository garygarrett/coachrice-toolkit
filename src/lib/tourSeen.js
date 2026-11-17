// Remembers, in this browser, which guided tours a person has already seen or skipped, so a tour only starts by itself once.
const key = (userId, tour) => `coachrice-tour-${userId || 'anon'}-${tour}`
export function tourSeen(userId, tour) {
  try { return window.localStorage.getItem(key(userId, tour)) === '1' } catch { return true } // if storage is blocked, never auto-start
}
export function markTourSeen(userId, tour) {
  try { window.localStorage.setItem(key(userId, tour), '1') } catch { /* nothing to do */ }
}

/**
 * Turns a behavioral statement code into its competency number.
 *   "3.1"  -> 3   (2021 style)
 *   "A3.1" -> 3   (Nov 2025 style, with the leading letter)
 * Returns NaN if the code has no number.
 */
export function competencyNumber(code) {
  return parseInt(String(code ?? '').replace(/^\D+/, '').split('.')[0], 10)
}

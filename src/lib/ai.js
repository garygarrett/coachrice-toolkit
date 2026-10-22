import { authFetch } from './authFetch'

/**
 * Asks the server to run an AI tool. The browser never holds an Anthropic API
 * key: the server (api/ai.js) looks up the key, picks the model, and calls
 * Anthropic on our behalf.
 *
 * Works like fetch() and returns the raw Response, so callers can keep using
 * res.ok, res.json(), and res.text() exactly as before.
 *
 *   tool        which tool this is: 'transcript', 'transcript-guest',
 *               'client-chat', 'client-feedback', 'assessor-2021', 'assessor-2025'
 *   system      the system prompt (text)
 *   messages    [{ role: 'user' | 'assistant', content: 'text' }, ...]
 *   accessCode  only for the guest tool: the code the guest entered
 *
 * Signed-in users are identified by their login token (added by authFetch).
 */
export function aiFetch(tool, { system, messages, accessCode } = {}) {
  return authFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, system, messages, accessCode }),
  })
}

/**
 * Runs an AI tool that must answer with ONE JSON object, and returns that
 * object already parsed.
 *
 * The AI sometimes writes slightly broken JSON (for example, a quote mark
 * inside a quote it copied from the transcript). When that happens this asks
 * again, up to `maxAttempts` times in total, instead of failing the whole run.
 * Network and server errors (like a 401) are NOT retried.
 *
 *   onUsage(usage)  optional; called with the token counts of every attempt,
 *                   so cost tracking still counts the retries.
 */
export async function aiJson(tool, { system, messages }, { maxAttempts = 3, onUsage } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await aiFetch(tool, { system, messages })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API error: ${response.status} — ${errText.slice(0, 200)}`)
    }

    const data = await response.json()
    if (data.usage && onUsage) onUsage(data.usage)

    const rawText = data.content?.[0]?.text || ''
    // Strip any accidental code fences, then try the whole text, then the
    // first {...} block inside it.
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()
    try {
      return JSON.parse(cleaned)
    } catch (parseErr) {
      try {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
        lastError = new Error('Could not parse evaluation response.')
      } catch (innerErr) {
        lastError = innerErr
      }
      console.warn(`[aiJson] ${tool}: attempt ${attempt} of ${maxAttempts} returned invalid JSON (${lastError.message})`)
    }
  }
  throw new Error(`The AI returned a badly formatted answer ${maxAttempts} times in a row. Please try again. (${lastError?.message})`)
}

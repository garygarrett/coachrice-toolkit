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

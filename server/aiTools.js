// The AI tools the app offers, who may use each one, and the model and size
// limits the SERVER enforces.
//
// Why this exists: the browser used to hold the Anthropic API keys and choose
// its own model and token limits. Now the browser only says WHICH tool it wants
// (for example "assessor-2025"); the server decides everything else. A user can
// no longer pick a pricier model or a bigger response than the tool allows.
//
// This file lives in /server (not /api) so it does not count as a Vercel function.

export const TOOLS = {
  // Signed-in coaches and admins
  'transcript': {
    access: 'user',
    keyName: 'api_key_transcript',
    model: 'claude-sonnet-4-6',
    maxTokens: 6000,
  },
  'client-chat': {
    access: 'user',
    keyName: 'api_key_chatbot',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 400,
  },
  'client-feedback': {
    access: 'user',
    keyName: 'api_key_feedback',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
  },

  // Guests who entered a valid access code (no login)
  'transcript-guest': {
    access: 'guest',
    keyName: 'api_key_transcript',
    model: 'claude-sonnet-4-6',
    maxTokens: 6000,
  },

  // Admins only (these pages are admin-only routes in the app)
  'assessor-2021': {
    access: 'admin',
    keyName: 'api_key_assessor',
    model: 'claude-opus-4-7',
    maxTokens: 8000,
  },
  'assessor-2025': {
    access: 'admin',
    keyName: 'api_key_assessor_2025',
    model: 'claude-opus-4-7',
    maxTokens: 8000,
  },
}

// Size limits. Vercel rejects request bodies over 4.5 MB, so stay well under it.
const MAX_MESSAGES = 200
const MAX_SYSTEM_CHARS = 100_000
const MAX_TOTAL_CHARS = 3_000_000

/**
 * Checks the parts of the request the browser controls (system prompt and
 * messages). Returns { ok: true, system, messages } or { ok: false, message }.
 */
export function validateAiPayload(body) {
  const { system, messages } = body || {}

  if (system !== undefined && system !== null && typeof system !== 'string') {
    return { ok: false, message: 'system must be text' }
  }
  if (typeof system === 'string' && system.length > MAX_SYSTEM_CHARS) {
    return { ok: false, message: 'system prompt is too long' }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: 'messages must be a non-empty list' }
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, message: 'too many messages' }
  }

  let total = typeof system === 'string' ? system.length : 0
  const clean = []
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { ok: false, message: 'each message needs a role (user or assistant) and text content' }
    }
    total += m.content.length
    clean.push({ role: m.role, content: m.content })
  }
  if (total > MAX_TOTAL_CHARS) {
    return { ok: false, message: 'request is too large' }
  }

  return { ok: true, system: system || undefined, messages: clean }
}

import { createClient } from '@supabase/supabase-js'
import { requireUser, requireAdmin } from '../server/auth.js'
import { TOOLS, validateAiPayload } from '../server/aiTools.js'

// One function that sits between the browser and Anthropic.
//
//   Browser  ->  /api/ai  ->  Anthropic
//
// The browser sends { tool, system, messages } (plus accessCode for guests).
// This function checks who is asking, looks up that tool's API key on the
// server, forces the model and token limit the tool is allowed to use, calls
// Anthropic, and passes the answer back unchanged. The API key never reaches
// the browser.
//
// Privacy: transcripts are sensitive, so this file never logs request or
// response contents, only the tool name and status codes.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Vercel Hobby allows up to 300 seconds with Fluid Compute. Stop waiting a bit
// before that so the browser gets a clear message instead of a bare 504.
const UPSTREAM_TIMEOUT_MS = 280_000

// Errors use the same shape Anthropic uses ({ error: { message } }) so the
// tools' existing error handling can read them.
function fail(res, status, message) {
  return res.status(status).json({ error: { message } })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return fail(res, 405, 'Method not allowed')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return fail(res, 500, 'Server misconfiguration')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const body = req.body || {}
  const tool = Object.prototype.hasOwnProperty.call(TOOLS, body.tool) ? TOOLS[body.tool] : null
  if (!tool) {
    return fail(res, 400, 'Unknown tool')
  }

  // 1. Who is asking? Each tool says what it needs.
  if (tool.access === 'admin') {
    if (!(await requireAdmin(req, res, supabase))) return
  } else if (tool.access === 'user') {
    if (!(await requireUser(req, res, supabase))) return
  } else if (tool.access === 'guest') {
    const code = typeof body.accessCode === 'string' ? body.accessCode.trim() : ''
    if (!code) return fail(res, 401, 'An access code is required')

    const { data: codeRow } = await supabase
      .from('access_codes')
      .select('id, active')
      .eq('code', code)
      .single()

    if (!codeRow || !codeRow.active) {
      return fail(res, 403, 'That access code is not valid')
    }
  } else {
    return fail(res, 500, 'Tool is misconfigured')
  }

  // 2. Is the request itself reasonable?
  const payload = validateAiPayload(body)
  if (!payload.ok) {
    return fail(res, 400, payload.message)
  }

  // 3. Fetch this tool's API key. It stays on the server.
  const { data: keyRow } = await supabase
    .from('config')
    .select('value')
    .eq('key', tool.keyName)
    .single()

  const apiKey = keyRow?.value?.trim()
  if (!apiKey) {
    console.error(`[ai] no API key configured for tool "${body.tool}"`)
    return fail(res, 500, 'AI is not set up for this tool yet. Please contact an administrator.')
  }

  // 4. Call Anthropic. The SERVER chooses the model and token limit.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: tool.model,
        max_tokens: tool.maxTokens,
        ...(payload.system ? { system: payload.system } : {}),
        messages: payload.messages,
      }),
      signal: controller.signal,
    })

    const text = await upstream.text()

    // If Anthropic rejects the server's key, tell the browser it is a server
    // problem (not a problem with the person's own login).
    if (upstream.status === 401 || upstream.status === 403) {
      console.error(`[ai] Anthropic rejected the key for tool "${body.tool}" (status ${upstream.status})`)
      return fail(res, 502, 'The AI service rejected this tool\'s API key. Please contact an administrator.')
    }
    if (!upstream.ok) {
      console.error(`[ai] Anthropic returned status ${upstream.status} for tool "${body.tool}"`)
    }

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.status(upstream.status).send(text)
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error(`[ai] timed out waiting for Anthropic (tool "${body.tool}")`)
      return fail(res, 504, 'The AI service took too long to respond. Please try again.')
    }
    console.error(`[ai] could not reach Anthropic (tool "${body.tool}"): ${err?.message}`)
    return fail(res, 502, 'Could not reach the AI service. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}

// Shared server-side login checks for the Vercel functions in /api.
//
// Why this file exists: the API functions use Supabase's service-role key,
// which bypasses row-level security. That means each function must confirm
// WHO is calling before it does anything. We never trust a userId sent in the
// request body, because anyone can type any userId. Instead we read the login
// token (a JWT) that Supabase gave the browser, and ask Supabase who it belongs to.
//
// This file lives in /server (not /api) on purpose: Vercel turns every file in
// /api into its own function, and this is a helper, not an endpoint.

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/**
 * Confirms the request comes from a logged-in user.
 * Returns { user } on success.
 * On failure it sends a 401 response and returns null, so the caller should
 * simply `return` when it gets null.
 */
export async function requireUser(req, res, supabase) {
  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Not signed in' })
    return null
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    // Log why Supabase refused the token (never the token itself) so we can
    // tell an expired session from a server setup problem.
    console.error(`[auth] getUser failed: status=${error?.status ?? 'none'} code=${error?.code ?? 'none'} message=${error?.message ?? 'no user returned'}`)
    res.status(401).json({
      error: 'Invalid or expired session',
      reason: error?.code || error?.message || 'no user returned',
    })
    return null
  }

  return { user: data.user }
}

/**
 * For endpoints where the browser sends "userId = me" (history, exams, chats).
 * Verifies the login token, then rejects the request if the userId it claims
 * is not the person the token actually belongs to. After this passes, the
 * userId in the request can be trusted as the real caller.
 * If no userId was sent, it only verifies the token (the endpoint's own
 * "userId is required" check still runs afterward).
 * Returns { user } on success, or sends 401/403 and returns null.
 */
export async function requireSelf(req, res, supabase, claimedUserId) {
  const auth = await requireUser(req, res, supabase)
  if (!auth) return null

  if (claimedUserId && claimedUserId !== auth.user.id) {
    res.status(403).json({ error: 'userId does not match the signed-in user' })
    return null
  }

  return auth
}

/**
 * Confirms the request comes from a logged-in user whose role is 'admin'
 * in the users table (the same place the app already stores roles).
 * Returns { user } on success, or sends 401/403 and returns null.
 */
export async function requireAdmin(req, res, supabase) {
  const auth = await requireUser(req, res, supabase)
  if (!auth) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', auth.user.id)
    .single()

  if (error || !profile) {
    res.status(403).json({ error: 'Not authorized' })
    return null
  }

  if (profile.role !== 'admin' || profile.is_active === false) {
    res.status(403).json({ error: 'Admin access required' })
    return null
  }

  return auth
}

/**
 * Checks an access code. Returns { code } when it is valid (active, not expired,
 * and, if `roles` is given, one of those roles), or { status, error } when not.
 */
export async function lookupCode(supabase, rawCode, roles) {
  const code = typeof rawCode === 'string' ? rawCode.trim() : ''
  if (!code) return { status: 401, error: 'An access code is required' }

  const { data } = await supabase
    .from('access_codes')
    .select('id, label, active, role, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (!data || !data.active) return { status: 403, error: 'That access code is not valid' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { status: 403, error: 'That access code has expired' }
  }
  if (roles && !roles.includes(data.role)) {
    return { status: 403, error: 'That access code does not include this tool' }
  }
  return { code: data }
}

/**
 * For tools that an admin account OR an access code may use.
 *   - A signed-in request must be an admin (same check as requireAdmin).
 *   - Otherwise the request must carry an access code (header x-access-code, or
 *     accessCode in the body) whose role is in `codeRoles`.
 * Returns { kind, owner } where owner = { column, value } says who owns any work
 * saved by this request (a user, or an access code). On failure it sends the
 * response and returns null.
 */
export async function requireCaller(req, res, supabase, { codeRoles = [] } = {}) {
  if (getBearerToken(req)) {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return null
    return { kind: 'user', user: auth.user, owner: { column: 'user_id', value: auth.user.id } }
  }

  const raw = req.headers?.['x-access-code'] || req.body?.accessCode
  const found = await lookupCode(supabase, raw, codeRoles)
  if (found.error) {
    res.status(found.status).json({ error: found.error })
    return null
  }
  return { kind: 'code', code: found.code, owner: { column: 'access_code_id', value: found.code.id } }
}

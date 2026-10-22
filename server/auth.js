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

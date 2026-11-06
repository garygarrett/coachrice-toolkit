import { supabase } from './supabase'

/**
 * Works like fetch(), but adds the signed-in user's login token so the
 * server (the functions in /api) can verify who is calling.
 *
 * Use this for any /api call that changes users or reads protected data.
 *
 * Note: do NOT call this from inside an onAuthStateChange callback.
 * Calling supabase.auth.getSession() there can deadlock (see CLAUDE.md).
 */
export async function authFetch(url, options = {}) {
  // Mentor-coach and admin access codes have no login. The code itself proves who is calling.
  try {
    const role = sessionStorage.getItem('coachrice_access_role')
    const code = sessionStorage.getItem('coachrice_access_code')
    if ((role === 'mentor' || role === 'admin') && code) {
      return fetch(url, { ...options, headers: { ...(options.headers || {}), 'x-access-code': code } })
    }
  } catch { /* sessionStorage unavailable: fall through to a normal login */ }

  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(url, { ...options, headers })
}

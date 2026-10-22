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
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(url, { ...options, headers })
}

import { useEffect, useState } from 'react'
import { authFetch } from './authFetch'

// Does this account have at least one FAQ / Guide section it may read? The sidebar link only shows when it does.
// Full admins always get the link (they edit the guide). The answer is kept for the session; the editor calls
// invalidateGuide() after any change so the link updates.
let cache = null
const listeners = new Set()

export function invalidateGuide() {
  cache = null
  listeners.forEach((fn) => fn())
}

export function useGuideAvailable(profile) {
  const [tick, bump] = useState(0)
  const [has, setHas] = useState(false)
  const role = profile?.role
  useEffect(() => {
    const fn = () => bump((n) => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  useEffect(() => {
    if (!role) return undefined
    if (role === 'admin') { setHas(true); return undefined }
    let live = true
    if (!cache) {
      cache = authFetch('/api/user-actions?action=guide-list', { method: 'POST' })
        .then((r) => (r.ok ? r.json() : { sections: [] }))
        .then((j) => (j.sections || []).length > 0)
        .catch(() => false)
    }
    cache.then((v) => { if (live) setHas(v) })
    return () => { live = false }
  }, [role, tick])
  return has
}

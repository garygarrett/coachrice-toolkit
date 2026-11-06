import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homeFor, isToolOnlyRole } from '../lib/roles'

/**
 * Wraps a route so only signed-in users with the right role can open it.
 * allowedRole: 'any' (coaches and admins), one role name, or a list of role names.
 * - Not signed in -> the home sign-in page
 * - Wrong role -> that account's own home page
 * (The server checks the role again on every request. This only decides what shows.)
 */
export default function ProtectedRoute({ children, allowedRole }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div style={loadingStyle}>Loading…</div>

  if (!user) return <Navigate to="/access" replace />

  // Profile is still being fetched — hold here rather than redirecting
  if (!profile) return <div style={loadingStyle}>Loading…</div>

  const allowed =
    allowedRole === 'any'
      ? !isToolOnlyRole(profile.role)
      : Array.isArray(allowedRole)
        ? allowedRole.includes(profile.role)
        : profile.role === allowedRole

  if (!allowed) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : homeFor(profile.role)} replace />
  }

  return children
}

const loadingStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  fontSize: '1rem',
}

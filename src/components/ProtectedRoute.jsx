import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps a route so only authenticated users with the correct role can access it.
 * - Not logged in → /login
 * - Wrong role → their correct home page
 */
export default function ProtectedRoute({ children, allowedRole }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div style={loadingStyle}>Loading…</div>

  if (!user) return <Navigate to="/login" replace />

  // Profile is still being fetched — hold here rather than redirecting
  if (!profile) return <div style={loadingStyle}>Loading…</div>

  if (profile.role !== allowedRole) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />
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

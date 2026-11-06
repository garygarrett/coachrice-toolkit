import { Navigate } from 'react-router-dom'

/**
 * Guards the access-code paths.
 * Checks sessionStorage for the flag set after a valid access code is entered,
 * and that the code's role is one this page allows (default: student codes).
 * Closing the tab clears the session, which is intentional for code access.
 * (The server checks the code again on every request. This only decides which pages show.)
 */
export default function GuestRoute({ children, roles = ['student'] }) {
  const granted = sessionStorage.getItem('coachrice_access') === 'granted'
  const role = sessionStorage.getItem('coachrice_access_role') || 'student'
  if (!granted) return <Navigate to="/access" replace />
  if (!roles.includes(role)) {
    const home = role === 'mentor' || role === 'admin' ? '/access/session-observation' : '/access/transcript'
    return <Navigate to={home} replace />
  }
  return children
}

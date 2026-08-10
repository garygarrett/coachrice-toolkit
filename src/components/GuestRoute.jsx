import { Navigate } from 'react-router-dom'

/**
 * Guards the anonymous access-code path.
 * Checks sessionStorage for the flag set after a valid access code is entered.
 * Closing the tab clears the session — intentional for stateless guest access.
 */
export default function GuestRoute({ children }) {
  const granted = sessionStorage.getItem('coachrice_access') === 'granted'
  if (!granted) return <Navigate to="/access" replace />
  return children
}

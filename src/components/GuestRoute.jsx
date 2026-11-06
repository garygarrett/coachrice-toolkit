import { Navigate } from 'react-router-dom'

/**
 * Guards the student access-code path.
 * Checks sessionStorage for the flag set after a valid student code is entered.
 * Closing the tab clears the session, which is intentional for code access.
 * (The server checks the code again on every request. This only decides which pages show.)
 */
export default function GuestRoute({ children }) {
  const granted = sessionStorage.getItem('coachrice_access') === 'granted'
  if (!granted) return <Navigate to="/access/student" replace />
  return children
}

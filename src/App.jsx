import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import CoachDashboard from './pages/CoachDashboard'
import AdminPanel from './pages/AdminPanel'
import Exam from './pages/tools/Exam'

/**
 * Detects when a user arrives via an invite email link.
 * Supabase puts `type=invite` in the URL hash; we catch it here
 * and redirect to /set-password before the hash is cleared.
 */
function InviteRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    if (window.location.hash.includes('type=invite')) {
      navigate('/set-password', { replace: true })
    }
  }, [navigate])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      <InviteRedirect />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="coach">
              <CoachDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/exam"
          element={
            <ProtectedRoute allowedRole="coach">
              <Exam />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

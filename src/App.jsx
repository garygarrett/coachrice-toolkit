import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { VisibilityProvider } from './context/VisibilityContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import CoachDashboard from './pages/CoachDashboard'
import History from './pages/History'
import AdminHistory from './pages/AdminHistory'
import AdminPanel from './pages/AdminPanel'
import Exam from './pages/tools/Exam'
import TranscriptScorer from './pages/tools/TranscriptScorer'
import AIClient from './pages/tools/AIClient'
import AudioToTranscript from './pages/tools/AudioToTranscript'
import Assessor from './pages/tools/Assessor'
import Assessor2025 from './pages/tools/Assessor2025'

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
      <VisibilityProvider>
        <InviteRedirect />
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="any">
              <CoachDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRole="any">
              <History />
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
          path="/admin/history"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/exam"
          element={
            <ProtectedRoute allowedRole="any">
              <Exam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/transcript"
          element={
            <ProtectedRoute allowedRole="any">
              <TranscriptScorer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/ai"
          element={
            <ProtectedRoute allowedRole="any">
              <AIClient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/audio"
          element={
            <ProtectedRoute allowedRole="any">
              <AudioToTranscript />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/assessor"
          element={
            <ProtectedRoute allowedRole="admin">
              <Assessor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/assessor-2025"
          element={
            <ProtectedRoute allowedRole="admin">
              <Assessor2025 />
            </ProtectedRoute>
          }
        />
      </Routes>
      </VisibilityProvider>
    </AuthProvider>
  )
}

import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { VisibilityProvider } from './context/VisibilityContext'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import Login from './pages/Login'
import AccessCodeEntry from './pages/AccessCodeEntry'
import TranscriptScorerGuest from './pages/tools/TranscriptScorerGuest'
import SetPassword from './pages/SetPassword'
import Agreements from './pages/Agreements'
import CoachDashboard from './pages/CoachDashboard'
import History from './pages/History'
import AdminHistory from './pages/AdminHistory'
import AdminPanel from './pages/AdminPanel'
import AdminAnalytics from './pages/AdminAnalytics'
import Exam from './pages/tools/Exam'
import TranscriptScorer from './pages/tools/TranscriptScorer'
import AIClient from './pages/tools/AIClient'
import InternalAssessor from './pages/tools/InternalAssessor'
import AudioToTranscript from './pages/tools/AudioToTranscript'
import AssessorTest from './pages/tools/AssessorTest'

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
        <Route path="/" element={<Navigate to="/access" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/access" element={<AccessCodeEntry />} />
        <Route path="/access/transcript" element={<GuestRoute><TranscriptScorerGuest /></GuestRoute>} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/agreements" element={<Agreements />} />
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
          path="/admin/analytics"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminAnalytics />
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
          path="/tools/assessor"
          element={
            <ProtectedRoute allowedRole="admin">
              <InternalAssessor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/audio"
          element={
            <ProtectedRoute allowedRole="admin">
              <AudioToTranscript />
            </ProtectedRoute>
          }
        />
        <Route path="/tools/assessor-2025" element={<Navigate to="/tools/assessor?version=2025" replace />} />
        <Route
          path="/tools/assessor-test"
          element={<AssessorTest />}
        />
      </Routes>
      </VisibilityProvider>
    </AuthProvider>
  )
}

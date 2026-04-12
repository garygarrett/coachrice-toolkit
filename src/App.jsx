import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CoachDashboard from './pages/CoachDashboard'
import AdminPanel from './pages/AdminPanel'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<CoachDashboard />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  )
}

export default App

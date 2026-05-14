import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CoachRICEAgreements from '../components/CoachRICEAgreements'

export default function Agreements() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // If already accepted, redirect to dashboard
  if (!loading && profile?.agreements_accepted) {
    navigate('/dashboard', { replace: true })
  }

  // If not logged in, redirect to login
  if (!loading && !user) {
    navigate('/login', { replace: true })
  }

  const handleComplete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ agreements_accepted: true, agreements_accepted_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateError) throw updateError

      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Error accepting agreements:', err)
      setError('Failed to save your acceptance. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
  }

  return (
    <div>
      <CoachRICEAgreements onComplete={handleComplete} />
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '6px',
          padding: '12px 16px',
          color: '#991B1B',
          fontSize: '14px',
          maxWidth: '400px'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Shown when a newly invited coach clicks the email link.
 * Supabase auto-exchanges the invite token and signs them in;
 * this page lets them set a permanent password before entering the app.
 */
export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Welcome to CoachRICE Toolkit</h1>
        <p style={s.subtitle}>Set a password to activate your account.</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            New Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={s.input}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </label>

          <label style={s.label}>
            Confirm Password
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={s.input}
              autoComplete="new-password"
            />
          </label>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={s.button}>
            {submitting ? 'Saving…' : 'Set Password & Enter App'}
          </button>
        </form>
      </div>
    </main>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '10px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
    width: '100%',
    maxWidth: '420px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#00205B',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: '#666',
    fontSize: '0.85rem',
    marginBottom: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '0.65rem 0.8rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    color: '#111',
    outline: 'none',
  },
  error: {
    color: '#b91c1c',
    fontSize: '0.875rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
  },
  button: {
    padding: '0.75rem',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.25rem',
  },
}

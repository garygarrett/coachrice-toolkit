import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [view, setView] = useState('login') // 'login' | 'forgot'

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  // If already logged in, redirect away from the login page
  useEffect(() => {
    if (!loading && user && profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    }
  }, [user, profile, loading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('Invalid email or password. Please try again.')
      setSubmitting(false)
      return
    }

    const { data: profileData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    navigate(profileData?.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setResetError(null)
    setResetSubmitting(true)

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    if (error) {
      setResetError(error.message)
      setResetSubmitting(false)
    } else {
      setResetSent(true)
      setResetSubmitting(false)
    }
  }

  if (view === 'forgot') {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <h1 style={s.title}>Reset Your Password</h1>
          <p style={s.subtitle}>We'll send a password reset link to your email.</p>

          {resetSent ? (
            <>
              <p style={s.successMsg}>
                Check your inbox — a reset link is on its way.
              </p>
              <button onClick={() => { setView('login'); setResetSent(false); setResetEmail('') }} style={s.linkBtn}>
                Back to Sign In
              </button>
            </>
          ) : (
            <form onSubmit={handleForgotPassword} style={s.form}>
              <label style={s.label}>
                Email
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                  style={s.input}
                  autoComplete="email"
                  placeholder="you@rice.edu"
                />
              </label>
              {resetError && <p style={s.error}>{resetError}</p>}
              <button type="submit" disabled={resetSubmitting} style={s.button}>
                {resetSubmitting ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => setView('login')} style={s.linkBtn}>
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </main>
    )
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>CoachRICE Toolkit</h1>
        <p style={s.subtitle}>Doerr Institute for New Leaders · Rice University</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={s.input}
              autoComplete="email"
              placeholder="you@rice.edu"
            />
          </label>

          <label style={s.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={s.input}
              autoComplete="current-password"
            />
          </label>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={s.button}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <button type="button" onClick={() => setView('forgot')} style={s.linkBtn}>
            Forgot your password?
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
  successMsg: {
    color: '#15803d',
    fontSize: '0.9rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '0.75rem',
    marginBottom: '1rem',
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
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#00205B',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    textAlign: 'center',
  },
}

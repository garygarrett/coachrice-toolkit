import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import logoImage from '../CoachRICE_White.png'

export default function Login() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [view, setView] = useState('login') // 'login' | 'forgot'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

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
      const isBanned = signInError.message?.toLowerCase().includes('banned')
      setError(
        isBanned
          ? 'Your account is currently paused. If you have questions about this, please reach out to CoachRICE@rice.edu.'
          : 'Invalid email or password. Please try again.'
      )
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
      <div style={s.container}>
        <div style={s.brandPanel}>
          <div style={s.brandBlobTop} />
          <div style={s.brandBlobBottom} />
          <div style={s.brandLogo}>
            <img src={logoImage} alt="CoachRICE" style={{ height: '44px', maxWidth: '160px', objectFit: 'contain' }} />
          </div>
          <div style={s.brandBody}>
            <div style={s.brandTitle}>CoachRICE Coaching Toolkit</div>
            <div style={s.brandSub}>Practice exams, session review, AI coaching practice, and transcript tools — all in one place.</div>
          </div>
        </div>

        <div style={s.formPanel}>
          <div style={s.formInner}>
            <div style={s.formTitle}>Reset Your Password</div>
            <div style={s.formSubtitle}>We'll send a password reset link to your email.</div>

            {resetSent ? (
              <>
                <p style={s.successMsg}>Check your inbox — a reset link is on its way.</p>
                <button
                  onClick={() => {
                    setView('login')
                    setResetSent(false)
                    setResetEmail('')
                  }}
                  style={s.linkBtn}
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div style={s.field}>
                  <label htmlFor="reset-email" style={s.label}>Email address</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    style={s.input}
                    autoComplete="email"
                    placeholder="you@rice.edu"
                  />
                </div>

                {resetError && <p style={s.errorMsg}>{resetError}</p>}

                <button type="submit" disabled={resetSubmitting} style={s.btnSignin}>
                  {resetSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => setView('login')}
                  style={s.linkBtn}
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.brandPanel}>
        <div style={s.brandBlobTop} />
        <div style={s.brandBlobBottom} />
        <div style={s.brandLogo}>
          <img src={logoImage} alt="CoachRICE" style={{ height: '44px', maxWidth: '160px', objectFit: 'contain' }} />
        </div>
        <div style={s.brandBody}>
          <div style={s.brandTitle}>CoachRICE Coaching Toolkit</div>
          <div style={s.brandSub}>Practice exams, session review, AI coaching practice, and transcript tools — all in one place.</div>
        </div>
      </div>

      <div style={s.formPanel}>
        <div style={s.formInner}>
          <div style={s.formTitle}>Sign in to CoachRICE</div>
          <div style={s.formSubtitle}>Welcome back. Enter your credentials to continue.</div>

          <form onSubmit={handleSubmit}>
            <div style={s.field}>
              <label htmlFor="email" style={s.label}>Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={s.input}
                autoComplete="email"
                placeholder="you@rice.edu"
              />
            </div>

            <div style={s.field}>
              <label htmlFor="password" style={s.label}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={s.input}
                autoComplete="current-password"
                placeholder="••••••••••"
              />
            </div>

            <div style={s.forgotRow}>
              <button type="button" onClick={() => setView('forgot')} style={s.forgotLink}>
                Forgot password?
              </button>
            </div>

            {error && <p style={s.errorMsg}>{error}</p>}

            <button type="submit" disabled={submitting} style={s.btnSignin}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <div style={s.needAccount}>
              <div style={s.needAccountTitle}>Need an account?</div>
              <div style={s.needAccountBody}>
                If you are part of a CoachRICE cohort and need access, please email{' '}
                <a href="mailto:CoachRICE@rice.edu" style={s.accountLink}>
                  CoachRICE@rice.edu
                </a>{' '}
                and an admin will set up your account.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: "'Montserrat', sans-serif",
  },
  brandPanel: {
    width: '45%',
    background: '#00205B',
    display: 'flex',
    flexDirection: 'column',
    padding: '48px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  brandBlobTop: {
    position: 'absolute',
    top: '-60px',
    right: '-60px',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'rgba(105,204,230,0.07)',
  },
  brandBlobBottom: {
    position: 'absolute',
    bottom: '40px',
    left: '-40px',
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    background: 'rgba(255,130,0,0.07)',
  },
  brandLogo: {
    marginBottom: '60px',
  },
  brandBody: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#fff',
    lineHeight: '1.2',
    marginBottom: '16px',
    letterSpacing: '-0.5px',
  },
  brandSub: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1.7',
  },
  formPanel: {
    flex: '1',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  formInner: {
    width: '100%',
    maxWidth: '340px',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#00205B',
    marginBottom: '6px',
    letterSpacing: '-0.3px',
  },
  formSubtitle: {
    fontSize: '11px',
    color: '#6b7a99',
    marginBottom: '28px',
  },
  field: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '9px',
    fontWeight: '700',
    color: '#0f1c3a',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    height: '38px',
    borderRadius: '7px',
    border: '1px solid #e2e6ec',
    background: '#fafbfc',
    padding: '0 12px',
    fontSize: '11px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#0f1c3a',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  forgotRow: {
    textAlign: 'right',
    marginBottom: '22px',
  },
  forgotLink: {
    fontSize: '10px',
    color: '#00205B',
    fontWeight: '600',
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  btnSignin: {
    width: '100%',
    height: '38px',
    borderRadius: '7px',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: '0.3px',
    transition: 'background 0.15s',
    marginBottom: '28px',
  },
  needAccount: {
    background: '#f0f2f5',
    borderRadius: '8px',
    border: '1px solid #e2e6ec',
    padding: '14px 16px',
  },
  needAccountTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#0f1c3a',
    marginBottom: '5px',
  },
  needAccountBody: {
    fontSize: '10px',
    color: '#6b7a99',
    lineHeight: '1.7',
  },
  accountLink: {
    color: '#00205B',
    fontWeight: '600',
    textDecoration: 'none',
  },
  errorMsg: {
    color: '#b91c1c',
    fontSize: '10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
  },
  successMsg: {
    color: '#15803d',
    fontSize: '10px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#00205B',
    fontSize: '10px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
    fontWeight: '600',
  },
}

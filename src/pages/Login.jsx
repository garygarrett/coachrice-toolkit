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
            <div style={s.brandEyebrow}>Account Security</div>
            <div style={s.brandTitle}>Forgot your password? No problem.</div>
            <div style={s.brandSub}>Enter your email address and we'll send you a secure link to reset your password. The link expires after 24 hours.</div>
          </div>
          <div style={s.brandHelp}>
            <div style={s.brandHelpTitle}>Need help?</div>
            <div style={s.brandHelpBody}>If you're unable to access your account, contact <a href="mailto:CoachRICE@rice.edu" style={{ color: '#69cce6', textDecoration: 'none' }}>CoachRICE@rice.edu</a></div>
          </div>
        </div>

        <div style={s.formPanel}>
          <div style={s.formInner}>
            {resetSent ? (
              <>
                <div style={{ ...s.iconBox, background: '#e4f5e9' }}>✅</div>
                <div style={s.formTitle}>Check your email</div>
                <div style={s.formSub}>We've sent a password reset link to <strong>CoachRICE@rice.edu</strong>. The link will expire in 24 hours.</div>
                <div style={s.notice}>
                  <div style={s.noticeTitle}>Didn't receive the email?</div>
                  <div style={s.noticeBody}>Check your spam folder, or <button type="button" onClick={() => { setResetSent(false); setResetEmail(''); }} style={{ background: 'none', border: 'none', color: '#00205B', fontWeight: '700', textDecoration: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Montserrat', sans-serif", fontSize: '10px' }}>click here to resend</button>.</div>
                </div>
                <button
                  onClick={() => {
                    setView('login')
                    setResetSent(false)
                    setResetEmail('')
                  }}
                  style={{ ...s.btnSignin, background: 'none', border: '1px solid #e2e6ec', color: '#0f1c3a', fontSize: '10px', fontFamily: "'Montserrat', sans-serif" }}
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div style={{ ...s.iconBox, background: '#e6f7fc' }}>🔑</div>
                <div style={s.formTitle}>Reset your password</div>
                <div style={s.formSub}>Enter the email address associated with your account and we'll send you a reset link.</div>

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

                <div style={s.backLink}>
                  Remember your password? <button type="button" onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: '#00205B', fontWeight: '700', textDecoration: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Montserrat', sans-serif", fontSize: '10px' }}>Back to sign in</button>
                </div>
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
          <div style={s.formTitle}>Sign in to CoachRICE Coaching Toolkit</div>

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
    fontFamily: "'Montserrat', sans-serif",
  },
  brandSub: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1.7',
    fontFamily: "'Montserrat', sans-serif",
  },
  brandEyebrow: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    color: '#69cce6',
    marginBottom: '14px',
    fontFamily: "'Montserrat', sans-serif",
  },
  brandHelp: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '14px 18px',
    marginTop: '24px',
  },
  brandHelpTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#69cce6',
    marginBottom: '4px',
    fontFamily: "'Montserrat', sans-serif",
  },
  brandHelpBody: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1.6',
    fontFamily: "'Montserrat', sans-serif",
  },
  formPanel: {
    flex: '1',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 48px',
  },
  formInner: {
    width: '100%',
    maxWidth: '420px',
  },
  formTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#00205B',
    marginBottom: '28px',
    letterSpacing: '-0.3px',
    fontFamily: "'Montserrat', sans-serif",
  },
  formSub: {
    fontSize: '11px',
    color: '#6b7a99',
    marginBottom: '28px',
    lineHeight: '1.6',
    fontFamily: "'Montserrat', sans-serif",
  },
  iconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    marginBottom: '20px',
  },
  field: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '9px',
    fontWeight: '700',
    color: '#0f1c3a',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%',
    height: '44px',
    borderRadius: '7px',
    border: '1px solid #e2e6ec',
    background: '#fafbfc',
    padding: '0 14px',
    fontSize: '13px',
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
    fontFamily: "'Montserrat', sans-serif",
  },
  btnSignin: {
    width: '100%',
    height: '44px',
    borderRadius: '7px',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
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
    fontFamily: "'Montserrat', sans-serif",
  },
  needAccountBody: {
    fontSize: '10px',
    color: '#6b7a99',
    lineHeight: '1.7',
    fontFamily: "'Montserrat', sans-serif",
  },
  accountLink: {
    color: '#00205B',
    fontWeight: '600',
    textDecoration: 'none',
    fontFamily: "'Montserrat', sans-serif",
  },
  errorMsg: {
    color: '#b91c1c',
    fontSize: '10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
    fontFamily: "'Montserrat', sans-serif",
  },
  successMsg: {
    color: '#15803d',
    fontSize: '10px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
    fontFamily: "'Montserrat', sans-serif",
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
    fontFamily: "'Montserrat', sans-serif",
  },
  notice: {
    background: '#f0f2f5',
    border: '1px solid #e2e6ec',
    borderRadius: '8px',
    padding: '14px 16px',
    marginBottom: '24px',
  },
  noticeTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#0f1c3a',
    marginBottom: '4px',
    fontFamily: "'Montserrat', sans-serif",
  },
  noticeBody: {
    fontSize: '10px',
    color: '#6b7a99',
    lineHeight: '1.6',
    fontFamily: "'Montserrat', sans-serif",
  },
  backLink: {
    textAlign: 'center',
    fontSize: '10px',
    color: '#6b7a99',
    fontFamily: "'Montserrat', sans-serif",
  },
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homeFor } from '../lib/roles'
import logoImage from '../CoachRICE_White.png'

export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // 'checking' while the emailed link is turned into a sign-in, then 'ready' or 'expired'.
  const [linkState, setLinkState] = useState('checking')
  const [resendEmail, setResendEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    // Read the link's own error (for example an expired or already used link) before the client clears the address.
    const hash = window.location.hash || ''
    const linkFailed = /error=|error_code=|otp_expired|access_denied/.test(hash)
    let alive = true
    // The listener only sets state (never call Supabase data methods inside it).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session) setLinkState('ready')
    })
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (data?.session) setLinkState('ready')
      else if (linkFailed) setLinkState('expired')
      else setTimeout(async () => { // give the emailed link a moment to finish signing in
        const again = await supabase.auth.getSession()
        if (alive) setLinkState(again.data?.session ? 'ready' : 'expired')
      }, 1500)
    })()
    return () => { alive = false; sub?.subscription?.unsubscribe() }
  }, [])

  async function sendNewLink(e) {
    e.preventDefault()
    setError(null)
    setResendBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    })
    setResendBusy(false)
    if (resetError) setError(resetError.message)
    else setResendSent(true)
  }

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
      if (/session missing/i.test(updateError.message)) setLinkState('expired')
      else setError(updateError.message)
      setSubmitting(false)
      return
    }

    // The agreements screen is turned off for now. Send each kind of account to its own home.
    let home = '/dashboard'
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: row } = await supabase.from('users').select('role').eq('id', user.id).single()
        home = homeFor(row?.role)
      }
    } catch { /* fall back to the dashboard */ }
    navigate(home, { replace: true })
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
          <div style={s.brandEyebrow}>Account Setup</div>
          <div style={s.brandTitle}>Activate Your Account</div>
          <div style={s.brandSub}>Create a secure password to access the CoachRICE Toolkit and all its features.</div>
        </div>
      </div>

      <div style={s.formPanel}>
        <div style={s.formInner}>
          <div style={s.formTitle}>Set Your Password</div>

          {linkState === 'checking' && <div style={s.formSub}>Checking your link…</div>}

          {linkState === 'expired' && (
            <form onSubmit={sendNewLink}>
              <div style={{ ...s.formSub, color: '#00205B', fontWeight: 600 }}>This link has expired or was already used.</div>
              <div style={s.formSub}>
                Some email programs open links automatically, which uses them up. Enter your email and we will send you a fresh link. Open it right away, in the same browser you want to use.
              </div>
              {resendSent ? (
                <p style={{ ...s.formSub, color: '#00205B', fontWeight: 600 }}>If that email has an account, a new link is on its way. Check your inbox.</p>
              ) : (
                <>
                  <div style={s.field}>
                    <label htmlFor="resend-email" style={s.label}>Email</label>
                    <input id="resend-email" type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} required style={s.input} autoComplete="email" />
                  </div>
                  {error && <p style={s.errorMsg}>{error}</p>}
                  <button type="submit" disabled={resendBusy} style={s.btnSignin}>{resendBusy ? 'Sending…' : 'Send me a new link'}</button>
                </>
              )}
            </form>
          )}

          {linkState === 'ready' && <div style={s.formSub}>Password must be at least 8 characters.</div>}

          {linkState === 'ready' && <form onSubmit={handleSubmit}>
            <div style={s.field}>
              <label htmlFor="password" style={s.label}>New Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={s.input}
                autoComplete="new-password"
                placeholder="••••••••••"
              />
            </div>

            <div style={s.field}>
              <label htmlFor="confirm" style={s.label}>Confirm Password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={s.input}
                autoComplete="new-password"
                placeholder="••••••••••"
              />
            </div>

            {error && <p style={s.errorMsg}>{error}</p>}

            <button type="submit" disabled={submitting} style={s.btnSignin}>
              {submitting ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>}
        </div>
      </div>
    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Montserrat', sans-serif",
  },
  brandPanel: {
    flex: '1',
    background: 'linear-gradient(135deg, #00205B 0%, #002a7a 100%)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '60px 48px',
    position: 'relative',
    overflow: 'hidden',
  },
  brandBlobTop: {
    position: 'absolute',
    top: '-80px',
    right: '-80px',
    width: '160px',
    height: '160px',
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
    position: 'relative',
    zIndex: 1,
    marginBottom: '60px',
  },
  brandBody: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
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
  brandEyebrow: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    color: '#69cce6',
    marginBottom: '14px',
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
  },
  formSub: {
    fontSize: '11px',
    color: '#6b7a99',
    marginBottom: '28px',
    lineHeight: '1.6',
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
  },
  input: {
    width: '100%',
    height: '44px',
    borderRadius: '7px',
    border: '1px solid #e2e6ec',
    background: '#fafbfc',
    padding: '0 14px',
    fontSize: '13px',
    color: '#0f1c3a',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
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
    letterSpacing: '0.3px',
    transition: 'background 0.15s',
    marginBottom: '28px',
    fontFamily: "'Montserrat', sans-serif",
  },
  errorMsg: {
    color: '#00205B',
    fontSize: '10px',
    background: '#fff3e6',
    border: '1px solid #ffe0b2',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
  },
}

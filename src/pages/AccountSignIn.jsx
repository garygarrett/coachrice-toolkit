import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { homeFor } from '../lib/roles'
import logoImage from '../CoachRICE_White.png'
import { useLoginContent } from '../lib/loginContent'

// Sign-in for Mentor Coaches and Admins (tool-only accounts).
//   First time: enter the one-time access code, then choose an email and password.
//   Returning:  email and password. "Forgot password?" sends a reset link.
const COPY = {
  mentor: {
    title: 'Mentor Coach',
    tools: 'the Session Observation Form',
    other: 'Admin',
    codeKind: 'mentor',
  },
  admin: {
    title: 'Admin',
    tools: 'the Internal Assessor, Audio to Transcript, and Session Observation Form',
    other: 'Mentor Coach',
    codeKind: 'admin',
  },
}

export default function AccountSignIn({ kind }) {
  const copy = COPY[kind]
  const navigate = useNavigate()
  const t = useLoginContent()
  const { user, profile, loading } = useAuth()

  const [mode, setMode] = useState('returning') // returning (default) | forgot | code | account
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Once signed in (by this form or an earlier visit), go to that account's tools.
  useEffect(() => {
    if (!loading && user && profile) navigate(homeFor(profile.role), { replace: true })
  }, [user, profile, loading, navigate])

  function go(next) {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirm('')
    setResetSent(false)
  }

  async function checkCode(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/user-actions?action=code-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'That access code has already been used'
          ? 'That access code has already been used. Use the "Sign in" tab at the top with your email and password.'
          : 'That access code is not valid. Check it and try again, or ask for a new one.')
      } else if (data.role !== copy.codeKind) {
        setError(`That code is for the ${copy.other} sign-in. Go back and choose ${copy.other}.`)
      } else {
        go('account')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  async function createAccount(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Your password must be at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      const res = await fetch('/api/user-actions?action=code-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not create your account.')
        setBusy(false)
        return
      }
      await signIn(email.trim(), password)
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  async function signIn(mail, pass) {
    // A new sign-in replaces any student-code session in this tab.
    ;['coachrice_access', 'coachrice_access_role', 'coachrice_access_label', 'coachrice_access_code', 'coachrice_system_prompt'].forEach((k) => sessionStorage.removeItem(k))
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: mail, password: pass })
    if (signInError) {
      const paused = signInError.message?.toLowerCase().includes('banned')
      setError(paused
        ? 'Your account is currently paused. Please reach out to CoachRICE@rice.edu.'
        : 'Invalid email or password. Please try again.')
      setBusy(false)
    }
    // On success, the effect above sends the person to their tools.
  }

  async function returningSignIn(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    await signIn(email.trim(), password)
  }

  async function sendReset(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    })
    setBusy(false)
    if (resetError) setError(resetError.message)
    else setResetSent(true)
  }

  const onReturning = mode === 'returning' || mode === 'forgot'
  const input = (props) => <input {...props} style={s.input} />

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoImage} alt="CoachRICE" style={s.logo} />
          <div style={s.headerLabel}>{t('login_header_label')}</div>
        </div>

        <div style={s.body}>
          <div style={s.eyebrow}>{t('login_eyebrow')}</div>
          <h1 style={s.title}>{t(kind === 'mentor' ? 'login_mentor_title' : 'login_admin_title')}</h1>

          <div style={s.tabs}>
            <button type="button" onClick={() => go('returning')} style={{ ...s.tab, ...(onReturning ? s.tabOn : {}) }}>{t('login_tab_signin')}</button>
            <button type="button" onClick={() => go('code')} style={{ ...s.tab, ...(!onReturning ? s.tabOn : {}) }}>{t('login_tab_first')}</button>
          </div>

          {mode === 'code' && (
            <form onSubmit={checkCode}>
              <p style={s.subtitle}>{t('login_code_subtitle')}</p>
              <label htmlFor="code" style={s.label}>Access code</label>
              {input({ id: 'code', type: 'text', value: code, onChange: (e) => setCode(e.target.value), required: true, autoFocus: true, autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, placeholder: 'Enter your access code' })}
              {error && <div style={s.errorBox}>{error}</div>}
              <button type="submit" disabled={busy || !code.trim()} style={{ ...s.btn, opacity: busy || !code.trim() ? 0.6 : 1 }}>{busy ? 'Checking…' : 'Continue'}</button>
            </form>
          )}

          {mode === 'account' && (
            <form onSubmit={createAccount}>
              <p style={s.subtitle}>{t('login_create_subtitle')}</p>
              <label htmlFor="email" style={s.label}>Email address</label>
              {input({ id: 'email', type: 'email', value: email, onChange: (e) => setEmail(e.target.value), required: true, autoFocus: true, autoComplete: 'email', placeholder: 'you@rice.edu' })}
              <label htmlFor="pw" style={s.label}>Password (at least 8 characters)</label>
              {input({ id: 'pw', type: 'password', value: password, onChange: (e) => setPassword(e.target.value), required: true, autoComplete: 'new-password', placeholder: '••••••••••' })}
              <label htmlFor="pw2" style={s.label}>Type your password again</label>
              {input({ id: 'pw2', type: 'password', value: confirm, onChange: (e) => setConfirm(e.target.value), required: true, autoComplete: 'new-password', placeholder: '••••••••••' })}
              {error && <div style={s.errorBox}>{error}</div>}
              <button type="submit" disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating your account…' : 'Create account and sign in'}</button>
            </form>
          )}

          {mode === 'returning' && (
            <form onSubmit={returningSignIn}>
              <label htmlFor="email" style={s.label}>Email address</label>
              {input({ id: 'email', type: 'email', value: email, onChange: (e) => setEmail(e.target.value), required: true, autoFocus: true, autoComplete: 'email', placeholder: 'you@rice.edu' })}
              <label htmlFor="pw" style={s.label}>Password</label>
              {input({ id: 'pw', type: 'password', value: password, onChange: (e) => setPassword(e.target.value), required: true, autoComplete: 'current-password', placeholder: '••••••••••' })}
              {error && <div style={s.errorBox}>{error}</div>}
              <button type="submit" disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <div style={s.linkRow}>
                <button type="button" style={s.linkBtn} onClick={() => go('forgot')}>Forgot password?</button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            resetSent ? (
              <>
                <p style={s.subtitle}>If an account exists for <strong>{email}</strong>, a password reset link is on its way. Check your spam folder if you do not see it.</p>
                <button type="button" style={s.btn} onClick={() => go('returning')}>Back to sign in</button>
              </>
            ) : (
              <form onSubmit={sendReset}>
                <p style={s.subtitle}>{t('login_forgot_subtitle')}</p>
                <label htmlFor="email" style={s.label}>Email address</label>
                {input({ id: 'email', type: 'email', value: email, onChange: (e) => setEmail(e.target.value), required: true, autoFocus: true, autoComplete: 'email', placeholder: 'you@rice.edu' })}
                {error && <div style={s.errorBox}>{error}</div>}
                <button type="submit" disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending…' : 'Send reset link'}</button>
                <div style={s.linkRow}>
                  <button type="button" style={s.linkBtn} onClick={() => go('returning')}>Back to sign in</button>
                </div>
              </form>
            )
          )}

          <p style={s.helpText}>
            {t('login_help_prefix')}{' '}
            <a href={`mailto:${t('login_help_email')}`} style={s.link}>{t('login_help_email')}</a>
          </p>
          <div style={s.footerRow}>
            <button type="button" style={s.linkBtn} onClick={() => navigate('/access')}>{t('login_back_link')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", padding: '24px 16px', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,32,91,0.10)' },
  header: { background: '#00205B', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { height: '32px', width: 'auto', objectFit: 'contain' },
  headerLabel: { fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.8px', textTransform: 'uppercase' },
  body: { padding: '32px 28px 28px' },
  eyebrow: { fontSize: '10px', fontWeight: 700, color: '#69cce6', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' },
  title: { fontSize: '22px', fontWeight: 800, color: '#00205B', margin: '0 0 10px', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '12px', color: '#6b7a99', lineHeight: 1.7, margin: '0 0 22px' },
  label: { display: 'block', fontSize: '9px', fontWeight: 700, color: '#0f1c3a', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' },
  input: { width: '100%', height: '46px', borderRadius: '8px', border: '1px solid #e2e6ec', background: '#fafbfc', padding: '0 14px', fontSize: '15px', fontFamily: "'Montserrat', sans-serif", color: '#0f1c3a', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' },
  errorBox: { background: '#fff3e6', border: '1px solid #ffe0b2', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: '#00205B', marginBottom: '14px', lineHeight: 1.5 },
  btn: { width: '100%', height: '46px', borderRadius: '8px', background: '#00205B', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer', marginBottom: '12px' },
  btnAlt: { width: '100%', height: '46px', borderRadius: '8px', background: '#fff', color: '#00205B', border: '2px solid #00205B', fontSize: '13px', fontWeight: 700, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer', marginBottom: '12px' },
  tabs: { display: 'flex', gap: '6px', background: '#f0f2f5', borderRadius: '10px', padding: '4px', margin: '4px 0 22px' },
  tab: { flex: 1, height: '38px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#6b7a99', fontSize: '12px', fontWeight: 700, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' },
  tabOn: { background: '#fff', color: '#00205B', boxShadow: '0 1px 4px rgba(0,32,91,0.12)' },
  linkRow: { textAlign: 'center' },
  linkBtn: { background: 'none', border: 'none', color: '#6b7a99', fontSize: '11px', fontWeight: 600, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer', padding: 0 },
  footerRow: { textAlign: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f2f5' },
  helpText: { textAlign: 'center', fontSize: '10px', color: '#6b7a99', margin: '8px 0 0' },
  link: { color: '#00205B', fontWeight: 600, textDecoration: 'none' },
}

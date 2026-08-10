import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImage from '../CoachRICE_White.png'

export default function AccessCodeEntry() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/access-codes?action=verify&code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()

      if (data.valid) {
        sessionStorage.setItem('coachrice_access', 'granted')
        sessionStorage.setItem('coachrice_access_label', data.label || 'Guest')
        if (data.apiKey) sessionStorage.setItem('coachrice_api_key', data.apiKey)
        if (data.systemPrompt) sessionStorage.setItem('coachrice_system_prompt', data.systemPrompt)
        navigate('/access/transcript', { replace: true })
      } else {
        setError('That access code is not valid. Please check your code and try again.')
        setSubmitting(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header band */}
        <div style={s.header}>
          <img src={logoImage} alt="CoachRICE" style={s.logo} />
          <div style={s.headerLabel}>Transcript Reviewer</div>
        </div>

        {/* Body */}
        <div style={s.body}>
          <div style={s.eyebrow}>Doerr Institute for New Leaders</div>
          <h1 style={s.title}>Enter your access code</h1>
          <p style={s.subtitle}>
            Enter the access code provided by your program administrator to access
            the CoachRICE Transcript Reviewer.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="access-code" style={s.label}>ACCESS CODE</label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter your access code"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={s.input}
            />

            {error && (
              <div style={s.errorBox}>{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !code.trim()}
              style={{
                ...s.btn,
                opacity: submitting || !code.trim() ? 0.6 : 1,
                cursor: submitting || !code.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Verifying…' : 'Access Transcript Reviewer'}
            </button>
          </form>

          <p style={s.helpText}>
            Need help? Contact{' '}
            <a href="mailto:CoachRICE@rice.edu" style={s.link}>CoachRICE@rice.edu</a>
          </p>

          <div style={s.adminRow}>
            <button onClick={() => navigate('/login')} style={s.adminLink}>
              Admin sign in →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Montserrat', sans-serif",
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    background: '#fff',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,32,91,0.10)',
  },
  header: {
    background: '#00205B',
    padding: '24px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    height: '32px',
    width: 'auto',
    objectFit: 'contain',
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    fontFamily: "'Montserrat', sans-serif",
  },
  body: {
    padding: '32px 28px 28px',
  },
  eyebrow: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#69cce6',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '10px',
    fontFamily: "'Montserrat', sans-serif",
  },
  title: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#00205B',
    margin: '0 0 10px',
    letterSpacing: '-0.3px',
    fontFamily: "'Montserrat', sans-serif",
  },
  subtitle: {
    fontSize: '12px',
    color: '#6b7a99',
    lineHeight: '1.7',
    margin: '0 0 28px',
    fontFamily: "'Montserrat', sans-serif",
  },
  label: {
    display: 'block',
    fontSize: '9px',
    fontWeight: '700',
    color: '#0f1c3a',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    marginBottom: '6px',
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%',
    height: '46px',
    borderRadius: '8px',
    border: '1px solid #e2e6ec',
    background: '#fafbfc',
    padding: '0 14px',
    fontSize: '15px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#0f1c3a',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '16px',
    letterSpacing: '0.5px',
  },
  errorBox: {
    background: '#fff3e6',
    border: '1px solid #ffe0b2',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '11px',
    color: '#00205B',
    marginBottom: '14px',
    lineHeight: '1.5',
    fontFamily: "'Montserrat', sans-serif",
  },
  btn: {
    width: '100%',
    height: '46px',
    borderRadius: '8px',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: '0.3px',
    marginBottom: '20px',
    transition: 'background 0.15s',
  },
  helpText: {
    textAlign: 'center',
    fontSize: '10px',
    color: '#6b7a99',
    margin: 0,
    fontFamily: "'Montserrat', sans-serif",
  },
  link: {
    color: '#00205B',
    fontWeight: '600',
    textDecoration: 'none',
  },
  adminRow: {
    textAlign: 'center',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f0f2f5',
  },
  adminLink: {
    background: 'none',
    border: 'none',
    color: '#6b7a99',
    fontSize: '10px',
    fontWeight: '600',
    fontFamily: "'Montserrat', sans-serif",
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.3px',
  },
}

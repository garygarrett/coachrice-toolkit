import { useNavigate } from 'react-router-dom'
import logoImage from '../CoachRICE_White.png'
import { useLoginContent } from '../lib/loginContent'

// Simple line icons in Doerr navy.
const ICON = { fill: 'none', stroke: '#00205B', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
function DoorIcon({ kind }) {
  const common = { width: 44, height: 44, viewBox: '0 0 24 24', style: ICON, 'aria-hidden': true }
  if (kind === 'student') {
    // graduation cap
    return (
      <svg {...common}>
        <path d="M2 9 L12 4 L22 9 L12 14 Z" />
        <path d="M6 11.5 V16 C6 17.5 8.7 19 12 19 C15.3 19 18 17.5 18 16 V11.5" />
        <path d="M22 9 V14" />
      </svg>
    )
  }
  if (kind === 'mentor') {
    // clipboard with check
    return (
      <svg {...common}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4 V3 H15 V4 V5.5 H9 Z" />
        <path d="M8.5 13 L11 15.5 L15.5 10.5" />
      </svg>
    )
  }
  // admin: shield with check
  return (
    <svg {...common}>
      <path d="M12 3 L20 6 V12 C20 16.5 16.5 19.8 12 21 C7.5 19.8 4 16.5 4 12 V6 Z" />
      <path d="M8.5 12 L11 14.5 L15.5 9.5" />
    </svg>
  )
}

// The home sign-in page: three doors, one for each kind of person.
const DOORS = [
  {
    path: '/access/student',
    titleKey: 'login_door_student',
    icon: 'student',
    accent: '#69cce6',
  },
  {
    path: '/access/mentor',
    titleKey: 'login_door_mentor',
    icon: 'mentor',
    accent: '#78b3e0',
  },
  {
    path: '/access/admin',
    titleKey: 'login_door_admin',
    icon: 'admin',
    accent: '#ff8200',
  },
]

export default function LoginHome() {
  const navigate = useNavigate()
  const t = useLoginContent()

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoImage} alt="CoachRICE" style={s.logo} />
          <div style={s.headerLabel}>{t('login_header_label')}</div>
        </div>

        <div style={s.body}>
          <div style={s.eyebrow}>{t('login_eyebrow')}</div>
          <h1 style={s.title}>{t('login_home_title')}</h1>
          <p style={s.subtitle}>{t('login_home_subtitle')}</p>

          <div style={s.doors}>
            {DOORS.map((d) => (
              <button key={d.path} type="button" onClick={() => navigate(d.path)} style={{ ...s.door, borderTopColor: d.accent }}>
                <DoorIcon kind={d.icon} />
                <div style={s.doorTitle}>{t(d.titleKey)}</div>
              </button>
            ))}
          </div>

          <p style={s.helpText}>
            {t('login_help_prefix')}{' '}
            <a href={`mailto:${t('login_help_email')}`} style={s.link}>{t('login_help_email')}</a>
          </p>

        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", padding: '24px 16px', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: '720px', background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,32,91,0.10)' },
  header: { background: '#00205B', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { height: '32px', width: 'auto', objectFit: 'contain' },
  headerLabel: { fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.8px', textTransform: 'uppercase' },
  body: { padding: '32px 28px 28px' },
  eyebrow: { fontSize: '10px', fontWeight: 700, color: '#69cce6', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' },
  title: { fontSize: '24px', fontWeight: 800, color: '#00205B', margin: '0 0 8px', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '13px', color: '#6b7a99', lineHeight: 1.7, margin: '0 0 24px' },
  doors: { display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' },
  door: { flex: '1 1 190px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '14px', background: '#fafbfc', border: '1px solid #e2e6ec', borderTop: '4px solid #00205B', borderRadius: '10px', padding: '30px 16px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" },
  doorTitle: { fontSize: '16px', fontWeight: 800, color: '#00205B' },
  helpText: { textAlign: 'center', fontSize: '10px', color: '#6b7a99', margin: 0 },
  link: { color: '#00205B', fontWeight: 600, textDecoration: 'none' },
}

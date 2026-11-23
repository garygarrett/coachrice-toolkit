import { useNavigate } from 'react-router-dom'
import logoImage from '../CoachRICE_White.png'
import { useLoginContent } from '../lib/loginContent'

// The home sign-in page: three doors, one for each kind of person.
const DOORS = [
  { path: '/access/student', titleKey: 'login_door_student' },
  { path: '/access/mentor', titleKey: 'login_door_mentor' },
  { path: '/access/admin', titleKey: 'login_door_admin' },
]

export default function LoginHome() {
  const navigate = useNavigate()
  const t = useLoginContent()

  return (
    <div style={s.page}>
      <aside style={s.panel}>
        <img src={logoImage} alt="CoachRICE" style={s.logo} />
        <div>
          <div style={s.org}>{t('login_eyebrow')}</div>
          <div style={s.tagline}>{t('login_header_label')}</div>
        </div>
      </aside>
      <main style={s.main}>
        <div style={s.body}>
          <h1 style={s.title}>{t('login_home_title')}</h1>
          <p style={s.subtitle}>{t('login_home_subtitle')}</p>

          <div style={s.doors}>
            {DOORS.map((d) => (
              <button key={d.path} type="button" onClick={() => navigate(d.path)} style={s.door}>
                <span style={s.doorTitle}>{t(d.titleKey)}</span>
                <span aria-hidden="true" style={s.chev}>&rsaquo;</span>
              </button>
            ))}
          </div>

          <p style={s.helpText}>
            {t('login_help_prefix')}{' '}
            <a href={`mailto:${t('login_help_email')}`} style={s.link}>{t('login_help_email')}</a>
          </p>
        </div>
      </main>
    </div>
  )
}

const FONT = "Montserrat, Arial, sans-serif"
const s = {
  page: { minHeight: '100vh', display: 'flex', flexWrap: 'wrap', fontFamily: FONT, background: '#fff' },
  panel: { flex: '1 1 340px', maxWidth: 560, background: '#00205B', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 48, color: '#fff' },
  logo: { height: 40, width: 'auto', objectFit: 'contain', alignSelf: 'flex-start' },
  org: { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  tagline: { fontSize: 28, fontWeight: 700, lineHeight: 1.25, maxWidth: 360 },
  main: { flex: '2 1 400px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' },
  body: { width: '100%', maxWidth: 440 },
  title: { fontSize: 28, fontWeight: 700, color: '#00205B', margin: '0 0 8px', lineHeight: 1.25 },
  subtitle: { fontSize: 15, color: '#5b6785', lineHeight: 1.6, margin: '0 0 32px' },
  doors: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 },
  door: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, background: '#fff', border: '1px solid #00205B', borderRadius: 4, padding: '0 20px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' },
  doorTitle: { fontSize: 16, fontWeight: 700, color: '#00205B' },
  chev: { fontSize: 24, color: '#00205B', lineHeight: 1 },
  helpText: { fontSize: 13, color: '#5b6785', margin: 0, lineHeight: 1.6 },
  link: { color: '#00205B', fontWeight: 600 },
}

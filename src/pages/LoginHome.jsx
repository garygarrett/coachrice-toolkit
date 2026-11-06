import { useNavigate } from 'react-router-dom'
import logoImage from '../CoachRICE_White.png'

// The home sign-in page: three doors, one for each kind of person.
const DOORS = [
  {
    path: '/access/student',
    title: 'Student',
    accent: '#69cce6',
  },
  {
    path: '/access/mentor',
    title: 'Mentor Coach',
    accent: '#78b3e0',
  },
  {
    path: '/access/admin',
    title: 'Admin',
    accent: '#ff8200',
  },
]

export default function LoginHome() {
  const navigate = useNavigate()

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoImage} alt="CoachRICE" style={s.logo} />
          <div style={s.headerLabel}>CoachRICE Toolkit</div>
        </div>

        <div style={s.body}>
          <div style={s.eyebrow}>Doerr Institute for New Leaders</div>
          <h1 style={s.title}>Welcome. Who is signing in?</h1>
          <p style={s.subtitle}>Choose the option that describes you.</p>

          <div style={s.doors}>
            {DOORS.map((d) => (
              <button key={d.path} type="button" onClick={() => navigate(d.path)} style={{ ...s.door, borderTopColor: d.accent }}>
                <div style={s.doorTitle}>{d.title}</div>
              </button>
            ))}
          </div>

          <p style={s.helpText}>
            Need help? Contact{' '}
            <a href="mailto:CoachRICE@rice.edu" style={s.link}>CoachRICE@rice.edu</a>
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
  door: { flex: '1 1 190px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left', background: '#fafbfc', border: '1px solid #e2e6ec', borderTop: '4px solid #00205B', borderRadius: '10px', padding: '28px 16px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" },
  doorTitle: { fontSize: '16px', fontWeight: 800, color: '#00205B', marginBottom: '8px' },
  helpText: { textAlign: 'center', fontSize: '10px', color: '#6b7a99', margin: 0 },
  link: { color: '#00205B', fontWeight: 600, textDecoration: 'none' },
}

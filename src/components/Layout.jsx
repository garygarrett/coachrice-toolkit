import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVisibility } from '../context/VisibilityContext'
import logo from '../CoachRICE_White.png'

const COLORS = {
  navy: '#00205B',
  teal: '#69cce6',
  gray: '#7C7E7F',
  'gray-light': '#f0f2f5',
  'gray-border': '#e2e6ec',
  white: '#ffffff',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
}

function ToolIcon({ id, size = 16, color = 'currentColor' }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const icons = {
    dashboard: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
    history: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <circle cx="8" cy="8" r="6.5" />
        <polyline points="8,4.5 8,8 10.5,9.5" />
      </svg>
    ),
    exam: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <path d="M11 2 L14 5 L5 14 L2 14 L2 11 Z" />
        <line x1="9" y1="4" x2="12" y2="7" />
      </svg>
    ),
    transcript: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <rect x="2.5" y="1" width="11" height="14" rx="1.5" />
        <line x1="5" y1="5" x2="11" y2="5" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="11" x2="9" y2="11" />
      </svg>
    ),
    ai: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <rect x="2.5" y="5.5" width="11" height="8" rx="2" />
        <circle cx="5.5" cy="9.5" r="1" />
        <circle cx="10.5" cy="9.5" r="1" />
        <line x1="8" y1="3" x2="8" y2="5.5" />
        <circle cx="8" cy="2" r="1" />
      </svg>
    ),
    audio: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <rect x="5.5" y="1" width="5" height="8" rx="2.5" />
        <path d="M2.5 8.5c0 3 2.5 5 5.5 5s5.5-2 5.5-5" />
        <line x1="8" y1="13.5" x2="8" y2="15" />
      </svg>
    ),
  }
  return icons[id] || null
}

export default function Layout({ children, active = 'dashboard', pageTitle = 'Dashboard' }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const visibility = useVisibility() ?? { exam: true, transcript: true, ai: true, audio: true }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history', label: 'History' },
  ]
  const allToolItems = [
    { id: 'exam', label: 'ACC Practice Exam', path: '/tools/exam' },
    { id: 'transcript', label: 'Transcript Reviewer', path: '/tools/transcript' },
    { id: 'ai', label: 'AI Client', path: '/tools/ai' },
    { id: 'audio', label: 'Audio to Transcript', path: '/tools/audio' },
  ]
  const isAdmin = profile?.role === 'admin'
  const toolItems = isAdmin ? allToolItems : allToolItems.filter(tool => visibility[tool.id])

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="CoachRICE" style={{ height: 36, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
        </div>
        <div style={styles.nav}>
          <div style={styles.navLabel}>General</div>
          {navItems.map(n => (
            <div key={n.id} style={{ ...styles.navItem, ...(active === n.id ? styles.navItemActive : {}), cursor: 'pointer' }} onClick={() => navigate(n.id === 'dashboard' ? '/dashboard' : '/history')}>
              <ToolIcon id={n.id} size={14} color={active === n.id ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
              <span>{n.label}</span>
            </div>
          ))}
          <div style={styles.navDivider}></div>
          <div style={styles.navLabel}>Toolkit</div>
          {toolItems.map(n => (
            <div
              key={n.id}
              style={{ ...styles.navItem, ...(active === n.id ? styles.navItemActive : {}), cursor: 'pointer' }}
              onClick={() => navigate(n.path)}
            >
              <ToolIcon id={n.id} size={14} color={active === n.id ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
              <span style={{ fontSize: 10 }}>{n.label}</span>
            </div>
          ))}
          {isAdmin && (
            <>
              <div style={styles.navDivider}></div>
              <div style={styles.navLabel}>Admin</div>
              <div style={{ ...styles.navItem, ...(active === 'admin' ? styles.navItemActive : {}), cursor: 'pointer' }} onClick={() => navigate('/admin')}>
                <ToolIcon id="dashboard" size={14} color={active === 'admin' ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
                <span>Dashboard</span>
              </div>
              <div style={{ ...styles.navItem, ...(active === 'admin-history' ? styles.navItemActive : {}), cursor: 'pointer' }} onClick={() => navigate('/admin')}>
                <ToolIcon id="history" size={14} color={active === 'admin-history' ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
                <span>History</span>
              </div>
              <div style={styles.navDivider}></div>
              <div style={styles.navLabel}>Assessor</div>
              <div style={{ ...styles.navItem, ...(active === 'assessor' ? styles.navItemActive : {}), cursor: 'pointer' }} onClick={() => navigate('/tools/assessor')}>
                <ToolIcon id="transcript" size={14} color={active === 'assessor' ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
                <span style={{ fontSize: 10 }}>Internal Assessor</span>
              </div>
            </>
          )}
        </div>
        <div style={styles.avatarRow}>
          <div style={styles.avatar}>{profile?.full_name?.[0] || 'C'}</div>
          <div>
            <div style={styles.avatarName}>{profile?.full_name?.split(' ')[0] || 'Coach'}</div>
            <div style={styles.avatarRole}>
              <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9, cursor: 'pointer', padding: 0, fontFamily: 'Montserrat, sans-serif' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={styles.mainWrapper}>
        <div style={styles.topbar}>
          <span>{pageTitle}</span>
        </div>
        <div style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    fontFamily: 'Montserrat, sans-serif',
    overflow: 'hidden',
    background: COLORS['gray-light'],
  },
  sidebar: {
    width: 220,
    background: COLORS.navy,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoArea: {
    padding: '20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  nav: {
    padding: '14px 0',
    flex: 1,
    overflowY: 'auto',
  },
  navLabel: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.3)',
    padding: '12px 18px 6px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 18px',
    fontSize: 11,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    transition: 'all 0.2s',
  },
  navItemActive: {
    color: '#fff',
    background: 'rgba(105,204,230,0.1)',
    borderLeftColor: COLORS.teal,
    fontWeight: 600,
  },
  navDivider: {
    height: 1,
    margin: '6px 18px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  avatarRow: {
    padding: '14px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: COLORS.teal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    color: COLORS.navy,
    flexShrink: 0,
  },
  avatarName: {
    fontSize: 10,
    fontWeight: 600,
    color: '#fff',
  },
  avatarRole: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topbar: {
    height: 50,
    background: '#fff',
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 32px',
    fontSize: 12,
    fontWeight: 700,
    color: COLORS['text-main'],
    flexShrink: 0,
  },
  content: {
    padding: '28px 32px',
    flex: 1,
    background: COLORS['gray-light'],
    overflowY: 'auto',
  },
}

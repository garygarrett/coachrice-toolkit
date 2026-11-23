import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVisibility } from '../context/VisibilityContext'
import { isToolOnlyRole } from '../lib/roles'
import { useGuideAvailable } from '../lib/guideAvailability'
import logo from '../CoachRICE_White.png'
import { COLORS, FONT } from '../theme'

export default function Layout({ children, active = 'dashboard', pageTitle = 'Dashboard' }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const visibility = useVisibility() ?? { exam: true, transcript: true, ai: true }
  const hasGuide = useGuideAvailable(profile) // the FAQ / Guide link shows only when this account has a section to read

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history', label: 'History' },
  ]
  const allToolItems = [
    { id: 'exam', label: 'ACC Practice Exam', path: '/tools/exam' },
    { id: 'transcript', label: 'Transcript Reviewer', path: '/tools/transcript' },
    { id: 'ai', label: 'AI Client', path: '/tools/ai' },
  ]
  const isAdmin = profile?.role === 'admin'

  // Mentor coaches and tool-only admins have accounts, but they only see their tools (no dashboard or history).
  const isCode = isToolOnlyRole(profile?.role)
  const codeRole = profile?.role === 'admin_tools' ? 'admin' : 'mentor'
  const codeLabel = profile?.full_name || profile?.email || ''
  const codeTools = [
    ...(codeRole === 'admin' ? [{ id: 'assessor', label: 'Internal Assessor', path: '/tools/assessor' }] : []),
    ...(codeRole === 'admin' ? [{ id: 'audio', label: 'Audio to Transcript', path: '/tools/audio' }] : []),
    { id: 'observation', label: 'SOF/CRF', path: '/tools/session-observation' },
  ]
  const toolItems = isCode ? codeTools : isAdmin ? allToolItems : allToolItems.filter(tool => visibility[tool.id])

  // Full admins see every tool, grouped by who it is for, then the Admin Tools pages.
  const adminGroups = [
    { label: 'Student', items: [{ id: 'transcript', label: 'Transcript Reviewer', path: '/tools/transcript', icon: 'transcript' }] },
    { label: 'Mentor Coach', items: [{ id: 'observation', label: 'SOF/CRF', path: '/tools/session-observation', icon: 'transcript' }] },
    { label: 'Admin', items: [
      { id: 'assessor', label: 'Internal Assessor', path: '/tools/assessor', icon: 'transcript' },
      { id: 'audio', label: 'Audio to Transcript', path: '/tools/audio', icon: 'transcript' },
    ] },
    { label: 'In progress', items: [
      { id: 'exam', label: 'ACC Practice Exam', path: '/tools/exam', icon: 'exam' },
      { id: 'ai', label: 'AI Client', path: '/tools/ai', icon: 'ai' },
    ] },
    { label: 'Admin Tools', items: [
      { id: 'admin-users', label: 'Users / Access Codes', path: '/admin', icon: 'users' },
      { id: 'admin-history', label: 'History / Data', path: '/admin/history', icon: 'history' },
      { id: 'admin-config', label: 'Tool Configuration', path: '/admin/config', icon: 'settings' },
      { id: 'guide', label: 'FAQ / Guide', path: '/guide', icon: 'help' },
    ] },
  ]

  const NavItem = ({ n }) => {
    const on = active === n.id
    return (
      <button
        type="button"
        aria-current={on ? 'page' : undefined}
        style={{ ...styles.navItem, ...(on ? styles.navItemActive : {}) }}
        onClick={() => navigate(n.path)}
      >
        {n.label}
      </button>
    )
  }
  const Group = ({ label, items }) => (
    <div style={styles.group}>
      <div style={styles.navLabel}>{label}</div>
      {items.map(n => <NavItem key={n.id} n={n} />)}
    </div>
  )

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar} aria-label="Main">
        <div style={styles.logoArea}>
          <img src={logo} alt="CoachRICE" style={{ height: 34, width: 'auto', maxWidth: 150, objectFit: 'contain' }} />
        </div>
        <div style={styles.nav}>
          {isAdmin && adminGroups.map(g => <Group key={g.label} label={g.label} items={g.items} />)}
          {!isAdmin && !isCode && (
            <Group label="General" items={navItems.map(n => ({ ...n, path: n.id === 'dashboard' ? '/dashboard' : '/history' }))} />
          )}
          {!isAdmin && (
            <Group label={isCode ? (codeRole === 'admin' ? 'Admin tools' : 'Mentor coach tools') : 'Toolkit'} items={toolItems} />
          )}
          {!isAdmin && hasGuide && <Group label="Help" items={[{ id: 'guide', label: 'FAQ / Guide', path: '/guide' }]} />}
        </div>
        <div style={styles.avatarRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.avatarName}>{isCode ? (codeLabel || 'Account') : (profile?.full_name?.split(' ')[0] || 'Coach')}</div>
            <button type="button" onClick={signOut} style={styles.signOut}>Sign out</button>
          </div>
        </div>
      </nav>
      <div style={styles.mainWrapper}>
        <header style={styles.topbar}>
          <h1 style={styles.pageTitle}>{pageTitle}</h1>
        </header>
        <main style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', height: '100vh', width: '100vw', fontFamily: FONT, overflow: 'hidden', background: '#fff' },
  sidebar: { width: 248, background: COLORS.navy, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  logoArea: { padding: '24px 24px 20px', display: 'flex', alignItems: 'center' },
  nav: { padding: '4px 0 16px', flex: 1, overflowY: 'auto' },
  group: { marginBottom: 20 },
  navLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.62)', padding: '8px 24px 6px' },
  navItem: {
    display: 'block', width: '100%', textAlign: 'left', minHeight: 40, padding: '9px 24px 9px 21px',
    fontFamily: FONT, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)',
    background: 'transparent', border: 'none', borderLeft: '3px solid transparent', cursor: 'pointer',
  },
  navItemActive: { color: '#fff', fontWeight: 700, background: 'rgba(255,255,255,0.08)', borderLeftColor: COLORS.orange },
  avatarRow: { padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.14)' },
  avatarName: { fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  signOut: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', padding: '4px 0', minHeight: 24, fontFamily: FONT, textDecoration: 'underline' },
  mainWrapper: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  topbar: { background: '#fff', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', alignItems: 'center', padding: '18px 40px', flexShrink: 0 },
  pageTitle: { fontSize: 20, fontWeight: 700, color: COLORS.navy, margin: 0, lineHeight: 1.3 },
  content: { flex: 1, background: COLORS.wash, overflowY: 'auto', padding: '32px 40px' },
}

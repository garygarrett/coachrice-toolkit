import { useAuth } from '../context/AuthContext'

export default function CoachDashboard() {
  const { profile, signOut } = useAuth()

  return (
    <main style={s.page}>
      <header style={s.header}>
        <span style={s.name}>{profile?.full_name ?? 'Coach'}</span>
        <button onClick={signOut} style={s.signOut}>Sign Out</button>
      </header>
      <h1 style={s.heading}>Coach Dashboard</h1>
      <p style={s.sub}>Your tools and progress will appear here.</p>
    </main>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  name: {
    fontWeight: '600',
    color: '#00205B',
  },
  signOut: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '0.4rem 0.9rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    color: '#555',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#00205B',
    marginBottom: '0.5rem',
  },
  sub: {
    color: '#666',
    fontSize: '0.95rem',
  },
}

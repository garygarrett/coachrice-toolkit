import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const DEFAULTS = {
  exam_card_tag:         'Exam Prep',
  exam_card_title:       'ACC Practice Exam',
  exam_card_description: '10 scenario-based questions across all 9 ICF competencies. Get a personalized score report and AI feedback.',
}

export default function CoachDashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [content, setContent] = useState(DEFAULTS)

  useEffect(() => {
    supabase
      .from('site_content')
      .select('key, value')
      .in('key', Object.keys(DEFAULTS))
      .then(({ data }) => {
        if (data?.length) {
          const map = {}
          data.forEach(row => { map[row.key] = row.value })
          setContent(prev => ({ ...prev, ...map }))
        }
      })
  }, [])

  return (
    <main style={s.page}>
      <header style={s.header}>
        <span style={s.name}>{profile?.full_name ?? 'Coach'}</span>
        <button onClick={signOut} style={s.signOut}>Sign Out</button>
      </header>

      <h1 style={s.heading}>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
      <p style={s.sub}>Doerr Institute · CoachRICE Toolkit</p>

      <h2 style={s.sectionTitle}>Tools</h2>
      <div style={s.grid}>
        <button onClick={() => navigate('/tools/exam')} style={s.toolCard}>
          <span style={s.toolTag}>{content.exam_card_tag}</span>
          <p style={s.toolTitle}>{content.exam_card_title}</p>
          <p style={s.toolDesc}>{content.exam_card_description}</p>
          <span style={s.toolArrow}>Start →</span>
        </button>
      </div>
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
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#00205B',
    marginBottom: '0.25rem',
  },
  sub: {
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '2.5rem',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  toolCard: {
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '1.5rem',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  toolTag: {
    display: 'inline-block',
    background: '#e8ecf5',
    color: '#00205B',
    fontSize: '0.7rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    marginBottom: '0.25rem',
  },
  toolTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#00205B',
    margin: 0,
  },
  toolDesc: {
    fontSize: '0.83rem',
    color: '#555',
    lineHeight: '1.55',
    margin: 0,
  },
  toolArrow: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#00205B',
    marginTop: '0.5rem',
  },
}

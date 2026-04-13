import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  full_name: '',
  email: '',
  role: 'coach',
  cohort_id: '',
  mentor_coach_id: '',
}

export default function AdminPanel() {
  const { profile, signOut } = useAuth()
  const [users, setUsers] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [mentorCoaches, setMentorCoaches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: usersData }, { data: cohortsData }, { data: mentorData }] =
      await Promise.all([
        supabase
          .from('users')
          .select('*, cohorts(name), mentor_coaches(full_name)')
          .order('created_at', { ascending: false }),
        supabase.from('cohorts').select('*').order('name'),
        supabase.from('mentor_coaches').select('*').order('full_name'),
      ])
    if (usersData) setUsers(usersData)
    if (cohortsData) setCohorts(cohortsData)
    if (mentorData) setMentorCoaches(mentorData)
  }

  function openForm() {
    setForm(EMPTY_FORM)
    setError(null)
    setSuccessMsg(null)
    setShowForm(true)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    setSuccessMsg(`Invite sent to ${form.email}.`)
    setShowForm(false)
    await loadData()
    setSubmitting(false)
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        <span style={s.adminName}>{profile?.full_name ?? 'Admin'}</span>
        <button onClick={signOut} style={s.signOutBtn}>Sign Out</button>
      </header>

      <div style={s.content}>
        <div style={s.titleRow}>
          <h1 style={s.heading}>Users</h1>
          {!showForm && (
            <button onClick={openForm} style={s.addBtn}>+ Add User</button>
          )}
        </div>

        {successMsg && <p style={s.successBanner}>{successMsg}</p>}

        {showForm && (
          <div style={s.formCard}>
            <h2 style={s.formHeading}>Invite New User</h2>
            <form onSubmit={handleSubmit}>
              <div style={s.formGrid}>
                <label style={s.label}>
                  Full Name
                  <input
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                    style={s.input}
                    placeholder="Jane Smith"
                  />
                </label>
                <label style={s.label}>
                  Email
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    style={s.input}
                    placeholder="jane@rice.edu"
                  />
                </label>
                <label style={s.label}>
                  Role
                  <select name="role" value={form.role} onChange={handleChange} style={s.input}>
                    <option value="coach">Participant</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label style={s.label}>
                  Cohort
                  <select name="cohort_id" value={form.cohort_id} onChange={handleChange} style={s.input}>
                    <option value="">— None —</option>
                    {cohorts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label style={s.label}>
                  Mentor Coach
                  <select name="mentor_coach_id" value={form.mentor_coach_id} onChange={handleChange} style={s.input}>
                    <option value="">— None —</option>
                    {mentorCoaches.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {error && <p style={s.errorMsg}>{error}</p>}

              <div style={s.formActions}>
                <button type="button" onClick={() => setShowForm(false)} style={s.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} style={s.submitBtn}>
                  {submitting ? 'Sending invite…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        )}

        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Cohort</th>
              <th style={s.th}>Mentor Coach</th>
              <th style={s.th}>Added</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={s.trBody}>
                <td style={s.td}>{u.full_name}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>
                  <span style={u.role === 'admin' ? s.badgeAdmin : s.badgeCoach}>
                    {u.role === 'admin' ? 'Admin' : 'Participant'}
                  </span>
                </td>
                <td style={s.td}>{u.cohorts?.name ?? '—'}</td>
                <td style={s.td}>{u.mentor_coaches?.full_name ?? '—'}</td>
                <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#999' }}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  adminName: {
    fontWeight: '600',
    color: '#00205B',
    fontSize: '0.95rem',
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '0.4rem 0.9rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    color: '#555',
  },
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#00205B',
  },
  addBtn: {
    background: '#00205B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.55rem 1.1rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  successBanner: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  },
  formCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '1.75rem',
    marginBottom: '1.75rem',
  },
  formHeading: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#00205B',
    marginBottom: '1.25rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    color: '#111',
    background: '#fff',
    outline: 'none',
  },
  errorMsg: {
    color: '#b91c1c',
    fontSize: '0.875rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    marginBottom: '1rem',
  },
  formActions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '0.6rem 1.2rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: '#555',
  },
  submitBtn: {
    background: '#00205B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.4rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.85rem 1rem',
    background: '#f9fafb',
    color: '#6b7280',
    fontWeight: '600',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #e5e7eb',
  },
  trBody: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '0.85rem 1rem',
    color: '#374151',
    verticalAlign: 'middle',
  },
  badgeCoach: {
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: '4px',
    padding: '0.2rem 0.55rem',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  badgeAdmin: {
    background: '#faf5ff',
    color: '#7e22ce',
    borderRadius: '4px',
    padding: '0.2rem 0.55rem',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
}

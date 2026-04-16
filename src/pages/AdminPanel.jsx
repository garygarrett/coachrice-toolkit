import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const COMPETENCIES = [
  'Demonstrates Ethical Practice',
  'Embodies a Coaching Mindset',
  'Establishes and Maintains Agreements',
  'Cultivates Trust and Safety',
  'Maintains Presence',
  'Listens Actively',
  'Evokes Awareness',
  'Facilitates Client Growth',
  'ICF Code of Ethics',
]

const EMPTY_USER_FORM = {
  full_name: '',
  email: '',
  role: 'coach',
  cohort_id: '',
  mentor_coach_id: '',
}

const EMPTY_QUESTION = {
  competency: COMPETENCIES[0],
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct: 'A',
  explanation: '',
  is_active: true,
}

const FONT_OPTIONS = [
  { label: 'System Default (sans-serif)',  value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter',                        value: "'Inter', system-ui, sans-serif" },
  { label: 'Lato',                         value: "'Lato', system-ui, sans-serif" },
  { label: 'Source Sans 3',               value: "'Source Sans 3', system-ui, sans-serif" },
  { label: 'Merriweather (serif)',         value: "'Merriweather', Georgia, serif" },
  { label: 'Georgia (serif)',              value: "Georgia, 'Times New Roman', serif" },
]

// Content fields shown in the Content tab, grouped by section
const CONTENT_FIELDS = [
  {
    section: 'Theme & Branding',
    description: 'Colors and typography applied across all participant-facing pages.',
    keys: [
      { key: 'theme_primary_color', label: 'Primary Color',   type: 'color' },
      { key: 'theme_page_bg',       label: 'Page Background', type: 'color' },
      { key: 'theme_font_family',   label: 'Font',            type: 'font'  },
    ],
  },
  {
    section: 'Dashboard — Exam Tool Card',
    description: 'The card participants see on their dashboard.',
    keys: [
      { key: 'exam_card_tag',         label: 'Tag (small label above title)', type: 'text' },
      { key: 'exam_card_title',       label: 'Title',                         type: 'text' },
      { key: 'exam_card_description', label: 'Description',                   type: 'textarea' },
    ],
  },
  {
    section: 'Exam — Start Screen',
    description: 'Text shown before the participant begins the exam.',
    keys: [
      { key: 'exam_start_badge',    label: 'Badge (small label at top)', type: 'text'     },
      { key: 'exam_start_title',    label: 'Title',                      type: 'text'     },
      { key: 'exam_start_subtitle', label: 'Subtitle paragraph',         type: 'textarea' },
      { key: 'exam_start_info_1',   label: 'Bullet 1',                   type: 'text'     },
      { key: 'exam_start_info_2',   label: 'Bullet 2',                   type: 'text'     },
      { key: 'exam_start_info_3',   label: 'Bullet 3',                   type: 'text'     },
    ],
  },
]

export default function AdminPanel() {
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  // ── Users state ──
  const [users, setUsers] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [mentorCoaches, setMentorCoaches] = useState([])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_USER_FORM)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editUserForm, setEditUserForm] = useState({})
  const [editUserSubmitting, setEditUserSubmitting] = useState(false)
  const [editUserError, setEditUserError] = useState(null)
  const [userError, setUserError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // ── Questions state ──
  const [questions, setQuestions] = useState([])
  const [qFilter, setQFilter] = useState('')
  const [qSearch, setQSearch] = useState('')
  const [editingQuestion, setEditingQuestion] = useState(null) // null = closed, 'new' = add form, id = edit form
  const [qForm, setQForm] = useState(EMPTY_QUESTION)
  const [qSubmitting, setQSubmitting] = useState(false)
  const [qError, setQError] = useState(null)
  const [qSuccess, setQSuccess] = useState(null)

  // ── Content state ──
  const [contentValues, setContentValues] = useState({})
  const [contentSaving, setContentSaving] = useState(false)
  const [contentSuccess, setContentSuccess] = useState(null)
  const [contentError, setContentError] = useState(null)

  // ── Rubrics state ──
  const [rubricsData, setRubricsData] = useState([])
  const [rubricEdits, setRubricEdits] = useState({}) // id → { exceeds_standard, meets_standard, below_standard, does_not_meet }
  const [rubricSaving, setRubricSaving] = useState(false)
  const [rubricSuccess, setRubricSuccess] = useState(null)
  const [rubricError, setRubricError] = useState(null)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { if (activeTab === 'questions') loadQuestions() }, [activeTab])
  useEffect(() => { if (activeTab === 'content') loadContent() }, [activeTab])
  useEffect(() => { if (activeTab === 'rubrics') loadRubrics() }, [activeTab])

  async function loadUsers() {
    const [{ data: usersData }, { data: cohortsData }, { data: mentorData }] =
      await Promise.all([
        supabase.from('users').select('*, cohorts(name), mentor_coaches(full_name)').order('created_at', { ascending: false }),
        supabase.from('cohorts').select('*').order('name'),
        supabase.from('mentor_coaches').select('*').order('full_name'),
      ])
    if (usersData) setUsers(usersData)
    if (cohortsData) setCohorts(cohortsData)
    if (mentorData) setMentorCoaches(mentorData)
  }

  async function loadQuestions() {
    const { data } = await supabase.from('questions').select('*').order('id')
    if (data) setQuestions(data)
  }

  async function loadRubrics() {
    const { data } = await supabase.from('rubrics').select('*').order('sort_order')
    if (data) {
      setRubricsData(data)
      const edits = {}
      data.forEach(r => {
        edits[r.id] = {
          exceeds_standard: r.exceeds_standard ?? '',
          meets_standard:   r.meets_standard   ?? '',
          below_standard:   r.below_standard   ?? '',
          does_not_meet:    r.does_not_meet     ?? '',
        }
      })
      setRubricEdits(edits)
    }
  }

  async function handleRubricSave() {
    setRubricSaving(true)
    setRubricError(null)
    setRubricSuccess(null)

    const nonQualifiers = rubricsData.filter(r => !r.is_qualifier)
    let errorMsg = null

    for (const r of nonQualifiers) {
      const edits = rubricEdits[r.id] ?? {}
      const { error } = await supabase.from('rubrics').update({
        exceeds_standard: edits.exceeds_standard,
        meets_standard:   edits.meets_standard,
        below_standard:   edits.below_standard,
        does_not_meet:    edits.does_not_meet,
      }).eq('id', r.id)
      if (error) { errorMsg = error.message; break }
    }

    if (errorMsg) {
      setRubricError(errorMsg)
    } else {
      setRubricSuccess('Scoring rubrics saved successfully.')
    }
    setRubricSaving(false)
  }

  async function loadContent() {
    const { data } = await supabase.from('site_content').select('key, value')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.key] = row.value })
      setContentValues(map)
    }
  }

  async function handleContentSave() {
    setContentSaving(true)
    setContentError(null)
    setContentSuccess(null)

    const allKeys = CONTENT_FIELDS.flatMap(g => g.keys.map(f => f.key))
    const upsertRows = allKeys.map(key => ({ key, value: contentValues[key] ?? '' }))

    const { error } = await supabase
      .from('site_content')
      .upsert(upsertRows, { onConflict: 'key' })

    if (error) {
      setContentError(error.message)
    } else {
      setContentSuccess('Content saved successfully.')
    }
    setContentSaving(false)
  }

  // ── User handlers ──
  function handleInviteChange(e) {
    setInviteForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setUserError(null)
    setInviteSubmitting(true)
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    })
    const result = await res.json()
    if (!res.ok) {
      setUserError(result.error ?? 'Something went wrong.')
      setInviteSubmitting(false)
      return
    }
    setSuccessMsg(`Invite sent to ${inviteForm.email}.`)
    setShowInviteForm(false)
    setInviteForm(EMPTY_USER_FORM)
    await loadUsers()
    setInviteSubmitting(false)
  }

  function openEditUser(user) {
    setEditingUser(user)
    setEditUserForm({
      full_name: user.full_name,
      role: user.role,
      cohort_id: user.cohort_id ?? '',
      mentor_coach_id: user.mentor_coach_id ?? '',
      is_active: user.is_active ?? true,
    })
    setEditUserError(null)
    setShowInviteForm(false)
    setSuccessMsg(null)
  }

  function handleEditUserChange(e) {
    const val = e.target.name === 'is_active' ? e.target.value === 'true' : e.target.value
    setEditUserForm(f => ({ ...f, [e.target.name]: val }))
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault()
    setEditUserError(null)
    setEditUserSubmitting(true)
    const res = await fetch('/api/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editingUser.id, ...editUserForm }),
    })
    const result = await res.json()
    if (!res.ok) {
      setEditUserError(result.error ?? 'Something went wrong.')
      setEditUserSubmitting(false)
      return
    }
    setSuccessMsg(`${editUserForm.full_name} has been updated.`)
    setEditingUser(null)
    await loadUsers()
    setEditUserSubmitting(false)
  }

  async function handleResendInvite(user) {
    setSuccessMsg(null)
    const res = await fetch('/api/resend-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, full_name: user.full_name, role: user.role }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Could not resend invite: ${result.error}`)
    else setSuccessMsg(`Invite resent to ${user.email}.`)
  }

  async function handleResetPassword(user) {
    setSuccessMsg(null)
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Could not send reset email: ${result.error}`)
    else setSuccessMsg(`Password reset email sent to ${user.email}.`)
  }

  async function handleDeleteUser(user) {
    if (!window.confirm(`Remove ${user.full_name}? This cannot be undone.`)) return
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Could not remove user: ${result.error}`)
    else {
      setSuccessMsg(`${user.full_name} has been removed.`)
      await loadUsers()
    }
  }

  // ── Question handlers ──
  function openAddQuestion() {
    setQForm(EMPTY_QUESTION)
    setQError(null)
    setQSuccess(null)
    setEditingQuestion('new')
  }

  function openEditQuestion(q) {
    setQForm({
      competency: q.competency,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct: q.correct,
      explanation: q.explanation,
      is_active: q.is_active,
    })
    setQError(null)
    setQSuccess(null)
    setEditingQuestion(q.id)
  }

  function handleQFormChange(e) {
    const val = e.target.name === 'is_active' ? e.target.value === 'true' : e.target.value
    setQForm(f => ({ ...f, [e.target.name]: val }))
  }

  async function handleQSubmit(e) {
    e.preventDefault()
    setQError(null)
    setQSubmitting(true)

    const payload = {
      competency: qForm.competency,
      question: qForm.question.trim(),
      option_a: qForm.option_a.trim(),
      option_b: qForm.option_b.trim(),
      option_c: qForm.option_c.trim(),
      option_d: qForm.option_d.trim(),
      correct: qForm.correct,
      explanation: qForm.explanation.trim(),
      is_active: qForm.is_active,
    }

    let error
    if (editingQuestion === 'new') {
      ;({ error } = await supabase.from('questions').insert(payload))
    } else {
      ;({ error } = await supabase.from('questions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingQuestion))
    }

    if (error) {
      setQError(error.message)
      setQSubmitting(false)
      return
    }

    setQSuccess(editingQuestion === 'new' ? 'Question added.' : 'Question saved.')
    setEditingQuestion(null)
    await loadQuestions()
    setQSubmitting(false)
  }

  async function handleToggleActive(q) {
    const { error } = await supabase
      .from('questions')
      .update({ is_active: !q.is_active, updated_at: new Date().toISOString() })
      .eq('id', q.id)
    if (error) alert(error.message)
    else await loadQuestions()
  }

  async function handleDeleteQuestion(q) {
    if (!window.confirm(`Delete this question? This cannot be undone.`)) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) alert(error.message)
    else {
      setQSuccess('Question deleted.')
      await loadQuestions()
    }
  }

  // Filtered question list
  const filteredQuestions = questions.filter(q => {
    const matchComp = !qFilter || q.competency === qFilter
    const matchSearch = !qSearch || q.question.toLowerCase().includes(qSearch.toLowerCase())
    return matchComp && matchSearch
  })

  return (
    <main style={s.page}>
      <header style={s.header}>
        <span style={s.adminName}>{profile?.full_name ?? 'Admin'}</span>
        <button onClick={signOut} style={s.signOutBtn}>Sign Out</button>
      </header>

      {/* Tab bar */}
      <div style={s.tabBar}>
        <div style={s.tabInner}>
          {[
            { id: 'users',     label: 'Users' },
            { id: 'questions', label: 'Exam Questions' },
            { id: 'content',   label: 'Page Content' },
            { id: 'rubrics',   label: 'Scoring Rubrics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.content}>

        {/* ─── USERS TAB ─── */}
        {activeTab === 'users' && (
          <>
            <div style={s.titleRow}>
              <h1 style={s.heading}>Users</h1>
              {!showInviteForm && (
                <button onClick={() => { setShowInviteForm(true); setEditingUser(null); setSuccessMsg(null) }} style={s.addBtn}>
                  + Add User
                </button>
              )}
            </div>

            {successMsg && <p style={s.successBanner}>{successMsg}</p>}

            {showInviteForm && (
              <div style={s.formCard}>
                <h2 style={s.formHeading}>Invite New User</h2>
                <form onSubmit={handleInviteSubmit}>
                  <div style={s.formGrid}>
                    <label style={s.label}>Full Name
                      <input name="full_name" value={inviteForm.full_name} onChange={handleInviteChange} required style={s.input} placeholder="Jane Smith" />
                    </label>
                    <label style={s.label}>Email
                      <input name="email" type="email" value={inviteForm.email} onChange={handleInviteChange} required style={s.input} placeholder="jane@rice.edu" />
                    </label>
                    <label style={s.label}>Role
                      <select name="role" value={inviteForm.role} onChange={handleInviteChange} style={s.input}>
                        <option value="coach">Participant</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <label style={s.label}>Cohort
                      <select name="cohort_id" value={inviteForm.cohort_id} onChange={handleInviteChange} style={s.input}>
                        <option value="">— None —</option>
                        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label style={s.label}>Mentor Coach
                      <select name="mentor_coach_id" value={inviteForm.mentor_coach_id} onChange={handleInviteChange} style={s.input}>
                        <option value="">— None —</option>
                        {mentorCoaches.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                    </label>
                  </div>
                  {userError && <p style={s.errorMsg}>{userError}</p>}
                  <div style={s.formActions}>
                    <button type="button" onClick={() => setShowInviteForm(false)} style={s.cancelBtn}>Cancel</button>
                    <button type="submit" disabled={inviteSubmitting} style={s.submitBtn}>
                      {inviteSubmitting ? 'Sending invite…' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {editingUser && (
              <div style={s.formCard}>
                <h2 style={s.formHeading}>Edit User: {editingUser.full_name}</h2>
                <form onSubmit={handleEditUserSubmit}>
                  <div style={s.formGrid}>
                    <label style={s.label}>Full Name
                      <input name="full_name" value={editUserForm.full_name} onChange={handleEditUserChange} required style={s.input} />
                    </label>
                    <label style={s.label}>Role
                      <select name="role" value={editUserForm.role} onChange={handleEditUserChange} style={s.input}>
                        <option value="coach">Participant</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <label style={s.label}>Cohort
                      <select name="cohort_id" value={editUserForm.cohort_id} onChange={handleEditUserChange} style={s.input}>
                        <option value="">— None —</option>
                        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label style={s.label}>Mentor Coach
                      <select name="mentor_coach_id" value={editUserForm.mentor_coach_id} onChange={handleEditUserChange} style={s.input}>
                        <option value="">— None —</option>
                        {mentorCoaches.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                    </label>
                    <label style={s.label}>Account Access
                      <select name="is_active" value={String(editUserForm.is_active)} onChange={handleEditUserChange} style={s.input}>
                        <option value="true">Active</option>
                        <option value="false">Paused</option>
                      </select>
                    </label>
                  </div>
                  {editUserError && <p style={s.errorMsg}>{editUserError}</p>}
                  <div style={s.formActions}>
                    <button type="button" onClick={() => setEditingUser(null)} style={s.cancelBtn}>Cancel</button>
                    <button type="submit" disabled={editUserSubmitting} style={s.submitBtn}>
                      {editUserSubmitting ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <table style={s.table}>
              <thead>
                <tr>
                  {['Name','Email','Role','Cohort','Mentor Coach','Added','Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={s.trBody}>
                    <td style={s.td}>{u.full_name}</td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={u.role === 'admin' ? s.badgeAdmin : s.badgeCoach}>
                          {u.role === 'admin' ? 'Admin' : 'Participant'}
                        </span>
                        {u.is_active === false && <span style={s.badgePaused}>Paused</span>}
                      </div>
                    </td>
                    <td style={s.td}>{u.cohorts?.name ?? '—'}</td>
                    <td style={s.td}>{u.mentor_coaches?.full_name ?? '—'}</td>
                    <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        <button onClick={() => openEditUser(u)} style={s.actionBtn}>Edit</button>
                        <button onClick={() => handleResendInvite(u)} style={s.actionBtn}>Resend Invite</button>
                        <button onClick={() => handleResetPassword(u)} style={s.actionBtn}>Reset Password</button>
                        <button onClick={() => handleDeleteUser(u)} style={s.deleteBtn}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#999' }}>No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ─── QUESTIONS TAB ─── */}
        {activeTab === 'questions' && (
          <>
            <div style={s.titleRow}>
              <h1 style={s.heading}>Exam Questions <span style={s.countBadge}>{questions.length}</span></h1>
              {editingQuestion === null && (
                <button onClick={openAddQuestion} style={s.addBtn}>+ Add Question</button>
              )}
            </div>

            {qSuccess && <p style={s.successBanner}>{qSuccess}</p>}

            {/* Add / Edit form */}
            {editingQuestion !== null && (
              <div style={s.formCard}>
                <h2 style={s.formHeading}>
                  {editingQuestion === 'new' ? 'Add New Question' : 'Edit Question'}
                </h2>
                <form onSubmit={handleQSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>

                    <div style={s.formGrid2}>
                      <label style={s.label}>Competency
                        <select name="competency" value={qForm.competency} onChange={handleQFormChange} style={s.input}>
                          {COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label style={s.label}>Correct Answer
                        <select name="correct" value={qForm.correct} onChange={handleQFormChange} style={s.input}>
                          {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </label>
                      <label style={s.label}>Status
                        <select name="is_active" value={String(qForm.is_active)} onChange={handleQFormChange} style={s.input}>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </label>
                    </div>

                    <label style={s.label}>Question
                      <textarea name="question" value={qForm.question} onChange={handleQFormChange} required rows={4} style={s.textarea} placeholder="Describe the coaching scenario and ask the question..." />
                    </label>

                    <div style={s.formGrid}>
                      {['a','b','c','d'].map(letter => (
                        <label key={letter} style={s.label}>Option {letter.toUpperCase()}
                          <textarea
                            name={`option_${letter}`}
                            value={qForm[`option_${letter}`]}
                            onChange={handleQFormChange}
                            required
                            rows={2}
                            style={s.textarea}
                          />
                        </label>
                      ))}
                    </div>

                    <label style={s.label}>Explanation (shown after incorrect answer)
                      <textarea name="explanation" value={qForm.explanation} onChange={handleQFormChange} required rows={3} style={s.textarea} placeholder="Why is the correct answer the best response?" />
                    </label>
                  </div>

                  {qError && <p style={s.errorMsg}>{qError}</p>}
                  <div style={s.formActions}>
                    <button type="button" onClick={() => setEditingQuestion(null)} style={s.cancelBtn}>Cancel</button>
                    <button type="submit" disabled={qSubmitting} style={s.submitBtn}>
                      {qSubmitting ? 'Saving…' : editingQuestion === 'new' ? 'Add Question' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filters */}
            <div style={s.filterRow}>
              <select value={qFilter} onChange={e => setQFilter(e.target.value)} style={{ ...s.input, maxWidth: '260px' }}>
                <option value="">All Competencies</option>
                {COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={qSearch}
                onChange={e => setQSearch(e.target.value)}
                placeholder="Search questions…"
                style={{ ...s.input, flex: 1, maxWidth: '320px' }}
              />
            </div>

            {/* Questions table */}
            <table style={s.table}>
              <thead>
                <tr>
                  {['#','Competency','Question','Correct','Status','Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map(q => (
                  <tr key={q.id} style={{ ...s.trBody, opacity: q.is_active ? 1 : 0.5 }}>
                    <td style={{ ...s.td, color: '#999', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{q.id}</td>
                    <td style={s.td}>
                      <span style={s.compBadge}>{q.competency}</span>
                    </td>
                    <td style={{ ...s.td, maxWidth: '380px' }}>
                      <span style={s.qText}>{q.question.length > 120 ? q.question.slice(0, 120) + '…' : q.question}</span>
                    </td>
                    <td style={{ ...s.td, fontWeight: '700', color: '#00205B', textAlign: 'center' }}>{q.correct}</td>
                    <td style={s.td}>
                      <span style={q.is_active ? s.badgeActive : s.badgeInactive}>
                        {q.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        <button onClick={() => openEditQuestion(q)} style={s.actionBtn}>Edit</button>
                        <button onClick={() => handleToggleActive(q)} style={s.actionBtn}>
                          {q.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteQuestion(q)} style={s.deleteBtn}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredQuestions.length === 0 && (
                  <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#999' }}>
                    {questions.length === 0 ? 'No questions yet — run the seed script or add one above.' : 'No questions match your filter.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
        {/* ─── CONTENT TAB ─── */}
        {activeTab === 'content' && (
          <>
            <div style={s.titleRow}>
              <h1 style={s.heading}>Page Content</h1>
              <button onClick={handleContentSave} disabled={contentSaving} style={s.addBtn}>
                {contentSaving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.75rem', marginTop: '-0.75rem' }}>
              Edit text, colors, and fonts. The preview updates live as you type. Changes go live for participants after saving.
            </p>

            {contentSuccess && <p style={s.successBanner}>{contentSuccess}</p>}
            {contentError && <p style={s.errorMsg}>{contentError}</p>}

            {CONTENT_FIELDS.map(group => (
              <div key={group.section} style={s.formCard}>
                <h2 style={s.formHeading}>{group.section}</h2>
                {group.description && (
                  <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
                    {group.description}
                  </p>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: group.section === 'Theme & Branding'
                    ? 'repeat(auto-fill, minmax(200px, 1fr))'
                    : '1fr',
                  gap: '1rem',
                }}>
                  {group.keys.map(field => (
                    <label key={field.key} style={s.label}>
                      {field.label}
                      {field.type === 'color' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <input
                            type="color"
                            value={contentValues[field.key] ?? '#00205B'}
                            onChange={e => setContentValues(v => ({ ...v, [field.key]: e.target.value }))}
                            style={{ width: '48px', height: '36px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}
                          />
                          <input
                            type="text"
                            value={contentValues[field.key] ?? ''}
                            onChange={e => setContentValues(v => ({ ...v, [field.key]: e.target.value }))}
                            style={{ ...s.input, flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                            placeholder="#000000"
                          />
                        </div>
                      ) : field.type === 'font' ? (
                        <select
                          value={contentValues[field.key] ?? FONT_OPTIONS[0].value}
                          onChange={e => setContentValues(v => ({ ...v, [field.key]: e.target.value }))}
                          style={{ ...s.input, fontFamily: contentValues[field.key] || 'inherit' }}
                        >
                          {FONT_OPTIONS.map(f => (
                            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          style={s.textarea}
                          value={contentValues[field.key] ?? ''}
                          onChange={e => setContentValues(v => ({ ...v, [field.key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          style={s.input}
                          value={contentValues[field.key] ?? ''}
                          onChange={e => setContentValues(v => ({ ...v, [field.key]: e.target.value }))}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Live Preview ── */}
            <div style={s.formCard}>
              <h2 style={s.formHeading}>Live Preview</h2>
              <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
                This is exactly what participants will see. Updates instantly as you edit above.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                {/* Dashboard card preview */}
                <div>
                  <p style={s.previewLabel}>Participant Dashboard</p>
                  <div style={{
                    background: contentValues.theme_page_bg || '#f0f2f5',
                    padding: '1.25rem',
                    borderRadius: '8px',
                  }}>
                    <p style={{
                      fontSize: '0.65rem', fontWeight: '700', color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      marginBottom: '0.6rem', fontFamily: contentValues.theme_font_family || 'inherit',
                    }}>Tools</p>
                    <div style={{
                      background: '#fff',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      fontFamily: contentValues.theme_font_family || 'inherit',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#e8ecf5',
                        color: contentValues.theme_primary_color || '#00205B',
                        fontSize: '0.65rem', fontWeight: '700',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '0.2rem 0.5rem', borderRadius: '4px',
                      }}>
                        {contentValues.exam_card_tag || 'Exam Prep'}
                      </span>
                      <p style={{ fontSize: '0.95rem', fontWeight: '700', color: contentValues.theme_primary_color || '#00205B', margin: 0 }}>
                        {contentValues.exam_card_title || 'ACC Practice Exam'}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: '#555', lineHeight: '1.5', margin: 0 }}>
                        {contentValues.exam_card_description || ''}
                      </p>
                      <span style={{ fontSize: '0.78rem', fontWeight: '600', color: contentValues.theme_primary_color || '#00205B', marginTop: '0.35rem' }}>
                        Start →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exam start screen preview */}
                <div>
                  <p style={s.previewLabel}>Exam Start Screen</p>
                  <div style={{
                    background: contentValues.theme_page_bg || '#f0f2f5',
                    padding: '1.25rem',
                    borderRadius: '8px',
                  }}>
                    <div style={{
                      background: '#fff',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      fontFamily: contentValues.theme_font_family || 'inherit',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#e8ecf5',
                        color: contentValues.theme_primary_color || '#00205B',
                        fontSize: '0.65rem', fontWeight: '700',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '0.2rem 0.5rem', borderRadius: '4px', marginBottom: '0.5rem',
                      }}>
                        {contentValues.exam_start_badge || 'ACC Exam Prep'}
                      </span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: contentValues.theme_primary_color || '#00205B', margin: '0 0 0.4rem' }}>
                        {contentValues.exam_start_title || 'ICF Practice Exam'}
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: '#555', lineHeight: '1.5', margin: '0 0 0.6rem' }}>
                        {contentValues.exam_start_subtitle || ''}
                      </p>
                      <ul style={{ fontSize: '0.78rem', color: '#444', paddingLeft: '1.1rem', margin: '0 0 0.75rem', lineHeight: '1.75' }}>
                        {[contentValues.exam_start_info_1, contentValues.exam_start_info_2, contentValues.exam_start_info_3]
                          .filter(Boolean)
                          .map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                      <button style={{
                        padding: '0.5rem 1.1rem',
                        background: contentValues.theme_primary_color || '#00205B',
                        color: '#fff', border: 'none', borderRadius: '6px',
                        fontSize: '0.85rem', fontWeight: '600', cursor: 'default',
                        fontFamily: contentValues.theme_font_family || 'inherit',
                      }}>
                        Start Exam
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={handleContentSave} disabled={contentSaving} style={s.submitBtn}>
                {contentSaving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </>
        )}

        {/* ─── RUBRICS TAB ─── */}
        {activeTab === 'rubrics' && (
          <>
            <div style={s.titleRow}>
              <h1 style={s.heading}>Scoring Rubrics</h1>
              <button onClick={handleRubricSave} disabled={rubricSaving} style={s.addBtn}>
                {rubricSaving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.75rem', marginTop: '-0.75rem' }}>
              These descriptors define each performance level for every ICF ACC behavioral indicator. Claude uses them
              when scoring transcripts. Competency 1 qualifiers are scored Demonstrated / Not Demonstrated only.
            </p>

            {rubricSuccess && <p style={s.successBanner}>{rubricSuccess}</p>}
            {rubricError   && <p style={s.errorMsg}>{rubricError}</p>}

            {/* Group by competency */}
            {Object.values(
              rubricsData.reduce((acc, r) => {
                const k = r.competency_number
                if (!acc[k]) acc[k] = { competency_number: k, competency_name: r.competency_name, rows: [] }
                acc[k].rows.push(r)
                return acc
              }, {})
            )
              .sort((a, b) => a.competency_number - b.competency_number)
              .map(group => (
                <div key={group.competency_number} style={s.formCard}>
                  <h2 style={s.formHeading}>
                    C{group.competency_number} — {group.competency_name}
                  </h2>

                  {group.rows.map(r => (
                    <div key={r.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', letterSpacing: '0.04em' }}>
                          {r.statement_code}
                        </span>
                        {r.is_qualifier && (
                          <span style={{ fontSize: '0.7rem', fontWeight: '600', background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', padding: '0.15rem 0.45rem' }}>
                            Qualifier
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5', margin: '0 0 0.75rem', fontStyle: 'italic' }}>
                        {r.statement_text}
                      </p>

                      {r.is_qualifier ? (
                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
                          Scored as Demonstrated / Not Demonstrated — no level descriptors required.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                          {[
                            { key: 'exceeds_standard', label: 'Exceeds the Standard (4)', color: '#15803d' },
                            { key: 'meets_standard',   label: 'Meets the Standard (3)',   color: '#1d4ed8' },
                            { key: 'below_standard',   label: 'Below the Standard (2)',   color: '#b45309' },
                            { key: 'does_not_meet',    label: 'Does Not Meet Standard (1)', color: '#b91c1c' },
                          ].map(({ key, label, color }) => (
                            <label key={key} style={{ ...s.label, gap: '0.3rem' }}>
                              <span style={{ color, fontSize: '0.8rem', fontWeight: '600' }}>{label}</span>
                              <textarea
                                rows={3}
                                style={s.textarea}
                                value={rubricEdits[r.id]?.[key] ?? ''}
                                onChange={e => setRubricEdits(prev => ({
                                  ...prev,
                                  [r.id]: { ...prev[r.id], [key]: e.target.value },
                                }))}
                                placeholder={`Describe what "${label}" looks like…`}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            }

            {rubricsData.length === 0 && (
              <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                No rubrics found. Make sure the rubrics table has been seeded.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={handleRubricSave} disabled={rubricSaving} style={s.submitBtn}>
                {rubricSaving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f0f2f5' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb',
  },
  adminName: { fontWeight: '600', color: '#00205B', fontSize: '0.95rem' },
  signOutBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
    padding: '0.4rem 0.9rem', fontSize: '0.875rem', cursor: 'pointer', color: '#555',
  },
  tabBar: { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 2rem' },
  tabInner: { display: 'flex', gap: '0', maxWidth: '1200px', margin: '0 auto' },
  tab: {
    padding: '0.85rem 1.25rem', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: '#6b7280',
    borderBottom: '3px solid transparent', marginBottom: '-1px',
  },
  tabActive: { color: '#00205B', borderBottomColor: '#00205B', fontWeight: '600' },
  content: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { fontSize: '1.75rem', fontWeight: '700', color: '#00205B', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  countBadge: {
    fontSize: '0.85rem', fontWeight: '600', background: '#e8ecf5', color: '#00205B',
    borderRadius: '20px', padding: '0.15rem 0.6rem',
  },
  addBtn: {
    background: '#00205B', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
  },
  successBanner: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
    borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.9rem',
  },
  formCard: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '1.75rem', marginBottom: '1.75rem',
  },
  formHeading: { fontSize: '1.1rem', fontWeight: '600', color: '#00205B', marginBottom: '1.25rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' },
  formGrid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
  input: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#111', background: '#fff', outline: 'none' },
  textarea: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', color: '#111', background: '#fff', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' },
  errorMsg: { color: '#b91c1c', fontSize: '0.875rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '1rem' },
  formActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  cancelBtn: { background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.6rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555' },
  submitBtn: { background: '#00205B', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.4rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' },
  filterRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.85rem 1rem', background: '#f9fafb', color: '#6b7280', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  trBody: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', color: '#374151', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' },
  deleteBtn: { background: 'none', border: '1px solid #fca5a5', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap' },
  badgeCoach: { background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeAdmin: { background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgePaused: { background: '#fef9c3', color: '#854d0e', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeActive: { background: '#f0fdf4', color: '#15803d', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeInactive: { background: '#f9fafb', color: '#9ca3af', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  compBadge: { display: 'inline-block', background: '#e8ecf5', color: '#00205B', fontSize: '0.72rem', fontWeight: '600', padding: '0.2rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' },
  qText: { fontSize: '0.85rem', color: '#374151', lineHeight: '1.4' },
  previewLabel: { fontSize: '0.72rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', marginTop: 0 },
}

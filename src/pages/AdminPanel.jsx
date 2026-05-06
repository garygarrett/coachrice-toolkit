import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { getDefaultClientPrompt } from '../lib/prompts'

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

function AdminSidebar({ profile, onSignOut, onNavigate, active = 'dashboard' }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history', label: 'History' },
  ]
  const toolItems = [
    { id: 'exam', label: 'ACC Practice Exam' },
    { id: 'transcript', label: 'Transcript Reviewer' },
    { id: 'ai', label: 'AI Client' },
    { id: 'audio', label: 'Audio to Transcript' },
  ]

  return (
    <div style={adminStyles.sidebar}>
      <div style={adminStyles.logoArea}>
        <img src={logo} alt="CoachRICE" style={{ height: 36, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
      </div>
      <div style={adminStyles.nav}>
        <div style={adminStyles.navLabel}>General</div>
        <div style={{ ...adminStyles.navItem, cursor: 'pointer' }} onClick={() => onNavigate('/dashboard')}>
          <ToolIcon id="dashboard" size={14} color="rgba(255,255,255,0.55)" />
          <span>Dashboard</span>
        </div>
        <div style={{ ...adminStyles.navItem, cursor: 'pointer' }} onClick={() => onNavigate('/dashboard')}>
          <ToolIcon id="history" size={14} color="rgba(255,255,255,0.55)" />
          <span>History</span>
        </div>
        <div style={adminStyles.navDivider}></div>
        <div style={adminStyles.navLabel}>Toolkit</div>
        {toolItems.map(n => (
          <div key={n.id} style={{ ...adminStyles.navItem, cursor: 'pointer' }} onClick={() => {
            const routes = {
              exam: '/tools/exam',
              transcript: '/tools/transcript',
              ai: '/tools/ai',
              audio: '/tools/audio'
            }
            onNavigate(routes[n.id])
          }}>
            <ToolIcon id={n.id} size={14} color="rgba(255,255,255,0.55)" />
            <span style={{ fontSize: 10 }}>{n.label}</span>
          </div>
        ))}
        <div style={adminStyles.navDivider}></div>
        <div style={adminStyles.navLabel}>Admin</div>
        {navItems.map(n => (
          <div key={`admin-${n.id}`} style={{ ...adminStyles.navItem, ...(active === n.id ? adminStyles.navItemActive : {}) }}>
            <ToolIcon id={n.id} size={14} color={active === n.id ? COLORS.teal : 'rgba(255,255,255,0.55)'} />
            <span>{n.label}</span>
          </div>
        ))}
      </div>
      <div style={adminStyles.avatarRow}>
        <div style={adminStyles.avatar}>{profile?.full_name?.[0] || 'A'}</div>
        <div>
          <div style={adminStyles.avatarName}>{profile?.full_name?.split(' ')[0] || 'Admin'}</div>
          <div style={adminStyles.avatarRole}>
            <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9, cursor: 'pointer', padding: 0, fontFamily: 'Montserrat, sans-serif' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  { label: 'System Default (sans-serif)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Lato', value: "'Lato', system-ui, sans-serif" },
  { label: 'Source Sans 3', value: "'Source Sans 3', system-ui, sans-serif" },
  { label: 'Merriweather (serif)', value: "'Merriweather', Georgia, serif" },
  { label: 'Georgia (serif)', value: "Georgia, 'Times New Roman', serif" },
]

const ALL_CONTENT_KEYS = [
  'theme_primary_color', 'theme_page_bg', 'theme_font_family',
  'exam_card_tag', 'exam_card_title', 'exam_card_description',
  'transcript_card_tag', 'transcript_card_title', 'transcript_card_description',
  'ai_card_tag', 'ai_card_title', 'ai_card_description',
  'audio_card_tag', 'audio_card_title', 'audio_card_description',
  'exam_start_badge', 'exam_start_title', 'exam_start_subtitle',
  'exam_start_info_1', 'exam_start_info_2', 'exam_start_info_3',
  'transcript_start_badge', 'transcript_start_title', 'transcript_start_subtitle',
  'transcript_start_info_1', 'transcript_start_info_2', 'transcript_start_info_3',
  'ai_start_badge', 'ai_start_title', 'ai_start_subtitle',
  'ai_start_info_1', 'ai_start_info_2', 'ai_start_info_3',
  'audio_start_badge', 'audio_start_title', 'audio_start_subtitle',
  'audio_start_info_1', 'audio_start_info_2', 'audio_start_info_3',
]

export default function AdminPanel() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [editingQuestion, setEditingQuestion] = useState(null)
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
  const [rubricEdits, setRubricEdits] = useState({})
  const [rubricSaving, setRubricSaving] = useState(false)
  const [rubricSuccess, setRubricSuccess] = useState(null)
  const [rubricError, setRubricError] = useState(null)

  // ── Settings/API Keys state ──
  const [apiKeys, setApiKeys] = useState({ chatbot: '', feedback: '' })
  const [apiKeysSaving, setApiKeysSaving] = useState(false)
  const [apiKeysSuccess, setApiKeysSuccess] = useState(null)
  const [apiKeysError, setApiKeysError] = useState(null)

  // ── Prompts state ──
  const [prompts, setPrompts] = useState({ aiClientChatbot: '', aiClientFeedback: '', assessor: '' })
  const [promptsSaving, setPromptsSaving] = useState(false)
  const [promptsSuccess, setPromptsSuccess] = useState(null)
  const [promptsError, setPromptsError] = useState(null)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { if (activeTab === 'settings') { loadApiKeys(); loadPrompts() } }, [activeTab])
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
          meets_standard: r.meets_standard ?? '',
          below_standard: r.below_standard ?? '',
          does_not_meet: r.does_not_meet ?? '',
        }
      })
      setRubricEdits(edits)
    }
  }

  async function loadApiKeys() {
    const { data } = await supabase.from('config').select('key, value')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.key] = row.value })
      setApiKeys({
        chatbot: map.api_key_chatbot ?? '',
        feedback: map.api_key_feedback ?? '',
      })
    }
  }

  async function handleApiKeysSave() {
    setApiKeysSaving(true)
    setApiKeysError(null)
    setApiKeysSuccess(null)

    const updates = [
      { key: 'api_key_chatbot', value: apiKeys.chatbot },
      { key: 'api_key_feedback', value: apiKeys.feedback },
    ]

    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    if (error) {
      setApiKeysError(error.message)
    } else {
      setApiKeysSuccess('API keys saved successfully.')
    }
    setApiKeysSaving(false)
  }

  async function loadPrompts() {
    const { data } = await supabase.from('config').select('key, value')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.key] = row.value })
      setPrompts({
        aiClientChatbot: map.ai_client_chatbot_prompt ?? getDefaultClientPrompt(),
        aiClientFeedback: map.ai_client_feedback_prompt ?? 'You are an expert coaching evaluator. Analyze the coaching session transcript and provide detailed feedback on the coach\'s performance, strengths, and areas for development based on ICF competencies.',
        assessor: map.ai_assessor_prompt ?? '',
      })
    }
  }

  async function handlePromptsSave() {
    setPromptsSaving(true)
    setPromptsError(null)
    setPromptsSuccess(null)

    const updates = [
      { key: 'ai_client_chatbot_prompt', value: prompts.aiClientChatbot },
      { key: 'ai_client_feedback_prompt', value: prompts.aiClientFeedback },
      { key: 'ai_assessor_prompt', value: prompts.assessor },
    ]

    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    if (error) {
      setPromptsError(error.message)
    } else {
      setPromptsSuccess('Prompts saved successfully.')
    }
    setPromptsSaving(false)
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
        meets_standard: edits.meets_standard,
        below_standard: edits.below_standard,
        does_not_meet: edits.does_not_meet,
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

    const upsertRows = ALL_CONTENT_KEYS.map(key => ({ key, value: contentValues[key] ?? '' }))

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

  const filteredQuestions = questions.filter(q => {
    const matchComp = !qFilter || q.competency === qFilter
    const matchSearch = !qSearch || q.question.toLowerCase().includes(qSearch.toLowerCase())
    return matchComp && matchSearch
  })

  return (
    <Layout active="admin" pageTitle="Dashboard">
      <div style={adminStyles.tabBar}>
        {[
          { id: 'users', label: 'Users' },
          { id: 'questions', label: 'Exam Questions' },
          { id: 'content', label: 'Page Content' },
          { id: 'rubrics', label: 'Scoring Rubrics' },
          { id: 'settings', label: 'Settings' },
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
                  {['Name', 'Email', 'Role', 'Cohort', 'Mentor Coach', 'Added', 'Actions'].map(h => (
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
                          {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
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
                      {['a', 'b', 'c', 'd'].map(letter => (
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

            <table style={s.table}>
              <thead>
                <tr>
                  {['#', 'Competency', 'Question', 'Correct', 'Status', 'Actions'].map(h => (
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
              <h1 style={s.heading}>Page Content & Tiles</h1>
            </div>

            {contentSuccess && <p style={s.successBanner}>{contentSuccess}</p>}
            {contentError && <p style={s.errorMsg}>{contentError}</p>}

            <div style={s.formCard}>
              <h2 style={s.formHeading}>Dashboard Tool Tiles</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {['exam', 'transcript', 'ai', 'audio'].map(tool => (
                  <div key={tool} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem', textTransform: 'capitalize' }}>
                      {tool === 'ai' ? 'AI Client' : tool === 'audio' ? 'Audio to Transcript' : tool.charAt(0).toUpperCase() + tool.slice(1)}
                    </h3>
                    <label style={s.label}>Tag
                      <input
                        value={contentValues[`${tool}_card_tag`] ?? ''}
                        onChange={e => setContentValues(v => ({ ...v, [`${tool}_card_tag`]: e.target.value }))}
                        style={s.input}
                      />
                    </label>
                    <label style={s.label}>Title
                      <input
                        value={contentValues[`${tool}_card_title`] ?? ''}
                        onChange={e => setContentValues(v => ({ ...v, [`${tool}_card_title`]: e.target.value }))}
                        style={s.input}
                      />
                    </label>
                    <label style={s.label}>Description
                      <input
                        value={contentValues[`${tool}_card_description`] ?? ''}
                        onChange={e => setContentValues(v => ({ ...v, [`${tool}_card_description`]: e.target.value }))}
                        style={s.input}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <h2 style={s.formHeading}>Tool Start Screens</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {['exam', 'transcript', 'ai', 'audio'].map(tool => (
                  <div key={`${tool}-start`} style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem', textTransform: 'capitalize' }}>
                      {tool === 'ai' ? 'AI Client' : tool === 'audio' ? 'Audio to Transcript' : tool.charAt(0).toUpperCase() + tool.slice(1)} Start Screen
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label style={s.label}>Badge
                        <input
                          value={contentValues[`${tool}_start_badge`] ?? ''}
                          onChange={e => setContentValues(v => ({ ...v, [`${tool}_start_badge`]: e.target.value }))}
                          style={s.input}
                        />
                      </label>
                      <label style={s.label}>Title
                        <textarea
                          value={contentValues[`${tool}_start_title`] ?? ''}
                          onChange={e => setContentValues(v => ({ ...v, [`${tool}_start_title`]: e.target.value }))}
                          rows={2}
                          style={s.textarea}
                        />
                      </label>
                    </div>
                    <label style={s.label}>Subtitle
                      <textarea
                        value={contentValues[`${tool}_start_subtitle`] ?? ''}
                        onChange={e => setContentValues(v => ({ ...v, [`${tool}_start_subtitle`]: e.target.value }))}
                        rows={3}
                        style={s.textarea}
                      />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                      {[1, 2, 3].map(i => (
                        <label key={i} style={s.label}>Info {i}
                          <textarea
                            value={contentValues[`${tool}_start_info_${i}`] ?? ''}
                            onChange={e => setContentValues(v => ({ ...v, [`${tool}_start_info_${i}`]: e.target.value }))}
                            rows={2}
                            style={s.textarea}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={s.formActions}>
                <button
                  onClick={handleContentSave}
                  disabled={contentSaving}
                  style={s.submitBtn}
                >
                  {contentSaving ? 'Saving…' : 'Save All Changes'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── RUBRICS TAB ─── */}
        {activeTab === 'rubrics' && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
            Rubrics management coming soon...
          </div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {activeTab === 'settings' && (
          <>
            <div style={s.titleRow}>
              <h1 style={s.heading}>Settings & API Keys</h1>
            </div>

            {apiKeysSuccess && <p style={s.successBanner}>{apiKeysSuccess}</p>}
            {apiKeysError && <p style={s.errorMsg}>{apiKeysError}</p>}

            <div style={s.formCard}>
              <h2 style={s.formHeading}>API Keys for Coaching Bots</h2>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                Configure the API keys used by different AI features. These keys are used server-side and are never exposed to users.
              </p>

              <label style={s.label}>Chatbot API Key (for AI Client practice sessions)
                <input
                  type="password"
                  value={apiKeys.chatbot}
                  onChange={e => setApiKeys(v => ({ ...v, chatbot: e.target.value }))}
                  style={s.input}
                  placeholder="sk-..."
                />
              </label>

              <label style={s.label}>Feedback Bot API Key (for session evaluations)
                <input
                  type="password"
                  value={apiKeys.feedback}
                  onChange={e => setApiKeys(v => ({ ...v, feedback: e.target.value }))}
                  style={s.input}
                  placeholder="sk-..."
                />
              </label>

              <div style={s.formActions}>
                <button
                  onClick={handleApiKeysSave}
                  disabled={apiKeysSaving}
                  style={s.submitBtn}
                >
                  {apiKeysSaving ? 'Saving…' : 'Save API Keys'}
                </button>
              </div>
            </div>

            {promptsSuccess && <p style={s.successBanner}>{promptsSuccess}</p>}
            {promptsError && <p style={s.errorMsg}>{promptsError}</p>}

            <div style={s.formCard}>
              <h2 style={s.formHeading}>System Prompts</h2>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                Edit the system prompts used by different tools. Defaults are shown below—update as needed.
              </p>

              <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #e2e6ec' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>AI Client</h3>

                <label style={s.label}>Chatbot System Prompt
                  <textarea
                    value={prompts.aiClientChatbot}
                    onChange={e => setPrompts(v => ({ ...v, aiClientChatbot: e.target.value }))}
                    style={{ ...s.textarea, fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '250px' }}
                    placeholder="Prompt for the AI coaching client bot..."
                  />
                </label>

                <label style={s.label}>Feedback Bot Prompt
                  <textarea
                    value={prompts.aiClientFeedback}
                    onChange={e => setPrompts(v => ({ ...v, aiClientFeedback: e.target.value }))}
                    style={{ ...s.textarea, fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '150px' }}
                    placeholder="Prompt for the AI feedback evaluator..."
                  />
                </label>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>Internal Assessor</h3>

                <label style={s.label}>Assessor System Prompt
                  <textarea
                    value={prompts.assessor}
                    onChange={e => setPrompts(v => ({ ...v, assessor: e.target.value }))}
                    style={{ ...s.textarea, fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '300px' }}
                    placeholder="Prompt for the ICF ACC assessor tool..."
                  />
                </label>
              </div>

              <div style={s.formActions}>
                <button
                  onClick={handlePromptsSave}
                  disabled={promptsSaving}
                  style={s.submitBtn}
                >
                  {promptsSaving ? 'Saving…' : 'Save All Prompts'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

const adminStyles = {
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
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    background: '#fff',
    borderRadius: '10px 10px 0 0',
    marginBottom: 0,
  },
}

const s = {
  tab: {
    padding: '0.85rem 1.25rem', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: '#6b7280',
    borderBottom: '3px solid transparent', marginBottom: '-1px', fontFamily: 'Montserrat, sans-serif',
  },
  tabActive: { color: '#00205B', borderBottomColor: '#00205B', fontWeight: '600' },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { fontSize: '1.75rem', fontWeight: '700', color: '#00205B', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  countBadge: {
    fontSize: '0.85rem', fontWeight: '600', background: '#e8ecf5', color: '#00205B',
    borderRadius: '20px', padding: '0.15rem 0.6rem',
  },
  addBtn: {
    background: '#00205B', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
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
  input: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#111', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' },
  textarea: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', color: '#111', background: '#fff', outline: 'none', resize: 'vertical', fontFamily: 'Montserrat, sans-serif', lineHeight: '1.5' },
  errorMsg: { color: '#b91c1c', fontSize: '0.875rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '1rem' },
  formActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  cancelBtn: { background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.6rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontFamily: 'Montserrat, sans-serif' },
  submitBtn: { background: '#00205B', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.4rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' },
  filterRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.85rem 1rem', background: '#f9fafb', color: '#6b7280', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  trBody: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', color: '#374151', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap', fontFamily: 'Montserrat, sans-serif' },
  deleteBtn: { background: 'none', border: '1px solid #fca5a5', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap', fontFamily: 'Montserrat, sans-serif' },
  badgeCoach: { background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeAdmin: { background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgePaused: { background: '#fef9c3', color: '#854d0e', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeActive: { background: '#f0fdf4', color: '#15803d', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  badgeInactive: { background: '#f9fafb', color: '#9ca3af', borderRadius: '4px', padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: '500' },
  compBadge: { display: 'inline-block', background: '#e8ecf5', color: '#00205B', fontSize: '0.72rem', fontWeight: '600', padding: '0.2rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' },
  qText: { fontSize: '0.85rem', color: '#374151', lineHeight: '1.4' },
}

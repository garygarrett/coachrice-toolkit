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

const TOOL_DEFAULTS = {
  exam: { tag: 'Knowledge', title: 'ACC Practice Exam', desc: '200+ questions' },
  transcript: { tag: 'Application', title: 'Transcript Reviewer', desc: 'Upload a session' },
  ai: { tag: 'Application', title: 'AI Client', desc: 'Live coaching practice' },
  audio: { tag: 'Utility', title: 'Audio to Transcript', desc: 'Convert recordings' },
}

const TOOL_PAGE_DEFAULTS = {
  exam: {
    badge: 'Knowledge Assessment',
    subtitle: 'Test your knowledge with our comprehensive practice exam',
    info: 'Complete 200+ questions covering all ACC core competencies. Get instant feedback and detailed explanations. Track your progress and identify areas for improvement.',
  },
  transcript: {
    badge: 'Session Review',
    subtitle: 'Upload and analyze your coaching sessions',
    info: 'Review transcripts of your coaching conversations. Receive AI-powered feedback aligned with ACC competencies. Improve your coaching effectiveness.',
  },
  ai: {
    badge: 'Practice Tool',
    subtitle: 'Practice coaching with an AI-powered client',
    info: 'Engage in realistic coaching conversations. Get feedback on your coaching approach. Develop your coaching skills in a safe environment.',
  },
  audio: {
    badge: 'Utility',
    subtitle: 'Convert your audio recordings to text',
    info: 'Upload audio files from your coaching sessions. Get accurate transcriptions for analysis. Use with the Transcript Reviewer tool.',
  },
}

const TOOLS = [
  {
    id: 'exam',
    label: 'ACC Practice Exam',
    contentPrefix: 'exam',
    hasPrompts: false,
    hasApiKeys: false,
    hasQuestions: true,
    placeholder: false,
    cardBg: '#e6f7fc',
    cardColor: '#0284c7',
    tagColor: '#e8ecf5',
    tagTextColor: '#00205B',
  },
  {
    id: 'transcript',
    label: 'Transcript Reviewer',
    contentPrefix: 'transcript',
    hasPrompts: true,
    promptKeys: ['transcript_reviewer_prompt'],
    promptLabels: ['System Prompt'],
    hasApiKeys: true,
    apiKeyKeys: ['api_key_transcript'],
    apiKeyLabels: ['API Key'],
    hasQuestions: false,
    placeholder: false,
    cardBg: '#fff0e0',
    cardColor: '#ea580c',
    tagColor: '#fef3c7',
    tagTextColor: '#92400e',
  },
  {
    id: 'ai',
    label: 'AI Client',
    contentPrefix: 'ai',
    hasPrompts: true,
    promptKeys: ['ai_client_chatbot_prompt', 'ai_client_feedback_prompt'],
    promptLabels: ['Chatbot System Prompt', 'Feedback Bot System Prompt'],
    hasApiKeys: true,
    apiKeyKeys: ['api_key_chatbot', 'api_key_feedback'],
    apiKeyLabels: ['Chatbot API Key', 'Feedback Bot API Key'],
    hasQuestions: false,
    placeholder: false,
    cardBg: '#fff0e0',
    cardColor: '#ea580c',
    tagColor: '#fef3c7',
    tagTextColor: '#92400e',
  },
  {
    id: 'audio',
    label: 'Audio to Transcript',
    contentPrefix: 'audio',
    hasPrompts: false,
    hasApiKeys: false,
    hasQuestions: false,
    placeholder: true,
    cardBg: '#f0f2f5',
    cardColor: '#7C7E7F',
    tagColor: '#e2e6ec',
    tagTextColor: '#6b7a99',
  },
]

function ToolIcon({ id, size = 16, color = 'currentColor' }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const icons = {
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

export default function AdminPanel() {
  const navigate = useNavigate()
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

  // ── Tool content/settings state ──
  const [contentValues, setContentValues] = useState({})
  const [apiKeys, setApiKeys] = useState({ chatbot: '', feedback: '', assessor: '' })
  const [prompts, setPrompts] = useState({ aiClientChatbot: '', aiClientFeedback: '', assessor: '' })
  const [visibility, setVisibility] = useState({ exam: true, transcript: true, ai: true, audio: true })
  const [tileColors, setTileColors] = useState({})
  const [toolLoading, setToolLoading] = useState(false)
  const [toolError, setToolError] = useState(null)
  const [toolSuccess, setToolSuccess] = useState(null)

  // ── Questions state ──
  const [questions, setQuestions] = useState([])
  const [qFilter, setQFilter] = useState('')
  const [qSearch, setQSearch] = useState('')
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [qForm, setQForm] = useState(EMPTY_QUESTION)
  const [qSubmitting, setQSubmitting] = useState(false)
  const [qError, setQError] = useState(null)
  const [qSuccess, setQSuccess] = useState(null)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    setToolError(null)
    setToolSuccess(null)
    if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab.startsWith('tool-')) {
      loadToolSettings()
    }
  }, [activeTab])

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

  async function loadToolSettings() {
    setToolLoading(true)
    setToolError(null)

    try {
      // Load content + api keys + prompts + visibility
      const [contentRes, configRes, questionsRes] = await Promise.all([
        supabase.from('site_content').select('key, value'),
        supabase.from('config').select('key, value'),
        supabase.from('questions').select('*').order('id'),
      ])

      // Process content
      const contentMap = {}
      if (contentRes.data) {
        contentRes.data.forEach(row => { contentMap[row.key] = row.value })
      }
      setContentValues(contentMap)

      // Process config (api keys, prompts, visibility)
      const configMap = {}
      if (configRes.data) {
        configRes.data.forEach(row => { configMap[row.key] = row.value })
      }
      setApiKeys({
        chatbot: configMap.api_key_chatbot ?? '',
        feedback: configMap.api_key_feedback ?? '',
        assessor: configMap.api_key_assessor ?? '',
      })
      setPrompts({
        aiClientChatbot: configMap.ai_client_chatbot_prompt ?? getDefaultClientPrompt(),
        aiClientFeedback: configMap.ai_client_feedback_prompt ?? '',
        assessor: configMap.ai_assessor_prompt ?? '',
      })
      setVisibility({
        exam: configMap.tool_exam_visible !== 'false',
        transcript: configMap.tool_transcript_visible !== 'false',
        ai: configMap.tool_ai_visible !== 'false',
        audio: configMap.tool_audio_visible !== 'false',
      })

      // Load tile colors (use defaults from TOOLS if not in config)
      const colors = {}
      TOOLS.forEach(tool => {
        colors[tool.id] = {
          bg: configMap[`tool_${tool.id}_card_bg`] || tool.cardBg,
          color: configMap[`tool_${tool.id}_card_color`] || tool.cardColor,
          tagColor: configMap[`tool_${tool.id}_tag_color`] || tool.tagColor,
          tagTextColor: configMap[`tool_${tool.id}_tag_text_color`] || tool.tagTextColor,
        }
      })
      setTileColors(colors)

      if (questionsRes.data) setQuestions(questionsRes.data)
    } catch (e) {
      setToolError(e.message)
    }

    setToolLoading(false)
  }

  async function handleToolContentSave(toolId) {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)

    const tool = TOOLS.find(t => t.id === toolId)
    const keysToSave = [
      `${tool.contentPrefix}_card_tag`,
      `${tool.contentPrefix}_card_title`,
      `${tool.contentPrefix}_card_description`,
      `${tool.contentPrefix}_start_badge`,
      `${tool.contentPrefix}_start_title`,
      `${tool.contentPrefix}_start_subtitle`,
      `${tool.contentPrefix}_start_info_1`,
      `${tool.contentPrefix}_start_info_2`,
      `${tool.contentPrefix}_start_info_3`,
    ]

    const upsertRows = keysToSave.map(key => ({ key, value: contentValues[key] ?? '' }))
    const { error } = await supabase.from('site_content').upsert(upsertRows, { onConflict: 'key' })

    if (error) {
      setToolError(error.message)
    }
    setToolLoading(false)
  }

  async function handleToolPromptsSave(toolId) {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)

    const updates = [
      { key: 'ai_client_chatbot_prompt', value: prompts.aiClientChatbot },
      { key: 'ai_client_feedback_prompt', value: prompts.aiClientFeedback },
      { key: 'ai_assessor_prompt', value: prompts.assessor },
    ]

    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    if (error) {
      setToolError(error.message)
    } else {
      setToolSuccess('Prompts saved.')
    }
    setToolLoading(false)
  }

  async function handleToolApiKeysSave(toolId) {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)

    const updates = [
      { key: 'api_key_chatbot', value: apiKeys.chatbot },
      { key: 'api_key_feedback', value: apiKeys.feedback },
      { key: 'api_key_assessor', value: apiKeys.assessor },
    ]

    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    if (error) {
      setToolError(error.message)
    } else {
      setToolSuccess('API keys saved.')
    }
    setToolLoading(false)
  }

  async function handleToolVisibilitySave(toolId, newValue) {
    const key = `tool_${toolId}_visible`
    const { error } = await supabase.from('config').upsert({ key, value: newValue ? 'true' : 'false' }, { onConflict: 'key' })
    if (error) {
      setToolError(error.message)
    }
  }

  async function handleTileColorsSave(toolId) {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)

    const colors = tileColors[toolId]
    const updates = [
      { key: `tool_${toolId}_card_bg`, value: colors.bg },
      { key: `tool_${toolId}_card_color`, value: colors.color },
      { key: `tool_${toolId}_tag_color`, value: colors.tagColor },
      { key: `tool_${toolId}_tag_text_color`, value: colors.tagTextColor },
    ]

    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    if (error) {
      setToolError(error.message)
    } else {
      setToolSuccess('Tile colors saved.')
    }
    setToolLoading(false)
  }

  // ── Questions functions ──
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
    await loadToolSettings()
    setQSubmitting(false)
  }

  async function handleToggleActive(q) {
    const { error } = await supabase
      .from('questions')
      .update({ is_active: !q.is_active, updated_at: new Date().toISOString() })
      .eq('id', q.id)
    if (error) alert(error.message)
    else await loadToolSettings()
  }

  async function handleDeleteQuestion(q) {
    if (!window.confirm(`Delete this question? This cannot be undone.`)) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) alert(error.message)
    else {
      setQSuccess('Question deleted.')
      await loadToolSettings()
    }
  }

  const filteredQuestions = questions.filter(q => {
    const matchComp = !qFilter || q.competency === qFilter
    const matchSearch = !qSearch || q.question.toLowerCase().includes(qSearch.toLowerCase())
    return matchComp && matchSearch
  })

  // ── User functions ──
  function handleInviteChange(e) {
    setInviteForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleEditUserChange(e) {
    const val = e.target.name === 'is_active' ? e.target.value === 'true' : e.target.value
    setEditUserForm(f => ({ ...f, [e.target.name]: val }))
  }

  function openEditUser(user) {
    setEditUserForm(user)
    setEditUserError(null)
    setEditingUser(user)
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setUserError(null)
    setInviteSubmitting(true)

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: inviteForm.full_name,
        email: inviteForm.email,
        role: inviteForm.role,
        cohortId: inviteForm.cohort_id || null,
        mentorCoachId: inviteForm.mentor_coach_id || null,
      }),
    })

    const result = await res.json()
    if (!res.ok) {
      setUserError(result.error || 'Invite failed')
    } else {
      setSuccessMsg(`Invite sent to ${inviteForm.full_name}`)
      setShowInviteForm(false)
      setInviteForm(EMPTY_USER_FORM)
      await loadUsers()
    }
    setInviteSubmitting(false)
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault()
    setEditUserError(null)
    setEditUserSubmitting(true)

    const { error } = await supabase.from('users').update({
      full_name: editUserForm.full_name,
      role: editUserForm.role,
      cohort_id: editUserForm.cohort_id || null,
      mentor_coach_id: editUserForm.mentor_coach_id || null,
      is_active: editUserForm.is_active,
    }).eq('id', editUserForm.id)

    if (error) {
      setEditUserError(error.message)
    } else {
      setSuccessMsg(`${editUserForm.full_name} updated.`)
      setEditingUser(null)
      await loadUsers()
    }
    setEditUserSubmitting(false)
  }

  async function handleResendInvite(user) {
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, resend: true }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Error: ${result.error}`)
    else {
      setSuccessMsg(`Invite resent to ${user.email}`)
      await loadUsers()
    }
  }

  async function handleResetPassword(user) {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Error: ${result.error}`)
    else {
      setSuccessMsg(`Reset link sent to ${user.email}`)
      await loadUsers()
    }
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

  // ── Tool tab renderer ──
  const renderToolTab = (tool) => (
    <div key={tool.id}>
      <div style={s.titleRow}>
        <h1 style={s.heading}>{tool.label}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: COLORS['text-main'], fontWeight: 500 }}>
            {visibility[tool.id] ? 'Visible to participants' : 'Hidden from participants'}
          </span>
          <input
            type="checkbox"
            checked={visibility[tool.id]}
            onChange={(e) => {
              const newValue = e.target.checked
              setVisibility(v => ({ ...v, [tool.id]: newValue }))
              handleToolVisibilitySave(tool.id, newValue)
            }}
            style={{
              width: '44px',
              height: '24px',
              cursor: 'pointer',
              accentColor: COLORS.teal,
            }}
          />
        </div>
      </div>

      {toolError && <p style={s.errorMsg}>{toolError}</p>}
      {toolSuccess && <p style={s.successBanner}>{toolSuccess}</p>}

      {/* Dashboard Tile Preview + Content */}
      <div style={s.formCard}>
        <h2 style={s.formHeading}>Dashboard Tile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Live preview */}
          <div style={s.tilePreview}>
            <div style={{ ...s.tileIconBox, background: tileColors[tool.id]?.bg || tool.cardBg }}>
              <ToolIcon id={tool.id} size={16} color={tileColors[tool.id]?.color || tool.cardColor} />
            </div>
            <div style={s.tileTitle}>{contentValues[`${tool.contentPrefix}_card_title`] ?? TOOL_DEFAULTS[tool.id]?.title ?? 'Title'}</div>
            <div style={s.tileDesc}>{contentValues[`${tool.contentPrefix}_card_description`] ?? TOOL_DEFAULTS[tool.id]?.desc ?? 'Description'}</div>
            <div style={s.tileDivider}></div>
            <div style={s.tileFooter}>
              <span style={{ ...s.tilePill, background: tileColors[tool.id]?.tagColor || tool.tagColor, color: tileColors[tool.id]?.tagTextColor || tool.tagTextColor }}>
                {contentValues[`${tool.contentPrefix}_card_tag`] ?? TOOL_DEFAULTS[tool.id]?.tag ?? 'Tag'}
              </span>
            </div>
          </div>

          {/* Tile inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={s.label}>
              Tag
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_card_tag`] ?? TOOL_DEFAULTS[tool.id]?.tag ?? ''}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_card_tag`]: e.target.value }))}
                style={s.input}
                placeholder="e.g., Knowledge"
              />
            </label>
            <label style={s.label}>
              Title
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_card_title`] ?? TOOL_DEFAULTS[tool.id]?.title ?? tool.label}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_card_title`]: e.target.value }))}
                style={s.input}
                placeholder={tool.label}
              />
            </label>
            <label style={s.label}>
              Description
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_card_description`] ?? TOOL_DEFAULTS[tool.id]?.desc ?? ''}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_card_description`]: e.target.value }))}
                style={s.input}
                placeholder="Brief description"
              />
            </label>
            <button onClick={() => handleToolContentSave(tool.id)} disabled={toolLoading} style={s.submitBtn}>
              {toolLoading ? 'Saving…' : 'Save Tile'}
            </button>
          </div>
        </div>

        {/* Tile Colors */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e6ec' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: COLORS['text-main'] }}>Tile Colors</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <label style={s.label}>
              Background
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={tileColors[tool.id]?.bg || tool.cardBg}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], bg: e.target.value } }))}
                  style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={tileColors[tool.id]?.bg || tool.cardBg}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], bg: e.target.value } }))}
                  style={{ ...s.input, flex: 1, fontSize: '12px' }}
                />
              </div>
            </label>
            <label style={s.label}>
              Icon Color
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={tileColors[tool.id]?.color || tool.cardColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], color: e.target.value } }))}
                  style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={tileColors[tool.id]?.color || tool.cardColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], color: e.target.value } }))}
                  style={{ ...s.input, flex: 1, fontSize: '12px' }}
                />
              </div>
            </label>
            <label style={s.label}>
              Tag Background
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={tileColors[tool.id]?.tagColor || tool.tagColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], tagColor: e.target.value } }))}
                  style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={tileColors[tool.id]?.tagColor || tool.tagColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], tagColor: e.target.value } }))}
                  style={{ ...s.input, flex: 1, fontSize: '12px' }}
                />
              </div>
            </label>
            <label style={s.label}>
              Tag Text
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={tileColors[tool.id]?.tagTextColor || tool.tagTextColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], tagTextColor: e.target.value } }))}
                  style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={tileColors[tool.id]?.tagTextColor || tool.tagTextColor}
                  onChange={e => setTileColors(v => ({ ...v, [tool.id]: { ...v[tool.id], tagTextColor: e.target.value } }))}
                  style={{ ...s.input, flex: 1, fontSize: '12px' }}
                />
              </div>
            </label>
          </div>
          <button onClick={() => handleTileColorsSave(tool.id)} disabled={toolLoading} style={{ ...s.submitBtn, marginTop: '12px' }}>
            {toolLoading ? 'Saving…' : 'Save Colors'}
          </button>
        </div>
      </div>

      {/* Setup Page Content */}
      <div style={s.formCard}>
        <h2 style={s.formHeading}>Setup Page Content</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Preview */}
          <div style={{
            background: COLORS['gray-light'],
            border: `1px solid ${COLORS['gray-border']}`,
            borderRadius: '10px',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {(contentValues[`${tool.contentPrefix}_start_badge`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.badge) && (
              <div style={{ display: 'inline-block', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', width: 'fit-content' }}>
                {contentValues[`${tool.contentPrefix}_start_badge`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.badge}
              </div>
            )}
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: COLORS.navy, letterSpacing: '-0.3px' }}>
              {contentValues[`${tool.contentPrefix}_start_title`] ?? tool.label}
            </h2>
            {(contentValues[`${tool.contentPrefix}_start_subtitle`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.subtitle) && (
              <p style={{ fontSize: '13px', color: COLORS['text-muted'], margin: 0, lineHeight: '1.5' }}>
                {contentValues[`${tool.contentPrefix}_start_subtitle`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.subtitle}
              </p>
            )}
            {[1, 2, 3].map(i => {
              const infoValue = contentValues[`${tool.contentPrefix}_start_info_${i}`];
              if (!infoValue) return null;
              return (
                <div key={`info_${i}`} style={{ fontSize: '12px', lineHeight: '1.6', color: COLORS['text-main'], margin: '4px 0' }}>
                  • {infoValue}
                </div>
              );
            })}
          </div>

          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={s.label}>
              Badge
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_start_badge`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.badge ?? ''}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_start_badge`]: e.target.value }))}
                style={s.input}
              />
            </label>
            <label style={s.label}>
              Title
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_start_title`] ?? tool.label ?? ''}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_start_title`]: e.target.value }))}
                style={s.input}
                placeholder={tool.label}
              />
            </label>
            <label style={s.label}>
              Subtitle
              <input
                type="text"
                value={contentValues[`${tool.contentPrefix}_start_subtitle`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.subtitle ?? ''}
                onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_start_subtitle`]: e.target.value }))}
                style={s.input}
              />
            </label>
            {[1, 2, 3].map(i => (
              <label key={`info_${i}`} style={s.label}>
                Info Item {i}
                <input
                  type="text"
                  value={contentValues[`${tool.contentPrefix}_start_info_${i}`] ?? ''}
                  onChange={e => setContentValues(v => ({ ...v, [`${tool.contentPrefix}_start_info_${i}`]: e.target.value }))}
                  style={s.input}
                  placeholder={`Info item ${i}`}
                />
              </label>
            ))}
            <button onClick={() => handleToolContentSave(tool.id)} disabled={toolLoading} style={s.submitBtn}>
              {toolLoading ? 'Saving…' : 'Save Page Content'}
            </button>
          </div>
        </div>
      </div>

      {/* System Prompts (if applicable) */}
      {tool.hasPrompts && !tool.placeholder && (
        <div style={s.formCard}>
          <h2 style={s.formHeading}>System Prompts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tool.promptKeys.map((key, i) => (
              <label key={key} style={s.label}>
                {tool.promptLabels[i]}
                <textarea
                  value={prompts[key === 'ai_client_chatbot_prompt' ? 'aiClientChatbot' : key === 'ai_client_feedback_prompt' ? 'aiClientFeedback' : 'assessor'] || ''}
                  onChange={e => {
                    const field = key === 'ai_client_chatbot_prompt' ? 'aiClientChatbot' : key === 'ai_client_feedback_prompt' ? 'aiClientFeedback' : 'assessor'
                    setPrompts(v => ({ ...v, [field]: e.target.value }))
                  }}
                  style={{ ...s.textarea, fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '200px' }}
                />
              </label>
            ))}
            <button onClick={() => handleToolPromptsSave(tool.id)} disabled={toolLoading} style={s.submitBtn}>
              {toolLoading ? 'Saving…' : 'Save Prompts'}
            </button>
          </div>
        </div>
      )}

      {tool.placeholder && (
        <div style={s.formCard}>
          <p style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>Prompts coming soon…</p>
        </div>
      )}

      {/* API Keys (if applicable) */}
      {tool.hasApiKeys && !tool.placeholder && (
        <div style={s.formCard}>
          <h2 style={s.formHeading}>API Keys</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tool.apiKeyKeys.map((key, i) => (
              <label key={key} style={s.label}>
                {tool.apiKeyLabels[i]}
                <input
                  type="password"
                  value={apiKeys[key === 'api_key_chatbot' ? 'chatbot' : key === 'api_key_feedback' ? 'feedback' : 'assessor'] || ''}
                  onChange={e => {
                    const field = key === 'api_key_chatbot' ? 'chatbot' : key === 'api_key_feedback' ? 'feedback' : 'assessor'
                    setApiKeys(v => ({ ...v, [field]: e.target.value }))
                  }}
                  style={s.input}
                  placeholder="sk-..."
                />
              </label>
            ))}
            <button onClick={() => handleToolApiKeysSave(tool.id)} disabled={toolLoading} style={s.submitBtn}>
              {toolLoading ? 'Saving…' : 'Save API Keys'}
            </button>
          </div>
        </div>
      )}

      {/* Exam Questions (if applicable) */}
      {tool.hasQuestions && (
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
              <h2 style={s.formHeading}>{editingQuestion === 'new' ? 'Add New Question' : 'Edit Question'}</h2>
              <form onSubmit={handleQSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={s.formGrid2}>
                    <label style={s.label}>
                      Competency
                      <select name="competency" value={qForm.competency} onChange={handleQFormChange} style={s.input}>
                        {COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label style={s.label}>
                      Correct Answer
                      <select name="correct" value={qForm.correct} onChange={handleQFormChange} style={s.input}>
                        {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </label>
                    <label style={s.label}>
                      Status
                      <select name="is_active" value={String(qForm.is_active)} onChange={handleQFormChange} style={s.input}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </label>
                  </div>

                  <label style={s.label}>
                    Question
                    <textarea name="question" value={qForm.question} onChange={handleQFormChange} required rows={4} style={s.textarea} placeholder="Describe the coaching scenario and ask the question..." />
                  </label>

                  <div style={s.formGrid}>
                    {['a', 'b', 'c', 'd'].map(letter => (
                      <label key={letter} style={s.label}>
                        Option {letter.toUpperCase()}
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

                  <label style={s.label}>
                    Explanation (shown after incorrect answer)
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
                  {questions.length === 0 ? 'No questions yet — add one above.' : 'No questions match your filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )

  // ── Users tab ──
  const usersContent = (
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
  )

  return (
    <Layout active="admin" pageTitle="Dashboard">
      <div style={s.tabBar}>
        {[{ id: 'users', label: 'Users' }, ...TOOLS.map(t => ({ id: `tool-${t.id}`, label: t.label }))].map(tab => (
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
        {activeTab === 'users' && usersContent}
        {activeTab.startsWith('tool-') && renderToolTab(TOOLS.find(t => `tool-${t.id}` === activeTab))}
      </div>
    </Layout>
  )
}

const s = {
  tabBar: {
    display: 'flex',
    gap: 0,
    background: '#fff',
    borderRadius: '10px',
    marginBottom: 0,
    padding: '4px',
  },
  tab: {
    padding: '0.85rem 1.25rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: COLORS['text-muted'],
    fontFamily: 'Montserrat, sans-serif',
    transition: 'all 0.2s',
    borderRadius: '8px',
    boxShadow: 'none',
  },
  tabActive: { color: COLORS.navy, fontWeight: '600', background: 'rgba(0, 32, 91, 0.05)', boxShadow: 'none' },
  content: {
    padding: '28px 32px',
    flex: 1,
    background: COLORS['gray-light'],
    overflowY: 'auto',
  },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { fontSize: '1.75rem', fontWeight: '700', color: '#00205B', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  countBadge: {
    fontSize: '0.85rem',
    fontWeight: '600',
    background: '#e8ecf5',
    color: '#00205B',
    borderRadius: '20px',
    padding: '0.15rem 0.6rem',
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
    fontFamily: 'Montserrat, sans-serif',
  },
  visibilityBtn: {
    border: '1px solid transparent',
    borderRadius: '20px',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
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
  errorMsg: {
    color: '#b91c1c',
    fontSize: '0.875rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    marginBottom: '1rem',
  },
  formCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '1.75rem',
    marginBottom: '1.75rem',
  },
  formHeading: { fontSize: '1.1rem', fontWeight: '600', color: '#00205B', marginBottom: '1.25rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' },
  formGrid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
  input: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#111', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' },
  textarea: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', color: '#111', background: '#fff', outline: 'none', resize: 'vertical', fontFamily: 'Montserrat, sans-serif', lineHeight: '1.5' },
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
  tilePreview: {
    background: '#fff',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 10,
    padding: '16px 16px',
    display: 'flex',
    flexDirection: 'column',
  },
  tileIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.navy,
    marginBottom: 3,
  },
  tileDesc: {
    fontSize: 10,
    color: COLORS['text-muted'],
    marginBottom: 10,
  },
  tileDivider: {
    height: 1,
    background: COLORS['gray-border'],
    margin: '10px 0',
  },
  tileFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  tilePill: {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
}

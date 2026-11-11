import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'
import Layout from '../components/Layout'
import { getDefaultClientPrompt } from '../lib/prompts'
import { LOGIN_GROUPS, LOGIN_FIELDS } from '../lib/loginContent'
import { TRANSCRIPT_START_DEFAULTS } from '../lib/transcriptStartDefaults'

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
  assessor: { tag: 'Assessment', title: 'Internal Assessor (2021)', desc: 'AI-powered session evaluation' },
  assessor2025: { tag: 'Assessment', title: 'Internal Assessor (2025)', desc: 'Nov 2025 BARS evaluation' },
}

// What each start page shows when nothing is saved. Only the Transcript Reviewer has built-in text; the others start blank.
const TOOL_PAGE_DEFAULTS = {
  transcript: {
    badge: TRANSCRIPT_START_DEFAULTS.transcript_start_badge,
    title: TRANSCRIPT_START_DEFAULTS.transcript_start_title,
    subtitle: TRANSCRIPT_START_DEFAULTS.transcript_start_subtitle,
    info: [TRANSCRIPT_START_DEFAULTS.transcript_start_info_1, TRANSCRIPT_START_DEFAULTS.transcript_start_info_2, TRANSCRIPT_START_DEFAULTS.transcript_start_info_3],
  },
}

// The tools, as they are published. group: 'published' (in the main sidebar) or 'progress' (still being built).
//   pageContent: has a start page whose text is editable here   dashboard: has a tile on the old participant dashboard
const TOOLS = [
  {
    id: 'transcript',
    label: 'Transcript Reviewer',
    group: 'published',
    note: 'Used by students (with an access code) and by older participant accounts. Its AI key also powers the Session Observation Form.',
    contentPrefix: 'transcript',
    pageContent: true,
    dashboard: true,
    hasPrompts: true,
    promptKeys: ['transcript_reviewer_prompt'],
    promptLabels: ['System Prompt'],
    hasApiKeys: true,
    apiKeyKeys: ['api_key_transcript'],
    apiKeyLabels: ['API Key'],
    cardBg: '#fff0e0', cardColor: '#ea580c', tagColor: '#fef3c7', tagTextColor: '#92400e',
  },
  {
    id: 'observation',
    label: 'Session Observation Form',
    group: 'published',
    info: true,
    cardBg: '#e6f7fc', cardColor: '#0284c7', tagColor: '#e8ecf5', tagTextColor: '#00205B',
  },
  {
    id: 'assessor',
    label: 'Internal Assessor',
    group: 'published',
    note: 'One tool with a 2021 and a 2025 version. Each version has its own prompt and its own AI key.',
    contentPrefix: 'assessor',
    hasPrompts: true,
    promptKeys: ['ai_assessor_prompt', 'ai_assessor_2025_prompt'],
    promptLabels: ['System Prompt (2021 version)', 'System Prompt (2025 version, Nov 2025 BARS Guide)'],
    hasApiKeys: true,
    apiKeyKeys: ['api_key_assessor', 'api_key_assessor_2025'],
    apiKeyLabels: ['API Key (2021 version)', 'API Key (2025 version)'],
    cardBg: '#f3e8ff', cardColor: '#7c3aed', tagColor: '#ede9fe', tagTextColor: '#5b21b6',
  },
  {
    id: 'audio',
    label: 'Audio to Transcript',
    group: 'published',
    note: 'For admin accounts only. Audio goes from the browser straight to Deepgram and is never stored.',
    contentPrefix: 'audio',
    hasApiKeys: true,
    apiKeyKeys: ['api_key_audio'],
    apiKeyLabels: ['Deepgram API Key'],
    cardBg: '#f0f2f5', cardColor: '#7C7E7F', tagColor: '#e2e6ec', tagTextColor: '#6b7a99',
  },
  {
    id: 'exam',
    label: 'ACC Practice Exam',
    group: 'progress',
    note: 'Still in progress. Participant accounts and admins can open it.',
    contentPrefix: 'exam',
    pageContent: true,
    dashboard: true,
    hasQuestions: true,
    cardBg: '#e6f7fc', cardColor: '#0284c7', tagColor: '#e8ecf5', tagTextColor: '#00205B',
  },
  {
    id: 'ai',
    label: 'AI Client',
    group: 'progress',
    note: 'Still in progress. Participant accounts and admins can open it.',
    contentPrefix: 'ai',
    pageContent: true,
    dashboard: true,
    hasPrompts: true,
    promptKeys: ['ai_client_chatbot_prompt', 'ai_client_feedback_prompt'],
    promptLabels: ['Chatbot System Prompt', 'Feedback Bot System Prompt'],
    hasApiKeys: true,
    apiKeyKeys: ['api_key_chatbot', 'api_key_feedback'],
    apiKeyLabels: ['Chatbot API Key', 'Feedback Bot API Key'],
    cardBg: '#fff0e0', cardColor: '#ea580c', tagColor: '#fef3c7', tagTextColor: '#92400e',
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
    assessor: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <circle cx="8" cy="4" r="2" />
        <path d="M5 8c0-1.7 1.3-3 3-3s3 1.3 3 3" />
        <path d="M3 11c0-2.2 1.8-4 4-4s4 1.8 4 4" />
        <line x1="1.5" y1="14.5" x2="14.5" y2="14.5" strokeWidth="1.5" />
      </svg>
    ),
    assessor2025: (
      <svg width={size} height={size} viewBox="0 0 16 16" style={s}>
        <circle cx="8" cy="4" r="2" />
        <path d="M5 8c0-1.7 1.3-3 3-3s3 1.3 3 3" />
        <path d="M3 11c0-2.2 1.8-4 4-4s4 1.8 4 4" />
        <line x1="1.5" y1="14.5" x2="14.5" y2="14.5" strokeWidth="1.5" />
      </svg>
    ),
  }
  return icons[id] || null
}

// section 'users'  = Users and Access Codes tabs (Admin Tools)
// section 'config' = one tab per tool (Tool Configuration)
export default function AdminPanel({ section = 'users' }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState(section === 'config' ? `tool-${TOOLS[0].id}` : 'users')

  // ── Users state ──
  const [users, setUsers] = useState([])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_USER_FORM)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editUserForm, setEditUserForm] = useState({})
  const [editUserSubmitting, setEditUserSubmitting] = useState(false)
  const [editUserError, setEditUserError] = useState(null)
  const [userError, setUserError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  // ── Tool content/settings state ──
  const [contentValues, setContentValues] = useState({})
  // API keys are write-only: the browser never receives a saved key, only whether one is saved.
  const [apiKeyInputs, setApiKeyInputs] = useState({})
  const [apiKeyStatus, setApiKeyStatus] = useState({})
  const [prompts, setPrompts] = useState({})
  const [visibility, setVisibility] = useState({ exam: true, transcript: true, ai: true })
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

  // ── Access codes state ──
  const [accessCodes, setAccessCodes] = useState([])
  const [accessCodesLoading, setAccessCodesLoading] = useState(false)
  const [newCodeForm, setNewCodeForm] = useState({ code: '', label: '', role: 'student', expiresAt: '' })
  const [accessCodeError, setAccessCodeError] = useState(null)
  const [accessCodeSuccess, setAccessCodeSuccess] = useState(null)
  const [accessCodeSubmitting, setAccessCodeSubmitting] = useState(false)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    setToolError(null)
    setToolSuccess(null)
    if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab.startsWith('tool-') || activeTab === 'signin') {
      loadToolSettings()
    } else if (activeTab === 'access-codes') {
      loadAccessCodes()
    }
  }, [activeTab])

  async function loadUsers() {
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (usersData) setUsers(usersData)
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
      try {
        const statusRes = await authFetch('/api/user-actions?action=api-key-status', { method: 'POST' })
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          setApiKeyStatus(statusData.set || {})
        }
      } catch {
        // Status badges are cosmetic; ignore failures.
      }
      setPrompts({
        ai_client_chatbot_prompt: configMap.ai_client_chatbot_prompt ?? getDefaultClientPrompt(),
        ai_client_feedback_prompt: configMap.ai_client_feedback_prompt ?? '',
        ai_assessor_prompt: configMap.ai_assessor_prompt ?? '',
        ai_assessor_2025_prompt: configMap.ai_assessor_2025_prompt ?? '',
        transcript_reviewer_prompt: configMap.transcript_reviewer_prompt ?? '',
      })
      setVisibility({
        exam: configMap.tool_exam_visible !== 'false',
        transcript: configMap.tool_transcript_visible !== 'false',
        ai: configMap.tool_ai_visible !== 'false',
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

  async function handleSignInSave() {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)
    // A blank box saves as blank, and a blank box means "use the default text".
    const rows = LOGIN_FIELDS.map(f => ({ key: f.key, value: (contentValues[f.key] ?? '').trim() }))
    const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'key' })
    if (error) setToolError(error.message)
    else setToolSuccess('Sign-in page text saved. Reload a sign-in page to see it.')
    setToolLoading(false)
  }

  async function handleToolPromptsSave(toolId) {
    setToolLoading(true)
    setToolError(null)
    setToolSuccess(null)

    // Save only this tool's prompts, so one tab can never overwrite another tool's prompt.
    const tool = TOOLS.find(t => t.id === toolId)
    const updates = tool.promptKeys.map(key => ({ key, value: prompts[key] ?? '' }))

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

    const tool = TOOLS.find(t => t.id === toolId)
    // Save only the keys the admin typed in. Blank boxes leave the saved key alone.
    const toSave = (tool.apiKeyKeys || []).filter(k => (apiKeyInputs[k] || '').trim())

    if (toSave.length === 0) {
      setToolError('Type a new key into at least one box to save.')
      setToolLoading(false)
      return
    }

    try {
      for (const key of toSave) {
        const res = await authFetch('/api/user-actions?action=api-key-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: apiKeyInputs[key] }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Could not save API key')
        }
      }
      setApiKeyInputs(v => {
        const next = { ...v }
        toSave.forEach(k => { delete next[k] })
        return next
      })
      setApiKeyStatus(v => {
        const next = { ...v }
        toSave.forEach(k => { next[k] = true })
        return next
      })
      setToolSuccess('API keys saved.')
    } catch (e) {
      setToolError(e.message)
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

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    let aVal = a[sortColumn]
    let bVal = b[sortColumn]

    // Handle null values
    if (aVal === null || aVal === undefined) aVal = ''
    if (bVal === null || bVal === undefined) bVal = ''

    // Case-insensitive string comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    // Number comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  function openEditUser(user) {
    setEditUserForm(user)
    setEditUserError(null)
    setEditingUser(user)
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setUserError(null)
    setInviteSubmitting(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const res = await authFetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          full_name: inviteForm.full_name,
          email: inviteForm.email,
          role: inviteForm.role,
        }),
      })

      clearTimeout(timeoutId)

      let result
      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        result = await res.json()
      } else {
        const text = await res.text()
        console.error('Non-JSON response:', res.status, text)
        setUserError(`Server error (${res.status}): ${text || 'Unknown error'}`)
        setInviteSubmitting(false)
        return
      }

      if (!res.ok) {
        setUserError(result.error || 'Invite failed')
      } else {
        setSuccessMsg(`Invite sent to ${inviteForm.full_name}`)
        setShowInviteForm(false)
        setInviteForm(EMPTY_USER_FORM)
        await loadUsers()
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setUserError('Request timed out. Please check your connection and try again.')
      } else {
        setUserError(err.message || 'Failed to send invite')
      }
    }
    setInviteSubmitting(false)
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault()
    setEditUserError(null)
    setEditUserSubmitting(true)

    try {
      // Update user through API (uses service role key for privileged operations)
      const res = await authFetch('/api/user-actions?action=profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUserForm.id,
          full_name: editUserForm.full_name,
          email: editUserForm.email,
          role: editUserForm.role,
          is_active: editUserForm.is_active,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        setEditUserError(result.error || 'Failed to update user')
      } else {
        setSuccessMsg(`${editUserForm.full_name} updated.`)
        setEditingUser(null)
        await loadUsers()
      }
    } catch (err) {
      setEditUserError(err.message)
    }
    setEditUserSubmitting(false)
  }

  async function handleResendInvite(user) {
    const res = await authFetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, full_name: user.full_name, role: user.role }),
    })
    const result = await res.json()
    if (!res.ok) alert(`Error: ${result.error}`)
    else {
      setSuccessMsg(`Invite resent to ${user.email}`)
      await loadUsers()
    }
  }

  async function handleResetPassword(user) {
    const res = await authFetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
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
    const res = await authFetch('/api/delete-user', {
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

  // ── Access codes functions ──
  async function loadAccessCodes() {
    setAccessCodesLoading(true)
    try {
      const res = await authFetch('/api/access-codes?action=list')
      const data = await res.json()
      setAccessCodes(data.codes || [])
    } catch {
      setAccessCodeError('Failed to load access codes.')
    } finally {
      setAccessCodesLoading(false)
    }
  }

  async function createAccessCode(e) {
    e.preventDefault()
    if (!newCodeForm.code.trim() || !newCodeForm.label.trim()) return
    setAccessCodeError(null)
    setAccessCodeSuccess(null)
    setAccessCodeSubmitting(true)
    try {
      const res = await authFetch('/api/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCodeForm.code.trim(), label: newCodeForm.label.trim(), role: newCodeForm.role, expiresAt: newCodeForm.expiresAt || null }),
      })
      const data = await res.json()
      if (!res.ok) { setAccessCodeError(data.error || 'Failed to create code.'); return }
      setAccessCodeSuccess(`Code "${newCodeForm.code}" created.`)
      setNewCodeForm({ code: '', label: '', role: 'student', expiresAt: '' })
      loadAccessCodes()
    } catch {
      setAccessCodeError('Something went wrong.')
    } finally {
      setAccessCodeSubmitting(false)
    }
  }

  async function toggleAccessCode(id, active) {
    setAccessCodeError(null)
    setAccessCodeSuccess(null)
    try {
      const res = await authFetch('/api/access-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
      if (!res.ok) { setAccessCodeError('Failed to update code.'); return }
      setAccessCodeSuccess(active ? 'Code activated.' : 'Code deactivated.')
      loadAccessCodes()
    } catch {
      setAccessCodeError('Something went wrong.')
    }
  }

  async function clearCodeData(id, label) {
    const typed = window.prompt(`Delete everything saved under "${label}" (observation drafts, saved transcripts, assessments)? This cannot be undone.\n\nType DELETE to confirm.`)
    if (typed !== 'DELETE') return
    setAccessCodeError(null)
    setAccessCodeSuccess(null)
    try {
      const res = await authFetch('/api/user-actions?action=purge-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId: id, confirm: 'DELETE' }),
      })
      const body = await res.json()
      if (!res.ok) { setAccessCodeError(body.error || 'Could not delete the saved data.'); return }
      const n = (body.results || []).reduce((a, r) => a + (r.before || 0), 0)
      setAccessCodeSuccess(`Deleted ${n} saved record${n === 1 ? '' : 's'} for "${label}".`)
    } catch {
      setAccessCodeError('Something went wrong.')
    }
  }

  async function deleteAccessCode(id, code) {
    if (!window.confirm(`Delete code "${code}"? This cannot be undone.`)) return
    setAccessCodeError(null)
    setAccessCodeSuccess(null)
    try {
      const res = await authFetch('/api/access-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { setAccessCodeError('Failed to delete code.'); return }
      setAccessCodeSuccess('Code deleted.')
      loadAccessCodes()
    } catch {
      setAccessCodeError('Something went wrong.')
    }
  }

  const renderAccessCodesTab = () => (
    <div>
      <div style={s.titleRow}>
        <h1 style={s.heading}>Access Codes</h1>
      </div>
      <p style={{ fontSize: '13px', color: COLORS['text-muted'], marginBottom: '24px', lineHeight: '1.6' }}>
        Student codes open the Transcript Reviewer with no account. Mentor coach and Admin codes work once: the person uses the code to create an account (email and password), then signs in with those from then on. Share the link <strong>/access</strong> and a code.
        <strong> Student</strong> codes open the Transcript Reviewer (anonymous, no history is saved).
        <strong> Mentor coach</strong> codes open the Session Observation Form only.
        <strong> Admin</strong> codes open the Internal Assessor, Audio to Transcript, and the Session Observation Form, with no access to history, users, or analytics.
        Give each mentor coach their own code: saved observations belong to the code, so people who share one code see each other&rsquo;s work.
      </p>

      {accessCodeError && <div style={{ background: '#fff3e6', border: '1px solid #ffe0b2', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#00205B', marginBottom: '16px' }}>{accessCodeError}</div>}
      {accessCodeSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#15803d', marginBottom: '16px' }}>{accessCodeSuccess}</div>}

      {/* Add new code form */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add New Access Code</h3>
        <form onSubmit={createAccessCode} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: COLORS['text-main'], marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</label>
            <input
              type="text"
              value={newCodeForm.code}
              onChange={e => setNewCodeForm(v => ({ ...v, code: e.target.value }))}
              placeholder="e.g. CoachRICE2026"
              required
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #e2e6ec', padding: '0 12px', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: COLORS['text-main'], marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Label</label>
            <input
              type="text"
              value={newCodeForm.label}
              onChange={e => setNewCodeForm(v => ({ ...v, label: e.target.value }))}
              placeholder="e.g. CoachRICE Spring 2026 Cohort"
              required
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #e2e6ec', padding: '0 12px', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: COLORS['text-main'], marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</label>
            <select
              value={newCodeForm.role}
              onChange={e => setNewCodeForm(v => ({ ...v, role: e.target.value }))}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #e2e6ec', padding: '0 8px', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', background: '#fff' }}
            >
              <option value="student">Student</option>
              <option value="mentor">Mentor coach (one-time sign-up)</option>
              <option value="admin">Admin, tools only (one-time sign-up)</option>
            </select>
          </div>
          <div style={{ minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: COLORS['text-main'], marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expires (optional)</label>
            <input
              type="date"
              value={newCodeForm.expiresAt}
              onChange={e => setNewCodeForm(v => ({ ...v, expiresAt: e.target.value }))}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #e2e6ec', padding: '0 10px', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={accessCodeSubmitting || !newCodeForm.code.trim() || !newCodeForm.label.trim()}
            style={{ height: '38px', padding: '0 20px', background: COLORS.navy, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', opacity: accessCodeSubmitting ? 0.7 : 1 }}
          >
            {accessCodeSubmitting ? 'Adding…' : '+ Add Code'}
          </button>
        </form>
      </div>

      {/* Existing codes table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f7f8fa' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Label</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Used</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last used</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accessCodesLoading ? (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>Loading…</td></tr>
            ) : accessCodes.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No access codes yet. Add one above.</td></tr>
            ) : accessCodes.map(ac => (
              <tr key={ac.id} style={{ borderTop: '1px solid #f0f2f5' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: COLORS.navy, fontFamily: 'monospace', fontSize: '13px' }}>{ac.code}</td>
                <td style={{ padding: '12px 16px', color: COLORS['text-main'] }}>{ac.label}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS['text-main'] }}>
                  {{ student: 'Student', mentor: 'Mentor coach (one-time)', admin: 'Admin (one-time)' }[ac.role || 'student']}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {(() => {
                    const expired = ac.expires_at && new Date(ac.expires_at) < new Date()
                    const on = ac.active && !expired && !ac.used_at
                    return (
                      <>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: on ? '#dcfce7' : '#f3f4f6', color: on ? '#16a34a' : '#6b7a99' }}>
                          {ac.used_at ? 'Used' : expired ? 'Expired' : ac.active ? 'Active' : 'Inactive'}
                        </span>
                        {ac.used_at && (
                          <div style={{ fontSize: '10px', color: COLORS['text-muted'], marginTop: '3px' }}>
                            used {new Date(ac.used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {ac.used_by_email ? ` by ${ac.used_by_email}` : ''}
                          </div>
                        )}
                        {ac.expires_at && !expired && (
                          <div style={{ fontSize: '10px', color: COLORS['text-muted'], marginTop: '3px' }}>
                            until {new Date(ac.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS['text-main'], lineHeight: 1.5 }}>
                  {(() => {
                    const u = ac.usage || {}
                    const parts = []
                    if (u.observations) parts.push(`${u.observations} observation${u.observations === 1 ? '' : 's'}`)
                    if (u.assessments) parts.push(`${u.assessments} assessment${u.assessments === 1 ? '' : 's'}`)
                    if (u.transcriptions) parts.push(`${u.transcriptions} transcription${u.transcriptions === 1 ? '' : 's'}`)
                    if (u.reviews) parts.push(`${u.reviews} review${u.reviews === 1 ? '' : 's'}`)
                    return parts.length ? parts.map((p) => <div key={p}>{p}</div>) : <span style={{ color: '#999' }}>Not used yet</span>
                  })()}
                </td>
                <td style={{ padding: '12px 16px', color: COLORS['text-muted'], fontSize: '12px' }}>
                  {ac.usage?.last_used ? new Date(ac.usage.last_used).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td style={{ padding: '12px 16px', color: COLORS['text-muted'], fontSize: '12px' }}>
                  {new Date(ac.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => toggleAccessCode(ac.id, !ac.active)}
                      style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #e2e6ec', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', color: COLORS['text-main'] }}
                    >
                      {ac.active ? 'Deactivate' : 'Activate'}
                    </button>
                    {ac.role && ac.role !== 'student' && (
                      <button
                        onClick={() => clearCodeData(ac.id, ac.label)}
                        style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #e2e6ec', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', color: COLORS['text-main'] }}
                      >
                        Delete saved data
                      </button>
                    )}
                    <button
                      onClick={() => deleteAccessCode(ac.id, ac.code)}
                      style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', color: '#dc2626' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Tool tab renderer ──
  const renderSignInTab = () => (
    <div>
      <div style={s.titleRow}>
        <h1 style={s.heading}>Sign-in Pages</h1>
      </div>
      <p style={{ fontSize: '13px', color: COLORS['text-muted'], margin: '0 0 14px', lineHeight: 1.6 }}>
        Edit the words on the sign-in pages: the home page, Student, Mentor Coach, and Admin. Leave a box empty to use the standard text (shown in gray). The layout, colors, and buttons stay the same.
      </p>
      {toolError && <p style={s.errorMsg}>{toolError}</p>}
      {toolSuccess && <p style={s.successBanner}>{toolSuccess}</p>}
      {LOGIN_GROUPS.map(group => (
        <div key={group.id} style={s.formCard}>
          <h2 style={s.formHeading}>{group.label}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {group.fields.map(f => (
              <label key={f.key} style={s.label}>
                {f.label}
                {f.long ? (
                  <textarea
                    value={contentValues[f.key] ?? ''}
                    onChange={e => setContentValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.def}
                    style={{ ...s.textarea, minHeight: '70px' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={contentValues[f.key] ?? ''}
                    onChange={e => setContentValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.def}
                    style={s.input}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button onClick={handleSignInSave} disabled={toolLoading} style={s.submitBtn}>
        {toolLoading ? 'Saving…' : 'Save Sign-in Text'}
      </button>
    </div>
  )

  const renderToolTab = (tool) => (
    <div key={tool.id}>
      <div style={s.titleRow}>
        <h1 style={s.heading}>{tool.label}</h1>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: tool.group === 'published' ? '#edf7d0' : '#fff1de', color: tool.group === 'published' ? '#4d5b00' : '#a45a00' }}>
          {tool.group === 'published' ? 'Published' : 'In progress'}
        </span>
      </div>
      {tool.note && <p style={{ fontSize: '13px', color: COLORS['text-muted'], margin: '0 0 14px', lineHeight: 1.6 }}>{tool.note}</p>}

      {toolError && <p style={s.errorMsg}>{toolError}</p>}
      {toolSuccess && <p style={s.successBanner}>{toolSuccess}</p>}

      {tool.info && (
        <div style={s.formCard}>
          <h2 style={s.formHeading}>How this tool is set up</h2>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', lineHeight: 1.8, color: COLORS['text-main'] }}>
            <li>Who can use it: mentor coach, tool admin, and admin accounts.</li>
            <li>AI key: it uses the <strong>Transcript Reviewer API key</strong> {apiKeyStatus.api_key_transcript ? '(saved ✓)' : '(not set)'}. Change it on the Transcript Reviewer tab.</li>
            <li>AI instructions: built into the app. The AI only suggests evidence; the mentor coach picks every rating.</li>
            <li>Saved work: drafts are kept per mentor coach, and full admins can read them in History / Data (read only).</li>
          </ul>
        </div>
      )}

      {/* Participant dashboard tile + visibility (older participant accounts only) */}
      {tool.dashboard && (
      <details style={{ ...s.formCard, padding: '14px 20px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: COLORS.navy }}>
          Participant dashboard tile (older CoachRICE participant accounts only)
        </summary>
        <p style={{ fontSize: '12.5px', color: COLORS['text-muted'], lineHeight: 1.6, margin: '10px 0 14px' }}>
          Admins, mentor coaches, and students never see the dashboard. This only changes the tile and the sidebar link that participant accounts see.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: COLORS['text-main'], marginBottom: '18px' }}>
          <input
            type="checkbox"
            checked={!!visibility[tool.id]}
            onChange={(e) => {
              const newValue = e.target.checked
              setVisibility(v => ({ ...v, [tool.id]: newValue }))
              handleToolVisibilitySave(tool.id, newValue)
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: COLORS.teal }}
          />
          {visibility[tool.id] ? 'Visible to participants' : 'Hidden from participants'}
        </label>
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
      </details>
      )}

      {/* Start page text */}
      {tool.pageContent && (
      <div style={s.formCard}>
        <h2 style={s.formHeading}>Start Page Text</h2>
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
              {contentValues[`${tool.contentPrefix}_start_title`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.title ?? tool.label}
            </h2>
            {(contentValues[`${tool.contentPrefix}_start_subtitle`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.subtitle) && (
              <p style={{ fontSize: '13px', color: COLORS['text-muted'], margin: 0, lineHeight: '1.5' }}>
                {contentValues[`${tool.contentPrefix}_start_subtitle`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.subtitle}
              </p>
            )}
            {[1, 2, 3].map(i => {
              const infoValue = contentValues[`${tool.contentPrefix}_start_info_${i}`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.info?.[i - 1];
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
                value={contentValues[`${tool.contentPrefix}_start_title`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.title ?? tool.label ?? ''}
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
                  value={contentValues[`${tool.contentPrefix}_start_info_${i}`] ?? TOOL_PAGE_DEFAULTS[tool.id]?.info?.[i - 1] ?? ''}
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
      )}

      {/* System Prompts (if applicable) */}
      {tool.hasPrompts && (
        <div style={s.formCard}>
          <h2 style={s.formHeading}>System Prompts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tool.promptKeys.map((key, i) => (
              <label key={key} style={s.label}>
                {tool.promptLabels[i]}
                <textarea
                  value={prompts[key] || ''}
                  onChange={e => setPrompts(v => ({ ...v, [key]: e.target.value }))}
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

      {/* API Keys (if applicable) */}
      {tool.hasApiKeys && (
        <div style={s.formCard}>
          <h2 style={s.formHeading}>API Keys</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tool.apiKeyKeys.map((key, i) => (
              <label key={key} style={s.label}>
                {tool.apiKeyLabels[i]} {apiKeyStatus[key] ? '(saved ✓)' : '(not set)'}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={apiKeyInputs[key] || ''}
                  onChange={e => setApiKeyInputs(v => ({ ...v, [key]: e.target.value }))}
                  style={s.input}
                  placeholder={apiKeyStatus[key] ? 'Saved. Type a new key here to replace it.' : 'sk-...'}
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
              <label style={s.label}>Email
                <input name="email" type="email" value={editUserForm.email} onChange={handleEditUserChange} required style={s.input} />
              </label>
              <label style={s.label}>Role
                <select name="role" value={editUserForm.role} onChange={handleEditUserChange} style={s.input}>
                  <option value="coach">Participant</option>
                  <option value="admin">Admin (full dashboard)</option>
                  <option value="admin_tools">Admin (tools only)</option>
                  <option value="mentor">Mentor coach</option>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleResendInvite(editingUser)} style={{ ...s.actionBtn, background: '#fff', border: `1px solid #d1d5db` }}>Resend Invite</button>
                <button type="button" onClick={() => handleResetPassword(editingUser)} style={{ ...s.actionBtn, background: '#fff', border: `1px solid #d1d5db` }}>Reset Password</button>
                <button type="button" onClick={() => handleDeleteUser(editingUser)} style={s.deleteBtn}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setEditingUser(null)} style={s.cancelBtn}>Cancel</button>
                <button type="submit" disabled={editUserSubmitting} style={s.submitBtn}>
                  {editUserSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <table style={s.table}>
        <thead>
          <tr>
            {[
              { label: 'Name', col: 'full_name' },
              { label: 'Email', col: 'email' },
              { label: 'Role', col: 'role' },
              { label: 'Added', col: 'created_at' },
              { label: 'Last Accessed', col: 'last_accessed_at' },
            ].map(h => (
              <th key={h.col} style={{ ...s.th, cursor: 'pointer' }} onClick={() => handleSort(h.col)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {h.label}
                  {sortColumn === h.col && (
                    <span style={{ fontSize: '11px', fontWeight: '700' }}>
                      {sortDirection === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map(u => (
            <tr key={u.id} style={s.trBody}>
              <td style={s.td}>{u.full_name}</td>
              <td style={s.td}>{u.email}</td>
              <td style={s.td}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={u.role === 'coach' ? s.badgeCoach : s.badgeAdmin}>
                    {{ admin: 'Admin', admin_tools: 'Admin (tools)', mentor: 'Mentor coach', coach: 'Participant' }[u.role] || 'Participant'}
                  </span>
                  {u.is_active === false && <span style={s.badgePaused}>Paused</span>}
                </div>
              </td>
              <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td style={s.td}>{u.last_accessed_at ? new Date(u.last_accessed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td style={s.td}>
                <button onClick={() => openEditUser(u)} style={s.actionBtn}>Manage</button>
              </td>
            </tr>
          ))}
          {sortedUsers.length === 0 && (
            <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#999' }}>No users yet.</td></tr>
          )}
        </tbody>
      </table>
    </>
  )

  return (
    <Layout active={section === 'config' ? 'admin-config' : 'admin-users'} pageTitle={section === 'config' ? 'Tool Configuration' : 'Users / Access Codes'}>
      <div style={s.tabBar}>
        {(section === 'config'
          ? [
              ...TOOLS.map(t => ({ id: `tool-${t.id}`, label: t.label, group: t.group })),
              { id: 'signin', label: 'Sign-in Pages', group: 'signin' },
            ]
          : [{ id: 'users', label: 'Users' }, { id: 'access-codes', label: 'Access Codes' }]
        ).map((tab, i, all) => (
          <span key={tab.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {tab.group && tab.group !== all[i - 1]?.group && (
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: COLORS['text-muted'], margin: i ? '0 4px 0 14px' : '0 4px 0 8px' }}>
                {tab.group === 'published' ? 'Published' : tab.group === 'progress' ? 'In progress' : 'Pages'}
              </span>
            )}
            <button
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
            >
              {tab.label}
            </button>
          </span>
        ))}
      </div>

      <div style={s.content}>
        {activeTab === 'users' && usersContent}
        {activeTab.startsWith('tool-') && renderToolTab(TOOLS.find(t => `tool-${t.id}` === activeTab))}
        {activeTab === 'signin' && renderSignInTab()}
        {activeTab === 'access-codes' && renderAccessCodesTab()}
      </div>
    </Layout>
  )
}

const s = {
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: '4px',
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
  formActions: { display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' },
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

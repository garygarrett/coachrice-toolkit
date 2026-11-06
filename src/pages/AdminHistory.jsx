import { authFetch } from '../lib/authFetch'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import LoadingBar from '../components/LoadingBar'
import CompetencyByCode from '../components/CompetencyByCode'
import DataPurgePanel from '../components/DataPurgePanel'

const COLORS = {
  navy: '#00205B',
  teal: '#69cce6',
  orange: '#ff8200',
  gray: '#7C7E7F',
  'gray-light': '#f0f2f5',
  'gray-border': '#e2e6ec',
  white: '#ffffff',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
}

export default function AdminHistory() {
  const { user } = useAuth()
  const [view, setView] = useState('people') // 'people' | 'competency' | 'delete'
  const [person, setPerson] = useState(null) // { kind: 'user' | 'code' | 'summary', id, name, ... }
  const [summary, setSummary] = useState([]) // mentor coach and admin counts
  const [codes, setCodes] = useState([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userHistory, setUserHistory] = useState({ exams: [], transcripts: [], chats: [], assessments2021: [], assessments2025: [] })
  const [loading, setLoading] = useState(false)
  const [expandedItems, setExpandedItems] = useState({})
  const [userDetails, setUserDetails] = useState({})
  const [guestAnalyses, setGuestAnalyses] = useState([])
  const [guestLoading, setGuestLoading] = useState(false)


  useEffect(() => {
    // Load jsPDF library for PDF generation
    if (!window.jspdf) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      document.head.appendChild(script)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    loadSummary()
    loadCodes()
    loadGuestAnalyses()
  }, [])

  async function loadGuestAnalyses() {
    setGuestLoading(true)
    try {
      const res = await authFetch('/api/access-codes?action=list-analyses')
      const data = await res.json()
      setGuestAnalyses(data.analyses || [])
    } catch (err) {
      console.error('Error loading guest analyses:', err)
    } finally {
      setGuestLoading(false)
    }
  }

  async function deleteGuestAnalysis(id) {
    if (!window.confirm('Delete this guest analysis? This cannot be undone.')) return
    try {
      await authFetch('/api/access-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'analysis' }),
      })
      setGuestAnalyses(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Error deleting guest analysis:', err)
    }
  }

  useEffect(() => {
    if (selectedUserId) {
      loadUserHistory(selectedUserId)
    }
  }, [selectedUserId])

  async function loadSummary() {
    try {
      const res = await authFetch('/api/user-actions?action=history-summary', { method: 'POST' })
      if (res.ok) setSummary((await res.json()).people || [])
    } catch (err) {
      console.error('Error loading summary:', err)
    }
  }

  async function loadCodes() {
    try {
      const res = await authFetch('/api/access-codes?action=list')
      if (res.ok) setCodes(((await res.json()).codes || []).filter(c => (c.role || 'student') === 'student'))
    } catch (err) {
      console.error('Error loading access codes:', err)
    }
  }

  async function loadUsers() {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, role, last_accessed_at')
        .order('full_name')
      if (data) setUsers(data)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  async function loadUserHistory(userId) {
    setLoading(true)
    try {
      const [examsRes, transcriptsRes, chatsRes, assessments2021Res, assessments2025Res] = await Promise.all([
        authFetch(`/api/exam-history?userId=${user.id}&viewingUserId=${userId}`),
        authFetch(`/api/transcript-history?userId=${user.id}&viewingUserId=${userId}`),
        authFetch(`/api/chat-history?userId=${user.id}&viewingUserId=${userId}`),
        authFetch(`/api/internal-assessments?userId=${user.id}&viewingUserId=${userId}&assessorType=2021`),
        authFetch(`/api/internal-assessments?userId=${user.id}&viewingUserId=${userId}&assessorType=2025`),
      ])

      const examsData = await examsRes.json()
      const transcriptsData = await transcriptsRes.json()
      const chatsData = await chatsRes.json()
      const assessments2021Data = await assessments2021Res.json()
      const assessments2025Data = await assessments2025Res.json()

      setUserHistory({
        exams: examsData.data || [],
        transcripts: transcriptsData.data || [],
        chats: chatsData.data || [],
        assessments2021: assessments2021Data.data || [],
        assessments2025: assessments2025Data.data || [],
      })
    } catch (err) {
      console.error('Error loading user history:', err)
    }
    setLoading(false)
  }

  async function loadExamDetails(attemptId, userId) {
    try {
      const res = await authFetch(`/api/exam-history?userId=${user.id}&attemptId=${attemptId}`)
      const data = await res.json()
      if (res.ok) {
        setUserDetails(prev => ({ ...prev, [attemptId]: data }))
      }
    } catch (err) {
      console.error('Error loading exam details:', err)
    }
  }

  async function loadChatDetails(sessionId, userId) {
    try {
      const res = await authFetch(`/api/chat-history?userId=${user.id}&sessionId=${sessionId}`)
      const data = await res.json()
      if (res.ok) {
        setUserDetails(prev => ({ ...prev, [sessionId]: data }))
      }
    } catch (err) {
      console.error('Error loading chat details:', err)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function deleteExam(examId) {
    if (!window.confirm('Are you sure you want to delete this exam attempt?')) return
    try {
      const res = await authFetch(`/api/exam-history?userId=${user.id}&attemptId=${examId}`, { method: 'DELETE' })
      if (res.ok) {
        setUserHistory(prev => ({ ...prev, exams: prev.exams.filter(e => e.id !== examId) }))
      } else {
        alert('Failed to delete exam')
      }
    } catch (err) {
      console.error('Error deleting exam:', err)
      alert('Error deleting exam')
    }
  }

  async function deleteTranscript(analysisId) {
    if (!window.confirm('Are you sure you want to delete this transcript analysis?')) return
    try {
      const res = await authFetch(`/api/transcript-history?userId=${user.id}&analysisId=${analysisId}`, { method: 'DELETE' })
      if (res.ok) {
        setUserHistory(prev => ({ ...prev, transcripts: prev.transcripts.filter(t => t.id !== analysisId) }))
      } else {
        alert('Failed to delete transcript')
      }
    } catch (err) {
      console.error('Error deleting transcript:', err)
      alert('Error deleting transcript')
    }
  }

  async function deleteChat(sessionId) {
    if (!window.confirm('Are you sure you want to delete this chat session?')) return
    try {
      const res = await authFetch(`/api/chat-history?userId=${user.id}&sessionId=${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setUserHistory(prev => ({ ...prev, chats: prev.chats.filter(c => c.id !== sessionId) }))
      } else {
        alert('Failed to delete chat')
      }
    } catch (err) {
      console.error('Error deleting chat:', err)
      alert('Error deleting chat')
    }
  }

  return (
    <Layout active="admin-history" pageTitle="History / Data">
      <div style={s.page}>
        {/* Tabs */}
        <div style={s.viewSelector}>
          {[['people', 'By person'], ['competency', 'Competency by access code'], ['delete', 'Delete data']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{ ...s.viewBtn, ...(view === id ? s.viewBtnActive : {}) }}>{label}</button>
          ))}
        </div>

        {view === 'people' && (() => {
          const TYPE = { admin: 'Admin', admin_tools: 'Admin (tools)', mentor: 'Mentor coach', coach: 'Participant', code: 'Student code' }
          const sumById = Object.fromEntries(summary.map(p => [p.id, p]))
          const rows = [
            ...users.map(u => ({ key: `u-${u.id}`, kind: sumById[u.id] ? 'summary' : 'user', id: u.id, name: u.full_name || u.email, email: u.email, type: u.role, last: u.last_accessed_at })),
            ...codes.map(c => ({ key: `c-${c.id}`, kind: 'code', id: c.id, name: c.label, email: '', type: 'code', last: c.usage?.last_used || null, label: c.label })),
          ].filter(r => (typeFilter === 'all' || r.type === typeFilter) && (`${r.name} ${r.email}`).toLowerCase().includes(search.trim().toLowerCase()))
           .sort((x, y) => String(x.name).localeCompare(String(y.name)))
          return (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Choose a person or student access code</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" style={{ ...s.select, minWidth: 240 }} />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={s.select}>
                  <option value="all">All types</option>
                  <option value="code">Student codes</option>
                  <option value="mentor">Mentor coaches</option>
                  <option value="admin_tools">Admins (tools)</option>
                  <option value="admin">Admins (full)</option>
                  <option value="coach">Participants</option>
                </select>
              </div>
              <div style={{ border: `1px solid ${COLORS['gray-border']}`, borderRadius: 8, overflow: 'hidden', maxHeight: 320, overflowY: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f7f8fa', textAlign: 'left' }}>
                      {['Name', 'Type', 'Email', 'Last active'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS['text-muted'] }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const on = person && person.key === r.key
                      return (
                        <tr key={r.key} onClick={() => { setPerson(r); if (r.kind === 'user') setSelectedUserId(r.id) }}
                          style={{ cursor: 'pointer', borderTop: '1px solid #f0f2f5', background: on ? '#e6f7fc' : '#fff' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: COLORS.navy }}>{r.name}</td>
                          <td style={{ padding: '10px 14px' }}>{TYPE[r.type] || 'Participant'}</td>
                          <td style={{ padding: '10px 14px', color: COLORS['text-muted'] }}>{r.email || '—'}</td>
                          <td style={{ padding: '10px 14px', color: COLORS['text-muted'] }}>{r.last ? new Date(r.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        </tr>
                      )
                    })}
                    {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#999' }}>Nobody matches.</td></tr>}
                  </tbody>
                </table>
              </div>

              {!person && <p style={s.empty}>Select a row to see their history.</p>}

              {person?.kind === 'summary' && (() => {
                const d = sumById[person.id]
                if (!d) return null
                const isMentor = d.role === 'mentor'
                const card = { border: `1px solid ${COLORS['gray-border']}`, borderRadius: 10, padding: '16px 18px' }
                return (
                  <div style={card}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.navy }}>{d.full_name || d.email}</div>
                    <div style={{ fontSize: 12, color: COLORS['text-muted'], marginBottom: 14 }}>{TYPE[d.role]} · {d.email}</div>
                    {isMentor ? (
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ ...card, minWidth: 180 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy }}>{d.runs.observations}</div>
                          <div style={{ fontSize: 12, color: COLORS['text-muted'] }}>Session observations run</div>
                        </div>
                        <div style={{ ...card, minWidth: 180 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy }}>{d.saved.observations}</div>
                          <div style={{ fontSize: 12, color: COLORS['text-muted'] }}>Saved in progress now</div>
                        </div>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f7f8fa', textAlign: 'left' }}>
                            {['Tool', 'Saved now', 'Times run'].map(h => <th key={h} style={{ padding: '8px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS['text-muted'] }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Internal Assessor (2021)', d.saved.assessments_2021, null],
                            ['Internal Assessor (2025)', d.saved.assessments_2025, null],
                            ['Internal Assessor, all versions', null, d.runs.assessments],
                            ['Audio to Transcript', d.saved.audio, d.runs.audio],
                            ['Session Observation Form', d.saved.observations, d.runs.observations],
                          ].map(([tool, saved, runs]) => (
                            <tr key={tool} style={{ borderTop: '1px solid #f0f2f5' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: COLORS.navy }}>{tool}</td>
                              <td style={{ padding: '8px 12px' }}>{saved === null ? '—' : saved}</td>
                              <td style={{ padding: '8px 12px' }}>{runs === null ? '—' : runs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p style={{ fontSize: 11, color: COLORS['text-muted'], margin: '12px 0 0', lineHeight: 1.6 }}>
                      Counts only. Transcripts and assessment text are not shown here. &ldquo;Times run&rdquo; counts start when the account was created with a sign-up code.
                    </p>
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* Participant account history (exams, transcripts, chats) */}
        {view === 'people' && person?.kind === 'user' && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>{person.name}</h2>
            {selectedUserId && (
              <>
                {/* User's Exams */}
                <div style={s.subsection}>
                  <h3 style={s.subsectionTitle}>📝 Exam Attempts ({userHistory.exams.length})</h3>
                  {userHistory.exams.length === 0 ? (
                    <p style={s.empty}>No exam attempts</p>
                  ) : (
                    <div style={s.listContainer}>
                      {userHistory.exams.map(exam => (
                        <div key={exam.id} style={s.item}>
                          <div style={s.itemHeader} onClick={() => {
                            toggleExpand(`exam-${exam.id}`)
                            if (!expandedItems[`exam-${exam.id}`] && !userDetails[exam.id]) {
                              loadExamDetails(exam.id, selectedUserId)
                            }
                          }}>
                            <div style={s.itemInfo}>
                              <div style={s.itemTitle}>{exam.correct_answers}/{exam.total_questions} correct ({exam.overall_score}%)</div>
                              <div style={s.itemDate}>{formatDate(exam.created_at)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ ...s.scoreCircle, color: exam.overall_score >= 70 ? '#15803d' : exam.overall_score >= 50 ? '#b45309' : '#b91c1c' }}>
                                {exam.overall_score}%
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); deleteExam(exam.id) }} style={s.deleteBtn} title="Delete exam">
                                🗑️
                              </button>
                            </div>
                          </div>
                          {expandedItems[`exam-${exam.id}`] && userDetails[exam.id] && (
                            <div style={s.itemDetails}>
                              <div style={s.reviewList}>
                                {userDetails[exam.id].answers?.map((q, i) => (
                                  <div key={q.id} style={{ ...s.reviewItem, borderLeftColor: q.isCorrect ? '#15803d' : '#b91c1c' }}>
                                    <p style={s.reviewQ}><strong>Q{i + 1}.</strong> {q.question}</p>
                                    {q.isCorrect ? (
                                      <p style={{ color: '#15803d', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                                        ✓ Correct — {q.options[q.correct]}
                                      </p>
                                    ) : (
                                      <>
                                        <p style={{ color: '#b91c1c', fontSize: '0.8rem', margin: '0.3rem 0 0.1rem' }}>
                                          ✗ You chose ({q.userAnswer}) {q.options[q.userAnswer]}
                                        </p>
                                        <p style={{ color: '#15803d', fontSize: '0.8rem', margin: '0 0 0.3rem' }}>
                                          ✓ Correct: ({q.correct}) {q.options[q.correct]}
                                        </p>
                                        <p style={s.reviewExpl}>{q.explanation}</p>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User's Transcripts */}
                <div style={s.subsection}>
                  <h3 style={s.subsectionTitle}>📄 Transcript Analyses ({userHistory.transcripts.length})</h3>
                  {userHistory.transcripts.length === 0 ? (
                    <p style={s.empty}>No transcript analyses</p>
                  ) : (
                    <div style={s.listContainer}>
                      {userHistory.transcripts.map(t => (
                        <div key={t.id} style={s.item}>
                          <div style={s.itemHeader} onClick={() => toggleExpand(`transcript-${t.id}`)}>
                            <div style={s.itemInfo}>
                              <div style={s.itemTitle}>Transcript Analysis</div>
                              <div style={s.itemDate}>{formatDate(t.created_at)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={s.expandIcon}>{expandedItems[`transcript-${t.id}`] ? '▼' : '▶'}</span>
                              <button onClick={(e) => { e.stopPropagation(); deleteTranscript(t.id) }} style={s.deleteBtn} title="Delete transcript">
                                🗑️
                              </button>
                            </div>
                          </div>
                          {expandedItems[`transcript-${t.id}`] && (
                            <div style={s.itemDetails}>
                              {typeof t.competency_scores === 'object' && (
                                <div style={s.competencyList}>
                                  {Object.entries(t.competency_scores).map(([code, result]) => (
                                    <span key={code} style={{ ...s.badge, color: result === 'Observed' ? '#15803d' : '#b91c1c' }}>
                                      {code}: {result}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User's Chats */}
                <div style={s.subsection}>
                  <h3 style={s.subsectionTitle}>💬 Chat Sessions ({userHistory.chats.length})</h3>
                  {userHistory.chats.length === 0 ? (
                    <p style={s.empty}>No chat sessions</p>
                  ) : (
                    <div style={s.listContainer}>
                      {userHistory.chats.map(chat => (
                        <div key={chat.id} style={s.item}>
                          <div style={s.itemHeader} onClick={() => {
                            toggleExpand(`chat-${chat.id}`)
                            if (!expandedItems[`chat-${chat.id}`] && !userDetails[chat.id]) {
                              loadChatDetails(chat.id, selectedUserId)
                            }
                          }}>
                            <div style={s.itemInfo}>
                              <div style={s.itemTitle}>Chat Session</div>
                              <div style={s.itemDate}>{formatDate(chat.created_at)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={s.expandIcon}>{expandedItems[`chat-${chat.id}`] ? '▼' : '▶'}</span>
                              <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }} style={s.deleteBtn} title="Delete chat">
                                🗑️
                              </button>
                            </div>
                          </div>
                          {expandedItems[`chat-${chat.id}`] && userDetails[chat.id] && (
                            <div style={s.itemDetails}>
                              <div style={{ fontSize: '12px', color: COLORS['text-muted'] }}>
                                {userDetails[chat.id].messages?.length || 0} messages
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Guest Sessions View */}
        {view === 'people' && person?.kind === 'code' && (() => {
          const codeAnalyses = guestAnalyses.filter(a => a.access_code_label === person.label)
          return (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>{person.name} (student access code)</h2>
            <p style={{ fontSize: '13px', color: COLORS['text-muted'], marginBottom: '20px', lineHeight: '1.6' }}>
              Transcript evaluations submitted with this access code. No user identity or transcript text is stored — only the AI evaluation results.
            </p>

            {guestLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                <LoadingBar />
              </div>
            ) : codeAnalyses.length === 0 ? (
              <p style={s.empty}>No sessions for this code yet.</p>
            ) : (
              <div style={s.listContainer}>
                {codeAnalyses.map(analysis => {
                  const evalData = analysis.analysis_data || {}
                  const stmts = evalData.behavioral_statements || []
                  const obsCount = stmts.filter(s => s.result === 'Observed').length
                  return (
                    <div key={analysis.id} style={s.item}>
                      <div style={s.itemHeader} onClick={() => toggleExpand(`guest-${analysis.id}`)}>
                        <div style={s.itemInfo}>
                          <div style={s.itemTitle}>
                            {evalData.coach_identifier || 'Anonymous Coach'} — {analysis.access_code_label}
                          </div>
                          <div style={s.itemDate}>{formatDate(analysis.created_at)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: COLORS.navy }}>
                            {obsCount}/{stmts.length} observed
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteGuestAnalysis(analysis.id) }}
                            style={s.deleteBtn}
                            title="Delete"
                          >
                            🗑️
                          </button>
                          <span style={s.expandIcon}>{expandedItems[`guest-${analysis.id}`] ? '▼' : '▶'}</span>
                        </div>
                      </div>

                      {expandedItems[`guest-${analysis.id}`] && (
                        <div style={s.itemDetails}>
                          {/* Competency 1: Ethical Practice qualifiers */}
                          {(() => {
                            const ep = evalData.ethical_practice || {}
                            const quals = ep.qualifiers || []
                            const q1Labels = [
                              'ICF Code of Ethics alignment',
                              'Stays in the role of the coach, focuses on present/future',
                              'Uses key coaching skills to facilitate client insights',
                            ]
                            const rows = quals.length === 3
                              ? quals.map((q, i) => ({ label: q1Labels[i], result: q.result }))
                              : [
                                { label: q1Labels[0], result: ep.icf_code_alignment },
                                { label: q1Labels[1], result: ep.coach_role_alignment },
                                { label: q1Labels[2], result: null },
                              ]
                            return (
                              <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>1. Demonstrates Ethical Practice</div>
                                {rows.map((row, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', marginBottom: '2px', background: '#f9fafc', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: COLORS.navy, width: '70px', flexShrink: 0 }}>Q{i + 1}</span>
                                    <span style={{ fontSize: '11px', color: COLORS['text-main'], flex: 1 }}>{row.label}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', whiteSpace: 'nowrap', background: row.result === 'Observed' ? '#dcfce7' : row.result === 'Not Observed' ? '#fee2e2' : '#f3f4f6', color: row.result === 'Observed' ? '#16a34a' : row.result === 'Not Observed' ? '#dc2626' : '#9ca3af' }}>
                                      {row.result === 'Observed' ? '✓ Observed' : row.result === 'Not Observed' ? '✗ Not Observed' : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}

                          {/* Competency scores summary */}
                          {stmts.length > 0 && (() => {
                            const compTitles = { 3: 'Establishes and Maintains Agreements', 4: 'Cultivates Trust and Safety', 5: 'Maintains Presence', 6: 'Listens Actively', 7: 'Evokes Awareness', 8: 'Facilitates Client Growth' }
                            const grouped = {}
                            stmts.forEach(st => {
                              const c = parseInt(st.code.replace(/^[A-Za-z]+/, '').split('.')[0], 10)
                              if (!grouped[c]) grouped[c] = []
                              grouped[c].push(st)
                            })
                            return (
                              <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Competency Results</div>
                                {[3, 4, 5, 6, 7, 8].map(n => {
                                  const skills = grouped[n] || []
                                  const obs = skills.filter(sk => sk.result === 'Observed').length
                                  return (
                                    <div key={n} style={{ marginBottom: '8px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                                        <span style={{ color: COLORS['text-main'], fontWeight: '600' }}>{n}. {compTitles[n]}</span>
                                        <span style={{ color: COLORS['text-muted'] }}>{obs}/{skills.length}</span>
                                      </div>
                                      {skills.map(sk => (
                                        <div key={sk.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', marginBottom: '2px', background: '#f9fafc', borderRadius: '4px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '700', color: COLORS.navy, width: '28px', flexShrink: 0 }}>{sk.code}</span>
                                          <span style={{ fontSize: '11px', color: COLORS['text-main'], flex: 1 }}>{sk.title}</span>
                                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: sk.result === 'Observed' ? '#dcfce7' : '#fee2e2', color: sk.result === 'Observed' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                                            {sk.result === 'Observed' ? '✓' : '✗'} {sk.result}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}

                          {/* Strengths */}
                          {evalData.strengths?.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Strengths</div>
                              {evalData.strengths.map((st, i) => (
                                <div key={i} style={{ padding: '10px 12px', background: '#f0fdf4', borderLeft: '3px solid #16a34a', borderRadius: '0 4px 4px 0', marginBottom: '6px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                                  <strong style={{ color: COLORS.navy }}>{st.code} — {st.statement_title}</strong><br />{st.explanation}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Suggestions */}
                          {evalData.suggestions?.length > 0 && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS['text-muted'], textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Suggestions</div>
                              {evalData.suggestions.map((su, i) => (
                                <div key={i} style={{ padding: '10px 12px', background: '#fef2f2', borderLeft: '3px solid #dc2626', borderRadius: '0 4px 4px 0', marginBottom: '6px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                                  <strong style={{ color: COLORS.navy }}>{su.code} — {su.statement_title}</strong><br />{su.missed_opportunity}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )
        })()}

        {view === 'competency' && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>Competency by student access code</h2>
            <CompetencyByCode analyses={guestAnalyses} loading={guestLoading} />
          </div>
        )}

        {view === 'delete' && (
          <div style={s.section}>
            <DataPurgePanel />
          </div>
        )}
      </div>
    </Layout>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  viewSelector: {
    display: 'flex',
    gap: 0,
    background: '#fff',
    borderRadius: '10px',
    marginBottom: '20px',
    padding: '4px',
  },
  viewBtn: {
    padding: '0.85rem 1.25rem',
    border: 'none',
    background: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    color: COLORS['text-muted'],
    transition: 'all 0.2s',
    fontFamily: 'Montserrat, sans-serif',
    boxShadow: 'none',
  },
  viewBtnActive: {
    background: 'rgba(0, 32, 91, 0.05)',
    color: COLORS.navy,
    fontWeight: '600',
    boxShadow: 'none',
  },
  section: {
    background: '#fff',
    borderRadius: '10px',
    border: `1px solid ${COLORS['gray-border']}`,
    padding: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: COLORS.navy,
    margin: '0 0 20px',
  },
  selectGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: COLORS['text-main'],
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    maxWidth: '400px',
    padding: '10px 12px',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'Montserrat, sans-serif',
  },
  subsection: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: `1px solid ${COLORS['gray-border']}`,
  },
  subsectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: COLORS['text-main'],
    margin: '0 0 12px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  statBox: {
    padding: '16px',
    background: COLORS['gray-light'],
    borderRadius: '6px',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '12px',
    color: COLORS['text-muted'],
    fontWeight: '600',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: COLORS.navy,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '6px',
    overflow: 'hidden',
    border: `1px solid ${COLORS['gray-border']}`,
  },
  item: {
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  itemHeader: {
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: COLORS['text-main'],
  },
  itemDate: {
    fontSize: '12px',
    color: COLORS['text-muted'],
    marginTop: '4px',
  },
  scoreCircle: {
    fontSize: '16px',
    fontWeight: '700',
  },
  expandIcon: {
    fontSize: '12px',
    color: COLORS['text-muted'],
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    opacity: 0.6,
    transition: 'opacity 0.2s',
    borderRadius: '4px',
  },
  itemDetails: {
    padding: '14px 16px',
    background: COLORS['gray-light'],
    borderTop: `1px solid ${COLORS['gray-border']}`,
    fontSize: '12px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '8px',
  },
  answerItem: {
    borderLeft: '3px solid',
    paddingLeft: '8px',
    padding: '8px',
    background: '#fff',
    borderRadius: '3px',
    fontSize: '11px',
  },
  answerNumber: {
    fontWeight: '700',
    marginBottom: '2px',
  },
  answerStatus: {
    fontSize: '10px',
    color: COLORS['text-muted'],
  },
  competencyList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: '600',
    background: COLORS['gray-light'],
  },
  stat: {
    fontSize: '12px',
    color: COLORS['text-main'],
    marginBottom: '8px',
  },
  empty: {
    textAlign: 'center',
    color: COLORS['text-muted'],
    fontSize: '13px',
    padding: '16px',
    margin: 0,
  },
  reviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  reviewItem: {
    borderLeft: '3px solid',
    paddingLeft: '12px',
    padding: '12px',
    background: '#fff',
    borderRadius: '4px',
    fontSize: '13px',
  },
  reviewQ: {
    margin: '0 0 8px',
    lineHeight: '1.5',
    color: COLORS['text-main'],
  },
  reviewExpl: {
    margin: '8px 0 0',
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    lineHeight: '1.4',
  },
  competencyBreakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: COLORS['gray-light'],
    borderRadius: '6px',
  },
  competencyBreakdownName: {
    fontSize: '12px',
    fontWeight: '600',
    color: COLORS['text-main'],
    minWidth: '120px',
  },
  competencyBreakdownStat: {
    fontSize: '11px',
    color: COLORS['text-muted'],
    minWidth: '40px',
    textAlign: 'right',
  },
  competencyBreakdownBar: {
    flex: 1,
    height: '8px',
    background: COLORS['gray-border'],
    borderRadius: '4px',
    overflow: 'hidden',
  },
  competencyBreakdownFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  competencyBreakdownPct: {
    fontSize: '11px',
    fontWeight: '600',
    color: COLORS['text-main'],
    minWidth: '35px',
    textAlign: 'right',
  },
  questionStatsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  questionStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px',
    background: COLORS['gray-light'],
    borderRadius: '6px',
    gap: '16px',
  },
  questionStatText: {
    margin: '0 0 4px',
    fontSize: '12px',
    fontWeight: '600',
    color: COLORS['text-main'],
    lineHeight: '1.4',
  },
  questionStatMeta: {
    margin: 0,
    fontSize: '11px',
    color: COLORS['text-muted'],
  },
  questionStatRight: {
    display: 'flex',
    gap: '20px',
    minWidth: '280px',
  },
  questionStatItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: '120px',
  },
  questionStatLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: COLORS['text-muted'],
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  questionStatValue: {
    fontSize: '13px',
    fontWeight: '700',
    color: COLORS.navy,
  },
  questionStatBar: {
    height: '6px',
    background: COLORS['gray-border'],
    borderRadius: '3px',
    overflow: 'hidden',
  },
  questionStatFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
}

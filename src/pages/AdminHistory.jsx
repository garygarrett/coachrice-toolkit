import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import LoadingBar from '../components/LoadingBar'

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
  const [view, setView] = useState('user') // 'user' or 'tool'
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedTool, setSelectedTool] = useState('exam')
  const [userHistory, setUserHistory] = useState({ exams: [], transcripts: [], chats: [], assessments2021: [], assessments2025: [] })
  const [toolHistory, setToolHistory] = useState([])
  const [internalAssessments, setInternalAssessments] = useState([])
  const [toolCompetencyBreakdown, setToolCompetencyBreakdown] = useState({})
  const [loading, setLoading] = useState(false)
  const [expandedItems, setExpandedItems] = useState({})
  const [userDetails, setUserDetails] = useState({})
  const [questionStats, setQuestionStats] = useState([])

  const tools = [
    { id: 'exam', label: 'Exam Attempts' },
    { id: 'transcript', label: 'Transcript Analyses' },
    { id: 'chat', label: 'Chat Sessions' },
  ]

  useEffect(() => {
    loadUsers()
    loadInternalAssessments()
  }, [])

  async function loadInternalAssessments() {
    try {
      const [res2025, res2021] = await Promise.all([
        fetch(`/api/internal-assessments?userId=${user.id}&assessorType=2025`),
        fetch(`/api/internal-assessments?userId=${user.id}&assessorType=2021`),
      ])

      const data2025 = res2025.ok ? await res2025.json() : { data: [] }
      const data2021 = res2021.ok ? await res2021.json() : { data: [] }

      const allAssessments = [
        ...(data2025.data || []).map(a => ({ ...a, assessor_type: '2025' })),
        ...(data2021.data || []).map(a => ({ ...a, assessor_type: '2021' })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setInternalAssessments(allAssessments)
    } catch (err) {
      console.error('Error loading internal assessments:', err)
    }
  }

  useEffect(() => {
    if (selectedUserId) {
      loadUserHistory(selectedUserId)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (view === 'tool') {
      loadToolHistory(selectedTool)
    }
  }, [selectedTool, view])

  async function loadUsers() {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, role')
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
        fetch(`/api/exam-history?userId=${user.id}&viewingUserId=${userId}`),
        fetch(`/api/transcript-history?userId=${user.id}&viewingUserId=${userId}`),
        fetch(`/api/chat-history?userId=${user.id}&viewingUserId=${userId}`),
        fetch(`/api/internal-assessments?userId=${user.id}&viewingUserId=${userId}&assessorType=2021`),
        fetch(`/api/internal-assessments?userId=${user.id}&viewingUserId=${userId}&assessorType=2025`),
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

  async function loadToolHistory(toolType) {
    setLoading(true)
    try {
      let endpoint, data
      switch (toolType) {
        case 'exam':
          const examsRes = await fetch(`/api/exam-history?userId=${user.id}`)
          data = await examsRes.json()
          endpoint = 'exams'
          break
        case 'transcript':
          const transcriptsRes = await fetch(`/api/transcript-history?userId=${user.id}`)
          data = await transcriptsRes.json()
          endpoint = 'transcripts'
          break
        case 'chat':
          const chatsRes = await fetch(`/api/chat-history?userId=${user.id}`)
          data = await chatsRes.json()
          endpoint = 'chats'
          break
        default:
          return
      }

      // Fetch full data for each item to show user info
      const itemsWithUsers = await Promise.all(
        (data.data || []).map(async (item) => {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('id, full_name, email')
              .eq('id', item.user_id)
              .single()
            return { ...item, user: userData }
          } catch (err) {
            console.error('Error fetching user:', err)
            return { ...item, user: null }
          }
        })
      )

      setToolHistory(itemsWithUsers)

      // For exams, calculate competency breakdown and question stats across all attempts
      if (toolType === 'exam') {
        const competencyMap = {}
        const questionMap = {}
        for (const item of data.data || []) {
          // Fetch detailed answers for this exam to get competency and question data
          const detailRes = await fetch(`/api/exam-history?userId=${user.id}&attemptId=${item.id}`)
          const detailData = await detailRes.json()

          if (detailData.answers) {
            for (const q of detailData.answers) {
              // Competency stats
              if (!competencyMap[q.competency]) {
                competencyMap[q.competency] = { correct: 0, total: 0 }
              }
              competencyMap[q.competency].total++
              if (q.isCorrect) competencyMap[q.competency].correct++

              // Question stats
              if (!questionMap[q.id]) {
                questionMap[q.id] = { question: q.question, correct: 0, total: 0, competency: q.competency }
              }
              questionMap[q.id].total++
              if (q.isCorrect) questionMap[q.id].correct++
            }
          }
        }

        const breakdown = Object.entries(competencyMap).map(([name, stats]) => ({
          competency: name,
          correct: stats.correct,
          total: stats.total,
          percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        }))

        const questions = Object.entries(questionMap).map(([id, stats]) => ({
          id,
          question: stats.question,
          competency: stats.competency,
          timesUsed: stats.total,
          correctCount: stats.correct,
          successPercentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        }))

        setToolCompetencyBreakdown(breakdown)
        setQuestionStats(questions.sort((a, b) => b.timesUsed - a.timesUsed))
      }
    } catch (err) {
      console.error('Error loading tool history:', err)
    }
    setLoading(false)
  }

  async function loadExamDetails(attemptId, userId) {
    try {
      const res = await fetch(`/api/exam-history?userId=${user.id}&attemptId=${attemptId}`)
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
      const res = await fetch(`/api/chat-history?userId=${user.id}&sessionId=${sessionId}`)
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
      const res = await fetch(`/api/exam-history?userId=${user.id}&attemptId=${examId}`, { method: 'DELETE' })
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
      const res = await fetch(`/api/transcript-history?userId=${user.id}&analysisId=${analysisId}`, { method: 'DELETE' })
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
      const res = await fetch(`/api/chat-history?userId=${user.id}&sessionId=${sessionId}`, { method: 'DELETE' })
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

  async function deleteAssessment(assessmentId) {
    if (!window.confirm('Delete this assessment?')) return
    try {
      const res = await fetch('/api/internal-assessments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, userId: user.id }),
      })
      if (res.ok) {
        setInternalAssessments(prev => prev.filter(a => a.id !== assessmentId))
      } else {
        alert('Failed to delete assessment')
      }
    } catch (err) {
      console.error('Error deleting assessment:', err)
      alert('Error deleting assessment')
    }
  }

  function downloadAssessmentJSON(assessment) {
    const dataStr = JSON.stringify(assessment.assessment_data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Assessment_${assessment.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadAssessmentPDF(assessment) {
    const data = assessment.assessment_data
    const sc = data.score_calculation || {}
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const competencyTitles = {
      3: 'Establishes and Maintains Agreements',
      4: 'Cultivates Trust and Safety',
      5: 'Maintains Presence',
      6: 'Listens Actively',
      7: 'Evokes Awareness',
      8: 'Facilitates Client Growth',
    }

    const grouped = {}
    ;(data.behavioral_statements || []).forEach((s) => {
      const c = parseInt(s.code.split('.')[0], 10)
      if (!grouped[c]) grouped[c] = []
      grouped[c].push(s)
    })

    const HR = '='.repeat(78)
    const SUB = '-'.repeat(78)
    const out = []

    out.push(HR)
    out.push('DOERR INSTITUTE FOR NEW LEADERS  |  COACHRICE LEVEL 1')
    out.push('ACC PERFORMANCE EVALUATION')
    out.push(HR)
    out.push('')
    out.push(`Coach:   ${data.coach_identifier || 'Submitted Coach'}`)
    out.push(`Date:    ${dateStr}`)
    out.push(`Rubric:  ${assessment.assessor_type === '2025' ? 'ICF ACC BARS (Nov 2025)' : 'ICF ACC BARS (March 2024)'}`)
    out.push(`Transcript: ${assessment.transcript_filename || 'N/A'}`)
    out.push('')
    out.push(HR)
    out.push('FINAL SCORE')
    out.push(HR)
    out.push('')
    out.push(`  Final Score:      ${sc.final_score !== undefined ? sc.final_score.toFixed(2) : '—'}`)
    out.push(`  Pass threshold:   3.40`)
    out.push(`  Result:           ${sc.result || '—'}`)
    out.push('')
    out.push(HR)
    out.push('1. DEMONSTRATES ETHICAL PRACTICE')
    out.push('Understands and consistently applies coaching ethics and standards of coaching.')
    out.push(HR)
    out.push('')
    const ep = data.ethical_practice || {}
    out.push(`  [${ep.icf_code_alignment === 'Observed' ? 'X' : ' '}] Coach demonstrates alignment with the ICF Code of Ethics.`)
    if (ep.icf_code_alignment_note) out.push(`      Note: ${ep.icf_code_alignment_note}`)
    out.push(`  [${ep.coach_role_alignment === 'Observed' ? 'X' : ' '}] Coach demonstrates consistent alignment with the role of "coach."`)
    if (ep.coach_role_alignment_note) out.push(`      Note: ${ep.coach_role_alignment_note}`)
    out.push('')

    out.push(HR)
    out.push('2. EMBODIES A COACHING MINDSET')
    out.push('Develops and maintains a mindset that is open, curious, flexible and client-centered.')
    out.push(HR)
    out.push('')
    out.push('  There are no Behavioral Statements for Competency 2 in the ACC BARS system.')
    out.push('')

    ;[3, 4, 5, 6, 7, 8].forEach((compNum) => {
      const compAvg = sc[`competency_${compNum}_average`]
      out.push(HR)
      const avgStr = compAvg !== undefined ? `  [Avg: ${compAvg.toFixed(2)}]` : ''
      out.push(`${compNum}. ${competencyTitles[compNum].toUpperCase()}${avgStr}`)
      out.push(HR)
      out.push('')

      ;(grouped[compNum] || []).forEach((s) => {
        out.push(`  ${s.code}  ${s.title}`)
        out.push(`        Rating: ${s.rating}`)
        if (s.evidence && s.evidence.length) {
          out.push(`        Evidence:`)
          s.evidence.forEach((e) => {
            out.push(`          - ${e.timestamp}  "${e.quote}"`)
          })
        }
        if (s.contra_evidence) {
          out.push(`        Contra-Evidence: ${s.contra_evidence}`)
        }
        out.push('')
      })
    })

    out.push(HR)
    out.push('COACHING COMPETENCY STRENGTHS')
    out.push(HR)
    out.push('')
    ;(data.strengths || []).forEach((s, idx) => {
      out.push(`  STRENGTH ${idx + 1} — ${s.competency_name} | ${s.code}`)
      out.push(`  ${s.statement_title}`)
      out.push('')
      out.push(`  ${s.explanation}`)
      out.push('')
    })

    out.push(HR)
    out.push('SUGGESTIONS FOR COMPETENCY DEVELOPMENT')
    out.push(HR)
    out.push('')
    ;(data.suggestions || []).forEach((s, idx) => {
      out.push(`  SUGGESTION ${idx + 1} — ${s.competency_name} | ${s.code}`)
      out.push(`  ${s.statement_title}`)
      out.push('')
      out.push(`  ${s.missed_opportunity}`)
      if (s.example_prompts && s.example_prompts.length) {
        out.push('')
        out.push(`  Example prompts the coach could have used:`)
        s.example_prompts.forEach((p) => {
          out.push(`    - "${p}"`)
        })
      }
      out.push('')
    })

    const textContent = out.join('\n')
    const blob = new Blob([textContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Assessment_${assessment.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function deleteToolSubmission(toolType, submissionId) {
    const toolName = { exam: 'exam', transcript: 'transcript', chat: 'chat' }[toolType] || toolType
    if (!window.confirm(`Are you sure you want to delete this ${toolName} submission?`)) return
    try {
      let endpoint = ''
      switch (toolType) {
        case 'exam':
          endpoint = `/api/exam-history?userId=${user.id}&attemptId=${submissionId}`
          break
        case 'transcript':
          endpoint = `/api/transcript-history?userId=${user.id}&analysisId=${submissionId}`
          break
        case 'chat':
          endpoint = `/api/chat-history?userId=${user.id}&sessionId=${submissionId}`
          break
      }
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        setToolHistory(prev => prev.filter(item => item.id !== submissionId))
      } else {
        alert(`Failed to delete ${toolName}`)
      }
    } catch (err) {
      console.error(`Error deleting ${toolType}:`, err)
      alert(`Error deleting ${toolType}`)
    }
  }

  return (
    <Layout active="admin-history" pageTitle="User & Tool History">
      <div style={s.page}>
        {/* View Selector */}
        <div style={s.viewSelector}>
          <button
            onClick={() => setView('user')}
            style={{ ...s.viewBtn, ...(view === 'user' ? s.viewBtnActive : {}) }}
          >
            👤 User History
          </button>
          <button
            onClick={() => setView('tool')}
            style={{ ...s.viewBtn, ...(view === 'tool' ? s.viewBtnActive : {}) }}
          >
            📊 Tool Analytics
          </button>
        </div>

        {/* User History View */}
        {view === 'user' && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>User History</h2>
            <div style={s.selectGroup}>
              <label style={s.label}>Select User:</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={s.select}
              >
                <option value="">— Choose a user —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

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

        {/* Tool History View */}
        {view === 'tool' && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>Tool Analytics</h2>
            <div style={s.selectGroup}>
              <label style={s.label}>Select Tool:</label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                style={s.select}
              >
                {tools.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                <LoadingBar />
              </div>
            ) : (
              <>
                <div style={s.stats}>
                  <div style={s.statBox}>
                    <div style={s.statLabel}>Total Submissions</div>
                    <div style={s.statValue}>{toolHistory.length}</div>
                  </div>
                  <div style={s.statBox}>
                    <div style={s.statLabel}>Unique Users</div>
                    <div style={s.statValue}>{new Set(toolHistory.map(t => t.user_id)).size}</div>
                  </div>
                </div>

                {selectedTool === 'exam' && toolCompetencyBreakdown.length > 0 && (
                  <div style={{ ...s.section, marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Competency Breakdown (All Attempts)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {toolCompetencyBreakdown.map(comp => (
                        <div key={comp.competency} style={s.competencyBreakdownRow}>
                          <span style={s.competencyBreakdownName}>{comp.competency}</span>
                          <span style={s.competencyBreakdownStat}>{comp.correct}/{comp.total}</span>
                          <div style={s.competencyBreakdownBar}>
                            <div style={{ ...s.competencyBreakdownFill, width: `${comp.percentage}%`, background: comp.percentage >= 70 ? '#15803d' : comp.percentage >= 50 ? '#b45309' : '#b91c1c' }} />
                          </div>
                          <span style={s.competencyBreakdownPct}>{comp.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTool === 'exam' && questionStats.length > 0 && (
                  <div style={{ ...s.section, marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Question Analytics
                    </h3>
                    <div style={s.questionStatsContainer}>
                      {questionStats.map(q => (
                        <div key={q.id} style={s.questionStatRow}>
                          <div style={{ flex: 1 }}>
                            <p style={s.questionStatText}>{q.question}</p>
                            <p style={s.questionStatMeta}>{q.competency}</p>
                          </div>
                          <div style={s.questionStatRight}>
                            <div style={s.questionStatItem}>
                              <span style={s.questionStatLabel}>Used</span>
                              <span style={s.questionStatValue}>{q.timesUsed}</span>
                            </div>
                            <div style={s.questionStatItem}>
                              <span style={s.questionStatLabel}>Success</span>
                              <div style={s.questionStatBar}>
                                <div style={{ ...s.questionStatFill, width: `${q.successPercentage}%`, background: q.successPercentage >= 70 ? '#15803d' : q.successPercentage >= 50 ? '#b45309' : '#b91c1c' }} />
                              </div>
                              <span style={s.questionStatValue}>{q.successPercentage}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={s.listContainer}>
                  {toolHistory.length === 0 ? (
                    <p style={s.empty}>No submissions yet</p>
                  ) : (
                    toolHistory.map(item => (
                      <div key={item.id} style={s.item}>
                        <div style={s.itemHeader} onClick={() => toggleExpand(`tool-${item.id}`)}>
                          <div style={s.itemInfo}>
                            <div style={s.itemTitle}>
                              {item.user?.full_name || 'Unknown User'}
                            </div>
                            <div style={s.itemDate}>
                              {item.user?.email} • {formatDate(item.created_at)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {selectedTool === 'exam' && (
                              <div style={{ color: item.overall_score >= 70 ? '#15803d' : item.overall_score >= 50 ? '#b45309' : '#b91c1c', fontWeight: '700' }}>
                                {item.overall_score}%
                              </div>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); deleteToolSubmission(selectedTool, item.id) }} style={s.deleteBtn} title="Delete submission">
                              🗑️
                            </button>
                          </div>
                        </div>
                        {expandedItems[`tool-${item.id}`] && (
                          <div style={s.itemDetails}>
                            {selectedTool === 'exam' && (
                              <div style={s.stat}>
                                <span>{item.correct_answers}/{item.total_questions} correct</span>
                              </div>
                            )}
                            {selectedTool === 'transcript' && (
                              typeof item.competency_scores === 'object' && (
                                <div style={s.competencyList}>
                                  {Object.entries(item.competency_scores).slice(0, 5).map(([code, result]) => (
                                    <span key={code} style={{ ...s.badge, color: result === 'Observed' ? '#15803d' : '#b91c1c' }}>
                                      {code}: {result}
                                    </span>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Internal Assessments View */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>🤖 Internal Assessor Evaluations</h2>

          {internalAssessments.length === 0 ? (
            <p style={s.empty}>No internal assessments yet.</p>
          ) : (
            <div style={s.listContainer}>
              {internalAssessments.map(assessment => (
                <div key={assessment.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => toggleExpand(`assessment-${assessment.id}`)}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>
                        {assessment.assessment_data?.coach_identifier || 'Unknown Coach'} • Assessor {assessment.assessor_type}
                      </div>
                      <div style={s.itemDate}>
                        {assessment.transcript_filename && <span>{assessment.transcript_filename} • </span>}
                        {formatDate(assessment.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {assessment.assessment_data?.score_calculation && (
                        <div style={{ color: assessment.assessment_data.score_calculation.result === 'Pass' ? '#15803d' : '#dc2626', fontWeight: '700' }}>
                          {(assessment.assessment_data.score_calculation.final_score ?? 0).toFixed(2)}
                        </div>
                      )}
                      <span style={s.expandIcon}>{expandedItems[`assessment-${assessment.id}`] ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {expandedItems[`assessment-${assessment.id}`] && assessment.assessment_data && (
                    <div style={{ ...s.itemDetails, maxHeight: '800px', overflowY: 'auto' }}>
                      {/* Full Assessment Report Inline */}
                      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
                        <div style={{ borderBottom: `2px solid ${COLORS.navy}`, paddingBottom: '16px', marginBottom: '24px' }}>
                          <div style={{ fontSize: '14px', color: COLORS.gray, display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <span><strong>Coach:</strong> {assessment.assessment_data.coach_identifier}</span>
                            <span><strong>Assessor:</strong> {assessment.assessor_type === '2025' ? 'Nov 2025 BARS' : 'March 2024 BARS'}</span>
                            {assessment.transcript_filename && <span><strong>Transcript:</strong> {assessment.transcript_filename}</span>}
                          </div>
                        </div>

                        {/* Score Card */}
                        <div
                          style={{
                            background: assessment.assessment_data.score_calculation?.result === 'Pass' ? '#f0fdf4' : '#fef2f2',
                            border: `2px solid ${assessment.assessment_data.score_calculation?.result === 'Pass' ? '#86efac' : '#fca5a5'}`,
                            borderRadius: '8px',
                            padding: '24px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', letterSpacing: '2px', color: COLORS.gray, fontWeight: 500, marginBottom: '4px' }}>
                              FINAL SCORE
                            </div>
                            <div style={{ fontSize: '44px', fontWeight: 700, color: COLORS.navy, lineHeight: 1, letterSpacing: '-1px' }}>
                              {(assessment.assessment_data.score_calculation?.final_score ?? 0).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '13px', color: COLORS.gray, marginTop: '4px' }}>
                              Pass threshold: 3.40
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: '20px',
                              fontWeight: 700,
                              padding: '12px 24px',
                              borderRadius: '6px',
                              backgroundColor: assessment.assessment_data.score_calculation?.result === 'Pass' ? '#16a34a' : '#dc2626',
                              color: '#fff',
                              letterSpacing: '1.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            {assessment.assessment_data.score_calculation?.result === 'Pass' && '✓'}
                            {assessment.assessment_data.score_calculation?.result === 'Pass' ? 'PASS' : 'BELOW'}
                          </div>
                        </div>

                        {/* Competency Scores */}
                        <div style={{ marginBottom: '24px', padding: '16px', background: COLORS['gray-light'], borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '12px' }}>COMPETENCY SCORES</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {[3, 4, 5, 6, 7, 8].map(comp => {
                              const avg = assessment.assessment_data.score_calculation?.[`competency_${comp}_average`];
                              return avg !== undefined ? (
                                <div key={comp} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: COLORS['text-main'] }}>Competency {comp}:</span>
                                  <span style={{ fontWeight: 700, color: COLORS.navy }}>{avg.toFixed(2)}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>

                        {/* Strengths */}
                        {assessment.assessment_data.strengths?.length > 0 && (
                          <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Coaching Strengths
                            </h4>
                            {assessment.assessment_data.strengths.map((s, i) => (
                              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '0 4px 4px 0' }}>
                                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {s.competency_name} · {s.code}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>
                                  {s.statement_title}
                                </div>
                                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151' }}>
                                  {s.explanation}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggestions */}
                        {assessment.assessment_data.suggestions?.length > 0 && (
                          <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Suggestions for Development
                            </h4>
                            {assessment.assessment_data.suggestions.map((s, i) => (
                              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '0 4px 4px 0' }}>
                                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {s.competency_name} · {s.code}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>
                                  {s.statement_title}
                                </div>
                                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151', marginBottom: '6px' }}>
                                  {s.missed_opportunity}
                                </div>
                                {s.example_prompts?.length > 0 && (
                                  <div style={{ fontSize: '11px', color: COLORS['text-main'] }}>
                                    <strong>Example prompts:</strong>
                                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                                      {s.example_prompts.map((prompt, i) => (
                                        <li key={i} style={{ marginBottom: '2px', fontStyle: 'italic' }}>"{prompt}"</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Behavioral Statements with Evidence */}
                        {assessment.assessment_data.behavioral_statements?.length > 0 && (
                          <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Behavioral Statements Detail
                            </h4>
                            {assessment.assessment_data.behavioral_statements.map((stmt, i) => (
                              <div key={stmt.code} style={{ marginBottom: '16px', padding: '12px', background: '#f9fafc', border: `1px solid ${COLORS['gray-border']}`, borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS.navy }}>{stmt.code}</div>
                                    <div style={{ fontSize: '12px', lineHeight: '1.4', color: '#1a1a1a', marginTop: '2px' }}>{stmt.title}</div>
                                  </div>
                                  <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', background: stmt.rating === 'Meets the Standard' || stmt.rating === 'Exceeds the Standard' ? '#dcfce7' : '#fee2e2', color: stmt.rating === 'Meets the Standard' || stmt.rating === 'Exceeds the Standard' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                                    {stmt.rating}
                                  </span>
                                </div>

                                {/* Evidence */}
                                {stmt.evidence?.length > 0 && (
                                  <div style={{ fontSize: '10px', color: '#555', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${COLORS['gray-border']}` }}>
                                    <strong style={{ color: COLORS.navy }}>Evidence:</strong>
                                    {stmt.evidence.map((e, idx) => (
                                      <div key={idx} style={{ marginTop: '4px', marginLeft: '12px', fontSize: '10px', color: '#555' }}>
                                        <div style={{ fontWeight: '600', color: COLORS['text-main' ] }}>{e.timestamp}</div>
                                        <div style={{ fontStyle: 'italic', color: '#666' }}>"{e.quote}"</div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Contra Evidence */}
                                {stmt.contra_evidence && (
                                  <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${COLORS['gray-border']}` }}>
                                    <strong style={{ color: '#b91c1c' }}>Contra-Evidence:</strong> {stmt.contra_evidence}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => downloadAssessmentPDF(assessment)}
                          style={{ ...s.deleteBtn, background: COLORS.navy, border: 'none', color: '#fff', marginRight: 'auto' }}
                        >
                          📄 Download Report
                        </button>
                        <button
                          onClick={() => downloadAssessmentJSON(assessment)}
                          style={{ ...s.deleteBtn, background: '#f0f2f5', border: '1px solid #e2e6ec', color: COLORS['text-main'] }}
                        >
                          📥 Download JSON
                        </button>
                        <button
                          onClick={() => deleteAssessment(assessment.id)}
                          style={s.deleteBtn}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
    gap: '12px',
    marginBottom: '12px',
  },
  viewBtn: {
    padding: '10px 16px',
    border: `1px solid ${COLORS['gray-border']}`,
    background: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    color: COLORS['text-muted'],
    transition: 'all 0.2s',
  },
  viewBtnActive: {
    background: COLORS.navy,
    color: '#fff',
    borderColor: COLORS.navy,
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

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

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
  const [userHistory, setUserHistory] = useState({ exams: [], transcripts: [], chats: [] })
  const [toolHistory, setToolHistory] = useState([])
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
  }, [])

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
      const [examsRes, transcriptsRes, chatsRes] = await Promise.all([
        fetch(`/api/exam-history?userId=${user.id}&viewingUserId=${userId}`),
        fetch(`/api/transcript-history?userId=${user.id}&viewingUserId=${userId}`),
        fetch(`/api/chat-history?userId=${user.id}&viewingUserId=${userId}`),
      ])

      const examsData = await examsRes.json()
      const transcriptsData = await transcriptsRes.json()
      const chatsData = await chatsRes.json()

      setUserHistory({
        exams: examsData.data || [],
        transcripts: transcriptsData.data || [],
        chats: chatsData.data || [],
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
          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', item.user_id)
            .single()
          return { ...item, user: userData }
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
                            <div style={{ ...s.scoreCircle, color: exam.overall_score >= 70 ? '#15803d' : exam.overall_score >= 50 ? '#b45309' : '#b91c1c' }}>
                              {exam.overall_score}%
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
                            <span style={s.expandIcon}>{expandedItems[`transcript-${t.id}`] ? '▼' : '▶'}</span>
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
                            <span style={s.expandIcon}>{expandedItems[`chat-${chat.id}`] ? '▼' : '▶'}</span>
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
              <p style={s.empty}>Loading...</p>
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
                          {selectedTool === 'exam' && (
                            <div style={{ color: item.overall_score >= 70 ? '#15803d' : item.overall_score >= 50 ? '#b45309' : '#b91c1c', fontWeight: '700' }}>
                              {item.overall_score}%
                            </div>
                          )}
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

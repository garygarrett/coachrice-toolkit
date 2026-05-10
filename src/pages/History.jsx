import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
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

export default function History() {
  const { user } = useAuth()
  const [examAttempts, setExamAttempts] = useState([])
  const [transcriptAnalyses, setTranscriptAnalyses] = useState([])
  const [chatSessions, setChatSessions] = useState([])
  const [internalAssessments2021, setInternalAssessments2021] = useState([])
  const [internalAssessments2025, setInternalAssessments2025] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedExam, setExpandedExam] = useState(null)
  const [expandedTranscript, setExpandedTranscript] = useState(null)
  const [expandedChat, setExpandedChat] = useState(null)
  const [expandedAssessment, setExpandedAssessment] = useState(null)
  const [examDetails, setExamDetails] = useState({})
  const [chatDetails, setChatDetails] = useState({})
  const [transcriptDetails, setTranscriptDetails] = useState({})
  const [assessmentDetails, setAssessmentDetails] = useState({})

  useEffect(() => {
    loadHistory()
  }, [user])

  async function loadHistory() {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const [examsRes, transcriptsRes, chatsRes, assessments2021Res, assessments2025Res] = await Promise.all([
        fetch(`/api/exam-history?userId=${user.id}`),
        fetch(`/api/transcript-history?userId=${user.id}`),
        fetch(`/api/chat-history?userId=${user.id}`),
        fetch(`/api/internal-assessments?userId=${user.id}&assessorType=2021`),
        fetch(`/api/internal-assessments?userId=${user.id}&assessorType=2025`),
      ])

      if (!examsRes.ok || !transcriptsRes.ok || !chatsRes.ok || !assessments2021Res.ok || !assessments2025Res.ok) {
        throw new Error('Failed to load history')
      }

      const examsData = await examsRes.json()
      const transcriptsData = await transcriptsRes.json()
      const chatsData = await chatsRes.json()
      const assessments2021Data = await assessments2021Res.json()
      const assessments2025Data = await assessments2025Res.json()

      setExamAttempts(examsData.data || [])
      setTranscriptAnalyses(transcriptsData.data || [])
      setChatSessions(chatsData.data || [])
      setInternalAssessments2021(assessments2021Data.data || [])
      setInternalAssessments2025(assessments2025Data.data || [])
    } catch (err) {
      setError(err.message)
      console.error('Error loading history:', err)
    }
    setLoading(false)
  }

  async function loadExamDetails(attemptId) {
    try {
      const res = await fetch(`/api/exam-history?userId=${user.id}&attemptId=${attemptId}`)
      const data = await res.json()
      if (res.ok) {
        setExamDetails(prev => ({ ...prev, [attemptId]: data }))
      }
    } catch (err) {
      console.error('Error loading exam details:', err)
    }
  }

  async function loadChatDetails(sessionId) {
    try {
      const res = await fetch(`/api/chat-history?userId=${user.id}&sessionId=${sessionId}`)
      const data = await res.json()
      if (res.ok) {
        setChatDetails(prev => ({ ...prev, [sessionId]: data }))
      }
    } catch (err) {
      console.error('Error loading chat details:', err)
    }
  }

  async function loadTranscriptDetails(analysisId) {
    try {
      const res = await fetch(`/api/transcript-history?userId=${user.id}&analysisId=${analysisId}`)
      const data = await res.json()
      if (res.ok) {
        setTranscriptDetails(prev => ({ ...prev, [analysisId]: data }))
      }
    } catch (err) {
      console.error('Error loading transcript details:', err)
    }
  }

  async function loadAssessmentDetails(assessmentId) {
    try {
      const res = await fetch(`/api/internal-assessments?userId=${user.id}&assessmentId=${assessmentId}`)
      const data = await res.json()
      if (res.ok) {
        setAssessmentDetails(prev => ({ ...prev, [assessmentId]: data }))
      }
    } catch (err) {
      console.error('Error loading assessment details:', err)
    }
  }

  async function deleteExam(attemptId) {
    if (!window.confirm('Delete this exam attempt?')) return
    try {
      const res = await fetch('/api/exam-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, userId: user.id }),
      })
      if (res.ok) {
        setExamAttempts(prev => prev.filter(e => e.id !== attemptId))
        setExpandedExam(null)
      } else {
        alert('Failed to delete exam')
      }
    } catch (err) {
      console.error('Error deleting exam:', err)
    }
  }

  async function deleteTranscript(analysisId) {
    if (!window.confirm('Delete this transcript analysis?')) return
    try {
      const res = await fetch('/api/transcript-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, userId: user.id }),
      })
      if (res.ok) {
        setTranscriptAnalyses(prev => prev.filter(t => t.id !== analysisId))
      } else {
        alert('Failed to delete analysis')
      }
    } catch (err) {
      console.error('Error deleting analysis:', err)
    }
  }

  async function deleteChat(sessionId) {
    if (!window.confirm('Delete this chat session?')) return
    try {
      const res = await fetch('/api/chat-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id }),
      })
      if (res.ok) {
        setChatSessions(prev => prev.filter(c => c.id !== sessionId))
        setExpandedChat(null)
      } else {
        alert('Failed to delete session')
      }
    } catch (err) {
      console.error('Error deleting session:', err)
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
        setInternalAssessments2021(prev => prev.filter(a => a.id !== assessmentId))
        setInternalAssessments2025(prev => prev.filter(a => a.id !== assessmentId))
        setExpandedAssessment(null)
      } else {
        alert('Failed to delete assessment')
      }
    } catch (err) {
      console.error('Error deleting assessment:', err)
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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function AssessmentReport({ assessment, version }) {
    const data = assessment.assessment_data || {}
    const sc = data.score_calculation || {}

    return (
      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px' }}>
          {version === '2025' ? 'ACC Performance Evaluation (Nov 2025)' : 'ACC Performance Evaluation (March 2024)'}
        </h3>

        {/* Score Box */}
        <div style={{ background: sc.result === 'Pass' ? '#f0fdf4' : '#fef2f2', border: `2px solid ${sc.result === 'Pass' ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '4px' }}>FINAL SCORE</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: COLORS.navy }}>
                {(sc.final_score ?? 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '11px', color: COLORS['text-muted'], marginTop: '4px' }}>Pass threshold: 3.40</div>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, padding: '8px 16px', borderRadius: '4px', backgroundColor: sc.result === 'Pass' ? '#16a34a' : '#dc2626', color: '#fff' }}>
              {sc.result === 'Pass' ? '✓ PASS' : '✗ BELOW PASSING'}
            </div>
          </div>
        </div>

        {/* Competency Averages */}
        <div style={{ marginBottom: '24px', padding: '16px', background: COLORS['gray-light'], borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '12px' }}>COMPETENCY SCORES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[3, 4, 5, 6, 7, 8].map(comp => (
              <div key={comp} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: COLORS['text-main'] }}>Competency {comp}:</span>
                <span style={{ fontWeight: 700, color: COLORS.navy }}>{(sc[`competency_${comp}_average`] ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        {data.strengths && data.strengths.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coaching Strengths</h4>
            {data.strengths.map((s, i) => (
              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '0 4px 4px 0' }}>
                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>{s.statement_title}</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151' }}>{s.explanation}</div>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {data.suggestions && data.suggestions.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggestions for Development</h4>
            {data.suggestions.map((s, i) => (
              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '0 4px 4px 0' }}>
                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>{s.statement_title}</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151', marginBottom: '6px' }}>{s.missed_opportunity}</div>
                {s.example_prompts && s.example_prompts.length > 0 && (
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
      </div>
    )
  }

  function TranscriptAnalysisReport({ analysis }) {
    let evaluation = {}
    if (typeof analysis.analysis_text === 'string') {
      try {
        evaluation = JSON.parse(analysis.analysis_text)
      } catch (e) {
        evaluation = { error: 'Could not parse analysis' }
      }
    } else {
      evaluation = analysis.analysis_text || {}
    }

    const compTitles = {
      3: 'Establishes and Maintains Agreements',
      4: 'Cultivates Trust and Safety',
      5: 'Maintains Presence',
      6: 'Listens Actively',
      7: 'Evokes Awareness',
      8: 'Facilitates Client Growth'
    }

    return (
      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px' }}>
          Your Coaching Feedback
        </h3>

        {/* Skills Observed */}
        {evaluation.behavioral_statements && (
          <div style={{ marginBottom: '24px', padding: '16px', background: COLORS['gray-light'], borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '8px' }}>SKILLS OBSERVED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.navy }}>
              {evaluation.behavioral_statements.filter(s => s.result === 'Observed').length} / {evaluation.behavioral_statements.length}
            </div>
          </div>
        )}

        {/* Competencies */}
        {evaluation.behavioral_statements && (() => {
          const grouped = {}
          evaluation.behavioral_statements.forEach(s => {
            const c = parseInt(s.code?.split('.')[0], 10)
            if (!grouped[c]) grouped[c] = []
            grouped[c].push(s)
          })

          return [3, 4, 5, 6, 7, 8].map(comp => (
            <div key={comp} style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {comp}. {compTitles[comp]}
              </h4>
              {(grouped[comp] || []).map(skill => (
                <div key={skill.code} style={{ background: '#f9fafc', borderRadius: '6px', border: `1px solid ${COLORS['gray-border']}`, padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: COLORS.navy }}>{skill.code}</div>
                      <div style={{ fontSize: '12px', lineHeight: '1.4', color: '#1a1a1a', marginTop: '2px' }}>{skill.title}</div>
                    </div>
                    <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', background: skill.result === 'Observed' ? '#dcfce7' : '#fee2e2', color: skill.result === 'Observed' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                      {skill.result === 'Observed' ? '✓ Observed' : '✗ Not Observed'}
                    </span>
                  </div>
                  {skill.note && <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', fontStyle: 'italic' }}>{skill.note}</div>}
                  {skill.evidence && skill.evidence.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#555', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${COLORS['gray-border']}` }}>
                      <strong>Evidence:</strong> {skill.evidence.map((e, i) => `${e.timestamp}: "${e.quote}"`).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        })()}

        {/* Strengths */}
        {evaluation.strengths && evaluation.strengths.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coaching Strengths</h4>
            {evaluation.strengths.map((s, i) => (
              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '0 4px 4px 0' }}>
                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>{s.statement_title}</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151' }}>{s.explanation}</div>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {evaluation.suggestions && evaluation.suggestions.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggestions for Development</h4>
            {evaluation.suggestions.map((s, i) => (
              <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '0 4px 4px 0' }}>
                <div style={{ fontSize: '10px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.navy, marginBottom: '6px' }}>{s.statement_title}</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151', marginBottom: '6px' }}>{s.missed_opportunity}</div>
                {s.example_prompts && s.example_prompts.length > 0 && (
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
      </div>
    )
  }

  if (loading) {
    return (
      <Layout active="history" pageTitle="History">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 200px)' }}>
          <LoadingBar />
        </div>
      </Layout>
    )
  }

  return (
    <Layout active="history" pageTitle="History">
      <div style={s.page}>
        {error && <div style={s.error}>{error}</div>}

        {/* Exams Section */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={s.sectionIcon}>📝</span> Exam Attempts ({examAttempts.length})
          </h2>
          {examAttempts.length === 0 ? (
            <p style={s.empty}>No exams yet. Start practicing!</p>
          ) : (
            <div style={s.listContainer}>
              {examAttempts.map(exam => (
                <div key={exam.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => {
                    setExpandedExam(expandedExam === exam.id ? null : exam.id)
                    if (expandedExam !== exam.id && !examDetails[exam.id]) {
                      loadExamDetails(exam.id)
                    }
                  }}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>
                        {exam.correct_answers}/{exam.total_questions} correct ({exam.overall_score}%)
                      </div>
                      <div style={s.itemDate}>{formatDate(exam.created_at)}</div>
                    </div>
                    <div style={s.scoreCircle}>
                      <div style={{ ...s.score, color: exam.overall_score >= 70 ? '#15803d' : exam.overall_score >= 50 ? '#b45309' : '#b91c1c' }}>
                        {exam.overall_score}%
                      </div>
                    </div>
                  </div>
                  {expandedExam === exam.id && (
                    <div style={s.itemDetails}>
                      {examDetails[exam.id] && (
                        <>
                          <div style={s.reviewList}>
                            {examDetails[exam.id].answers?.map((q, i) => (
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
                          <button
                            onClick={() => deleteExam(exam.id)}
                            style={s.deleteBtn}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transcripts Section */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={s.sectionIcon}>📄</span> Transcript Analyses ({transcriptAnalyses.length})
          </h2>
          {transcriptAnalyses.length === 0 ? (
            <p style={s.empty}>No transcript analyses yet.</p>
          ) : (
            <div style={s.listContainer}>
              {transcriptAnalyses.map(transcript => (
                <div key={transcript.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => {
                    setExpandedTranscript(expandedTranscript === transcript.id ? null : transcript.id)
                    if (expandedTranscript !== transcript.id && !transcriptDetails[transcript.id]) {
                      loadTranscriptDetails(transcript.id)
                    }
                  }}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>Transcript Analysis</div>
                      <div style={s.itemDate}>{formatDate(transcript.created_at)}</div>
                    </div>
                    <span style={s.expandIcon}>{expandedTranscript === transcript.id ? '▼' : '▶'}</span>
                  </div>
                  {expandedTranscript === transcript.id && transcriptDetails[transcript.id] && (
                    <div style={s.itemDetails}>
                      <TranscriptAnalysisReport analysis={transcriptDetails[transcript.id]} />
                      <button
                        onClick={() => deleteTranscript(transcript.id)}
                        style={s.deleteBtn}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Sessions Section */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={s.sectionIcon}>💬</span> Chat Sessions ({chatSessions.length})
          </h2>
          {chatSessions.length === 0 ? (
            <p style={s.empty}>No chat sessions yet.</p>
          ) : (
            <div style={s.listContainer}>
              {chatSessions.map(chat => (
                <div key={chat.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => {
                    setExpandedChat(expandedChat === chat.id ? null : chat.id)
                    if (expandedChat !== chat.id && !chatDetails[chat.id]) {
                      loadChatDetails(chat.id)
                    }
                  }}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>Chat Session</div>
                      <div style={s.itemDate}>{formatDate(chat.created_at)}</div>
                    </div>
                    <span style={s.expandIcon}>{expandedChat === chat.id ? '▼' : '▶'}</span>
                  </div>
                  {expandedChat === chat.id && (
                    <div style={s.itemDetails}>
                      {chatDetails[chat.id] && (
                        <>
                          <div style={s.messageList}>
                            {chatDetails[chat.id].messages?.map((msg, i) => (
                              <div key={i} style={{ ...s.message, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{ ...s.messageBubble, background: msg.role === 'user' ? COLORS.navy : COLORS['gray-light'] }}>
                                  <div style={{ color: msg.role === 'user' ? '#fff' : COLORS['text-main'], fontSize: '13px', lineHeight: '1.5' }}>
                                    {msg.content}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {chatDetails[chat.id].analysis && (
                            <div style={s.analysis}>
                              <strong style={{ display: 'block', marginBottom: '8px' }}>Feedback:</strong>
                              <div style={{ fontSize: '12px', color: COLORS['text-muted'] }}>
                                {typeof chatDetails[chat.id].analysis.analysis_text === 'string'
                                  ? chatDetails[chat.id].analysis.analysis_text.substring(0, 200) + '...'
                                  : JSON.stringify(chatDetails[chat.id].analysis.analysis_text).substring(0, 200) + '...'}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => deleteChat(chat.id)}
                            style={s.deleteBtn}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Internal Assessor 2025 Section */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={s.sectionIcon}>🤖</span> Internal Assessor (2025) ({internalAssessments2025.length})
          </h2>
          {internalAssessments2025.length === 0 ? (
            <p style={s.empty}>No internal assessments yet.</p>
          ) : (
            <div style={s.listContainer}>
              {internalAssessments2025.map(assessment => (
                <div key={assessment.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => {
                    setExpandedAssessment(expandedAssessment === assessment.id ? null : assessment.id)
                    if (expandedAssessment !== assessment.id && !assessmentDetails[assessment.id]) {
                      loadAssessmentDetails(assessment.id)
                    }
                  }}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>
                        {assessment.assessment_data?.score_calculation?.final_score
                          ? `Score: ${assessment.assessment_data.score_calculation.final_score.toFixed(2)}`
                          : 'Assessment'
                        }
                        {assessment.transcript_filename && <div style={{ fontSize: '12px', color: COLORS['text-muted'], marginTop: '4px' }}>{assessment.transcript_filename}</div>}
                      </div>
                      <div style={s.itemDate}>{formatDate(assessment.created_at)}</div>
                    </div>
                    <span style={s.expandIcon}>{expandedAssessment === assessment.id ? '▼' : '▶'}</span>
                  </div>
                  {expandedAssessment === assessment.id && assessmentDetails[assessment.id] && (
                    <div style={s.itemDetails}>
                      <AssessmentReport assessment={assessmentDetails[assessment.id]} version="2025" />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => downloadAssessmentJSON(assessmentDetails[assessment.id])}
                          style={{ ...s.deleteBtn, background: '#f0f2f5', border: '1px solid #e2e6ec', color: COLORS['text-main'], marginRight: 'auto' }}
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

        {/* Internal Assessor 2021 Section */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={s.sectionIcon}>🤖</span> Internal Assessor (2021) ({internalAssessments2021.length})
          </h2>
          {internalAssessments2021.length === 0 ? (
            <p style={s.empty}>No internal assessments yet.</p>
          ) : (
            <div style={s.listContainer}>
              {internalAssessments2021.map(assessment => (
                <div key={assessment.id} style={s.item}>
                  <div style={s.itemHeader} onClick={() => {
                    setExpandedAssessment(expandedAssessment === assessment.id ? null : assessment.id)
                    if (expandedAssessment !== assessment.id && !assessmentDetails[assessment.id]) {
                      loadAssessmentDetails(assessment.id)
                    }
                  }}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>
                        {assessment.assessment_data?.score_calculation?.final_score
                          ? `Score: ${assessment.assessment_data.score_calculation.final_score.toFixed(2)}`
                          : 'Assessment'
                        }
                        {assessment.transcript_filename && <div style={{ fontSize: '12px', color: COLORS['text-muted'], marginTop: '4px' }}>{assessment.transcript_filename}</div>}
                      </div>
                      <div style={s.itemDate}>{formatDate(assessment.created_at)}</div>
                    </div>
                    <span style={s.expandIcon}>{expandedAssessment === assessment.id ? '▼' : '▶'}</span>
                  </div>
                  {expandedAssessment === assessment.id && assessmentDetails[assessment.id] && (
                    <div style={s.itemDetails}>
                      <AssessmentReport assessment={assessmentDetails[assessment.id]} version="2021" />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => downloadAssessmentJSON(assessmentDetails[assessment.id])}
                          style={{ ...s.deleteBtn, background: '#f0f2f5', border: '1px solid #e2e6ec', color: COLORS['text-main'], marginRight: 'auto' }}
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
    gap: '32px',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  section: {
    background: '#fff',
    borderRadius: '10px',
    border: `1px solid ${COLORS['gray-border']}`,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: COLORS.navy,
    padding: '16px 20px',
    margin: 0,
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '18px',
  },
  empty: {
    color: COLORS['text-muted'],
    padding: '20px',
    textAlign: 'center',
    fontSize: '13px',
    margin: 0,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  itemHeader: {
    padding: '16px 20px',
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
    fontSize: '14px',
    fontWeight: '600',
    color: COLORS['text-main'],
  },
  itemDate: {
    fontSize: '12px',
    color: COLORS['text-muted'],
    marginTop: '4px',
  },
  scoreCircle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  score: {
    fontSize: '18px',
    fontWeight: '700',
  },
  expandIcon: {
    fontSize: '12px',
    color: COLORS['text-muted'],
  },
  itemDetails: {
    padding: '16px 20px',
    background: COLORS['gray-light'],
    borderTop: `1px solid ${COLORS['gray-border']}`,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  answerItem: {
    borderLeft: '3px solid',
    paddingLeft: '12px',
    padding: '12px',
    background: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
  },
  answerNumber: {
    fontWeight: '700',
    marginBottom: '4px',
  },
  answerStatus: {
    fontSize: '11px',
    color: COLORS['text-muted'],
    marginBottom: '4px',
  },
  answerCorrect: {
    fontSize: '10px',
    color: '#15803d',
    fontWeight: '600',
  },
  analysisPreview: {
    fontSize: '12px',
    color: COLORS['text-main'],
    marginBottom: '16px',
    background: '#fff',
    padding: '12px',
    borderRadius: '4px',
  },
  competencyList: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  competencyItem: {
    fontSize: '11px',
    color: COLORS['text-muted'],
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
    maxHeight: '300px',
    overflowY: 'auto',
    background: '#fff',
    padding: '12px',
    borderRadius: '4px',
  },
  message: {
    display: 'flex',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '10px 12px',
    borderRadius: '6px',
  },
  analysis: {
    background: '#fff',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '12px',
  },
  deleteBtn: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
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
}

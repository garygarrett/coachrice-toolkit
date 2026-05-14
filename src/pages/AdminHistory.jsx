import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import LoadingBar from '../components/LoadingBar'
import { AssessmentReportDisplay } from '../components/AssessmentReport'
import { exportAssessmentsToExcel } from '../utils/exportAssessments'

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
  const [view, setView] = useState('user') // 'user', 'tool', or 'assessments'
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
    // Load jsPDF library for PDF generation
    if (!window.jspdf) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      document.head.appendChild(script)
    }
  }, [])

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

  function downloadAssessmentPDF(assessment) {
    const printWindow = window.open('', '', 'width=900,height=1200')
    const doc = printWindow.document

    // Write the HTML structure matching the history view
    const evaluation = assessment.assessment_data || {}
    const coach = evaluation.coach_identifier || 'Submitted Coach'
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const passStatus = evaluation.score_calculation?.result === 'Pass'

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Report</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 24px;
            font-family: 'Montserrat', sans-serif;
            background: white;
            color: #0f1c3a;
            line-height: 1.6;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
          }
          .header {
            border-bottom: 4px solid #00205B;
            padding-bottom: 20px;
            margin-bottom: 32px;
          }
          .header-meta {
            font-size: 10px;
            letter-spacing: 2.5px;
            color: #7C7E7F;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header-title {
            font-size: 32px;
            font-weight: 700;
            color: #00205B;
            margin: 0 0 16px;
            letter-spacing: -0.5px;
          }
          .header-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            font-size: 13px;
            color: #7C7E7F;
          }
          .detail-label {
            font-size: 11px;
            font-weight: 600;
            color: #00205B;
            margin-bottom: 4px;
          }
          .score-box {
            background: ${passStatus ? '#f0fdf4' : '#fef2f2'};
            border: 2px solid ${passStatus ? '#86efac' : '#fca5a5'};
            border-radius: 8px;
            padding: 28px;
            margin-bottom: 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            align-items: center;
          }
          .score-label {
            font-size: 11px;
            font-weight: 600;
            color: #7C7E7F;
            margin-bottom: 8px;
          }
          .score-value {
            font-size: 48px;
            font-weight: 700;
            color: #00205B;
            margin-bottom: 8px;
          }
          .score-threshold {
            font-size: 11px;
            color: #7C7E7F;
          }
          .badge {
            display: inline-block;
            background: ${passStatus ? '#16a34a' : '#dc2626'};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 1px;
            text-align: right;
          }
          section {
            margin-bottom: 32px;
            page-break-inside: avoid;
          }
          .section-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            border-bottom: 2px solid #00205B;
            padding-bottom: 8px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #00205B;
            margin: 0;
            letter-spacing: -0.2px;
          }
          .section-subtitle {
            font-size: 12px;
            color: #7C7E7F;
            margin-top: 3px;
            font-style: italic;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 16px;
            border: 1px solid #e2e6ec;
            border-radius: 6px;
            overflow: hidden;
          }
          thead tr {
            background: #00205B;
            color: white;
          }
          th {
            padding: 10px 16px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            letter-spacing: 1px;
          }
          th:last-child {
            text-align: right;
            width: 180px;
          }
          td {
            padding: 12px 16px;
            border-bottom: 1px solid #e2e6ec;
          }
          tbody tr:last-child td {
            border-bottom: none;
          }
          .observed-yes {
            color: #16a34a;
            font-weight: 600;
          }
          .observed-no {
            color: #dc2626;
            font-weight: 600;
          }
          .note-box {
            margin-top: 12px;
            padding: 12px;
            background: #f9fafc;
            border-left: 4px solid #ff8200;
            border-radius: 4px;
          }
          .note-label {
            font-size: 11px;
            font-weight: 600;
            color: #00205B;
            margin-bottom: 6px;
          }
          .note-text {
            font-size: 12px;
            color: #6b7a99;
            font-style: italic;
            line-height: 1.5;
          }
          .statement-item {
            margin-bottom: 16px;
            padding: 12px;
            border-left: 4px solid #69cce6;
            border-radius: 4px;
            background: #f0f2f5;
          }
          .statement-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .statement-code {
            font-weight: 600;
            color: #00205B;
            font-size: 13px;
          }
          .statement-score {
            font-weight: 600;
            color: #00205B;
            font-size: 13px;
          }
          .statement-title {
            font-size: 12px;
            margin-bottom: 8px;
            color: #0f1c3a;
          }
          .statement-rating {
            font-size: 11px;
            color: #7C7E7F;
            font-weight: 500;
            margin-bottom: 8px;
          }
          .strength-item, .suggestion-item {
            margin-bottom: 16px;
          }
          .item-title {
            font-weight: 600;
            color: #00205B;
            font-size: 13px;
            margin-bottom: 4px;
          }
          .item-text {
            font-size: 12px;
            color: #0f1c3a;
            line-height: 1.5;
          }
          .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #e2e6ec;
            font-size: 10px;
            color: #7C7E7F;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 48px; }
            section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-meta">DOERR INSTITUTE FOR NEW LEADERS · COACHRICE LEVEL 1</div>
            <h1 class="header-title">ACC Performance Evaluation</h1>
            <div class="header-details">
              <div>
                <div class="detail-label">Coach</div>
                <div>${coach}</div>
              </div>
              <div>
                <div class="detail-label">Date</div>
                <div>${dateStr}</div>
              </div>
              <div>
                <div class="detail-label">Rubric</div>
                <div>ICF ACC BARS (${assessment.assessor_type === '2025' ? 'Nov 2025' : 'March 2024'})</div>
              </div>
            </div>
            ${assessment.transcript_filename ? `<div style="margin-top: 12px;"><div class="detail-label">Transcript</div><div>${assessment.transcript_filename}</div></div>` : ''}
          </div>

          <div class="score-box">
            <div>
              <div class="score-label">FINAL SCORE</div>
              <div class="score-value">${(evaluation.score_calculation?.final_score ?? 0).toFixed(2)}</div>
              <div class="score-threshold">Pass threshold: 3.40</div>
            </div>
            <div style="text-align: right;">
              <div class="badge">${passStatus ? '✓ PASS' : 'BELOW PASSING'}</div>
            </div>
          </div>

          <section>
            <div class="section-header">
              <h2 class="section-title">1. Demonstrates Ethical Practice</h2>
            </div>
            <p class="section-subtitle">Understands and consistently applies coaching ethics and standards of coaching.</p>
            <table>
              <thead>
                <tr>
                  <th>QUALIFIER</th>
                  <th>OBSERVED</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. Coach demonstrates alignment with the ICF Code of Ethics.</td>
                  <td class="${evaluation.ethical_practice?.icf_code_alignment === 'Observed' ? 'observed-yes' : 'observed-no'}">${evaluation.ethical_practice?.icf_code_alignment}</td>
                </tr>
                <tr>
                  <td>2. Coach demonstrates consistent alignment with the role of "coach."</td>
                  <td class="${evaluation.ethical_practice?.coach_role_alignment === 'Observed' ? 'observed-yes' : 'observed-no'}">${evaluation.ethical_practice?.coach_role_alignment}</td>
                </tr>
              </tbody>
            </table>
            ${evaluation.ethical_practice?.icf_code_alignment === 'Not Observed' && evaluation.ethical_practice?.icf_code_alignment_note ? `
              <div class="note-box">
                <div class="note-label">Rationale: ICF Code of Ethics Alignment</div>
                <div class="note-text">${evaluation.ethical_practice.icf_code_alignment_note}</div>
              </div>
            ` : ''}
            ${evaluation.ethical_practice?.coach_role_alignment === 'Not Observed' && evaluation.ethical_practice?.coach_role_alignment_note ? `
              <div class="note-box">
                <div class="note-label">Rationale: Coach Role Alignment</div>
                <div class="note-text">${evaluation.ethical_practice.coach_role_alignment_note}</div>
              </div>
            ` : ''}
          </section>

          <footer class="footer">
            <div>CoachRICE Internal Assessor Report</div>
            <div>Generated on ${dateStr}</div>
          </footer>
        </div>
      </body>
      </html>
    `)

    doc.close()

    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
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
            User History
          </button>
          <button
            onClick={() => setView('tool')}
            style={{ ...s.viewBtn, ...(view === 'tool' ? s.viewBtnActive : {}) }}
          >
            Tool Analytics
          </button>
          <button
            onClick={() => setView('assessments')}
            style={{ ...s.viewBtn, ...(view === 'assessments' ? s.viewBtnActive : {}) }}
          >
            Internal Assessments
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
        {view === 'assessments' && (
          <div style={s.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={s.sectionTitle}>Internal Assessor Evaluations</h2>
              {internalAssessments.length > 0 && (
                <button
                  onClick={() => exportAssessmentsToExcel(internalAssessments)}
                  style={{
                    padding: '10px 16px',
                    background: COLORS.navy,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, sans-serif',
                    letterSpacing: '0.3px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#001a3f'}
                  onMouseLeave={(e) => e.target.style.background = COLORS.navy}
                >
                  📊 Export to Excel
                </button>
              )}
            </div>

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
                    <div style={{ ...s.itemDetails, maxHeight: '1000px', overflowY: 'auto' }}>
                      <AssessmentReportDisplay assessment={assessment} />

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${COLORS['gray-border']}` }}>
                        <button
                          onClick={() => downloadAssessmentPDF(assessment)}
                          style={{ ...s.deleteBtn, background: COLORS.navy, border: 'none', color: '#fff', marginRight: 'auto', padding: '10px 20px', borderRadius: '6px' }}
                        >
                          📄 Download PDF
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

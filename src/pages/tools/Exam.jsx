import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'

const EXAM_LENGTH = 10

function pickQuestions(allQuestions) {
  const byCompetency = {}
  for (const q of allQuestions) {
    if (!byCompetency[q.competency]) byCompetency[q.competency] = []
    byCompetency[q.competency].push(q)
  }

  const selected = []
  const usedIds = new Set()

  for (const group of Object.values(byCompetency)) {
    const pick = group[Math.floor(Math.random() * group.length)]
    selected.push(pick)
    usedIds.add(pick.id)
  }

  const remaining = allQuestions.filter(q => !usedIds.has(q.id))
  while (selected.length < EXAM_LENGTH && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length)
    selected.push(remaining.splice(idx, 1)[0])
  }

  return selected.sort(() => Math.random() - 0.5)
}

function proficiencyLabel(pct) {
  if (pct === 100) return { label: 'Exceeding', color: '#15803d', bg: '#f0fdf4' }
  if (pct >= 75)   return { label: 'Meeting',   color: '#1d4ed8', bg: '#eff6ff' }
  if (pct >= 50)   return { label: 'Approaching', color: '#b45309', bg: '#fffbeb' }
  return                   { label: 'Developing', color: '#b91c1c', bg: '#fef2f2' }
}

const CONTENT_DEFAULTS = {
  exam_start_badge:    '',
  exam_start_title:    '',
  exam_start_subtitle: '',
  exam_start_info_1:   '',
  exam_start_info_2:   '',
  exam_start_info_3:   '',
  theme_primary_color: '#00205B',
  theme_page_bg:       '#f0f2f5',
  theme_font_family:   'system-ui, -apple-system, sans-serif',
}

export default function Exam() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [allQuestions, setAllQuestions] = useState([])
  const [loadingBank, setLoadingBank] = useState(true)
  const [phase, setPhase] = useState('start') // 'start' | 'quiz' | 'results'
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [content, setContent] = useState(CONTENT_DEFAULTS)

  // Load question bank and start-screen content from Supabase on mount
  useEffect(() => {
    supabase
      .from('questions')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setAllQuestions(data)
        setLoadingBank(false)
      })

    supabase
      .from('site_content')
      .select('key, value')
      .in('key', Object.keys(CONTENT_DEFAULTS))
      .then(({ data }) => {
        if (data?.length) {
          const map = {}
          data.forEach(row => { map[row.key] = row.value })
          setContent(prev => ({ ...prev, ...map }))
        }
      })
  }, [])

  const startExam = useCallback(() => {
    setQuestions(pickQuestions(allQuestions))
    setCurrentIndex(0)
    setAnswers({})
    setResults(null)
    setPhase('quiz')
  }, [allQuestions])

  function selectAnswer(letter) {
    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: letter }))
  }

  async function submitExam() {
    const scored = questions.map(q => ({
      ...q,
      options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
      userAnswer: answers[q.id],
      isCorrect: answers[q.id] === q.correct,
    }))

    const score = scored.filter(s => s.isCorrect).length
    const total = scored.length

    const competencyMap = {}
    for (const s of scored) {
      if (!competencyMap[s.competency]) competencyMap[s.competency] = { correct: 0, total: 0 }
      competencyMap[s.competency].total++
      if (s.isCorrect) competencyMap[s.competency].correct++
    }

    const competencyBreakdown = Object.entries(competencyMap).map(([name, data]) => ({
      competency: name,
      correct: data.correct,
      total: data.total,
      pct: Math.round((data.correct / data.total) * 100),
    }))

    setResults({ score, total, competencyBreakdown, scored })
    setPhase('results')

    // Save to Supabase in the background
    if (user) {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          tool: 'exam',
          score_category: 'ACC Practice Exam',
          raw_input: JSON.stringify(scored.map(({ id, competency, question }) => ({ id, competency, question }))),
          raw_output: JSON.stringify({ score, total }),
          status: 'completed',
        })
        .select('id')
        .single()

      if (sessionError) {
        console.error('[Exam] sessions insert error:', sessionError.message, sessionError.details, sessionError.hint)
      } else if (session?.id) {
        const scoreRows = competencyBreakdown.map(c => {
          const { label } = proficiencyLabel(c.pct)
          return {
            session_id: session.id,
            user_id: user.id,
            score_category: 'knowledge',
            competency: c.competency,
            proficiency_level: label,
            proficiency_numeric: c.correct / c.total,
            notes: `${c.correct}/${c.total} correct`,
          }
        })
        console.log('[Exam] inserting competency_scores rows:', JSON.stringify(scoreRows))
        const { error: scoresError } = await supabase.from('competency_scores').insert(scoreRows)
        if (scoresError) console.error('[Exam] competency_scores insert error:', scoresError.message, scoresError.details, scoresError.hint)
      }
    }
  }

  function advance() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      submitExam()
    }
  }

  const primary = content.theme_primary_color
  const pageBg  = content.theme_page_bg
  const font    = content.theme_font_family

  // ─── START SCREEN ───
  if (phase === 'start') {
    return (
      <Layout active="exam" pageTitle="ACC Practice Exam">
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
          <div style={{ marginBottom: '32px' }}>
            <p style={{ ...s.badge, background: '#e8ecf5', color: '#00205B' }}>{content.exam_start_badge}</p>
            <h1 style={{ ...s.title, color: '#00205B' }}>{content.exam_start_title}</h1>
            <p style={s.subtitle}>{content.exam_start_subtitle}</p>
            <ul style={s.infoList}>
              {[content.exam_start_info_1, content.exam_start_info_2, content.exam_start_info_3]
                .filter(Boolean)
                .map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={startExam} disabled={loadingBank} style={{ ...s.primaryBtn, background: primary, opacity: loadingBank ? 0.5 : 1 }}>
                {loadingBank ? 'Loading questions…' : 'Start Exam'}
              </button>
              <button onClick={() => navigate('/dashboard')} style={s.backBtn}>Back to Dashboard</button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // ─── RESULTS SCREEN ───
  if (phase === 'results' && results) {
    const pct = Math.round((results.score / results.total) * 100)
    const overall = proficiencyLabel(pct)

    return (
      <Layout active="exam" pageTitle="ACC Practice Exam">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...s.card, maxWidth: '600px' }}>
            <p style={s.badge}>Exam Complete</p>
            <h1 style={s.title}>Your Results</h1>

            <div style={{ ...s.scoreCircle, borderColor: primary }}>
              <span style={{ ...s.scoreNumber, color: primary }}>{results.score}/{results.total}</span>
              <span style={{ ...s.scoreLabel, color: overall.color }}>{overall.label}</span>
            </div>

            <h2 style={s.sectionTitle}>By Competency</h2>
            <div style={s.breakdownList}>
              {results.competencyBreakdown.map(c => {
                const p = proficiencyLabel(c.pct)
                return (
                  <div key={c.competency} style={s.breakdownRow}>
                    <span style={s.competencyName}>{c.competency}</span>
                    <span style={{ ...s.profBadge, color: p.color, background: p.bg }}>
                      {c.correct}/{c.total}
                    </span>
                  </div>
                )
              })}
            </div>

            <h2 style={s.sectionTitle}>Question Review</h2>
            <div style={s.reviewList}>
              {results.scored.map((q, i) => (
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

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
              <button onClick={startExam} style={{ ...s.primaryBtn, background: primary }}>Take Another Exam</button>
              <button onClick={() => navigate('/dashboard')} style={s.backBtn}>Back to Dashboard</button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // ─── QUIZ SCREEN ───
  const q = questions[currentIndex]
  const selected = answers[q?.id]
  const isLast = currentIndex === questions.length - 1
  const progress = (currentIndex / questions.length) * 100

  return (
    <Layout active="exam" pageTitle="ACC Practice Exam">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={s.card}>
          <div style={s.quizHeader}>
            <span style={{ ...s.badge, color: primary }}>{q.competency}</span>
            <span style={s.counter}>Question {currentIndex + 1} of {questions.length}</span>
          </div>

          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${progress}%`, background: primary }} />
          </div>

          <p style={s.questionText}>{q.question}</p>

          <div style={s.optionsList}>
            {['A', 'B', 'C', 'D'].map(letter => (
              <button
                key={letter}
                onClick={() => selectAnswer(letter)}
                style={{ ...s.optionBtn, ...(selected === letter ? { ...s.optionSelected, borderColor: primary } : {}) }}
              >
                <span style={{ ...s.optionLetter, background: primary }}>{letter}</span>
                <span style={s.optionText}>{q[`option_${letter.toLowerCase()}`]}</span>
              </button>
            ))}
          </div>

          <div style={s.navRow}>
            {currentIndex > 0 && (
              <button onClick={() => setCurrentIndex(i => i - 1)} style={{ ...s.secondaryBtn, color: primary, borderColor: primary }}>Back</button>
            )}
            <button
              onClick={advance}
              disabled={!selected}
              style={{ ...s.primaryBtn, background: primary, marginLeft: 'auto', opacity: selected ? 1 : 0.45 }}
            >
              {isLast ? 'Submit Exam' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.09)',
    padding: '2rem',
    width: '100%',
    maxWidth: '680px',
  },
  badge: {
    display: 'inline-block',
    background: '#e8ecf5',
    color: '#00205B',
    fontSize: '0.75rem',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#00205B',
    margin: '0 0 0.5rem',
  },
  subtitle: {
    color: '#555',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    margin: '0 0 1.25rem',
  },
  infoList: {
    color: '#444',
    fontSize: '0.875rem',
    paddingLeft: '1.25rem',
    margin: '0 0 1.75rem',
    lineHeight: '1.8',
  },
  primaryBtn: {
    padding: '0.7rem 1.5rem',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '0.7rem 1.25rem',
    background: '#fff',
    color: '#00205B',
    border: '1.5px solid #00205B',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  backBtn: {
    padding: '0.7rem 1.25rem',
    background: '#f5821f',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  quizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  counter: {
    color: '#888',
    fontSize: '0.8rem',
  },
  progressTrack: {
    height: '5px',
    background: '#e5e7eb',
    borderRadius: '3px',
    marginBottom: '1.5rem',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#00205B',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  questionText: {
    fontSize: '0.975rem',
    lineHeight: '1.65',
    color: '#1a1a1a',
    marginBottom: '1.25rem',
    fontWeight: '500',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    marginBottom: '1.5rem',
  },
  optionBtn: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '7px',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
  },
  optionSelected: {
    border: '2px solid #00205B',
    background: '#f0f3f9',
  },
  optionLetter: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#00205B',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: '700',
    lineHeight: 1,
    paddingTop: '1px',
  },
  optionText: {
    fontSize: '0.875rem',
    color: '#222',
    lineHeight: '1.5',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  scoreCircle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '4px solid #00205B',
    margin: '1rem auto 1.5rem',
  },
  scoreNumber: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#00205B',
  },
  scoreLabel: {
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#00205B',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '1.5rem 0 0.6rem',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '0.4rem',
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
  },
  competencyName: {
    fontSize: '0.85rem',
    color: '#333',
  },
  profBadge: {
    fontSize: '0.78rem',
    fontWeight: '600',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  reviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  reviewItem: {
    borderLeft: '3px solid',
    paddingLeft: '0.75rem',
  },
  reviewQ: {
    fontSize: '0.82rem',
    color: '#333',
    margin: 0,
    lineHeight: '1.5',
  },
  reviewExpl: {
    fontSize: '0.8rem',
    color: '#555',
    margin: '0.25rem 0 0',
    lineHeight: '1.5',
    fontStyle: 'italic',
  },
}

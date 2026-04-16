import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Anthropic from '@anthropic-ai/sdk'

const RATING_COLORS = {
  'Exceeds the Standard':   { color: '#15803d', bg: '#f0fdf4' },
  'Meets the Standard':     { color: '#1d4ed8', bg: '#eff6ff' },
  'Below the Standard':     { color: '#b45309', bg: '#fffbeb' },
  'Does Not Meet Standard': { color: '#b91c1c', bg: '#fef2f2' },
  'N/A':                    { color: '#6b7280', bg: '#f9fafb' },
}

export default function TranscriptScorer() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [phase, setPhase] = useState('start') // 'start' | 'analyzing' | 'results'
  const [transcript, setTranscript] = useState('')
  const [rubrics, setRubrics] = useState([])
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [statusText, setStatusText] = useState('Scoring your transcript…')

  useEffect(() => {
    supabase
      .from('rubrics')
      .select('*')
      .order('sort_order')
      .then(({ data }) => { if (data) setRubrics(data) })
  }, [])

  async function handleScore() {
    if (!transcript.trim() || rubrics.length === 0) return
    setError(null)
    setPhase('analyzing')
    setStatusText('Scoring your transcript with Claude AI…')

    try {
      const rubricContext = rubrics.map(r => {
        if (r.is_qualifier) {
          return `${r.statement_code} [C${r.competency_number} – ${r.competency_name}] (QUALIFIER – score as Demonstrated or Not Demonstrated only):
  Statement: ${r.statement_text}`
        }
        return `${r.statement_code} [C${r.competency_number} – ${r.competency_name}]:
  Statement: ${r.statement_text}
  Exceeds the Standard (4): ${r.exceeds_standard || ''}
  Meets the Standard (3): ${r.meets_standard || ''}
  Below the Standard (2): ${r.below_standard || ''}
  Does Not Meet Standard (1): ${r.does_not_meet || ''}`
      }).join('\n\n')

      const prompt = `You are an ICF (International Coaching Federation) assessor evaluating a coaching transcript for ACC (Associate Certified Coach) credentialing using the BARS (Behaviorally Anchored Rating Scale) framework.

SCORING RUBRICS:
${rubricContext}

INSTRUCTIONS:
Review the coaching transcript below and score each behavioral statement based solely on evidence present in the transcript.

For QUALIFIER statements (A1.1, A1.2, A1.3):
- Set "demonstrated" to true if the behavior is clearly evidenced, false if absent or unclear
- Set "rating" and "rating_numeric" to null

For all other statements (A3.1 through A8.3):
- Set "rating" to exactly one of: "Exceeds the Standard", "Meets the Standard", "Below the Standard", "Does Not Meet Standard", or "N/A" (only use N/A if there is truly no evidence to score)
- Set "rating_numeric" to 4, 3, 2, 1, or null (for N/A)
- Set "demonstrated" to null

For ALL statements:
- Provide 2–3 sentences of feedback citing specific evidence from the transcript

Return ONLY valid JSON — no markdown, no explanation, just the JSON object:
{
  "scores": [
    {
      "statement_code": "A1.1",
      "is_qualifier": true,
      "demonstrated": true,
      "rating": null,
      "rating_numeric": null,
      "feedback": "..."
    }
  ]
}

COACHING TRANSCRIPT:
${transcript}`

      const client = new Anthropic({
        dangerouslyAllowBrowser: true,
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      })

      const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      let responseText = message.content[0].text.trim()

      // Strip markdown code fences if present
      const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) responseText = fenceMatch[1].trim()

      const parsed = JSON.parse(responseText)
      const scores = parsed.scores

      // Enrich with rubric metadata
      const enriched = scores.map(score => {
        const rubric = rubrics.find(r => r.statement_code === score.statement_code)
        return {
          ...score,
          competency_number: rubric?.competency_number ?? null,
          competency_name:   rubric?.competency_name   ?? '',
          statement_text:    rubric?.statement_text     ?? '',
        }
      })

      setResults(enriched)
      setStatusText('Saving results…')

      if (user) {
        const { data: session, error: sessionErr } = await supabase
          .from('sessions')
          .insert({
            user_id:        user.id,
            tool:           'transcript_scorer',
            score_category: 'application',
            raw_input:      transcript,
            raw_output:     JSON.stringify(scores),
            status:         'completed',
          })
          .select('id')
          .single()

        if (sessionErr) {
          console.error('[TranscriptScorer] sessions insert error:', sessionErr.message)
        } else if (session?.id) {
          const appRows = enriched.map(sc => ({
            session_id:        session.id,
            user_id:           user.id,
            statement_code:    sc.statement_code,
            competency_number: sc.competency_number,
            competency_name:   sc.competency_name,
            statement_text:    sc.statement_text,
            is_qualifier:      sc.is_qualifier,
            rating:            sc.is_qualifier ? null : (sc.rating ?? null),
            rating_numeric:    sc.is_qualifier ? null : (sc.rating_numeric ?? null),
            demonstrated:      sc.is_qualifier ? sc.demonstrated : null,
            feedback:          sc.feedback,
          }))
          const { error: scErr } = await supabase.from('application_scores').insert(appRows)
          if (scErr) console.error('[TranscriptScorer] application_scores insert error:', scErr.message)
        }
      }

      setPhase('results')
    } catch (err) {
      console.error('[TranscriptScorer] error:', err)
      setError(err.message || 'An error occurred while scoring the transcript.')
      setPhase('start')
    }
  }

  // Group results by competency number
  const grouped = results
    ? Object.values(
        results.reduce((acc, sc) => {
          const key = sc.competency_number
          if (!acc[key]) acc[key] = { competency_number: key, competency_name: sc.competency_name, scores: [] }
          acc[key].scores.push(sc)
          return acc
        }, {})
      ).sort((a, b) => a.competency_number - b.competency_number)
    : []

  // ─── START SCREEN ───
  if (phase === 'start') {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <p style={s.badge}>Application Scoring</p>
          <h1 style={s.title}>Transcript Scorer</h1>
          <p style={s.subtitle}>
            Paste a coaching session transcript below. Claude will evaluate it against all ICF ACC behavioral indicators
            using the BARS framework and return a per-statement score report.
          </p>
          <ul style={s.infoList}>
            <li>Scored against the ICF ACC BARS rubric (Competencies 1, 3–8)</li>
            <li>Per-statement feedback citing evidence from your transcript</li>
            <li>Results saved to your progress record</li>
          </ul>

          <label style={s.textareaLabel}>
            Coaching Transcript
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={14}
              style={s.transcriptArea}
              placeholder="Paste your full coaching session transcript here…"
            />
          </label>

          {error && <p style={s.errorMsg}>{error}</p>}

          <button
            onClick={handleScore}
            disabled={!transcript.trim() || rubrics.length === 0}
            style={{ ...s.primaryBtn, opacity: (!transcript.trim() || rubrics.length === 0) ? 0.45 : 1 }}
          >
            {rubrics.length === 0 ? 'Loading rubrics…' : 'Score Transcript'}
          </button>
          <button onClick={() => navigate('/dashboard')} style={s.linkBtn}>Back to Dashboard</button>
        </div>
      </main>
    )
  }

  // ─── ANALYZING SCREEN ───
  if (phase === 'analyzing') {
    return (
      <main style={s.page}>
        <style>{`@keyframes ts-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={s.spinner} />
          <p style={s.statusText}>{statusText}</p>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            This may take up to 30 seconds…
          </p>
        </div>
      </main>
    )
  }

  // ─── RESULTS SCREEN ───
  return (
    <main style={s.page}>
      <div style={{ ...s.card, maxWidth: '720px' }}>
        <p style={s.badge}>Score Report</p>
        <h1 style={s.title}>Transcript Results</h1>
        <p style={{ color: '#555', fontSize: '0.875rem', margin: '0 0 1.75rem' }}>
          Scored against the ICF ACC BARS framework. Ratings reflect the evidence found in your transcript.
        </p>

        {grouped.map(group => (
          <div key={group.competency_number} style={s.competencySection}>
            <h2 style={s.competencyHeading}>
              <span style={s.compNum}>C{group.competency_number}</span>
              {group.competency_name}
            </h2>

            {group.scores.map(sc => {
              const colors = sc.is_qualifier
                ? (sc.demonstrated
                    ? { color: '#15803d', bg: '#f0fdf4' }
                    : { color: '#b91c1c', bg: '#fef2f2' })
                : (RATING_COLORS[sc.rating] ?? RATING_COLORS['N/A'])

              const ratingLabel = sc.is_qualifier
                ? (sc.demonstrated ? 'Demonstrated' : 'Not Demonstrated')
                : (sc.rating ?? 'N/A')

              return (
                <div key={sc.statement_code} style={s.statementCard}>
                  <div style={s.statementHeader}>
                    <span style={s.statementCode}>{sc.statement_code}</span>
                    <span style={{ ...s.ratingBadge, color: colors.color, background: colors.bg }}>
                      {ratingLabel}
                    </span>
                  </div>
                  <p style={s.statementText}>{sc.statement_text}</p>
                  {sc.feedback && (
                    <p style={s.feedbackText}>{sc.feedback}</p>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setPhase('start'); setTranscript(''); setResults(null) }}
            style={s.primaryBtn}
          >
            Score Another Transcript
          </button>
          <button onClick={() => navigate('/dashboard')} style={s.secondaryBtn}>Dashboard</button>
        </div>
      </div>
    </main>
  )
}

const PRIMARY = '#00205B'

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
    color: PRIMARY,
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
    color: PRIMARY,
    margin: '0 0 0.5rem',
  },
  subtitle: {
    color: '#555',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    margin: '0 0 1rem',
  },
  infoList: {
    color: '#444',
    fontSize: '0.875rem',
    paddingLeft: '1.25rem',
    margin: '0 0 1.5rem',
    lineHeight: '1.8',
  },
  textareaLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '1.25rem',
  },
  transcriptArea: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#111',
    background: '#fff',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.6',
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
  primaryBtn: {
    padding: '0.7rem 1.5rem',
    background: PRIMARY,
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
    color: PRIMARY,
    border: `1.5px solid ${PRIMARY}`,
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  linkBtn: {
    display: 'block',
    background: 'none',
    border: 'none',
    color: PRIMARY,
    fontSize: '0.875rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginTop: '0.75rem',
    padding: 0,
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid #e5e7eb',
    borderTopColor: PRIMARY,
    animation: 'ts-spin 0.9s linear infinite',
    margin: '0 auto 1.5rem',
  },
  statusText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: '1rem',
    margin: 0,
  },
  competencySection: {
    marginBottom: '1.75rem',
  },
  competencyHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: PRIMARY,
    margin: '0 0 0.75rem',
    paddingBottom: '0.4rem',
    borderBottom: '2px solid #e8ecf5',
  },
  compNum: {
    background: '#e8ecf5',
    color: PRIMARY,
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  statementCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '0.6rem',
  },
  statementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '0.4rem',
  },
  statementCode: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: '0.04em',
    flexShrink: 0,
    marginTop: '2px',
  },
  ratingBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  statementText: {
    fontSize: '0.85rem',
    color: '#374151',
    lineHeight: '1.5',
    margin: '0 0 0.25rem',
  },
  feedbackText: {
    fontSize: '0.82rem',
    color: '#555',
    lineHeight: '1.55',
    margin: '0.5rem 0 0',
    fontStyle: 'italic',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '0.5rem',
  },
}

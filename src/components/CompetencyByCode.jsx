import { useMemo } from 'react'

// Competency breakdown for student access codes, as percentages.
//
// Every behavior the Transcript Reviewer marks "Observed" earns one point for its competency.
// Competencies have different numbers of behaviors (Competency 1 has 3 qualifiers, the others
// have 3 to 4 behaviors), so each bar shows points earned out of points possible, as a percent.
// All of a code's sessions are added together before the percent is worked out.

const COLORS = {
  navy: '#00205B',
  sky: '#69cce6',
  blue: '#78b3e0',
  orange: '#ff8200',
  green: '#c9d647',
  border: '#e2e6ec',
  muted: '#6b7a99',
  main: '#0f1c3a',
  soft: '#f9fafc',
}

const COMPETENCIES = [
  { n: 1, title: 'Demonstrates Ethical Practice' },
  { n: 3, title: 'Establishes and Maintains Agreements' },
  { n: 4, title: 'Cultivates Trust and Safety' },
  { n: 5, title: 'Maintains Presence' },
  { n: 6, title: 'Listens Actively' },
  { n: 7, title: 'Evokes Awareness' },
  { n: 8, title: 'Facilitates Client Growth' },
]

const isRating = (r) => r === 'Observed' || r === 'Not Observed'

// Points earned and possible per competency for ONE saved analysis.
export function scoreAnalysis(analysis) {
  const out = {}
  const add = (n, result) => {
    if (!isRating(result)) return
    const row = out[n] || (out[n] = { earned: 0, possible: 0 })
    row.possible += 1
    if (result === 'Observed') row.earned += 1
  }

  const ep = analysis?.ethical_practice || {}
  const quals = Array.isArray(ep.qualifiers) ? ep.qualifiers : []
  if (quals.length) quals.forEach((q) => add(1, q?.result))
  else {
    add(1, ep.icf_code_alignment)
    add(1, ep.coach_role_alignment)
  }

  for (const st of analysis?.behavioral_statements || []) {
    const n = parseInt(String(st.code || '').replace(/^[A-Za-z]+/, '').split('.')[0], 10)
    if (n >= 3 && n <= 8) add(n, st.result)
  }
  return out
}

function combine(analyses) {
  const total = {}
  for (const a of analyses) {
    const scored = scoreAnalysis(a.analysis_data)
    for (const [n, v] of Object.entries(scored)) {
      const row = total[n] || (total[n] = { earned: 0, possible: 0 })
      row.earned += v.earned
      row.possible += v.possible
    }
  }
  return total
}

function barColor(pct) {
  if (pct >= 75) return COLORS.green
  if (pct >= 50) return COLORS.sky
  return COLORS.orange
}

function Card({ title, sessions, totals }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '16px 18px', background: '#fff', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.navy }}>{title}</div>
        <div style={{ fontSize: 11, color: COLORS.muted }}>{sessions} session{sessions === 1 ? '' : 's'}</div>
      </div>
      {COMPETENCIES.map(({ n, title: name }) => {
        const v = totals[n]
        const pct = v && v.possible ? Math.round((v.earned / v.possible) * 100) : null
        return (
          <div key={n} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: COLORS.main, fontWeight: 600 }}>{n}. {name}</span>
              <span style={{ color: COLORS.muted }}>
                {pct === null ? 'no data' : `${pct}%  (${v.earned} of ${v.possible})`}
              </span>
            </div>
            <div style={{ height: 9, background: '#eef1f5', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${pct ?? 0}%`, height: '100%', background: pct === null ? 'transparent' : barColor(pct), borderRadius: 5 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CompetencyByCode({ analyses, loading }) {
  const groups = useMemo(() => {
    const by = {}
    for (const a of analyses || []) {
      const label = a.access_code_label || 'Unlabeled'
      ;(by[label] || (by[label] = [])).push(a)
    }
    return Object.entries(by)
      .map(([label, list]) => ({ label, sessions: list.length, totals: combine(list) }))
      .sort((x, y) => y.sessions - x.sessions)
  }, [analyses])

  const all = useMemo(() => combine(analyses || []), [analyses])

  if (loading) return <p style={{ color: COLORS.muted }}>Loading…</p>
  if (!groups.length) return <p style={{ color: COLORS.muted }}>No student sessions yet.</p>

  return (
    <div>
      <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 18px' }}>
        Each behavior marked <strong>Observed</strong> earns one point for its competency. Competencies have different numbers of
        behaviors, so each bar shows points earned out of points possible, as a percent, across all of a code&rsquo;s sessions.
      </p>
      <Card title="All student access codes" sessions={analyses.length} totals={all} />
      {groups.map((g) => <Card key={g.label} title={g.label} sessions={g.sessions} totals={g.totals} />)}
    </div>
  )
}

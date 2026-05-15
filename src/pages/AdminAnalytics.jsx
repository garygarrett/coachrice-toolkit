import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import LoadingBar from '../components/LoadingBar'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend
} from 'recharts'

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

const ICF_COMPETENCIES = [
  'Demonstrates Ethical Practice',
  'Embodies a Coaching Mindset',
  'Establishes and Maintains Agreements',
  'Cultivates Trust and Safety',
  'Maintains Presence',
  'Listens Actively',
  'Evokes Awareness',
  'Facilitates Client Growth',
]

function StatCard({ label, value, unit = '' }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}{unit}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function ProficiencyBar({ competency, score }) {
  const level = score < 1.5 ? 'Developing' : score < 2.5 ? 'Approaching' : score < 3.5 ? 'Meeting' : 'Exceeding'
  const bgColor = score < 1.5 ? '#f5222d' : score < 2.5 ? '#faad14' : score < 3.5 ? '#1890ff' : '#52c41a'

  return (
    <div style={styles.competencyRow}>
      <div style={{ ...styles.competencyLabel, width: 180 }}>{competency}</div>
      <div style={styles.competencyBarContainer}>
        <div style={{ ...styles.competencyBar, width: `${(score / 4) * 100}%`, backgroundColor: bgColor }} />
      </div>
      <div style={styles.competencyScore}>{score.toFixed(2)} ({level})</div>
    </div>
  )
}

export default function AdminAnalytics() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  const [coaches, setCoaches] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [mentorCoaches, setMentorCoaches] = useState([])
  const [loading, setLoading] = useState(true)

  // Detail panel state
  const [selectedCoach, setSelectedCoach] = useState(null)
  const [selectedCohort, setSelectedCohort] = useState(null)
  const [selectedMentorCoach, setSelectedMentorCoach] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Detail data
  const [coachDetail, setCoachDetail] = useState(null)
  const [cohortDetail, setCohortDetail] = useState(null)
  const [mentorCoachDetail, setMentorCoachDetail] = useState(null)

  const [searchCoach, setSearchCoach] = useState('')
  const [searchCohort, setSearchCohort] = useState('')
  const [searchMentor, setSearchMentor] = useState('')

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      const res = await fetch(`/api/admin-analytics?type=summary&viewingUserId=${user?.id}`)
      const data = await res.json()
      if (data.coaches) setCoaches(data.coaches)
      if (data.cohorts) setCohorts(data.cohorts)
      if (data.mentor_coaches) setMentorCoaches(data.mentor_coaches)
    } catch (err) {
      console.error('Failed to load summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCoachDetail = async (coachId) => {
    try {
      setDetailLoading(true)
      const res = await fetch(`/api/admin-analytics?type=user&userId=${coachId}&viewingUserId=${user?.id}`)
      const data = await res.json()
      setCoachDetail(data)
    } catch (err) {
      console.error('Failed to load coach detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const loadCohortDetail = async (cohortId) => {
    try {
      setDetailLoading(true)
      const res = await fetch(`/api/admin-analytics?type=cohort&cohortId=${cohortId}&viewingUserId=${user?.id}`)
      const data = await res.json()
      setCohortDetail(data)
    } catch (err) {
      console.error('Failed to load cohort detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const loadMentorCoachDetail = async (mentorCoachId) => {
    try {
      setDetailLoading(true)
      const res = await fetch(`/api/admin-analytics?type=mentorCoach&mentorCoachId=${mentorCoachId}&viewingUserId=${user?.id}`)
      const data = await res.json()
      setMentorCoachDetail(data)
    } catch (err) {
      console.error('Failed to load mentor coach detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCoachSelect = (coach) => {
    setSelectedCoach(coach.id)
    loadCoachDetail(coach.id)
  }

  const handleCohortSelect = (cohort) => {
    setSelectedCohort(cohort.id)
    loadCohortDetail(cohort.id)
  }

  const handleMentorCoachSelect = (mc) => {
    setSelectedMentorCoach(mc.id)
    loadMentorCoachDetail(mc.id)
  }

  const filteredCoaches = coaches.filter(c =>
    c.full_name.toLowerCase().includes(searchCoach.toLowerCase()) ||
    c.email.toLowerCase().includes(searchCoach.toLowerCase())
  )

  const filteredCohorts = cohorts.filter(c =>
    c.name.toLowerCase().includes(searchCohort.toLowerCase())
  )

  const filteredMentorCoaches = mentorCoaches.filter(mc =>
    mc.full_name.toLowerCase().includes(searchMentor.toLowerCase())
  )

  if (loading) {
    return (
      <Layout active="admin-analytics" pageTitle="Analytics">
        <LoadingBar />
      </Layout>
    )
  }

  return (
    <Layout active="admin-analytics" pageTitle="Analytics Dashboard">
      <div style={styles.container}>
        <div style={styles.viewSelector}>
          {['users', 'cohorts', 'mentorCoaches'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setSelectedCoach(null)
                setSelectedCohort(null)
                setSelectedMentorCoach(null)
              }}
              style={{
                ...styles.viewBtn,
                ...(activeTab === tab ? styles.viewBtnActive : {})
              }}
            >
              {tab === 'users' ? 'Users' : tab === 'cohorts' ? 'Cohorts' : 'Mentor Groups'}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {activeTab === 'users' && (
            <CoachesView
              coaches={filteredCoaches}
              search={searchCoach}
              setSearch={setSearchCoach}
              selected={selectedCoach}
              onSelect={handleCoachSelect}
              detail={coachDetail}
              loading={detailLoading}
            />
          )}

          {activeTab === 'cohorts' && (
            <CohortsView
              cohorts={filteredCohorts}
              search={searchCohort}
              setSearch={setSearchCohort}
              selected={selectedCohort}
              onSelect={handleCohortSelect}
              detail={cohortDetail}
              loading={detailLoading}
            />
          )}

          {activeTab === 'mentorCoaches' && (
            <MentorCoachesView
              mentorCoaches={filteredMentorCoaches}
              search={searchMentor}
              setSearch={setSearchMentor}
              selected={selectedMentorCoach}
              onSelect={handleMentorCoachSelect}
              detail={mentorCoachDetail}
              loading={detailLoading}
            />
          )}
        </div>
      </div>
    </Layout>
  )
}

function CoachesView({ coaches, search, setSearch, selected, onSelect, detail, loading }) {
  return (
    <div style={styles.viewContainer}>
      <div style={styles.listPanel}>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.listContainer}>
          {coaches.map(coach => (
            <div
              key={coach.id}
              onClick={() => onSelect(coach)}
              style={{
                ...styles.listItem,
                ...(selected === coach.id ? styles.listItemActive : {})
              }}
            >
              <div style={styles.listItemName}>{coach.full_name}</div>
              <div style={styles.listItemMeta}>{coach.cohort_name}</div>
              <div style={styles.listItemMeta}>Last: {coach.last_accessed_at ? new Date(coach.last_accessed_at).toLocaleDateString() : 'Never'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.detailPanel}>
        {!selected ? (
          <div style={styles.emptyState}>Select a user to view details</div>
        ) : loading ? (
          <LoadingBar />
        ) : detail ? (
          <CoachDetail coach={detail} />
        ) : null}
      </div>
    </div>
  )
}

function CoachDetail({ coach }) {
  const toolCount = {}
  const toolDates = {}

  coach.sessions?.forEach(s => {
    toolCount[s.tool] = (toolCount[s.tool] || 0) + 1
    if (!toolDates[s.tool] || new Date(s.created_at) > new Date(toolDates[s.tool])) {
      toolDates[s.tool] = s.created_at
    }
  })

  const toolData = Object.entries(toolCount).map(([tool, count]) => ({
    tool: tool === 'exam' ? 'ACC Exam' : tool === 'transcript_scorer' ? 'Transcript' : tool === 'transcriber' ? 'Audio' : 'Coaching Bot',
    count,
  }))

  // Competency averages
  const compAvg = {}
  ICF_COMPETENCIES.forEach(c => {
    const scores = coach.competencies?.filter(comp => comp.competency === c).map(comp => comp.proficiency_numeric) || []
    compAvg[c] = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  })

  // Exam trend
  const examData = coach.exams?.map(e => ({
    date: new Date(e.created_at).toLocaleDateString(),
    score: e.overall_score || 0,
  })) || []

  return (
    <div style={styles.detailContent}>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailName}>{coach.user.full_name}</div>
          <div style={styles.detailMeta}>{coach.user.email}</div>
          <div style={styles.detailMeta}>{coach.user.cohort_name} • Mentor: {coach.user.mentor_coach_name}</div>
          <div style={styles.detailMeta}>Joined {new Date(coach.user.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={styles.statRow}>
        <StatCard label="Total Sessions" value={coach.sessions?.length || 0} />
        <StatCard label="Exams Taken" value={coach.exams?.length || 0} />
        <StatCard label="Avg Exam Score" value={coach.exams?.length > 0 ? Math.round(coach.exams.reduce((a, b) => a + (b.overall_score || 0), 0) / coach.exams.length) : 0} unit="%" />
        <StatCard label="Last Active" value={coach.user.last_accessed_at ? new Date(coach.user.last_accessed_at).toLocaleDateString() : 'Never'} />
      </div>

      {toolData.length > 0 && (
        <div style={styles.chartSection}>
          <div style={styles.sectionTitle}>Tool Usage</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toolData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tool" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.navy} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.chartSection}>
        <div style={styles.sectionTitle}>Competency Proficiency Levels</div>
        <div>
          {ICF_COMPETENCIES.map(c => (
            <ProficiencyBar key={c} competency={c} score={compAvg[c]} />
          ))}
        </div>
      </div>

      {examData.length >= 2 && (
        <div style={styles.chartSection}>
          <div style={styles.sectionTitle}>Exam Score Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={examData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke={COLORS.teal} strokeWidth={2} dot={{ fill: COLORS.navy }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {coach.sessions && coach.sessions.length > 0 && (
        <div style={styles.timelineSection}>
          <div style={styles.sectionTitle}>Recent Activity</div>
          <div style={styles.timeline}>
            {coach.sessions.slice(0, 10).map(s => (
              <div key={s.id} style={styles.timelineItem}>
                <div style={styles.timelineDate}>{new Date(s.created_at).toLocaleDateString()}</div>
                <div style={styles.timelineTool}>
                  {s.tool === 'exam' ? 'ACC Exam' : s.tool === 'transcript_scorer' ? 'Transcript Scorer' : s.tool === 'transcriber' ? 'Audio Transcriber' : 'Coaching Bot'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CohortsView({ cohorts, search, setSearch, selected, onSelect, detail, loading }) {
  return (
    <div style={styles.viewContainer}>
      <div style={styles.listPanel}>
        <input
          type="text"
          placeholder="Search cohorts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.listContainer}>
          {cohorts.map(cohort => (
            <div
              key={cohort.id}
              onClick={() => onSelect(cohort)}
              style={{
                ...styles.listItem,
                ...(selected === cohort.id ? styles.listItemActive : {})
              }}
            >
              <div style={styles.listItemName}>{cohort.name}</div>
              <div style={styles.listItemMeta}>{cohort.coach_count} coaches</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.detailPanel}>
        {!selected ? (
          <div style={styles.emptyState}>Select a cohort to view details</div>
        ) : loading ? (
          <LoadingBar />
        ) : detail ? (
          <CohortDetail cohort={detail} />
        ) : null}
      </div>
    </div>
  )
}

function CohortDetail({ cohort }) {
  const compChartData = ICF_COMPETENCIES.map(c => ({
    competency: c,
    avg: parseFloat(cohort.avg_competencies[c]) || 0,
  }))

  return (
    <div style={styles.detailContent}>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailName}>{cohort.cohort.name}</div>
          <div style={styles.detailMeta}>{cohort.coaches.length} coaches</div>
        </div>
      </div>

      <div style={styles.chartSection}>
        <div style={styles.sectionTitle}>Average Competency Scores</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={compChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 4]} />
            <YAxis type="category" dataKey="competency" width={200} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="avg" fill={COLORS.navy} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.tableSection}>
        <div style={styles.sectionTitle}>Coach Breakdown</div>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th>Coach</th>
              <th>Sessions</th>
              <th>Exams</th>
              <th>Avg Score</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {cohort.coaches.map(coach => (
              <tr key={coach.id} style={styles.tableRow}>
                <td>{coach.full_name}</td>
                <td>{coach.total_sessions}</td>
                <td>{coach.exam_count}</td>
                <td>{coach.avg_exam_score}%</td>
                <td>{coach.last_accessed_at ? new Date(coach.last_accessed_at).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MentorCoachesView({ mentorCoaches, search, setSearch, selected, onSelect, detail, loading }) {
  return (
    <div style={styles.viewContainer}>
      <div style={styles.listPanel}>
        <input
          type="text"
          placeholder="Search mentor coaches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.listContainer}>
          {mentorCoaches.map(mc => (
            <div
              key={mc.id}
              onClick={() => onSelect(mc)}
              style={{
                ...styles.listItem,
                ...(selected === mc.id ? styles.listItemActive : {})
              }}
            >
              <div style={styles.listItemName}>{mc.full_name}</div>
              <div style={styles.listItemMeta}>{mc.coach_count} coaches</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.detailPanel}>
        {!selected ? (
          <div style={styles.emptyState}>Select a mentor coach to view their group's analytics</div>
        ) : loading ? (
          <LoadingBar />
        ) : detail ? (
          <MentorCoachDetail mentor={detail} />
        ) : null}
      </div>
    </div>
  )
}

function MentorCoachDetail({ mentor }) {
  const compChartData = ICF_COMPETENCIES.map(c => ({
    competency: c,
    avg: parseFloat(mentor.avg_competencies[c]) || 0,
  }))

  return (
    <div style={styles.detailContent}>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailName}>{mentor.mentor_coach.full_name}</div>
          <div style={styles.detailMeta}>{mentor.coaches.length} assigned coaches</div>
        </div>
      </div>

      <div style={styles.chartSection}>
        <div style={styles.sectionTitle}>Average Competency Scores (Group)</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={compChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 4]} />
            <YAxis type="category" dataKey="competency" width={200} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="avg" fill={COLORS.teal} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.tableSection}>
        <div style={styles.sectionTitle}>Assigned Coaches</div>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th>Coach</th>
              <th>Sessions</th>
              <th>Exams</th>
              <th>Avg Score</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {mentor.coaches.map(coach => (
              <tr key={coach.id} style={styles.tableRow}>
                <td>{coach.full_name}</td>
                <td>{coach.total_sessions}</td>
                <td>{coach.exam_count}</td>
                <td>{coach.avg_exam_score}%</td>
                <td>{coach.last_accessed_at ? new Date(coach.last_accessed_at).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
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
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  viewContainer: {
    display: 'flex',
    gap: 16,
    height: '100%',
  },
  listPanel: {
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    background: COLORS.white,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  searchInput: {
    padding: '8px 12px',
    border: 'none',
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    fontSize: 11,
    fontFamily: 'Montserrat, sans-serif',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  listItem: {
    padding: '12px',
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  listItemActive: {
    background: COLORS['gray-light'],
    borderLeft: `3px solid ${COLORS.teal}`,
  },
  listItemName: {
    fontSize: 11,
    fontWeight: 600,
    color: COLORS['text-main'],
    marginBottom: 2,
  },
  listItemMeta: {
    fontSize: 9,
    color: COLORS['text-muted'],
  },
  detailPanel: {
    flex: 1,
    background: COLORS.white,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 4,
    overflowY: 'auto',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: COLORS['text-muted'],
    fontSize: 12,
  },
  detailContent: {
    padding: 20,
  },
  detailHeader: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  detailName: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS['text-main'],
    marginBottom: 4,
  },
  detailMeta: {
    fontSize: 11,
    color: COLORS['text-muted'],
    marginBottom: 2,
  },
  statRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: '12px',
    background: COLORS['gray-light'],
    borderRadius: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.navy,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS['text-muted'],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS['text-main'],
    marginBottom: 12,
  },
  competencyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  competencyLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: COLORS['text-main'],
  },
  competencyBarContainer: {
    flex: 1,
    height: 16,
    background: COLORS['gray-light'],
    borderRadius: 2,
    overflow: 'hidden',
  },
  competencyBar: {
    height: '100%',
    transition: 'width 0.2s',
  },
  competencyScore: {
    fontSize: 9,
    color: COLORS['text-muted'],
    minWidth: 80,
    textAlign: 'right',
  },
  timelineSection: {
    marginTop: 24,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  timelineItem: {
    display: 'flex',
    gap: 12,
    padding: '8px 0',
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  timelineDate: {
    fontSize: 10,
    color: COLORS['text-muted'],
    minWidth: 80,
  },
  timelineTool: {
    fontSize: 10,
    color: COLORS['text-main'],
    fontWeight: 500,
  },
  tableSection: {
    marginTop: 24,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 10,
  },
  tableHead: {
    background: COLORS['gray-light'],
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  tableRow: {
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
}

// Fix table styles with proper CSS selector styling
const tableStyle = `
  #admin-analytics table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  #admin-analytics table th {
    padding: 8px;
    text-align: left;
    font-weight: 600;
    color: #0f1c3a;
    background: #f0f2f5;
    border-bottom: 1px solid #e2e6ec;
  }
  #admin-analytics table td {
    padding: 8px;
    color: #0f1c3a;
    border-bottom: 1px solid #e2e6ec;
  }
  #admin-analytics table tbody tr:hover {
    background: #f0f2f5;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style')
  styleEl.id = 'admin-analytics-styles'
  styleEl.textContent = tableStyle
  if (!document.getElementById('admin-analytics-styles')) {
    document.head.appendChild(styleEl)
  }
}

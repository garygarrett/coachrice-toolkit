import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVisibility } from '../context/VisibilityContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const COLORS = {
  navy: '#00205B',
  'navy-mid': '#0a2d6e',
  teal: '#69cce6',
  orange: '#ff8200',
  lime: '#c9d647',
  gray: '#7C7E7F',
  'gray-light': '#f0f2f5',
  'gray-border': '#e2e6ec',
  white: '#ffffff',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
}

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
  }
  return icons[id] || null
}

const TOOL_DEFAULTS = {
  exam: { tag: 'Knowledge', title: 'ACC Practice Exam', desc: '200+ questions' },
  transcript: { tag: 'Application', title: 'Transcript Reviewer', desc: 'Upload a session' },
  ai: { tag: 'Application', title: 'AI Client', desc: 'Live coaching practice' },
  audio: { tag: 'Utility', title: 'Audio to Transcript', desc: 'Convert recordings' },
}

export default function CoachDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const visibility = useVisibility() ?? { exam: true, transcript: true, ai: true, audio: true }
  const [content, setContent] = useState({})
  const [colors, setColors] = useState({})

  useEffect(() => {
    const keys = ['exam_card_tag', 'exam_card_title', 'exam_card_description',
                  'transcript_card_tag', 'transcript_card_title', 'transcript_card_description',
                  'ai_card_tag', 'ai_card_title', 'ai_card_description',
                  'audio_card_tag', 'audio_card_title', 'audio_card_description']
    supabase
      .from('site_content')
      .select('key, value')
      .in('key', keys)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(row => { map[row.key] = row.value })
          setContent(map)
        }
      })

    const loadColors = async () => {
      const { data } = await supabase
        .from('config')
        .select('key, value')
        .or('key.ilike.tool_exam_card_%,key.ilike.tool_transcript_card_%,key.ilike.tool_ai_card_%,key.ilike.tool_audio_card_%')

      if (data) {
        const colorMap = {
          exam: { bg: '#e6f7fc', color: '#0a7fa8' },
          transcript: { bg: '#fff0e0', color: '#c06000' },
          ai: { bg: '#fff0e0', color: '#c06000' },
          audio: { bg: '#f0f2f5', color: '#7C7E7F' },
        }
        data.forEach(row => {
          const match = row.key.match(/tool_(\w+)_card_(\w+)/)
          if (match) {
            const toolId = match[1]
            const colorType = match[2]
            if (!colorMap[toolId]) colorMap[toolId] = {}
            if (colorType === 'bg') colorMap[toolId].bg = row.value
            if (colorType === 'color') colorMap[toolId].color = row.value
          }
        })
        setColors(colorMap)
      }
    }

    loadColors()
  }, [])

  const allTools = [
    {
      id: 'exam',
      icon: 'exam',
      bg: colors.exam?.bg || '#e6f7fc',
      color: colors.exam?.color || '#0a7fa8',
      title: content.exam_card_title || TOOL_DEFAULTS.exam.title,
      desc: content.exam_card_description || TOOL_DEFAULTS.exam.desc,
      tag: content.exam_card_tag || TOOL_DEFAULTS.exam.tag,
      path: '/tools/exam',
    },
    {
      id: 'transcript',
      icon: 'transcript',
      bg: colors.transcript?.bg || '#fff0e0',
      color: colors.transcript?.color || '#c06000',
      title: content.transcript_card_title || TOOL_DEFAULTS.transcript.title,
      desc: content.transcript_card_description || TOOL_DEFAULTS.transcript.desc,
      tag: content.transcript_card_tag || TOOL_DEFAULTS.transcript.tag,
      path: '/tools/transcript',
    },
    {
      id: 'ai',
      icon: 'ai',
      bg: colors.ai?.bg || '#fff0e0',
      color: colors.ai?.color || '#c06000',
      title: content.ai_card_title || TOOL_DEFAULTS.ai.title,
      desc: content.ai_card_description || TOOL_DEFAULTS.ai.desc,
      tag: content.ai_card_tag || TOOL_DEFAULTS.ai.tag,
      path: '/tools/ai',
    },
    {
      id: 'audio',
      icon: 'audio',
      bg: colors.audio?.bg || '#f0f2f5',
      color: colors.audio?.color || COLORS.gray,
      title: content.audio_card_title || TOOL_DEFAULTS.audio.title,
      desc: content.audio_card_description || TOOL_DEFAULTS.audio.desc,
      tag: content.audio_card_tag || TOOL_DEFAULTS.audio.tag,
      path: '/tools/audio',
    },
  ]

  const isAdmin = profile?.role === 'admin'
  const tools = isAdmin ? allTools : allTools.filter(t => visibility[t.id])

  const activities = [
    { dot: '#0a7fa8', title: 'Practice Exam', time: 'Apr 18', note: '92% — Pass' },
    { dot: '#0a7fa8', title: 'AI Client Session', time: 'Apr 19', note: '24 min, 18 exchanges' },
    { dot: '#c06000', title: 'Transcript: Session 12', time: 'Apr 17', note: '91% ACC alignment' },
    { dot: '#c06000', title: 'Practice Exam', time: 'Apr 14', note: '74% — Needs Work' },
    { dot: '#c06000', title: 'Transcript: Session 11', time: 'Apr 11', note: '76% ACC alignment' },
    { dot: '#0a7fa8', title: 'Practice Exam', time: 'Apr 9', note: '87% — Pass' },
    { dot: null, title: 'View more activity →', time: '', note: 'History page', link: true },
  ]

  return (
    <Layout active="dashboard" pageTitle="Dashboard">
      <div style={styles.sectionLabel}>Practice Tools</div>
      <div style={styles.toolsGrid}>
        {tools.map((t, i) => (
          <div
            key={i}
            style={styles.toolCard}
            onClick={() => t.path !== '#' && navigate(t.path)}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,32,91,0.08)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ ...styles.iconBox, background: t.bg }}>
              <ToolIcon id={t.icon} size={16} color={t.color} />
            </div>
            <div style={styles.toolTitle}>{t.title}</div>
            <div style={styles.toolDesc}>{t.desc}</div>
            <div style={styles.divider}></div>
            <div style={styles.toolFooter}>
              <span style={{ ...styles.pill, background: i < 1 ? '#e6f7fc' : i < 3 ? '#fff0e0' : '#f0f2f5', color: i < 1 ? '#0a7fa8' : i < 3 ? '#c06000' : COLORS.gray }}>
                {t.tag}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.sectionLabel}>Activity Feed</div>
      <div style={styles.card}>
        {activities.map((a, i, arr) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              padding: '11px 16px',
              borderBottom: i < arr.length - 1 ? `1px solid ${COLORS['gray-border']}` : 'none',
              alignItems: 'center',
              background: a.link ? COLORS['gray-light'] : '#fff',
              cursor: a.link ? 'pointer' : 'default',
              borderRadius: i === arr.length - 1 ? '0 0 9px 9px' : 0,
            }}
          >
            {!a.link && <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.dot, marginTop: 2, flexShrink: 0 }}></div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: a.link ? 700 : 600, color: a.link ? COLORS['text-main'] : COLORS['text-main'] }}>
                {a.title}
              </div>
              {!a.link && <div style={{ fontSize: 9, color: COLORS['text-muted'], marginTop: 2 }}>{a.note}</div>}
            </div>
            {!a.link && <div style={{ fontSize: 9, color: COLORS['text-muted'], flexShrink: 0 }}>{a.time}</div>}
            {a.link && <span style={{ fontSize: 14, color: COLORS['text-main'] }}>›</span>}
          </div>
        ))}
      </div>
    </Layout>
  )
}

const styles = {
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color: COLORS['text-muted'],
    marginBottom: 12,
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 28,
  },
  toolCard: {
    background: '#fff',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 10,
    padding: '16px 16px',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  toolTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.navy,
    marginBottom: 3,
  },
  toolDesc: {
    fontSize: 10,
    color: COLORS['text-muted'],
    marginBottom: 10,
  },
  divider: {
    height: 1,
    background: COLORS['gray-border'],
    margin: '10px 0',
  },
  toolFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  pill: {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  toolStat: {
    fontSize: 9,
    color: COLORS['text-muted'],
  },
  card: {
    background: '#fff',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 10,
  },
}

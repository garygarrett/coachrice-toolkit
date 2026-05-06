import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { buildClientPrompt } from '../../lib/prompts'

const LABELS = ['Low', 'Medium', 'High']
const TOPICS = [
  'Random — surprise me',
  'Career transition',
  'Leadership challenge',
  'Work-life balance',
  'Interpersonal conflict at work',
  'Navigating a major life change',
  'Building confidence',
  'Team / delegation challenges',
]

const PERSONA_DIALS = [
  { key: 'talk', label: 'Talkativeness', low: 'Short, direct answers', high: 'Talks at length, tangents' },
  { key: 'emo', label: 'Emotional openness', low: "Feelings at arm's length", high: 'Feelings near the surface' },
  { key: 'self', label: 'Self-awareness', low: 'Focused on circumstances', high: 'Clear insight into patterns' },
  { key: 'trust', label: 'Trust in coach', low: 'Guarded, testing', high: 'Open, ready to go deep' },
  { key: 'ready', label: 'Coaching readiness', low: 'Wants advice / answers', high: 'Open to exploration' },
]

const CLIENT_NAMES = [
  'Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery', 'Reese', 'Skyler',
]

const COLORS = {
  navy: '#00205B',
  teal: '#69cce6',
  orange: '#ff8200',
  gray: '#7C7E7F',
  'gray-light': '#f7f8fa',
  'gray-border': '#e5e7eb',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
  lime: '#c9d647',
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rand3 = () => Math.ceil(Math.random() * 3)

const randomPersona = () => ({
  clientName: pick(CLIENT_NAMES),
  topic: pick(TOPICS.slice(1)),
  talkativeness: rand3(),
  emotionOpen: rand3(),
  selfAwareness: rand3(),
  trustRapport: rand3(),
  coachReadiness: rand3(),
})

function ToolIcon({ id, size = 16, color = 'currentColor' }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const icons = {
    send: <svg width={size} height={size} viewBox="0 0 16 16" fill={color}><path d="M2 14L14 8L2 2L2 7L10 8L2 9Z" /></svg>,
    spark: <svg width={size} height={size} viewBox="0 0 16 16" style={s}><path d="M8 2 L9.5 6.5 L14 8 L9.5 9.5 L8 14 L6.5 9.5 L2 8 L6.5 6.5 Z" /></svg>,
    arrow: <svg width={size} height={size} viewBox="0 0 16 16" style={s}><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9,4 13,8 9,12" /></svg>,
    transcript: <svg width={size} height={size} viewBox="0 0 16 16" style={s}><rect x="2.5" y="1" width="11" height="14" rx="1.5" /><line x1="5" y1="5" x2="11" y2="5" /><line x1="5" y1="8" x2="11" y2="8" /><line x1="5" y1="11" x2="9" y2="11" /></svg>,
  }
  return icons[id] || null
}


export default function AIClient() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [stage, setStage] = useState('setup')
  const [coachName, setCoachName] = useState('')
  const [cfg, setCfg] = useState(randomPersona())
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState(null)
  const [systemPrompt, setSystemPrompt] = useState(null)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    supabase
      .from('config')
      .select('key, value')
      .in('key', ['api_key_chatbot', 'ai_client_chatbot_prompt'])
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(row => { map[row.key] = row.value })
          if (map.api_key_chatbot) setApiKey(map.api_key_chatbot)
          if (map.ai_client_chatbot_prompt) setSystemPrompt(map.ai_client_chatbot_prompt)
        }
      })
  }, [])

  const startSession = () => {
    if (!coachName.trim()) return
    setCfg(prev => ({ ...prev, coachName: coachName.trim() }))
    setMessages([])
    setSessionStartTime(new Date())
    setStage('session')
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !apiKey) return
    const userMsg = { role: 'coach', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt || buildClientPrompt(cfg),
          messages: newMessages.map(m => ({ role: m.role === 'coach' ? 'user' : 'assistant', content: m.content })),
        }),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      const reply = data.content?.[0]?.text || ''
      setMessages(prev => [...prev, { role: 'client', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'client', content: '[Connection error — please try again]' }])
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const dialColor = (v) => v === 1 ? COLORS.gray : v === 2 ? COLORS.navy : COLORS.orange

  const handleSliderChange = (cfgKey, rect, clientX) => {
    const clickX = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
    const newVal = Math.round((pct / 100) * 2) + 1
    setCfg(prev => ({ ...prev, [cfgKey]: newVal }))
  }

  // Setup screen
  if (stage === 'setup') {
    return (
      <Layout active="ai" pageTitle="AI Client">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={s.card}>
            <p style={{ ...s.badge, color: COLORS.orange }}>AI CLIENT</p>
            <h1 style={{ ...s.title, color: '#00205B' }}>Who are you coaching today?</h1>
            <p style={s.subtitle}>
              These settings shape how your simulated client shows up. There's no right combination — try different mixes across sessions to stretch different muscles.
            </p>

            <div style={s.setupGrid}>
            {/* Left: form */}
            <div style={s.formColumn}>
              {/* Names + topic card */}
              <div style={s.card}>
                <div style={s.cardLabel}>SESSION BASICS</div>
                <div style={s.basicGrid}>
                  <div>
                    <label style={s.inputLabel}>Your Name (Coach)</label>
                    <input
                      type="text"
                      value={coachName}
                      onChange={e => setCoachName(e.target.value)}
                      placeholder="Enter your name"
                      style={s.input}
                      onKeyDown={e => e.key === 'Enter' && startSession()}
                    />
                  </div>
                  <div>
                    <label style={s.inputLabel}>Client Name</label>
                    <div style={s.nameRow}>
                      <div style={s.displayValue}>{cfg.clientName}</div>
                      <button
                        onClick={() => setCfg(randomPersona())}
                        style={s.randomBtn}
                        title="Randomize"
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                </div>
                <label style={s.inputLabel}>Coaching Topic</label>
                <div style={s.topicGrid}>
                  {TOPICS.map((t, i) => (
                    <button
                      key={t}
                      onClick={() => setCfg(prev => ({ ...prev, topic: t }))}
                      style={{
                        ...s.topicBtn,
                        ...(cfg.topic === t ? s.topicBtnActive : {}),
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona dials card */}
              <div style={s.card}>
                <div style={s.cardLabelRow}>
                  <div style={s.cardLabel}>CLIENT PERSONA</div>
                  <button
                    onClick={() => setCfg(randomPersona())}
                    style={s.randomizeAllBtn}
                  >
                    ↻ Randomize all
                  </button>
                </div>
                <div style={s.dialsContainer}>
                  {PERSONA_DIALS.map((d, idx) => {
                    const cfgKey = d.key === 'talk' ? 'talkativeness' : d.key === 'emo' ? 'emotionOpen' : d.key === 'self' ? 'selfAwareness' : d.key === 'trust' ? 'trustRapport' : 'coachReadiness'
                    const val = cfg[cfgKey]
                    const pct = ((val - 1) / 2) * 100
                    return (
                      <div key={d.key} style={s.dialRow}>
                        <div style={s.dialLabelRow}>
                          <span style={s.dialLabel}>{d.label}</span>
                          <span style={{ ...s.dialBadge, background: dialColor(val) }}>
                            {LABELS[val - 1]}
                          </span>
                        </div>
                        <div
                          style={{ ...s.sliderTrack, cursor: 'pointer', userSelect: 'none' }}
                          onClick={(e) => handleSliderChange(cfgKey, e.currentTarget.getBoundingClientRect(), e.clientX)}
                          onMouseDown={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const handleMouseMove = (me) => {
                              handleSliderChange(cfgKey, rect, me.clientX)
                            }
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove)
                              document.removeEventListener('mouseup', handleMouseUp)
                            }
                            document.addEventListener('mousemove', handleMouseMove)
                            document.addEventListener('mouseup', handleMouseUp)
                          }}
                        >
                          <div style={{ ...s.sliderFill, width: pct + '%', background: dialColor(val) }} />
                          <div style={{ ...s.sliderThumb, left: pct + '%' }} />
                        </div>
                        <div style={s.dialRange}>
                          <span style={{ ...s.rangeLabel, fontWeight: val === 1 ? 700 : 400 }}>← {d.low}</span>
                          <span style={{ ...s.rangeLabel, fontWeight: val === 3 ? 700 : 400, textAlign: 'right' }}>{d.high} →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: preview */}
            <div style={s.previewColumn}>
              <div style={s.previewCard}>
                <div style={s.previewHeader}>
                  <div style={s.previewAvatar}>{cfg.clientName[0]}</div>
                  <div>
                    <div style={s.previewName}>{cfg.clientName}</div>
                    <div style={s.previewSub}>Simulated client · {cfg.topic}</div>
                  </div>
                  <div style={s.readyBadge}>
                    <span style={s.readyDot}></span> Ready
                  </div>
                </div>
                <div style={s.previewContent}>
                  <div style={s.previewLabel}>HOW {cfg.clientName.toUpperCase()} WILL SHOW UP</div>
                  <div style={s.previewMetrics}>
                    {PERSONA_DIALS.map(d => {
                      const val = cfg[d.key === 'talk' ? 'talkativeness' : d.key === 'emo' ? 'emotionOpen' : d.key === 'self' ? 'selfAwareness' : d.key === 'trust' ? 'trustRapport' : 'coachReadiness']
                      return (
                        <div key={d.key} style={s.metricRow}>
                          <span>{d.label}</span>
                          <div style={s.metricBars}>
                            {[1, 2, 3].map(n => (
                              <div
                                key={n}
                                style={{
                                  ...s.metricBar,
                                  background: n <= val ? dialColor(val) : COLORS['gray-border'],
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={s.tipCard}>
                <span style={s.tipIcon}>✨</span>
                <div style={s.tipText}>
                  <strong>Tip:</strong> Mix one "low" with two "highs" for a productive challenge. Avoid all-low your first time.
                </div>
              </div>

              {!apiKey && (
                <div style={s.warningCard}>
                  ⚠️ API key not configured. Please contact your administrator.
                </div>
              )}

              <button
                onClick={startSession}
                disabled={!coachName.trim() || !apiKey}
                style={s.startBtn}
              >
                <div style={s.startBtnTitle}>Start session with {cfg.clientName}</div>
                <ToolIcon id="arrow" size={18} color="#fff" />
              </button>

              <div style={s.editNote}>
                Start over anytime to try a different client configuration.
              </div>
            </div>
          </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Session screen
  const exchangeCount = Math.floor(messages.length / 2)
  const sessionTime = sessionStartTime
    ? new Date(Date.now() - sessionStartTime.getTime()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '0:00'

  return (
    <Layout active="ai" pageTitle="AI Client">
      <div style={s.sessionContainer}>
        {/* Client header */}
        <div style={s.clientHeader}>
          <div style={s.clientHeaderLeft}>
            <div style={s.clientHeaderAvatar}>{cfg.clientName[0]}</div>
            <div>
              <div style={s.clientHeaderName}>{cfg.clientName}</div>
              <div style={s.clientHeaderSub}>
                {cfg.topic} · {LABELS[cfg.talkativeness - 1]} talker · {LABELS[cfg.selfAwareness - 1]} self-awareness
              </div>
            </div>
          </div>
          <div style={s.clientHeaderRight}>
            <button style={s.transcriptBtn}>
              <ToolIcon id="transcript" size={11} color={COLORS.navy} />
              Transcript
            </button>
            <button style={s.feedbackBtn}>
              <ToolIcon id="spark" size={11} color="#fff" />
              End & Get Feedback
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div style={s.messagesArea}>
          <div style={s.sessionStartMarker}>SESSION STARTED</div>
          {messages.map((msg, i) => (
            <div key={i} style={{ ...s.messageRow, alignItems: msg.role === 'coach' ? 'flex-end' : 'flex-start' }}>
              <span style={s.messageSpeaker}>
                {msg.role === 'coach' ? 'Coach · You' : `Client · ${cfg.clientName}`}
              </span>
              <div
                style={{
                  ...s.messageBubble,
                  ...(msg.role === 'coach' ? s.coachBubble : s.clientBubble),
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ ...s.messageRow, alignItems: 'flex-start' }}>
              <span style={s.messageSpeaker}>Client · {cfg.clientName}</span>
              <div style={{ ...s.messageBubble, ...s.clientBubble }}>
                <div style={s.typingIndicator}>
                  <div style={s.typingDot}></div>
                  <div style={s.typingDot}></div>
                  <div style={s.typingDot}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message composer */}
        <div style={s.composerArea}>
          <div style={s.composerInputRow}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your coaching response to Jordan…"
              style={s.composerInput}
              rows="2"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={s.sendBtn}
            >
              <ToolIcon id="send" size={15} color="#fff" />
            </button>
          </div>
          <div style={s.composerFooter}>
            <span>Press Enter to send · Shift+Enter for new line</span>
            <span>Session: {sessionTime} · {exchangeCount} exchanges</span>
          </div>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  // Setup page styles
  setupContainer: {
    padding: '36px 48px 40px',
    maxWidth: 1100,
    margin: '0 auto',
  },
  pageHeader: {
    marginBottom: '32px',
  },
  stepLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.6px',
    color: COLORS.orange,
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: COLORS.orange,
    margin: '0 0 0.5rem',
  },
  subtitle: {
    color: '#555',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    margin: '0 0 1.25rem',
  },
  badge: {
    display: 'inline-block',
    background: '#fde8d6',
    color: COLORS.orange,
    fontSize: '0.75rem',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    marginBottom: '0.75rem',
  },
  setupGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    alignItems: 'stretch',
  },
  formColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  previewColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.09)',
    padding: '2rem',
    width: '100%',
    maxWidth: '680px',
  },
  cardLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.4px',
    color: COLORS.navy,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  cardLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  basicGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: COLORS['text-muted'],
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 6,
    background: COLORS['gray-light'],
    color: COLORS['text-main'],
    fontFamily: 'Montserrat, sans-serif',
  },
  nameRow: {
    display: 'flex',
    gap: 6,
  },
  displayValue: {
    flex: 1,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 6,
    background: COLORS['gray-light'],
    color: COLORS['text-main'],
  },
  randomBtn: {
    width: 36,
    height: 36,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 6,
    background: '#fff',
    fontSize: 14,
    color: COLORS.navy,
    cursor: 'pointer',
    fontWeight: 700,
  },
  topicGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicBtn: {
    padding: '7px 12px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 18,
    border: `1px solid ${COLORS['gray-border']}`,
    background: '#fff',
    color: COLORS['text-main'],
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
  },
  topicBtnActive: {
    border: `1px solid ${COLORS.navy}`,
    background: COLORS.navy,
    color: '#fff',
  },
  randomizeAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.navy,
    padding: '4px 11px',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 16,
    background: '#fff',
    cursor: 'pointer',
  },
  dialsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  dialRow: {
    display: 'flex',
    flexDirection: 'column',
  },
  dialLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  dialLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.navy,
  },
  dialBadge: {
    color: '#fff',
    padding: '3px 11px',
    borderRadius: 18,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  sliderTrack: {
    position: 'relative',
    height: 6,
    background: COLORS['gray-border'],
    borderRadius: 3,
    marginBottom: 8,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.2s',
  },
  sliderThumb: {
    position: 'absolute',
    top: -5,
    transform: 'translateX(-50%)',
    width: 16,
    height: 16,
    background: '#fff',
    border: `2px solid ${COLORS.navy}`,
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  dialRange: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9.5px',
    color: COLORS['text-muted'],
    lineHeight: 1.4,
  },
  rangeLabel: {
    maxWidth: '46%',
  },
  // Preview styles
  previewCard: {
    background: '#fff',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewHeader: {
    background: COLORS.navy,
    color: '#fff',
    padding: '16px 22px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  previewAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: COLORS.teal,
    color: COLORS.navy,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
  },
  previewName: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '-0.2px',
  },
  previewSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  readyBadge: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: COLORS.lime,
    display: 'inline-block',
  },
  previewContent: {
    padding: '18px 22px',
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '1.3px',
    color: COLORS['text-muted'],
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  previewMetrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    marginBottom: 14,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    color: COLORS['text-main'],
    fontWeight: 600,
  },
  metricBars: {
    display: 'flex',
    gap: 3,
  },
  metricBar: {
    width: 18,
    height: 5,
    borderRadius: 2,
  },
  sampleOpening: {
    marginTop: 14,
    padding: '10px 12px',
    background: COLORS['gray-light'],
    borderRadius: 6,
    border: `1px solid ${COLORS['gray-border']}`,
    fontSize: '10.5px',
    color: COLORS['text-main'],
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  sampleLabel: {
    fontSize: 9,
    color: COLORS['text-muted'],
    marginTop: 6,
    textAlign: 'right',
    letterSpacing: '0.4px',
  },
  tipCard: {
    background: '#FFF8EC',
    border: '1px solid #F4D693',
    borderRadius: 10,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  tipText: {
    fontSize: '10.5px',
    color: '#7c4a09',
    lineHeight: 1.6,
  },
  warningCard: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '12px 18px',
    borderRadius: 8,
    fontSize: '0.9rem',
  },
  startBtn: {
    padding: '14px 18px',
    background: COLORS.orange,
    borderRadius: 8,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'Montserrat, sans-serif',
    disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  startBtnTitle: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '-0.2px',
    textAlign: 'center',
  },
  startBtnSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textAlign: 'center',
  },
  editNote: {
    fontSize: 10,
    color: COLORS['text-muted'],
    textAlign: 'center',
    lineHeight: 1.6,
  },
  // Session page styles
  sessionContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 150px)',
    maxWidth: 1000,
    margin: '0 auto',
  },
  clientHeader: {
    padding: '16px 28px',
    borderBottom: `1px solid ${COLORS['gray-border']}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
  },
  clientHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  clientHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: COLORS.navy,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  clientHeaderName: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.navy,
  },
  clientHeaderSub: {
    fontSize: 10,
    color: COLORS['text-muted'],
  },
  clientHeaderRight: {
    display: 'flex',
    gap: 8,
  },
  transcriptBtn: {
    padding: '7px 12px',
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.navy,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
  },
  feedbackBtn: {
    padding: '7px 14px',
    background: COLORS.orange,
    color: '#fff',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    border: 'none',
    boxShadow: `0 1px 6px rgba(255,130,0,0.3)`,
    fontFamily: 'Montserrat, sans-serif',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    background: COLORS['gray-light'],
  },
  sessionStartMarker: {
    alignSelf: 'center',
    fontSize: 9,
    color: COLORS['text-muted'],
    letterSpacing: 1,
    fontWeight: 600,
    padding: '4px 12px',
    background: '#fff',
    borderRadius: 12,
    border: `1px solid ${COLORS['gray-border']}`,
    marginBottom: 6,
  },
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  messageSpeaker: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS['text-muted'],
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  messageBubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 11,
    lineHeight: 1.65,
    wordBreak: 'break-word',
  },
  coachBubble: {
    background: COLORS.navy,
    color: '#fff',
    borderRadius: '12px 3px 12px 12px',
    alignSelf: 'flex-end',
  },
  clientBubble: {
    background: '#fff',
    color: COLORS['text-main'],
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: '3px 12px 12px 12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  },
  typingIndicator: {
    display: 'flex',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: COLORS.gray,
    animation: 'pulse 1.4s infinite',
  },
  composerArea: {
    padding: '14px 28px 18px',
    borderTop: `1px solid ${COLORS['gray-border']}`,
    background: '#fff',
  },
  composerInputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    border: `1px solid ${COLORS['gray-border']}`,
    borderRadius: 8,
    background: '#fff',
    padding: '10px 14px',
    fontSize: 11,
    color: COLORS['text-muted'],
    lineHeight: 1.5,
    fontFamily: 'Montserrat, sans-serif',
    resize: 'vertical',
  },
  sendBtn: {
    width: 44,
    height: 44,
    background: COLORS.navy,
    borderRadius: 8,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
  },
  composerFooter: {
    marginTop: 8,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: COLORS['text-muted'],
  },
}

import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import LoadingBar from '../../components/LoadingBar'

const COLORS = {
  navy: '#00205B',
  teal: '#69cce6',
  orange: '#ff8200',
  'red-warn': '#f5222d',
  'amber-warn': '#faad14',
  gray: '#7C7E7F',
  'gray-light': '#f0f2f5',
  'gray-border': '#e2e6ec',
  white: '#ffffff',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
}

const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/aac']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export default function AudioToTranscript() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [phase, setPhase] = useState('upload') // upload, processing, assign-speakers, review, saved
  const [file, setFile] = useState(null)
  const [transcriptId, setTranscriptId] = useState(null)
  const [segments, setSegments] = useState([])
  const [duration, setDuration] = useState('0:00')
  const [speakerLabels, setSpeakerLabels] = useState({ A: null, B: null })
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [editing, setEditing] = useState({})

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return

    if (!SUPPORTED_FORMATS.includes(selectedFile.type)) {
      setError('Unsupported file format. Please use MP3, M4A, WAV, MP4, or WEBM.')
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is 100MB (your file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB).`)
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    handleFileSelect(droppedFile)
  }

  const startTranscription = async () => {
    if (!file) return

    try {
      setPhase('processing')
      setError(null)
      setStatusMessage('Uploading audio…')
      setElapsedSeconds(0)

      // Start elapsed time counter
      const startTime = Date.now()
      const timerInterval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

      // Upload audio
      const uploadRes = await fetch(`/api/transcribe-audio?userId=${user.id}`, {
        method: 'POST',
        body: file,
      })

      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.error || 'Failed to upload audio')
      }

      const uploadData = await uploadRes.json()
      setTranscriptId(uploadData.transcriptId)
      setStatusMessage('Transcribing with speaker detection…')

      // Poll for completion
      let completed = false
      let pollCount = 0
      while (!completed && pollCount < 600) { // 10 minute timeout
        await new Promise(r => setTimeout(r, 5000))
        pollCount++

        const statusRes = await fetch(
          `/api/transcription-status?transcriptId=${uploadData.transcriptId}&userId=${user.id}`
        )

        if (!statusRes.ok) {
          throw new Error('Failed to check transcription status')
        }

        const statusData = await statusRes.json()

        if (statusData.status === 'error') {
          throw new Error(statusData.message || 'Transcription failed')
        }

        if (statusData.status === 'completed') {
          clearInterval(timerInterval)
          setSegments(statusData.segments)
          setDuration(statusData.duration)
          setPhase('assign-speakers')
          completed = true
        }

        if (pollCount % 6 === 0) { // Every 30 seconds, update status message
          setStatusMessage('Identifying speakers…')
        }
        if (pollCount % 12 === 0) {
          setStatusMessage('Detecting sensitive information…')
        }
      }

      if (!completed) {
        throw new Error('Transcription took too long. Please try again.')
      }
    } catch (err) {
      setPhase('upload')
      setError(err.message || 'Failed to transcribe audio')
      setFile(null)
    }
  }

  const confirmSpeakers = () => {
    if (!speakerLabels.A || !speakerLabels.B) {
      setError('Please assign both speakers')
      return
    }
    if (speakerLabels.A === speakerLabels.B) {
      setError('Speakers must be assigned different roles')
      return
    }
    setError(null)
    setPhase('review')
    autoSave()
  }

  const autoSave = async () => {
    try {
      const formattedSegments = segments.map(s => ({
        ...s,
        speaker: speakerLabels[s.speaker],
      }))

      const saveRes = await fetch(`/api/audio-history?userId=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          duration,
          segments: formattedSegments,
          speakerLabels,
        }),
      })

      if (!saveRes.ok) {
        throw new Error('Failed to save transcript')
      }

      const saveData = await saveRes.json()
      setSessionId(saveData.sessionId)
    } catch (err) {
      console.error('Auto-save error:', err)
    }
  }

  const updateSegmentText = (index, newText) => {
    const newSegments = [...segments]
    newSegments[index].text = newText
    setSegments(newSegments)
    setEditing({ ...editing, [index]: false })
  }

  const downloadPDF = () => {
    const w = window.open()
    const html = generatePDFHTML()
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 100)
  }

  const generatePDFHTML = () => {
    const formattedSegments = segments.map(s => ({
      ...s,
      speaker: speakerLabels[s.speaker],
    }))

    const segmentHTML = formattedSegments
      .map(
        s => `
      <div style="margin-bottom: 16px; page-break-inside: avoid;">
        <p style="font-weight: bold; margin: 0 0 4px 0; color: #00205B;">
          [${s.speaker}] ${s.startTime} — ${s.endTime}
        </p>
        <p style="margin: 0; line-height: 1.6; color: #0f1c3a;">
          ${s.text.split(' ').map(word => {
            const highlighted = s.piiTerms.some(term => term.toLowerCase() === word.toLowerCase())
            return highlighted ? `<mark style="background: #faad14;">${word}</mark>` : word
          }).join(' ')}
        </p>
      </div>
    `
      )
      .join('')

    return `<!DOCTYPE html>
<html>
<head>
  <title>Audio Transcript</title>
  <style>
    body { font-family: 'Montserrat', sans-serif; margin: 40px; line-height: 1.6; color: #0f1c3a; }
    h1 { color: #00205B; margin-bottom: 8px; }
    .meta { color: #6b7a99; font-size: 12px; margin-bottom: 24px; }
    mark { background: #faad14; padding: 2px 4px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Audio Transcript</h1>
  <div class="meta">
    <p>File: ${file.name}</p>
    <p>Duration: ${duration}</p>
    <p>Date: ${new Date().toLocaleDateString()}</p>
  </div>
  <div>
    ${segmentHTML}
  </div>
</body>
</html>`
  }

  if (phase === 'upload') {
    return (
      <Layout active="audio" pageTitle="Audio to Transcript">
        <div style={styles.container}>
          <div style={styles.uploadSection}>
            <div
              style={{
                ...styles.uploadZone,
                ...(file ? styles.uploadZoneActive : {}),
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={styles.uploadIcon}>📁</div>
              <h2 style={styles.uploadTitle}>Upload Audio File</h2>
              <p style={styles.uploadSubtitle}>
                Drag and drop your audio file here, or click to browse
              </p>
              <p style={styles.uploadFormats}>
                Supported: MP3, M4A, WAV, MP4, WEBM (max 100MB)
              </p>
              {file && <p style={styles.selectedFile}>📄 {file.name}</p>}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              style={{ display: 'none' }}
            />

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              onClick={startTranscription}
              disabled={!file}
              style={{
                ...styles.button,
                ...(file ? styles.buttonActive : styles.buttonDisabled),
              }}
            >
              Transcribe
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  if (phase === 'processing') {
    return (
      <Layout active="audio" pageTitle="Audio to Transcript">
        <div style={styles.container}>
          <div style={styles.processingSection}>
            <LoadingBar />
            <p style={styles.statusText}>{statusMessage}</p>
            <p style={styles.elapsedTime}>{formatSeconds(elapsedSeconds)}</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (phase === 'assign-speakers') {
    const speakerAPreview = segments
      .filter(s => s.speaker === 'A')
      .slice(0, 2)
      .map(s => s.text.substring(0, 60) + '...')
      .join(' ')

    const speakerBPreview = segments
      .filter(s => s.speaker === 'B')
      .slice(0, 2)
      .map(s => s.text.substring(0, 60) + '...')
      .join(' ')

    return (
      <Layout active="audio" pageTitle="Audio to Transcript">
        <div style={styles.container}>
          <div style={styles.assignSection}>
            <h2 style={styles.sectionTitle}>Identify the Speakers</h2>
            <p style={styles.sectionSubtitle}>
              We detected 2 speakers in the audio. Please identify who is the Coach and who is the Client.
            </p>

            <div style={styles.speakerGrid}>
              <div style={styles.speakerCard}>
                <h3 style={styles.speakerLabel}>Speaker A</h3>
                <p style={styles.speakerPreview}>{speakerAPreview}</p>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="speaker-a"
                      value="Coach"
                      checked={speakerLabels.A === 'Coach'}
                      onChange={(e) =>
                        setSpeakerLabels({ ...speakerLabels, A: e.target.value })
                      }
                    />
                    Coach
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="speaker-a"
                      value="Client"
                      checked={speakerLabels.A === 'Client'}
                      onChange={(e) =>
                        setSpeakerLabels({ ...speakerLabels, A: e.target.value })
                      }
                    />
                    Client
                  </label>
                </div>
              </div>

              <div style={styles.speakerCard}>
                <h3 style={styles.speakerLabel}>Speaker B</h3>
                <p style={styles.speakerPreview}>{speakerBPreview}</p>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="speaker-b"
                      value="Coach"
                      checked={speakerLabels.B === 'Coach'}
                      onChange={(e) =>
                        setSpeakerLabels({ ...speakerLabels, B: e.target.value })
                      }
                    />
                    Coach
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="speaker-b"
                      value="Client"
                      checked={speakerLabels.B === 'Client'}
                      onChange={(e) =>
                        setSpeakerLabels({ ...speakerLabels, B: e.target.value })
                      }
                    />
                    Client
                  </label>
                </div>
              </div>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button onClick={confirmSpeakers} style={styles.buttonPrimary}>
              Continue to Transcript
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  if (phase === 'review') {
    const formattedSegments = segments.map(s => ({
      ...s,
      speaker: speakerLabels[s.speaker],
    }))

    return (
      <Layout active="audio" pageTitle="Audio to Transcript">
        <div style={styles.container}>
          <div style={styles.actionBar}>
            <div style={styles.actionTitle}>
              <span>{file?.name} — {duration}</span>
            </div>
            <div style={styles.actionButtons}>
              <button onClick={downloadPDF} style={styles.buttonSecondary}>
                📥 Download PDF
              </button>
              <button
                onClick={() => setPhase('upload')}
                style={styles.buttonLink}
              >
                ↻ Start Over
              </button>
              {sessionId && <span style={styles.savedBadge}>✓ Saved</span>}
            </div>
          </div>

          <div style={styles.transcriptPanel}>
            {formattedSegments.map((segment, idx) => (
              <div key={idx} style={styles.segment}>
                <div style={styles.segmentHeader}>
                  <span style={styles.segmentSpeaker}>[{segment.speaker}]</span>
                  <span style={styles.segmentTime}>
                    {segment.startTime} — {segment.endTime}
                  </span>
                </div>
                <div
                  style={styles.segmentText}
                  onClick={() => setEditing({ ...editing, [idx]: true })}
                  contentEditable={editing[idx]}
                  suppressContentEditableWarning
                  onBlur={(e) => updateSegmentText(idx, e.currentTarget.textContent)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setEditing({ ...editing, [idx]: false })
                    }
                  }}
                >
                  {segment.text.split(' ').map((word, wordIdx) => {
                    const highlighted = segment.piiTerms.some(
                      term => term.toLowerCase() === word.toLowerCase()
                    )
                    return (
                      <span
                        key={wordIdx}
                        style={{
                          backgroundColor: highlighted ? COLORS['amber-warn'] : 'transparent',
                          padding: highlighted ? '2px 4px' : 0,
                          borderRadius: highlighted ? '2px' : 0,
                          marginRight: '4px',
                          title: highlighted ? 'Potential PII' : '',
                        }}
                      >
                        {word}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return null
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s elapsed`
}

const styles = {
  container: {
    maxWidth: 1000,
    margin: '0 auto',
  },
  uploadSection: {
    padding: 40,
  },
  uploadZone: {
    border: `2px dashed ${COLORS['gray-border']}`,
    borderRadius: 8,
    padding: 40,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: 20,
  },
  uploadZoneActive: {
    borderColor: COLORS.teal,
    backgroundColor: `rgba(105, 204, 230, 0.05)`,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS['text-main'],
    margin: '0 0 8px 0',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: COLORS['text-muted'],
    margin: '0 0 8px 0',
  },
  uploadFormats: {
    fontSize: 12,
    color: COLORS.gray,
    margin: 0,
  },
  selectedFile: {
    marginTop: 16,
    fontSize: 13,
    color: COLORS.teal,
    fontWeight: 500,
  },
  errorBox: {
    backgroundColor: `rgba(245, 34, 45, 0.1)`,
    border: `1px solid ${COLORS['red-warn']}`,
    borderRadius: 4,
    padding: 12,
    fontSize: 13,
    color: COLORS['red-warn'],
    marginBottom: 16,
  },
  button: {
    padding: '12px 24px',
    borderRadius: 6,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Montserrat, sans-serif',
  },
  buttonActive: {
    backgroundColor: COLORS.navy,
    color: COLORS.white,
  },
  buttonDisabled: {
    backgroundColor: COLORS['gray-light'],
    color: COLORS['text-muted'],
    cursor: 'not-allowed',
  },
  buttonPrimary: {
    padding: '12px 24px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
    marginTop: 24,
  },
  buttonSecondary: {
    padding: '8px 16px',
    borderRadius: 6,
    border: `1px solid ${COLORS['gray-border']}`,
    background: COLORS.white,
    color: COLORS['text-main'],
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
  },
  buttonLink: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    color: COLORS.teal,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif',
  },
  processingSection: {
    padding: 60,
    textAlign: 'center',
  },
  statusText: {
    marginTop: 24,
    fontSize: 14,
    color: COLORS['text-main'],
  },
  elapsedTime: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS['text-muted'],
  },
  assignSection: {
    padding: 40,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS['text-main'],
    margin: '0 0 8px 0',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS['text-muted'],
    margin: '0 0 32px 0',
  },
  speakerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 32,
  },
  speakerCard: {
    padding: 20,
    backgroundColor: COLORS['gray-light'],
    borderRadius: 8,
  },
  speakerLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS['text-main'],
    margin: '0 0 12px 0',
  },
  speakerPreview: {
    fontSize: 12,
    color: COLORS['text-muted'],
    fontStyle: 'italic',
    margin: '0 0 16px 0',
    lineHeight: 1.4,
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: COLORS['text-main'],
    cursor: 'pointer',
    gap: 8,
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: COLORS['text-main'],
  },
  actionButtons: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  savedBadge: {
    fontSize: 12,
    color: '#52c41a',
    fontWeight: 600,
  },
  transcriptPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  segment: {
    padding: 16,
    borderBottom: `1px solid ${COLORS['gray-border']}`,
  },
  segmentHeader: {
    display: 'flex',
    gap: 12,
    marginBottom: 8,
    fontSize: 12,
  },
  segmentSpeaker: {
    fontWeight: 700,
    color: COLORS.navy,
  },
  segmentTime: {
    color: COLORS['text-muted'],
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: COLORS['text-main'],
    cursor: 'text',
  },
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'

const CONTENT_DEFAULTS = {
  audio_start_badge: 'Utility',
  audio_start_title: 'Audio to Transcript',
  audio_start_subtitle: 'Convert your coaching session audio recordings into text transcripts. Upload an audio file and get an accurate transcription ready for analysis.',
  audio_start_info_1: 'Supports MP3, WAV, and M4A formats',
  audio_start_info_2: 'Fast, accurate transcription',
  audio_start_info_3: 'Transcripts ready for the Transcript Scorer tool',
  theme_primary_color: '#00205B',
  theme_page_bg: '#f0f2f5',
}

export default function AudioToTranscript() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [content, setContent] = useState(CONTENT_DEFAULTS)
  const primary = content.theme_primary_color

  return (
    <Layout active="audio" pageTitle="Audio to Transcript">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ ...styles.badge, background: '#e8ecf5', color: '#00205B' }}>{content.audio_start_badge || 'Utility'}</span>
          <h1 style={{ ...styles.title, color: '#00205B' }}>{content.audio_start_title || 'Audio to Transcript'}</h1>
          <p style={styles.subtitle}>{content.audio_start_subtitle}</p>

          <ul style={styles.infoList}>
            {[content.audio_start_info_1, content.audio_start_info_2, content.audio_start_info_3]
              .filter(Boolean)
              .map((info, i) => (
                <li key={i} style={styles.infoItem}>{info}</li>
              ))}
          </ul>

          <button style={{ ...styles.startBtn, background: primary }}>
            Upload Audio File
          </button>
        </div>
      </div>
    </Layout>
  )
}

const styles = {
  startScreen: {
    maxWidth: '700px',
    margin: '0 auto',
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
    fontSize: '0.65rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
    margin: '0.5rem 0 1rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '1.5rem',
  },
  infoList: {
    fontSize: '0.85rem',
    color: '#444',
    paddingLeft: '1.5rem',
    marginBottom: '1.5rem',
    lineHeight: '1.8',
  },
  infoItem: {
    marginBottom: '0.5rem',
  },
  startBtn: {
    padding: '0.75rem 1.5rem',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Montserrat', sans-serif",
  },
  placeholder: {
    background: '#fff',
    border: '1px dashed #e5e7eb',
    borderRadius: '10px',
    padding: '3rem 2rem',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#00205B',
    marginBottom: '0.5rem',
  },
  placeholderSub: {
    fontSize: '0.85rem',
    color: '#999',
  },
}

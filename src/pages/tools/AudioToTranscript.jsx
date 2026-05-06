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
          <p style={{ ...styles.badge, background: '#e8ecf5', color: '#00205B' }}>{content.audio_start_badge || 'Utility'}</p>
          <h1 style={{ ...styles.title, color: '#00205B' }}>{content.audio_start_title || 'Audio to Transcript'}</h1>
          <p style={styles.subtitle}>{content.audio_start_subtitle}</p>

          <ul style={styles.infoList}>
            {[content.audio_start_info_1, content.audio_start_info_2, content.audio_start_info_3]
              .filter(Boolean)
              .map((info, i) => (
                <li key={i}>{info}</li>
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
  startBtn: {
    padding: '0.7rem 1.5rem',
    background: '#00205B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
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

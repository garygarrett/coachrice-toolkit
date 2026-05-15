import { createClient } from '@supabase/supabase-js'
import { Anthropic } from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMP_DIR = path.join(__dirname, '..', '.tmp-audio-uploads')

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anthropicKey = process.env.VITE_ANTHROPIC_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const { action, userId, transcriptId, sessionId, uploadSessionId, chunkIndex, totalChunks } = req.query

  if (!action) {
    return res.status(400).json({ error: 'action is required' })
  }

  // UPLOAD CHUNK - Handle chunked audio file uploads
  if (action === 'upload-chunk' && req.method === 'POST') {
    if (!uploadSessionId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ error: 'uploadSessionId, chunkIndex, and totalChunks are required' })
    }

    try {
      const uploadDir = path.join(TEMP_DIR, uploadSessionId)

      // Create temp directory if needed
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      // Clean up orphaned uploads (older than 1 hour)
      cleanupOldUploads()

      // Write chunk to disk
      const chunkPath = path.join(uploadDir, `chunk-${chunkIndex}`)
      fs.writeFileSync(chunkPath, req.body)

      // Check if all chunks are received
      const chunks = fs.readdirSync(uploadDir).filter(f => f.startsWith('chunk-')).length
      const allReceived = chunks === parseInt(totalChunks)

      return res.status(200).json({
        chunkReceived: parseInt(chunkIndex) + 1,
        totalChunks: parseInt(totalChunks),
        allReceived,
      })
    } catch (error) {
      console.error('Chunk upload error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // TRANSCRIBE - Start transcription job with chunks or direct upload
  if (action === 'transcribe' && req.method === 'POST') {
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    try {
      // Fetch AssemblyAI key from Supabase config
      const { data: configData } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'api_key_audio')
        .single()

      const assemblyAIKey = configData?.value
      if (!assemblyAIKey) {
        return res.status(500).json({ error: 'AssemblyAI API key not configured' })
      }

      // Verify user exists
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Get audio file - either from chunks or direct body
      let audioBuffer
      if (uploadSessionId) {
        // Reassemble chunks
        audioBuffer = reassembleChunks(uploadSessionId)
        if (!audioBuffer) {
          return res.status(400).json({ error: 'Chunks not ready or missing' })
        }
      } else {
        // Direct upload
        if (!req.body || !req.body.length) {
          return res.status(400).json({ error: 'No audio file provided' })
        }
        audioBuffer = req.body
      }

      // Upload audio to AssemblyAI
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAIKey,
        },
        body: audioBuffer,
      })

      // Clean up temp files if chunked upload
      if (uploadSessionId) {
        cleanupUploadSession(uploadSessionId)
      }

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text()
        console.error('AssemblyAI upload error:', error)
        return res.status(500).json({ error: 'Failed to upload audio to AssemblyAI' })
      }

      const uploadData = await uploadResponse.json()
      const audioUrl = uploadData.upload_url

      // Start transcription job with speaker labels
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAIKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          speaker_labels: true,
          language_detection: true,
        }),
      })

      if (!transcriptResponse.ok) {
        const error = await transcriptResponse.text()
        console.error('AssemblyAI transcript error:', error)
        return res.status(500).json({ error: 'Failed to start transcription job' })
      }

      const transcriptData = await transcriptResponse.json()

      return res.status(200).json({
        transcriptId: transcriptData.id,
      })
    } catch (error) {
      console.error('Transcribe error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // STATUS - Check transcription status and detect PII when complete
  if (action === 'status' && req.method === 'GET') {
    if (!transcriptId || !userId) {
      return res.status(400).json({ error: 'transcriptId and userId are required' })
    }

    try {
      // Fetch AssemblyAI key from Supabase config
      const { data: configData } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'api_key_audio')
        .single()

      const assemblyAIKey = configData?.value
      if (!assemblyAIKey) {
        return res.status(500).json({ error: 'AssemblyAI API key not configured' })
      }

      // Verify user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check transcription status
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'Authorization': assemblyAIKey },
      })

      if (!statusResponse.ok) {
        return res.status(500).json({ error: 'Failed to check transcription status' })
      }

      const transcriptData = await statusResponse.json()

      // Not complete yet
      if (transcriptData.status === 'processing' || transcriptData.status === 'queued') {
        return res.status(200).json({
          status: 'processing',
        })
      }

      // Error
      if (transcriptData.status === 'error') {
        return res.status(200).json({
          status: 'error',
          message: transcriptData.error || 'Transcription failed',
        })
      }

      // Completed - process utterances
      if (transcriptData.status === 'completed' && transcriptData.utterances) {
        // Collect all text for PII detection
        const allText = transcriptData.utterances.map(u => u.text).join('\n')

        // Detect PII using Claude
        let piiTerms = []
        try {
          const piiResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: `Given this transcript text, identify any potential PII: full names of people, company/organization names, institutions, universities, email addresses, phone numbers, and place names. Return ONLY a JSON array of exact strings found in the text to highlight. Be conservative - flag only clear identifiers, not common words. If no PII found, return an empty array [].

Transcript:
${allText}

Return only the JSON array, nothing else.`,
              },
            ],
          })

          if (piiResponse.content && piiResponse.content.length > 0) {
            try {
              const piiText = piiResponse.content[0].type === 'text' ? piiResponse.content[0].text : '[]'
              piiTerms = JSON.parse(piiText)
            } catch (parseError) {
              console.error('Failed to parse Claude PII response:', parseError, 'Response text:', piiResponse.content[0]?.text)
              piiTerms = []
            }
          }
        } catch (e) {
          console.error('PII detection error:', e)
          piiTerms = []
        }

        // Format segments
        const segments = transcriptData.utterances.map(utterance => {
          const startMs = utterance.start
          const endMs = utterance.end
          const startTime = formatTime(startMs)
          const endTime = formatTime(endMs)

          // Find PII terms in this segment
          const segmentPII = piiTerms.filter(term =>
            utterance.text.toLowerCase().includes(term.toLowerCase())
          )

          return {
            speaker: utterance.speaker,
            startTime,
            endTime,
            startMs,
            endMs,
            text: utterance.text,
            piiTerms: segmentPII,
          }
        })

        // Calculate duration
        const durationMs = transcriptData.utterances[transcriptData.utterances.length - 1]?.end || 0
        const duration = formatTime(durationMs)

        return res.status(200).json({
          status: 'completed',
          segments,
          duration,
          durationMs,
        })
      }

      return res.status(200).json({ status: 'unknown' })
    } catch (error) {
      console.error('Transcription status error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // HISTORY (GET) - Fetch audio transcripts or specific transcript
  if (action === 'history' && req.method === 'GET') {
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    try {
      // Verify user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Get specific transcript
      if (sessionId) {
        const { data: session } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .eq('tool', 'transcriber')
          .is('deleted_at', null)
          .single()

        if (!session) {
          return res.status(404).json({ error: 'Transcript not found' })
        }

        return res.status(200).json(session.raw_output || {})
      }

      // Get list of transcripts
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, created_at, raw_output')
        .eq('user_id', userId)
        .eq('tool', 'transcriber')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const transcripts = sessions?.map(s => {
        const output = s.raw_output || {}
        return {
          id: s.id,
          created_at: s.created_at,
          filename: output.filename || 'Recording',
          duration: output.duration || '0:00',
        }
      }) || []

      return res.status(200).json({ data: transcripts })
    } catch (error) {
      console.error('Audio history GET error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // SAVE - Save audio transcript
  if (action === 'save' && req.method === 'POST') {
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    try {
      const { filename, duration, segments, speakerLabels } = req.body

      // Verify user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const rawOutput = {
        filename,
        duration,
        segments,
        speakerLabels,
      }

      const { data: session, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          tool: 'transcriber',
          score_category: 'none',
          raw_input: JSON.stringify({ filename }),
          raw_output: rawOutput,
          status: 'completed',
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: 'Failed to save transcript' })
      }

      return res.status(200).json({
        sessionId: session.id,
      })
    } catch (error) {
      console.error('Audio history POST error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // DELETE - Soft delete audio transcript
  if (action === 'delete' && req.method === 'DELETE') {
    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'userId and sessionId are required' })
    }

    try {
      // Verify user owns this transcript
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .eq('tool', 'transcriber')
        .single()

      if (!session) {
        return res.status(404).json({ error: 'Transcript not found' })
      }

      // Soft delete
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId)

      if (updateError) {
        throw updateError
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Audio history DELETE error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(400).json({ error: 'Invalid action' })
}

function reassembleChunks(uploadSessionId) {
  try {
    const uploadDir = path.join(TEMP_DIR, uploadSessionId)
    if (!fs.existsSync(uploadDir)) {
      return null
    }

    // Get all chunk files and sort by index
    const chunkFiles = fs.readdirSync(uploadDir)
      .filter(f => f.startsWith('chunk-'))
      .sort((a, b) => {
        const indexA = parseInt(a.split('-')[1])
        const indexB = parseInt(b.split('-')[1])
        return indexA - indexB
      })

    if (chunkFiles.length === 0) {
      return null
    }

    // Combine chunks into single buffer
    const buffers = chunkFiles.map(file => fs.readFileSync(path.join(uploadDir, file)))
    return Buffer.concat(buffers)
  } catch (error) {
    console.error('Reassemble chunks error:', error)
    return null
  }
}

function cleanupUploadSession(uploadSessionId) {
  try {
    const uploadDir = path.join(TEMP_DIR, uploadSessionId)
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error('Cleanup upload session error:', error)
  }
}

function cleanupOldUploads() {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      return
    }

    const now = Date.now()
    const maxAge = 60 * 60 * 1000 // 1 hour

    const sessions = fs.readdirSync(TEMP_DIR)
    sessions.forEach(sessionId => {
      const sessionPath = path.join(TEMP_DIR, sessionId)
      const stats = fs.statSync(sessionPath)
      if (now - stats.mtimeMs > maxAge) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
      }
    })
  } catch (error) {
    console.error('Cleanup old uploads error:', error)
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

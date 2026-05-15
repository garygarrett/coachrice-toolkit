import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

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

  const { transcriptId, userId } = req.query

  if (!transcriptId || !userId) {
    return res.status(400).json({ error: 'transcriptId and userId are required' })
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

      // Call detect-pii endpoint
      let piiTerms = []
      try {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
        const piiDetectRes = await fetch(`${baseUrl}/api/detect-pii`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcriptText: allText }),
        })

        if (piiDetectRes.ok) {
          try {
            const piiData = await piiDetectRes.json()
            piiTerms = piiData.piiTerms || []
          } catch (jsonError) {
            console.error('Failed to parse PII response JSON:', jsonError)
            piiTerms = []
          }
        } else {
          const errorText = await piiDetectRes.text()
          console.error('PII detection failed with status', piiDetectRes.status, ':', errorText)
          piiTerms = []
        }
      } catch (e) {
        console.error('PII detection fetch error:', e)
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

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

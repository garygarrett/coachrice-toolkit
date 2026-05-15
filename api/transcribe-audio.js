import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    // Verify user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get the audio file from request body (binary)
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIKey,
      },
      body: req.body,
    })

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

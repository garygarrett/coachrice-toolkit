import { createClient } from '@supabase/supabase-js'
import { Anthropic } from '@anthropic-ai/sdk'

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

  // Fetch Claude API key from Supabase config
  const { data: claudeKeyData } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'api_key_audio_pii')
    .single()

  const claudeKey = claudeKeyData?.value
  if (!claudeKey) {
    return res.status(500).json({ error: 'Claude API key not configured' })
  }

  const { transcriptText } = req.body

  if (!transcriptText) {
    return res.status(400).json({ error: 'transcriptText is required' })
  }

  try {
    if (!claudeKey) {
      console.error('Claude API key is empty')
      return res.status(500).json({ error: 'Claude API key not found in config' })
    }

    const client = new Anthropic({ apiKey: claudeKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Given this transcript text, identify any potential PII: full names of people, company/organization names, institutions, universities, email addresses, phone numbers, and place names. Return ONLY a JSON array of exact strings found in the text to highlight. Be conservative - flag only clear identifiers, not common words. If no PII found, return an empty array [].

Transcript:
${transcriptText}

Return only the JSON array, nothing else.`,
        },
      ],
    })

    let piiTerms = []
    if (response.content && response.content.length > 0) {
      try {
        const piiText = response.content[0].type === 'text' ? response.content[0].text : '[]'
        piiTerms = JSON.parse(piiText)
      } catch (parseError) {
        console.error('Failed to parse Claude response:', parseError, 'Response text:', response.content[0]?.text)
        piiTerms = []
      }
    }

    return res.status(200).json({
      piiTerms: piiTerms || [],
    })
  } catch (error) {
    console.error('PII detection error:', error.message, error)
    return res.status(500).json({ error: `PII detection failed: ${error.message}` })
  }
}

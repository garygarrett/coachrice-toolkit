import { createClient } from '@supabase/supabase-js'

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

  const { sessionId, analysisText, competencyScores } = req.body

  if (!sessionId || !analysisText) {
    return res.status(400).json({ error: 'sessionId and analysisText are required' })
  }

  try {
    const { data, error } = await supabase
      .from('chat_analyses')
      .insert({
        chat_session_id: sessionId,
        analysis_text: analysisText,
        competency_scores: competencyScores || null,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ success: true, analysisId: data.id })
  } catch (err) {
    console.error('Error saving chat analysis:', err)
    return res.status(500).json({ error: err.message })
  }
}

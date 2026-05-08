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

  const { analysisId, userId } = req.body

  if (!analysisId || !userId) {
    return res.status(400).json({ error: 'analysisId and userId are required' })
  }

  try {
    // Verify user owns this analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('transcript_analyses')
      .select('user_id')
      .eq('id', analysisId)
      .single()

    if (fetchError || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' })
    }

    if (analysis.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Soft delete by setting deleted_at
    const { error: deleteError } = await supabase
      .from('transcript_analyses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', analysisId)

    if (deleteError) throw deleteError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Error deleting transcript analysis:', err)
    return res.status(500).json({ error: err.message })
  }
}

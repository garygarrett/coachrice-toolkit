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

  const { attemptId, userId } = req.body

  if (!attemptId || !userId) {
    return res.status(400).json({ error: 'attemptId and userId are required' })
  }

  try {
    // Verify user owns this attempt
    const { data: attempt, error: fetchError } = await supabase
      .from('exam_attempts')
      .select('user_id')
      .eq('id', attemptId)
      .single()

    if (fetchError || !attempt) {
      return res.status(404).json({ error: 'Exam attempt not found' })
    }

    if (attempt.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Soft delete by setting deleted_at
    const { error: deleteError } = await supabase
      .from('exam_attempts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', attemptId)

    if (deleteError) throw deleteError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Error deleting exam attempt:', err)
    return res.status(500).json({ error: err.message })
  }
}

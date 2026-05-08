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

  const { sessionId, userId } = req.body

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId and userId are required' })
  }

  try {
    // Verify user owns this session
    const { data: session, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    if (session.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Soft delete by setting deleted_at
    const { error: deleteError } = await supabase
      .from('chat_sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (deleteError) throw deleteError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Error deleting chat session:', err)
    return res.status(500).json({ error: err.message })
  }
}

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

  const { sessionId, userId } = req.query

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId and userId are required' })
  }

  try {
    // Get the session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    // Check permissions
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (user?.role !== 'admin' && session.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_session_id', sessionId)
      .order('message_order')

    if (messagesError) throw messagesError

    // Get analysis
    const { data: analyses, error: analysisError } = await supabase
      .from('chat_analyses')
      .select('*')
      .eq('chat_session_id', sessionId)

    if (analysisError) throw analysisError

    return res.status(200).json({
      session,
      messages,
      analysis: analyses[0] || null,
    })
  } catch (err) {
    console.error('Error fetching chat session:', err)
    return res.status(500).json({ error: err.message })
  }
}

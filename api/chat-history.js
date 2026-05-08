import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // GET - Fetch chat sessions or specific session
  if (req.method === 'GET') {
    const { userId, sessionId, viewingUserId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Get specific session with messages and analysis
    if (sessionId) {
      try {
        const { data: session } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', sessionId)
          .is('deleted_at', null)
          .single()

        if (!session) {
          return res.status(404).json({ error: 'Chat session not found' })
        }

        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (user?.role !== 'admin' && session.user_id !== userId) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_session_id', sessionId)
          .order('message_order')

        const { data: analyses } = await supabase
          .from('chat_analyses')
          .select('*')
          .eq('chat_session_id', sessionId)

        return res.status(200).json({
          session,
          messages,
          analysis: analyses[0] || null,
        })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // Get all sessions for user
    try {
      let query = supabase
        .from('chat_sessions')
        .select('id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (user?.role !== 'admin' && viewingUserId && viewingUserId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      if (viewingUserId) {
        query = query.eq('user_id', viewingUserId)
      } else {
        query = query.eq('user_id', userId)
      }

      const { data } = await query
      return res.status(200).json({ data })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST - Create session, save message, or save analysis
  if (req.method === 'POST') {
    const { userId, action, sessionId, role, content, messageOrder, analysisText, competencyScores } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    try {
      // Create new session
      if (action === 'create-session') {
        const { data } = await supabase
          .from('chat_sessions')
          .insert({ user_id: userId })
          .select()
          .single()

        return res.status(200).json({ success: true, sessionId: data.id })
      }

      // Save message
      if (action === 'save-message') {
        if (!sessionId || !role || !content || messageOrder === undefined) {
          return res.status(400).json({ error: 'Missing required fields for message' })
        }

        if (!['user', 'assistant'].includes(role)) {
          return res.status(400).json({ error: 'role must be "user" or "assistant"' })
        }

        const { data } = await supabase
          .from('chat_messages')
          .insert({
            chat_session_id: sessionId,
            role,
            content,
            message_order: messageOrder,
          })
          .select()
          .single()

        return res.status(200).json({ success: true, messageId: data.id })
      }

      // Save analysis
      if (action === 'save-analysis') {
        if (!sessionId || !analysisText) {
          return res.status(400).json({ error: 'sessionId and analysisText are required' })
        }

        const { data } = await supabase
          .from('chat_analyses')
          .insert({
            chat_session_id: sessionId,
            analysis_text: analysisText,
            competency_scores: competencyScores || null,
          })
          .select()
          .single()

        return res.status(200).json({ success: true, analysisId: data.id })
      }

      return res.status(400).json({ error: 'Invalid action' })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE - Soft delete chat session
  if (req.method === 'DELETE') {
    const { sessionId, userId } = req.body

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'sessionId and userId are required' })
    }

    try {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single()

      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' })
      }

      if (session.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      await supabase
        .from('chat_sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId)

      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

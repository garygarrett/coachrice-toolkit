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

  const { sessionId, role, content, messageOrder } = req.body

  if (!sessionId || !role || !content || messageOrder === undefined) {
    return res.status(400).json({ error: 'sessionId, role, content, and messageOrder are required' })
  }

  if (!['user', 'assistant'].includes(role)) {
    return res.status(400).json({ error: 'role must be "user" or "assistant"' })
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        chat_session_id: sessionId,
        role,
        content,
        message_order: messageOrder,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ success: true, messageId: data.id })
  } catch (err) {
    console.error('Error saving chat message:', err)
    return res.status(500).json({ error: err.message })
  }
}

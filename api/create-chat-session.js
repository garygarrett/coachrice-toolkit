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

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: userId })
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ success: true, sessionId: data.id })
  } catch (err) {
    console.error('Error creating chat session:', err)
    return res.status(500).json({ error: err.message })
  }
}

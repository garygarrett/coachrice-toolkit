import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, role } = req.body

  if (!userId || !role) {
    return res.status(400).json({ error: 'userId and role are required' })
  }

  if (!['admin', 'coach'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    // Use service role key for privileged operation
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

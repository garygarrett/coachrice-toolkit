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

  const { userId, viewingUserId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    let query = supabase
      .from('exam_attempts')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Users can only see their own; admins can see anyone's
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (user?.role !== 'admin' && viewingUserId && viewingUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // If viewing specific user's data, filter by that user
    if (viewingUserId) {
      query = query.eq('user_id', viewingUserId)
    } else {
      // If not specified, show current user's
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) throw error

    return res.status(200).json({ data })
  } catch (err) {
    console.error('Error fetching exam attempts:', err)
    return res.status(500).json({ error: err.message })
  }
}

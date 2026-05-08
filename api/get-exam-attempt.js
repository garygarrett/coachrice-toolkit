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

  const { attemptId, userId } = req.query

  if (!attemptId || !userId) {
    return res.status(400).json({ error: 'attemptId and userId are required' })
  }

  try {
    // Get the exam attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', attemptId)
      .is('deleted_at', null)
      .single()

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Exam attempt not found' })
    }

    // Check permissions
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (user?.role !== 'admin' && attempt.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Get the answers
    const { data: answers, error: answersError } = await supabase
      .from('exam_answers')
      .select('*')
      .eq('exam_attempt_id', attemptId)
      .order('id')

    if (answersError) throw answersError

    return res.status(200).json({ attempt, answers })
  } catch (err) {
    console.error('Error fetching exam attempt:', err)
    return res.status(500).json({ error: err.message })
  }
}

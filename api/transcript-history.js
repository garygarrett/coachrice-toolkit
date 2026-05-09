import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // GET - Fetch transcript analyses
  if (req.method === 'GET') {
    const { userId, analysisId, viewingUserId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Get specific analysis with full content
    if (analysisId) {
      try {
        const { data: analysis } = await supabase
          .from('transcript_analyses')
          .select('*')
          .eq('id', analysisId)
          .is('deleted_at', null)
          .single()

        if (!analysis) {
          return res.status(404).json({ error: 'Analysis not found' })
        }

        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (user?.role !== 'admin' && analysis.user_id !== userId) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        return res.status(200).json(analysis)
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // Get all analyses for user
    try {
      let query = supabase
        .from('transcript_analyses')
        .select('id, created_at, competency_scores')
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

  // POST - Save transcript analysis
  if (req.method === 'POST') {
    const { userId, analysisText, competencyScores } = req.body

    if (!userId || !analysisText) {
      return res.status(400).json({ error: 'userId and analysisText are required' })
    }

    try {
      const { data } = await supabase
        .from('transcript_analyses')
        .insert({
          user_id: userId,
          analysis_text: analysisText,
          competency_scores: competencyScores || null,
        })
        .select()
        .single()

      return res.status(200).json({ success: true, analysisId: data.id })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE - Soft delete transcript analysis
  if (req.method === 'DELETE') {
    const { analysisId, userId } = req.query

    if (!analysisId || !userId) {
      return res.status(400).json({ error: 'analysisId and userId are required' })
    }

    try {
      const { data: analysis } = await supabase
        .from('transcript_analyses')
        .select('user_id')
        .eq('id', analysisId)
        .single()

      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' })
      }

      // Allow deletion if user owns it or requester is admin
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (user?.role !== 'admin' && analysis.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      await supabase
        .from('transcript_analyses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', analysisId)

      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

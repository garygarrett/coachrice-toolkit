import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // GET - Fetch internal assessments
  if (req.method === 'GET') {
    const { userId, assessmentId, viewingUserId, assessorType } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Get specific assessment with full data
    if (assessmentId) {
      try {
        const { data: assessment } = await supabase
          .from('internal_assessments')
          .select('*')
          .eq('id', assessmentId)
          .is('deleted_at', null)
          .single()

        if (!assessment) {
          return res.status(404).json({ error: 'Assessment not found' })
        }

        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (user?.role !== 'admin' && assessment.user_id !== userId) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        return res.status(200).json(assessment)
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // Get all assessments for user
    try {
      let query = supabase
        .from('internal_assessments')
        .select('id, created_at, assessor_type, transcript_filename, competency_scores')
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

      if (assessorType) {
        query = query.eq('assessor_type', assessorType)
      }

      const { data } = await query
      return res.status(200).json({ data })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST - Save internal assessment
  if (req.method === 'POST') {
    const { userId, assessorType, transcriptFilename, assessmentData, competencyScores } = req.body

    if (!userId || !assessorType || !assessmentData) {
      return res.status(400).json({ error: 'userId, assessorType, and assessmentData are required' })
    }

    try {
      const { data } = await supabase
        .from('internal_assessments')
        .insert({
          user_id: userId,
          assessor_type: assessorType,
          transcript_filename: transcriptFilename || null,
          assessment_data: assessmentData,
          competency_scores: competencyScores || null,
        })
        .select()
        .single()

      return res.status(200).json({ success: true, assessmentId: data.id })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE - Soft delete internal assessment
  if (req.method === 'DELETE') {
    const { assessmentId, userId } = req.query

    if (!assessmentId || !userId) {
      return res.status(400).json({ error: 'assessmentId and userId are required' })
    }

    try {
      const { data: assessment } = await supabase
        .from('internal_assessments')
        .select('user_id')
        .eq('id', assessmentId)
        .single()

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' })
      }

      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (user?.role !== 'admin' && assessment.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      await supabase
        .from('internal_assessments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', assessmentId)

      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

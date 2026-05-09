import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // GET - Fetch exam attempts or specific attempt
  if (req.method === 'GET') {
    const { userId, attemptId, viewingUserId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Get specific attempt with answers
    if (attemptId) {
      try {
        const { data: attempt } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('id', attemptId)
          .is('deleted_at', null)
          .single()

        if (!attempt) {
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

        const { data: answers } = await supabase
          .from('exam_answers')
          .select('*')
          .eq('exam_attempt_id', attemptId)
          .order('id')

        // Fetch full question data for each answer
        const { data: questionIds } = await supabase
          .from('questions')
          .select('id, question, competency, option_a, option_b, option_c, option_d, correct, explanation')
          .in('id', answers.map(a => a.question_id))

        const questionsMap = {}
        if (questionIds) {
          questionIds.forEach(q => { questionsMap[q.id] = q })
        }

        const scored = answers.map(ans => ({
          ...questionsMap[ans.question_id],
          options: {
            A: questionsMap[ans.question_id]?.option_a,
            B: questionsMap[ans.question_id]?.option_b,
            C: questionsMap[ans.question_id]?.option_c,
            D: questionsMap[ans.question_id]?.option_d,
          },
          userAnswer: ans.user_answer,
          isCorrect: ans.is_correct,
        }))

        return res.status(200).json({ attempt, answers: scored })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // Get all attempts for user
    try {
      let query = supabase
        .from('exam_attempts')
        .select('*')
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

  // POST - Save exam attempt
  if (req.method === 'POST') {
    const { userId, overallScore, totalQuestions, correctAnswers, answers } = req.body

    if (!userId || overallScore === undefined || !totalQuestions || !answers) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const { data: attempt } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: userId,
          overall_score: overallScore,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
        })
        .select()
        .single()

      if (!attempt) throw new Error('Failed to create attempt')

      const answersToInsert = answers.map(ans => ({
        exam_attempt_id: attempt.id,
        question_id: ans.question_id,
        user_answer: ans.user_answer,
        correct_answer: ans.correct_answer,
        is_correct: ans.is_correct,
      }))

      const { error: answersError } = await supabase
        .from('exam_answers')
        .insert(answersToInsert)

      if (answersError) throw answersError

      return res.status(200).json({ success: true, attemptId: attempt.id })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE - Soft delete exam attempt
  if (req.method === 'DELETE') {
    const { attemptId, userId } = req.query

    if (!attemptId || !userId) {
      return res.status(400).json({ error: 'attemptId and userId are required' })
    }

    try {
      const { data: attempt } = await supabase
        .from('exam_attempts')
        .select('user_id')
        .eq('id', attemptId)
        .single()

      if (!attempt) {
        return res.status(404).json({ error: 'Exam attempt not found' })
      }

      // Allow deletion if user owns it or requester is admin
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (user?.role !== 'admin' && attempt.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      await supabase
        .from('exam_attempts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', attemptId)

      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

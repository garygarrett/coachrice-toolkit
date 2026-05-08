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

  const { userId, overallScore, totalQuestions, correctAnswers, answers } = req.body

  if (!userId || overallScore === undefined || !totalQuestions || !answers) {
    return res.status(400).json({ error: 'userId, overallScore, totalQuestions, and answers are required' })
  }

  try {
    // Insert exam attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: userId,
        overall_score: overallScore,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
      })
      .select()
      .single()

    if (attemptError) throw attemptError

    // Insert exam answers
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
    console.error('Error saving exam attempt:', err)
    return res.status(500).json({ error: err.message })
  }
}

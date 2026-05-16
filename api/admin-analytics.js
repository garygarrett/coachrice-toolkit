import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { type, viewingUserId, userId, cohortId, mentorCoachId } = req.query

  if (!viewingUserId) {
    return res.status(400).json({ error: 'viewingUserId is required' })
  }

  try {
    // Verify viewing user is admin
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', viewingUserId)
      .single()

    if (adminUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // SUMMARY - all coaches, cohorts, mentor coaches with counts
    if (type === 'summary') {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, created_at, last_accessed_at, cohort_id, mentor_coach_id, cohorts(name), mentor_coaches(full_name)')
        .in('role', ['coach', 'admin'])
        .order('full_name')

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, user_id, tool, created_at')

      const { data: exams } = await supabase
        .from('exam_attempts')
        .select('id, user_id, overall_score, total_questions, created_at')

      // Aggregate data in JS
      const coachStats = {}
      users?.forEach(u => {
        coachStats[u.id] = {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          cohort_id: u.cohort_id,
          cohort_name: u.cohorts?.name || 'Unassigned',
          mentor_coach_id: u.mentor_coach_id,
          mentor_coach_name: u.mentor_coaches?.full_name || 'Unassigned',
          created_at: u.created_at,
          last_accessed_at: u.last_accessed_at,
          total_sessions: 0,
          exam_count: 0,
          avg_exam_score: 0,
          tools_used: new Set(),
          last_tool_used: null,
        }
      })

      sessions?.forEach(s => {
        if (coachStats[s.user_id]) {
          coachStats[s.user_id].total_sessions += 1
          coachStats[s.user_id].tools_used.add(s.tool)
          if (!coachStats[s.user_id].last_tool_used || new Date(s.created_at) > new Date(coachStats[s.user_id].last_tool_used)) {
            coachStats[s.user_id].last_tool_used = s.created_at
          }
        }
      })

      exams?.forEach(e => {
        if (coachStats[e.user_id]) {
          coachStats[e.user_id].exam_count += 1
          const currentTotal = coachStats[e.user_id].avg_exam_score * (coachStats[e.user_id].exam_count - 1)
          coachStats[e.user_id].avg_exam_score = Math.round((currentTotal + (e.overall_score || 0)) / coachStats[e.user_id].exam_count)
        }
      })

      // Convert Sets to arrays
      const coaches = Object.values(coachStats).map(c => ({
        ...c,
        tools_used: Array.from(c.tools_used),
      }))

      // Get cohorts
      const { data: cohorts } = await supabase
        .from('cohorts')
        .select('id, name')
        .order('name')

      const cohortStats = {}
      cohorts?.forEach(c => {
        cohortStats[c.id] = {
          id: c.id,
          name: c.name,
          coach_count: coaches.filter(co => co.cohort_id === c.id).length,
        }
      })

      // Get mentor coaches
      const { data: mentorCoaches } = await supabase
        .from('mentor_coaches')
        .select('id, full_name')
        .order('full_name')

      const mentorStats = {}
      mentorCoaches?.forEach(m => {
        mentorStats[m.id] = {
          id: m.id,
          full_name: m.full_name,
          coach_count: coaches.filter(co => co.mentor_coach_id === m.id).length,
        }
      })

      return res.status(200).json({
        coaches,
        cohorts: Object.values(cohortStats),
        mentor_coaches: Object.values(mentorStats),
      })
    }

    // USER DETAIL - one coach's full analytics
    if (type === 'user' && userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id, full_name, email, created_at, last_accessed_at, cohort_id, mentor_coach_id, cohorts(name), mentor_coaches(full_name)')
        .eq('id', userId)
        .in('role', ['coach', 'admin'])
        .single()

      if (!user) {
        return res.status(404).json({ error: 'Coach not found' })
      }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, user_id, tool, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const { data: exams } = await supabase
        .from('exam_attempts')
        .select('id, overall_score, total_questions, correct_answers, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const { data: competencies } = await supabase
        .from('competency_scores')
        .select('id, competency, proficiency_numeric, proficiency_level, score_category, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      return res.status(200).json({
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          cohort_name: user.cohorts?.name || 'Unassigned',
          mentor_coach_name: user.mentor_coaches?.full_name || 'Unassigned',
          created_at: user.created_at,
          last_accessed_at: user.last_accessed_at,
        },
        sessions: sessions || [],
        exams: exams || [],
        competencies: competencies || [],
      })
    }

    // COHORT DETAIL - aggregate stats for a cohort
    if (type === 'cohort' && cohortId) {
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('id, name')
        .eq('id', cohortId)
        .single()

      if (!cohort) {
        return res.status(404).json({ error: 'Cohort not found' })
      }

      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, created_at, last_accessed_at')
        .eq('cohort_id', cohortId)
        .in('role', ['coach', 'admin'])

      const { data: sessions } = await supabase
        .from('sessions')
        .select('user_id, tool, created_at')
        .in('user_id', users?.map(u => u.id) || [])

      const { data: exams } = await supabase
        .from('exam_attempts')
        .select('user_id, overall_score')
        .in('user_id', users?.map(u => u.id) || [])

      const { data: competencies } = await supabase
        .from('competency_scores')
        .select('competency, proficiency_numeric')
        .in('user_id', users?.map(u => u.id) || [])

      // Aggregate stats per coach
      const coachStats = {}
      users?.forEach(u => {
        coachStats[u.id] = {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          created_at: u.created_at,
          last_accessed_at: u.last_accessed_at,
          total_sessions: 0,
          exam_count: 0,
          avg_exam_score: 0,
        }
      })

      sessions?.forEach(s => {
        if (coachStats[s.user_id]) {
          coachStats[s.user_id].total_sessions += 1
        }
      })

      exams?.forEach(e => {
        if (coachStats[e.user_id]) {
          coachStats[e.user_id].exam_count += 1
          const currentTotal = coachStats[e.user_id].avg_exam_score * (coachStats[e.user_id].exam_count - 1)
          coachStats[e.user_id].avg_exam_score = Math.round((currentTotal + (e.overall_score || 0)) / coachStats[e.user_id].exam_count)
        }
      })

      // Compute average competencies
      const compAvg = {}
      const ICF_COMPETENCIES = [
        'Demonstrates Ethical Practice',
        'Embodies a Coaching Mindset',
        'Establishes and Maintains Agreements',
        'Cultivates Trust and Safety',
        'Maintains Presence',
        'Listens Actively',
        'Evokes Awareness',
        'Facilitates Client Growth',
      ]
      ICF_COMPETENCIES.forEach(c => {
        const scores = competencies?.filter(comp => comp.competency === c).map(comp => comp.proficiency_numeric) || []
        compAvg[c] = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0
      })

      return res.status(200).json({
        cohort: { id: cohort.id, name: cohort.name },
        coaches: Object.values(coachStats),
        avg_competencies: compAvg,
      })
    }

    // MENTOR COACH DETAIL - same as cohort but for mentor coach's group
    if (type === 'mentorCoach' && mentorCoachId) {
      const { data: mentorCoach } = await supabase
        .from('mentor_coaches')
        .select('id, full_name')
        .eq('id', mentorCoachId)
        .single()

      if (!mentorCoach) {
        return res.status(404).json({ error: 'Mentor coach not found' })
      }

      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, created_at, last_accessed_at')
        .eq('mentor_coach_id', mentorCoachId)
        .in('role', ['coach', 'admin'])

      const { data: sessions } = await supabase
        .from('sessions')
        .select('user_id, tool, created_at')
        .in('user_id', users?.map(u => u.id) || [])

      const { data: exams } = await supabase
        .from('exam_attempts')
        .select('user_id, overall_score')
        .in('user_id', users?.map(u => u.id) || [])

      const { data: competencies } = await supabase
        .from('competency_scores')
        .select('competency, proficiency_numeric')
        .in('user_id', users?.map(u => u.id) || [])

      // Same aggregation as cohort
      const coachStats = {}
      users?.forEach(u => {
        coachStats[u.id] = {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          created_at: u.created_at,
          last_accessed_at: u.last_accessed_at,
          total_sessions: 0,
          exam_count: 0,
          avg_exam_score: 0,
        }
      })

      sessions?.forEach(s => {
        if (coachStats[s.user_id]) {
          coachStats[s.user_id].total_sessions += 1
        }
      })

      exams?.forEach(e => {
        if (coachStats[e.user_id]) {
          coachStats[e.user_id].exam_count += 1
          const currentTotal = coachStats[e.user_id].avg_exam_score * (coachStats[e.user_id].exam_count - 1)
          coachStats[e.user_id].avg_exam_score = Math.round((currentTotal + (e.overall_score || 0)) / coachStats[e.user_id].exam_count)
        }
      })

      const compAvg = {}
      const ICF_COMPETENCIES = [
        'Demonstrates Ethical Practice',
        'Embodies a Coaching Mindset',
        'Establishes and Maintains Agreements',
        'Cultivates Trust and Safety',
        'Maintains Presence',
        'Listens Actively',
        'Evokes Awareness',
        'Facilitates Client Growth',
      ]
      ICF_COMPETENCIES.forEach(c => {
        const scores = competencies?.filter(comp => comp.competency === c).map(comp => comp.proficiency_numeric) || []
        compAvg[c] = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0
      })

      return res.status(200).json({
        mentor_coach: { id: mentorCoach.id, full_name: mentorCoach.full_name },
        coaches: Object.values(coachStats),
        avg_competencies: compAvg,
      })
    }

    return res.status(400).json({ error: 'Invalid query type' })
  } catch (error) {
    console.error('Analytics error:', error)
    return res.status(500).json({ error: error.message })
  }
}

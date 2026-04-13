import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check env vars and surface the problem clearly if missing
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Server misconfiguration: missing Supabase env vars',
      missing: { supabaseUrl: !supabaseUrl, serviceRoleKey: !serviceRoleKey },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { email, full_name, role, cohort_id, mentor_coach_id } = req.body

  if (!email || !full_name || !role) {
    return res.status(400).json({ error: 'email, full_name, and role are required' })
  }

  const siteUrl = process.env.SITE_URL ?? 'https://coachrice-toolkit.vercel.app'

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${siteUrl}/set-password`,
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  const updates = {}
  if (cohort_id) updates.cohort_id = cohort_id
  if (mentor_coach_id) updates.mentor_coach_id = mentor_coach_id

  if (Object.keys(updates).length > 0) {
    await supabase.from('users').update(updates).eq('id', data.user.id)
  }

  return res.status(200).json({ success: true })
}

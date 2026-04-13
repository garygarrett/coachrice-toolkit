import { createClient } from '@supabase/supabase-js'

// This runs on the server (Vercel), so the service role key is never exposed to the browser.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, full_name, role, cohort_id, mentor_coach_id } = req.body

  if (!email || !full_name || !role) {
    return res.status(400).json({ error: 'email, full_name, and role are required' })
  }

  // Send the invite email. Supabase creates the auth user and triggers our
  // handle_new_user() function to create the public.users profile row.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  // Update cohort and mentor coach on the newly created profile row
  const updates = {}
  if (cohort_id) updates.cohort_id = cohort_id
  if (mentor_coach_id) updates.mentor_coach_id = mentor_coach_id

  if (Object.keys(updates).length > 0) {
    await supabase.from('users').update(updates).eq('id', data.user.id)
  }

  return res.status(200).json({ success: true })
}

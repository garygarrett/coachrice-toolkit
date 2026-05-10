import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { userId, full_name, role, email, cohort_id, mentor_coach_id, is_active } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  // Build the profile update
  const profileUpdates = {}
  if (full_name !== undefined) profileUpdates.full_name = full_name
  if (role !== undefined) profileUpdates.role = role
  if (email !== undefined) profileUpdates.email = email
  if (cohort_id !== undefined) profileUpdates.cohort_id = cohort_id || null
  if (mentor_coach_id !== undefined) profileUpdates.mentor_coach_id = mentor_coach_id || null
  if (is_active !== undefined) profileUpdates.is_active = is_active

  const { error: profileError } = await supabase
    .from('users')
    .update(profileUpdates)
    .eq('id', userId)

  if (profileError) {
    return res.status(400).json({ error: profileError.message })
  }

  // Update auth email if provided
  if (email !== undefined) {
    const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
      email: email,
    })
    if (emailError) {
      return res.status(400).json({ error: `Email update failed: ${emailError.message}` })
    }
  }

  // Sync role change to auth user metadata
  if (role !== undefined || full_name !== undefined) {
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role, full_name },
    })
  }

  // Pause or unpause: set Supabase ban_duration
  if (is_active !== undefined) {
    const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: is_active ? 'none' : '876000h',
    })
    if (banError) {
      return res.status(400).json({ error: banError.message })
    }
  }

  return res.status(200).json({ success: true })
}

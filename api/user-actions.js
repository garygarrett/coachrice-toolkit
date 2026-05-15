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
  const { action } = req.query

  if (!action) {
    return res.status(400).json({ error: 'action is required' })
  }

  // UPDATE PROFILE - Update user profile fields
  if (action === 'profile') {
    try {
      const { userId, full_name, email, role, cohort_id, mentor_coach_id, is_active } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      // Build the profile update
      const profileUpdates = {}
      if (full_name !== undefined) profileUpdates.full_name = full_name
      if (email !== undefined) profileUpdates.email = email
      if (role !== undefined) profileUpdates.role = role
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

      // Sync profile changes to auth user metadata
      if (full_name !== undefined || role !== undefined) {
        const metadata = {}
        if (full_name !== undefined) metadata.full_name = full_name
        if (role !== undefined) metadata.role = role
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: metadata,
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
    } catch (error) {
      console.error('Profile update error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // UPDATE ROLE - Update user role
  if (action === 'role') {
    try {
      const { userId, role } = req.body

      if (!userId || !role) {
        return res.status(400).json({ error: 'userId and role are required' })
      }

      if (!['admin', 'coach'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId)

      if (error) {
        return res.status(400).json({ error: error.message })
      }

      // Sync role to auth user metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { role },
      })

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Role update error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // UPDATE LAST ACCESSED - Update last_accessed_at timestamp
  if (action === 'last-accessed') {
    try {
      const { userId } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      const { error } = await supabase
        .from('users')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Last accessed update error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(400).json({ error: 'Invalid action' })
}

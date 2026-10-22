import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requireUser } from '../server/auth.js'

const API_KEY_NAMES = [
  'api_key_chatbot',
  'api_key_feedback',
  'api_key_assessor',
  'api_key_assessor_2025',
  'api_key_transcript',
  'api_key_audio',
]

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

  // UPDATE PROFILE - Update user profile fields (admin only)
  if (action === 'profile') {
    if (!(await requireAdmin(req, res, supabase))) return
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

  // UPDATE ROLE - Update user role (admin only)
  if (action === 'role') {
    if (!(await requireAdmin(req, res, supabase))) return
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
  // Any signed-in user may call this, but only for their own account.
  if (action === 'last-accessed') {
    const auth = await requireUser(req, res, supabase)
    if (!auth) return
    try {
      const { userId } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      if (userId !== auth.user.id) {
        return res.status(403).json({ error: 'You can only update your own record' })
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

  // API KEY STATUS - Which AI keys are saved? Returns true/false only, never the key itself (admin only)
  if (action === 'api-key-status') {
    if (!(await requireAdmin(req, res, supabase))) return
    const { data, error } = await supabase
      .from('config')
      .select('key, value')
      .in('key', API_KEY_NAMES)
    if (error) return res.status(500).json({ error: error.message })
    const set = {}
    API_KEY_NAMES.forEach(k => { set[k] = false })
    ;(data || []).forEach(r => { set[r.key] = !!(r.value && String(r.value).trim()) })
    return res.status(200).json({ set })
  }

  // API KEY SAVE - Write one AI key to the config table (admin only, write-only)
  if (action === 'api-key-save') {
    if (!(await requireAdmin(req, res, supabase))) return
    const { key, value } = req.body || {}
    if (!API_KEY_NAMES.includes(key)) {
      return res.status(400).json({ error: 'Unknown key name' })
    }
    if (typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({ error: 'value is required' })
    }
    const { error } = await supabase
      .from('config')
      .upsert({ key, value: value.trim() }, { onConflict: 'key' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Invalid action' })
}

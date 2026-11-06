import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requireUser, requireCaller } from '../server/auth.js'

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

  // ---- Audio to Transcript (admin only for now) ----

  // AUDIO TOKEN - Hands the browser a short-lived Deepgram token so the audio
  // goes straight from the browser to Deepgram. Our server never sees the audio,
  // and the real Deepgram key never leaves the server.
  if (action === 'audio-token') {
    const caller = await requireCaller(req, res, supabase, { codeRoles: ['admin'] })
    if (!caller) return
    const { data: row } = await supabase.from('config').select('value').eq('key', 'api_key_audio').maybeSingle()
    const key = row?.value && String(row.value).trim()
    if (!key) {
      return res.status(500).json({ error: 'No Deepgram key saved yet. Add it in Admin > Audio to Transcript.' })
    }
    try {
      const dg = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl_seconds: 3600 }),
      })
      const text = await dg.text()
      if (!dg.ok) {
        console.error('[audio-token] Deepgram refused:', dg.status, text.slice(0, 200))
        return res.status(502).json({ error: `Deepgram refused the key (status ${dg.status}). Check the key and its permissions.` })
      }
      const body = JSON.parse(text)
      if (caller.kind === 'code') {
        try { await supabase.from('access_code_events').insert({ access_code_id: caller.code.id, tool: 'audio' }) } catch { /* counting must never block */ }
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ token: body.access_token, expiresIn: body.expires_in })
    } catch (err) {
      console.error('[audio-token] failed:', err.message)
      return res.status(502).json({ error: 'Could not reach Deepgram' })
    }
  }

  // AUDIO SAVE - Save the edited transcript text (never audio)
  if (action === 'audio-save') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['admin'] })
    if (!auth) return
    const { title, transcriptText, turns, speakerNames, durationSeconds } = req.body || {}
    if (typeof transcriptText !== 'string' || !transcriptText.trim()) {
      return res.status(400).json({ error: 'transcriptText is required' })
    }
    if (transcriptText.length > 2000000) {
      return res.status(400).json({ error: 'Transcript is too large' })
    }
    const { data, error } = await supabase
      .from('audio_transcripts')
      .insert({
        [auth.owner.column]: auth.owner.value,
        title: String(title || 'Untitled transcript').slice(0, 200),
        transcript_text: transcriptText,
        turns: Array.isArray(turns) ? turns : null,
        speaker_names: speakerNames && typeof speakerNames === 'object' ? speakerNames : null,
        duration_seconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, id: data.id })
  }

  // AUDIO LIST - Your saved transcripts (titles only)
  if (action === 'audio-list') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['admin'] })
    if (!auth) return
    const { data, error } = await supabase
      .from('audio_transcripts')
      .select('id, title, duration_seconds, created_at')
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  // AUDIO GET - One saved transcript, full content
  if (action === 'audio-get') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['admin'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('audio_transcripts')
      .select('*')
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Transcript not found' })
    return res.status(200).json(data)
  }

  // AUDIO DELETE - Soft delete one of your transcripts
  if (action === 'audio-delete') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['admin'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase
      .from('audio_transcripts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // OBSERVATION DRAFTS - Session Observation Form work in progress (text and answers only, never audio).
  // Deleting one removes it for good.
  if (action === 'obs-save') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['mentor', 'admin'] })
    if (!auth) return
    const { id, title, data } = req.body || {}
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data is required' })
    if (JSON.stringify(data).length > 3000000) return res.status(400).json({ error: 'This observation is too large to save' })
    const cleanTitle = String(title || 'Untitled observation').slice(0, 200)
    if (id) {
      const { data: row, error } = await supabase
        .from('observation_drafts')
        .update({ title: cleanTitle, data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq(auth.owner.column, auth.owner.value)
        .is('deleted_at', null)
        .select('id, updated_at')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!row) return res.status(404).json({ error: 'Saved observation not found' })
      return res.status(200).json({ success: true, id: row.id, updatedAt: row.updated_at })
    }
    const { data: row, error } = await supabase
      .from('observation_drafts')
      .insert({ [auth.owner.column]: auth.owner.value, title: cleanTitle, data })
      .select('id, updated_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, id: row.id, updatedAt: row.updated_at })
  }

  if (action === 'obs-list') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['mentor', 'admin'] })
    if (!auth) return
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, title, updated_at')
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (action === 'obs-get') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['mentor', 'admin'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, title, data, updated_at')
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Saved observation not found' })
    return res.status(200).json(data)
  }

  if (action === 'obs-delete') {
    const auth = await requireCaller(req, res, supabase, { codeRoles: ['mentor', 'admin'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase
      .from('observation_drafts')
      .delete()
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // DATA PURGE (admin accounts only, never access codes). Deletes for good: there is no undo.
  // Each group lists its tables child-first so rows that depend on others go first.
  if (action === 'purge-counts' || action === 'purge-data' || action === 'purge-code') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return

    const GROUPS = {
      observation: { label: 'Session Observation Form drafts', tables: ['observation_drafts'] },
      audio: { label: 'Saved audio transcripts', tables: ['audio_transcripts'] },
      assessments: { label: 'Internal Assessor results', tables: ['internal_assessments'] },
      reviews: { label: 'Transcript Reviewer results (accounts and access codes)', tables: ['transcript_analyses', 'guest_analyses'] },
      chats: { label: 'AI Client chats, messages and feedback', tables: ['chat_messages', 'chat_analyses', 'chat_sessions'] },
      exams: { label: 'Practice exam attempts and answers', tables: ['exam_answers', 'exam_attempts'] },
      scores: { label: 'Competency scores and session records (feed analytics and flags)', tables: ['competency_scores', 'sessions'] },
    }
    const ORDER = ['scores', 'reviews', 'exams', 'chats', 'audio', 'assessments', 'observation']

    const countOf = async (table) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return error ? null : count
    }
    const wipe = async (table) => {
      const before = await countOf(table)
      const { error } = await supabase.from(table).delete().not('id', 'is', null)
      return { table, before, error: error ? error.message : null }
    }

    if (action === 'purge-counts') {
      const out = []
      for (const key of ORDER) {
        const counts = {}
        for (const t of GROUPS[key].tables) counts[t] = await countOf(t)
        out.push({ key, label: GROUPS[key].label, counts })
      }
      return res.status(200).json({ groups: out })
    }

    if (action === 'purge-data') {
      const { groups, confirm } = req.body || {}
      if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' })
      if (!Array.isArray(groups) || !groups.length || groups.some((g) => !GROUPS[g])) {
        return res.status(400).json({ error: 'Choose at least one valid data group' })
      }
      const chosen = ORDER.filter((k) => groups.includes(k))
      let results = []
      for (const key of chosen) for (const t of GROUPS[key].tables) results.push(await wipe(t))
      // A table that was blocked by another table's rows gets one more try after the rest are gone.
      const retried = []
      for (const r of results) retried.push(r.error ? { ...(await wipe(r.table)), before: r.before } : r)
      results = retried
      console.log(`[purge] admin ${auth.user.id} purged: ${chosen.join(', ')}`)
      return res.status(200).json({ results })
    }

    // purge-code: everything a single access code saved (drafts, transcripts, assessments)
    const { codeId, confirm } = req.body || {}
    if (!codeId) return res.status(400).json({ error: 'codeId is required' })
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' })
    const results = []
    for (const table of ['observation_drafts', 'audio_transcripts', 'internal_assessments']) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('access_code_id', codeId)
      const { error } = await supabase.from(table).delete().eq('access_code_id', codeId)
      results.push({ table, before: count ?? null, error: error ? error.message : null })
    }
    console.log(`[purge] admin ${auth.user.id} purged saved data of access code ${codeId}`)
    return res.status(200).json({ results })
  }

  return res.status(400).json({ error: 'Invalid action' })
}

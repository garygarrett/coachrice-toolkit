import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { requireAdmin, requireUser, requireCaller, lookupCode } from '../server/auth.js'

const API_KEY_NAMES = [
  'api_key_chatbot',
  'api_key_feedback',
  'api_key_assessor',
  'api_key_assessor_2025',
  'api_key_transcript',
  'api_key_audio',
]

// Prompts that signed-out access-code users may read (never api_key_* rows).
const CODE_PROMPT_KEYS = ['ai_assessor_prompt', 'ai_assessor_2025_prompt', 'transcript_reviewer_prompt']

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

  // CODE PROMPTS - Hands signed-in tool accounts and student-code users the saved prompts from the
  // admin panel, whatever the database rules say. Only these prompt keys are returned, never API keys.
  if (action === 'code-prompts') {
    if (req.headers.authorization || req.headers.Authorization) {
      if (!(await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] }))) return
    } else {
      const found = await lookupCode(supabase, req.headers['x-access-code'] || req.body?.accessCode, ['student'])
      if (found.error) return res.status(found.status).json({ error: found.error })
    }
    const { data, error } = await supabase
      .from('config')
      .select('key, value')
      .in('key', CODE_PROMPT_KEYS)
    if (error) return res.status(500).json({ error: 'Could not load the saved prompts' })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ prompts: Object.fromEntries((data || []).map((r) => [r.key, r.value])) })
  }

  // CODE CHECK - Step 1 of first-time sign-up: is this a mentor-coach or admin code that can still be used?
  // It does not use the code up. It only says which kind of account the code creates.
  if (action === 'code-check') {
    const found = await lookupCode(supabase, req.body?.code, ['mentor', 'admin'])
    if (found.error) return res.status(found.status).json({ error: found.error })
    return res.status(200).json({ valid: true, role: found.code.role })
  }

  // CODE SIGNUP - Step 2: create the account. A mentor/admin code works exactly once.
  //   mentor code -> role 'mentor' (Session Observation Form only)
  //   admin code  -> role 'admin_tools' (Internal Assessor, Audio to Transcript, Session Observation Form)
  if (action === 'code-signup') {
    const { code, email, password } = req.body || {}
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Your password must be at least 8 characters' })
    }
    const found = await lookupCode(supabase, code, ['mentor', 'admin'])
    if (found.error) return res.status(found.status).json({ error: found.error })
    const role = found.code.role === 'admin' ? 'admin_tools' : 'mentor'

    // Claim the code first (only if nobody else did), so two people cannot both use it.
    const { data: claimed } = await supabase
      .from('access_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', found.code.id)
      .is('used_at', null)
      .select('id')
    if (!claimed?.length) return res.status(403).json({ error: 'That access code has already been used' })
    const release = () => supabase.from('access_codes').update({ used_at: null, used_by: null }).eq('id', found.code.id)

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true, // no email check; an admin can fix a mistyped email in the admin panel
      user_metadata: { full_name: found.code.label, role },
    })
    if (createError || !created?.user) {
      await release()
      const taken = /already|registered|exists/i.test(createError?.message || '')
      return res.status(taken ? 409 : 400).json({
        error: taken ? 'An account with that email already exists. Use returning sign-in instead.' : (createError?.message || 'Could not create the account'),
      })
    }
    const userId = created.user.id

    const { error: profileError } = await supabase.from('users').upsert(
      { id: userId, email: cleanEmail, full_name: found.code.label, role, is_active: true, signup_code_id: found.code.id },
      { onConflict: 'id' }
    )
    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      await release()
      return res.status(500).json({ error: 'Could not finish creating the account. Please try again.' })
    }
    await supabase.from('access_codes').update({ used_by: userId }).eq('id', found.code.id)

    // Work that was saved under this code before accounts existed now belongs to the new account.
    for (const table of ['observation_drafts', 'audio_transcripts', 'internal_assessments']) {
      await supabase.from(table).update({ user_id: userId, access_code_id: null }).eq('access_code_id', found.code.id)
    }
    // Cohorts and participants an admin pre-assigned to this code now belong to the new account.
    // If this step fails the account still works; an admin can assign the participants by hand.
    try {
      const { data: pendingCohorts } = await supabase.from('observation_cohort_mentor_codes').select('cohort_id').eq('code_id', found.code.id)
      if ((pendingCohorts || []).length) {
        await supabase.from('observation_cohort_mentors').insert(pendingCohorts.map((r) => ({ cohort_id: r.cohort_id, user_id: userId })))
        await supabase.from('observation_cohort_mentor_codes').delete().eq('code_id', found.code.id)
      }
      await supabase.from('observation_participants').update({ mentor_id: userId, mentor_code_id: null }).eq('mentor_code_id', found.code.id)
    } catch (e) {
      console.error('[code-signup] could not move pre-assigned participants:', e?.message || e)
    }
    return res.status(200).json({ success: true, role })
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

      if (!['admin', 'coach', 'mentor', 'admin_tools'].includes(role)) {
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
    const caller = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] })
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
      if (caller.signupCodeId) {
        try { await supabase.from('access_code_events').insert({ access_code_id: caller.signupCodeId, tool: 'audio' }) } catch { /* counting must never block */ }
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
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] })
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
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] })
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
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] })
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
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools'] })
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
  // Checks that this caller may link an observation to this participant and form number (1 to 3).
  // Returns { columns } to write, or { status, error } to send back.
  async function resolveObservationLink(supabase, auth, link) {
    const formNumber = Number(link.formNumber)
    if (!Number.isInteger(formNumber) || formNumber < 1 || formNumber > 3) {
      return { status: 400, error: 'Choose Session Observation Form #1, #2, or #3' }
    }
    const { data: participant } = await supabase
      .from('observation_participants')
      .select('id, cohort_id, mentor_id')
      .eq('id', link.participantId)
      .maybeSingle()
    if (!participant) return { status: 404, error: 'That participant was not found. Ask an admin to check the cohort.' }
    // Each participant belongs to one mentor coach. Only that mentor coach (or a full admin) may link to them.
    if (auth.role !== 'admin' && participant.mentor_id !== auth.user.id) {
      return { status: 403, error: 'That participant is not assigned to you. Ask an admin to assign them.' }
    }
    return { columns: { cohort_id: participant.cohort_id, participant_id: participant.id, form_number: formNumber } }
  }

  // Change which participant and form number a saved observation is for (or unlink it with no participantId).
  // Only the person who owns the observation can do this. A form number the participant already has is refused (409).
  if (action === 'obs-link') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id, participantId, formNumber, title } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    let patch = { cohort_id: null, participant_id: null, form_number: null }
    if (participantId) {
      const resolved = await resolveObservationLink(supabase, auth, { participantId, formNumber })
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error })
      patch = resolved.columns
    }
    if (title) patch.title = String(title).slice(0, 200)
    patch.updated_at = new Date().toISOString()
    const { data: row, error } = await supabase
      .from('observation_drafts')
      .update(patch)
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .select('id, cohort_id, participant_id, form_number, updated_at')
      .maybeSingle()
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Session Observation Form #${patch.form_number} already exists for that participant. Choose a different form number.` })
      }
      return res.status(500).json({ error: error.message })
    }
    if (!row) return res.status(404).json({ error: 'Saved observation not found' })
    return res.status(200).json({ success: true, link: row })
  }

  if (action === 'obs-save') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id, title, data, link } = req.body || {}
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data is required' })
    if (JSON.stringify(data).length > 3000000) return res.status(400).json({ error: 'This observation is too large to save' })
    const cleanTitle = String(title || 'Untitled observation').slice(0, 200)
    if (id) {
      // Saves never change the participant link. To change it, use obs-link.
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
    // New observation. If it is for a cohort participant, check the caller may use that participant and form number.
    const insert = { [auth.owner.column]: auth.owner.value, title: cleanTitle, data }
    if (link && link.participantId) {
      const resolved = await resolveObservationLink(supabase, auth, link)
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error })
      Object.assign(insert, resolved.columns)
    }
    const { data: row, error } = await supabase
      .from('observation_drafts')
      .insert(insert)
      .select('id, updated_at')
      .single()
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Session Observation Form #${insert.form_number} already exists for that participant. Open the saved one instead.` })
      }
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ success: true, id: row.id, updatedAt: row.updated_at })
  }

  if (action === 'obs-list') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, title, updated_at, cohort_id, participant_id, form_number, form:data->form')
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (action === 'obs-get') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, title, data, updated_at, cohort_id, participant_id, form_number')
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Saved observation not found' })
    // The participant's name, so the observation can be named "<name> - Session Observation Form #n (...)"
    // even if this mentor coach is no longer assigned to that cohort.
    let participantName = ''
    if (data.participant_id) {
      const { data: person } = await supabase.from('observation_participants').select('full_name').eq('id', data.participant_id).maybeSingle()
      participantName = person?.full_name || ''
    }
    return res.status(200).json({ ...data, participant_name: participantName })
  }

  if (action === 'obs-delete') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
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

  // OBSERVATIONS, ADMIN VIEW - read-only. Full admins can list and open any mentor coach's saved
  // Session Observation Forms (in progress or complete). These two actions never change anything.
  if (action === 'obs-admin-list') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, title, created_at, updated_at, form:data->form')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (action === 'obs-admin-get') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, user_id, title, data, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Saved observation not found' })
    const { data: owner } = await supabase.from('users').select('full_name, email, role').eq('id', data.user_id).maybeSingle()
    return res.status(200).json({ ...data, owner: owner || null })
  }

  // COMPETENCY REVIEW FORM - the ICF form that sums up a participant's Session Observation Forms #1-#3.
  // One per participant. Same rules as observations: the participant's mentor coach (or a full admin) writes it,
  // saved work belongs to the account, and the full-admin view only reads.
  async function resolveReviewLink(supabase, auth, participantId) {
    const { data: participant } = await supabase
      .from('observation_participants')
      .select('id, cohort_id, mentor_id, full_name')
      .eq('id', participantId)
      .maybeSingle()
    if (!participant) return { status: 404, error: 'That participant was not found. Ask an admin to check the cohort.' }
    if (auth.role !== 'admin' && participant.mentor_id !== auth.user.id) {
      return { status: 403, error: 'That participant is not assigned to you. Ask an admin to assign them.' }
    }
    return { participant }
  }

  if (action === 'crf-save') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id, title, data, link } = req.body || {}
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data is required' })
    if (JSON.stringify(data).length > 500000) return res.status(400).json({ error: 'This review is too large to save' })
    const cleanTitle = String(title || 'Untitled competency review').slice(0, 200)
    if (id) {
      // Saves never change the participant link.
      const { data: row, error } = await supabase
        .from('competency_reviews')
        .update({ title: cleanTitle, data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq(auth.owner.column, auth.owner.value)
        .is('deleted_at', null)
        .select('id, updated_at')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!row) return res.status(404).json({ error: 'Saved review not found' })
      return res.status(200).json({ success: true, id: row.id, updatedAt: row.updated_at })
    }
    const insert = { [auth.owner.column]: auth.owner.value, title: cleanTitle, data }
    if (link && link.participantId) {
      const resolved = await resolveReviewLink(supabase, auth, link.participantId)
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error })
      insert.cohort_id = resolved.participant.cohort_id
      insert.participant_id = resolved.participant.id
    }
    const { data: row, error } = await supabase.from('competency_reviews').insert(insert).select('id, updated_at').single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This participant already has a Competency Review Form. Open the saved one instead.' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ success: true, id: row.id, updatedAt: row.updated_at })
  }

  if (action === 'crf-list') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { data, error } = await supabase
      .from('competency_reviews')
      .select('id, title, updated_at, cohort_id, participant_id, review:data->review')
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (action === 'crf-get') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('competency_reviews')
      .select('id, title, data, updated_at, cohort_id, participant_id')
      .eq('id', id)
      .eq(auth.owner.column, auth.owner.value)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Saved review not found' })
    let participantName = ''
    if (data.participant_id) {
      const { data: person } = await supabase.from('observation_participants').select('full_name').eq('id', data.participant_id).maybeSingle()
      participantName = person?.full_name || ''
    }
    return res.status(200).json({ ...data, participant_name: participantName })
  }

  if (action === 'crf-delete') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase.from('competency_reviews').delete().eq('id', id).eq(auth.owner.column, auth.owner.value)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // The participant's saved Session Observation Forms (#1-#3, any mentor coach who did them), so the review can
  // be pre-filled. Only for a participant assigned to the caller (full admins: any).
  if (action === 'crf-sofs') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { participantId } = req.body || {}
    if (!participantId) return res.status(400).json({ error: 'participantId is required' })
    const resolved = await resolveReviewLink(supabase, auth, participantId)
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, form_number, updated_at, form:data->form')
      .eq('participant_id', participantId)
      .not('form_number', 'is', null)
      .is('deleted_at', null)
      .order('form_number')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ participantName: resolved.participant.full_name, observations: data || [] })
  }

  // One Session Observation Form of a participant, to show beside the review (read only). Same access rule as crf-sofs.
  // The AI's suggested ratings are removed for mentor coaches, as in the Session Observation Form itself.
  if (action === 'crf-sof-get') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('observation_drafts')
      .select('id, participant_id, form_number, title, data, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data || !data.participant_id) return res.status(404).json({ error: 'Saved observation not found' })
    const resolved = await resolveReviewLink(supabase, auth, data.participant_id)
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error })
    const showAi = auth.role === 'admin' || auth.role === 'admin_tools'
    const out = { ...data, data: { ...(data.data || {}) } }
    if (!showAi) delete out.data.ai
    return res.status(200).json(out)
  }

  if (action === 'crf-admin-get') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { data, error } = await supabase
      .from('competency_reviews')
      .select('id, user_id, participant_id, title, data, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Saved review not found' })
    const { data: owner } = await supabase.from('users').select('full_name, email, role').eq('id', data.user_id).maybeSingle()
    return res.status(200).json({ ...data, owner: owner || null })
  }

  // FAQ / GUIDE - sections admins write. Each section lists which kinds of accounts may read it
  // ('participant' = role coach, 'mentor', 'tool_admin' = role admin_tools). Full admins see and edit everything.
  // guide-list works for every signed-in account and returns only what that account may read.
  const GUIDE_AUDIENCES = ['participant', 'mentor', 'tool_admin']
  const guideAudienceFor = (role) => (role === 'coach' ? 'participant' : role === 'mentor' ? 'mentor' : role === 'admin_tools' ? 'tool_admin' : null)
  const cleanGuide = (b) => {
    const title = String(b?.title || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const body = String(b?.body || '').slice(0, 30000)
    const audiences = [...new Set((Array.isArray(b?.audiences) ? b.audiences : []).filter((a) => GUIDE_AUDIENCES.includes(a)))]
    return { title, body, audiences }
  }

  if (action === 'guide-list') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['coach', 'mentor', 'admin_tools', 'admin'] })
    if (!auth) return
    const { data, error } = await supabase
      .from('guide_sections')
      .select('id, title, body, audiences, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    if (auth.role === 'admin') return res.status(200).json({ sections: data || [], canEdit: true })
    const mine = guideAudienceFor(auth.role)
    const sections = (data || [])
      .filter((s) => (s.audiences || []).includes(mine))
      .map(({ id, title, body, sort_order }) => ({ id, title, body, sort_order }))
    return res.status(200).json({ sections, canEdit: false })
  }

  if (action === 'guide-save') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    const clean = cleanGuide(req.body)
    if (!clean.title) return res.status(400).json({ error: 'Please give the section a title.' })
    if (id) {
      const { data, error } = await supabase.from('guide_sections')
        .update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'That section no longer exists.' })
      return res.status(200).json({ id: data.id })
    }
    const { data: last } = await supabase.from('guide_sections').select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const next = (last?.[0]?.sort_order ?? -1) + 1
    const { data, error } = await supabase.from('guide_sections').insert({ ...clean, sort_order: next }).select('id').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ id: data.id })
  }

  if (action === 'guide-delete') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase.from('guide_sections').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // Picture upload for the guide editor (full admins). The browser shrinks the picture first and sends it as base64.
  // It goes into a public Supabase Storage bucket 'guide-images' (made automatically the first time) under a random
  // file name, and the public address comes back to be put in the section text.
  if (action === 'guide-upload-image') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { type, data } = req.body || {}
    const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
    const ext = EXT[type]
    if (!ext) return res.status(400).json({ error: 'Please choose a PNG, JPG, WEBP, or GIF picture.' })
    const bytes = Buffer.from(String(data || ''), 'base64')
    if (!bytes.length) return res.status(400).json({ error: 'The picture was empty.' })
    if (bytes.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'That picture is too large (3 MB maximum).' })
    const path = `${randomUUID()}.${ext}`
    const bucket = 'guide-images'
    const put = () => supabase.storage.from(bucket).upload(path, bytes, { contentType: type, cacheControl: '31536000', upsert: false })
    let { error } = await put()
    if (error && /bucket.*not found|not found/i.test(error.message || '')) {
      const made = await supabase.storage.createBucket(bucket, { public: true })
      if (made.error && !/already exists/i.test(made.error.message || '')) return res.status(500).json({ error: made.error.message })
      ;({ error } = await put())
    }
    if (error) return res.status(500).json({ error: error.message })
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
    return res.status(200).json({ url: pub.publicUrl })
  }

  // Saves a new order: ids is the full list of section ids, first to last.
  if (action === 'guide-reorder') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    if (!ids.length) return res.status(400).json({ error: 'ids is required' })
    for (let i = 0; i < ids.length; i += 1) {
      const { error } = await supabase.from('guide_sections').update({ sort_order: i }).eq('id', ids[i])
      if (error) return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ success: true })
  }

  // Loads the starter sections, only while the guide is still empty.
  if (action === 'guide-seed') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { count, error: countError } = await supabase.from('guide_sections').select('id', { count: 'exact', head: true })
    if (countError) return res.status(500).json({ error: countError.message })
    if (count > 0) return res.status(409).json({ error: 'The guide already has sections.' })
    const list = (Array.isArray(req.body?.sections) ? req.body.sections : []).slice(0, 50).map(cleanGuide).filter((s) => s.title)
    if (!list.length) return res.status(400).json({ error: 'sections is required' })
    const { error } = await supabase.from('guide_sections').insert(list.map((s, i) => ({ ...s, sort_order: i })))
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ added: list.length })
  }

  // COHORTS - Admin > Users / Access Codes > Cohorts. A cohort is a group of participant NAMES (no accounts)
  // plus the mentor coaches assigned to it. Mentor coaches pick a participant and Form #1/2/3 when they start
  // a Session Observation Form. Everything below except cohort-mine is full admins only.
  const COHORT_MENTOR_ROLES = ['mentor', 'admin_tools', 'admin']
  const cleanName = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 120)

  // What the admin screen needs in one call: cohorts, participants, mentor assignments, assignable
  // mentor coaches, and every observation linked to a participant (with its form, to tell Complete from In progress).
  if (action === 'cohort-admin-load') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const [cohorts, participants, assignments, mentors, drafts, codes, codeAssignments, reviews] = await Promise.all([
      supabase.from('observation_cohorts').select('id, name, created_at').order('name'),
      supabase.from('observation_participants').select('id, cohort_id, full_name, mentor_id, mentor_code_id, created_at').order('full_name'),
      supabase.from('observation_cohort_mentors').select('cohort_id, user_id'),
      supabase.from('users').select('id, full_name, email, role, is_active').in('role', COHORT_MENTOR_ROLES).order('full_name'),
      supabase
        .from('observation_drafts')
        .select('id, user_id, participant_id, form_number, title, created_at, updated_at, form:data->form')
        .not('participant_id', 'is', null)
        .is('deleted_at', null)
        .limit(2000),
      // Mentor Coach / Admin access codes nobody has used yet: these people can be given participants before they sign up.
      supabase.from('access_codes').select('id, label, role, active, expires_at').in('role', ['mentor', 'admin']).is('used_at', null),
      supabase.from('observation_cohort_mentor_codes').select('cohort_id, code_id'),
      supabase
        .from('competency_reviews')
        .select('id, user_id, participant_id, title, created_at, updated_at, review:data->review')
        .not('participant_id', 'is', null)
        .is('deleted_at', null)
        .limit(2000),
    ])
    const failed = [cohorts, participants, assignments, mentors, drafts, codes, codeAssignments, reviews].find((r) => r.error)
    if (failed) return res.status(500).json({ error: failed.error.message })
    return res.status(200).json({
      cohorts: cohorts.data || [],
      participants: participants.data || [],
      assignments: assignments.data || [],
      mentors: mentors.data || [],
      observations: drafts.data || [],
      reviews: reviews.data || [],
      pendingCodes: (codes.data || [])
        .filter((c) => c.active !== false && !(c.expires_at && new Date(c.expires_at) < new Date()))
        .map((c) => ({ id: c.id, label: c.label, role: c.role })),
      codeAssignments: codeAssignments.data || [],
    })
  }

  if (action === 'cohort-save') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    const name = cleanName(req.body?.name)
    if (!name) return res.status(400).json({ error: 'Enter a cohort name' })
    if (id) {
      const { data, error } = await supabase.from('observation_cohorts').update({ name }).eq('id', id).select('id, name, created_at').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Cohort not found' })
      return res.status(200).json({ success: true, cohort: data })
    }
    const { data, error } = await supabase.from('observation_cohorts').insert({ name }).select('id, name, created_at').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, cohort: data })
  }

  // Deleting a cohort removes its participant names and mentor assignments. Saved observations are kept;
  // only their link to the participant is cleared.
  if (action === 'cohort-delete') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase.from('observation_cohorts').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // Add several participant names at once. Names already in the cohort (ignoring capital letters) are skipped.
  if (action === 'participants-add') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { cohortId, names, mentorId, mentorCodeId } = req.body || {}
    if (!cohortId || !Array.isArray(names)) return res.status(400).json({ error: 'cohortId and names are required' })
    if (names.length > 200) return res.status(400).json({ error: 'Add up to 200 names at a time' })
    if (mentorId && mentorCodeId) return res.status(400).json({ error: 'Choose one mentor coach' })
    if (mentorId && !(await mentorInCohort(cohortId, mentorId))) return res.status(400).json({ error: 'Choose a mentor coach who is assigned to this cohort' })
    if (mentorCodeId && !(await codeInCohort(cohortId, mentorCodeId))) return res.status(400).json({ error: 'Choose a mentor coach who is assigned to this cohort' })
    const { data: existing, error: existingError } = await supabase.from('observation_participants').select('full_name').eq('cohort_id', cohortId)
    if (existingError) return res.status(500).json({ error: existingError.message })
    const seen = new Set((existing || []).map((p) => p.full_name.toLowerCase()))
    const rows = []
    for (const raw of names) {
      const full_name = cleanName(raw)
      if (!full_name || seen.has(full_name.toLowerCase())) continue
      seen.add(full_name.toLowerCase())
      rows.push({ cohort_id: cohortId, full_name, mentor_id: mentorId || null, mentor_code_id: mentorCodeId || null })
    }
    if (!rows.length) return res.status(200).json({ success: true, added: [], skipped: names.length })
    const { data, error } = await supabase.from('observation_participants').insert(rows).select('id, cohort_id, full_name, mentor_id, mentor_code_id, created_at')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, added: data || [], skipped: names.length - rows.length })
  }

  // Is this mentor coach assigned to this cohort? A participant's mentor must always be one of the cohort's mentors.
  async function mentorInCohort(cohortId, userId) {
    const { data } = await supabase.from('observation_cohort_mentors').select('user_id').eq('cohort_id', cohortId).eq('user_id', userId).maybeSingle()
    return !!data
  }

  // Is this (not yet used) access code assigned to this cohort?
  async function codeInCohort(cohortId, codeId) {
    const { data } = await supabase.from('observation_cohort_mentor_codes').select('code_id').eq('cohort_id', cohortId).eq('code_id', codeId).maybeSingle()
    return !!data
  }

  // Assign participants to a mentor coach (or clear it with no mentorId). All participants must be in one cohort,
  // and the mentor coach must be assigned to that cohort.
  if (action === 'participants-mentor-set') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { ids, mentorId, mentorCodeId } = req.body || {}
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids are required' })
    if (mentorId && mentorCodeId) return res.status(400).json({ error: 'Choose one mentor coach' })
    const { data: found, error: foundError } = await supabase.from('observation_participants').select('id, cohort_id').in('id', ids)
    if (foundError) return res.status(500).json({ error: foundError.message })
    if (!found || found.length !== new Set(ids).size) return res.status(404).json({ error: 'Participant not found' })
    const cohortIds = [...new Set(found.map((p) => p.cohort_id))]
    if (cohortIds.length !== 1) return res.status(400).json({ error: 'Assign participants from one cohort at a time' })
    if (mentorId && !(await mentorInCohort(cohortIds[0], mentorId))) {
      return res.status(400).json({ error: 'Choose a mentor coach who is assigned to this cohort' })
    }
    if (mentorCodeId && !(await codeInCohort(cohortIds[0], mentorCodeId))) {
      return res.status(400).json({ error: 'Choose a mentor coach who is assigned to this cohort' })
    }
    const { error } = await supabase.from('observation_participants').update({ mentor_id: mentorId || null, mentor_code_id: mentorCodeId || null }).in('id', ids)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, updated: found.length })
  }

  if (action === 'participant-update') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    const full_name = cleanName(req.body?.full_name)
    if (!id || !full_name) return res.status(400).json({ error: 'id and a name are required' })
    const { data, error } = await supabase.from('observation_participants').update({ full_name }).eq('id', id).select('id, cohort_id, full_name, mentor_id, mentor_code_id, created_at').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Participant not found' })
    return res.status(200).json({ success: true, participant: data })
  }

  if (action === 'participant-delete') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const { error } = await supabase.from('observation_participants').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // Set the full list of mentor coaches for one cohort (replaces what was there).
  if (action === 'cohort-mentors-set') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return
    const { cohortId, userIds, codeIds } = req.body || {}
    if (!cohortId || !Array.isArray(userIds)) return res.status(400).json({ error: 'cohortId and userIds are required' })
    const wanted = [...new Set(userIds)]
    // Access codes whose person has not signed up yet. Left alone when the caller does not send codeIds.
    const wantedCodes = Array.isArray(codeIds) ? [...new Set(codeIds)] : null
    if (wantedCodes && wantedCodes.length) {
      const { data: okCodes, error: codeError } = await supabase.from('access_codes').select('id').in('id', wantedCodes).in('role', ['mentor', 'admin']).is('used_at', null)
      if (codeError) return res.status(500).json({ error: codeError.message })
      if ((okCodes || []).length !== wantedCodes.length) return res.status(400).json({ error: 'Only unused Mentor Coach or Admin access codes can be assigned before sign-up' })
    }
    if (wanted.length) {
      const { data: found, error: foundError } = await supabase.from('users').select('id').in('id', wanted).in('role', COHORT_MENTOR_ROLES)
      if (foundError) return res.status(500).json({ error: foundError.message })
      if ((found || []).length !== wanted.length) return res.status(400).json({ error: 'Only mentor coach accounts can be assigned to a cohort' })
    }
    const { error: clearError } = await supabase.from('observation_cohort_mentors').delete().eq('cohort_id', cohortId)
    if (clearError) return res.status(500).json({ error: clearError.message })
    if (wanted.length) {
      const { error: addError } = await supabase.from('observation_cohort_mentors').insert(wanted.map((user_id) => ({ cohort_id: cohortId, user_id })))
      if (addError) return res.status(500).json({ error: addError.message })
    }
    if (wantedCodes) {
      const { error: clearCodesError } = await supabase.from('observation_cohort_mentor_codes').delete().eq('cohort_id', cohortId)
      if (clearCodesError) return res.status(500).json({ error: clearCodesError.message })
      if (wantedCodes.length) {
        const { error: addCodesError } = await supabase.from('observation_cohort_mentor_codes').insert(wantedCodes.map((code_id) => ({ cohort_id: cohortId, code_id })))
        if (addCodesError) return res.status(500).json({ error: addCodesError.message })
      }
    }
    // A mentor coach who leaves the cohort no longer has its participants. They become unassigned.
    const { data: assigned, error: assignedError } = await supabase.from('observation_participants').select('id, mentor_id, mentor_code_id').eq('cohort_id', cohortId)
    if (assignedError) return res.status(500).json({ error: assignedError.message })
    const orphaned = (assigned || [])
      .filter((p) => (p.mentor_id && !wanted.includes(p.mentor_id)) || (p.mentor_code_id && wantedCodes && !wantedCodes.includes(p.mentor_code_id)))
      .map((p) => p.id)
    if (orphaned.length) {
      const { error: clearMentorError } = await supabase.from('observation_participants').update({ mentor_id: null, mentor_code_id: null }).in('id', orphaned)
      if (clearMentorError) return res.status(500).json({ error: clearMentorError.message })
    }
    return res.status(200).json({ success: true, unassigned: orphaned.length })
  }

  // COHORT MINE - For the Session Observation Form start screen. Returns only the participants assigned to this
  // account (grouped by cohort, A to Z), and for each participant which form numbers already have a saved
  // observation. It never returns another mentor's observation id, title, or content.
  if (action === 'cohort-mine') {
    const auth = await requireCaller(req, res, supabase, { accountRoles: ['admin', 'admin_tools', 'mentor'] })
    if (!auth) return
    const { data: people, error: peopleError } = await supabase
      .from('observation_participants')
      .select('id, cohort_id, full_name')
      .eq('mentor_id', auth.user.id)
    if (peopleError) return res.status(500).json({ error: peopleError.message })
    if (!(people || []).length) return res.status(200).json({ cohorts: [] })
    const cohortIds = [...new Set(people.map((p) => p.cohort_id))]
    const { data: cohortRows, error: cohortError } = await supabase.from('observation_cohorts').select('id, name').in('id', cohortIds)
    if (cohortError) return res.status(500).json({ error: cohortError.message })
    const { data: draftRows, error: draftError } = await supabase
      .from('observation_drafts')
      .select('id, user_id, participant_id, form_number')
      .in('participant_id', people.map((p) => p.id))
      .is('deleted_at', null)
    if (draftError) return res.status(500).json({ error: draftError.message })
    const { data: reviewRows, error: reviewError } = await supabase
      .from('competency_reviews')
      .select('id, user_id, participant_id')
      .in('participant_id', people.map((p) => p.id))
      .is('deleted_at', null)
    if (reviewError) return res.status(500).json({ error: reviewError.message })
    const reviewOf = {}
    ;(reviewRows || []).forEach((r) => {
      const mineReview = r.user_id === auth.user.id
      reviewOf[r.participant_id] = { mine: mineReview, id: mineReview ? r.id : null }
    })
    const byParticipant = {}
    ;(draftRows || []).forEach((d) => {
      const mineDraft = d.user_id === auth.user.id
      ;(byParticipant[d.participant_id] = byParticipant[d.participant_id] || []).push({
        formNumber: d.form_number,
        mine: mineDraft,
        id: mineDraft ? d.id : null,
      })
    })
    const az = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    return res.status(200).json({
      cohorts: [...(cohortRows || [])]
        .sort((a, b) => az(a.name, b.name))
        .map((c) => ({
          id: c.id,
          name: c.name,
          participants: people
            .filter((p) => p.cohort_id === c.id)
            .sort((a, b) => az(a.full_name, b.full_name))
            .map((p) => ({ id: p.id, name: p.full_name, forms: byParticipant[p.id] || [], review: reviewOf[p.id] || null })),
        })),
    })
  }

  // HISTORY SUMMARY - For Admin > History / Data (admin accounts only).
  // For every mentor coach and admin account: what they have saved in each tool, and how many
  // times they ran each tool. Counts only, never transcript text or results.
  if (action === 'history-summary') {
    const auth = await requireAdmin(req, res, supabase)
    if (!auth) return

    const { data: people, error: peopleError } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, signup_code_id, last_accessed_at, created_at')
      .in('role', ['mentor', 'admin_tools', 'admin'])
      .order('full_name')
    if (peopleError) return res.status(500).json({ error: 'Could not load people' })

    const ids = (people || []).map((p) => p.id)
    const blank = () => ({
      saved: { observations: 0, audio: 0, assessments_2021: 0, assessments_2025: 0 },
      runs: { observations: 0, assessments: 0, audio: 0 },
      last_run: null,
    })
    const byUser = Object.fromEntries(ids.map((id) => [id, blank()]))

    if (ids.length) {
      const [drafts, audio, assessments] = await Promise.all([
        supabase.from('observation_drafts').select('user_id').in('user_id', ids),
        supabase.from('audio_transcripts').select('user_id').in('user_id', ids).is('deleted_at', null),
        supabase.from('internal_assessments').select('user_id, assessor_type').in('user_id', ids).is('deleted_at', null),
      ])
      for (const r of drafts.data || []) byUser[r.user_id].saved.observations += 1
      for (const r of audio.data || []) byUser[r.user_id].saved.audio += 1
      for (const r of assessments.data || []) {
        const key = String(r.assessor_type) === '2025' ? 'assessments_2025' : 'assessments_2021'
        byUser[r.user_id].saved[key] += 1
      }

      // Runs: counted per access code (accounts remember the code they signed up with).
      const codeToUser = {}
      for (const p of people) if (p.signup_code_id) codeToUser[p.signup_code_id] = p.id
      const codeIds = Object.keys(codeToUser)
      if (codeIds.length) {
        const { data: events } = await supabase
          .from('access_code_events')
          .select('access_code_id, tool, created_at')
          .in('access_code_id', codeIds)
          .limit(100000)
        for (const e of events || []) {
          const row = byUser[codeToUser[e.access_code_id]]
          if (!row) continue
          if (e.tool === 'observation-evidence') row.runs.observations += 1
          else if (e.tool === 'assessor-2021' || e.tool === 'assessor-2025') row.runs.assessments += 1
          else if (e.tool === 'audio') row.runs.audio += 1
          if (!row.last_run || e.created_at > row.last_run) row.last_run = e.created_at
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      people: (people || []).map((p) => ({ ...p, ...byUser[p.id] })),
    })
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

    // purge-code: everything saved by a single access code, or by the person who signed up with it
    const { codeId, confirm } = req.body || {}
    if (!codeId) return res.status(400).json({ error: 'codeId is required' })
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' })
    const { data: codeRow } = await supabase.from('access_codes').select('used_by').eq('id', codeId).maybeSingle()
    const results = []
    for (const table of ['observation_drafts', 'audio_transcripts', 'internal_assessments']) {
      const filters = [['access_code_id', codeId]]
      if (codeRow?.used_by) filters.push(['user_id', codeRow.used_by])
      let before = 0
      let errMsg = null
      for (const [col, val] of filters) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, val)
        before += count ?? 0
        const { error } = await supabase.from(table).delete().eq(col, val)
        if (error) errMsg = error.message
      }
      results.push({ table, before, error: errMsg })
    }
    console.log(`[purge] admin ${auth.user.id} purged saved data of access code ${codeId}`)
    return res.status(200).json({ results })
  }

  return res.status(400).json({ error: 'Invalid action' })
}

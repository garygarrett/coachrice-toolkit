import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../server/auth.js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // ── Public: verify an access code ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, code } = req.query

    if (action === 'verify') {
      if (!code) return res.status(400).json({ valid: false, error: 'No code provided' })

      const { data, error } = await supabase
        .from('access_codes')
        .select('id, label, active, role, expires_at')
        .eq('code', code.trim())
        .single()

      if (error || !data) return res.status(200).json({ valid: false })
      // Mentor-coach and admin codes only create accounts. They never open a tool directly.
      if (data.role === 'mentor' || data.role === 'admin') return res.status(200).json({ valid: false, reason: 'signup' })
      if (!data.active) return res.status(200).json({ valid: false, reason: 'inactive' })
      if (data.expires_at && new Date(data.expires_at) < new Date()) return res.status(200).json({ valid: false, reason: 'expired' })

      // Fetch the transcript reviewer prompt so the guest client doesn't need a Supabase session.
      // The API key is intentionally NOT returned: guests call /api/ai with their access code instead.
      const { data: configRows } = await supabase
        .from('config')
        .select('key, value')
        .in('key', ['transcript_reviewer_prompt'])

      const configMap = {}
      if (configRows) configRows.forEach(r => { configMap[r.key] = r.value })

      return res.status(200).json({
        valid: true,
        label: data.label,
        role: data.role || 'student',
        systemPrompt: configMap.transcript_reviewer_prompt || null,
      })
    }

    // ── Admin: list all codes ────────────────────────────────────────────────
    if (action === 'list') {
      if (!(await requireAdmin(req, res, supabase))) return
      const { data, error } = await supabase
        .from('access_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })

      // Usage totals per code (from the counting log; this does not touch anyone's saved work)
      const usage = {}
      const { data: events } = await supabase
        .from('access_code_events')
        .select('access_code_id, tool, created_at')
        .limit(100000)
      for (const e of events || []) {
        const u = usage[e.access_code_id] || (usage[e.access_code_id] = { observations: 0, assessments: 0, transcriptions: 0, reviews: 0, last_used: null })
        if (e.tool === 'observation-evidence') u.observations += 1
        else if (e.tool === 'assessor-2021' || e.tool === 'assessor-2025') u.assessments += 1
        else if (e.tool === 'audio') u.transcriptions += 1
        else if (e.tool === 'transcript-guest') u.reviews += 1
        if (!u.last_used || e.created_at > u.last_used) u.last_used = e.created_at
      }
      // Who used each sign-up code (their email), so the page can show it.
      const userIds = (data || []).map((c) => c.used_by).filter(Boolean)
      const emails = {}
      if (userIds.length) {
        const { data: people } = await supabase.from('users').select('id, email').in('id', userIds)
        for (const p of people || []) emails[p.id] = p.email
      }
      const codes = (data || []).map((c) => ({
        ...c,
        used_by_email: c.used_by ? emails[c.used_by] || null : null,
        usage: usage[c.id] || { observations: 0, assessments: 0, transcriptions: 0, reviews: 0, last_used: null },
      }))
      return res.status(200).json({ codes })
    }

    // ── Admin: list guest analyses ────────────────────────────────────────────
    if (action === 'list-analyses') {
      if (!(await requireAdmin(req, res, supabase))) return
      const { data, error } = await supabase
        .from('guest_analyses')
        .select('id, access_code_label, analysis_data, competency_scores, created_at')
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ analyses: data })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  // ── POST: create a new code OR save a guest analysis ─────────────────────
  if (req.method === 'POST') {
    const { action } = req.query

    // Save anonymous guest analysis result
    if (action === 'save-analysis') {
      const { accessCodeLabel, analysisData, competencyScores } = req.body
      if (!accessCodeLabel || !analysisData) return res.status(400).json({ error: 'accessCodeLabel and analysisData are required' })

      const { data, error } = await supabase
        .from('guest_analyses')
        .insert({ access_code_label: accessCodeLabel, analysis_data: analysisData, competency_scores: competencyScores || null })
        .select('id')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ id: data.id })
    }

    // Create a new access code (admin only)
    if (!(await requireAdmin(req, res, supabase))) return
    const { code, label, role, expiresAt } = req.body
    if (!code || !label) return res.status(400).json({ error: 'code and label are required' })
    const codeRole = ['student', 'mentor', 'admin'].includes(role) ? role : 'student'
    let expires = null
    if (expiresAt) {
      const d = new Date(expiresAt)
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'expiresAt is not a valid date' })
      expires = d.toISOString()
    }

    const { data, error } = await supabase
      .from('access_codes')
      .insert({ code: code.trim(), label: label.trim(), role: codeRole, expires_at: expires })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ code: data })
  }

  // ── Admin: toggle active ────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!(await requireAdmin(req, res, supabase))) return
    const { id, active } = req.body
    if (!id || active === undefined) return res.status(400).json({ error: 'id and active are required' })

    const { error } = await supabase
      .from('access_codes')
      .update({ active })
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // ── Admin: delete a code or a guest analysis ──────────────────────────────
  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req, res, supabase))) return
    const { id, type } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const table = type === 'analysis' ? 'guest_analyses' : 'access_codes'
    const { error } = await supabase.from(table).delete().eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

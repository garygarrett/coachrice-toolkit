import { createClient } from '@supabase/supabase-js'

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
        .select('id, label, active')
        .eq('code', code.trim())
        .single()

      if (error || !data) return res.status(200).json({ valid: false })
      if (!data.active) return res.status(200).json({ valid: false, reason: 'inactive' })

      // Fetch the transcript reviewer config so the guest client doesn't need a Supabase session
      const { data: configRows } = await supabase
        .from('config')
        .select('key, value')
        .in('key', ['api_key_transcript', 'transcript_reviewer_prompt'])

      const configMap = {}
      if (configRows) configRows.forEach(r => { configMap[r.key] = r.value })

      return res.status(200).json({
        valid: true,
        label: data.label,
        apiKey: configMap.api_key_transcript || null,
        systemPrompt: configMap.transcript_reviewer_prompt || null,
      })
    }

    // ── Admin: list all codes ────────────────────────────────────────────────
    if (action === 'list') {
      const { data, error } = await supabase
        .from('access_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ codes: data })
    }

    // ── Admin: list guest analyses ────────────────────────────────────────────
    if (action === 'list-analyses') {
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

    // Create a new access code
    const { code, label } = req.body
    if (!code || !label) return res.status(400).json({ error: 'code and label are required' })

    const { data, error } = await supabase
      .from('access_codes')
      .insert({ code: code.trim(), label: label.trim() })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ code: data })
  }

  // ── Admin: toggle active ────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
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
    const { id, type } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const table = type === 'analysis' ? 'guest_analyses' : 'access_codes'
    const { error } = await supabase.from(table).delete().eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

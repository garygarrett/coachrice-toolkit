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

      return res.status(200).json({ valid: true, label: data.label })
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

    return res.status(400).json({ error: 'Unknown action' })
  }

  // ── Admin: create a new code ───────────────────────────────────────────────
  if (req.method === 'POST') {
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

  // ── Admin: delete a code ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const { error } = await supabase
      .from('access_codes')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

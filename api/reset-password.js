import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../server/auth.js'

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

  // Only a signed-in admin may trigger password resets for other users
  if (!(await requireAdmin(req, res, supabase))) return

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: 'email is required' })
  }
  const siteUrl = process.env.SITE_URL ?? 'https://coachrice-toolkit.vercel.app'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/set-password`,
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({ success: true })
}

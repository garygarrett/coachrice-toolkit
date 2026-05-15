import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { userId, sessionId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  // GET - Fetch audio transcripts or specific transcript
  if (req.method === 'GET') {
    try {
      // Verify user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Get specific transcript
      if (sessionId) {
        const { data: session } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .eq('tool', 'transcriber')
          .is('deleted_at', null)
          .single()

        if (!session) {
          return res.status(404).json({ error: 'Transcript not found' })
        }

        return res.status(200).json(session.raw_output || {})
      }

      // Get list of transcripts
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, created_at, raw_output')
        .eq('user_id', userId)
        .eq('tool', 'transcriber')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const transcripts = sessions?.map(s => {
        const output = s.raw_output || {}
        return {
          id: s.id,
          created_at: s.created_at,
          filename: output.filename || 'Recording',
          duration: output.duration || '0:00',
        }
      }) || []

      return res.status(200).json({ data: transcripts })
    } catch (error) {
      console.error('Audio history GET error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // POST - Save audio transcript
  if (req.method === 'POST') {
    try {
      const { filename, duration, segments, speakerLabels } = req.body

      // Verify user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const rawOutput = {
        filename,
        duration,
        segments,
        speakerLabels,
      }

      const { data: session, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          tool: 'transcriber',
          score_category: 'none',
          raw_input: JSON.stringify({ filename }),
          raw_output: rawOutput,
          status: 'completed',
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: 'Failed to save transcript' })
      }

      return res.status(200).json({
        sessionId: session.id,
      })
    } catch (error) {
      console.error('Audio history POST error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // DELETE - Soft delete audio transcript
  if (req.method === 'DELETE') {
    try {
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' })
      }

      // Verify user owns this transcript
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .eq('tool', 'transcriber')
        .single()

      if (!session) {
        return res.status(404).json({ error: 'Transcript not found' })
      }

      // Soft delete
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId)

      if (updateError) {
        throw updateError
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Audio history DELETE error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

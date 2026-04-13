import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const raw = JSON.parse(readFileSync(join(__dirname, '../src/data/questions.json'), 'utf8'))

const rows = raw.map(q => ({
  competency: q.competency,
  question: q.question,
  option_a: q.options.A,
  option_b: q.options.B,
  option_c: q.options.C,
  option_d: q.options.D,
  correct: q.correct,
  explanation: q.explanation,
  is_active: true,
}))

const { error } = await supabase.from('questions').insert(rows)

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

console.log(`✓ Seeded ${rows.length} questions successfully.`)

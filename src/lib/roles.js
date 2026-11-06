// Where each kind of account lands after signing in.
//   coach        participant with a dashboard
//   admin        full admin (dashboard, users, history, analytics, all tools)
//   admin_tools  admin with only the three tools (Internal Assessor, Audio to Transcript, Session Observation Form)
//   mentor       mentor coach with only the Session Observation Form
export function homeFor(role) {
  if (role === 'mentor') return '/tools/session-observation'
  if (role === 'admin_tools') return '/tools/assessor'
  if (role === 'admin') return '/admin'
  return '/dashboard'
}

// Roles that only see the limited tool lists.
export const isToolOnlyRole = (role) => role === 'mentor' || role === 'admin_tools'

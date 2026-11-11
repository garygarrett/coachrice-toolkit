import { useEffect, useState } from 'react'

// Text on the sign-in pages that an admin can edit (Admin > Tool Configuration > Sign-in Pages).
// Saved in the site_content table. A blank value means "use the default below".
export const LOGIN_GROUPS = [
  { id: 'shared', label: 'Every sign-in page', fields: [
    { key: 'login_header_label', label: 'Header label', def: 'CoachRICE Toolkit' },
    { key: 'login_eyebrow', label: 'Small line above the title', def: 'Doerr Institute for New Leaders' },
    { key: 'login_help_prefix', label: 'Help line', def: 'Need help? Contact' },
    { key: 'login_help_email', label: 'Help email address', def: 'CoachRICE@rice.edu' },
    { key: 'login_back_link', label: 'Back link', def: '← Back to sign-in options' },
  ] },
  { id: 'home', label: 'Home page (Who is signing in?)', fields: [
    { key: 'login_home_title', label: 'Title', def: 'Welcome. Who is signing in?' },
    { key: 'login_home_subtitle', label: 'Subtitle', def: 'Choose the option that describes you.' },
    { key: 'login_door_student', label: 'Student box', def: 'Student' },
    { key: 'login_door_mentor', label: 'Mentor Coach box', def: 'Mentor Coach' },
    { key: 'login_door_admin', label: 'Admin box', def: 'Admin' },
  ] },
  { id: 'student', label: 'Student page', fields: [
    { key: 'login_student_title', label: 'Title', def: 'Student access' },
    { key: 'login_student_subtitle', label: 'Instructions', def: 'Enter the access code provided by your program administrator to open the Transcript Reviewer.', long: true },
    { key: 'login_student_button', label: 'Button', def: 'Access Transcript Reviewer' },
  ] },
  { id: 'account', label: 'Mentor Coach and Admin pages', fields: [
    { key: 'login_mentor_title', label: 'Mentor Coach title', def: 'Mentor Coach sign-in' },
    { key: 'login_admin_title', label: 'Admin title', def: 'Admin sign-in' },
    { key: 'login_tab_signin', label: 'First tab', def: 'Sign in' },
    { key: 'login_tab_first', label: 'Second tab', def: 'First time signing in' },
    { key: 'login_code_subtitle', label: 'Instructions on the first-time tab', def: 'Enter the one-time access code from your program administrator. It works once, to create your account.', long: true },
    { key: 'login_create_subtitle', label: 'Instructions when choosing email and password', def: 'Your code works. Choose the email and password you will use to sign in from now on. Keep them safe: the email is how you reset a forgotten password.', long: true },
    { key: 'login_forgot_subtitle', label: 'Instructions on Forgot password', def: 'Enter your email address and we will send you a link to choose a new password.', long: true },
  ] },
]

export const LOGIN_FIELDS = LOGIN_GROUPS.flatMap((g) => g.fields)
const DEFAULTS = Object.fromEntries(LOGIN_FIELDS.map((f) => [f.key, f.def]))

// Returns t(key): the saved text, or the default while loading or when nothing is saved.
export function useLoginContent() {
  const [saved, setSaved] = useState({})
  useEffect(() => {
    let live = true
    // Read through the server so the sign-in pages do not depend on database rules for signed-out visitors.
    fetch('/api/access-codes?action=login-content')
      .then((r) => (r.ok ? r.json() : { content: {} }))
      .then((j) => { if (live) setSaved(j.content || {}) })
      .catch(() => { /* keep the standard text */ })
    return () => { live = false }
  }, [])
  return (key) => (saved[key] && String(saved[key]).trim() ? saved[key] : DEFAULTS[key])
}

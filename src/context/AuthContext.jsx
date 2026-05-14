import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // 1. Keep user in sync with Supabase auth — no other Supabase calls here
  //    to avoid a deadlock with signInWithPassword.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    }).finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Fetch the public.users profile row whenever user changes.
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error && error.code === 'PGRST116') {
          // Row not found - this is expected for new users
          console.log('Profile not found for user, creating empty profile object')
          setProfile({ id: user.id, email: user.email, agreements_accepted: false })
        } else if (error) {
          console.error('Error fetching profile:', error)
          setProfile(null)
        } else {
          setProfile(data ?? null)
          if (data) {
            fetch('/api/update-last-accessed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id }),
            }).catch(err => console.error('Failed to update last accessed:', err))
          }
        }
      })
      .catch(err => {
        console.error('Unexpected error fetching profile:', err)
        setProfile(null)
      })
  }, [user])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

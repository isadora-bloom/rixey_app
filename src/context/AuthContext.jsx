import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load profile when user changes
  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // "Stay signed in" logic:
    // - If user chose NOT to stay signed in, we mark localStorage with 'rixey_session_only'
    //   and mark the current tab in sessionStorage with 'rixey_tab_active'.
    // - sessionStorage is cleared when the browser/tab closes, so on a fresh open
    //   we detect the mismatch and sign out automatically.
    const sessionOnly = localStorage.getItem('rixey_session_only') === 'true'
    const tabActive = sessionStorage.getItem('rixey_tab_active') === 'true'

    if (sessionOnly && !tabActive) {
      supabase.auth.signOut().finally(() => setLoading(false))
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).then(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }

  const signIn = async (email, password, staySignedIn = true) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      if (staySignedIn) {
        localStorage.removeItem('rixey_session_only')
      } else {
        localStorage.setItem('rixey_session_only', 'true')
      }
      sessionStorage.setItem('rixey_tab_active', 'true')
    }
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

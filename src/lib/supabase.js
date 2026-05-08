import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Android Chrome PWAs (standalone home-screen apps) sometimes hang on
// `navigator.locks.request` due to storage partitioning, then abort with
// "signal is aborted without reason". Force the in-memory lock instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: processLock },
})

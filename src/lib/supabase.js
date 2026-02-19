import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: ALWAYS log env var status
console.log('=== SUPABASE DEBUG ===')
console.log('URL value:', supabaseUrl)
console.log('URL type:', typeof supabaseUrl)
console.log('Key exists:', !!supabaseAnonKey)
console.log('======================')

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

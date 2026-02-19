import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: ALWAYS log env var status
console.log('=== SUPABASE DEBUG ===')
console.log('URL value:', supabaseUrl)
console.log('URL type:', typeof supabaseUrl)
console.log('Key length:', supabaseAnonKey?.length)
console.log('Key first 20:', supabaseAnonKey?.substring(0, 20))
console.log('======================')

// Test direct fetch to see if URL works
fetch(supabaseUrl + '/rest/v1/', {
  headers: { 'apikey': supabaseAnonKey }
}).then(r => console.log('Direct fetch test:', r.status))
  .catch(e => console.error('Direct fetch error:', e))

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

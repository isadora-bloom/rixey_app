import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: Check for hidden characters
console.log('=== SUPABASE DEBUG ===')
console.log('URL value:', supabaseUrl)
console.log('URL char codes:', [...supabaseUrl].slice(-5).map(c => c.charCodeAt(0)))
console.log('Key length:', supabaseAnonKey?.length)
console.log('Key last 5 char codes:', [...supabaseAnonKey].slice(-5).map(c => c.charCodeAt(0)))
console.log('======================')

// Clean any potential whitespace/newlines
const cleanUrl = supabaseUrl?.trim()
const cleanKey = supabaseAnonKey?.trim()

// Test with cleaned values
fetch(cleanUrl + '/rest/v1/', {
  headers: { 'apikey': cleanKey }
}).then(r => console.log('Direct fetch test:', r.status))
  .catch(e => console.error('Direct fetch error:', e))

export const supabase = createClient(cleanUrl, cleanKey)

// One-shot seed for the dev environment:
//  1. Deletes any leftover Playwright fixtures
//  2. Creates a test admin login
//  3. Creates a test couple with a 2029 wedding date
//
// Run with: node scripts/seed_test_users.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const text = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return out
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CHILD_TABLES_BY_WEDDING = [
  'budget_items', 'timeline_events', 'table_layouts', 'tables',
  'guests', 'vendor_checklist', 'wedding_worksheets',
  'activity_log', 'notifications', 'planning_checklist',
  'internal_notes', 'section_finalisations',
]

async function deleteUserCompletely(userId, weddingId) {
  if (weddingId) {
    for (const t of CHILD_TABLES_BY_WEDDING) {
      await admin.from(t).delete().eq('wedding_id', weddingId).then(() => {}, () => {})
    }
    await admin.from('weddings').delete().eq('id', weddingId).then(() => {}, () => {})
  }
  await admin.from('profiles').delete().eq('id', userId).then(() => {}, () => {})
  await admin.auth.admin.deleteUser(userId).then(() => {}, () => {})
}

async function purgePlaywrightUsers() {
  console.log('\n[1/3] Purging Playwright fixtures...')
  let total = 0
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const matches = data.users.filter(u =>
      (u.email || '').toLowerCase().startsWith('playwright-') ||
      (u.email || '').toLowerCase().endsWith('@rixey-test.invalid')
    )
    for (const u of matches) {
      const { data: prof } = await admin.from('profiles').select('wedding_id').eq('id', u.id).maybeSingle()
      await deleteUserCompletely(u.id, prof?.wedding_id || null)
      console.log(`  - deleted ${u.email}`)
      total++
    }
    if (data.users.length < 1000) break
    page++
  }
  console.log(`  done. removed ${total} user(s).`)
}

async function deleteByEmailIfExists(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const found = data?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
  if (!found) return
  const { data: prof } = await admin.from('profiles').select('wedding_id').eq('id', found.id).maybeSingle()
  await deleteUserCompletely(found.id, prof?.wedding_id || null)
}

async function createAdmin() {
  console.log('\n[2/3] Creating test admin...')
  const email = 'test-admin@rixey.invalid'
  const password = 'RixeyAdmin2029!'
  await deleteByEmailIfExists(email)

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error
  const userId = data.user.id

  const { error: profErr } = await admin.from('profiles').insert({
    id: userId,
    name: 'Test Admin',
    email,
    role: 'admin',
    is_admin: true,
  })
  if (profErr) throw profErr

  console.log(`  email:    ${email}`)
  console.log(`  password: ${password}`)
  console.log(`  login at: /staff`)
  return { email, password }
}

function generateEventCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

async function createCouple() {
  console.log('\n[3/3] Creating test couple with 2029 wedding...')
  const email = 'test-couple@rixey.invalid'
  const password = 'RixeyCouple2029!'
  const weddingDate = '2029-06-09' // a Saturday
  await deleteByEmailIfExists(email)

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error
  const userId = data.user.id

  const { data: wedding, error: wErr } = await admin
    .from('weddings')
    .insert({
      event_code: generateEventCode(),
      couple_names: 'Test & Couple',
      wedding_date: weddingDate,
      created_by: userId,
    })
    .select()
    .single()
  if (wErr) throw wErr

  const { error: profErr } = await admin.from('profiles').insert({
    id: userId,
    name: 'Test Couple',
    email,
    role: 'couple-bride',
    wedding_date: weddingDate,
    wedding_id: wedding.id,
  })
  if (profErr) throw profErr

  console.log(`  email:    ${email}`)
  console.log(`  password: ${password}`)
  console.log(`  wedding:  ${weddingDate}  (event code ${wedding.event_code})`)
  console.log(`  login at: /`)
  return { email, password, weddingDate, eventCode: wedding.event_code }
}

;(async () => {
  await purgePlaywrightUsers()
  const a = await createAdmin()
  const c = await createCouple()

  console.log('\n=================================')
  console.log('Test credentials')
  console.log('=================================')
  console.log(`Admin   ${a.email}  /  ${a.password}     (sign in at /staff)`)
  console.log(`Couple  ${c.email}  /  ${c.password}    (sign in at /)`)
  console.log(`Wedding date: ${c.weddingDate}, event code: ${c.eventCode}`)
})().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})

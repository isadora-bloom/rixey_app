import { test, expect } from '@playwright/test'
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const testEmail = `playwright-${Date.now()}@rixey-test.invalid`
const testPassword = 'PlaywrightTest123!'
const eventCode = 'PWT' + Math.random().toString(36).slice(2, 5).toUpperCase()
let testUserId = null
let testWeddingId = null

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (error) throw error
  testUserId = data.user.id

  const weddingDate = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10)
  const { data: wedding, error: wErr } = await admin
    .from('weddings')
    .insert({
      event_code: eventCode,
      couple_names: 'Playwright & Test',
      wedding_date: weddingDate,
      created_by: testUserId,
    })
    .select()
    .single()
  if (wErr) throw wErr
  testWeddingId = wedding.id

  // Use 'vip' role so the couple-photo gate modal doesn't block the walk.
  const { error: profileError } = await admin.from('profiles').insert({
    id: testUserId,
    name: 'Playwright Test',
    email: testEmail,
    role: 'vip',
    wedding_date: weddingDate,
    wedding_id: testWeddingId,
  })
  if (profileError) throw profileError
})

test.afterAll(async () => {
  if (testWeddingId) {
    const childTables = [
      'budget_items', 'timeline_events', 'table_layouts', 'tables',
      'guests', 'vendor_checklist', 'wedding_worksheets',
      'activity_log', 'notifications', 'planning_checklist',
      'internal_notes', 'section_finalisations',
    ]
    for (const t of childTables) {
      await admin.from(t).delete().eq('wedding_id', testWeddingId).then(() => {}, () => {})
    }
    await admin.from('weddings').delete().eq('id', testWeddingId)
  }
  if (testUserId) {
    await admin.from('profiles').delete().eq('id', testUserId)
    await admin.auth.admin.deleteUser(testUserId)
  }
})

function attachRecorder(page) {
  const findings = { consoleErrors: [], pageErrors: [], responseErrors: [] }

  const noisePatterns = [
    /favicon/i,
    /\/__vite/i,
    /react devtools/i,
    /Download the React DevTools/i,
    /Warning: ReactDOM\.render/i,
    // Source maps / hot reload noise
    /\.map$/,
  ]
  const isNoise = (s) => noisePatterns.some((p) => p.test(s))

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isNoise(text)) return
    findings.consoleErrors.push(text)
  })
  page.on('pageerror', (err) => {
    findings.pageErrors.push(err.message)
  })
  page.on('response', (res) => {
    const status = res.status()
    if (status < 400) return
    const url = res.url()
    if (isNoise(url)) return
    findings.responseErrors.push(`${status} ${res.request().method()} ${url}`)
  })

  return findings
}

test('sign in lands on /dashboard without bouncing back', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()

  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForURL('**/dashboard', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('dashboard section walk — health check', async ({ page }) => {
  test.setTimeout(240_000)
  const findings = attachRecorder(page)

  await page.goto('/')
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard', { timeout: 10_000 })
  await page.waitForTimeout(2000)

  const sections = [
    'Wedding Details',
    'Checklist',
    'Budget',
    'Guest List',
    'Vendors',
    'Timeline',
    'Tables',
    'Ceremony Order',
    'Table Map',
    'Staffing Guide',
    'Bar Planner',
    'Hair & Makeup',
    'Shuttle Schedule',
    'Rehearsal Dinner',
    'Bedroom Assignments',
    'Decor Inventory',
    'Allergy Registry',
    'Guest Care Notes',
    'Build Your Website',
    'Photo Library',
    'Wedding Party',
    'Inspiration',
    'Borrow Brochure',
    'Rixey Picks',
    'Manor Downloads',
    'Inbox',
    'Book a Meeting',
    'Resources',
    'Worksheets',
  ]

  const perSection = {}
  for (const label of sections) {
    const before = {
      console: findings.consoleErrors.length,
      page: findings.pageErrors.length,
      response: findings.responseErrors.length,
    }
    try {
      const btn = page.getByRole('button', { name: label, exact: true }).first()
      // Trigger the button via JS to bypass viewport/visibility checks.
      // The sidebar is sticky but long, and Playwright's click requires
      // the element to be in the viewport. We don't care about real click
      // mechanics here — we just want to trigger the section change.
      await btn.evaluate((el) => el.click())
      await page.waitForTimeout(900)
    } catch (err) {
      findings.pageErrors.push(`[nav click failed: ${label}] ${err.message.split('\n')[0]}`)
    }
    perSection[label] = {
      console: findings.consoleErrors.length - before.console,
      page: findings.pageErrors.length - before.page,
      response: findings.responseErrors.length - before.response,
    }
  }

  console.log('\n=== DASHBOARD HEALTH REPORT ===')
  console.log(`\nConsole errors (${findings.consoleErrors.length}):`)
  for (const e of [...new Set(findings.consoleErrors)]) console.log('  -', e.slice(0, 300))
  console.log(`\nUncaught page errors (${findings.pageErrors.length}):`)
  for (const e of findings.pageErrors) console.log('  -', e.slice(0, 300))
  console.log(`\nFailed network responses (${findings.responseErrors.length}):`)
  for (const e of [...new Set(findings.responseErrors)]) console.log('  -', e.slice(0, 300))
  console.log('\nPer-section error counts:')
  for (const [label, c] of Object.entries(perSection)) {
    if (c.console || c.page || c.response) {
      console.log(`  ${label}: console=${c.console} page=${c.page} response=${c.response}`)
    }
  }
  console.log('\n=== END REPORT ===\n')

  expect(findings.pageErrors, 'uncaught JS errors on dashboard walk').toEqual([])
})

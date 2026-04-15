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
let testUserId = null

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (error) throw error
  testUserId = data.user.id

  const { error: profileError } = await admin.from('profiles').insert({
    id: testUserId,
    name: 'Playwright Test',
    email: testEmail,
    role: 'vip',
    wedding_id: null,
  })
  if (profileError) throw profileError
})

test.afterAll(async () => {
  if (testUserId) {
    await admin.from('profiles').delete().eq('id', testUserId)
    await admin.auth.admin.deleteUser(testUserId)
  }
})

test('sign in lands on /dashboard without bouncing back', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()

  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForURL('**/dashboard', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/dashboard$/)

  // Give the router a beat to see if ProtectedRoute bounces us back.
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/dashboard$/)
})

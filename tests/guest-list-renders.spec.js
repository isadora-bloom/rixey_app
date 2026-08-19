import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * The guest list has to actually render.
 *
 * On 18 August a declaration moved below its first use and the component threw
 * ReferenceError on every render. The guest list was gone for every couple and
 * for the venue for twenty hours, and it was a couple who noticed, not us.
 * `npm run build` passed. `eslint` passed. A temporal dead zone is only an
 * error when the line runs, so nothing that does not run the line can see it.
 *
 * This runs it. It signs in as the seeded test admin, opens a wedding's guest
 * list, and fails on any console error, which is what that bug looked like from
 * the outside.
 */

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
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_ADMIN = { email: 'test-admin@rixey.invalid', password: 'RixeyAdmin2029!' }

/** A wedding that actually has guests, so the list has something to draw. */
async function weddingWithGuests() {
  const { data, error } = await admin
    .from('wedding_guests')
    .select('wedding_id')
    .limit(1000)
  if (error) throw new Error(error.message)
  const counts = {}
  for (const g of data) counts[g.wedding_id] = (counts[g.wedding_id] || 0) + 1
  const [id] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || []
  if (!id) throw new Error('No wedding has any guests to render')
  const { data: w } = await admin.from('weddings').select('id, couple_names').eq('id', id).single()
  return w
}

test('the guest list renders without throwing', async ({ page }) => {
  const wedding = await weddingWithGuests()

  // Anything the component throws on render lands here. React catches errors
  // into an error boundary, so the visible symptom is a console error rather
  // than a failed request, which is why this asserts on the console.
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(String(err)))

  await page.goto('/staff')
  await page.getByPlaceholder(/email/i).fill(TEST_ADMIN.email)
  await page.getByPlaceholder(/password/i).fill(TEST_ADMIN.password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  await expect(page.getByText(/weddings/i).first()).toBeVisible({ timeout: 20000 })

  // Straight to the wedding profile, then the guest list tab.
  await page.goto(`/admin`)
  await page.getByText(wedding.couple_names, { exact: false }).first().click()
  await expect(page.getByText(/overview/i).first()).toBeVisible({ timeout: 20000 })

  // The phone dropdown and the sidebar both exist; the dropdown is the one
  // that works at every width.
  const nav = page.locator('select').first()
  await nav.selectOption('guests')

  // The summary tiles only exist if the component got past its own body.
  await expect(page.getByText('Total People')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/invitations/)).toBeVisible()

  const fatal = errors.filter(e =>
    /ReferenceError|TypeError|Cannot access|before initialization|is not defined/i.test(e)
  )
  expect(fatal, `console errors while rendering the guest list:\n${fatal.join('\n')}`).toHaveLength(0)
})

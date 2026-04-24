// One-time migration: recolor existing 72" round tables to the new tan fill
// (#E8D0A4) so they match the behaviour of the updated TableCanvas.
//
// Usage:
//   node scripts/recolor-72-rounds.mjs          # dry run, reports changes only
//   node scripts/recolor-72-rounds.mjs --apply  # writes updates back to Supabase
//
// Idempotent: matches on type === 'round' + feetW ≈ 6, so rerunning does
// nothing after the first apply.

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NEW_COLOR = '#E8D0A4'
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function is72Round(el) {
  if (el?.type !== 'round') return false
  if (typeof el.feetW === 'number' && Math.abs(el.feetW - 6) < 0.01) return true
  if (typeof el.label === 'string' && el.label.includes('72')) return true
  return false
}

async function run() {
  console.log(APPLY ? '🎨 Applying recolor…' : '🔍 Dry run — no writes. Pass --apply to commit.')

  const { data: rows, error } = await supabase
    .from('table_layouts')
    .select('wedding_id, elements')

  if (error) {
    console.error('Fetch failed:', error.message)
    process.exit(1)
  }

  let weddingsTouched = 0
  let elementsRecolored = 0

  for (const row of rows || []) {
    if (!Array.isArray(row.elements)) continue

    let rowChanged = false
    const nextElements = row.elements.map(el => {
      if (is72Round(el) && el.color !== NEW_COLOR) {
        rowChanged = true
        elementsRecolored++
        return { ...el, color: NEW_COLOR }
      }
      return el
    })

    if (!rowChanged) continue
    weddingsTouched++

    console.log(`  wedding ${row.wedding_id}: ${nextElements.filter(is72Round).length} × 72" rounds recolored`)

    if (APPLY) {
      const { error: updErr } = await supabase
        .from('table_layouts')
        .update({ elements: nextElements, updated_at: new Date().toISOString() })
        .eq('wedding_id', row.wedding_id)
      if (updErr) {
        console.error(`    ✗ update failed for ${row.wedding_id}: ${updErr.message}`)
      } else {
        console.log(`    ✓ saved`)
      }
    }
  }

  console.log('')
  console.log(`Summary: ${elementsRecolored} elements across ${weddingsTouched} weddings`)
  if (!APPLY && elementsRecolored > 0) {
    console.log('Run again with --apply to commit the changes.')
  }
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})

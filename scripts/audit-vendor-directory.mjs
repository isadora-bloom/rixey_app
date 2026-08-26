// What the vendor directory actually looks like right now. Read-only.
//
// Written because seven vendors filled in their profiles over three weeks in
// July and August and nobody found out until someone went looking. Run it
// after migration 029, and any time you want to know whether a vendor who was
// sent a portal link has done anything with it.
//
//   node scripts/audit-vendor-directory.mjs

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Needs SUPABASE_URL and SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}
const sb = createClient(url, key)

// .range() on purpose. PostgREST stops at 1000 rows without it, and that cap
// has been the recurring bug of this project.
const { data: vendors, error } = await sb.from('vendors').select('*').range(0, 4999)
if (error) {
  console.error('Could not read vendors:', error.message)
  process.exit(1)
}

// A merged duplicate is not a vendor, and a vendor Rixey does not recommend is
// not in the couples' directory. Both were true of every row when this was
// written and neither is true now.
const all = vendors
const rows = all.filter(v => !v.merged_into)
const recommended = rows.filter(v => v.is_recommended)

const live = rows.filter(v => v.is_published === true)
const hidden = rows.filter(v => v.is_published === false)
const undecided = rows.filter(v => v.is_published == null)
const edited = rows.filter(v => v.last_vendor_update)
const hasContent = v => Boolean(v.bio || (v.photos || []).length || v.special_offer || v.availability_note)

console.log(`${rows.length} vendors on file${all.length !== rows.length ? `, plus ${all.length - rows.length} merged into another` : ''}.`)
console.log(`Couples see the ${recommended.length} you recommend.`)
console.log(`  ${live.length} showing their own photos and words`)
console.log(`  ${hidden.length} hidden on purpose`)
console.log(`  ${undecided.length} with nothing of their own yet`)

console.log(`\n${edited.length} have opened their portal link and saved something:`)
edited
  .sort((a, b) => String(b.last_vendor_update).localeCompare(String(a.last_vendor_update)))
  .forEach(v => {
    const state = v.is_published === true ? 'live' : v.is_published === false ? 'HIDDEN' : 'NOT LIVE'
    const bits = []
    if (v.bio) bits.push('bio')
    if ((v.photos || []).length) bits.push(`${v.photos.length} photos`)
    if (v.special_offer) bits.push('offer')
    if (v.availability_note) bits.push('availability')
    console.log(`  [${state}] ${v.name} (${v.category}) — ${bits.join(', ') || 'nothing yet'} — saved ${String(v.last_vendor_update).slice(0, 10)}`)
  })

// The failure this whole thing was about: content written, nobody can see it.
const stranded = rows.filter(v => hasContent(v) && v.is_published !== true)
if (stranded.length) {
  console.log(`\n⚠ ${stranded.length} vendor(s) have written something no couple can see:`)
  stranded.forEach(v => console.log(`  ${v.name} (${v.category}) — is_published ${v.is_published}`))
  console.log('  If migration 029 has run, these were hidden on purpose. If it has not, run it.')
} else {
  console.log('\nNothing written is going unseen.')
}

// Offers with a date on them that has passed. Shown to nobody, but worth
// knowing about before a vendor asks why their offer stopped appearing.
const today = new Date().toISOString().slice(0, 10)
const expired = rows.filter(v => v.special_offer && v.special_expiry && v.special_expiry < today)
if (expired.length) {
  console.log(`\n${expired.length} offer(s) have expired and are no longer shown:`)
  expired.forEach(v => console.log(`  ${v.name} — "${v.special_offer}" ended ${v.special_expiry}`))
}

// A profile on a merged row is fine: the survivor carries a copy, and the old
// row stays reachable by its own portal link.
const onMerged = all.filter(v => v.merged_into && hasContent(v)).length
if (onMerged) console.log(`
${onMerged} merged row(s) still hold their own copy of a profile. The survivor has it too.`)

// What a couple actually sees as headings.
const cats = [...new Set(recommended.flatMap(v => (v.categories?.length ? v.categories : [v.category])).filter(Boolean))].sort()
console.log(`\n${cats.length} categories: ${cats.join(', ')}`)

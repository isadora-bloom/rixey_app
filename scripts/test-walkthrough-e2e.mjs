// End-to-end exercise of the walkthrough path against a DISPOSABLE Playwright
// test wedding. Replicates the endpoint logic exactly, importing the same
// modules the server uses, then cleans up everything it created.
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { WALKTHROUGH_TARGETS, buildNote, organisePrompt, parseItems } from '../server/lib/walkthrough.js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
// Refuses to run against anything but a disposable test wedding. This script
// writes real rows into real planning tables and deletes them again; pointed at
// a live couple, a crash between write and cleanup leaves their data dirty.
const WID = process.argv[2]
if (!WID) {
  console.error('usage: node scripts/test-walkthrough-e2e.mjs <weddingId>')
  console.error('Must be a "Playwright & Test" wedding. Costs one Sonnet call.')
  process.exit(1)
}
const MODEL = 'claude-sonnet-4-6'

const { data: guard } = await sb.from('weddings').select('couple_names').eq('id', WID).maybeSingle()
if (!guard) { console.error('No such wedding.'); process.exit(1) }
if (!/playwright|test/i.test(guard.couple_names || '')) {
  console.error(`Refusing to run against "${guard.couple_names}". This writes and deletes real rows — use a Playwright & Test wedding.`)
  process.exit(1)
}
console.log(`target: ${guard.couple_names} (${WID})
`)

const created = { walkthrough: null, tables: {} }
const note = (t, id) => { (created.tables[t] ||= []).push(id) }

try {
  // ---- 1. create ----------------------------------------------------------
  const { data: wt, error: ce } = await sb.from('walkthroughs').insert({
    wedding_id: WID, kind: 'final_walkthrough', occurred_on: '2026-08-07',
    attendees: 'Isadora, test couple',
    raw_notes: `arbor - birch one not the hex, moving 6ft left for the oak
uncle Bill is coeliac, proper coeliac, needs separate prep
need 3 high chairs, they said 2 before
chase Blue Ridge Blooms re delivery, contact Marta 540 555 0198
kegs - 2 local IPA, 1 cider
last shuttle back to hampton inn 11:15 not 11
they got upset talking about her dad, be gentle on the day`,
  }).select().single()
  if (ce) throw ce
  created.walkthrough = wt.id
  console.log('1. created walkthrough', wt.id)

  // ---- 2. organise --------------------------------------------------------
  const prompt = organisePrompt({
    rawNotes: wt.raw_notes,
    context: 'Rixey Manor is a wedding venue in Rapidan, VA.',
    kindLabel: 'final walkthrough', occurredOn: wt.occurred_on,
  })
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 4000, temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })
  const parsed = parseItems(res.content[0].text)
  const { data: items, error: ie } = await sb.from('walkthrough_items')
    .insert(parsed.map(i => ({ ...i, walkthrough_id: wt.id, wedding_id: WID })))
    .select()
  if (ie) throw ie
  console.log(`2. organised into ${items.length} items`)
  for (const i of items) console.log(`     ${String(i.section || 'note').padEnd(10)} ${i.summary.slice(0, 74)}`)

  // ---- 3. accept all ------------------------------------------------------
  const { error: ae } = await sb.from('walkthrough_items')
    .update({ status: 'accepted' }).eq('walkthrough_id', wt.id).eq('status', 'proposed')
  if (ae) throw ae
  console.log('3. accepted all')

  // ---- 4. apply (the same loop the endpoint runs) --------------------------
  const { data: accepted } = await sb.from('walkthrough_items')
    .select('*').eq('walkthrough_id', wt.id).eq('status', 'accepted')
  const label = 'final walkthrough on 2026-08-07'
  let ok = 0, failed = 0, asNote = 0
  for (const item of accepted) {
    const target = item.section ? WALKTHROUGH_TARGETS[item.section] : null
    const useNote = !target || !target.valid(item.proposed || {})
    const table = useNote ? 'planning_notes' : target.table
    const row = useNote ? buildNote(item, WID, label) : target.build(item.proposed || {}, WID)
    const { data: written, error: werr } = await sb.from(table).insert(row).select('id').single()
    if (werr) {
      failed++
      console.log(`   FAIL ${table}: ${werr.message}`)
      await sb.from('walkthrough_items').update({ status: 'failed', apply_error: werr.message }).eq('id', item.id)
      continue
    }
    ok++; if (useNote) asNote++
    note(table, written.id)
    await sb.from('walkthrough_items').update({
      status: 'applied', applied_at: new Date().toISOString(),
      applied_table: table, applied_row_id: written.id,
    }).eq('id', item.id)
  }
  console.log(`4. applied ${ok} (${asNote} fell back to notes), ${failed} failed`)

  // ---- 5. verify the receipts point at real rows --------------------------
  const { data: done } = await sb.from('walkthrough_items').select('*').eq('walkthrough_id', wt.id)
  console.log('\n5. receipts:')
  for (const d of done.filter(x => x.status === 'applied')) {
    const { data: row } = await sb.from(d.applied_table).select('*').eq('id', d.applied_row_id).maybeSingle()
    console.log(`   ${row ? 'OK  ' : 'DANGLING'} ${d.applied_table.padEnd(20)} ${JSON.stringify(row).slice(0, 110)}`)
  }

  // ---- 6. re-organise must not disturb applied items ----------------------
  const before = done.filter(x => x.status === 'applied').length
  await sb.from('walkthrough_items').delete().eq('walkthrough_id', wt.id).eq('status', 'proposed')
  const { count: after } = await sb.from('walkthrough_items')
    .select('id', { count: 'exact', head: true }).eq('walkthrough_id', wt.id).eq('status', 'applied')
  console.log(`\n6. re-organise: applied items before ${before}, after ${after} ${before === after ? '(preserved)' : '(LOST!)'}`)

  // ---- 7. couple-facing view leaks nothing --------------------------------
  const { data: shared } = await sb.from('walkthroughs')
    .select('id, kind, occurred_on, attendees, shared_summary, shared_at')
    .eq('wedding_id', WID).not('shared_at', 'is', null)
  console.log(`7. couple sees ${shared.length} walkthroughs (unshared, so should be 0)`)
} finally {
  // ---- cleanup ------------------------------------------------------------
  console.log('\ncleanup:')
  for (const [t, ids] of Object.entries(created.tables)) {
    const { error } = await sb.from(t).delete().in('id', ids)
    console.log(`   ${error ? 'FAILED ' : 'removed'} ${ids.length} from ${t}${error ? ' ' + error.message : ''}`)
  }
  if (created.walkthrough) {
    const { error } = await sb.from('walkthroughs').delete().eq('id', created.walkthrough)
    console.log(`   ${error ? 'FAILED' : 'removed'} walkthrough (items cascade)`)
  }
  const { count } = await sb.from('walkthrough_items').select('id', { count: 'exact', head: true })
  const { count: c2 } = await sb.from('walkthroughs').select('id', { count: 'exact', head: true })
  console.log(`   left behind: ${c2} walkthroughs, ${count} items`)
}

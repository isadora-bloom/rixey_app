// The two marks both menus show next to a section entry.
//
// A tick when the couple has signed the section off, a count when something
// found in the couple's emails, calls or forms is still sitting there waiting
// on the venue to act on it. Isadora asked for one function so a tick or a
// count cannot mean something slightly different depending on which side of
// the portal drew it.
import { useMemo } from 'react'
import { SECTIONS, resolveSectionKey } from '../../shared/sections.js'

// Built once from the registry's noteCategories, not per call: this runs on
// every render of both menus, and the mapping never changes at runtime.
const CATEGORY_TO_SECTION = new Map()
for (const section of SECTIONS) {
  for (const category of section.noteCategories || []) {
    CATEGORY_TO_SECTION.set(category, section.key)
  }
}

/**
 * `finalisations` is a map of sectionKey (any key, old or current) to
 * `{ couple_finalised, staff_finalised }`, the same shape Dashboard.jsx
 * already loads from `/api/finalisations/:weddingId`. Only couple_finalised
 * feeds the tick: a venue-side sign-off has no button that sets it yet, and
 * the tick means "the couple told us this is done", not "someone did".
 *
 * `planningNotes` is a wedding's planning_notes rows. Only rows with
 * status 'pending' count, and only ones whose category resolves to a
 * section via that section's `noteCategories`. A note in a category nothing
 * claims — a raw email, an sms transcript, a general coordinator "note" —
 * counts toward nothing, the same way an unresolved section key counts
 * toward nothing: unmapped means null, not a guess.
 *
 * Returns `{ finalised: Set<key>, pending: Map<key, number> }`, both keyed
 * by canonical section key.
 */
export function computeSectionStatus(finalisations = {}, planningNotes = []) {
  const finalised = new Set()
  for (const [storedKey, row] of Object.entries(finalisations || {})) {
    if (!row?.couple_finalised) continue
    const key = resolveSectionKey(storedKey)
    if (key) finalised.add(key)
  }

  const pending = new Map()
  for (const note of planningNotes || []) {
    if (note?.status !== 'pending') continue
    const key = CATEGORY_TO_SECTION.get(note?.category)
    if (!key) continue
    pending.set(key, (pending.get(key) || 0) + 1)
  }

  return { finalised, pending }
}

/**
 * Same computation, memoised for a component that re-renders on every
 * keystroke elsewhere on the page. Call this from DashboardNav.jsx and any
 * other actual React component; a plain helper (weddingTabs.js is not a
 * component) should call computeSectionStatus directly instead, so as not to
 * call a Hook from a function the rules of Hooks do not recognise.
 */
export default function useSectionStatus(finalisations, planningNotes) {
  return useMemo(
    () => computeSectionStatus(finalisations, planningNotes),
    [finalisations, planningNotes]
  )
}

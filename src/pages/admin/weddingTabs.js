/**
 * The wedding profile's tabs, built from the shared section registry.
 *
 * This used to be two hand-kept lists: a sidebar array for desktop and a
 * hard-coded run of <option> elements for the phone. They drifted, as two lists
 * of the same thing always do, and on a phone eleven tabs simply did not exist:
 *
 *   Meetings & Walkthroughs, Their Worksheets, Planning Documents, Wedding
 *   Details, Allergy Registry, Ceremony Order, Decor Inventory, Hair & Makeup,
 *   Shuttle Schedule, Rehearsal Dinner, Bedroom Assignments.
 *
 * Two of those had been built and shipped in the previous fortnight, so from a
 * phone they looked like they had never been built at all. Worse than a bug:
 * a feature nobody can reach is indistinguishable from one that does not exist.
 *
 * That was fixed by having one list here. The list has now moved again, to
 * shared/sections.js, because the couple's menu was the third copy of it and
 * disagreed with this one about what half the sections were called. Labels,
 * icons, groups and order all come from there. Nothing in this file names a
 * section; all it adds is the badges, which are venue-side only.
 */
import { sectionsFor } from '../../../shared/sections.js'

const VENUE_GROUPS = sectionsFor('venue')

export function weddingTabs({
  planningNotes = [],
  uncertainQuestions = [],
  viewingWedding = null,
  borrowSelections = [],
  activities = [],
  contactMessageCount = 0,
} = {}) {
  const pendingNotes = planningNotes.filter(n => n.status === 'pending').length
  const uncertainForThis = viewingWedding
    ? uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length
    : 0
  // The worksheet columns arrive with the wedding, so badging costs no request.
  // Badged so a filled-in worksheet announces itself. The whole problem was
  // that answering one produced no signal at all on this side, so the tab alone
  // would just be a quieter version of the same thing.
  const worksheetsFilled = ['worksheet_priorities', 'worksheet_guest_rules', 'worksheet_budget_alignment']
    .filter(k => viewingWedding?.[k] && Object.keys(viewingWedding[k]).length > 0).length

  const badges = {
    notes: pendingNotes,
    worksheets: worksheetsFilled,
    // The people with no login: mothers, mothers-in-law, planners. Their calls
    // and emails were invisible to the portal until this existed.
    contacts: contactMessageCount,
    uncertain: uncertainForThis,
    borrow: borrowSelections.length,
    activity: activities.length,
  }

  return VENUE_GROUPS.flatMap(({ group, sections }) => [
    { section: group },
    ...sections.map(s => ({
      tab: s.key,
      label: s.label,
      icon: s.icon,
      badge: badges[s.key] || 0,
    })),
  ])
}

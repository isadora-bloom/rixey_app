/**
 * The wedding profile's tabs, in one place.
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
 * Both renderers now read this. Adding a tab makes it appear on both, and there
 * is nowhere left for them to disagree.
 */
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
  const worksheetsFilled = ['worksheet_priorities', 'worksheet_guest_rules', 'worksheet_budget_alignment']
    .filter(k => viewingWedding?.[k] && Object.keys(viewingWedding[k]).length > 0).length

  return [
    { tab: 'overview', label: 'Overview', icon: '/icons/overview.svg' },

    { section: 'Planning' },
    { tab: 'completeness', label: 'File Completeness', icon: '/icons/checklist.svg' },
    { tab: 'notes', label: 'Planning Notes', icon: '/icons/planning-notes.svg', badge: pendingNotes },
    { tab: 'walkthrough', label: 'Meetings & Walkthroughs', icon: '/icons/planning-notes.svg' },
    // Badged so a filled-in worksheet announces itself. The whole problem was
    // that answering one produced no signal at all on this side, so the tab
    // alone would just be a quieter version of the same thing.
    { tab: 'worksheets', label: 'Their Worksheets', icon: '/icons/checklist.svg', badge: worksheetsFilled },
    { tab: 'documents', label: 'Planning Documents', icon: '/icons/upload-contract.svg' },
    { tab: 'wedding-details', label: 'Wedding Details', icon: '/icons/overview.svg' },
    { tab: 'allergies', label: 'Allergy Registry', icon: '/icons/guest-care.svg' },
    { tab: 'ceremony-order', label: 'Ceremony Order', icon: '/icons/timeline.svg' },
    { tab: 'ceremony-chairs', label: 'Ceremony Chairs', icon: '/icons/tables.svg' },
    { tab: 'decor', label: 'Decor Inventory', icon: '/icons/inspiration.svg' },
    { tab: 'makeup', label: 'Hair & Makeup', icon: '/icons/upload-photo-of-you-two.svg' },
    { tab: 'shuttle', label: 'Shuttle Schedule', icon: '/icons/book-a-meeting.svg' },
    { tab: 'rehearsal', label: 'Rehearsal Dinner', icon: '/icons/meetings.svg' },
    { tab: 'bedrooms', label: 'Bedroom Assignments', icon: '/icons/direct-messages.svg' },
    { tab: 'vendors', label: 'Vendors', icon: '/icons/vendors.svg' },
    { tab: 'inspo', label: 'Inspiration', icon: '/icons/inspiration.svg' },
    { tab: 'checklist', label: 'Checklist', icon: '/icons/checklist.svg' },

    { section: 'Conversations' },
    { tab: 'messages', label: 'Conversations', icon: '/icons/conversations.svg' },
    // The people with no login: mothers, mothers-in-law, planners. Their calls
    // and emails were invisible to the portal until this existed.
    { tab: 'contacts', label: 'Family & Contacts', icon: '/icons/guest-care.svg', badge: contactMessageCount },
    { tab: 'uncertain', label: "Uncertain Q's", icon: '/icons/uncertain-questions.svg', badge: uncertainForThis },
    { tab: 'meetings', label: 'Meetings', icon: '/icons/meetings.svg' },
    { tab: 'direct-messages', label: 'Direct Messages', icon: '/icons/direct-messages.svg' },

    { section: 'Tools' },
    { tab: 'table-map', label: 'Table Map', icon: '/icons/tables.svg' },
    { tab: 'timeline', label: 'Timeline', icon: '/icons/timeline.svg' },
    { tab: 'tables', label: 'Tables', icon: '/icons/tables.svg' },
    { tab: 'staffing', label: 'Staffing Guide', icon: '/icons/staffing-guide.svg' },
    { tab: 'bar', label: 'Bar Planner', icon: '/icons/staffing-guide.svg' },
    { tab: 'budget', label: 'Budget', icon: '/icons/budget.svg' },
    { tab: 'guests', label: 'Guest List', icon: '/icons/guest-care.svg' },
    { tab: 'borrow', label: 'Borrow Brochure', icon: '/icons/borrow-brochure.svg', badge: borrowSelections.length },
    { tab: 'guest-care', label: 'Guest Care', icon: '/icons/guest-care.svg' },

    { section: 'Website' },
    { tab: 'website-builder', label: 'Website Builder', icon: '/icons/overview.svg' },
    { tab: 'photo-library', label: 'Photo Library', icon: '/icons/inspiration.svg' },
    { tab: 'wedding-party', label: 'Wedding Party', icon: '/icons/guest-care.svg' },

    { section: 'After the Day' },
    { tab: 'day-of-memories', label: 'Day-of Memories', icon: '/icons/inspiration.svg' },
    { tab: 'activity', label: 'Recent Activity', icon: '/icons/recent-activity.svg', badge: activities.length },

    { section: 'Admin' },
    { tab: 'sheet-sync', label: 'Sync from Sheet', icon: '/icons/upload-contract.svg' },
    { tab: 'contract-upload', label: 'Upload Contract', icon: '/icons/upload-contract.svg' },
    { tab: 'ask', label: 'Ask About Wedding', icon: '/icons/ask-about-wedding.svg' },
    { tab: 'api-usage', label: 'API Usage', icon: '/icons/api-usage.svg' },
  ]
}

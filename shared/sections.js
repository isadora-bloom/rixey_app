/**
 * One list of the portal's sections, for both sides of it.
 *
 * Isadora or Grace on the phone with a couple should be able to say "open Bar
 * Planner" and both land in the same place. That could not happen while the
 * couple menu and the venue menu were two hand-kept arrays: the same panel was
 * called Vendors on one side and Vendors on the other but keyed `vendor` here
 * and `vendors` there, Guest Care Notes was `guestcare` and `guest-care`, the
 * Photo Library was `photos` and `photo-library`, and the couple's Inbox was
 * the venue's Direct Messages. A link that worked for one of them opened the
 * wrong thing, or nothing, for the other.
 *
 * So: one key per section, one label, one icon, one group, and a note of which
 * sides render it. Both menus are built from this. A section added here appears
 * on every side it claims and nowhere it does not.
 *
 * Old keys live on in `aliases`. They arrive from links in emails sent months
 * ago, from `focusTab`, from Sage's portal-action buttons, and from
 * `section_finalisations.section` rows written before any of this. Nothing
 * stored is rewritten; `resolveSectionKey` maps an old key to its canonical one
 * on the way in, every time.
 *
 * Plain ESM with no React in it, so the server, the scripts and the tests can
 * all read the same list the menus do.
 */

// Order matters. Both menus render groups in this order.
export const GROUP_ORDER = [
  'Home',
  'Get Started',
  'Plan',
  'Day Of',
  'Guests',
  'Website',
  'Rixey',
  'After the Day',
  'Connect',
  'Venue only',
]

/**
 * `sides` says who renders the section: 'couple' is the dashboard, 'venue' the
 * wedding profile in admin. `icon` is a lucide icon name, resolved to a
 * component by src/components/ui/SectionIcon.jsx. `finalisable` marks the
 * sections that carry a couple/venue sign-off in the last six weeks.
 */
export const SECTIONS = [
  // Get Started. Three things only. Wedding Details and Walkthrough Notes used
  // to sit here and made it the longest group in the menu, which is a strange
  // shape for the group a couple sees on their first morning.
  { key: 'chat', label: 'Chat with Sage', group: 'Get Started', icon: 'MessageCircle', sides: ['couple'], aliases: [] },
  { key: 'worksheets', label: 'Worksheets', group: 'Get Started', icon: 'ClipboardList', sides: ['couple', 'venue'], aliases: [] },
  { key: 'checklist', label: 'Checklist', group: 'Get Started', icon: 'ListChecks', sides: ['couple', 'venue'], aliases: [] },

  // Plan
  { key: 'wedding-details', label: 'Wedding Details', group: 'Plan', icon: 'Heart', sides: ['couple', 'venue'], aliases: [] },
  { key: 'walkthrough', label: 'Walkthrough Notes', group: 'Plan', icon: 'Footprints', sides: ['couple', 'venue'], aliases: [] },
  { key: 'budget', label: 'Budget', group: 'Plan', icon: 'Wallet', sides: ['couple', 'venue'], aliases: [] },
  { key: 'guests', label: 'Guest List', group: 'Plan', icon: 'Users', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'vendors', label: 'Vendors', group: 'Plan', icon: 'Briefcase', sides: ['couple', 'venue'], aliases: ['vendor'], finalisable: true },
  { key: 'vendor-directory', label: 'Vendor Directory', group: 'Plan', icon: 'BookUser', sides: ['couple'], aliases: ['preferred-vendors'] },
  { key: 'timeline', label: 'Timeline', group: 'Plan', icon: 'CalendarClock', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'tables', label: 'Tables', group: 'Plan', icon: 'LayoutGrid', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'documents', label: 'Documents', group: 'Plan', icon: 'FileText', sides: ['couple', 'venue'], aliases: [] },
  { key: 'completeness', label: 'Completeness', group: 'Plan', icon: 'Gauge', sides: ['couple', 'venue'], aliases: [] },

  // Day Of
  { key: 'ceremony-order', label: 'Ceremony Order', group: 'Day Of', icon: 'ScrollText', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'ceremony-chairs', label: 'Ceremony Chairs', group: 'Day Of', icon: 'Armchair', sides: ['couple', 'venue'], aliases: [] },
  { key: 'table-map', label: 'Table Map', group: 'Day Of', icon: 'Map', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'staffing', label: 'Staffing Guide', group: 'Day Of', icon: 'UserCog', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'bar', label: 'Bar Planner', group: 'Day Of', icon: 'Wine', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'makeup', label: 'Hair & Makeup', group: 'Day Of', icon: 'Scissors', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'shuttle', label: 'Shuttle Schedule', group: 'Day Of', icon: 'Bus', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'rehearsal', label: 'Rehearsal Dinner', group: 'Day Of', icon: 'Utensils', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'bedrooms', label: 'Bedroom Assignments', group: 'Day Of', icon: 'Bed', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'decor', label: 'Decor Inventory', group: 'Day Of', icon: 'Flower2', sides: ['couple', 'venue'], aliases: [], finalisable: true },

  // Guests
  { key: 'rsvp-settings', label: 'RSVP Settings', group: 'Guests', icon: 'MailCheck', sides: ['couple', 'venue'], aliases: [] },
  { key: 'allergies', label: 'Allergy Registry', group: 'Guests', icon: 'HeartPulse', sides: ['couple', 'venue'], aliases: [], finalisable: true },
  { key: 'guest-care', label: 'Guest Care Notes', group: 'Guests', icon: 'HandHeart', sides: ['couple', 'venue'], aliases: ['guestcare'], finalisable: true },

  // Website
  { key: 'website-builder', label: 'Website Builder', group: 'Website', icon: 'Globe', sides: ['couple', 'venue'], aliases: [] },
  { key: 'photo-library', label: 'Photo Library', group: 'Website', icon: 'Images', sides: ['couple', 'venue'], aliases: ['photos'] },
  { key: 'wedding-party', label: 'Wedding Party', group: 'Website', icon: 'PartyPopper', sides: ['couple', 'venue'], aliases: [] },

  // Rixey
  { key: 'inspo', label: 'Inspiration', group: 'Rixey', icon: 'Lightbulb', sides: ['couple', 'venue'], aliases: [] },
  { key: 'borrow', label: 'Borrow Brochure', group: 'Rixey', icon: 'Package', sides: ['couple', 'venue'], aliases: [] },
  { key: 'picks', label: 'Rixey Picks', group: 'Rixey', icon: 'ShoppingBag', sides: ['couple'], aliases: [] },
  { key: 'downloads', label: 'Manor Downloads', group: 'Rixey', icon: 'Download', sides: ['couple'], aliases: [] },

  // After the Day
  { key: 'day-of-memories', label: 'Day-of Memories', group: 'After the Day', icon: 'Camera', sides: ['couple', 'venue'], aliases: [] },

  // Connect
  { key: 'inbox', label: 'Inbox', group: 'Connect', icon: 'Inbox', sides: ['couple', 'venue'], aliases: ['direct-messages'] },
  { key: 'booking', label: 'Book a Meeting', group: 'Connect', icon: 'CalendarPlus', sides: ['couple'], aliases: [] },
  { key: 'resources', label: 'Resources', group: 'Connect', icon: 'Link', sides: ['couple'], aliases: [] },

  // Venue only
  { key: 'overview', label: 'Overview', group: 'Home', icon: 'LayoutDashboard', sides: ['venue'], aliases: [] },
  { key: 'notes', label: 'Planning Notes', group: 'Venue only', icon: 'NotebookPen', sides: ['venue'], aliases: [] },
  { key: 'conversations', label: 'Sage Conversations', group: 'Venue only', icon: 'MessagesSquare', sides: ['venue'], aliases: ['messages'] },
  { key: 'contacts', label: 'Family & Contacts', group: 'Venue only', icon: 'Contact', sides: ['venue'], aliases: [] },
  { key: 'uncertain', label: "Uncertain Q's", group: 'Venue only', icon: 'CircleHelp', sides: ['venue'], aliases: [] },
  { key: 'meetings', label: 'Meetings', group: 'Venue only', icon: 'CalendarDays', sides: ['venue'], aliases: [] },
  { key: 'activity', label: 'Recent Activity', group: 'Venue only', icon: 'Activity', sides: ['venue'], aliases: [] },
  { key: 'sheet-sync', label: 'Sync from Sheet', group: 'Venue only', icon: 'RefreshCw', sides: ['venue'], aliases: [] },
  { key: 'contract-upload', label: 'Upload Contract', group: 'Venue only', icon: 'FileUp', sides: ['venue'], aliases: [] },
  { key: 'ask', label: 'Ask About Wedding', group: 'Venue only', icon: 'Sparkles', sides: ['venue'], aliases: [] },
  { key: 'api-usage', label: 'API Usage', group: 'Venue only', icon: 'BarChart3', sides: ['venue'], aliases: [] },
]

const BY_KEY = new Map(SECTIONS.map(s => [s.key, s]))

// Every alias, and every canonical key, pointing at the canonical key. Built
// once rather than scanned per lookup, because this runs on every render of
// both menus.
const BY_ANY_KEY = new Map()
for (const section of SECTIONS) {
  BY_ANY_KEY.set(section.key, section.key)
  for (const alias of section.aliases || []) BY_ANY_KEY.set(alias, section.key)
}

/** The section with this exact canonical key, or undefined. */
export function sectionByKey(key) {
  return BY_KEY.get(key)
}

/**
 * The canonical key for anything that might be a section key: a current key, an
 * old key from a link or a stored row, or rubbish. Returns null for rubbish, so
 * callers fall back deliberately rather than opening a blank panel.
 */
export function resolveSectionKey(anyKey) {
  if (typeof anyKey !== 'string') return null
  return BY_ANY_KEY.get(anyKey) || null
}

/**
 * The sections one side renders, in registry order, already grouped:
 * `[{ group, sections: [...] }]`, groups in GROUP_ORDER, empty groups dropped.
 */
export function sectionsFor(side) {
  const mine = SECTIONS.filter(s => s.sides.includes(side))
  return GROUP_ORDER
    .map(group => ({ group, sections: mine.filter(s => s.group === group) }))
    .filter(g => g.sections.length > 0)
}

/** The sections carrying a couple/venue sign-off, by canonical key. */
export const FINALISABLE_KEYS = new Set(SECTIONS.filter(s => s.finalisable).map(s => s.key))

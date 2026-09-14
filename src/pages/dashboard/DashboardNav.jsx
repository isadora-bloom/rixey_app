// Sidebar navigation (desktop) + mobile dropdown for Dashboard
import { useNavigate } from 'react-router-dom'

const FINALISABLE = new Set([
  'timeline', 'ceremony-order', 'guests', 'table-map', 'vendor',
  'makeup', 'shuttle', 'rehearsal', 'bedrooms', 'decor',
  'allergies', 'staffing', 'bar', 'tables', 'guestcare',
])

const NAV_ITEMS = [
  { key: 'chat', label: 'Chat with Sage', icon: '/icons/sage-chat.svg' },
  { section: 'Get Started' },
  { key: 'worksheets', label: 'Worksheets', icon: '/icons/checklist.svg' },
  { key: 'wedding-details', label: 'Wedding Details', icon: '/icons/overview.svg' },
  { key: 'checklist', label: 'Checklist', icon: '/icons/checklist.svg' },
  { key: 'walkthrough', label: 'Walkthrough Notes', icon: '/icons/planning-notes.svg' },
  { section: 'Plan' },
  { key: 'budget', label: 'Budget', icon: '/icons/budget.svg', dotKey: 'budget' },
  { key: 'guests', label: 'Guest List', icon: '/icons/guest-care.svg' },
  { key: 'vendor', label: 'Vendors', icon: '/icons/vendors.svg' },
  // No href. It used to have one, pointing at a separate /vendors page, and
  // because href wins over key below, the directory section on this very
  // dashboard was unreachable for as long as both existed.
  { key: 'preferred-vendors', label: 'Vendor Directory', icon: '/icons/vendors.svg' },
  { key: 'timeline', label: 'Timeline', icon: '/icons/timeline.svg', dotKey: 'timeline' },
  { key: 'tables', label: 'Tables', icon: '/icons/tables.svg', dotKey: 'tables' },
  { section: 'Day Of' },
  { key: 'ceremony-order', label: 'Ceremony Order', icon: '/icons/timeline.svg' },
  { key: 'ceremony-chairs', label: 'Ceremony Chairs', icon: '/icons/tables.svg' },
  { key: 'table-map', label: 'Table Map', icon: '/icons/tables.svg' },
  { key: 'staffing', label: 'Staffing Guide', icon: '/icons/staffing-guide.svg' },
  { key: 'bar', label: 'Bar Planner', icon: '/icons/staffing-guide.svg' },
  { key: 'makeup', label: 'Hair & Makeup', icon: '/icons/upload-photo-of-you-two.svg' },
  { key: 'shuttle', label: 'Shuttle Schedule', icon: '/icons/book-a-meeting.svg' },
  { key: 'rehearsal', label: 'Rehearsal Dinner', icon: '/icons/meetings.svg' },
  { key: 'bedrooms', label: 'Bedroom Assignments', icon: '/icons/direct-messages.svg' },
  { key: 'decor', label: 'Decor Inventory', icon: '/icons/inspiration.svg' },
  { section: 'Your Guests' },
  { key: 'rsvp-settings', label: 'RSVP Settings', icon: '/icons/checklist.svg' },
  { key: 'allergies', label: 'Allergy Registry', icon: '/icons/guest-care.svg' },
  { key: 'guestcare', label: 'Guest Care Notes', icon: '/icons/guest-care.svg' },
  { section: 'Your Website' },
  { key: 'website-builder', label: 'Build Your Website', icon: '/icons/resources.svg' },
  { key: 'photos', label: 'Photo Library', icon: '/icons/inspiration.svg' },
  { key: 'wedding-party', label: 'Wedding Party', icon: '/icons/vendors.svg' },
  { section: 'Rixey' },
  { key: 'inspo', label: 'Inspiration', icon: '/icons/inspiration.svg' },
  { key: 'borrow', label: 'Borrow Brochure', icon: '/icons/borrow-brochure.svg' },
  { key: 'picks', label: 'Rixey Picks', icon: '/icons/rixey-picks.svg' },
  { key: 'downloads', label: 'Manor Downloads', icon: '/icons/resources.svg' },
  { section: 'After the Day' },
  { key: 'day-of-memories', label: 'Day-of Memories', icon: '/icons/inspiration.svg' },
  { section: 'Connect' },
  { key: 'inbox', label: 'Inbox', icon: '/icons/inbox.svg' },
  { key: 'booking', label: 'Book a Meeting', icon: '/icons/book-a-meeting.svg' },
  { key: 'resources', label: 'Resources', icon: '/icons/resources.svg' },
]

// Exported so the mobile header menu renders the same sections as the sidebar.
// Two couples wrote in saying the portal only had four things in it, because on
// a phone the hamburger showed the header's resource links and nothing else,
// while the real navigation was a <select> further down the page that reads as
// a form field. One list, used in both places, is what stops that recurring.
export { FINALISABLE, NAV_ITEMS }

// Emoji used to still carry a little visual character in the phone <select>,
// where the sidebar's icon images can't render. Kept as a lookup so the phone
// list can be built straight from NAV_ITEMS instead of hand-duplicated, which
// is what let four whole sections quietly go missing on a phone.
const NAV_EMOJI = {
  chat: '💬', worksheets: '📋', 'wedding-details': '💍', checklist: '✅', walkthrough: '📝',
  budget: '💰', guests: '👥', vendor: '📎', 'preferred-vendors': '⭐', timeline: '📅', tables: '🪑',
  'ceremony-order': '🎶', 'ceremony-chairs': '🪑', 'table-map': '🗺', staffing: '🙋', bar: '🍹',
  makeup: '💄', shuttle: '🚌', rehearsal: '🍽', bedrooms: '🛏', decor: '🌿',
  'rsvp-settings': '📝', allergies: '⚕️', guestcare: '💝',
  'website-builder': '🌐', photos: '📷', 'wedding-party': '💐',
  inspo: '💡', borrow: '📦', picks: '🛍', downloads: '📥',
  'day-of-memories': '📸',
  inbox: '📬', booking: '📞', resources: '🔗',
}

// Builds the phone <select>'s children straight from NAV_ITEMS, so a section
// added to one list is never missing from the other.
function buildMobileNavOptions() {
  const nodes = []
  let currentSection = null
  let pending = []

  const flush = () => {
    if (currentSection) {
      nodes.push(<optgroup key={currentSection} label={currentSection}>{pending}</optgroup>)
    } else {
      nodes.push(...pending)
    }
    pending = []
  }

  NAV_ITEMS.forEach(item => {
    if (item.section) {
      flush()
      currentSection = item.section
      return
    }
    const emoji = NAV_EMOJI[item.key]
    pending.push(
      <option key={item.key} value={item.key}>
        {emoji ? `${emoji} ` : ''}{item.label}
      </option>
    )
  })
  flush()

  return nodes
}

export default function DashboardNav({
  activeSection,
  setActiveSection,
  budgetSummary,
  timelineSummary,
  tableSummary,
  finalisations,
  isPreWedding,
}) {
  const dots = {
    budget: !!budgetSummary,
    timeline: !!timelineSummary,
    tables: !!tableSummary,
  }

  const navigate = useNavigate()

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:order-1">
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden lg:sticky lg:top-24">
          <div className="px-4 pt-5 pb-3 flex justify-center border-b border-cream-200">
            <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-16 w-auto" />
          </div>
          <nav className="p-2">
            {NAV_ITEMS.map((item, idx) => {
              if (item.section) {
                return (
                  <p key={idx} className="text-xs font-semibold text-sage-400 uppercase tracking-wide px-3 pt-3 pb-1">
                    {item.section}
                  </p>
                )
              }
              return (
                <button
                  key={item.key}
                  onClick={() => item.href ? navigate(item.href) : setActiveSection(item.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                    activeSection === item.key
                      ? 'bg-sage-100 text-sage-700 font-medium'
                      : 'text-sage-500 hover:bg-cream-50 hover:text-sage-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <img src={item.icon} className="w-5 h-5 flex-shrink-0" alt="" />
                    <span>{item.label}</span>
                  </span>
                  {/* Finalisation ticks — last 6 weeks only */}
                  {isPreWedding && FINALISABLE.has(item.key) ? (
                    <span className="flex items-center gap-0.5 shrink-0">
                      {[
                        finalisations[item.key]?.couple_finalised,
                        finalisations[item.key]?.staff_finalised,
                      ].map((done, i) => (
                        <span
                          key={i}
                          className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            done ? 'bg-sage-500 border-sage-500' : 'border-cream-400 bg-white'
                          }`}
                        >
                          {done && <span className="text-white text-[7px] leading-none">✓</span>}
                        </span>
                      ))}
                    </span>
                  ) : (
                    item.dotKey && dots[item.dotKey] && <span className="w-1.5 h-1.5 rounded-full bg-sage-400 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile: section dropdown — built from NAV_ITEMS, same as the sidebar,
          so a section can't go missing from one and not the other. */}
      <div className="lg:hidden mb-3">
        <select
          value={activeSection}
          onChange={e => setActiveSection(e.target.value)}
          className="w-full p-3 border border-cream-200 rounded-xl bg-white text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
        >
          {buildMobileNavOptions()}
        </select>
      </div>
    </>
  )
}

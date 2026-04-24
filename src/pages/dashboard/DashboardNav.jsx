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
  { section: 'Plan' },
  { key: 'budget', label: 'Budget', icon: '/icons/budget.svg', dotKey: 'budget' },
  { key: 'guests', label: 'Guest List', icon: '/icons/guest-care.svg' },
  { key: 'vendor', label: 'Vendors', icon: '/icons/vendors.svg' },
  { key: 'preferred-vendors', label: 'Vendor Directory', icon: '/icons/vendors.svg', href: '/vendors' },
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

export { FINALISABLE }

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

      {/* Mobile: section dropdown */}
      <div className="lg:hidden mb-3">
        <select
          value={activeSection}
          onChange={e => {
            const val = e.target.value
            if (val === 'preferred-vendors') { navigate('/vendors'); return }
            setActiveSection(val)
          }}
          className="w-full p-3 border border-cream-200 rounded-xl bg-white text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
        >
          <option value="chat">💬 Chat with Sage</option>
          <optgroup label="Get Started">
            <option value="worksheets">📋 Worksheets</option>
            <option value="wedding-details">💍 Wedding Details</option>
            <option value="checklist">✅ Checklist</option>
          </optgroup>
          <optgroup label="Plan">
            <option value="budget">💰 Budget</option>
            <option value="guests">👥 Guest List</option>
            <option value="vendor">📎 Vendors</option>
            <option value="preferred-vendors">⭐ Vendor Directory</option>
            <option value="timeline">📅 Timeline</option>
            <option value="tables">🪑 Tables</option>
          </optgroup>
          <optgroup label="Day Of">
            <option value="ceremony-order">🎶 Ceremony Order</option>
            <option value="ceremony-chairs">🪑 Ceremony Chairs</option>
            <option value="table-map">🗺 Table Map</option>
            <option value="staffing">🙋 Staffing Guide</option>
            <option value="bar">🍹 Bar Planner</option>
            <option value="makeup">💄 Hair &amp; Makeup</option>
            <option value="shuttle">🚌 Shuttle Schedule</option>
            <option value="rehearsal">🍽 Rehearsal Dinner</option>
            <option value="bedrooms">🛏 Bedroom Assignments</option>
            <option value="decor">🌿 Decor Inventory</option>
          </optgroup>
          <optgroup label="Your Guests">
            <option value="allergies">⚕️ Allergy Registry</option>
            <option value="guestcare">💝 Guest Care Notes</option>
          </optgroup>
          <optgroup label="Your Website">
            <option value="website-builder">🌐 Build Your Website</option>
            <option value="photos">📷 Photo Library</option>
            <option value="wedding-party">💐 Wedding Party</option>
          </optgroup>
          <optgroup label="Rixey">
            <option value="inspo">💡 Inspiration</option>
            <option value="borrow">📦 Borrow Brochure</option>
            <option value="picks">🛍 Rixey Picks</option>
          </optgroup>
          <optgroup label="Connect">
            <option value="inbox">📬 Inbox</option>
            <option value="booking">📞 Book a Meeting</option>
            <option value="resources">🔗 Resources</option>
          </optgroup>
        </select>
      </div>
    </>
  )
}

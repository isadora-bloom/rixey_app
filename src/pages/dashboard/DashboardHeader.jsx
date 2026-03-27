// Top header bar: logo, profile edit button, sign out, notification bell, mobile menu
import { useNavigate } from 'react-router-dom'
import NotificationBell from '../../components/NotificationBell'

export default function DashboardHeader({
  user,
  profile,
  wedding,
  setActiveSection,
  setShowEditProfile,
  handleSignOut,
  mobileMenuOpen,
  setMobileMenuOpen,
  resourceLinks,
}) {
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <button onClick={() => setActiveSection('chat')} className="inline-block">
            <img src="/icons/icon-192x192.png" alt="Rixey Manor" className="h-9 w-auto" />
          </button>
          <button
            onClick={() => setShowEditProfile(true)}
            className="text-sage-400 text-sm hover:text-sage-600 transition flex items-center gap-1"
          >
            {profile?.name || user?.email}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Google Sheets Link */}
          {wedding?.google_sheets_link && (
            <a
              href={wedding.google_sheets_link}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              Spreadsheet
            </a>
          )}

          {/* Notification Bell */}
          {wedding?.id && (
            <NotificationBell
              recipientType="client"
              weddingId={wedding.id}
            />
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-sage-500 hover:text-sage-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button
            onClick={handleSignOut}
            className="hidden sm:block text-sage-500 hover:text-sage-700 text-sm font-medium transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-cream-200 bg-white px-4 py-3 space-y-2">
          {wedding?.google_sheets_link && (
            <a
              href={wedding.google_sheets_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-green-700 bg-green-50 hover:bg-green-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              Planning Spreadsheet <span className="text-green-500 text-xs">↗</span>
            </a>
          )}
          <a
            href="https://members.isadoraandco.com/offers/hWX4WHcQ"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Planning Course <span className="text-amber-500 text-xs">(FREE: RIXEYFAMILY)</span>
          </a>
          {resourceLinks.map((link) => (
            link.href.startsWith('/') ? (
              <button
                key={link.name}
                onClick={() => { navigate(link.href); setMobileMenuOpen(false) }}
                className="block w-full text-left px-3 py-2 rounded-lg text-sage-600 hover:bg-sage-50"
              >
                {link.name}
              </button>
            ) : (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg text-sage-600 hover:bg-sage-50"
              >
                {link.name} <span className="text-sage-400 text-xs">↗</span>
              </a>
            )
          ))}
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  )
}

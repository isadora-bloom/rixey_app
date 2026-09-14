import { useEffect, useRef, useState } from 'react'
import { formatDateOnly } from '../../utils/dates'

/**
 * One wedding in the admin list.
 *
 * Lifted out of AdminWeddingList so the list itself is a list again. Two
 * things changed on the way across, both of them about noise:
 *
 *  - the HoneyBook and Sheets warnings were two lines of orange on every card
 *    that had neither link, which is most of them. A missing link is worth
 *    knowing and is not an alarm, so it is now one grey icon with the reason
 *    in its tooltip, and a card whose links are both set says nothing at all.
 *  - an escalated card used to carry a red tint and red text. Red is kept for
 *    things that have actually failed; a couple who needs answering is amber,
 *    and the same click-through and the same tick to mark it handled are
 *    still on it.
 *
 * Edit Links moved into the card's overflow menu. Everything it opens, the
 * edit form below, is unchanged.
 */
export default function WeddingCard({
  wedding,
  escalation,
  lastActivity,
  couplePhoto,
  viewWeddingProfile,
  setEnlargedPhoto,
  startEditing,
  toggleArchive,
  markEscalationHandled,
  editingWedding,
  setEditingWedding,
  honeybook,
  setHoneybook,
  googleSheets,
  setGoogleSheets,
  projectName,
  setProjectName,
  saving,
  saveLinks,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const isEditing = editingWedding === wedding.id

  // A link that is missing is information, not a warning. Both present and
  // this renders nothing.
  const missingLinks = [
    !wedding.honeybook_link && 'No HoneyBook link',
    !wedding.google_sheets_link && 'No Sheets link',
  ].filter(Boolean)

  return (
    <div className="border border-cream-200 rounded-xl p-3 sm:p-4 hover:border-sage-300 hover:shadow-md transition">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Top row on mobile: Photo + Actions */}
        <div className="flex items-center justify-between sm:contents">
          {couplePhoto ? (
            <img
              src={couplePhoto}
              alt={wedding.couple_names}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-sage-200 flex-shrink-0 cursor-pointer hover:opacity-80 transition"
              onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(couplePhoto) }}
              title="Click to enlarge"
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cream-100 flex items-center justify-center border-2 border-cream-200 flex-shrink-0">
              <span className="text-sage-400 text-lg sm:text-xl">{(wedding.project_name || wedding.couple_names)?.charAt(0) || '?'}</span>
            </div>
          )}
          {/* Mobile-only view button */}
          <button onClick={() => viewWeddingProfile(wedding)} className="sm:hidden px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
            View
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sage-800 text-sm sm:text-base">{wedding.project_name || wedding.couple_names || 'Unnamed'}</h3>
            {lastActivity ? (
              <span className={`text-xs px-2 py-0.5 rounded ${
                lastActivity.status === 'recent' ? 'bg-sage-100 text-sage-700' :
                lastActivity.status === 'active' ? 'bg-sage-100 text-sage-700' :
                lastActivity.status === 'moderate' ? 'bg-cream-100 text-sage-500' : 'bg-cream-100 text-sage-400'
              }`}>
                {lastActivity.display}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-cream-100 text-sage-400">No activity</span>
            )}
            {escalation?.hasEscalation && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const first = escalation.messages?.[0]
                    viewWeddingProfile(wedding, {
                      focusUserId: first?.user_id,
                      focusTab: first?.source === 'direct' ? 'direct-messages' : undefined,
                    })
                  }}
                  className="hover:underline"
                  title="Open the conversation that needs attention"
                >
                  Needs attention
                </button>
                <button onClick={(e) => { e.stopPropagation(); markEscalationHandled(wedding.id) }} className="ml-1 text-sage-600 hover:text-sage-800" title="Mark handled">✓</button>
              </span>
            )}
            {!isEditing && missingLinks.length > 0 && (
              <span className="text-sage-300" title={missingLinks.join(' · ')} aria-label={missingLinks.join('. ')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-sage-500 text-xs sm:text-sm">
            {wedding.wedding_date ? formatDateOnly(wedding.wedding_date) : 'No date set'}
            <span className="mx-1 sm:mx-2 text-sage-300">·</span>
            <span className="font-mono text-xs">{wedding.event_code}</span>
          </p>
          {wedding.profiles?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
              {wedding.profiles.slice(0, 2).map(p => (
                <span key={p.id} className="bg-cream-100 text-sage-600 text-xs px-2 py-0.5 rounded truncate max-w-[100px]">
                  {p.name}
                </span>
              ))}
              {wedding.profiles.length > 2 && (
                <span className="text-sage-400 text-xs">+{wedding.profiles.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions. View Profile is the only button; the rest are behind the
            overflow, because they are things she does once a year. */}
        <div className="hidden sm:flex items-start gap-1 flex-shrink-0">
          <button onClick={() => viewWeddingProfile(wedding)} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
            View Profile
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="px-2 py-2 text-sage-400 hover:text-sage-700 rounded-lg hover:bg-cream-50"
              title="More"
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-cream-200 rounded-xl shadow-lg z-20 py-1">
                <button
                  onClick={() => { setMenuOpen(false); startEditing(wedding) }}
                  className="w-full text-left px-3 py-2 text-sm text-sage-600 hover:bg-cream-50"
                >
                  Edit links
                </button>
                {escalation?.hasEscalation && (
                  <button
                    onClick={() => { setMenuOpen(false); markEscalationHandled(wedding.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-sage-600 hover:bg-cream-50"
                  >
                    Mark attention handled
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="bg-cream-50 rounded-lg p-4 mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-sage-600 mb-1">Project Name</label>
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={wedding.couple_names || 'e.g. Joe & Joan'} className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm" />
            <p className="text-xs text-sage-400 mt-1">Shown as the workspace title in admin. Leave blank to use “{wedding.couple_names || 'the couple names'}”.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">HoneyBook Link</label>
              <input type="url" value={honeybook} onChange={(e) => setHoneybook(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">Google Sheets Link</label>
              <input type="url" value={googleSheets} onChange={(e) => setGoogleSheets(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveLinks} disabled={saving} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditingWedding(null)} className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800">Cancel</button>
            <button onClick={() => toggleArchive(wedding.id, wedding.archived)} className="ml-auto text-xs px-3 py-1 rounded bg-cream-100 text-sage-500 hover:bg-cream-200">
              {wedding.archived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
          {/* Whether each link is set, said plainly, while the fields that set
              them are open. Outside the form this is the one grey icon above. */}
          <p className="text-xs text-sage-400">
            {wedding.honeybook_link ? 'HoneyBook linked' : 'No HoneyBook link yet'}
            <span className="mx-2 text-sage-300">·</span>
            {wedding.google_sheets_link ? 'Sheets linked' : 'No Sheets link yet'}
          </p>
        </div>
      )}
    </div>
  )
}

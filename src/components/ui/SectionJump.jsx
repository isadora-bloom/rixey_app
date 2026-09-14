// Type-to-jump box for the top of a nav sidebar.
//
// A coordinator on the phone with a couple, forty tabs deep in a wedding
// profile, should not have to scroll a sidebar hunting for Bar Planner. Type
// "bar", press Enter, land there. Ctrl+K (Cmd+K on a Mac) focuses this from
// anywhere on the page, the same shortcut on both sides of the portal, so the
// habit transfers.
import { useEffect, useRef, useState } from 'react'

export default function SectionJump({ groups, onJump, placeholder = 'Jump to a section (Ctrl+K)' }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  // `groups` is the same `[{ group, sections }]` shape sectionsFor() returns,
  // so a caller can hand this straight through with no reshaping.
  const flat = (groups || []).flatMap(g => g.sections || [])
  const trimmed = query.trim().toLowerCase()
  const matches = trimmed ? flat.filter(s => s.label.toLowerCase().includes(trimmed)) : []

  // Global, not just "while focused": the whole point is reaching it without
  // having already found the sidebar.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function jumpTo(key) {
    onJump(key)
    setQuery('')
    inputRef.current?.blur()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (matches[0]) jumpTo(matches[0].key)
    } else if (e.key === 'Escape') {
      setQuery('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="px-2 pt-2 pb-1 relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Jump to a section"
        className="w-full px-3 py-1.5 text-sm border border-cream-200 rounded-lg bg-cream-50 text-sage-700 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-300"
      />
      {trimmed && (
        <div className="absolute left-2 right-2 mt-1 bg-white border border-cream-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-sage-400">No matches</p>
          ) : (
            matches.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => jumpTo(s.key)}
                className="w-full text-left px-3 py-1.5 text-sm text-sage-600 hover:bg-sage-50"
              >
                {s.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

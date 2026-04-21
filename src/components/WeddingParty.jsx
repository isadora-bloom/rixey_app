import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import { supabase } from '../lib/supabase'


// ── Role suggestions — no gender or family-structure assumptions ───────────────

const ROLE_SUGGESTIONS = [
  // Honour roles
  'Maid of Honour', 'Matron of Honour', 'Man of Honour', 'Honour Attendant',
  // Best roles
  'Best Man', 'Best Woman', 'Best Person',
  // Attendants
  'Bridesmaid', 'Groomsman', 'Attendant', 'Junior Attendant',
  // Kids
  'Flower Girl', 'Flower Boy', 'Flower Person',
  'Ring Bearer', 'Ring Person', 'Page',
  // Ceremony roles
  'Officiant', 'Celebrant', 'Co-Officiant',
  'Reader', 'Musician', 'Singer',
  'Usher', 'Witness',
  // Family
  'Parent', 'Mother', 'Father', 'Stepmother', 'Stepfather', 'Guardian',
  'Grandparent', 'Grandmother', 'Grandfather',
  'Sibling', 'Godparent',
]

// Map roles to ceremony order sections + processional placement
// Returns null for roles that don't walk (officiant, musician, etc.)
function getCeremonyMapping(role) {
  const r = role.toLowerCase()

  if (['officiant', 'celebrant', 'co-officiant'].includes(r))
    return null // already at altar

  if (['musician', 'singer', 'reader'].includes(r))
    return null // seated/standing separately

  if (r.includes('grandparent') || r.includes('grandmother') || r.includes('grandfather'))
    return { section: 'processional', note: 'Grandparents typically walk first' }

  if (r.includes('parent') || r.includes('mother') || r.includes('father') ||
      r.includes('stepmother') || r.includes('stepfather') || r.includes('guardian'))
    return { section: 'family_escort' }

  if (r.includes('flower') || r.includes('ring') || r.includes('page') || r.includes('junior'))
    return { section: 'processional' }

  // Everything else walks in processional
  return { section: 'processional' }
}

// ── Person avatar — pulls portrait from photo library ────────────────────────

function PersonAvatar({ name, photos, size = 'md' }) {
  const portrait = photos.find(p => p.tags?.some(t => t.toLowerCase() === name.toLowerCase()))
  const dim = size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'
  const text = size === 'lg' ? 'text-xl' : 'text-sm'

  if (portrait) {
    return (
      <img
        src={portrait.url}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0 border-2 border-cream-200`}
      />
    )
  }

  // Initials fallback
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`${dim} rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 border-2 border-cream-200`}>
      <span className={`${text} text-sage-600 font-medium`}>{initials}</span>
    </div>
  )
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

function PersonForm({ initial, guests, partner1, partner2, onSave, onCancel }) {
  const [name, setName]     = useState(initial?.member_name || '')
  const [role, setRole]     = useState(initial?.role || '')
  const [custom, setCustom] = useState('')
  const [group, setGroup]   = useState(initial?.group_label || '')
  const [blurb, setBlurb]   = useState(initial?.blurb || '')
  const [includeOnWebsite, setIncludeOnWebsite] = useState(initial?.include_on_website !== false)
  const [fromGuest, setFromGuest] = useState(null)
  const [saving, setSaving] = useState(false)

  const groupSuggestions = [
    partner1 && `${partner1}'s people`,
    partner2 && `${partner2}'s people`,
    'Both sides',
    'Centre',
  ].filter(Boolean)

  const activeRole = custom.trim() || role

  const handleGuestPick = (g) => {
    const fullName = [g.first_name, g.last_name].filter(Boolean).join(' ')
    setName(fullName)
    setFromGuest(g)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !activeRole.trim()) return
    setSaving(true)
    await onSave({
      member_name: name.trim(),
      role: activeRole.trim(),
      group_label: group.trim() || null,
      blurb: blurb.trim() || null,
      guest_id: fromGuest?.id || initial?.guest_id || null,
      include_on_website: includeOnWebsite,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-cream-50 rounded-xl border border-cream-200 p-4 space-y-4">

      {/* Pick from guest list */}
      {!initial && guests.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Add from your guest list</p>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {guests.map(g => {
              const fullName = [g.first_name, g.last_name].filter(Boolean).join(' ')
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGuestPick(g)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    fromGuest?.id === g.id
                      ? 'bg-sage-100 text-sage-800 border border-sage-300'
                      : 'bg-white hover:bg-cream-100 border border-cream-200 text-sage-700'
                  }`}
                >
                  {fullName}
                  {g.email && <span className="text-sage-400 ml-2 text-xs">{g.email}</span>}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-sage-400 mt-2">Or enter a name manually below</p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Name *</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Full name"
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Role *</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ROLE_SUGGESTIONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r === role ? '' : r); setCustom('') }}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                role === r && !custom.trim()
                  ? 'bg-sage-600 text-white border-sage-600'
                  : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
              }`}
            >{r}</button>
          ))}
        </div>
        <input
          value={custom}
          onChange={e => { setCustom(e.target.value); if (e.target.value) setRole('') }}
          placeholder="Or type a custom role…"
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
        />
      </div>

      {/* Group label */}
      <div>
        <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">
          Group <span className="font-normal text-sage-400 normal-case">(optional — used for ceremony order sides)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {groupSuggestions.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(group === g ? '' : g)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                group === g
                  ? 'bg-sage-600 text-white border-sage-600'
                  : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
              }`}
            >{g}</button>
          ))}
          {groupSuggestions.length === 0 && (
            <p className="text-xs text-sage-400 italic">Set your names above to get group suggestions</p>
          )}
        </div>
        <input
          value={group}
          onChange={e => setGroup(e.target.value)}
          placeholder="Or type a custom group name…"
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
        />
      </div>

      {/* Blurb */}
      <div>
        <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">
          Blurb <span className="font-normal text-sage-400 normal-case">(shown on wedding website)</span>
        </label>
        <textarea
          value={blurb}
          onChange={e => setBlurb(e.target.value)}
          rows={2}
          placeholder="How do you know them? A few warm words…"
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={includeOnWebsite} onChange={e => setIncludeOnWebsite(e.target.checked)}
          className="w-4 h-4 rounded border-cream-300 text-sage-600" />
        <span className="text-sm text-sage-700">Show on wedding website</span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim() || !activeRole.trim()}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update' : 'Add to wedding party'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Ceremony sync preview ─────────────────────────────────────────────────────

function CeremonySyncPanel({ members, existingEntries, onSync, onClose }) {
  const toAdd = members.filter(m => {
    const mapping = getCeremonyMapping(m.role)
    if (!mapping) return false
    // Don't add if already in ceremony order (match by name, case-insensitive)
    return !existingEntries.some(e =>
      e.participant_name?.toLowerCase() === m.member_name.toLowerCase()
    )
  })

  const alreadyIn = members.filter(m => {
    const mapping = getCeremonyMapping(m.role)
    if (!mapping) return false
    return existingEntries.some(e =>
      e.participant_name?.toLowerCase() === m.member_name.toLowerCase()
    )
  })

  const noWalk = members.filter(m => getCeremonyMapping(m.role) === null)

  const sectionLabel = { processional: 'Processional', family_escort: 'Family Escort' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-cream-200">
          <h3 className="font-serif text-lg text-sage-700">Sync to Ceremony Order</h3>
          <p className="text-sage-500 text-sm mt-1">
            These entries will be added to your ceremony order. You can reorder and edit them there.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {toAdd.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Will be added ({toAdd.length})</p>
              <div className="space-y-2">
                {toAdd.map(m => {
                  const mapping = getCeremonyMapping(m.role)
                  return (
                    <div key={m.id} className="flex items-center gap-3 bg-sage-50 rounded-lg px-3 py-2.5">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-sage-800">{m.member_name}</p>
                        <p className="text-xs text-sage-500">{m.role}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded">
                          {sectionLabel[mapping.section]}
                        </span>
                        {m.group_label && (
                          <p className="text-xs text-sage-400 mt-0.5">{m.group_label}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {alreadyIn.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-2">Already in ceremony order</p>
              <div className="space-y-1">
                {alreadyIn.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm text-sage-400">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {m.member_name} — {m.role}
                  </div>
                ))}
              </div>
            </div>
          )}

          {noWalk.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-2">Not added (no processional entry)</p>
              <div className="space-y-1">
                {noWalk.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm text-sage-400">
                    <span className="text-sage-300">—</span>
                    {m.member_name} — {m.role}
                  </div>
                ))}
              </div>
            </div>
          )}

          {toAdd.length === 0 && alreadyIn.length === members.length && (
            <p className="text-sage-400 text-center py-4">Everyone is already in the ceremony order.</p>
          )}
        </div>

        <div className="p-4 border-t border-cream-200 flex gap-2">
          {toAdd.length > 0 && (
            <button
              onClick={() => onSync(toAdd)}
              className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
            >
              Add {toAdd.length} {toAdd.length === 1 ? 'person' : 'people'} to ceremony order
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800">
            {toAdd.length === 0 ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WeddingParty({ weddingId, partner1: p1Prop, partner2: p2Prop }) {
  const [members, setMembers]               = useState([])
  const [guests, setGuests]                 = useState([])
  const [photos, setPhotos]                 = useState([])
  const [existingCeremony, setExistingCeremony] = useState([])
  const [loading, setLoading]               = useState(true)
  const [showAdd, setShowAdd]               = useState(false)
  const [editingId, setEditingId]           = useState(null)
  const [showSync, setShowSync]             = useState(false)
  const [syncing, setSyncing]               = useState(false)
  const [syncDone, setSyncDone]             = useState(false)

  // Partner names — use props if given, otherwise fall back to fetch
  const [partner1, setPartner1] = useState(p1Prop || '')
  const [partner2, setPartner2] = useState(p2Prop || '')
  const [editingPartners, setEditingPartners] = useState(false)
  const [p1Draft, setP1Draft] = useState('')
  const [p2Draft, setP2Draft] = useState('')

  useEffect(() => {
    loadAll()
  }, [weddingId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const hdrs = await authHeaders()
      const [membersRes, guestsRes, photosRes, ceremonyRes] = await Promise.all([
        fetch(`${API_URL}/api/wedding-party/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/guests/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/wedding-photos/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/ceremony-order/${weddingId}`, { headers: hdrs }),
      ])

      const safeJson = async (res) => {
        if (!res.ok) return null
        try { return await res.json() } catch { return null }
      }

      const [membersData, guestsData, photosData, ceremonyData] = await Promise.all([
        safeJson(membersRes),
        safeJson(guestsRes),
        safeJson(photosRes),
        safeJson(ceremonyRes),
      ])

      setMembers(Array.isArray(membersData) ? membersData : [])

      const guestList = guestsData?.guests || guestsData || []
      // Exclude guests already in wedding party
      const memberGuestIds = new Set((Array.isArray(membersData) ? membersData : []).map(m => m.guest_id).filter(Boolean))
      setGuests(Array.isArray(guestList) ? guestList.filter(g => !memberGuestIds.has(g.id)) : [])

      setPhotos(Array.isArray(photosData) ? photosData : [])
      setExistingCeremony(Array.isArray(ceremonyData) ? ceremonyData : [])

      // Partner names come straight from Supabase — the backend doesn't
      // expose a GET /api/weddings/:id route, and the prior code was
      // 404-ing, returning an HTML page, and crashing loadAll on .json().
      if (!p1Prop) {
        const { data: weddingRow } = await supabase
          .from('weddings')
          .select('partner1_name, partner2_name')
          .eq('id', weddingId)
          .single()
        if (weddingRow) {
          setPartner1(weddingRow.partner1_name || '')
          setPartner2(weddingRow.partner2_name || '')
        }
      }
    } catch (err) {
      console.error('Failed to load wedding party:', err)
    }
    setLoading(false)
  }

  const handleSavePartners = async () => {
    try {
      await fetch(`${API_URL}/api/weddings/${weddingId}/partners`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ partner1_name: p1Draft.trim(), partner2_name: p2Draft.trim() })
      })
      setPartner1(p1Draft.trim())
      setPartner2(p2Draft.trim())
      setEditingPartners(false)
    } catch (err) {
      console.error('Failed to save partner names:', err)
    }
  }

  const handleAdd = async (form) => {
    const res = await fetch(`${API_URL}/api/wedding-party/${weddingId}`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ ...form, sort_order: members.length })
    })
    if (res.ok) {
      const newMember = await res.json()
      setMembers(prev => [...prev, newMember])
      // Remove from available guests
      if (newMember.guest_id) {
        setGuests(prev => prev.filter(g => g.id !== newMember.guest_id))
      }
      setShowAdd(false)
    }
  }

  const handleUpdate = async (id, form) => {
    const res = await fetch(`${API_URL}/api/wedding-party/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(form)
    })
    if (res.ok) {
      const updated = await res.json()
      setMembers(prev => prev.map(m => m.id === id ? updated : m))
      setEditingId(null)
    }
  }

  const handleDelete = async (id) => {
    const member = members.find(m => m.id === id)
    await fetch(`${API_URL}/api/wedding-party/${id}`, { method: 'DELETE', headers: await authHeaders() })
    setMembers(prev => prev.filter(m => m.id !== id))
    // Return guest to available list
    if (member?.guest_id) {
      const res = await fetch(`${API_URL}/api/guests/${weddingId}`, { headers: await authHeaders() })
      const data = await res.json()
      const guest = (data.guests || data).find(g => g.id === member.guest_id)
      if (guest) setGuests(prev => [...prev, guest])
    }
  }

  const handleSync = async (toAdd) => {
    setSyncing(true)
    try {
      for (const m of toAdd) {
        const mapping = getCeremonyMapping(m.role)
        await fetch(`${API_URL}/api/ceremony-order`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            wedding_id: weddingId,
            section: mapping.section,
            participant_name: m.member_name,
            role: m.role,
            side: m.group_label || null,
            sort_order: 99,
            notes: mapping.note || null,
          })
        })
      }
      // Reload ceremony entries
      const res = await fetch(`${API_URL}/api/ceremony-order/${weddingId}`, { headers: await authHeaders() })
      setExistingCeremony(await res.json())
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 3000)
    } catch (err) {
      console.error('Sync error:', err)
    }
    setSyncing(false)
    setShowSync(false)
  }

  // Group members by group_label
  const grouped = members.reduce((acc, m) => {
    const key = m.group_label || 'Ungrouped'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  // How many can be synced to ceremony order
  const syncableCount = members.filter(m => {
    const mapping = getCeremonyMapping(m.role)
    if (!mapping) return false
    return !existingCeremony.some(e => e.participant_name?.toLowerCase() === m.member_name.toLowerCase())
  }).length

  if (loading) return <p className="text-sage-400 text-center py-8">Loading wedding party…</p>

  return (
    <div className="space-y-5">

      {/* Testing banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>In testing.</strong> This feature is still being refined — let us know if anything feels off.
      </div>

      {/* Partner names — needed for group label suggestions */}
      {(!partner1 && !partner2) || editingPartners ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-3">
            {editingPartners ? 'Edit partner names' : 'Add your names to get group label suggestions for the ceremony order'}
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              value={p1Draft || partner1}
              onChange={e => setP1Draft(e.target.value)}
              placeholder="Partner 1 name"
              className="border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
            <input
              value={p2Draft || partner2}
              onChange={e => setP2Draft(e.target.value)}
              placeholder="Partner 2 name"
              className="border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSavePartners} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Save names</button>
            {editingPartners && <button onClick={() => setEditingPartners(false)} className="px-4 py-2 text-amber-700 text-sm">Cancel</button>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-sage-500">
          <span className="font-medium text-sage-700">{partner1}</span>
          <span>&</span>
          <span className="font-medium text-sage-700">{partner2}</span>
          <button onClick={() => { setEditingPartners(true); setP1Draft(partner1); setP2Draft(partner2) }} className="text-sage-400 hover:text-sage-600 text-xs underline ml-1">edit</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-sage-700">Wedding Party</h3>
          <p className="text-sage-500 text-sm">{members.length} {members.length === 1 ? 'person' : 'people'}</p>
        </div>
        <div className="flex items-center gap-2">
          {members.length > 0 && (
            <button
              onClick={() => setShowSync(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${
                syncDone
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : syncableCount > 0
                    ? 'bg-sage-50 border-sage-300 text-sage-700 hover:bg-sage-100'
                    : 'bg-cream-50 border-cream-300 text-sage-400'
              }`}
            >
              {syncDone ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Synced to ceremony order
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncableCount > 0 ? `Sync ${syncableCount} to ceremony order` : 'Sync to ceremony order'}
                </>
              )}
            </button>
          )}
          <button
            onClick={() => { setShowAdd(true); setEditingId(null) }}
            className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
          >
            + Add person
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <PersonForm
          guests={guests}
          partner1={partner1}
          partner2={partner2}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Empty state */}
      {members.length === 0 && !showAdd && (
        <div className="text-center py-10 border-2 border-dashed border-cream-300 rounded-xl">
          <p className="text-sage-500 font-medium mb-1">Your wedding party</p>
          <p className="text-sage-400 text-sm mb-4 max-w-xs mx-auto">
            Add the people standing beside you. They'll appear on your website and can be synced to your ceremony order.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
          >
            Add first person
          </button>
        </div>
      )}

      {/* Members grouped */}
      {Object.entries(grouped).map(([groupLabel, groupMembers]) => (
        <div key={groupLabel}>
          {Object.keys(grouped).length > 1 && (
            <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-2">
              {groupLabel}
            </p>
          )}
          <div className="space-y-2">
            {groupMembers.map(member => (
              <div key={member.id}>
                {editingId === member.id ? (
                  <PersonForm
                    initial={member}
                    guests={guests}
                    partner1={partner1}
                    partner2={partner2}
                    onSave={(form) => handleUpdate(member.id, form)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3 bg-white border border-cream-200 rounded-xl p-3 hover:border-sage-300 transition group">
                    <PersonAvatar name={member.member_name} photos={photos} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sage-800 text-sm">{member.member_name}</p>
                        <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded">{member.role}</span>
                        {member.group_label && (
                          <span className="text-xs bg-cream-100 text-sage-500 px-2 py-0.5 rounded">{member.group_label}</span>
                        )}
                        {member.include_on_website === false && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Hidden from website</span>
                        )}
                        {getCeremonyMapping(member.role) === null && (
                          <span className="text-xs text-sage-400 italic">no processional</span>
                        )}
                      </div>
                      {member.blurb && (
                        <p className="text-sage-500 text-xs mt-1 line-clamp-2">{member.blurb}</p>
                      )}
                      {!photos.some(p => p.tags?.some(t => t.toLowerCase() === member.member_name.toLowerCase())) && (
                        <p className="text-xs text-amber-600 mt-1">
                          No photo yet — tag a photo with "{member.member_name}" in the photo library
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button
                        onClick={() => setEditingId(member.id)}
                        className="p-1.5 text-sage-400 hover:text-sage-700 rounded hover:bg-cream-100"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-1.5 text-red-300 hover:text-red-500 rounded hover:bg-red-50"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Ceremony sync modal */}
      {showSync && (
        <CeremonySyncPanel
          members={members}
          existingEntries={existingCeremony}
          onSync={handleSync}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  )
}

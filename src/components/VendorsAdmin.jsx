import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_URL } from '../config/api'
import { authHeaders, apiFetch } from '../utils/api'
import { useToast } from './ui/Toast'

// Every vendor Rixey has dealt with, booked or recommended or both.
//
// This replaces a screen that could only see the 110 recommendations. What
// couples actually booked lived in vendor_checklist as free text, one row per
// wedding, so there was no way to ask how many weddings a vendor had done or
// to see the contracts they had sent. Now the vendor is the thing, and being
// recommended is a switch on it.

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'recommended', label: 'Recommended' },
  { key: 'worked', label: 'Worked here' },
  { key: 'not-recommended', label: 'Not recommended' },
]

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null)

export default function VendorsAdmin() {
  const { error: toastError, success } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [panel, setPanel] = useState(null)   // 'questions' | 'unlinked' | null
  const [adding, setAdding] = useState(false)
  const [newVendor, setNewVendor] = useState({ name: '', categories: '', is_recommended: true })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/venue-vendors`, { headers: await authHeaders() })
      if (!res.ok) throw new Error(`Vendors returned ${res.status}`)
      setData(await res.json())
      setLoadError('')
    } catch (err) {
      // An empty screen and a broken request look the same to whoever is
      // standing here, so say which.
      setLoadError(err.message || 'Could not load vendors')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const vendors = useMemo(() => data?.vendors || [], [data])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return vendors.filter(v => {
      if (filter === 'recommended' && !v.is_recommended) return false
      if (filter === 'not-recommended' && v.is_recommended) return false
      if (filter === 'worked' && !v.weddings) return false
      if (category && !v.categories.includes(category)) return false
      if (term) {
        const hay = [v.name, ...(v.aliases || []), ...(v.categories || []), v.contact, v.notes, v.internal_notes]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    }).sort((a, b) => b.weddings - a.weddings || a.name.localeCompare(b.name))
  }, [vendors, filter, category, search])

  const toggleRecommend = async (v) => {
    try {
      await apiFetch(`${API_URL}/api/venue-vendors/${v.id}/recommend`, {
        method: 'PUT',
        body: JSON.stringify({ is_recommended: !v.is_recommended }),
      })
      await load()
    } catch (err) {
      toastError(`Could not change that: ${err.message}`)
    }
  }

  const create = async () => {
    const name = newVendor.name.trim()
    if (!name) return
    try {
      await apiFetch(`${API_URL}/api/venue-vendors`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          categories: newVendor.categories.split(',').map(c => c.trim()).filter(Boolean),
          is_recommended: newVendor.is_recommended,
        }),
      })
      setNewVendor({ name: '', categories: '', is_recommended: true })
      setAdding(false)
      await load()
    } catch (err) {
      // The 409 for a vendor who is already here is worth reading, not a
      // generic failure. apiFetch surfaces the server's own words.
      toastError(err.message)
    }
  }

  const copyPortalLink = (v) => {
    const url = `${window.location.origin}/vendor/${v.edit_token}`
    navigator.clipboard.writeText(url)
      .then(() => success('Portal link copied'))
      .catch(() => prompt('Copy this link:', url))
  }

  if (loading) return <p className="text-sage-500 text-center py-8">Loading vendors…</p>

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-sage-700 text-sm font-medium">The vendor list did not load.</p>
        <p className="text-sage-400 text-xs mt-1">{loadError}</p>
        <button onClick={load} className="mt-4 text-sm text-sage-600 underline">Try again</button>
      </div>
    )
  }

  const recommended = vendors.filter(v => v.is_recommended).length
  const worked = vendors.filter(v => v.weddings > 0).length
  const contracts = vendors.reduce((n, v) => n + v.contracts, 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Vendors</h2>
          <p className="text-sage-500 text-sm">
            {vendors.length} vendors · {recommended} recommended to couples · {worked} have worked here · {contracts} contracts on file
          </p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="bg-sage-600 text-white px-4 py-2 rounded-lg hover:bg-sage-700 text-sm shrink-0"
        >
          {adding ? 'Cancel' : '+ Add vendor'}
        </button>
      </div>

      {adding && (
        <div className="bg-white border border-cream-200 rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[180px]">
            <span className="text-xs text-sage-500">Name</span>
            <input
              autoFocus
              value={newVendor.name}
              onChange={e => setNewVendor({ ...newVendor, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm"
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="text-xs text-sage-500">Categories (comma separated)</span>
            <input
              value={newVendor.categories}
              onChange={e => setNewVendor({ ...newVendor, categories: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              placeholder="Catering, Food Truck"
              className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-sage-600 pb-2">
            <input
              type="checkbox"
              checked={newVendor.is_recommended}
              onChange={e => setNewVendor({ ...newVendor, is_recommended: e.target.checked })}
              className="w-4 h-4"
            />
            Recommend to couples
          </label>
          <button
            onClick={create}
            disabled={!newVendor.name.trim()}
            className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sage-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {/* Anything waiting on a human says so here rather than sitting quietly */}
      {(data.openQuestions > 0 || data.unlinkedBookings > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.openQuestions > 0 && (
            <button
              onClick={() => setPanel(panel === 'questions' ? null : 'questions')}
              className={`text-xs px-3 py-2 rounded-lg border transition ${
                panel === 'questions' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              {data.openQuestions} pair{data.openQuestions === 1 ? '' : 's'} of names might be the same vendor
            </button>
          )}
          {data.unlinkedBookings > 0 && (
            <button
              onClick={() => setPanel(panel === 'unlinked' ? null : 'unlinked')}
              className={`text-xs px-3 py-2 rounded-lg border transition ${
                panel === 'unlinked' ? 'bg-cream-200 border-sage-300 text-sage-800' : 'bg-cream-100 border-cream-300 text-sage-600 hover:border-sage-300'
              }`}
            >
              {data.unlinkedBookings} booking{data.unlinkedBookings === 1 ? '' : 's'} not attached to a vendor
            </button>
          )}
        </div>
      )}

      {panel === 'questions' && <MergeQuestions onDone={load} onClose={() => setPanel(null)} />}
      {panel === 'unlinked' && <UnlinkedBookings vendors={vendors} onDone={load} onClose={() => setPanel(null)} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search names, aliases, notes…"
          className="flex-1 px-3 py-2 border border-cream-200 rounded-lg text-sm"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 border border-cream-200 rounded-lg text-sm bg-white"
        >
          <option value="">All categories</option>
          {(data.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f.key ? 'bg-sage-600 text-white border-sage-600' : 'border-cream-300 text-sage-600 hover:border-sage-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-sage-400 self-center ml-auto">{shown.length} shown</span>
      </div>

      {shown.length === 0 ? (
        <p className="text-sage-400 text-sm text-center py-10">Nothing matches that.</p>
      ) : (
        <div className="space-y-2">
          {shown.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setOpenId(openId === v.id ? null : v.id)}
                      className="font-medium text-sage-800 hover:text-sage-600 text-left"
                    >
                      {v.name}
                    </button>
                    {v.categories.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 bg-cream-100 text-sage-600 rounded">{c}</span>
                    ))}
                    {v.has_profile && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded" title="They have filled in their own profile">
                        own profile
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sage-400 mt-1">
                    {v.weddings ? `${v.weddings} wedding${v.weddings === 1 ? '' : 's'}` : 'no bookings recorded'}
                    {v.contracts ? ` · ${v.contracts} contract${v.contracts === 1 ? '' : 's'}` : ''}
                    {v.last_worked ? ` · last ${fmtDate(v.last_worked)}` : ''}
                    {v.aliases?.length ? ` · also booked as ${v.aliases.slice(0, 3).join(', ')}${v.aliases.length > 3 ? `, +${v.aliases.length - 3}` : ''}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRecommend(v)}
                    title={v.is_recommended
                      ? 'Couples see them in the directory. Click to take them out.'
                      : 'Not shown to couples. Click to recommend them.'}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      v.is_recommended
                        ? 'bg-sage-600 text-white border-sage-600 hover:bg-sage-700'
                        : 'text-sage-500 border-sage-200 hover:border-sage-400'
                    }`}
                  >
                    {v.is_recommended ? '★ Recommended' : 'Recommend'}
                  </button>
                  <button
                    onClick={() => copyPortalLink(v)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-cream-300 text-sage-500 hover:border-sage-300"
                  >
                    Portal link
                  </button>
                  <button
                    onClick={() => setOpenId(openId === v.id ? null : v.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-cream-300 text-sage-600 hover:border-sage-300"
                  >
                    {openId === v.id ? 'Close' : 'Open'}
                  </button>
                </div>
              </div>

              {openId === v.id && <VendorProfile id={v.id} onSaved={load} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── one vendor ───────────────────────────────────────────────────────────────

function VendorProfile({ id, onSaved }) {
  const { error: toastError, success } = useToast()
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/venue-vendors/${id}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error(`Returned ${res.status}`)
      const d = await res.json()
      {
        setDetail(d)
        setForm({
          name: d.vendor.name || '',
          categories: (d.vendor.categories || []).join(', '),
          contact: d.vendor.contact || '',
          email: d.vendor.email || '',
          phone: d.vendor.phone || '',
          website: d.vendor.website || '',
          instagram: d.vendor.instagram || '',
          pricing_info: d.vendor.pricing_info || '',
          notes: d.vendor.notes || '',
          internal_notes: d.vendor.internal_notes || '',
          aliases: (d.vendor.aliases || []).join(', '),
        })
      }
    } catch (e) {
      setErr(e.message || 'Could not load this vendor')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/api/venue-vendors/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          categories: form.categories.split(',').map(s => s.trim()).filter(Boolean),
          aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      success('Saved')
      onSaved?.()
    } catch (e) {
      toastError(`Could not save: ${e.message}`)
    }
    setSaving(false)
  }

  const togglePublish = async () => {
    try {
      await apiFetch(`${API_URL}/api/recommended-vendors/${id}/publish`, {
        method: 'PUT',
        body: JSON.stringify({ is_published: detail.vendor.is_published !== true }),
      })
      setDetail({ ...detail, vendor: { ...detail.vendor, is_published: detail.vendor.is_published !== true } })
      onSaved?.()
    } catch (e) {
      toastError(`Could not change that: ${e.message}`)
    }
  }

  if (err) return <div className="px-4 pb-4 text-sm text-sage-500">{err}</div>
  if (!detail) return <div className="px-4 pb-4 text-sm text-sage-400">Loading…</div>

  const field = (label, key, type = 'text') => (
    <label className="block">
      <span className="text-xs text-sage-500">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm"
      />
    </label>
  )

  const published = detail.vendor.is_published
  const ownProfile = Boolean(detail.vendor.bio || (detail.vendor.photos || []).length)

  return (
    <div className="border-t border-cream-100 bg-cream-50/60 p-4 space-y-5">
      {/* What the vendor wrote about themselves, and whether couples see it.
          Separate from whether Rixey recommends them: one is their words, the
          other is Isadora's endorsement. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-sage-400">Their own profile:</span>
        {ownProfile ? (
          <span className="text-sage-600">
            {detail.vendor.bio ? 'bio' : ''}{detail.vendor.bio && (detail.vendor.photos || []).length ? ', ' : ''}
            {(detail.vendor.photos || []).length ? `${detail.vendor.photos.length} photos` : ''}
            {detail.vendor.last_vendor_update ? ` · saved ${fmtDate(detail.vendor.last_vendor_update)}` : ''}
          </span>
        ) : (
          <span className="text-sage-400 italic">nothing written yet</span>
        )}
        <button
          onClick={togglePublish}
          title={published === true
            ? 'Their words and photos are showing. Click to hide them.'
            : 'Hidden from couples. Click to show.'}
          className={`px-2.5 py-1 rounded-lg border transition ${
            published === true
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : published === false
                ? 'bg-cream-100 text-sage-600 border-cream-300 hover:border-sage-300'
                : 'text-sage-400 border-cream-300 hover:border-sage-300'
          }`}
        >
          {published === true ? '● Live' : published === false ? 'Hidden' : 'Not live'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {field('Name', 'name')}
        {field('Categories (comma separated)', 'categories')}
        {field('Contact person', 'contact')}
        {field('Email', 'email', 'email')}
        {field('Phone', 'phone')}
        {field('Website', 'website')}
        {field('Instagram', 'instagram')}
        {field('Pricing', 'pricing_info')}
      </div>

      <ContactEvidence
        vendorId={id}
        evidence={detail.contactEvidence || []}
        form={form}
        onUse={(field, value) => setForm(f => ({ ...f, [field]: value }))}
        onChanged={() => { load(); onSaved?.() }}
      />

      <label className="block">
        <span className="text-xs text-sage-500">Also booked as</span>
        <input
          value={form.aliases}
          onChange={e => setForm({ ...form, aliases: e.target.value })}
          className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm"
        />
        <span className="text-xs text-sage-400">Spellings that should match this vendor next time a couple types one.</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-sage-500">Note couples see</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm resize-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-sage-500">Venue-side only</span>
          <textarea
            rows={3}
            value={form.internal_notes}
            onChange={e => setForm({ ...form, internal_notes: e.target.value })}
            className="w-full mt-0.5 px-3 py-2 border border-cream-200 rounded-lg text-sm resize-none"
          />
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      {/* History */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-2">
          {detail.history.length ? `${detail.history.length} booking${detail.history.length === 1 ? '' : 's'}` : 'No bookings recorded'}
        </h4>
        <div className="space-y-1.5">
          {detail.history.map(h => (
            <div key={h.id} className="bg-white rounded-lg border border-cream-200 px-3 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sage-800 font-medium">{h.couple_names}</span>
              {h.wedding_date && <span className="text-sage-400 text-xs">{fmtDate(h.wedding_date)}</span>}
              <span className="text-sage-400 text-xs">{h.vendor_type}</span>
              {h.booked_as && h.booked_as !== detail.vendor.name && (
                <span className="text-sage-400 text-xs italic">booked as “{h.booked_as}”</span>
              )}
              {h.contract_url ? (
                <a
                  href={h.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sage-600 underline ml-auto"
                >
                  Contract{h.contract_date ? ` · ${fmtDate(h.contract_date)}` : ''} ↗
                </a>
              ) : (
                <span className="text-xs text-sage-300 ml-auto">no contract</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {detail.mergedRows?.length > 0 && (
        <p className="text-xs text-sage-400">
          Merged in: {detail.mergedRows.map(m => m.name).join(', ')}. Their old portal links still work and open this record.
        </p>
      )}
    </div>
  )
}

// ── where a phone number came from ───────────────────────────────────────────

const EVIDENCE_LABEL = { email: 'Email', phone: 'Phone', website: 'Website', instagram: 'Instagram', person: 'Contact person' }
const EVIDENCE_FIELD = { email: 'email', phone: 'phone', website: 'website', instagram: 'instagram', person: 'contact' }
const SOURCE_LABEL = {
  booking: 'from a booking',
  document: 'from a planning document',
  contract_note: 'from a contract',
}

function ContactEvidence({ vendorId, evidence, form, onUse, onChanged }) {
  const { error: toastError } = useToast()
  const [busy, setBusy] = useState(null)

  const live = evidence.filter(e => !e.dismissed)
  if (!live.length) return null

  const act = async (e, action) => {
    setBusy(e.id)
    try {
      await apiFetch(`${API_URL}/api/venue-vendors/${vendorId}/contact-evidence/${e.id}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      if (action === 'use') onUse?.(EVIDENCE_FIELD[e.kind], e.value)
      onChanged?.()
    } catch (err) {
      toastError(`Could not do that: ${err.message}`)
    }
    setBusy(null)
  }

  const kinds = [...new Set(live.map(e => e.kind))]

  return (
    <div className="bg-white border border-cream-200 rounded-xl p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-2">
        Everything we hold for them
      </p>
      <div className="space-y-2">
        {kinds.map(kind => {
          const forKind = live.filter(e => e.kind === kind)
          const inUse = form?.[EVIDENCE_FIELD[kind]]
          return (
            <div key={kind}>
              <p className="text-xs text-sage-400">{EVIDENCE_LABEL[kind] || kind}</p>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {forKind.map(e => {
                  const current = inUse && String(inUse).trim() === e.value
                  return (
                    <span
                      key={e.id}
                      className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs border ${
                        current ? 'bg-sage-50 border-sage-300 text-sage-800' : 'bg-cream-50 border-cream-200 text-sage-600'
                      }`}
                    >
                      <span>{e.value}</span>
                      <span className="text-sage-400">
                        {SOURCE_LABEL[e.source] || e.source}{e.seen_count > 1 ? ` ·  ${e.seen_count} times` : ''}
                      </span>
                      {current ? (
                        <span className="text-sage-500">in use</span>
                      ) : (
                        <button
                          disabled={busy === e.id}
                          onClick={() => act(e, 'use')}
                          className="text-sage-600 underline disabled:opacity-50"
                        >
                          use
                        </button>
                      )}
                      <button
                        disabled={busy === e.id}
                        onClick={() => act(e, 'dismiss')}
                        title="Wrong, and do not offer it again"
                        className="text-sage-300 hover:text-red-500 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {live.some(e => e.seen_count > 1) && (
        <p className="text-xs text-sage-400 mt-2">
          Counted, not repeated. Four weddings listing the same number is the best evidence there is that it is the right one.
        </p>
      )}
    </div>
  )
}

// ── the questions the matcher would not answer ───────────────────────────────

function MergeQuestions({ onDone, onClose }) {
  const { error: toastError } = useToast()
  const [questions, setQuestions] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/vendor-merge-review`, { headers: await authHeaders() })
      if (!res.ok) throw new Error(`Returned ${res.status}`)
      const d = await res.json()
      setQuestions(d.questions || [])
    } catch (e) {
      setErr(e.message || 'Could not load the questions')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const answer = async (q, decision, keepId) => {
    setBusy(q.id)
    try {
      await apiFetch(`${API_URL}/api/vendor-merge-review/${q.id}`, {
        method: 'POST',
        body: JSON.stringify({ decision, keep_id: keepId }),
      })
      await load()
      onDone?.()
    } catch (e) {
      toastError(`Could not save that: ${e.message}`)
    }
    setBusy(null)
  }

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sage-800 font-medium text-sm">Names that might be the same vendor</h3>
          <p className="text-sage-500 text-xs mt-0.5">
            Merging joins their bookings and contracts, and keeps the other spelling so it matches by itself next time.
          </p>
        </div>
        <button onClick={onClose} className="text-sage-400 hover:text-sage-600 text-xs">Close</button>
      </div>

      {err && <p className="text-sm text-sage-500">{err}</p>}
      {!err && !questions && <p className="text-sm text-sage-400">Loading…</p>}
      {questions?.length === 0 && <p className="text-sm text-sage-500">Nothing left to answer.</p>}

      <div className="space-y-2">
        {questions?.map(q => (
          <div key={q.id} className="bg-white rounded-lg border border-cream-200 p-3">
            <p className="text-xs text-sage-400 mb-2">{q.reason}</p>
            <div className="flex flex-wrap items-center gap-2">
              <VendorChip v={q.vendor} />
              <span className="text-sage-300 text-xs">and</span>
              <VendorChip v={q.candidate} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                disabled={busy === q.id}
                onClick={() => answer(q, 'merged', q.vendor.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50"
              >
                Same vendor, keep “{q.vendor.name}”
              </button>
              <button
                disabled={busy === q.id}
                onClick={() => answer(q, 'merged', q.candidate.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-sage-300 text-sage-700 hover:bg-sage-50 disabled:opacity-50"
              >
                Same vendor, keep “{q.candidate.name}”
              </button>
              <button
                disabled={busy === q.id}
                onClick={() => answer(q, 'separate')}
                className="text-xs px-3 py-1.5 rounded-lg border border-cream-300 text-sage-500 hover:border-sage-300 disabled:opacity-50"
              >
                Leave separate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VendorChip({ v }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-cream-100 rounded-lg px-2.5 py-1">
      <span className="text-sm text-sage-800">{v.name}</span>
      <span className="text-xs text-sage-400">{(v.categories?.length ? v.categories : [v.category]).filter(Boolean).join(', ')}</span>
    </span>
  )
}

// ── bookings nothing could be made of ────────────────────────────────────────

function UnlinkedBookings({ vendors, onDone, onClose }) {
  const { error: toastError } = useToast()
  const [bookings, setBookings] = useState(null)
  const [err, setErr] = useState('')
  const [choice, setChoice] = useState({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/venue-vendors-unlinked`, { headers: await authHeaders() })
      if (!res.ok) throw new Error(`Returned ${res.status}`)
      const d = await res.json()
      setBookings(d.bookings || [])
    } catch (e) {
      setErr(e.message || 'Could not load these')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const link = async (b) => {
    const vendorId = choice[b.id]
    if (!vendorId) return
    try {
      await apiFetch(`${API_URL}/api/venue-vendors-unlinked/${b.id}`, {
        method: 'PUT',
        body: JSON.stringify({ vendor_id: vendorId }),
      })
      await load()
      onDone?.()
    } catch (e) {
      toastError(`Could not attach that: ${e.message}`)
    }
  }

  const sorted = [...vendors].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="bg-cream-100/70 border border-cream-300 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sage-800 font-medium text-sm">Bookings with no vendor</h3>
          <p className="text-sage-500 text-xs mt-0.5">
            The name on the row was a placeholder, a trade, or blank. Left visible rather than guessed at.
          </p>
        </div>
        <button onClick={onClose} className="text-sage-400 hover:text-sage-600 text-xs">Close</button>
      </div>

      {err && <p className="text-sm text-sage-500">{err}</p>}
      {!err && !bookings && <p className="text-sm text-sage-400">Loading…</p>}
      {bookings?.length === 0 && <p className="text-sm text-sage-500">Every booking has a vendor.</p>}

      <div className="space-y-2">
        {bookings?.map(b => (
          <div key={b.id} className="bg-white rounded-lg border border-cream-200 p-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-sage-800">
                {b.vendor_name?.trim() ? `“${b.vendor_name}”` : <span className="italic text-sage-400">blank</span>}
                <span className="text-sage-400 text-xs"> · {b.vendor_type}</span>
              </p>
              <p className="text-xs text-sage-400">
                {b.couple_names}{b.wedding_date ? ` · ${fmtDate(b.wedding_date)}` : ''}
                {b.contract_url ? ' · has a contract' : ''}
              </p>
            </div>
            <select
              value={choice[b.id] || ''}
              onChange={e => setChoice({ ...choice, [b.id]: e.target.value })}
              className="px-2 py-1.5 border border-cream-200 rounded-lg text-xs bg-white max-w-[220px]"
            >
              <option value="">Attach to…</option>
              {sorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button
              onClick={() => link(b)}
              disabled={!choice[b.id]}
              className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-40"
            >
              Attach
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

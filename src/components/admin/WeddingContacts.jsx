import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../../config/api'
import { apiFetch } from '../../utils/api'
import { useToast } from '../ui/Toast'
import { formatPhone } from '../../../shared/phone'

/**
 * The people who ring and email about a wedding but are not marrying anyone.
 *
 * Mothers and mothers-in-law are on the phone constantly, and until this
 * existed none of it reached the couple's file: both syncs build their lookup
 * from profiles, a profile is a login, and mum has no login. So OpenPhone and
 * Gmail were never asked about her. Adding somebody here is what makes their
 * calls and emails file themselves from the next sync onwards.
 *
 * Everything on this screen is venue-side. A contact's call does not go into
 * planning_notes, which is the only thing the couple's Sage reads — the whole
 * value of a call from a mother-in-law is that she says things she would not
 * say in front of them. Sharing one is a deliberate tick, and it can be undone.
 */

const BLANK = { name: '', relationship: '', phone: '', email: '', notes: '', ingest_calls: true, ingest_email: true }

const RELATIONSHIP_HINTS = [
  "Bride's mother", "Groom's mother", "Bride's father", "Groom's father",
  'Mother-in-law', 'Maid of honour', 'Best man', 'Wedding planner',
]

function when(iso) {
  if (!iso) return 'no date'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function mmss(secs) {
  if (!secs && secs !== 0) return null
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`
}

function ContactForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState(initial || BLANK)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="bg-cream-50 border border-cream-200 rounded-xl p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-sage-500">Name</span>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Susan Miller"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-sage-500">Who they are</span>
          <input
            value={form.relationship || ''}
            onChange={e => set('relationship', e.target.value)}
            placeholder="Bride's mother"
            list="relationship-hints"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
          <datalist id="relationship-hints">
            {RELATIONSHIP_HINTS.map(r => <option key={r} value={r} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="text-xs text-sage-500">Phone</span>
          <input
            value={form.phone || ''}
            onChange={e => set('phone', e.target.value)}
            placeholder="(540) 388-8912"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-sage-500">Email</span>
          <input
            value={form.email || ''}
            onChange={e => set('email', e.target.value)}
            placeholder="susan@example.com"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-sage-500">Anything worth knowing</span>
        <textarea
          value={form.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder="Handles the flowers. Do not copy her father in."
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm mt-1"
        />
      </label>

      {/* Off for somebody recorded for reference rather than ingestion — a
          neighbour, a vendor, an ex-planner. */}
      <div className="flex flex-wrap gap-4 text-sm text-sage-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.ingest_calls !== false} onChange={e => set('ingest_calls', e.target.checked)} />
          Pull in their calls
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.ingest_email !== false} onChange={e => set('ingest_email', e.target.checked)} />
          Pull in their emails
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={busy || !form.name.trim()}
          className="px-4 py-2 rounded-lg text-sm bg-sage-600 text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-cream-300 text-sage-600">
          Cancel
        </button>
      </div>
    </div>
  )
}

function MessageRow({ message, onShare, busy }) {
  const [open, setOpen] = useState(false)
  const isEmail = message.kind === 'email'

  return (
    <div className="border border-cream-200 rounded-xl p-3 bg-white">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base">{isEmail ? '✉️' : '📞'}</span>
        <span className="font-medium text-sage-700">{message.contact_name || message.phone_number || message.email_address}</span>
        <span className="text-sage-400 text-xs">
          {when(message.occurred_at)}
          {message.direction === 'outbound' ? ' · Rixey rang them' : ' · they got in touch'}
          {message.duration_secs ? ` · ${mmss(message.duration_secs)}` : ''}
        </span>
        {message.shared_with_couple && (
          <span className="text-xs bg-sage-100 text-sage-700 rounded px-1.5 py-0.5">The couple can see this</span>
        )}
      </div>

      {message.subject && <div className="text-sm text-sage-600 mt-1">{message.subject}</div>}

      {message.summary && <p className="text-sm text-sage-600 mt-2">{message.summary}</p>}

      {open && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-sage-700 bg-cream-50 rounded-lg p-3 mt-3 max-h-96 overflow-y-auto">
          {message.body}
        </pre>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => setOpen(o => !o)} className="text-xs text-sage-600 underline">
          {open ? 'Hide the full text' : isEmail ? 'Read the email' : 'Read the transcript'}
        </button>
        <button
          onClick={() => onShare(message, !message.shared_with_couple)}
          disabled={busy}
          className="text-xs text-sage-600 underline disabled:opacity-40"
        >
          {message.shared_with_couple ? 'Take it back from the couple' : 'Share this with the couple'}
        </button>
      </div>
    </div>
  )
}

export default function WeddingContacts({ weddingId }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  // No setState before the first await: doing it synchronously inside the
  // effect cascades a render for nothing, and `loading` already starts true.
  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        apiFetch(`${API_URL}/api/admin/wedding-contacts/${weddingId}`),
        apiFetch(`${API_URL}/api/admin/contact-messages/${weddingId}`),
      ])
      setContacts(c.contacts || [])
      setMessages(m.messages || [])
      setNeedsMigration(!!c.needsMigration || !!m.needsMigration)
    } catch (err) {
      toastError(`Could not load the contacts: ${err.message}`)
    }
    setLoading(false)
  }, [weddingId, toastError])

  useEffect(() => { load() }, [load])

  const save = async (form) => {
    setBusy(true)
    try {
      if (editing) {
        const saved = await apiFetch(`${API_URL}/api/admin/wedding-contacts/${editing.id}`, {
          method: 'PATCH', body: JSON.stringify(form),
        })
        setContacts(prev => prev.map(c => (c.id === saved.id ? saved : c)))
        setEditing(null)
      } else {
        const saved = await apiFetch(`${API_URL}/api/admin/wedding-contacts/${weddingId}`, {
          method: 'POST', body: JSON.stringify(form),
        })
        setContacts(prev => [...prev, saved])
        setAdding(false)
        toastSuccess(`${saved.name} added. Their calls and emails will come in on the next sync.`)
      }
    } catch (err) {
      toastError(err.message)
    }
    setBusy(false)
  }

  const remove = async (contact) => {
    if (!window.confirm(`Remove ${contact.name}? Anything already filed from them stays.`)) return
    setBusy(true)
    try {
      await apiFetch(`${API_URL}/api/admin/wedding-contacts/${contact.id}`, { method: 'DELETE' })
      setContacts(prev => prev.filter(c => c.id !== contact.id))
    } catch (err) {
      toastError(`Could not remove them: ${err.message}`)
    }
    setBusy(false)
  }

  const share = async (message, share) => {
    setBusy(true)
    try {
      const saved = await apiFetch(`${API_URL}/api/admin/contact-messages/${message.id}/share`, {
        method: 'POST', body: JSON.stringify({ share }),
      })
      setMessages(prev => prev.map(m => (m.id === saved.id ? saved : m)))
      toastSuccess(share ? 'Shared. It is in their planning notes now.' : 'Taken back. The couple can no longer see it.')
    } catch (err) {
      toastError(err.message)
    }
    setBusy(false)
  }

  if (loading) return <div className="text-sage-500 text-sm">Loading…</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-xl text-sage-700">Family &amp; other contacts</h3>
        <p className="text-sm text-sage-500 mt-1 max-w-2xl">
          The people who ring and email about this wedding but have no login: mothers, mothers-in-law,
          planners. Add their number and address here and their calls and emails are pulled in from the
          next sync onwards. Nothing here is visible to the couple unless you share it.
        </p>
      </div>

      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Migration 028 has not been run on this database yet, so contacts cannot be saved.
        </div>
      )}

      <div className="space-y-3">
        {contacts.map(c => (
          <div key={c.id} className="bg-white border border-cream-200 rounded-xl p-4">
            {editing?.id === c.id ? (
              <ContactForm initial={c} onSave={save} onCancel={() => setEditing(null)} busy={busy} />
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-sage-700">{c.name}</span>
                  {c.relationship && <span className="text-sm text-sage-500">{c.relationship}</span>}
                </div>
                <div className="text-sm text-sage-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {c.phone && <span>{formatPhone(c.phone)}{c.ingest_calls === false ? ' (calls not pulled in)' : ''}</span>}
                  {c.email && <span>{c.email}{c.ingest_email === false ? ' (emails not pulled in)' : ''}</span>}
                  {!c.phone && !c.email && <span className="text-amber-700">No number or address, so nothing can be pulled in for them</span>}
                </div>
                {c.notes && <p className="text-sm text-sage-500 mt-2">{c.notes}</p>}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => setEditing(c)} className="text-xs text-sage-600 underline">Edit</button>
                  <button onClick={() => remove(c)} className="text-xs text-sage-600 underline">Remove</button>
                </div>
              </>
            )}
          </div>
        ))}

        {!contacts.length && !adding && (
          <p className="text-sm text-sage-500">Nobody added yet.</p>
        )}

        {adding
          ? <ContactForm onSave={save} onCancel={() => setAdding(false)} busy={busy} />
          : (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-lg text-sm bg-sage-600 text-white"
            >
              Add someone
            </button>
          )}
      </div>

      <div>
        <h4 className="font-serif text-lg text-sage-700 mb-1">What they said</h4>
        <p className="text-sm text-sage-500 mb-3">
          Venue-side only. Sage will not repeat any of this to the couple unless you share it.
        </p>
        {messages.length ? (
          <div className="space-y-3">
            {messages.map(m => <MessageRow key={m.id} message={m} onShare={share} busy={busy} />)}
          </div>
        ) : (
          <p className="text-sm text-sage-500">
            Nothing yet. Calls and emails appear here after the next Phone &amp; SMS or Gmail sync.
          </p>
        )}
      </div>
    </div>
  )
}

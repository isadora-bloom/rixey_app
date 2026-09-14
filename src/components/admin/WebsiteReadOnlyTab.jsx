import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api'
import { loadJson } from '../../utils/api'
import LoadError from '../ui/LoadError'

/**
 * The couple's own words about their day, read-only for the venue.
 *
 * Everything here is written on the couple's side, in WebsiteBuilder.jsx —
 * this panel reads the same `GET /api/wedding-website/:weddingId` and shows
 * it as prose, with nowhere to edit it. Before this the venue could not see
 * their story, FAQ or things-to-do at all without logging in as the couple.
 */

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-sage-400">{label}</p>
      <p className="text-sm text-sage-700 whitespace-pre-wrap mt-0.5">{value}</p>
    </div>
  )
}

const fetchSettings = (weddingId) => loadJson(`${API_URL}/api/wedding-website/${weddingId}`)

export default function WebsiteReadOnlyTab({ weddingId }) {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    fetchSettings(weddingId).then(setSettings).catch(err => setError(err))
  }

  useEffect(() => {
    if (!weddingId) return
    let alive = true
    fetchSettings(weddingId)
      .then(data => { if (alive) setSettings(data) })
      .catch(err => { if (alive) setError(err) })
    return () => { alive = false }
  }, [weddingId])

  if (error) return <LoadError what="the couple's website" error={error} onRetry={load} />
  if (!settings) return <p className="text-sage-400 text-sm text-center py-8">Loading…</p>

  if (!settings.wedding_id) {
    return (
      <div className="border border-dashed border-cream-300 rounded-xl py-12 text-center">
        <p className="text-sage-400 text-sm">The couple has not started their website yet.</p>
      </div>
    )
  }

  const registryLinks = (settings.registry_links || []).filter(r => r.url?.trim())
  const faqItems = (settings.faq_items || []).filter(f => f.question?.trim())
  const thingsToDo = (settings.things_to_do || []).filter(t => t.name?.trim())
  const dressCode = [settings.dress_code, settings.dress_code_note].filter(Boolean).join(' — ')
  const siteUrl = settings.slug ? `${APP_URL}/w/${settings.slug}` : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Their wedding website</h2>
          <p className="text-sage-500 text-sm mt-0.5">
            Read-only here. The couple writes and edits this themselves in their own portal.
          </p>
        </div>
        {siteUrl && (
          <a
            href={settings.published ? siteUrl : `${siteUrl}?preview=${weddingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm px-4 py-2 rounded-lg border border-sage-300 text-sage-700 hover:bg-cream-50 transition"
          >
            Preview site ↗
          </a>
        )}
      </div>

      {!settings.published && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Not published yet. The preview link only works signed in as the venue.
        </p>
      )}

      <div className="space-y-4 bg-white border border-cream-200 rounded-xl p-5">
        <Field label="Welcome message" value={settings.welcome_message} />
        <Field label="Our story" value={settings.our_story} />
        <Field label="The proposal" value={settings.the_proposal} />
        <Field label="Dress code" value={dressCode} />
      </div>

      {thingsToDo.length > 0 && (
        <div className="bg-white border border-cream-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-400 mb-2">Things to do nearby</p>
          <div className="space-y-2">
            {thingsToDo.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="text-sage-800 font-medium">{t.name}</span>
                {t.type && <span className="text-sage-400"> · {t.type}</span>}
                {t.description && <p className="text-sage-600 mt-0.5">{t.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {faqItems.length > 0 && (
        <div className="bg-white border border-cream-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-400 mb-2">FAQ</p>
          <div className="space-y-3">
            {faqItems.map((f, i) => (
              <div key={i} className="text-sm">
                <p className="text-sage-800 font-medium">{f.question}</p>
                {f.answer && <p className="text-sage-600 mt-0.5">{f.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {registryLinks.length > 0 && (
        <div className="bg-white border border-cream-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-400 mb-2">Registry</p>
          <div className="flex flex-wrap gap-2">
            {registryLinks.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg border border-sage-200 text-sage-700 hover:bg-sage-50 transition"
              >
                {r.label || r.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {!settings.welcome_message && !settings.our_story && !settings.the_proposal
        && !faqItems.length && !thingsToDo.length && !registryLinks.length && !dressCode && (
        <p className="text-sage-400 text-sm text-center py-8">
          Nothing written yet beyond the basics.
        </p>
      )}
    </div>
  )
}

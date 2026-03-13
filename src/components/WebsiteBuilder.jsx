import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const SECTION_TOGGLES = [
  { key: 'show_story',          label: 'Our Story',        note: 'Written by you below' },
  { key: 'show_wedding_party',  label: 'Wedding Party',    note: 'From your wedding party list' },
  { key: 'show_dress_code',     label: 'Dress Code',       note: 'Set below' },
  { key: 'show_schedule',       label: 'The Day',          note: 'Ceremony & reception times' },
  { key: 'show_transport',      label: 'Transportation',   note: 'From your shuttle schedule' },
  { key: 'show_accommodations', label: 'Where to Stay',    note: 'Rixey\'s curated list' },
  { key: 'show_registry',       label: 'Registry',         note: 'Links set below' },
  { key: 'show_faq',            label: 'FAQ',              note: 'Questions set below' },
  { key: 'show_gallery',        label: 'Photo Gallery',    note: 'Photos tagged "website"' },
]

const DRESS_CODE_OPTIONS = [
  { value: 'black_tie',      label: 'Black Tie' },
  { value: 'black_tie_opt',  label: 'Black Tie Optional' },
  { value: 'cocktail',       label: 'Cocktail Attire' },
  { value: 'garden',         label: 'Garden Party' },
  { value: 'smart_casual',   label: 'Smart Casual' },
  { value: 'casual',         label: 'Casual' },
  { value: 'custom',         label: 'Custom (describe below)' },
]

function CollapsibleSection({ title, hint, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-cream-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-cream-50 hover:bg-cream-100 transition text-left"
      >
        <div>
          <p className="font-medium text-sage-700">{title}</p>
          {hint && !open && <p className="text-xs text-sage-400 mt-0.5">{hint}</p>}
        </div>
        <svg className={`w-4 h-4 text-sage-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-5 space-y-4 bg-white">{children}</div>}
    </div>
  )
}

export default function WebsiteBuilder({ weddingId, coupleNames }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState(false)

  // Form state
  const [theme, setTheme]                     = useState('warm')
  const [slug, setSlug]                       = useState('')
  const [published, setPublished]             = useState(false)
  const [welcomeMsg, setWelcomeMsg]           = useState('')
  const [ourStory, setOurStory]               = useState('')
  const [ceremonyTime, setCeremonyTime]       = useState('')
  const [receptionTime, setReceptionTime]     = useState('')
  const [dressCode, setDressCode]             = useState('')
  const [dressCodeNote, setDressCodeNote]     = useState('')
  const [unplugged, setUnplugged]             = useState(false)
  const [kidsPolicy, setKidsPolicy]           = useState('')
  const [plusOnePolicy, setPlusOnePolicy]     = useState('')
  const [signatureCocktail, setSignatureCocktail] = useState('')
  const [registryLinks, setRegistryLinks]     = useState([{ label: '', url: '' }])
  const [faqItems, setFaqItems]               = useState([{ question: '', answer: '' }])
  const [sections, setSections]               = useState(
    Object.fromEntries(SECTION_TOGGLES.map(s => [s.key, true]))
  )

  useEffect(() => { loadSettings() }, [weddingId])

  const loadSettings = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/wedding-website/${weddingId}`)
      const data = await res.json()
      if (data && data.wedding_id) {
        setSettings(data)
        setTheme(data.theme || 'warm')
        setSlug(data.slug || slugify(coupleNames || ''))
        setPublished(data.published || false)
        setWelcomeMsg(data.welcome_message || '')
        setOurStory(data.our_story || '')
        setCeremonyTime(data.ceremony_time || '')
        setReceptionTime(data.reception_time || '')
        setDressCode(data.dress_code || '')
        setDressCodeNote(data.dress_code_note || '')
        setUnplugged(data.unplugged_ceremony || false)
        setKidsPolicy(data.kids_policy || '')
        setPlusOnePolicy(data.plus_one_policy || '')
        setSignatureCocktail(data.signature_cocktail || '')
        setRegistryLinks(data.registry_links?.length ? data.registry_links : [{ label: '', url: '' }])
        setFaqItems(data.faq_items?.length ? data.faq_items : [{ question: '', answer: '' }])
        const s = {}
        SECTION_TOGGLES.forEach(t => { s[t.key] = data[t.key] !== false })
        setSections(s)
      } else {
        // First time — auto-generate slug from couple names
        setSlug(slugify(coupleNames || ''))
      }
    } catch (err) {
      console.error('Failed to load website settings:', err)
    }
    setLoading(false)
  }

  const handleSave = async (publishOverride) => {
    setSaving(true)
    const isPublished = publishOverride !== undefined ? publishOverride : published
    const payload = {
      theme, slug: slug.trim(), published: isPublished,
      welcome_message: welcomeMsg, our_story: ourStory,
      ceremony_time: ceremonyTime || null, reception_time: receptionTime || null,
      dress_code: dressCode, dress_code_note: dressCodeNote,
      unplugged_ceremony: unplugged, kids_policy: kidsPolicy,
      plus_one_policy: plusOnePolicy, signature_cocktail: signatureCocktail,
      registry_links: registryLinks.filter(r => r.url.trim()),
      faq_items: faqItems.filter(f => f.question.trim()),
      ...sections,
    }
    try {
      await fetch(`${API_URL}/api/wedding-website/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (publishOverride !== undefined) setPublished(publishOverride)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const siteUrl = `${APP_URL}/w/${slug}`

  const copyLink = () => {
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p className="text-sage-400 text-center py-8">Loading website settings…</p>

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-sage-700">Your Wedding Website</h3>
          <p className="text-sage-500 text-sm">Built from your planning — no starting from scratch</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 font-medium">Saved ✓</span>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Setup */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-cream-50 border-b border-cream-200">
          <p className="font-medium text-sage-700">Setup</p>
        </div>
        <div className="p-5 space-y-5">

          {/* Theme picker */}
          <div>
            <p className="text-sm font-medium text-sage-600 mb-3">Choose a style</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Warm theme card */}
              <button
                type="button"
                onClick={() => setTheme('warm')}
                className={`rounded-xl border-2 overflow-hidden text-left transition ${
                  theme === 'warm' ? 'border-sage-500 ring-2 ring-sage-200' : 'border-cream-200 hover:border-sage-300'
                }`}
              >
                {/* Mini preview */}
                <div className="bg-[#FDFAF6] p-3 space-y-1.5 border-b border-cream-100">
                  <div className="w-full h-8 rounded bg-[#4a7c59]/20" />
                  <div className="h-2 rounded bg-[#4a7c59]/30 w-3/4 mx-auto" />
                  <div className="h-1.5 rounded bg-[#4a7c59]/15 w-1/2 mx-auto" />
                  <div className="flex gap-1 mt-2">
                    <div className="flex-1 h-5 rounded-lg bg-white border border-cream-200" />
                    <div className="flex-1 h-5 rounded-lg bg-white border border-cream-200" />
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-sage-700">Warm</p>
                  <p className="text-xs text-sage-400">Cream, soft, botanical</p>
                </div>
              </button>

              {/* Editorial theme card */}
              <button
                type="button"
                onClick={() => setTheme('editorial')}
                className={`rounded-xl border-2 overflow-hidden text-left transition ${
                  theme === 'editorial' ? 'border-sage-500 ring-2 ring-sage-200' : 'border-cream-200 hover:border-sage-300'
                }`}
              >
                {/* Mini preview */}
                <div className="bg-white p-3 space-y-1.5 border-b border-gray-100">
                  <div className="w-full h-8 rounded-sm bg-gray-900" />
                  <div className="h-2 rounded-sm bg-gray-800 w-3/4 mx-auto" />
                  <div className="h-1.5 rounded-sm bg-gray-400 w-1/2 mx-auto" />
                  <div className="flex gap-1 mt-2">
                    <div className="flex-1 h-5 border border-gray-200" />
                    <div className="flex-1 h-5 border border-gray-200" />
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-gray-800">Editorial</p>
                  <p className="text-xs text-gray-400">White, minimal, clean</p>
                </div>
              </button>
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-sage-600 mb-1">Your website address</label>
            <div className="flex items-center gap-2">
              <span className="text-sage-400 text-sm flex-shrink-0">{APP_URL}/w/</span>
              <input
                value={slug}
                onChange={e => setSlug(slugify(e.target.value))}
                className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                placeholder="sarah-and-alex"
              />
            </div>
            <p className="text-xs text-sage-400 mt-1">Lowercase letters and hyphens only</p>
          </div>

          {/* Publish */}
          <div className={`rounded-xl p-4 border-2 ${published ? 'border-green-300 bg-green-50' : 'border-cream-300 bg-cream-50'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`font-medium text-sm ${published ? 'text-green-700' : 'text-sage-600'}`}>
                  {published ? '✓ Your website is live' : 'Website is unpublished'}
                </p>
                {published && (
                  <p className="text-xs text-green-600 mt-0.5">{siteUrl}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {published && (
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg text-xs hover:bg-green-50"
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSave(!published)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    published
                      ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
            {published && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <a
                  href={`/w/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Preview your website →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content sections */}
      <CollapsibleSection title="Welcome & Our Story" hint="The first words guests see" defaultOpen>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Welcome message</label>
          <input
            value={welcomeMsg}
            onChange={e => setWelcomeMsg(e.target.value)}
            placeholder="We can't wait to celebrate with you…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Our story</label>
          <textarea
            value={ourStory}
            onChange={e => setOurStory(e.target.value)}
            rows={5}
            placeholder="How you met, the proposal, what brought you to Rixey…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="The Day" hint="Ceremony and reception times">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Ceremony starts</label>
            <input
              type="time"
              value={ceremonyTime}
              onChange={e => setCeremonyTime(e.target.value)}
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Reception starts</label>
            <input
              type="time"
              value={receptionTime}
              onChange={e => setReceptionTime(e.target.value)}
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={unplugged}
            onChange={e => setUnplugged(e.target.checked)}
            className="w-4 h-4 accent-sage-600"
          />
          <span className="text-sm text-sage-700">Unplugged ceremony — please put phones away</span>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Dress Code" hint="What to wear">
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Attire</label>
          <select
            value={dressCode}
            onChange={e => setDressCode(e.target.value)}
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          >
            <option value="">Select attire level…</option>
            {DRESS_CODE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Additional note</label>
          <input
            value={dressCodeNote}
            onChange={e => setDressCodeNote(e.target.value)}
            placeholder="e.g. Ladies, avoid stilettos on the lawn · Please avoid white"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>
        <p className="text-xs text-sage-400">Photos tagged <span className="font-mono bg-cream-100 px-1 rounded">dress-code</span> + <span className="font-mono bg-cream-100 px-1 rounded">website</span> will appear here automatically</p>
      </CollapsibleSection>

      <CollapsibleSection title="Registry" hint="Where guests can shop">
        <div className="space-y-3">
          {registryLinks.map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={link.label}
                onChange={e => setRegistryLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                placeholder="Label (e.g. Zola)"
                className="w-28 flex-shrink-0 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
              <input
                value={link.url}
                onChange={e => setRegistryLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                placeholder="https://…"
                className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
              {registryLinks.length > 1 && (
                <button type="button" onClick={() => setRegistryLinks(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1">×</button>
              )}
            </div>
          ))}
          {registryLinks.length < 3 && (
            <button
              type="button"
              onClick={() => setRegistryLinks(prev => [...prev, { label: '', url: '' }])}
              className="text-sage-500 hover:text-sage-700 text-sm"
            >
              + Add another registry
            </button>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Policies" hint="Kids, plus ones, questions">
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Signature cocktail</label>
          <input value={signatureCocktail} onChange={e => setSignatureCocktail(e.target.value)} placeholder="e.g. Aperol Spritz" className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Children</label>
          <input value={kidsPolicy} onChange={e => setKidsPolicy(e.target.value)} placeholder="e.g. Children are welcome · Adults-only event" className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Plus ones</label>
          <input value={plusOnePolicy} onChange={e => setPlusOnePolicy(e.target.value)} placeholder="e.g. Please check your invitation" className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="FAQ" hint="Frequently asked questions">
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div key={i} className="space-y-2 p-3 bg-cream-50 rounded-lg border border-cream-200">
              <div className="flex items-center gap-2">
                <input
                  value={item.question}
                  onChange={e => setFaqItems(prev => prev.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                  placeholder="Question"
                  className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
                {faqItems.length > 1 && (
                  <button type="button" onClick={() => setFaqItems(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1 flex-shrink-0">×</button>
                )}
              </div>
              <textarea
                value={item.answer}
                onChange={e => setFaqItems(prev => prev.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))}
                placeholder="Answer"
                rows={2}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaqItems(prev => [...prev, { question: '', answer: '' }])}
            className="text-sage-500 hover:text-sage-700 text-sm"
          >
            + Add question
          </button>
        </div>
      </CollapsibleSection>

      {/* Section visibility */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-cream-50 border-b border-cream-200">
          <p className="font-medium text-sage-700">Sections</p>
          <p className="text-xs text-sage-400 mt-0.5">Choose what appears on your website</p>
        </div>
        <div className="p-5 space-y-2">
          {SECTION_TOGGLES.map(({ key, label, note }) => (
            <label key={key} className="flex items-center justify-between gap-4 py-2 cursor-pointer group">
              <div>
                <p className="text-sm font-medium text-sage-700 group-hover:text-sage-900">{label}</p>
                <p className="text-xs text-sage-400">{note}</p>
              </div>
              <div
                onClick={() => setSections(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer relative ${sections[key] ? 'bg-sage-500' : 'bg-cream-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${sections[key] ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-sage-400">
          Getting there, venue info, and accommodations are always included and pre-filled by Rixey
        </p>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="px-6 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

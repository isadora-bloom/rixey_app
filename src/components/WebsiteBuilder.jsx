import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import { Button, Input } from './ui'

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
  { key: 'show_rsvp',           label: 'RSVP',             note: 'Lets guests confirm attendance on your site' },
  { key: 'show_things_to_do',   label: 'Things to Do',     note: 'Nearby restaurants, activities, wineries' },
]

const DEFAULT_SECTION_ORDER = SECTION_TOGGLES.map(s => s.key)

const THINGS_TO_DO_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'winery',     label: 'Winery' },
  { value: 'activity',   label: 'Activity' },
  { value: 'attraction', label: 'Attraction' },
  { value: 'shopping',   label: 'Shopping' },
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

const THEME_OPTIONS = [
  { key: 'warm',      label: 'Warm',      desc: 'Cream, soft, botanical',     bg: '#FDFAF6', bar: '#4a7c59', barLight: 'rgba(74,124,89,0.2)', text: '#4a7c59', cardBorder: '#e8e0d8' },
  { key: 'editorial', label: 'Editorial',  desc: 'White, minimal, clean',      bg: '#ffffff', bar: '#111827', barLight: '#111827',            text: '#111827', cardBorder: '#e5e7eb' },
  { key: 'romantic',  label: 'Romantic',   desc: 'Blush, delicate, soft',      bg: '#FDF2F4', bar: '#be123c', barLight: 'rgba(190,18,60,0.2)', text: '#9f1239', cardBorder: '#fecdd3' },
  { key: 'modern',    label: 'Modern',     desc: 'Bold, clean, high-contrast', bg: '#ffffff', bar: '#000000', barLight: '#000000',            text: '#000000', cardBorder: '#d1d5db' },
  { key: 'rustic',    label: 'Rustic',     desc: 'Earth tones, natural, warm', bg: '#F5F0E8', bar: '#92400e', barLight: 'rgba(146,64,14,0.2)', text: '#78350f', cardBorder: '#d6cfc4' },
]

const ACCENT_PRESETS = [
  { color: '#6B8F71', label: 'Sage' },
  { color: '#D4A0A0', label: 'Blush' },
  { color: '#1e3a5f', label: 'Navy' },
  { color: '#C5993E', label: 'Gold' },
  { color: '#722F37', label: 'Burgundy' },
  { color: '#C4553A', label: 'Terracotta' },
  { color: '#9B7EC8', label: 'Lavender' },
  { color: '#64748B', label: 'Slate' },
]

const FONT_PAIR_OPTIONS = [
  { key: 'classic',  label: 'Classic',  desc: 'Playfair Display + Lora',            preview: "'Playfair Display', serif" },
  { key: 'modern',   label: 'Modern',   desc: 'Inter + Inter',                      preview: "'Inter', sans-serif" },
  { key: 'elegant',  label: 'Elegant',  desc: 'Cormorant Garamond + Proza Libre',   preview: "'Cormorant Garamond', serif" },
  { key: 'friendly', label: 'Friendly', desc: 'Josefin Sans + Nunito',              preview: "'Josefin Sans', sans-serif" },
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

  // RSVP analytics
  const [rsvpCounts, setRsvpCounts] = useState({ total: 0, yes: 0, no: 0, pending: 0 })

  // Slug collision check
  const [slugStatus, setSlugStatus] = useState('idle') // 'idle' | 'checking' | 'available' | 'taken'

  // Password protection
  const [accessPassword, setAccessPassword] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(false)

  // Preview state
  const [activeTab, setActiveTab]             = useState('edit') // 'edit' | 'preview'
  const [previewDevice, setPreviewDevice]     = useState('mobile') // 'mobile' | 'desktop'

  // Form state
  const [accentColor, setAccentColor]         = useState('')
  const [fontPair, setFontPair]               = useState('')
  const [heroPretext, setHeroPretext]         = useState('')
  const [theme, setTheme]                     = useState('warm')
  const [slug, setSlug]                       = useState('')
  const [published, setPublished]             = useState(false)
  const [welcomeMsg, setWelcomeMsg]           = useState('')
  const [ourStory, setOurStory]               = useState('')
  const [theProposal, setTheProposal]         = useState('')
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
  const [thingsToDo, setThingsToDo]           = useState([{ name: '', description: '', type: 'restaurant', distance: '', url: '' }])
  const [rsvpDeadline, setRsvpDeadline]       = useState('')
  const [rsvpNote, setRsvpNote]               = useState('')
  const [footerMessage, setFooterMessage]     = useState('')
  const [sectionOrder, setSectionOrder]       = useState(DEFAULT_SECTION_ORDER)
  const [sections, setSections]               = useState(
    Object.fromEntries(SECTION_TOGGLES.map(s => [s.key, true]))
  )

  useEffect(() => { loadSettings() }, [weddingId])

  // Fetch RSVP counts from guest list
  useEffect(() => {
    if (!weddingId) return
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/guests/${weddingId}`, { headers: await authHeaders() })
        const data = await res.json()
        const guests = data.guests || []
        const yes = guests.filter(g => g.rsvp === 'yes').length
        const no  = guests.filter(g => g.rsvp === 'no').length
        const pending = guests.length - yes - no
        setRsvpCounts({ total: guests.length, yes, no, pending })
      } catch (err) {
        console.error('Failed to load RSVP counts:', err)
      }
    })()
  }, [weddingId])

  // Debounced slug availability check
  useEffect(() => {
    if (!slug || slug.length < 2) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/wedding-website/check-slug/${encodeURIComponent(slug)}?exclude=${weddingId}`, { headers: await authHeaders() })
        const data = await res.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [slug, weddingId])

  const loadSettings = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/wedding-website/${weddingId}`, { headers: await authHeaders() })
      const data = await res.json()
      if (data && data.wedding_id) {
        setSettings(data)
        setTheme(data.theme || 'warm')
        setAccentColor(data.accent_color || '')
        setFontPair(data.font_pair || '')
        setHeroPretext(data.hero_pretext || '')
        setSlug(data.slug || slugify(coupleNames || ''))
        setPublished(data.published || false)
        setWelcomeMsg(data.welcome_message || '')
        setOurStory(data.our_story || '')
        setTheProposal(data.the_proposal || '')
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
        setThingsToDo(data.things_to_do?.length ? data.things_to_do : [{ name: '', description: '', type: 'restaurant', distance: '', url: '' }])
        setRsvpDeadline(data.rsvp_deadline || '')
        setRsvpNote(data.rsvp_note || '')
        setFooterMessage(data.footer_message || '')
        setAccessPassword(data.access_password || '')
        setPasswordEnabled(!!data.access_password)
        setSectionOrder(data.section_order?.length ? data.section_order : DEFAULT_SECTION_ORDER)
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
      accent_color: accentColor || null,
      font_pair: fontPair || null,
      hero_pretext: heroPretext || null,
      welcome_message: welcomeMsg, our_story: ourStory, the_proposal: theProposal,
      ceremony_time: ceremonyTime || null, reception_time: receptionTime || null,
      dress_code: dressCode, dress_code_note: dressCodeNote,
      unplugged_ceremony: unplugged, kids_policy: kidsPolicy,
      plus_one_policy: plusOnePolicy, signature_cocktail: signatureCocktail,
      registry_links: registryLinks.filter(r => r.url.trim()),
      faq_items: faqItems.filter(f => f.question.trim()),
      things_to_do: thingsToDo.filter(t => t.name.trim()),
      rsvp_deadline: rsvpDeadline || null,
      rsvp_note: rsvpNote || null,
      footer_message: footerMessage || null,
      access_password: passwordEnabled ? accessPassword : null,
      section_order: sectionOrder,
      ...sections,
    }
    try {
      await fetch(`${API_URL}/api/wedding-website/${weddingId}`, {
        method: 'PUT',
        headers: await authHeaders(),
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

  const moveSectionOrder = (index, direction) => {
    const newOrder = [...sectionOrder]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    setSectionOrder(newOrder)
  }

  const handlePreviewTab = async () => {
    // Auto-save before showing preview
    await handleSave()
    setActiveTab('preview')
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
          <Button
            onClick={() => handleSave()}
            disabled={saving || slugStatus === 'taken'}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Edit / Preview toggle */}
      <div className="flex items-center gap-1 bg-cream-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'edit' ? 'bg-white text-sage-700 shadow-sm' : 'text-sage-500 hover:text-sage-700'
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handlePreviewTab}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'preview' ? 'bg-white text-sage-700 shadow-sm' : 'text-sage-500 hover:text-sage-700'
          }`}
        >
          {saving ? 'Saving…' : 'Preview'}
        </button>
      </div>

      {/* Preview pane */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {!published && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
              Preview shows what your site will look like when published
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                previewDevice === 'mobile' ? 'bg-sage-500 text-white' : 'bg-cream-100 text-sage-600 hover:bg-cream-200'
              }`}
            >
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                previewDevice === 'desktop' ? 'bg-sage-500 text-white' : 'bg-cream-100 text-sage-600 hover:bg-cream-200'
              }`}
            >
              Desktop
            </button>
          </div>
          <div className={`mx-auto ${previewDevice === 'mobile' ? 'max-w-sm' : 'w-full'}`}>
            <div className={`${previewDevice === 'mobile' ? 'aspect-[9/16] border-[6px] border-gray-800 rounded-[2rem] overflow-hidden shadow-xl' : 'aspect-video border border-cream-300 rounded-xl overflow-hidden shadow-sm'}`}>
              <iframe
                src={`/w/${slug}?preview=${weddingId}`}
                className="w-full h-full bg-white"
                title="Website preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit form — hidden when previewing */}
      {activeTab === 'edit' && (<>

      {/* Setup */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-cream-50 border-b border-cream-200">
          <p className="font-medium text-sage-700">Setup</p>
        </div>
        <div className="p-5 space-y-5">

          {/* Theme picker */}
          <div>
            <p className="text-sm font-medium text-sage-600 mb-3">Choose a style</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme(opt.key)}
                  className={`rounded-xl border-2 overflow-hidden text-left transition ${
                    theme === opt.key ? 'border-sage-500 ring-2 ring-sage-200' : 'border-cream-200 hover:border-sage-300'
                  }`}
                >
                  <div className="p-3 space-y-1.5 border-b" style={{ backgroundColor: opt.bg, borderColor: opt.cardBorder }}>
                    <div className="w-full h-8 rounded" style={{ backgroundColor: opt.barLight }} />
                    <div className="h-2 rounded w-3/4 mx-auto" style={{ backgroundColor: opt.barLight, opacity: 0.8 }} />
                    <div className="h-1.5 rounded w-1/2 mx-auto" style={{ backgroundColor: opt.barLight, opacity: 0.5 }} />
                    <div className="flex gap-1 mt-2">
                      <div className="flex-1 h-5 rounded-lg bg-white" style={{ border: `1px solid ${opt.cardBorder}` }} />
                      <div className="flex-1 h-5 rounded-lg bg-white" style={{ border: `1px solid ${opt.cardBorder}` }} />
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold" style={{ color: opt.text }}>{opt.label}</p>
                    <p className="text-xs text-sage-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent color picker */}
          <div>
            <p className="text-sm font-medium text-sage-600 mb-1">Accent color</p>
            <p className="text-xs text-sage-400 mb-3">Overrides buttons and highlights. Leave blank to use theme default.</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map(preset => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setAccentColor(accentColor === preset.color ? '' : preset.color)}
                  title={preset.label}
                  className={`w-9 h-9 rounded-full border-2 transition flex items-center justify-center ${
                    accentColor === preset.color ? 'border-sage-500 ring-2 ring-sage-200 scale-110' : 'border-cream-200 hover:border-sage-300'
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {accentColor === preset.color && (
                    <svg className="w-4 h-4 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font pair selector */}
          <div>
            <p className="text-sm font-medium text-sage-600 mb-1">Fonts</p>
            <p className="text-xs text-sage-400 mb-3">Choose a heading + body font pair</p>
            <div className="grid grid-cols-2 gap-2">
              {FONT_PAIR_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFontPair(fontPair === opt.key ? '' : opt.key)}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    fontPair === opt.key ? 'border-sage-500 ring-2 ring-sage-200' : 'border-cream-200 hover:border-sage-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-sage-700">{opt.label}</p>
                  <p className="text-xs text-sage-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-sage-600 mb-1">Your website address</label>
            <div className="flex items-center gap-2">
              <span className="text-sage-400 text-sm flex-shrink-0">{APP_URL}/w/</span>
              <div className="flex-1 relative">
                <Input
                  value={slug}
                  onChange={e => setSlug(slugify(e.target.value))}
                  className={`w-full ${slugStatus === 'taken' ? 'border-red-300 focus:ring-red-300' : ''}`}
                  placeholder="sarah-and-alex"
                />
                {slugStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
                  </div>
                )}
                {slugStatus === 'available' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {slugStatus === 'taken' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-sage-400">Lowercase letters and hyphens only</p>
              {slugStatus === 'taken' && (
                <p className="text-xs text-red-500 font-medium">This address is already in use</p>
              )}
              {slugStatus === 'available' && (
                <p className="text-xs text-green-500 font-medium">Available</p>
              )}
            </div>
          </div>

          {/* Password protection */}
          <div>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-sage-600">Password protect</p>
                <p className="text-xs text-sage-400">Require a password to view your website</p>
              </div>
              <div
                onClick={() => setPasswordEnabled(!passwordEnabled)}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer relative ${passwordEnabled ? 'bg-sage-500' : 'bg-cream-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${passwordEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </label>
            {passwordEnabled && (
              <div className="mt-3">
                <Input
                  value={accessPassword}
                  onChange={e => setAccessPassword(e.target.value)}
                  placeholder="Enter a password for guests"
                  className="w-full"
                />
                <p className="text-xs text-sage-400 mt-1">Guests will need this password to view your site. Share it in your invitations.</p>
              </div>
            )}
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
                  disabled={slugStatus === 'taken'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
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
                <button
                  type="button"
                  onClick={handlePreviewTab}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Preview your website →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content sections */}
      <CollapsibleSection title="Welcome & Our Story" hint="The first words guests see" defaultOpen>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Hero pre-text</label>
          <Input
            value={heroPretext}
            onChange={e => setHeroPretext(e.target.value)}
            placeholder={theme === 'editorial' || theme === 'modern' ? 'The wedding of' : 'You are invited to celebrate'}
          />
          <p className="text-xs text-sage-400 mt-1">The line that appears above your names on the hero. Leave blank for the theme default.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Welcome message</label>
          <Input
            value={welcomeMsg}
            onChange={e => setWelcomeMsg(e.target.value)}
            placeholder="We can't wait to celebrate with you…"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">How we met</label>
          <textarea
            value={ourStory}
            onChange={e => setOurStory(e.target.value)}
            rows={4}
            placeholder="How you met, the first date, what made you know…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">The proposal</label>
          <textarea
            value={theProposal}
            onChange={e => setTheProposal(e.target.value)}
            rows={4}
            placeholder="Where it happened, who was there, the ring…"
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
          <Input
            value={dressCodeNote}
            onChange={e => setDressCodeNote(e.target.value)}
            placeholder="e.g. Ladies, avoid stilettos on the lawn · Please avoid white"
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
          {registryLinks.length < 6 && (
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
          <Input value={signatureCocktail} onChange={e => setSignatureCocktail(e.target.value)} placeholder="e.g. Aperol Spritz" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Children</label>
          <Input value={kidsPolicy} onChange={e => setKidsPolicy(e.target.value)} placeholder="e.g. Children are welcome · Adults-only event" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Plus ones</label>
          <Input value={plusOnePolicy} onChange={e => setPlusOnePolicy(e.target.value)} placeholder="e.g. Please check your invitation" />
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

      <CollapsibleSection title="Things to Do" hint="Nearby restaurants, activities, wineries">
        <div className="space-y-3">
          {thingsToDo.map((item, i) => (
            <div key={i} className="space-y-2 p-3 bg-cream-50 rounded-lg border border-cream-200">
              <div className="flex items-center gap-2">
                <input
                  value={item.name}
                  onChange={e => setThingsToDo(prev => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
                  placeholder="Name"
                  className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
                <select
                  value={item.type}
                  onChange={e => setThingsToDo(prev => prev.map((t, j) => j === i ? { ...t, type: e.target.value } : t))}
                  className="w-32 flex-shrink-0 border border-cream-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                >
                  {THINGS_TO_DO_TYPES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {thingsToDo.length > 1 && (
                  <button type="button" onClick={() => setThingsToDo(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1 flex-shrink-0">×</button>
                )}
              </div>
              <textarea
                value={item.description}
                onChange={e => setThingsToDo(prev => prev.map((t, j) => j === i ? { ...t, description: e.target.value } : t))}
                placeholder="Short description"
                rows={2}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              />
              <div className="flex gap-2">
                <input
                  value={item.distance}
                  onChange={e => setThingsToDo(prev => prev.map((t, j) => j === i ? { ...t, distance: e.target.value } : t))}
                  placeholder="Distance (e.g. 10 min)"
                  className="w-40 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
                <input
                  value={item.url}
                  onChange={e => setThingsToDo(prev => prev.map((t, j) => j === i ? { ...t, url: e.target.value } : t))}
                  placeholder="Website URL (optional)"
                  className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setThingsToDo(prev => [...prev, { name: '', description: '', type: 'restaurant', distance: '', url: '' }])}
            className="text-sage-500 hover:text-sage-700 text-sm"
          >
            + Add place
          </button>
        </div>
      </CollapsibleSection>

      {/* RSVP Summary */}
      {rsvpCounts.total > 0 && (
        <div className="border border-cream-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-cream-50 border-b border-cream-200">
            <p className="font-medium text-sage-700">RSVP Summary</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-4 gap-3 text-center mb-4">
              <div>
                <p className="text-2xl font-semibold text-sage-700">{rsvpCounts.total}</p>
                <p className="text-xs text-sage-400">Invited</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-600">{rsvpCounts.yes}</p>
                <p className="text-xs text-sage-400">Attending</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-red-400">{rsvpCounts.no}</p>
                <p className="text-xs text-sage-400">Declined</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-amber-500">{rsvpCounts.pending}</p>
                <p className="text-xs text-sage-400">Pending</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2.5 bg-cream-100 rounded-full overflow-hidden flex">
              {rsvpCounts.yes > 0 && (
                <div className="bg-green-500 h-full transition-all" style={{ width: `${(rsvpCounts.yes / rsvpCounts.total) * 100}%` }} />
              )}
              {rsvpCounts.no > 0 && (
                <div className="bg-red-400 h-full transition-all" style={{ width: `${(rsvpCounts.no / rsvpCounts.total) * 100}%` }} />
              )}
              {rsvpCounts.pending > 0 && (
                <div className="bg-amber-300 h-full transition-all" style={{ width: `${(rsvpCounts.pending / rsvpCounts.total) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-sage-400"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Attending</span>
              <span className="flex items-center gap-1.5 text-xs text-sage-400"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Declined</span>
              <span className="flex items-center gap-1.5 text-xs text-sage-400"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" /> Pending</span>
            </div>
          </div>
        </div>
      )}

      <CollapsibleSection title="RSVP" hint="Let guests confirm online — writes directly to your guest list">
        <p className="text-xs text-sage-500 bg-sage-50 rounded-lg px-3 py-2">
          Guests search for their name on your website and confirm attendance. Their response updates your guest list automatically — no manual chasing.
        </p>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">RSVP deadline</label>
          <input
            type="date"
            value={rsvpDeadline}
            onChange={e => setRsvpDeadline(e.target.value)}
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
          <p className="text-xs text-sage-400 mt-1">The form automatically closes after this date. Leave blank to always show.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Note to guests</label>
          <textarea
            value={rsvpNote}
            onChange={e => setRsvpNote(e.target.value)}
            rows={2}
            placeholder="e.g. Please RSVP by June 1st. If you have trouble finding your name, reach out to us directly."
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </div>
        <p className="text-xs text-sage-400">
          Meal choices come from your guest list settings (if plated meals are enabled for this wedding).
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Footer" hint="Personal sign-off at the bottom of your site">
        <div>
          <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Footer message</label>
          <Input
            value={footerMessage}
            onChange={e => setFooterMessage(e.target.value)}
            placeholder="e.g. We can't wait to celebrate with you"
          />
          <p className="text-xs text-sage-400 mt-1">A personal note that appears at the very bottom of your website</p>
        </div>
      </CollapsibleSection>

      {/* Section visibility & order */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-cream-50 border-b border-cream-200">
          <p className="font-medium text-sage-700">Sections</p>
          <p className="text-xs text-sage-400 mt-0.5">Toggle and reorder what appears on your website</p>
        </div>
        <div className="p-5 space-y-1">
          {sectionOrder.map((key, idx) => {
            const toggle = SECTION_TOGGLES.find(t => t.key === key)
            if (!toggle) return null
            return (
              <div key={key} className="flex items-center justify-between gap-3 py-2 group">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveSectionOrder(idx, -1)}
                      disabled={idx === 0}
                      className={`p-0.5 rounded text-sage-400 hover:text-sage-700 hover:bg-cream-100 transition ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSectionOrder(idx, 1)}
                      disabled={idx === sectionOrder.length - 1}
                      className={`p-0.5 rounded text-sage-400 hover:text-sage-700 hover:bg-cream-100 transition ${idx === sectionOrder.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-sage-700 group-hover:text-sage-900">{toggle.label}</p>
                    <p className="text-xs text-sage-400">{toggle.note}</p>
                  </div>
                </div>
                <div
                  onClick={() => setSections(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer relative ${sections[key] ? 'bg-sage-500' : 'bg-cream-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${sections[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-sage-400">
          Getting there, venue info, and accommodations are always included and pre-filled by Rixey
        </p>
        <Button
          onClick={() => handleSave()}
          disabled={saving || slugStatus === 'taken'}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </Button>
      </div>

      </>)}
    </div>
  )
}

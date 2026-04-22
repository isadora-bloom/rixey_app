import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '../config/api'


// ── FadeIn wrapper (Intersection Observer) ───────────────────────────────────

function FadeIn({ children, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el) } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {children}
    </div>
  )
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2"
        aria-label="Close"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous arrow */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 p-2"
          aria-label="Previous photo"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 p-2"
          aria-label="Next photo"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption || ''}
          className="max-w-full max-h-[85vh] object-contain"
        />
        {photo.caption && (
          <p className="text-white/80 text-sm mt-3 text-center px-4">{photo.caption}</p>
        )}
        {photos.length > 1 && (
          <p className="text-white/40 text-xs mt-2">{index + 1} / {photos.length}</p>
        )}
      </div>
    </div>
  )
}

// ── Countdown Timer ──────────────────────────────────────────────────────────

function CountdownTimer({ dateStr, theme }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const msLeft = new Date(dateStr + 'T00:00:00') - new Date()
    const tick = msLeft > 0 && msLeft < 86400000 ? 1000 : 60000
    const interval = setInterval(() => setNow(new Date()), tick)
    return () => clearInterval(interval)
  }, [dateStr])

  const target = new Date(dateStr + 'T00:00:00')
  const diff = target - now

  if (diff <= 0) return null // handled by parent ("We're married!" / "Today!")

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  const boxClass = theme === 'warm' || theme === 'romantic' || theme === 'rustic'
    ? 'bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[60px]'
    : 'border border-white/30 rounded px-3 py-2 sm:px-4 sm:py-3 min-w-[60px]'

  const numClass = 'text-xl sm:text-2xl font-serif font-bold'
  const labelClass = 'text-[10px] sm:text-xs uppercase tracking-wider text-white/60 mt-1'

  return (
    <div className="flex gap-2 sm:gap-3 justify-center mb-6">
      {[
        { value: days, label: 'Days' },
        { value: hours, label: 'Hours' },
        { value: minutes, label: 'Min' },
        { value: seconds, label: 'Sec' },
      ].map(({ value, label }) => (
        <div key={label} className={`${boxClass} text-center`}>
          <div className={numClass}>{String(value).padStart(2, '0')}</div>
          <div className={labelClass}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ── StickyNav (mobile section jump links) ────────────────────────────────────

function StickyNav({ sections, t }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show || sections.length < 4) return null

  return (
    <div
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{
        backgroundColor: t === THEMES.warm ? 'rgba(253,250,246,0.92)'
          : t === THEMES.romantic ? 'rgba(253,242,244,0.92)'
          : t === THEMES.rustic ? 'rgba(245,240,232,0.92)'
          : 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
        {sections.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              const el = document.getElementById(id)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              t === THEMES.warm
                ? 'bg-sage-100/80 text-sage-700 hover:bg-sage-200'
                : t === THEMES.romantic
                  ? 'bg-rose-100/80 text-rose-700 hover:bg-rose-200'
                  : t === THEMES.rustic
                    ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Theme tokens ──────────────────────────────────────────────────────────────

const THEMES = {
  warm: {
    page:        'bg-[#FDFAF6] text-sage-800 font-sans',
    heroOverlay: 'bg-sage-900/60',
    heroFallback:'bg-gradient-to-br from-sage-700 to-sage-900',
    heroText:    'text-white',
    section:     'bg-[#FDFAF6]',
    altSection:  'bg-white',
    heading:     'font-serif text-sage-800',
    label:       'text-xs font-semibold uppercase tracking-widest text-sage-400',
    body:        'text-sage-600 leading-relaxed',
    card:        'bg-white border border-cream-200 rounded-2xl',
    divider:     'border-sage-100',
    badge:       'bg-sage-100 text-sage-700 rounded-full px-3 py-1 text-sm',
    link:        'text-sage-600 hover:text-sage-800 underline underline-offset-2',
    btn:         'bg-sage-600 text-white hover:bg-sage-700 rounded-full px-6 py-2.5 text-sm font-medium',
    accent:      'text-sage-600',
  },
  editorial: {
    page:        'bg-white text-gray-900 font-sans',
    heroOverlay: 'bg-black/70',
    heroFallback:'bg-gray-900',
    heroText:    'text-white',
    section:     'bg-white',
    altSection:  'bg-gray-50',
    heading:     'font-serif text-gray-900',
    label:       'text-xs font-bold uppercase tracking-[0.2em] text-gray-400',
    body:        'text-gray-600 leading-relaxed',
    card:        'bg-white border border-gray-200',
    divider:     'border-gray-200',
    badge:       'bg-gray-100 text-gray-800 px-3 py-1 text-sm',
    link:        'text-gray-900 hover:text-gray-600 underline underline-offset-4',
    btn:         'bg-gray-900 text-white hover:bg-gray-700 px-6 py-2.5 text-sm font-medium tracking-wide uppercase',
    accent:      'text-gray-900',
  },
  romantic: {
    page:        'bg-[#FDF2F4] text-rose-900 font-sans',
    heroOverlay: 'bg-rose-900/60',
    heroFallback:'bg-gradient-to-br from-rose-700 to-rose-900',
    heroText:    'text-white',
    section:     'bg-[#FDF2F4]',
    altSection:  'bg-white',
    heading:     'font-serif text-rose-900',
    label:       'text-xs font-semibold uppercase tracking-widest text-rose-400',
    body:        'text-rose-700 leading-relaxed',
    card:        'bg-white border border-rose-200 rounded-2xl',
    divider:     'border-rose-100',
    badge:       'bg-rose-100 text-rose-800 rounded-full px-3 py-1 text-sm',
    link:        'text-rose-600 hover:text-rose-800 underline underline-offset-2',
    btn:         'bg-rose-600 text-white hover:bg-rose-700 rounded-full px-6 py-2.5 text-sm font-medium',
    accent:      'text-rose-600',
  },
  modern: {
    page:        'bg-white text-gray-900 font-sans',
    heroOverlay: 'bg-black/75',
    heroFallback:'bg-black',
    heroText:    'text-white',
    section:     'bg-white',
    altSection:  'bg-gray-50',
    heading:     'font-sans font-bold text-gray-900',
    label:       'text-xs font-bold uppercase tracking-[0.25em] text-gray-400',
    body:        'text-gray-500 leading-relaxed',
    card:        'bg-white border border-gray-200 rounded-lg',
    divider:     'border-gray-100',
    badge:       'bg-gray-900 text-white px-3 py-1 text-sm rounded',
    link:        'text-gray-900 hover:text-gray-600 underline underline-offset-4',
    btn:         'bg-gray-900 text-white hover:bg-gray-800 px-6 py-2.5 text-sm font-bold tracking-wide',
    accent:      'text-gray-900',
  },
  rustic: {
    page:        'bg-[#F5F0E8] text-amber-900 font-sans',
    heroOverlay: 'bg-amber-900/55',
    heroFallback:'bg-gradient-to-br from-amber-800 to-amber-950',
    heroText:    'text-white',
    section:     'bg-[#F5F0E8]',
    altSection:  'bg-[#FAF7F2]',
    heading:     'font-serif text-amber-900',
    label:       'text-xs font-semibold uppercase tracking-widest text-amber-600',
    body:        'text-amber-800 leading-relaxed',
    card:        'bg-[#FAF7F2] border border-amber-200 rounded-xl',
    divider:     'border-amber-200',
    badge:       'bg-amber-100 text-amber-900 rounded-full px-3 py-1 text-sm',
    link:        'text-amber-700 hover:text-amber-900 underline underline-offset-2',
    btn:         'bg-amber-800 text-white hover:bg-amber-900 rounded-full px-6 py-2.5 text-sm font-medium',
    accent:      'text-amber-800',
  },
}

// ── Font pairs ───────────────────────────────────────────────────────────────

const FONT_PAIRS = {
  classic:  { heading: "'Playfair Display', serif",   body: "'Lora', serif",            gfonts: 'Playfair+Display:wght@400;700&family=Lora:wght@400;500;600' },
  modern:   { heading: "'Inter', sans-serif",         body: "'Inter', sans-serif",      gfonts: 'Inter:wght@400;500;600;700' },
  elegant:  { heading: "'Cormorant Garamond', serif", body: "'Proza Libre', sans-serif", gfonts: 'Cormorant+Garamond:wght@400;600;700&family=Proza+Libre:wght@400;500;600' },
  friendly: { heading: "'Josefin Sans', sans-serif",  body: "'Nunito', sans-serif",     gfonts: 'Josefin+Sans:wght@400;600;700&family=Nunito:wght@400;500;600' },
}

// ── Default hero pre-text per theme ──────────────────────────────────────────

const DEFAULT_HERO_PRETEXT = {
  warm:      'You are invited to celebrate',
  editorial: 'The wedding of',
  romantic:  'Together with their families',
  modern:    'The wedding of',
  rustic:    'Come celebrate with us',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.ceil((d - new Date()) / 86400000)
  return diff
}

function dressCodeLabel(code) {
  const map = {
    black_tie: 'Black Tie', black_tie_opt: 'Black Tie Optional',
    cocktail: 'Cocktail Attire', garden: 'Garden Party',
    smart_casual: 'Smart Casual', casual: 'Casual',
  }
  return map[code] || code
}

// ── Weather hints for Rixey Manor (Rapidan, VA) by month ────────────────────

const RIXEY_WEATHER = {
  1:  { emoji: '❄️', range: '30-45°F', note: 'Winter in the Blue Ridge — bundle up! Expect cold temperatures and possible frost.' },
  2:  { emoji: '❄️', range: '32-48°F', note: 'Late winter — still chilly. Layers and a warm coat are a must.' },
  3:  { emoji: '🌱', range: '40-58°F', note: 'Early spring — cool and unpredictable. Bring a jacket and layers.' },
  4:  { emoji: '🌸', range: '50-68°F', note: 'Spring is blooming — mild days, cool evenings. A light layer is a good idea.' },
  5:  { emoji: '🌿', range: '58-78°F', note: 'Late spring — warm and lovely. Light layers for the evening.' },
  6:  { emoji: '☀️', range: '68-88°F', note: 'Summer is here — warm to hot days. Dress light and stay hydrated.' },
  7:  { emoji: '☀️', range: '72-90°F', note: 'Peak summer — expect heat and humidity. Sunscreen and water are your friends.' },
  8:  { emoji: '☀️', range: '70-88°F', note: 'Late summer — still warm and humid. Dress comfortably.' },
  9:  { emoji: '🍂', range: '60-80°F', note: 'Early fall — warm days, cool evenings. A light jacket for after sunset.' },
  10: { emoji: '🍁', range: '48-68°F', note: 'Peak foliage — crisp and beautiful. Bring a jacket or wrap.' },
  11: { emoji: '🍂', range: '38-58°F', note: 'Late fall — getting cold. A warm coat will keep you comfortable.' },
  12: { emoji: '❄️', range: '30-48°F', note: 'Winter — cold and cozy. Bundle up for the trip to the countryside.' },
}

// ── Rixey Manor drive times ─────────────────────────────────────────────────

const RIXEY_DRIVE_TIMES = [
  { from: 'Washington, DC', time: '~2 hours' },
  { from: 'Richmond', time: '~1.5 hours' },
  { from: 'Charlottesville', time: '~45 minutes' },
]

// ── Things to Do type emoji mapping ─────────────────────────────────────────

const THINGS_TO_DO_EMOJI = {
  restaurant: '🍽️',
  winery: '🍷',
  activity: '🏃',
  attraction: '🏛️',
  shopping: '🛍️',
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider({ t }) {
  if (t === THEMES.warm) {
    return (
      <div className="flex items-center justify-center py-6">
        <svg viewBox="0 0 200 20" className="w-48 h-5 text-sage-200" fill="none">
          <path d="M0 10 Q25 2 50 10 Q75 18 100 10 Q125 2 150 10 Q175 18 200 10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
    )
  }
  if (t === THEMES.romantic) {
    return (
      <div className="flex items-center justify-center py-6 gap-2">
        <div className="w-12 h-px bg-rose-200" />
        <svg viewBox="0 0 20 20" className="w-4 h-4 text-rose-300" fill="currentColor">
          <path d="M10 18s-7.5-5.5-7.5-10a4.5 4.5 0 019 0 4.5 4.5 0 019 0c0 4.5-7.5 10-7.5 10z" transform="translate(-1.5,0) scale(0.95)"/>
        </svg>
        <div className="w-12 h-px bg-rose-200" />
      </div>
    )
  }
  if (t === THEMES.modern) {
    return <div className="border-t-2 border-gray-900 w-12 mx-auto my-6" />
  }
  if (t === THEMES.rustic) {
    return (
      <div className="flex items-center justify-center py-6 gap-3">
        <div className="w-16 h-px bg-amber-300" />
        <span className="text-amber-400 text-xs">&#10045;</span>
        <div className="w-16 h-px bg-amber-300" />
      </div>
    )
  }
  return <div className="border-t border-gray-200 my-2" />
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ t, alt, children, id, style }) {
  return (
    <section id={id} className={`py-16 px-6 ${alt ? t.altSection : t.section}`} style={style}>
      <FadeIn>
        <div className="max-w-3xl mx-auto">{children}</div>
      </FadeIn>
    </section>
  )
}

function SectionHeading({ t, label, title }) {
  return (
    <div className="text-center mb-10">
      {label && <p className={`${t.label} mb-2`}>{label}</p>}
      <h2 className={`${t.heading} text-3xl`}>{title}</h2>
    </div>
  )
}

// ── RSVP Section ──────────────────────────────────────────────────────────────

function RsvpSection({ t, slug, settings, platedMeal, mealOptions }) {
  const rsvpConfig = settings.rsvp_config?.fields || {}
  const customQuestions = settings.rsvp_config?.custom_questions || []
  const askField = (key, defaultVal = false) => rsvpConfig[key] !== undefined ? rsvpConfig[key] : defaultVal

  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState({
    rsvp: '', meal_choice: '', dietary_restrictions: '',
    plus_one_rsvp: '', plus_one_meal_choice: '', plus_one_dietary: '',
  })
  const [extras, setExtras]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  // Deadline check
  const deadlinePassed = settings.rsvp_deadline
    ? new Date(settings.rsvp_deadline + 'T23:59:59') < new Date()
    : false

  // Debounced name search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API_URL}/api/rsvp/${slug}/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {}
      setSearching(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [query, slug])

  const selectGuest = async (guest) => {
    setSelected(guest)
    setResults([])
    setQuery('')
    // Fetch this guest's current RSVP status (not included in search
    // results to avoid leaking other guests' attendance info)
    setForm({ rsvp: '', meal_choice: '', dietary_restrictions: '', plus_one_rsvp: '', plus_one_meal_choice: '', plus_one_dietary: '' })
    try {
      const res = await fetch(`${API_URL}/api/rsvp/${slug}/guest/${guest.id}`)
      if (res.ok) {
        const g = await res.json()
        setForm({
          rsvp: g.rsvp !== 'pending' ? g.rsvp : '',
          meal_choice: g.meal_choice || '', dietary_restrictions: g.dietary_restrictions || '',
          plus_one_rsvp: g.plus_one_rsvp !== 'pending' ? g.plus_one_rsvp || '' : '',
          plus_one_meal_choice: g.plus_one_meal_choice || '', plus_one_dietary: g.plus_one_dietary || '',
        })
      }
    } catch {}
  }

  const handleSubmit = async () => {
    if (!form.rsvp) return setError('Please select attending or not attending.')
    if (platedMeal && form.rsvp === 'yes' && !form.meal_choice) return setError('Please select a meal choice.')
    if (selected.plus_one_name && !form.plus_one_rsvp) return setError('Please confirm your plus one\'s attendance.')
    if (platedMeal && form.plus_one_rsvp === 'yes' && !form.plus_one_meal_choice) return setError('Please select a meal for your plus one.')
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        guest_id: selected.id,
        rsvp: form.rsvp,
        dietary_restrictions: form.dietary_restrictions || null,
      }
      if (platedMeal && form.rsvp === 'yes') payload.meal_choice = form.meal_choice
      if (selected.plus_one_name) {
        payload.plus_one_rsvp = form.plus_one_rsvp || 'pending'
        if (platedMeal && form.plus_one_rsvp === 'yes') payload.plus_one_meal_choice = form.plus_one_meal_choice
        payload.plus_one_dietary = form.plus_one_dietary || null
      }
      // Extra RSVP fields (phone, song request, accessibility, custom questions, etc.)
      if (Object.keys(extras).length > 0) payload.rsvp_extras = extras
      const res = await fetch(`${API_URL}/api/rsvp/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again or contact us directly.')
    }
    setSubmitting(false)
  }

  const inputClass = `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
    t === THEMES.warm
      ? 'border-cream-300 focus:ring-sage-300 bg-white'
      : 'border-gray-300 focus:ring-gray-400 bg-white'
  }`
  const selectClass = inputClass

  if (deadlinePassed) {
    return (
      <Section t={t} alt id="rsvp">
        <SectionHeading t={t} label="RSVP" title="RSVP has closed" />
        <p className={`text-center ${t.body}`}>
          The RSVP deadline has passed. Please reach out to the couple directly if you need to make a change.
        </p>
      </Section>
    )
  }

  if (done) {
    return (
      <Section t={t} alt id="rsvp">
        <div className="text-center max-w-md mx-auto py-4">
          <div className="text-4xl mb-4">{form.rsvp === 'yes' ? '🎉' : '💌'}</div>
          <h2 className={`${t.heading} text-2xl mb-3`}>
            {form.rsvp === 'yes' ? 'See you there!' : 'We\'ll miss you'}
          </h2>
          <p className={`${t.body}`}>
            {form.rsvp === 'yes'
              ? `Thanks for confirming, ${selected.name}. We can't wait to celebrate with you.`
              : `Thanks for letting us know, ${selected.name}. You'll be missed.`}
          </p>
        </div>
      </Section>
    )
  }

  return (
    <Section t={t} alt id="rsvp">
      <SectionHeading t={t} label="Will you be joining us?" title="RSVP" />

      {settings.rsvp_note && (
        <p className={`text-center ${t.body} mb-8 max-w-md mx-auto`}>{settings.rsvp_note}</p>
      )}

      {settings.rsvp_deadline && !deadlinePassed && (
        <p className={`text-center text-sm ${t.body} opacity-70 mb-8`}>
          Please RSVP by {new Date(settings.rsvp_deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      )}

      <div className="max-w-md mx-auto space-y-6">

        {/* Name search */}
        {!selected && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${t.accent}`}>
              Search for your name
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Your first or last name…"
                className={inputClass}
                autoComplete="off"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className={`mt-1 border rounded-xl overflow-hidden shadow-lg ${t === THEMES.warm ? 'border-cream-200' : 'border-gray-200'}`}>
                {results.map(guest => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => selectGuest(guest)}
                    className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-sage-50 transition border-b last:border-0 ${t === THEMES.warm ? 'border-cream-100' : 'border-gray-100'}`}
                  >
                    <span className={`font-medium ${t.accent}`}>{guest.name}</span>
                    {guest.rsvp !== 'pending' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${guest.rsvp === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {guest.rsvp === 'yes' ? 'Attending' : 'Not attending'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && !searching && results.length === 0 && (
              <p className={`mt-2 text-sm ${t.body} opacity-70`}>
                No one found with that name. Try a different spelling or contact the couple directly.
              </p>
            )}
          </div>
        )}

        {/* RSVP form */}
        {selected && (
          <div className="space-y-5">
            <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${t === THEMES.warm ? 'bg-sage-50' : 'bg-gray-50'}`}>
              <p className={`font-medium ${t.accent}`}>{selected.name}</p>
              <button
                type="button"
                onClick={() => { setSelected(null); setForm({ rsvp:'', meal_choice:'', dietary_restrictions:'', plus_one_rsvp:'', plus_one_meal_choice:'', plus_one_dietary:'' }) }}
                className={`text-xs ${t.body} opacity-60 hover:opacity-100`}
              >
                Not me →
              </button>
            </div>

            {/* Attending */}
            <div>
              <p className={`text-sm font-medium mb-2 ${t.accent}`}>Will you be attending?</p>
              <div className="grid grid-cols-2 gap-3">
                {['yes', 'no'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, rsvp: val }))}
                    className={`py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                      form.rsvp === val
                        ? (t === THEMES.warm ? 'border-sage-500 bg-sage-500 text-white' : 'border-gray-900 bg-gray-900 text-white')
                        : (t === THEMES.warm ? 'border-cream-300 text-sage-600 hover:border-sage-300' : 'border-gray-200 text-gray-600 hover:border-gray-400')
                    }`}
                  >
                    {val === 'yes' ? 'Attending' : 'Not attending'}
                  </button>
                ))}
              </div>
            </div>

            {form.rsvp === 'yes' && (
              <>
                {platedMeal && mealOptions.length > 0 && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Meal choice</label>
                    <select value={form.meal_choice} onChange={e => setForm(f => ({ ...f, meal_choice: e.target.value }))} className={selectClass}>
                      <option value="">Select a meal…</option>
                      {mealOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Dietary restrictions or allergies</label>
                  <input
                    type="text"
                    value={form.dietary_restrictions}
                    onChange={e => setForm(f => ({ ...f, dietary_restrictions: e.target.value }))}
                    placeholder="None, vegetarian, nut allergy…"
                    className={inputClass}
                  />
                </div>

                {/* Dynamic extra fields from RSVP settings */}
                {askField('ask_phone') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Phone number</label>
                    <input type="tel" value={extras.phone || ''} onChange={e => setExtras(p => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 123-4567" className={inputClass} />
                  </div>
                )}
                {askField('ask_email') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Email address</label>
                    <input type="email" value={extras.email || ''} onChange={e => setExtras(p => ({ ...p, email: e.target.value }))}
                      placeholder="you@email.com" className={inputClass} />
                  </div>
                )}
                {askField('ask_address') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Mailing address</label>
                    <input type="text" value={extras.address || ''} onChange={e => setExtras(p => ({ ...p, address: e.target.value }))}
                      placeholder="123 Main St, City, State ZIP" className={inputClass} />
                  </div>
                )}
                {askField('ask_hotel') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Hotel preference</label>
                    <input type="text" value={extras.hotel || ''} onChange={e => setExtras(p => ({ ...p, hotel: e.target.value }))}
                      placeholder="Which hotel are you staying at?" className={inputClass} />
                  </div>
                )}
                {askField('ask_shuttle') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Will you need shuttle service?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Yes', 'No'].map(val => (
                        <button key={val} type="button" onClick={() => setExtras(p => ({ ...p, shuttle: val }))}
                          className={`py-2 rounded-lg text-sm font-medium border-2 transition ${
                            extras.shuttle === val
                              ? (t === THEMES.warm ? 'border-sage-500 bg-sage-500 text-white' : 'border-gray-900 bg-gray-900 text-white')
                              : (t === THEMES.warm ? 'border-cream-300 text-sage-600' : 'border-gray-200 text-gray-600')
                          }`}>{val}</button>
                      ))}
                    </div>
                  </div>
                )}
                {askField('ask_accessibility') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Accessibility needs</label>
                    <input type="text" value={extras.accessibility || ''} onChange={e => setExtras(p => ({ ...p, accessibility: e.target.value }))}
                      placeholder="Wheelchair access, hearing loop, etc." className={inputClass} />
                  </div>
                )}
                {askField('ask_song') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Song request</label>
                    <input type="text" value={extras.song || ''} onChange={e => setExtras(p => ({ ...p, song: e.target.value }))}
                      placeholder="What song gets you on the dance floor?" className={inputClass} />
                  </div>
                )}
                {askField('ask_message') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>Message for the couple</label>
                    <textarea value={extras.message || ''} onChange={e => setExtras(p => ({ ...p, message: e.target.value }))}
                      placeholder="A note, a wish, a memory..." rows={3}
                      className={`${inputClass} resize-none`} />
                  </div>
                )}
                {customQuestions.map((q, i) => (
                  <div key={i}>
                    <label className={`block text-sm font-medium mb-2 ${t.accent}`}>{q.label}</label>
                    {q.type === 'boolean' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {['Yes', 'No'].map(val => (
                          <button key={val} type="button" onClick={() => setExtras(p => ({ ...p, [`custom_${i}`]: val }))}
                            className={`py-2 rounded-lg text-sm font-medium border-2 transition ${
                              extras[`custom_${i}`] === val
                                ? (t === THEMES.warm ? 'border-sage-500 bg-sage-500 text-white' : 'border-gray-900 bg-gray-900 text-white')
                                : (t === THEMES.warm ? 'border-cream-300 text-sage-600' : 'border-gray-200 text-gray-600')
                            }`}>{val}</button>
                        ))}
                      </div>
                    ) : q.type === 'select' ? (
                      <select value={extras[`custom_${i}`] || ''} onChange={e => setExtras(p => ({ ...p, [`custom_${i}`]: e.target.value }))}
                        className={inputClass}>
                        <option value="">Select...</option>
                        {(q.options || '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={extras[`custom_${i}`] || ''} onChange={e => setExtras(p => ({ ...p, [`custom_${i}`]: e.target.value }))}
                        className={inputClass} />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Plus one */}
            {selected.plus_one_name && (
              <div className={`border rounded-xl p-4 space-y-4 ${t === THEMES.warm ? 'border-cream-200' : 'border-gray-200'}`}>
                <p className={`text-sm font-medium ${t.accent}`}>
                  And {selected.plus_one_name}?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {['yes', 'no'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, plus_one_rsvp: val }))}
                      className={`py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                        form.plus_one_rsvp === val
                          ? (t === THEMES.warm ? 'border-sage-500 bg-sage-500 text-white' : 'border-gray-900 bg-gray-900 text-white')
                          : (t === THEMES.warm ? 'border-cream-300 text-sage-600 hover:border-sage-300' : 'border-gray-200 text-gray-600 hover:border-gray-400')
                      }`}
                    >
                      {val === 'yes' ? 'Attending' : 'Not attending'}
                    </button>
                  ))}
                </div>
                {form.plus_one_rsvp === 'yes' && platedMeal && mealOptions.length > 0 && (
                  <select value={form.plus_one_meal_choice} onChange={e => setForm(f => ({ ...f, plus_one_meal_choice: e.target.value }))} className={selectClass}>
                    <option value="">{selected.plus_one_name}'s meal…</option>
                    {mealOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                  </select>
                )}
                {form.plus_one_rsvp === 'yes' && (
                  <input
                    type="text"
                    value={form.plus_one_dietary}
                    onChange={e => setForm(f => ({ ...f, plus_one_dietary: e.target.value }))}
                    placeholder={`${selected.plus_one_name}'s dietary needs…`}
                    className={inputClass}
                  />
                )}
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={`w-full py-3 ${t.btn} ww-btn disabled:opacity-50`}
            >
              {submitting ? 'Sending…' : 'Confirm RSVP'}
            </button>
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WeddingWebsite() {
  const { slug } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Password gate state
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [passwordUnlocked, setPasswordUnlocked] = useState(() => {
    return sessionStorage.getItem(`wedding_pw_${slug}`) === 'unlocked'
  })

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const openLightbox = useCallback((index) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }, [])

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])

  const prevPhoto = useCallback((max) => {
    setLightboxIndex(i => i <= 0 ? max - 1 : i - 1)
  }, [])

  const nextPhoto = useCallback((max) => {
    setLightboxIndex(i => i >= max - 1 ? 0 : i + 1)
  }, [])

  const fetchSite = (pw) => {
    const params = new URLSearchParams(window.location.search)
    const preview = params.get('preview')
    let apiUrl = preview
      ? `${API_URL}/api/w/${slug}?preview=${preview}`
      : `${API_URL}/api/w/${slug}`
    if (pw) apiUrl += `${apiUrl.includes('?') ? '&' : '?'}pw=${encodeURIComponent(pw)}`
    return fetch(apiUrl).then(r => { if (!r.ok) throw new Error(); return r.json() })
  }

  useEffect(() => {
    const savedPw = sessionStorage.getItem(`wedding_pw_${slug}`)
    fetchSite(savedPw || undefined)
      .then(d => {
        if (d.passwordRequired) {
          setData(d)
          setLoading(false)
        } else {
          setData(d)
          setPasswordUnlocked(true)
          setLoading(false)
        }
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  const handlePasswordSubmit = () => {
    setPasswordError(false)
    fetchSite(passwordInput)
      .then(d => {
        if (d.passwordRequired) {
          setPasswordError(true)
        } else {
          setData(d)
          setPasswordUnlocked(true)
          sessionStorage.setItem(`wedding_pw_${slug}`, passwordInput)
        }
      })
      .catch(() => setPasswordError(true))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFAF6] flex items-center justify-center">
        <p className="text-sage-400">Loading…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FDFAF6] flex items-center justify-center text-center px-6">
        <div>
          <p className="font-serif text-3xl text-sage-700 mb-3">We couldn't find this wedding</p>
          <p className="text-sage-400">The link may be wrong or the website isn't published yet.</p>
        </div>
      </div>
    )
  }

  // Password gate - server withholds full data until password verified
  if (data.passwordRequired && !passwordUnlocked) {
    return (
      <div className="min-h-screen bg-[#FDFAF6] flex items-center justify-center px-6">
        <div className="bg-white border border-cream-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-3xl mb-4">🔒</div>
          <h2 className="font-serif text-2xl text-sage-800 mb-2">This wedding website is password protected</h2>
          <p className="text-sage-500 text-sm mb-6">Enter the password from your invitation to continue.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Password"
            className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 mb-3 ${
              passwordError ? 'border-red-300 focus:ring-red-300' : 'border-cream-300 focus:ring-sage-300'
            }`}
            autoFocus
          />
          {passwordError && (
            <p className="text-red-500 text-xs mb-3">Incorrect password. Please try again.</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            className="w-full bg-sage-600 text-white hover:bg-sage-700 rounded-full px-6 py-2.5 text-sm font-medium transition"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  const { settings, wedding, photos, party, shuttle, accommodations, wedding_details, venue, meal_options } = data
  const t = THEMES[settings.theme || 'warm']
  const days = daysUntil(wedding.wedding_date)
  const heroPhoto = photos.find(p => p.tags?.includes('hero')) || photos[0]
  const galleryPhotos = photos.filter(p => !p.tags?.includes('hero'))
  const dressCodePhotos = photos.filter(p => p.tags?.includes('dress-code'))

  const partners = [wedding.partner1_name, wedding.partner2_name].filter(Boolean)
  const displayNames = partners.length === 2
    ? `${partners[0]} & ${partners[1]}`
    : wedding.couple_names || ''

  // Font pair
  const fontPair = FONT_PAIRS[settings.font_pair] || null
  const fontStyle = fontPair ? { '--ww-heading-font': fontPair.heading, '--ww-body-font': fontPair.body } : {}

  // Accent color overrides
  const accentColor = settings.accent_color || null
  const accentOverrides = accentColor ? { '--ww-accent': accentColor } : {}

  // Hero pre-text
  const heroPretext = settings.hero_pretext || DEFAULT_HERO_PRETEXT[settings.theme || 'warm'] || 'You are invited to celebrate'

  // Section order: map toggle key to its position in the couple's saved order
  const DEFAULT_ORDER = [
    'show_story','show_proposal','show_schedule','show_wedding_party',
    'show_dress_code','show_transport','show_accommodations',
    'show_things_to_do','show_registry','show_faq','show_rsvp','show_gallery'
  ]
  const order = settings.section_order?.length ? settings.section_order : DEFAULT_ORDER
  const sectionPos = (key) => {
    const idx = order.indexOf(key)
    return idx >= 0 ? idx : 99
  }

  // Build visible sections list for StickyNav (sorted by section_order)
  const navCandidates = []
  if (settings.show_story && settings.our_story) navCandidates.push({ id: 'story', label: 'Our Story', key: 'show_story' })
  if (settings.show_proposal !== false && settings.the_proposal) navCandidates.push({ id: 'proposal', label: 'Proposal', key: 'show_proposal' })
  if (settings.show_schedule && (settings.ceremony_time || settings.reception_time)) navCandidates.push({ id: 'schedule', label: 'The Day', key: 'show_schedule' })
  if (settings.show_wedding_party && party.length > 0) navCandidates.push({ id: 'party', label: 'Wedding Party', key: 'show_wedding_party' })
  if (settings.show_dress_code && settings.dress_code) navCandidates.push({ id: 'dresscode', label: 'Dress Code', key: 'show_dress_code' })
  navCandidates.push({ id: 'venue', label: 'Getting There', key: '_venue' })
  if (settings.show_transport && shuttle.length > 0) navCandidates.push({ id: 'transport', label: 'Transport', key: 'show_transport' })
  if (settings.show_accommodations && accommodations.length > 0) navCandidates.push({ id: 'stay', label: 'Stay', key: 'show_accommodations' })
  if (settings.show_things_to_do && settings.things_to_do?.length > 0) navCandidates.push({ id: 'thingstodo', label: 'Things to Do', key: 'show_things_to_do' })
  if (settings.show_registry && settings.registry_links?.length > 0) navCandidates.push({ id: 'registry', label: 'Registry', key: 'show_registry' })
  if (settings.kids_policy || settings.plus_one_policy || settings.signature_cocktail) navCandidates.push({ id: 'details', label: 'Details', key: '_details' })
  if (settings.show_faq && settings.faq_items?.length > 0) navCandidates.push({ id: 'faq', label: 'FAQ', key: 'show_faq' })
  if (settings.show_rsvp !== false) navCandidates.push({ id: 'rsvp', label: 'RSVP', key: 'show_rsvp' })
  if (settings.show_gallery && galleryPhotos.length > 0) navCandidates.push({ id: 'gallery', label: 'Gallery', key: 'show_gallery' })
  const visibleSections = navCandidates.sort((a, b) => sectionPos(a.key) - sectionPos(b.key))

  return (
    <div
      data-ww=""
      className={`min-h-screen ${t.page}`}
      style={{ ...fontStyle, ...accentOverrides, ...(fontPair ? { fontFamily: fontPair.body } : {}) }}
    >
      {/* Google Fonts */}
      {fontPair && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${fontPair.gfonts}&display=swap`}
        />
      )}

      {/* Accent color + font pair style overrides */}
      <style>{[
        accentColor && `
          [data-ww] .ww-btn { background-color: ${accentColor} !important; border-color: ${accentColor} !important; }
          [data-ww] .ww-btn:hover { filter: brightness(0.9); }
          [data-ww] .ww-badge { background-color: ${accentColor}20 !important; color: ${accentColor} !important; }
          [data-ww] .ww-accent { color: ${accentColor} !important; }
        `,
        fontPair && `
          [data-ww] .font-serif, [data-ww] [class*="font-serif"] { font-family: var(--ww-heading-font) !important; }
        `,
      ].filter(Boolean).join('\n')}</style>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
        {heroPhoto ? (
          <>
            <img
              src={heroPhoto.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              fetchpriority="high"
              style={{ aspectRatio: '16 / 9' }}
            />
            <div className={`absolute inset-0 ${t.heroOverlay}`} />
          </>
        ) : (
          <div className={`absolute inset-0 ${t.heroFallback}`} />
        )}

        <div className={`relative z-10 ${t.heroText}`}>
          <p className={`uppercase mb-4 ${
            settings.theme === 'warm' || settings.theme === 'romantic' || settings.theme === 'rustic'
              ? 'text-sm font-medium tracking-[0.3em] text-white/70'
              : 'text-xs tracking-[0.4em] text-white/60 mb-6'
          }`}>
            {heroPretext}
          </p>

          <h1 className={`font-serif mb-4 ${
            settings.theme === 'modern'
              ? 'text-4xl sm:text-6xl font-bold'
              : settings.theme === 'editorial'
                ? 'text-4xl sm:text-6xl font-light'
                : 'text-5xl sm:text-7xl'
          }`} style={fontPair ? { fontFamily: fontPair.heading } : {}}>
            {displayNames}
          </h1>

          <p className={`text-lg sm:text-xl mb-2 ${settings.theme === 'warm' ? 'text-white/80' : 'text-white/70 tracking-wide'}`}>
            {formatDate(wedding.wedding_date)}
          </p>
          <p className={`text-sm mb-6 ${settings.theme === 'warm' ? 'text-white/60' : 'text-white/50 tracking-widest uppercase text-xs'}`}>
            {venue.venue_name || 'The Venue'}{venue.address_line2 ? ` · ${venue.address_line2}` : ''}
          </p>

          {/* Countdown timer (replaces simple "X days to go" pill when >1 day) */}
          {days !== null && days > 1 && (
            <CountdownTimer dateStr={wedding.wedding_date} theme={settings.theme} />
          )}
          {days === 1 && (
            <div className={`inline-block px-6 py-3 rounded-full text-sm mb-6 ${
              settings.theme === 'warm'
                ? 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                : 'border border-white/40 text-white/80'
            }`}>
              Tomorrow!
            </div>
          )}
          {days !== null && days <= 0 && (
            <div className={`inline-block px-6 py-3 rounded-full text-sm mb-6 ${
              settings.theme === 'warm'
                ? 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                : 'border border-white/40 text-white/80'
            }`}>
              {days === 0 ? '🎉 Today!' : 'We\'re married!'}
            </div>
          )}

          {settings.welcome_message && (
            <p className="max-w-md mx-auto text-white/80 text-base leading-relaxed italic">
              "{settings.welcome_message}"
            </p>
          )}

          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Sticky section nav ────────────────────────────────────────── */}
      <StickyNav sections={visibleSections} t={t} />

      {/* ── Sections (flex container respects couple's chosen order) ──── */}
      <div className="flex flex-col">

      {/* ── Our Story ───────────────────────────────────────────────────── */}
      {settings.show_story && settings.our_story && (
        <Section t={t} id="story" style={{ order: sectionPos('show_story') }}>
          <SectionHeading t={t} label="How it started" title="Our Story" />
          <p className={`${t.body} text-center max-w-2xl mx-auto text-lg whitespace-pre-line`}>
            {settings.our_story}
          </p>
        </Section>
      )}

      {/* ── The Proposal ──────────────────────────────────────────────── */}
      {settings.show_proposal !== false && settings.the_proposal && (
        <Section t={t} alt id="proposal" style={{ order: sectionPos('show_proposal') }}>
          <SectionHeading t={t} label="The moment" title="The Proposal" />
          <p className={`${t.body} text-center max-w-2xl mx-auto text-lg whitespace-pre-line`}>
            {settings.the_proposal}
          </p>
        </Section>
      )}

      {/* ── The Day ─────────────────────────────────────────────────────── */}
      {settings.show_schedule && (settings.ceremony_time || settings.reception_time) && (
        <Section t={t} alt id="schedule" style={{ order: sectionPos('show_schedule') }}>
          <SectionHeading t={t} label={formatDate(wedding.wedding_date)} title="The Day" />
          <div className="grid sm:grid-cols-2 gap-6 max-w-lg mx-auto">
            {settings.ceremony_time && (
              <div className={`${t.card} p-6 text-center`}>
                <p className={t.label}>Ceremony</p>
                <p className={`${t.heading} text-2xl mt-2`}>{formatTime(settings.ceremony_time)}</p>
                <p className={`${t.body} text-sm mt-1`}>
                  {wedding_details.ceremony_location === 'Outside'
                    ? `Outside at ${venue.venue_name || 'the venue'}`
                    : `Inside ${venue.venue_name || 'the venue'}`}
                </p>
              </div>
            )}
            {settings.reception_time && (
              <div className={`${t.card} p-6 text-center`}>
                <p className={t.label}>Reception</p>
                <p className={`${t.heading} text-2xl mt-2`}>{formatTime(settings.reception_time)}</p>
                <p className={`${t.body} text-sm mt-1`}>{venue.venue_name || 'The venue'}</p>
              </div>
            )}
          </div>
          {settings.unplugged_ceremony && (
            <p className={`text-center mt-6 ${t.body} italic`}>
              We're asking for an unplugged ceremony — please put your phone away and be present with us ♡
            </p>
          )}
        </Section>
      )}

      {/* ── Wedding Party ────────────────────────────────────────────────── */}
      {/* NOTE: Wedding party blurbs (m.blurb) are managed in the Wedding Party
          section of the client dashboard (WeddingPartyBuilder component).
          They flow through as party[].blurb and are rendered below each member. */}
      {settings.show_wedding_party && party.length > 0 && (
        <Section t={t} id="party" style={{ order: sectionPos('show_wedding_party') }}>
          <SectionHeading t={t} label="The people standing beside us" title="Wedding Party" />

          {/* Group by group_label */}
          {(() => {
            const groups = party.reduce((acc, m) => {
              const key = m.group_label || ''
              if (!acc[key]) acc[key] = []
              acc[key].push(m)
              return acc
            }, {})

            return Object.entries(groups).map(([groupLabel, members]) => (
              <div key={groupLabel} className="mb-10">
                {groupLabel && Object.keys(groups).length > 1 && (
                  <p className={`${t.label} text-center mb-6`}>{groupLabel}</p>
                )}
                <div className={`grid gap-6 ${members.length <= 2 ? 'sm:grid-cols-2' : members.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-4'}`}>
                  {members.map(m => {
                    const portrait = photos.find(p => p.tags?.some(tag => tag.toLowerCase() === m.member_name?.toLowerCase()))
                    return (
                      <div key={m.id} className="text-center">
                        {portrait ? (
                          <img
                            src={portrait.url}
                            alt={m.member_name}
                            loading="lazy"
                            decoding="async"
                            className={`w-28 h-28 object-cover mx-auto mb-3 ${settings.theme === 'warm' ? 'rounded-full border-4 border-cream-200' : 'border border-gray-200'}`}
                          />
                        ) : (
                          <div className={`w-28 h-28 mx-auto mb-3 flex items-center justify-center ${settings.theme === 'warm' ? 'rounded-full bg-sage-100' : 'bg-gray-100'}`}>
                            <span className={`text-2xl font-serif ${t.accent}`}>
                              {m.member_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                        )}
                        <p className={`${t.heading} text-lg`}>{m.member_name}</p>
                        <p className={`${t.label} mt-0.5`}>{m.role}</p>
                        {m.blurb && <p className={`${t.body} text-sm mt-2`}>{m.blurb}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
        </Section>
      )}

      {/* ── Dress Code ───────────────────────────────────────────────────── */}
      {settings.show_dress_code && settings.dress_code && (
        <Section t={t} alt id="dresscode" style={{ order: sectionPos('show_dress_code') }}>
          <SectionHeading t={t} label="What to wear" title="Dress Code" />
          <div className="text-center">
            <span className={`${t.badge} ww-badge text-lg px-6 py-2 inline-block mb-4`}>
              {dressCodeLabel(settings.dress_code)}
            </span>
            {settings.dress_code_note && (
              <p className={`${t.body} max-w-md mx-auto mt-2`}>{settings.dress_code_note}</p>
            )}
          </div>
          {dressCodePhotos.length > 0 && (
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8`}>
              {dressCodePhotos.slice(0, 6).map(p => (
                <img key={p.id} src={p.url} alt={p.caption || ''} loading="lazy" decoding="async" className={`aspect-square object-cover w-full ${settings.theme === 'warm' ? 'rounded-xl' : ''}`} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Getting There ────────────────────────────────────────────────── */}
      <Section t={t} id="venue" style={{ order: 50 }}>
        <SectionHeading t={t} label={venue.venue_name || 'The Venue'} title="Getting There" />
        <div className={`${t.card} p-6 sm:p-8 max-w-lg mx-auto text-center`}>
          <p className={`${t.heading} text-xl mb-1`}>{venue.venue_name || 'The Venue'}</p>
          {venue.tagline && <p className={`${t.body} text-sm mb-3 italic`}>{venue.tagline}</p>}
          {(venue.address_line1 || venue.address_line2) && (
            <p className={`${t.body} mb-4`}>
              {[venue.address_line1, venue.address_line2].filter(Boolean).join(', ')}
            </p>
          )}
          {venue.google_maps_url && (
            <a
              href={venue.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block ${t.btn} ww-btn mb-6`}
            >
              Open in Maps
            </a>
          )}
          <div className={`border-t ${t.divider} pt-5 space-y-3 text-left`}>
            {venue.parking_note && (
              <div className="flex gap-3">
                <span className="text-lg">🚗</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>Parking</p>
                  <p className={`${t.body} text-sm`}>{venue.parking_note}</p>
                </div>
              </div>
            )}
            {(venue.venue_description || venue.arrival_note) && (
              <div className="flex gap-3">
                <span className="text-lg">🌿</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>The venue</p>
                  {venue.venue_description && <p className={`${t.body} text-sm`}>{venue.venue_description}</p>}
                  {venue.arrival_note && <p className={`${t.body} text-sm mt-1`}>{venue.arrival_note}</p>}
                </div>
              </div>
            )}
            {venue.cell_service_note && (
              <div className="flex gap-3">
                <span className="text-lg">📶</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>Cell service</p>
                  <p className={`${t.body} text-sm`}>{venue.cell_service_note}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map embed — only works with Google Maps Embed URLs, otherwise shows a link */}
        {venue.google_maps_url && (
          <div className="max-w-lg mx-auto mt-6">
            {venue.google_maps_url.includes('/embed') ? (
              <iframe
                src={venue.google_maps_url}
                title={`Map to ${venue.venue_name || 'the venue'}`}
                className="w-full h-64 rounded-xl border border-gray-200"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <a
                href={venue.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full h-48 rounded-xl border border-gray-200 bg-cream-50 flex items-center justify-center hover:bg-cream-100 transition`}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">📍</span>
                  <p className={`${t.accent} font-medium text-sm`}>View on Google Maps</p>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Driving directions — Rixey Manor specific */}
        {venue.venue_name?.includes('Rixey') && (
          <div className="max-w-lg mx-auto mt-6">
            <p className={`text-sm font-medium ${t.accent} mb-3`}>Getting Here</p>
            <div className="space-y-2">
              {RIXEY_DRIVE_TIMES.map(d => (
                <div key={d.from} className="flex items-center gap-2">
                  <span className="text-sm">🚗</span>
                  <p className={`${t.body} text-sm`}>
                    From {d.from} — <span className="font-medium">{d.time}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weather / season hint — Rixey Manor specific */}
        {venue.venue_name?.includes('Rixey') && wedding.wedding_date && (() => {
          const month = new Date(wedding.wedding_date + 'T00:00:00').getMonth() + 1
          const weather = RIXEY_WEATHER[month]
          if (!weather) return null
          return (
            <div className={`max-w-lg mx-auto mt-6 ${t.card} p-4`}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{weather.emoji}</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>
                    Expect {weather.range} in {new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long' })}
                  </p>
                  <p className={`${t.body} text-sm mt-0.5`}>{weather.note}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </Section>

      {/* ── Transportation ───────────────────────────────────────────────── */}
      {settings.show_transport && shuttle.length > 0 && (
        <Section t={t} alt id="transport" style={{ order: sectionPos('show_transport') }}>
          <SectionHeading t={t} label="Getting around" title="Transportation" />
          <div className="space-y-4 max-w-lg mx-auto">
            {shuttle.map((run, i) => (
              <div key={run.id || i} className={`${t.card} p-5`}>
                {run.run_label && <p className={`${t.heading} text-lg mb-2`}>{run.run_label}</p>}
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <span className="text-lg">🚌</span>
                    <div>
                      <p className={`text-sm font-medium ${t.accent}`}>Pickup</p>
                      <p className={`${t.body} text-sm`}>{run.pickup_location}{run.pickup_time && ` · ${run.pickup_time}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-lg">📍</span>
                    <div>
                      <p className={`text-sm font-medium ${t.accent}`}>Drop-off</p>
                      <p className={`${t.body} text-sm`}>{run.dropoff_location}{run.dropoff_time && ` · ${run.dropoff_time}`}</p>
                    </div>
                  </div>
                  {run.seat_count && (
                    <p className={`${t.body} text-xs mt-1`}>{run.seat_count} seats available</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Where to Stay ────────────────────────────────────────────────── */}
      {settings.show_accommodations && accommodations.length > 0 && (
        <Section t={t} id="stay" style={{ order: sectionPos('show_accommodations') }}>
          <SectionHeading t={t} label="Places to rest" title="Where to Stay" />
          <div className="grid sm:grid-cols-2 gap-4">
            {accommodations.map(a => (
              <div key={a.id} className={`${t.card} p-5`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`${t.heading} text-base`}>{a.name}</p>
                  <span className={`${t.badge} ww-badge text-xs flex-shrink-0`}>{a.booking_platform}</span>
                </div>
                <div className={`space-y-1 ${t.body} text-sm`}>
                  {a.sleeps && <p>Sleeps {a.sleeps}</p>}
                  {a.distance && <p>{a.distance} from the Manor</p>}
                  {a.price_per_night && <p>From ${a.price_per_night}/night</p>}
                  {a.availability && <p className="italic">{a.availability}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Things to Do ──────────────────────────────────────────────── */}
      {settings.show_things_to_do && settings.things_to_do?.length > 0 && (
        <Section t={t} alt id="thingstodo" style={{ order: sectionPos('show_things_to_do') }}>
          <SectionHeading t={t} label="While you're here" title="Things to Do Nearby" />
          <div className="grid sm:grid-cols-2 gap-4">
            {settings.things_to_do.filter(item => item.name).map((item, i) => (
              <div key={i} className={`${t.card} p-5`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`${t.heading} text-base`}>{item.name}</p>
                  {item.type && (
                    <span className={`${t.badge} ww-badge text-xs flex-shrink-0`}>
                      {THINGS_TO_DO_EMOJI[item.type?.toLowerCase()] || '📍'} {item.type}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={`${t.body} text-sm mb-2`}>{item.description}</p>
                )}
                <div className="flex items-center gap-3">
                  {item.distance && (
                    <p className={`${t.body} text-xs`}>{item.distance}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${t.link} text-xs`}
                    >
                      Visit website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Registry ────────────────────────────────────────────────────── */}
      {settings.show_registry && settings.registry_links?.length > 0 && (
        <Section t={t} alt id="registry" style={{ order: sectionPos('show_registry') }}>
          <SectionHeading t={t} label="If you'd like to give a gift" title="Registry" />
          <div className="flex flex-wrap gap-4 justify-center">
            {settings.registry_links.filter(r => r.url).map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${t.btn} ww-btn inline-block`}
              >
                {r.label || 'View Registry'}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ── Policies ────────────────────────────────────────────────────── */}
      {(settings.kids_policy || settings.plus_one_policy || settings.signature_cocktail) && (
        <Section t={t} id="details" style={{ order: 51 }}>
          <SectionHeading t={t} label="Good to know" title="A few details" />
          <div className="space-y-4 max-w-lg mx-auto">
            {settings.signature_cocktail && (
              <div className="flex gap-4">
                <span className="text-2xl">🍹</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>Signature cocktail</p>
                  <p className={t.body}>{settings.signature_cocktail}</p>
                </div>
              </div>
            )}
            {settings.kids_policy && (
              <div className="flex gap-4">
                <span className="text-2xl">👶</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>Children</p>
                  <p className={t.body}>{settings.kids_policy}</p>
                </div>
              </div>
            )}
            {settings.plus_one_policy && (
              <div className="flex gap-4">
                <span className="text-2xl">💌</span>
                <div>
                  <p className={`text-sm font-medium ${t.accent}`}>Plus ones</p>
                  <p className={t.body}>{settings.plus_one_policy}</p>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      {settings.show_faq && settings.faq_items?.length > 0 && (
        <Section t={t} alt id="faq" style={{ order: sectionPos('show_faq') }}>
          <SectionHeading t={t} label="Questions?" title="FAQ" />
          <div className="max-w-lg mx-auto space-y-5">
            {settings.faq_items.filter(f => f.question).map((item, i) => (
              <div key={i} className={`${t.card} p-5`}>
                <p className={`font-medium ${t.accent} mb-1`}>{item.question}</p>
                <p className={`${t.body} text-sm`}>{item.answer}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── RSVP ────────────────────────────────────────────────────────── */}
      {settings.show_rsvp !== false && (
        <div style={{ order: sectionPos('show_rsvp') }}>
        <RsvpSection
          t={t}
          slug={slug}
          settings={settings}
          platedMeal={wedding.plated_meal}
          mealOptions={meal_options || []}
        />
        </div>
      )}

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      {settings.show_gallery && galleryPhotos.length > 0 && (
        <Section t={t} id="gallery" style={{ order: sectionPos('show_gallery') }}>
          <SectionHeading t={t} label="Photos" title="Gallery" />
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3`}>
            {galleryPhotos.map((p, idx) => (
              <div
                key={p.id}
                className="relative aspect-square overflow-hidden group cursor-pointer"
                onClick={() => openLightbox(idx)}
              >
                <img
                  src={p.url}
                  alt={p.caption || ''}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${settings.theme === 'warm' ? 'rounded-xl' : ''}`}
                />
                {p.caption && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end">
                    <p className="text-white text-xs p-3 opacity-0 group-hover:opacity-100 transition">{p.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      </div>{/* close flex-col section order container */}

      {/* ── Gallery Lightbox ─────────────────────────────���────────────── */}
      {lightboxOpen && galleryPhotos.length > 0 && (
        <Lightbox
          photos={galleryPhotos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={() => prevPhoto(galleryPhotos.length)}
          onNext={() => nextPhoto(galleryPhotos.length)}
        />
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`py-10 px-6 text-center border-t ${t.divider}`}>
        {settings.footer_message && (
          <p className={`${t.body} italic max-w-md mx-auto mb-4`}>
            "{settings.footer_message}"
          </p>
        )}
        <p className={`font-serif text-2xl ${t.heading} mb-1`}>{displayNames}</p>
        <p className={`${t.body} text-sm`}>{formatDate(wedding.wedding_date)} · {venue.venue_name || 'The Venue'}</p>
        {venue.footer_credit && (
          <p className={`text-xs mt-6 ${t.body} opacity-40`}>
            {venue.website_url
              ? <a href={venue.website_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">{venue.footer_credit}</a>
              : venue.footer_credit
            }
          </p>
        )}
      </footer>

    </div>
  )
}

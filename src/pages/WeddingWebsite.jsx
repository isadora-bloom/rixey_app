import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
  return <div className="border-t border-gray-200 my-2" />
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ t, alt, children, id }) {
  return (
    <section id={id} className={`py-16 px-6 ${alt ? t.altSection : t.section}`}>
      <div className="max-w-3xl mx-auto">{children}</div>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WeddingWebsite() {
  const { slug } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/w/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

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

  const { settings, wedding, photos, party, shuttle, accommodations, wedding_details, venue } = data
  const t = THEMES[settings.theme || 'warm']
  const days = daysUntil(wedding.wedding_date)
  const heroPhoto = photos.find(p => p.tags?.includes('hero')) || photos[0]
  const galleryPhotos = photos.filter(p => !p.tags?.includes('hero'))
  const dressCodePhotos = photos.filter(p => p.tags?.includes('dress-code'))

  const partners = [wedding.partner1_name, wedding.partner2_name].filter(Boolean)
  const displayNames = partners.length === 2
    ? `${partners[0]} & ${partners[1]}`
    : wedding.couple_names || ''

  return (
    <div className={`min-h-screen ${t.page}`}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
        {heroPhoto ? (
          <>
            <img
              src={heroPhoto.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className={`absolute inset-0 ${t.heroOverlay}`} />
          </>
        ) : (
          <div className={`absolute inset-0 ${t.heroFallback}`} />
        )}

        <div className={`relative z-10 ${t.heroText}`}>
          {settings.theme === 'warm' ? (
            <p className="text-sm font-medium tracking-[0.3em] uppercase text-white/70 mb-4">
              You are invited to celebrate
            </p>
          ) : (
            <p className="text-xs tracking-[0.4em] uppercase text-white/60 mb-6">
              The wedding of
            </p>
          )}

          <h1 className={`font-serif mb-4 ${settings.theme === 'warm' ? 'text-5xl sm:text-7xl' : 'text-4xl sm:text-6xl font-light'}`}>
            {displayNames}
          </h1>

          <p className={`text-lg sm:text-xl mb-2 ${settings.theme === 'warm' ? 'text-white/80' : 'text-white/70 tracking-wide'}`}>
            {formatDate(wedding.wedding_date)}
          </p>
          <p className={`text-sm mb-6 ${settings.theme === 'warm' ? 'text-white/60' : 'text-white/50 tracking-widest uppercase text-xs'}`}>
            {venue.venue_name || 'The Venue'}{venue.address_line2 ? ` · ${venue.address_line2}` : ''}
          </p>

          {days !== null && days > 0 && (
            <div className={`inline-block px-6 py-3 rounded-full text-sm mb-6 ${
              settings.theme === 'warm'
                ? 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                : 'border border-white/40 text-white/80'
            }`}>
              {days === 1 ? 'Tomorrow!' : `${days} days to go`}
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

      {/* ── Our Story ───────────────────────────────────────────────────── */}
      {settings.show_story && settings.our_story && (
        <Section t={t} id="story">
          <SectionHeading t={t} label="How it started" title="Our Story" />
          <p className={`${t.body} text-center max-w-2xl mx-auto text-lg whitespace-pre-line`}>
            {settings.our_story}
          </p>
        </Section>
      )}

      {/* ── The Day ─────────────────────────────────────────────────────── */}
      {settings.show_schedule && (settings.ceremony_time || settings.reception_time) && (
        <Section t={t} alt id="schedule">
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
      {settings.show_wedding_party && party.length > 0 && (
        <Section t={t} id="party">
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
        <Section t={t} alt id="dresscode">
          <SectionHeading t={t} label="What to wear" title="Dress Code" />
          <div className="text-center">
            <span className={`${t.badge} text-lg px-6 py-2 inline-block mb-4`}>
              {dressCodeLabel(settings.dress_code)}
            </span>
            {settings.dress_code_note && (
              <p className={`${t.body} max-w-md mx-auto mt-2`}>{settings.dress_code_note}</p>
            )}
          </div>
          {dressCodePhotos.length > 0 && (
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8`}>
              {dressCodePhotos.slice(0, 6).map(p => (
                <img key={p.id} src={p.url} alt={p.caption || ''} className={`aspect-square object-cover w-full ${settings.theme === 'warm' ? 'rounded-xl' : ''}`} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Getting There ────────────────────────────────────────────────── */}
      <Section t={t} id="venue">
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
              className={`inline-block ${t.btn} mb-6`}
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
      </Section>

      {/* ── Transportation ───────────────────────────────────────────────── */}
      {settings.show_transport && shuttle.length > 0 && (
        <Section t={t} alt id="transport">
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
        <Section t={t} id="stay">
          <SectionHeading t={t} label="Places to rest" title="Where to Stay" />
          <div className="grid sm:grid-cols-2 gap-4">
            {accommodations.map(a => (
              <div key={a.id} className={`${t.card} p-5`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`${t.heading} text-base`}>{a.name}</p>
                  <span className={`${t.badge} text-xs flex-shrink-0`}>{a.booking_platform}</span>
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

      {/* ── Registry ────────────────────────────────────────────────────── */}
      {settings.show_registry && settings.registry_links?.length > 0 && (
        <Section t={t} alt id="registry">
          <SectionHeading t={t} label="If you'd like to give a gift" title="Registry" />
          <div className="flex flex-wrap gap-4 justify-center">
            {settings.registry_links.filter(r => r.url).map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${t.btn} inline-block`}
              >
                {r.label || 'View Registry'}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ── Policies ────────────────────────────────────────────────────── */}
      {(settings.kids_policy || settings.plus_one_policy || settings.signature_cocktail) && (
        <Section t={t} id="details">
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
        <Section t={t} alt id="faq">
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

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      {settings.show_gallery && galleryPhotos.length > 0 && (
        <Section t={t} id="gallery">
          <SectionHeading t={t} label="Photos" title="Gallery" />
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3`}>
            {galleryPhotos.map(p => (
              <div key={p.id} className="relative aspect-square overflow-hidden group">
                <img
                  src={p.url}
                  alt={p.caption || ''}
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

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`py-10 px-6 text-center border-t ${t.divider}`}>
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

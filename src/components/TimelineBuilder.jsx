import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || '${API_URL}'

// Events organized by section
// 'chain' property groups events that should be calculated sequentially
// 'parallel' means the event can happen alongside others at the same offset

const PREP_EVENTS = [
  { id: 'hair-makeup-done', name: 'Hair & Makeup Complete', icon: '💄', defaultDuration: 0, description: 'Time all hair & makeup should be finished', isTimeMarker: true, isAnchor: true, alwaysIncluded: true },
  { id: 'buffer-break', name: 'Buffer / Lunch Break', icon: '☕', defaultDuration: 30, description: 'Break for lunch and bathroom before getting dressed', alwaysIncluded: true },
  { id: 'bridesmaids-dressed', name: 'Bridesmaids & Groomsmen Get Dressed', icon: '👗', defaultDuration: 30, description: 'Wedding party puts on their attire', tips: 'Guys and gals happen at same time with 2 photographers', alwaysIncluded: true },
  { id: 'bride-dress', name: 'Bride Gets Dressed', icon: '👰', defaultDuration: 30, description: 'Bride puts on dress - includes dressing photos', alwaysIncluded: true },
  { id: 'groom-getting-ready', name: 'Groom Getting Ready Photos', icon: '🤵', defaultDuration: 30, description: 'Groomsmen photos while bride finishes', canBeConcurrent: true, parallelWith: 'bride-dress' },
  { id: 'bride-getting-ready-photos', name: 'Bride Getting Ready Photos', icon: '📸', defaultDuration: 30, description: 'Final bride portraits before ceremony' },
  { id: 'details-photos', name: 'Details Photos', icon: '💍', defaultDuration: 20, description: 'Rings, shoes, invitations, dress details', tips: 'Can be done during hair/makeup or after', canBeConcurrent: true },
  { id: 'robe-photos', name: 'Robe / Casual Photos', icon: '👘', defaultDuration: 20, description: 'Casual getting ready moments with bridesmaids' },
]

const FIRST_LOOK_EVENTS = [
  { id: 'first-look-dad', name: 'First Look with Dad', icon: '👨‍👧', defaultDuration: 10, description: 'Private moment with father', tips: 'If doing both, this should be BEFORE groom first look', chain: 'first-look' },
  { id: 'first-look-groom', name: 'First Look with Groom', icon: '👀', defaultDuration: 15, description: 'Private reveal between couple', chain: 'first-look' },
  { id: 'private-vows', name: 'Private Vows', icon: '💕', defaultDuration: 15, description: 'Exchange personal vows privately', tips: 'Can be before ceremony or during cocktail hour', chain: 'first-look' },
]

const PHOTO_EVENTS = [
  { id: 'couple-portraits', name: 'Couple Portraits', icon: '📸', defaultDuration: 30, cocktailDuration: 15, description: 'Romantic photos of just the two of you', chain: 'photos' },
  { id: 'wedding-party-photos', name: 'Wedding Party Photos', icon: '👯', defaultDuration: 30, cocktailDuration: 20, description: 'Photos with bridesmaids and groomsmen', chain: 'photos' },
  { id: 'family-formals', name: 'Immediate Family Photos', icon: '👨‍👩‍👧‍👦', defaultDuration: 30, cocktailDuration: 15, description: 'Parents, siblings, grandparents', tips: 'Make a shot list to stay on schedule', chain: 'photos' },
  { id: 'extended-family', name: 'Extended Family Photos', icon: '👪', defaultDuration: 20, cocktailDuration: 10, description: 'Aunts, uncles, cousins - during cocktail hour', tips: 'Only if not doing first look, or for extra family', cocktailHourOnly: true },
]

const PRE_CEREMONY_EVENTS = [
  { id: 'hide-bride', name: 'Put Bride Away', icon: '🙈', defaultDuration: 30, description: 'Bride hidden away before guests start arriving' },
  { id: 'last-shuttle', name: 'Last Shuttle Arrives', icon: '🚌', defaultDuration: 0, description: 'Final guest shuttle before ceremony', isTimeMarker: true },
  { id: 'travel-to-church', name: 'Travel to Ceremony Venue', icon: '🚗', defaultDuration: 30, description: 'If ceremony is off-site', conditional: 'offsite' },
]

const CEREMONY_EVENTS = [
  { id: 'guests-arrive', name: 'Guest Arrival', icon: '🚗', defaultDuration: 30, description: 'Guests arrive and find seats', chain: 'ceremony' },
  { id: 'ceremony-music', name: 'Ceremony Music Begins', icon: '🎵', defaultDuration: 15, description: 'Prelude music as guests are seated', chain: 'ceremony' },
  { id: 'ceremony', name: 'Ceremony', icon: '💒', defaultDuration: 25, description: 'The main event!', chain: 'ceremony', isAnchor: true },
  { id: 'group-photo', name: 'Big Group Photo', icon: '📷', defaultDuration: 5, description: 'Everyone together right after ceremony', chain: 'post-ceremony' },
  { id: 'travel-from-church', name: 'Travel Back from Ceremony', icon: '🚗', defaultDuration: 30, description: 'Return to Rixey Manor after off-site ceremony', conditional: 'offsite', chain: 'post-ceremony' },
]

const COCKTAIL_EVENTS = [
  { id: 'cocktail-hour', name: 'Cocktail Hour', icon: '🥂', defaultDuration: 50, description: 'Drinks and appetizers while photos happen', chain: 'cocktail' },
  { id: 'remaining-photos', name: 'Remaining Photos', icon: '📸', defaultDuration: 15, description: 'Quick additional photos during cocktail hour', tips: 'Even with first look, some photos may happen here' },
  { id: 'couple-break', name: 'B&G Take A Break', icon: '😮‍💨', defaultDuration: 15, description: 'Couple gets a breather, snack, and moment together' },
  { id: 'sunset-photos', name: 'Sunset / Golden Hour Photos', icon: '🌅', defaultDuration: 20, description: 'Sneak away for magic hour shots', autoTime: true },
]

const RECEPTION_INTRO_EVENTS = [
  { id: 'doors-open', name: 'Ballroom/Patio Opens', icon: '🚪', defaultDuration: 10, description: 'Guests move from cocktail to reception space', chain: 'reception-start' },
  { id: 'grand-entrance', name: 'Introductions', icon: '✨', defaultDuration: 5, description: 'Wedding party and couple announced', chain: 'reception-start' },
  { id: 'welcome-toast', name: 'Welcome & Blessing', icon: '🙏', defaultDuration: 5, description: 'Welcome speech and/or blessing over the food', chain: 'reception-start' },
]

const FORMALITIES_EVENTS = [
  { id: 'first-dance', name: 'First Dance', icon: '💃', defaultDuration: 5, description: 'Your first dance as a married couple', chain: 'formalities', canChooseTiming: true },
  { id: 'parent-dances', name: 'Parent Dances', icon: '👨‍👩‍👧', defaultDuration: 5, description: 'Father-daughter and mother-son dances', chain: 'formalities', canChooseTiming: true },
  { id: 'toasts', name: 'Toasts & Speeches', icon: '🎤', defaultDuration: 15, description: 'Best man, maid of honor, and family toasts', tips: 'Limit to 3-5 speeches, 3-5 min each', chain: 'formalities', canChooseTiming: true },
  { id: 'cake-cutting', name: 'Cake Cutting', icon: '🎂', defaultDuration: 10, description: 'Cut the cake together', chain: 'formalities', canChooseTiming: true },
  { id: 'anniversary-dance', name: 'Anniversary Dance', icon: '💑', defaultDuration: 5, description: 'Married couples dance, longest married wins', chain: 'formalities', canChooseTiming: true },
  { id: 'newlywed-game', name: 'Newlywed Game', icon: '🎮', defaultDuration: 5, description: 'Fun game to entertain guests', chain: 'formalities', canChooseTiming: true },
  { id: 'bouquet-toss', name: 'Bouquet Toss', icon: '💐', defaultDuration: 5, description: 'Toss the bouquet', chain: 'late-formalities' },
  { id: 'garter-toss', name: 'Garter Toss', icon: '🎀', defaultDuration: 5, description: 'Traditional garter toss', chain: 'late-formalities' },
]

const DINNER_EVENT = { id: 'dinner', name: 'Dinner Service', icon: '🍽️' }

const DINNER_TYPES = [
  { id: 'buffet', name: 'Buffet', duration: 60, description: 'Guests serve themselves' },
  { id: 'plated', name: 'Plated Service', duration: 90, description: 'Served courses' },
  { id: 'multi-course', name: 'Multiple Courses / Food Truck', duration: 120, description: 'Extended dining experience' },
]

const END_EVENTS = [
  { id: 'open-dancing', name: 'Open Dancing Begins', icon: '🪩', defaultDuration: 0, description: 'Dance floor is open until last dance!', isTimeMarker: true, noDuration: true },
  { id: 'grand-exit', name: 'Sparkler / Grand Exit', icon: '🎇', defaultDuration: 10, description: 'Sparklers, bubbles, or confetti send-off', tips: 'Can happen mid-reception (couple returns to party!) or at the very end', flexible: true },
  { id: 'last-dance', name: 'Last Dance', icon: '💕', defaultDuration: 5, description: 'Final dance with all guests', fromEnd: true },
  { id: 'private-last-dance', name: 'Private Last Dance', icon: '💑', defaultDuration: 5, description: 'Just the two of you after guests leave', tips: 'Happens after the last dance, very end of the night', afterLastDance: true },
]

// Calculate sunset time for Rixey Manor (Rapidan, VA - 38.4°N, 78.0°W)
function calculateSunset(dateStr) {
  if (!dateStr) return null

  const date = new Date(dateStr)
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))

  // Simplified sunset calculation for latitude 38.4°N
  // Summer solstice (~June 21) sunset is around 8:45 PM, winter solstice (~Dec 21) around 5:00 PM
  const lat = 38.4
  const declinationAngle = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81))
  const hourAngle = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(declinationAngle * Math.PI / 180))
  const sunsetHour = 12 + (hourAngle * 180 / Math.PI) / 15

  // Adjust for timezone and DST (Virginia is UTC-5, DST adds 1 hour March-Nov)
  const month = date.getMonth()
  const isDST = month >= 2 && month <= 10 // Rough DST check (March-November)
  const adjustedHour = sunsetHour + (isDST ? 1 : 0)

  const hours = Math.floor(adjustedHour)
  const minutes = Math.round((adjustedHour - hours) * 60)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export default function TimelineBuilder({ weddingId, weddingDate, isAdmin = false }) {
  const [events, setEvents] = useState({})
  const [shuttleArrivals, setShuttleArrivals] = useState([])
  const [shuttleDepartures, setShuttleDepartures] = useState([])
  const [customEvents, setCustomEvents] = useState([])
  const [ceremonyTime, setCeremonyTime] = useState('16:00')
  const [receptionEnd, setReceptionEnd] = useState('22:00')
  const [offSiteCeremony, setOffSiteCeremony] = useState(false)
  const [dinnerType, setDinnerType] = useState('buffet')
  const [formalitiesTiming, setFormalitiesTiming] = useState('after') // 'before' or 'after' dinner
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [newCustomEvent, setNewCustomEvent] = useState({ name: '', time: '', duration: 15, notes: '' })
  const [autoCalculate, setAutoCalculate] = useState(true)
  const [concurrentEvents, setConcurrentEvents] = useState({}) // Track which events are concurrent with others
  const [doingFirstLook, setDoingFirstLook] = useState(true) // First look vs traditional (no first look)
  const [formalityTimings, setFormalityTimings] = useState({}) // Individual before/after dinner for each formality

  // Calculate sunset time for the wedding date
  const sunsetTime = calculateSunset(weddingDate)

  // Convert time string to minutes from midnight
  const timeToMinutes = (time) => {
    if (!time) return 0
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
  }

  // Convert minutes from midnight to time string
  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60) % 24
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (weddingId) loadTimeline()
  }, [weddingId])

  // Recalculate times when ceremony time or settings change
  useEffect(() => {
    if (autoCalculate && !loading) {
      recalculateAllTimes()
    }
  }, [ceremonyTime, receptionEnd, formalitiesTiming, dinnerType, offSiteCeremony, doingFirstLook, formalityTimings])

  const getAllEventDefs = () => [
    ...PREP_EVENTS, ...FIRST_LOOK_EVENTS, ...PHOTO_EVENTS,
    ...PRE_CEREMONY_EVENTS, ...CEREMONY_EVENTS, ...COCKTAIL_EVENTS,
    ...RECEPTION_INTRO_EVENTS, ...FORMALITIES_EVENTS, ...END_EVENTS
  ]

  // Calculate times with explicit settings (for loading and recalculation)
  const calculateTimesWithSettings = (currentEvents, cerTime, recEnd, dinType, formTiming, offSite, concurrent = concurrentEvents, firstLook = doingFirstLook, sunset = sunsetTime, formTimings = formalityTimings) => {
    const ceremonyMinutes = timeToMinutes(cerTime)
    const endMinutes = timeToMinutes(recEnd)
    const dinnerDuration = DINNER_TYPES.find(d => d.id === dinType)?.duration || 60

    const calculated = { ...currentEvents }

    const shouldCalculate = (id) => calculated[id]?.included && !calculated[id]?.manualTime
    const isIncluded = (id) => calculated[id]?.included
    const getDuration = (id) => calculated[id]?.duration || 0
    const isEventConcurrent = (id) => concurrent[id]?.isConcurrent

    // ========== CEREMONY TIMING ==========
    if (shouldCalculate('ceremony')) {
      calculated['ceremony'].time = minutesToTime(ceremonyMinutes)
    }
    if (shouldCalculate('ceremony-music')) {
      calculated['ceremony-music'].time = minutesToTime(ceremonyMinutes - 15)
    }
    if (shouldCalculate('guests-arrive')) {
      calculated['guests-arrive'].time = minutesToTime(ceremonyMinutes - 30)
    }

    // ========== CALCULATE TIME NEEDED BEFORE CEREMONY ==========
    let timeNeededBeforeCeremony = 45 // Base: bride hidden + guests arriving

    // Add travel time if off-site
    if (offSite && isIncluded('travel-to-church')) {
      timeNeededBeforeCeremony += getDuration('travel-to-church')
    }

    // If FIRST LOOK: Add photo time before ceremony
    if (firstLook) {
      const photoChain = ['family-formals', 'wedding-party-photos', 'couple-portraits']
      photoChain.forEach(id => {
        if (isIncluded(id)) timeNeededBeforeCeremony += getDuration(id)
      })

      // Add first look events
      const firstLookChain = ['first-look-dad', 'first-look-groom', 'private-vows']
      firstLookChain.forEach(id => {
        if (isIncluded(id)) timeNeededBeforeCeremony += getDuration(id)
      })
    }

    // Add bride prep time (always needed)
    if (isIncluded('bride-dress')) timeNeededBeforeCeremony += getDuration('bride-dress')
    if (isIncluded('bridesmaids-dressed') && !isEventConcurrent('bridesmaids-dressed')) {
      timeNeededBeforeCeremony += getDuration('bridesmaids-dressed')
    }
    if (isIncluded('groom-getting-ready') && !isEventConcurrent('groom-getting-ready')) {
      timeNeededBeforeCeremony += getDuration('groom-getting-ready')
    }
    if (isIncluded('bride-getting-ready-photos')) timeNeededBeforeCeremony += getDuration('bride-getting-ready-photos')
    if (isIncluded('robe-photos')) timeNeededBeforeCeremony += getDuration('robe-photos')
    if (isIncluded('details-photos') && !isEventConcurrent('details-photos')) {
      timeNeededBeforeCeremony += getDuration('details-photos')
    }

    // Add buffer break time
    timeNeededBeforeCeremony += getDuration('buffer-break') || 30

    // ========== WORK FORWARD FROM HAIR & MAKEUP ==========
    const hairMakeupDoneTime = ceremonyMinutes - timeNeededBeforeCeremony

    if (shouldCalculate('hair-makeup-done')) {
      calculated['hair-makeup-done'].time = minutesToTime(hairMakeupDoneTime)
    }

    // Buffer break right after H&M
    let currentTime = hairMakeupDoneTime
    if (shouldCalculate('buffer-break')) {
      calculated['buffer-break'].time = minutesToTime(currentTime)
    }
    currentTime += getDuration('buffer-break') || 30

    // Concurrent events - happen during other prep
    if (isIncluded('details-photos') && isEventConcurrent('details-photos') && shouldCalculate('details-photos')) {
      calculated['details-photos'].time = minutesToTime(hairMakeupDoneTime - 30)
    }
    if (isIncluded('lunch') && isEventConcurrent('lunch') && shouldCalculate('lunch')) {
      calculated['lunch'].time = minutesToTime(hairMakeupDoneTime - 60)
    }

    // Robe photos (after buffer)
    if (isIncluded('robe-photos')) {
      if (shouldCalculate('robe-photos')) {
        calculated['robe-photos'].time = minutesToTime(currentTime)
      }
      currentTime += getDuration('robe-photos')
    }

    // Bridesmaids get dressed
    const bridesmaidsTime = currentTime
    if (isIncluded('bridesmaids-dressed')) {
      if (shouldCalculate('bridesmaids-dressed')) {
        calculated['bridesmaids-dressed'].time = minutesToTime(currentTime)
      }
      if (!isEventConcurrent('bridesmaids-dressed')) {
        currentTime += getDuration('bridesmaids-dressed')
      }
    }

    // Groom prep - PARALLEL with bridesmaids if concurrent, otherwise sequential
    if (isIncluded('groom-getting-ready')) {
      if (isEventConcurrent('groom-getting-ready')) {
        // Happens same time as bridesmaids
        if (shouldCalculate('groom-getting-ready')) {
          calculated['groom-getting-ready'].time = minutesToTime(bridesmaidsTime)
        }
      } else {
        // Sequential - happens in the timeline
        if (shouldCalculate('groom-getting-ready')) {
          calculated['groom-getting-ready'].time = minutesToTime(currentTime)
        }
        currentTime += getDuration('groom-getting-ready')
      }
    }

    // Bride gets dressed
    if (isIncluded('bride-dress')) {
      if (shouldCalculate('bride-dress')) {
        calculated['bride-dress'].time = minutesToTime(currentTime)
      }
      currentTime += getDuration('bride-dress')
    }

    // Bride getting ready photos (after she's dressed)
    if (isIncluded('bride-getting-ready-photos')) {
      if (shouldCalculate('bride-getting-ready-photos')) {
        calculated['bride-getting-ready-photos'].time = minutesToTime(currentTime)
      }
      currentTime += getDuration('bride-getting-ready-photos')
    }

    // Non-concurrent details photos
    if (isIncluded('details-photos') && !isEventConcurrent('details-photos')) {
      if (shouldCalculate('details-photos')) {
        calculated['details-photos'].time = minutesToTime(currentTime)
      }
      currentTime += getDuration('details-photos')
    }

    // ========== FIRST LOOK PATH: Photos before ceremony ==========
    if (firstLook) {
      // First look events
      const firstLookChain = ['first-look-dad', 'first-look-groom', 'private-vows']
      firstLookChain.forEach(id => {
        if (isIncluded(id)) {
          if (shouldCalculate(id)) {
            calculated[id].time = minutesToTime(currentTime)
          }
          currentTime += getDuration(id)
        }
      })

      // Photos before ceremony
      const photoChainForward = ['couple-portraits', 'wedding-party-photos', 'family-formals']
      photoChainForward.forEach(id => {
        if (isIncluded(id)) {
          if (shouldCalculate(id)) {
            calculated[id].time = minutesToTime(currentTime)
          }
          currentTime += getDuration(id)
        }
      })
    }

    // Put Bride Away - after all pre-ceremony photos, ~30 min before ceremony
    if (isIncluded('hide-bride')) {
      if (shouldCalculate('hide-bride')) {
        calculated['hide-bride'].time = minutesToTime(ceremonyMinutes - 30 - getDuration('hide-bride'))
      }
    }

    // Last shuttle arrives - 15-20 min before ceremony
    if (isIncluded('last-shuttle') && shouldCalculate('last-shuttle')) {
      calculated['last-shuttle'].time = minutesToTime(ceremonyMinutes - 15)
    }

    // Travel to off-site ceremony
    if (offSite && isIncluded('travel-to-church')) {
      if (shouldCalculate('travel-to-church')) {
        calculated['travel-to-church'].time = minutesToTime(ceremonyMinutes - 40 - getDuration('travel-to-church'))
      }
    }

    // ========== POST-CEREMONY ==========
    const ceremonyEndMinutes = ceremonyMinutes + getDuration('ceremony')
    let postCeremonyTime = ceremonyEndMinutes

    if (isIncluded('group-photo')) {
      if (shouldCalculate('group-photo')) {
        calculated['group-photo'].time = minutesToTime(postCeremonyTime)
      }
      postCeremonyTime += getDuration('group-photo')
    }

    if (offSite && isIncluded('travel-from-church')) {
      if (shouldCalculate('travel-from-church')) {
        calculated['travel-from-church'].time = minutesToTime(postCeremonyTime)
      }
      postCeremonyTime += getDuration('travel-from-church')
    }

    // ========== COCKTAIL HOUR & SUNSET ==========
    const cocktailStart = postCeremonyTime
    if (shouldCalculate('cocktail-hour')) {
      calculated['cocktail-hour'].time = minutesToTime(cocktailStart)
    }

    // Calculate sunset time as a HARD BLOCK - other events must work around it
    const sunsetMinutes = sunset ? timeToMinutes(sunset) : null
    const sunsetPhotoStart = sunsetMinutes ? sunsetMinutes - 20 : null
    const sunsetPhotoEnd = sunsetMinutes // Photos end at sunset

    let photoEndTime = cocktailStart // Track when photos actually finish

    // NO FIRST LOOK PATH: Photos during cocktail hour - interleave with sunset
    // Order: family first, then wedding party, then couple (sweethearts last)
    // Use shorter cocktail durations for these photos
    if (!firstLook) {
      let cocktailPhotoTime = cocktailStart
      const photoChain = ['family-formals', 'wedding-party-photos', 'couple-portraits', 'extended-family']

      photoChain.forEach(id => {
        if (isIncluded(id)) {
          // Use cocktail duration if available, otherwise default duration
          const photoDef = PHOTO_EVENTS.find(e => e.id === id)
          const photoDuration = photoDef?.cocktailDuration || getDuration(id)
          const photoWouldEnd = cocktailPhotoTime + photoDuration

          // Check if this photo would overlap with sunset block
          if (sunsetPhotoStart && cocktailPhotoTime < sunsetPhotoEnd && photoWouldEnd > sunsetPhotoStart) {
            // Photo overlaps with sunset - check if we can fit it before sunset
            if (cocktailPhotoTime + photoDuration <= sunsetPhotoStart) {
              // Fits before sunset
              if (shouldCalculate(id)) {
                calculated[id].time = minutesToTime(cocktailPhotoTime)
              }
              cocktailPhotoTime += photoDuration
            } else {
              // Doesn't fit before sunset - schedule after sunset ends
              if (shouldCalculate(id)) {
                calculated[id].time = minutesToTime(sunsetPhotoEnd)
              }
              cocktailPhotoTime = sunsetPhotoEnd + photoDuration
            }
          } else if (sunsetPhotoStart && cocktailPhotoTime >= sunsetPhotoStart && cocktailPhotoTime < sunsetPhotoEnd) {
            // We're in the sunset block - push to after sunset
            cocktailPhotoTime = sunsetPhotoEnd
            if (shouldCalculate(id)) {
              calculated[id].time = minutesToTime(cocktailPhotoTime)
            }
            cocktailPhotoTime += photoDuration
          } else {
            // No sunset conflict - schedule normally
            if (shouldCalculate(id)) {
              calculated[id].time = minutesToTime(cocktailPhotoTime)
            }
            cocktailPhotoTime += photoDuration
          }
        }
      })
      photoEndTime = cocktailPhotoTime

      // B&G break after photos (no first look path)
      if (isIncluded('couple-break') && shouldCalculate('couple-break')) {
        calculated['couple-break'].time = minutesToTime(photoEndTime)
      }

      // Make sure photoEndTime accounts for sunset if it happens after last photo
      if (sunsetPhotoEnd && sunsetPhotoEnd > photoEndTime) {
        photoEndTime = Math.max(photoEndTime, sunsetPhotoEnd)
      }
    } else {
      // FIRST LOOK: Extended family and remaining photos during cocktail hour
      let firstLookCocktailTime = cocktailStart + 5 // Start 5 min into cocktail

      if (isIncluded('remaining-photos') && shouldCalculate('remaining-photos')) {
        calculated['remaining-photos'].time = minutesToTime(firstLookCocktailTime)
        firstLookCocktailTime += getDuration('remaining-photos')
      }

      if (isIncluded('extended-family') && shouldCalculate('extended-family')) {
        calculated['extended-family'].time = minutesToTime(firstLookCocktailTime)
        firstLookCocktailTime += getDuration('extended-family')
      }

      // B&G break after photos
      if (isIncluded('couple-break') && shouldCalculate('couple-break')) {
        calculated['couple-break'].time = minutesToTime(firstLookCocktailTime)
      }
    }

    // Set sunset photos time (always at the correct time)
    if (sunsetPhotoStart && isIncluded('sunset-photos') && shouldCalculate('sunset-photos')) {
      calculated['sunset-photos'].time = minutesToTime(sunsetPhotoStart)
      calculated['sunset-photos'].actualSunset = sunset

      // Determine zone for display purposes
      if (firstLook) {
        calculated['sunset-photos'].sunsetZone = 'safe'
        calculated['sunset-photos'].sunsetZoneNote = 'Couple sneaks away during cocktail hour'
      } else {
        calculated['sunset-photos'].sunsetZone = 'scheduled'
        calculated['sunset-photos'].sunsetZoneNote = 'Photos scheduled around sunset - timeline adjusted'
      }
    }

    // Reception starts after cocktail hour
    // In no-first-look mode, photos happen DURING cocktail hour (concurrent), not after
    // So reception timing is based on cocktail duration, not photo duration
    const cocktailDuration = isIncluded('cocktail-hour') ? getDuration('cocktail-hour') : 50
    const cocktailEnd = cocktailStart + cocktailDuration

    // For first look: reception after cocktail hour
    // For traditional: reception after cocktail hour (photos are concurrent)
    let receptionTime = cocktailEnd

    // ========== RECEPTION INTRO ==========
    if (isIncluded('doors-open')) {
      if (shouldCalculate('doors-open')) {
        calculated['doors-open'].time = minutesToTime(receptionTime)
      }
      receptionTime += getDuration('doors-open')
    }

    if (isIncluded('grand-entrance')) {
      if (shouldCalculate('grand-entrance')) {
        calculated['grand-entrance'].time = minutesToTime(receptionTime)
      }
      receptionTime += getDuration('grand-entrance')
    }

    if (isIncluded('welcome-toast')) {
      if (shouldCalculate('welcome-toast')) {
        calculated['welcome-toast'].time = minutesToTime(receptionTime)
      }
      receptionTime += getDuration('welcome-toast')
    }

    // ========== FORMALITIES & DINNER ==========
    const formalitiesChain = ['first-dance', 'parent-dances', 'toasts', 'cake-cutting', 'anniversary-dance', 'newlywed-game']

    // Separate formalities into before and after dinner based on individual settings
    // Default to the global formTiming if individual setting not specified
    const beforeDinnerFormalities = formalitiesChain.filter(id => {
      if (!isIncluded(id)) return false
      const individualTiming = formTimings[id]
      if (individualTiming !== undefined) return individualTiming === 'before'
      return formTiming === 'before'
    })

    const afterDinnerFormalities = formalitiesChain.filter(id => {
      if (!isIncluded(id)) return false
      const individualTiming = formTimings[id]
      if (individualTiming !== undefined) return individualTiming === 'after'
      return formTiming === 'after'
    })

    // Schedule before-dinner formalities
    let beforeDinnerTime = receptionTime
    beforeDinnerFormalities.forEach(id => {
      if (shouldCalculate(id)) {
        calculated[id].time = minutesToTime(beforeDinnerTime)
      }
      beforeDinnerTime += getDuration(id)
    })

    // Dinner starts after before-dinner formalities
    if (!calculated['dinner']?.manualTime) {
      calculated['dinner'].time = minutesToTime(beforeDinnerTime)
    }

    // After-dinner formalities
    const afterDinnerStart = beforeDinnerTime + dinnerDuration
    let afterDinnerTime = afterDinnerStart

    afterDinnerFormalities.forEach(id => {
      if (shouldCalculate(id)) {
        calculated[id].time = minutesToTime(afterDinnerTime)
      }
      afterDinnerTime += getDuration(id)
    })

    // Open dancing starts after all formalities
    if (shouldCalculate('open-dancing')) {
      calculated['open-dancing'].time = minutesToTime(afterDinnerTime)
    }

    // Late formalities
    if (shouldCalculate('bouquet-toss')) {
      calculated['bouquet-toss'].time = minutesToTime(endMinutes - 60)
    }
    if (shouldCalculate('garter-toss')) {
      calculated['garter-toss'].time = minutesToTime(endMinutes - 55)
    }

    // ========== END OF NIGHT ==========
    // Last dance is 10 min before end (5 min dance + 5 min buffer)
    if (shouldCalculate('last-dance')) {
      calculated['last-dance'].time = minutesToTime(endMinutes - 10)
    }

    // Private last dance after last dance (at the very end)
    if (shouldCalculate('private-last-dance')) {
      calculated['private-last-dance'].time = minutesToTime(endMinutes - 5)
    }

    // Grand exit - flexible timing, default to 15 min before end if included
    // (but user can manually adjust since it's not always at end)
    if (shouldCalculate('grand-exit')) {
      calculated['grand-exit'].time = minutesToTime(endMinutes - 15)
    }

    // ========== FINAL SUNSET ZONE CHECK ==========
    // Update sunset zone info based on final calculated times (for display)
    if (sunsetPhotoStart && isIncluded('sunset-photos') && calculated['sunset-photos']) {
      const dinnerStart = timeToMinutes(calculated['dinner']?.time || '18:00')
      const dinnerEnd = dinnerStart + dinnerDuration
      const dancingStart = timeToMinutes(calculated['open-dancing']?.time || '20:00')

      // Check for "sneak away" safe zones (dinner or dancing)
      if (sunsetPhotoStart >= dinnerStart && sunsetPhotoStart < dinnerEnd) {
        calculated['sunset-photos'].sunsetZone = 'dinner'
        calculated['sunset-photos'].sunsetZoneNote = 'During dinner - couple sneaks away while guests eat'
      } else if (sunsetPhotoStart >= dancingStart && sunsetPhotoStart < endMinutes) {
        calculated['sunset-photos'].sunsetZone = 'dancing'
        calculated['sunset-photos'].sunsetZoneNote = 'During open dancing - couple sneaks away from the dance floor'
      } else if (sunsetPhotoStart < ceremonyMinutes) {
        calculated['sunset-photos'].sunsetZone = 'early'
        calculated['sunset-photos'].sunsetZoneNote = '⚠️ Sunset is before ceremony - consider a later start time'
      }
      // Otherwise keep the zone set earlier (safe/scheduled)
    }

    return calculated
  }

  // Calculate all times using current state values
  const calculateAllTimes = (currentEvents) => {
    return calculateTimesWithSettings(currentEvents, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
  }

  const initializeEvents = () => {
    const allEvents = getAllEventDefs()
    const initial = {}
    allEvents.forEach(e => {
      initial[e.id] = {
        ...e,
        included: e.alwaysIncluded || false, // Auto-include events marked as alwaysIncluded
        time: '',
        duration: e.defaultDuration,
        eventNotes: '',
        manualTime: false
      }
    })
    // Add dinner separately - always included by default
    initial['dinner'] = {
      ...DINNER_EVENT,
      included: true,
      time: '',
      duration: DINNER_TYPES.find(d => d.id === dinnerType)?.duration || 60,
      manualTime: false
    }
    // Calculate initial times
    return calculateTimesWithSettings(initial, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
  }

  const recalculateAllTimes = () => {
    setEvents(prev => {
      // Update dinner duration based on type
      const updated = { ...prev }
      if (updated['dinner']) {
        updated['dinner'].duration = DINNER_TYPES.find(d => d.id === dinnerType)?.duration || 60
      }
      // Update photo durations based on first look vs traditional
      const photoDefs = PHOTO_EVENTS
      photoDefs.forEach(def => {
        if (updated[def.id] && def.cocktailDuration) {
          // Use shorter durations for cocktail hour photos (no first look)
          const appropriateDuration = doingFirstLook ? def.defaultDuration : def.cocktailDuration
          // Only update if not manually set
          if (!updated[def.id].manualDuration) {
            updated[def.id].duration = appropriateDuration
          }
        }
      })
      return calculateTimesWithSettings(updated, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
    })
  }

  const loadTimeline = async () => {
    try {
      const response = await fetch(`${API_URL}/api/timeline/${weddingId}`)
      const data = await response.json()

      let loadedCeremonyTime = '16:00'
      let loadedReceptionEnd = '22:00'
      let loadedDinnerType = 'buffet'
      let loadedFormalitiesTiming = 'after'
      let loadedOffSite = false

      if (data.timeline) {
        loadedCeremonyTime = data.timeline.ceremony_start || '16:00'
        loadedReceptionEnd = data.timeline.reception_end || '22:00'
        setCeremonyTime(loadedCeremonyTime)
        setReceptionEnd(loadedReceptionEnd)
        setNotes(data.timeline.notes || '')

        const savedData = data.timeline.timeline_data || {}
        if (typeof savedData === 'object' && !Array.isArray(savedData) && savedData.events) {
          loadedDinnerType = savedData.dinnerType || 'buffet'
          loadedFormalitiesTiming = savedData.formalitiesTiming || 'after'
          loadedOffSite = savedData.offSiteCeremony || false

          setDinnerType(loadedDinnerType)
          setFormalitiesTiming(loadedFormalitiesTiming)
          setOffSiteCeremony(loadedOffSite)
          setShuttleArrivals(savedData.shuttleArrivals || [])
          setShuttleDepartures(savedData.shuttleDepartures || [])
          setCustomEvents(savedData.customEvents || [])
          const loadedConcurrent = savedData.concurrentEvents || {}
          const loadedFirstLook = savedData.doingFirstLook !== false // Default to true
          const loadedFormalityTimings = savedData.formalityTimings || {}

          setAutoCalculate(savedData.autoCalculate !== false)
          setConcurrentEvents(loadedConcurrent)
          setDoingFirstLook(loadedFirstLook)
          setFormalityTimings(loadedFormalityTimings)

          // Initialize events first
          const allEvents = getAllEventDefs()
          const initial = {}
          allEvents.forEach(e => {
            initial[e.id] = {
              ...e,
              included: e.alwaysIncluded || false,
              time: '',
              duration: e.defaultDuration,
              eventNotes: '',
              manualTime: false
            }
          })
          initial['dinner'] = {
            ...DINNER_EVENT,
            included: true,
            time: '',
            duration: DINNER_TYPES.find(d => d.id === loadedDinnerType)?.duration || 60,
            manualTime: false
          }

          // Merge saved events
          Object.keys(savedData.events).forEach(key => {
            if (initial[key]) {
              initial[key] = { ...initial[key], ...savedData.events[key] }
            }
          })

          // Calculate times with loaded settings (pass loaded values directly since state updates are async)
          const calculated = calculateTimesWithSettings(initial, loadedCeremonyTime, loadedReceptionEnd, loadedDinnerType, loadedFormalitiesTiming, loadedOffSite, loadedConcurrent, loadedFirstLook, sunsetTime, loadedFormalityTimings)
          setEvents(calculated)
        } else {
          setEvents(initializeEvents())
        }
      } else {
        setEvents(initializeEvents())
      }
    } catch (err) {
      console.error('Failed to load timeline:', err)
      setEvents(initializeEvents())
    }
    setLoading(false)
  }

  const saveTimeline = async () => {
    setSaving(true)
    try {
      await fetch('${API_URL}/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          timelineData: {
            events,
            shuttleArrivals,
            shuttleDepartures,
            customEvents,
            offSiteCeremony,
            dinnerType,
            formalitiesTiming,
            autoCalculate,
            concurrentEvents,
            doingFirstLook,
            formalityTimings
          },
          ceremonyStart: ceremonyTime,
          receptionEnd,
          notes
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save timeline:', err)
    }
    setSaving(false)
  }

  const updateEvent = (id, field, value) => {
    setEvents(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value,
          // Mark as manual if they're changing the time
          ...(field === 'time' ? { manualTime: true } : {})
        }
      }

      // Recalculate all times when duration changes (since other events depend on it)
      if (field === 'duration' && autoCalculate) {
        return calculateTimesWithSettings(updated, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
      }

      return updated
    })
  }

  const toggleEvent = (id) => {
    setEvents(prev => {
      const event = prev[id]
      if (!event) return prev

      const updated = {
        ...prev,
        [id]: { ...event, included: !event.included }
      }

      // Recalculate all times when toggling (since times depend on what's included)
      if (autoCalculate) {
        return calculateTimesWithSettings(updated, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
      }

      return updated
    })
  }

  const resetToAutoTimes = () => {
    setEvents(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(key => {
        updated[key] = { ...updated[key], manualTime: false }
      })
      return calculateTimesWithSettings(updated, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, concurrentEvents, doingFirstLook, sunsetTime, formalityTimings)
    })
  }

  const addShuttleArrival = () => {
    const defaultTime = minutesToTime(timeToMinutes(ceremonyTime) - 30) // 30 min before ceremony
    setShuttleArrivals(prev => [...prev, { id: `arrival-${Date.now()}`, time: defaultTime, notes: '' }])
  }

  const addShuttleDeparture = () => {
    setShuttleDepartures(prev => [...prev, { id: `departure-${Date.now()}`, time: receptionEnd, notes: '' }])
  }

  const updateShuttle = (type, id, field, value) => {
    const setter = type === 'arrival' ? setShuttleArrivals : setShuttleDepartures
    setter(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeShuttle = (type, id) => {
    const setter = type === 'arrival' ? setShuttleArrivals : setShuttleDepartures
    setter(prev => prev.filter(s => s.id !== id))
  }

  const addCustomEvent = () => {
    if (!newCustomEvent.name.trim()) return
    setCustomEvents(prev => [...prev, { ...newCustomEvent, id: `custom-${Date.now()}` }])
    setNewCustomEvent({ name: '', time: '', duration: 15, notes: '' })
    setShowAddCustom(false)
  }

  const removeCustomEvent = (id) => {
    setCustomEvents(prev => prev.filter(e => e.id !== id))
  }

  const formatTime = (time24) => {
    if (!time24) return '—'
    const [hours, minutes] = time24.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return ''
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const renderEventRow = (eventDef) => {
    const event = events[eventDef.id] || { included: false, time: '', duration: eventDef.defaultDuration }

    // Hide conditional events if condition not met
    if (eventDef.conditional === 'offsite' && !offSiteCeremony) return null

    return (
      <div
        key={eventDef.id}
        className={`flex items-start gap-3 p-3 rounded-lg border transition ${
          event.included
            ? 'bg-white border-sage-200 shadow-sm'
            : 'bg-cream-50/50 border-cream-200'
        }`}
      >
        <button
          onClick={() => toggleEvent(eventDef.id)}
          className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
            event.included
              ? 'bg-sage-600 border-sage-600 text-white'
              : 'border-sage-300 hover:border-sage-400'
          }`}
        >
          {event.included && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <span className="text-xl shrink-0">{eventDef.icon}</span>

        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${event.included ? 'text-sage-800' : 'text-sage-400'}`}>
            {eventDef.name}
            {concurrentEvents[eventDef.id]?.isConcurrent && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">concurrent</span>
            )}
          </p>
          <p className="text-sage-500 text-xs">{eventDef.description}</p>
          {eventDef.tips && event.included && (
            <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
              <span>💡</span> {eventDef.tips}
            </p>
          )}
          {/* Concurrent checkbox for eligible events */}
          {eventDef.canBeConcurrent && event.included && (
            <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={concurrentEvents[eventDef.id]?.isConcurrent || false}
                onChange={(e) => {
                  const newConcurrent = {
                    ...concurrentEvents,
                    [eventDef.id]: { ...concurrentEvents[eventDef.id], isConcurrent: e.target.checked }
                  }
                  setConcurrentEvents(newConcurrent)
                  // Trigger recalculation with new concurrent value
                  if (autoCalculate) {
                    setEvents(prev => calculateTimesWithSettings(prev, ceremonyTime, receptionEnd, dinnerType, formalitiesTiming, offSiteCeremony, newConcurrent, doingFirstLook, sunsetTime, formalityTimings))
                  }
                }}
                className="w-3.5 h-3.5 rounded border-blue-300 text-blue-600"
              />
              <span className="text-xs text-blue-600">Happens during other prep</span>
            </label>
          )}
          {/* Before/After dinner toggle for formalities */}
          {eventDef.canChooseTiming && event.included && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-sage-500">When:</span>
              <select
                value={formalityTimings[eventDef.id] || formalitiesTiming}
                onChange={(e) => {
                  const newTimings = { ...formalityTimings, [eventDef.id]: e.target.value }
                  setFormalityTimings(newTimings)
                }}
                className="text-xs px-2 py-0.5 border border-sage-300 rounded bg-white"
              >
                <option value="before">Before dinner</option>
                <option value="after">After dinner</option>
              </select>
            </div>
          )}
        </div>

        {event.included && (
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <input
                type="time"
                value={event.time || ''}
                onChange={(e) => updateEvent(eventDef.id, 'time', e.target.value)}
                className={`px-2 py-1 border rounded text-sm w-24 ${event.manualTime ? 'border-amber-300 bg-amber-50' : 'border-cream-300'}`}
              />
              <p className="text-sage-400 text-xs text-right">{formatTime(event.time)}</p>
            </div>
            {!eventDef.isTimeMarker && (
              <div>
                <select
                  value={event.duration}
                  onChange={(e) => updateEvent(eventDef.id, 'duration', Number(e.target.value))}
                  className="px-2 py-1 border border-cream-300 rounded text-sm"
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={25}>25 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1h 30m</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSection = (title, emoji, eventsList, extra = null) => (
    <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
      <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h3>
      <div className="space-y-2">
        {eventsList.map(e => renderEventRow(e))}
        {extra}
      </div>
    </div>
  )

  if (loading) {
    return <div className="text-sage-400 text-center py-8">Loading timeline...</div>
  }

  // Build summary timeline
  const buildSummary = () => {
    const items = []

    // Add all included events with times
    Object.entries(events).forEach(([id, event]) => {
      if (event.included && event.time) {
        const def = getAllEventDefs().find(e => e.id === id) || (id === 'dinner' ? DINNER_EVENT : null)
        if (def?.conditional === 'offsite' && !offSiteCeremony) return
        items.push({ ...event, ...def, id })
      }
    })

    // Add shuttles
    shuttleArrivals.forEach(s => {
      if (s.time) items.push({ name: `Shuttle Arrival${s.notes ? ` (${s.notes})` : ''}`, time: s.time, icon: '🚌', duration: 0 })
    })
    shuttleDepartures.forEach(s => {
      if (s.time) items.push({ name: `Shuttle Departure${s.notes ? ` (${s.notes})` : ''}`, time: s.time, icon: '🚌', duration: 0 })
    })

    // Add custom events
    customEvents.forEach(e => {
      if (e.time) items.push({ ...e, icon: '⭐' })
    })

    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }

  const dinnerDuration = DINNER_TYPES.find(d => d.id === dinnerType)?.duration || 60

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Wedding Day Timeline</h2>
          <p className="text-sage-500 text-sm">Times auto-calculate based on your ceremony time</p>
        </div>
        <button
          onClick={saveTimeline}
          disabled={saving}
          className={`px-5 py-2 rounded-lg font-medium transition ${
            saved ? 'bg-green-500 text-white' : 'bg-sage-600 text-white hover:bg-sage-700'
          } disabled:opacity-50`}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Timeline'}
        </button>
      </div>

      {/* First Look Toggle - Important decision at the top */}
      <div className="bg-gradient-to-r from-sage-100 to-cream-100 rounded-xl p-4 border border-sage-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sage-800">Are you doing a First Look?</h3>
            <p className="text-sage-600 text-sm">This affects when photos happen in your timeline</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDoingFirstLook(true)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                doingFirstLook
                  ? 'bg-sage-600 text-white'
                  : 'bg-white text-sage-600 border border-sage-300 hover:bg-sage-50'
              }`}
            >
              Yes, First Look
            </button>
            <button
              onClick={() => setDoingFirstLook(false)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !doingFirstLook
                  ? 'bg-sage-600 text-white'
                  : 'bg-white text-sage-600 border border-sage-300 hover:bg-sage-50'
              }`}
            >
              No, Traditional
            </button>
          </div>
        </div>
        <p className="text-sage-500 text-xs mt-2">
          {doingFirstLook
            ? '📸 Photos (couple, wedding party, family) will happen BEFORE the ceremony'
            : '📸 Photos will happen during COCKTAIL HOUR after the ceremony'
          }
        </p>
      </div>

      {/* Key Settings */}
      <div className="bg-sage-50 rounded-xl p-4 border border-sage-100">
        <h3 className="font-medium text-sage-700 mb-3">Key Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sage-600 text-xs font-medium mb-1">Ceremony Time ⏰</label>
            <input
              type="time"
              value={ceremonyTime}
              onChange={(e) => setCeremonyTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-sage-300 rounded-lg text-sm font-medium bg-white"
            />
            <p className="text-sage-500 text-xs mt-1 font-medium">{formatTime(ceremonyTime)}</p>
          </div>
          <div>
            <label className="block text-sage-600 text-xs font-medium mb-1">Reception Ends</label>
            <input
              type="time"
              value={receptionEnd}
              onChange={(e) => setReceptionEnd(e.target.value)}
              className="w-full px-3 py-2 border border-sage-200 rounded-lg text-sm"
            />
            <p className="text-sage-400 text-xs mt-1">{formatTime(receptionEnd)}</p>
          </div>
          <div>
            <label className="block text-sage-600 text-xs font-medium mb-1">Dinner Service</label>
            <select
              value={dinnerType}
              onChange={(e) => setDinnerType(e.target.value)}
              className="w-full px-3 py-2 border border-sage-200 rounded-lg text-sm"
            >
              {DINNER_TYPES.map(d => (
                <option key={d.id} value={d.id}>{d.name} (~{formatDuration(d.duration)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sage-600 text-xs font-medium mb-1">Default Formalities</label>
            <select
              value={formalitiesTiming}
              onChange={(e) => setFormalitiesTiming(e.target.value)}
              className="w-full px-3 py-2 border border-sage-200 rounded-lg text-sm"
            >
              <option value="before">Before Dinner</option>
              <option value="after">After Dinner</option>
            </select>
            <p className="text-sage-400 text-xs mt-1">Individual overrides below</p>
          </div>
        </div>

        {/* Sunset Time Quick Reference */}
        {sunsetTime && (
          <div className="mt-4 flex items-center gap-2 text-sm text-orange-700">
            <span>🌅</span>
            <span>Sunset: <strong>{formatTime(sunsetTime)}</strong></span>
            <span className="text-orange-400">•</span>
            <span className="text-orange-600">Golden hour photos auto-scheduled below</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-sage-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={offSiteCeremony}
              onChange={(e) => setOffSiteCeremony(e.target.checked)}
              className="w-4 h-4 rounded border-sage-300 text-sage-600"
            />
            <span className="text-sage-700 text-sm">Off-site ceremony</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCalculate}
              onChange={(e) => setAutoCalculate(e.target.checked)}
              className="w-4 h-4 rounded border-sage-300 text-sage-600"
            />
            <span className="text-sage-700 text-sm">Auto-calculate times</span>
          </label>

          <button
            onClick={resetToAutoTimes}
            className="text-sage-600 hover:text-sage-800 text-sm underline"
          >
            Reset all to suggested times
          </button>
        </div>

        <p className="text-sage-500 text-xs mt-3 flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-amber-50 border border-amber-300 rounded"></span>
          Yellow highlighted times have been manually adjusted
        </p>
      </div>

      {/* Getting Ready */}
      {renderSection('Getting Ready', '💄', PREP_EVENTS)}

      {/* First Looks */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>👀</span> First Looks & Private Moments
        </h3>
        {!doingFirstLook && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg text-blue-700 text-sm flex items-center gap-2">
            <span>ℹ️</span>
            <span>You chose <strong>Traditional (No First Look)</strong> - these events are optional but you can still include private moments before the ceremony</span>
          </div>
        )}
        <div className="space-y-2">
          {FIRST_LOOK_EVENTS.map(e => renderEventRow(e))}
          {events['first-look-dad']?.included && events['first-look-groom']?.included && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-xs flex items-center gap-2">
              <span>💡</span>
              <span>Remember: First look with Dad should be scheduled BEFORE first look with Groom</span>
            </div>
          )}
        </div>
      </div>

      {/* Photos */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>📸</span> Photos
        </h3>
        <div className={`mb-3 p-3 rounded-lg text-sm flex items-center gap-2 ${doingFirstLook ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
          <span>{doingFirstLook ? '✅' : '📍'}</span>
          <span>
            {doingFirstLook
              ? 'Photos will happen BEFORE the ceremony (after first look)'
              : 'Photos will happen during COCKTAIL HOUR while guests enjoy appetizers'
            }
          </span>
        </div>
        <div className="space-y-2">
          {PHOTO_EVENTS.map(e => renderEventRow(e))}
        </div>
      </div>

      {/* Pre-Ceremony */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>⏰</span> Pre-Ceremony
        </h3>
        <div className="space-y-2">
          {PRE_CEREMONY_EVENTS.map(e => renderEventRow(e))}

          {/* Shuttle Arrivals */}
          <div className="border-t border-cream-200 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sage-600 text-sm font-medium">🚌 Guest Shuttle Arrivals</p>
              <button onClick={addShuttleArrival} className="text-sage-600 hover:text-sage-800 text-sm">+ Add Shuttle</button>
            </div>
            {shuttleArrivals.map(shuttle => (
              <div key={shuttle.id} className="flex items-center gap-2 mb-2 p-2 bg-white rounded-lg border border-cream-200">
                <input
                  type="time"
                  value={shuttle.time}
                  onChange={(e) => updateShuttle('arrival', shuttle.id, 'time', e.target.value)}
                  className="px-2 py-1 border border-cream-300 rounded text-sm"
                />
                <span className="text-sage-400 text-xs">{formatTime(shuttle.time)}</span>
                <input
                  type="text"
                  value={shuttle.notes}
                  onChange={(e) => updateShuttle('arrival', shuttle.id, 'notes', e.target.value)}
                  placeholder="Hotel name / notes"
                  className="flex-1 px-2 py-1 border border-cream-300 rounded text-sm"
                />
                <button onClick={() => removeShuttle('arrival', shuttle.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ceremony */}
      {renderSection('Ceremony', '💒', CEREMONY_EVENTS)}

      {/* Cocktail Hour & Sunset */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>🥂</span> Cocktail Hour
        </h3>
        <div className="space-y-2">
          {renderEventRow(COCKTAIL_EVENTS[0])}
        </div>

        {/* Sunset Photos - Special Section */}
        <div className={`mt-4 p-4 rounded-xl border ${events['sunset-photos']?.included ? 'bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200' : 'bg-cream-50/50 border-cream-200'}`}>
          <div className="flex items-start gap-3">
            {/* Toggle checkbox */}
            <button
              onClick={() => toggleEvent('sunset-photos')}
              className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
                events['sunset-photos']?.included
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-sage-300 hover:border-sage-400'
              }`}
            >
              {events['sunset-photos']?.included && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className="text-3xl">🌅</span>
            <div className="flex-1">
              <h4 className={`font-medium ${events['sunset-photos']?.included ? 'text-orange-800' : 'text-sage-400'}`}>Golden Hour Photos</h4>
              {sunsetTime ? (
                <p className={`text-sm ${events['sunset-photos']?.included ? 'text-orange-600' : 'text-sage-400'}`}>
                  Sunset: {formatTime(sunsetTime)}
                  {events['sunset-photos']?.included && ` • Photos: ${formatTime(events['sunset-photos']?.time)} - ${formatTime(sunsetTime)}`}
                </p>
              ) : (
                <p className="text-sage-400 text-sm italic">
                  Set a wedding date in your profile to see sunset time
                </p>
              )}
            </div>
            {events['sunset-photos']?.included && (
              <div className="text-right">
                <input
                  type="time"
                  value={events['sunset-photos']?.time || ''}
                  onChange={(e) => updateEvent('sunset-photos', 'time', e.target.value)}
                  className={`px-2 py-1 border rounded text-sm w-24 ${events['sunset-photos']?.manualTime ? 'border-amber-300 bg-amber-50' : 'border-cream-300'}`}
                />
                <p className="text-orange-600 text-xs mt-1">{formatDuration(events['sunset-photos']?.duration || 20)}</p>
              </div>
            )}
          </div>
          {events['sunset-photos']?.included && events['sunset-photos']?.sunsetZoneNote && (
            <div className={`mt-2 p-2 rounded-lg text-sm ${
              events['sunset-photos']?.sunsetZone === 'early'
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {events['sunset-photos']?.sunsetZone === 'scheduled' && '✓ '}
              {events['sunset-photos']?.sunsetZoneNote}
            </div>
          )}
          {events['sunset-photos']?.included && !doingFirstLook && sunsetTime && (
            <p className="mt-2 text-orange-600 text-xs">
              📸 Other photos will be scheduled around this 20-minute sunset block
            </p>
          )}
        </div>
      </div>

      {/* Reception Intro */}
      {renderSection('Reception Intro', '✨', RECEPTION_INTRO_EVENTS)}

      {/* Formalities */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-1 flex items-center gap-2">
          <span>🎉</span> Formalities
        </h3>
        <p className="text-sage-500 text-xs mb-3">
          Each event can be set individually to happen before or after dinner
        </p>
        <div className="space-y-2">
          {FORMALITIES_EVENTS.map(e => renderEventRow(e))}
        </div>
      </div>

      {/* Dinner */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>🍽️</span> Dinner Service
        </h3>
        <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-amber-200">
          <span className="text-2xl">🍽️</span>
          <div className="flex-1">
            <p className="font-medium text-sage-800">{DINNER_TYPES.find(d => d.id === dinnerType)?.name}</p>
            <p className="text-sage-500 text-sm">{DINNER_TYPES.find(d => d.id === dinnerType)?.description}</p>
          </div>
          <div className="text-right">
            <input
              type="time"
              value={events['dinner']?.time || ''}
              onChange={(e) => updateEvent('dinner', 'time', e.target.value)}
              className={`px-2 py-1 border rounded text-sm w-24 ${events['dinner']?.manualTime ? 'border-amber-300 bg-amber-50' : 'border-cream-300'}`}
            />
            <p className="text-sage-500 text-sm mt-1">{formatTime(events['dinner']?.time)} • ~{formatDuration(dinnerDuration)}</p>
          </div>
        </div>
      </div>

      {/* End of Night */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
          <span>🌙</span> End of Night
        </h3>
        <div className="mb-3 p-3 bg-indigo-50 rounded-lg text-indigo-700 text-xs">
          <p className="font-medium mb-1">💡 Timing Tips:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Grand Exit</strong> can happen mid-reception (you return to party!) or at the very end</li>
            <li><strong>Last Dance</strong> is with all your guests on the floor</li>
            <li><strong>Private Last Dance</strong> is just the two of you after everyone leaves</li>
          </ul>
        </div>
        <div className="space-y-2">
          {END_EVENTS.map(e => renderEventRow(e))}

          {/* Shuttle Departures */}
          <div className="border-t border-cream-200 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sage-600 text-sm font-medium">🚌 Guest Shuttle Departures</p>
              <button onClick={addShuttleDeparture} className="text-sage-600 hover:text-sage-800 text-sm">+ Add Shuttle</button>
            </div>
            {shuttleDepartures.map(shuttle => (
              <div key={shuttle.id} className="flex items-center gap-2 mb-2 p-2 bg-white rounded-lg border border-cream-200">
                <input
                  type="time"
                  value={shuttle.time}
                  onChange={(e) => updateShuttle('departure', shuttle.id, 'time', e.target.value)}
                  className="px-2 py-1 border border-cream-300 rounded text-sm"
                />
                <span className="text-sage-400 text-xs">{formatTime(shuttle.time)}</span>
                <input
                  type="text"
                  value={shuttle.notes}
                  onChange={(e) => updateShuttle('departure', shuttle.id, 'notes', e.target.value)}
                  placeholder="Notes"
                  className="flex-1 px-2 py-1 border border-cream-300 rounded text-sm"
                />
                <button onClick={() => removeShuttle('departure', shuttle.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Events */}
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sage-700 flex items-center gap-2">
            <span>⭐</span> Custom Events
          </h3>
          <button onClick={() => setShowAddCustom(true)} className="text-sm text-purple-600 hover:text-purple-800 font-medium">+ Add Custom</button>
        </div>

        {customEvents.length > 0 && (
          <div className="space-y-2 mb-3">
            {customEvents.map(event => (
              <div key={event.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
                <span>⭐</span>
                <div className="flex-1">
                  <p className="font-medium text-sage-800 text-sm">{event.name}</p>
                  {event.notes && <p className="text-sage-500 text-xs">{event.notes}</p>}
                </div>
                <span className="text-sage-600 text-sm">{formatTime(event.time)}</span>
                <span className="text-sage-400 text-sm">{formatDuration(event.duration)}</span>
                <button onClick={() => removeCustomEvent(event.id)} className="text-red-400 hover:text-red-600">×</button>
              </div>
            ))}
          </div>
        )}

        {showAddCustom && (
          <div className="bg-white rounded-lg p-4 border border-purple-300 space-y-3">
            <input
              type="text"
              value={newCustomEvent.name}
              onChange={(e) => setNewCustomEvent(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Event name"
              className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
            />
            <div className="flex gap-3">
              <input
                type="time"
                value={newCustomEvent.time}
                onChange={(e) => setNewCustomEvent(prev => ({ ...prev, time: e.target.value }))}
                className="px-2 py-1 border border-cream-300 rounded text-sm"
              />
              <select
                value={newCustomEvent.duration}
                onChange={(e) => setNewCustomEvent(prev => ({ ...prev, duration: Number(e.target.value) }))}
                className="px-2 py-1 border border-cream-300 rounded text-sm"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
            <input
              type="text"
              value={newCustomEvent.notes}
              onChange={(e) => setNewCustomEvent(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
            />
            <div className="flex gap-2">
              <button onClick={addCustomEvent} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Add</button>
              <button onClick={() => setShowAddCustom(false)} className="px-4 py-2 text-sage-500 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* General Notes */}
      <div>
        <label className="block text-sage-700 font-medium mb-2">Additional Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any other timing considerations, special circumstances, or notes for the team..."
          className="w-full px-4 py-3 border border-cream-300 rounded-lg text-sm min-h-[80px]"
        />
      </div>

      {/* Summary */}
      <div className="bg-sage-600 text-white rounded-xl p-6">
        <h3 className="font-serif text-lg mb-4">Your Day at a Glance</h3>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {buildSummary().map((item, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm py-1 ${item.id === 'sunset-photos' ? 'bg-orange-500/20 -mx-2 px-2 rounded' : ''}`}>
              <span className="font-medium w-20 text-sage-200">{formatTime(item.time)}</span>
              <span>{item.icon}</span>
              <span className="flex-1">
                {item.name}
                {item.id === 'sunset-photos' && item.sunsetZone === 'early' && (
                  <span className="ml-2 text-xs text-red-300">⚠️ before ceremony</span>
                )}
              </span>
              {item.duration > 0 && <span className="text-sage-300 text-xs">{formatDuration(item.duration)}</span>}
            </div>
          ))}
          {buildSummary().length === 0 && (
            <p className="text-sage-300 text-center py-4">Select events above to build your timeline</p>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-sage-500 text-center text-sage-200">
          Ceremony: {formatTime(ceremonyTime)} • Ends: {formatTime(receptionEnd)}
        </div>
      </div>
    </div>
  )
}

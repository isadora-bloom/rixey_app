import { useState, useEffect } from 'react'

const STAFF_RATE = 350 // 2026 rate
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function StaffingCalculator({ guestCount: initialGuestCount, weddingId }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [answers, setAnswers] = useState({
    guestCount: initialGuestCount || 100,
    hasFridayEvent: false,
    fridayAlcoholForNonStaying: false,
    fridayDinnerOnsite: false,
    fridayDinnerCatered: true,
    fridayGuestCount: 50,
    // Saturday bartender add-ons
    champagneWelcome: false,
    patioBar: false,
    tableWineService: false,
    realGlassware: false,
    // Extra hands triggers
    newVendorTeam: false,
    cateringNoHelp: false,
    bringOwnFood: false,
    foodTrucks: false,
    largeWedding: false,
    multipleGatherings: false,
    earlyCeremony: false,
    lotsDIYDecor: false,
    noShuttles: false,
    diyFlowers: false,
    // Food truck specifics
    foodTruckCount: 3,
  })

  // Load existing staffing data
  useEffect(() => {
    if (!weddingId) return

    const loadStaffing = async () => {
      try {
        const res = await fetch(`${API_URL}/api/staffing/${weddingId}`)
        const data = await res.json()
        if (data.staffing?.answers) {
          setAnswers(prev => ({ ...prev, ...data.staffing.answers }))
        }
      } catch (err) {
        console.error('Failed to load staffing:', err)
      }
    }
    loadStaffing()
  }, [weddingId])

  const updateAnswer = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  // Calculate Friday staffing
  const calculateFriday = () => {
    let bartenders = 0
    let extraHands = 0
    let reasons = []

    if (!answers.hasFridayEvent) {
      return { bartenders: 0, extraHands: 0, reasons: [], total: 0 }
    }

    // Friday bartenders
    if (answers.fridayAlcoholForNonStaying) {
      bartenders = Math.ceil(answers.fridayGuestCount / 50)
      reasons.push(`${bartenders} bartender(s) for ${answers.fridayGuestCount} guests`)
    }

    // Friday extra hands for dinner
    if (answers.fridayDinnerOnsite) {
      if (!answers.fridayDinnerCatered) {
        // Uncatered dinner: 1 per 25 guests
        extraHands = Math.ceil(answers.fridayGuestCount / 25)
        reasons.push(`${extraHands} extra hand(s) for uncatered dinner service (1 per 25 guests)`)
      } else {
        // Catered but still recommend 1 for gaps
        extraHands = 1
        reasons.push('1 extra hand for setup/cleanup support')
      }
    }

    return { bartenders, extraHands, reasons, total: bartenders + extraHands }
  }

  // Calculate Saturday staffing
  const calculateSaturday = () => {
    let bartenders = 0
    let extraHands = 0
    let bartenderReasons = []
    let extraHandsReasons = []

    // Saturday bartenders: minimum 2, plus 1 per 50 guests
    bartenders = Math.max(2, Math.ceil(answers.guestCount / 50))
    bartenderReasons.push(`Base: ${bartenders} (min 2, or 1 per 50 guests)`)

    // Saturday bartender add-ons - one bartender can typically handle 2 of these
    let addOns = []
    let addOnCount = 0
    if (answers.champagneWelcome) { addOns.push('Champagne welcome'); addOnCount++ }
    if (answers.patioBar) { addOns.push('Patio bar'); addOnCount++ }
    if (answers.realGlassware) { addOns.push('Real glassware'); addOnCount++ }

    // Table wine service - may need more for larger weddings
    if (answers.tableWineService) {
      if (answers.guestCount > 100) {
        bartenders += 2
        bartenderReasons.push('+2 for table wine service (larger wedding)')
      } else {
        addOns.push('Table service')
        addOnCount++
      }
    }

    // Add 1 bartender for every 2 regular add-ons (rounded up)
    if (addOnCount > 0) {
      const addOnBartenders = Math.ceil(addOnCount / 2)
      bartenders += addOnBartenders
      bartenderReasons.push(`+${addOnBartenders} for extras (${addOns.join(', ')})`)
    }

    // Saturday extra hands
    if (answers.foodTrucks) {
      // Food truck formula: Event Captain + 1 per 30 guests
      extraHands = 1 + Math.ceil(answers.guestCount / 30)
      extraHandsReasons.push(`Food truck event: Captain + 1 per 30 guests`)
    } else {
      // Regular event - count triggers (one person can handle 2 tasks)
      const triggers = [
        { key: 'newVendorTeam', reason: 'New vendor coordination' },
        { key: 'cateringNoHelp', reason: 'Catering without service staff' },
        { key: 'bringOwnFood', reason: 'Self-catered food' },
        { key: 'largeWedding', reason: 'Large wedding coverage' },
        { key: 'multipleGatherings', reason: 'Multiple gatherings' },
        { key: 'earlyCeremony', reason: 'Early ceremony' },
        { key: 'lotsDIYDecor', reason: 'DIY decor setup' },
        { key: 'noShuttles', reason: 'Parking help' },
        { key: 'diyFlowers', reason: 'Flower arranging' },
      ]

      let taskCount = 0
      let tasks = []
      triggers.forEach(t => {
        if (answers[t.key]) {
          taskCount++
          tasks.push(t.reason)
        }
      })

      if (taskCount > 0) {
        extraHands = Math.ceil(taskCount / 2)
        extraHandsReasons.push(`${extraHands} for: ${tasks.join(', ')} (1 person per 2 tasks)`)
      }
    }

    // Always recommend at least 1 extra hand on Saturday
    if (extraHands === 0) {
      extraHands = 1
      extraHandsReasons.push('Baseline: 1 to cover vendor gaps')
    }

    return {
      bartenders,
      extraHands,
      bartenderReasons,
      extraHandsReasons,
      total: bartenders + extraHands
    }
  }

  // Save staffing estimate to database
  const saveStaffing = async () => {
    if (!weddingId) return

    setSaving(true)
    try {
      const fridayData = calculateFriday()
      const saturdayData = calculateSaturday()
      const total = fridayData.total + saturdayData.total
      const cost = total * STAFF_RATE

      await fetch(`${API_URL}/api/staffing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          answers,
          fridayBartenders: fridayData.bartenders,
          fridayExtraHands: fridayData.extraHands,
          fridayTotal: fridayData.total,
          saturdayBartenders: saturdayData.bartenders,
          saturdayExtraHands: saturdayData.extraHands,
          saturdayTotal: saturdayData.total,
          totalStaff: total,
          totalCost: cost
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save staffing:', err)
    }
    setSaving(false)
  }

  const friday = calculateFriday()
  const saturday = calculateSaturday()
  const totalStaff = friday.total + saturday.total
  const totalCost = totalStaff * STAFF_RATE

  const steps = [
    // Step 0: Intro
    {
      title: 'Staffing Guide',
      content: (
        <div className="space-y-4">
          <p className="text-sage-600">
            This guide will help you understand approximately how many Rixey staff members you may need for your wedding weekend.
          </p>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-amber-800 text-sm">
              <strong>2026 Rate:</strong> All Rixey staff are paid ${STAFF_RATE} per person per event day. Payment is collected via Venmo at your final walkthrough.
            </p>
          </div>
          <p className="text-sage-500 text-sm">
            This calculator provides estimates only. Your coordinator will finalize staffing needs based on your specific event details.
          </p>
        </div>
      )
    },
    // Step 1: Guest Count & Friday
    {
      title: 'Guest Count & Friday Event',
      content: (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              How many guests are you expecting on Saturday?
            </label>
            <input
              type="number"
              value={answers.guestCount}
              onChange={(e) => updateAnswer('guestCount', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-cream-300 rounded-lg text-lg"
              min="1"
              max="300"
            />
          </div>

          <div className="border-t border-cream-200 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={answers.hasFridayEvent}
                onChange={(e) => updateAnswer('hasFridayEvent', e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">Friday Event</span>
                <p className="text-sage-500 text-sm">Are you having a rehearsal dinner or welcome party on Friday?</p>
              </div>
            </label>
          </div>

          {answers.hasFridayEvent && (
            <div className="ml-8 space-y-4 bg-cream-50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers.fridayDinnerOnsite}
                  onChange={(e) => updateAnswer('fridayDinnerOnsite', e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
                />
                <div>
                  <span className="font-medium text-sage-700">Dinner on-site Friday</span>
                  <p className="text-sage-500 text-sm">Will you be serving dinner at the venue on Friday?</p>
                </div>
              </label>

              {answers.fridayDinnerOnsite && (
                <div className="ml-6 space-y-3 mt-2">
                  <p className="text-sage-600 text-sm">Is Friday dinner fully catered with service staff?</p>
                  <div className="flex gap-3">
                    <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition text-center ${
                      answers.fridayDinnerCatered ? 'border-sage-400 bg-sage-50' : 'border-cream-200 hover:border-sage-300'
                    }`}>
                      <input
                        type="radio"
                        name="fridayCatering"
                        checked={answers.fridayDinnerCatered}
                        onChange={() => updateAnswer('fridayDinnerCatered', true)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-sage-700">Yes, fully catered</span>
                    </label>
                    <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition text-center ${
                      !answers.fridayDinnerCatered ? 'border-sage-400 bg-sage-50' : 'border-cream-200 hover:border-sage-300'
                    }`}>
                      <input
                        type="radio"
                        name="fridayCatering"
                        checked={!answers.fridayDinnerCatered}
                        onChange={() => updateAnswer('fridayDinnerCatered', false)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-sage-700">No / Self-catered</span>
                    </label>
                  </div>

                  {!answers.fridayDinnerCatered && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-amber-800 text-sm font-medium">Extra hands required</p>
                      <p className="text-amber-700 text-xs mt-1">
                        For uncatered Friday dinners, you'll need staff for setup, service, and cleanup - typically 1 person per 25 guests depending on complexity.
                      </p>
                    </div>
                  )}

                  {answers.fridayDinnerCatered && (
                    <div className="bg-sage-50 rounded-lg p-3 border border-sage-200">
                      <p className="text-sage-700 text-sm">
                        We still recommend at least 1 extra hand for Friday to help with setup/cleanup between vendor gaps.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers.fridayAlcoholForNonStaying}
                  onChange={(e) => updateAnswer('fridayAlcoholForNonStaying', e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
                />
                <div>
                  <span className="font-medium text-sage-700">Alcohol for non-staying guests</span>
                  <p className="text-sage-500 text-sm">Will alcohol be served to anyone not staying on site? (Requires a bartender)</p>
                </div>
              </label>

              {answers.fridayAlcoholForNonStaying && (
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-2">
                    How many guests on Friday?
                  </label>
                  <input
                    type="number"
                    value={answers.fridayGuestCount}
                    onChange={(e) => updateAnswer('fridayGuestCount', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    min="1"
                  />
                  <p className="text-sage-400 text-xs mt-1">1 bartender per 50 guests</p>
                </div>
              )}
            </div>
          )}
        </div>
      )
    },
    // Step 2: Saturday Bar Options
    {
      title: 'Saturday Bar Services',
      content: (
        <div className="space-y-4">
          <p className="text-sage-600 mb-4">
            Saturday requires a minimum of 2 bartenders (bar must be attended at all times), plus 1 per 50 guests. Select any extras you're considering:
          </p>

          <div className="bg-sage-50 rounded-lg p-3 mb-4">
            <p className="text-sage-700 text-sm">
              <strong>Base requirement:</strong> {Math.max(2, Math.ceil(answers.guestCount / 50))} bartender(s) for {answers.guestCount} guests
            </p>
          </div>

          <p className="text-sage-500 text-sm font-medium">Select any extras you're considering:</p>
          <p className="text-sage-400 text-xs mb-2">One bartender can typically handle 2 of these service additions</p>

          {[
            { key: 'champagneWelcome', label: 'Champagne welcome drink', desc: 'Guests receive champagne on arrival' },
            { key: 'patioBar', label: 'Back patio satellite bar', desc: 'Additional bar on the back patio' },
            { key: 'realGlassware', label: 'Real glassware', desc: 'Using glass instead of disposable cups' },
            { key: 'tableWineService', label: 'Table wine/champagne service', desc: 'Wine and champagne poured at tables (may need 2 extra for larger weddings)' },
          ].map(opt => (
            <label key={opt.key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-cream-50 transition">
              <input
                type="checkbox"
                checked={answers[opt.key]}
                onChange={(e) => updateAnswer(opt.key, e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">{opt.label}</span>
                <p className="text-sage-500 text-sm">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      )
    },
    // Step 3: Catering Style
    {
      title: 'Catering Style',
      content: (
        <div className="space-y-5">
          <p className="text-sage-600">How is your wedding being catered?</p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition hover:border-sage-300"
              style={{ borderColor: !answers.foodTrucks && !answers.bringOwnFood ? '#9CAF88' : '#E8E4DC' }}>
              <input
                type="radio"
                name="catering"
                checked={!answers.foodTrucks && !answers.bringOwnFood}
                onChange={() => { updateAnswer('foodTrucks', false); updateAnswer('bringOwnFood', false) }}
                className="mt-1 w-5 h-5 border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">Full-service caterer</span>
                <p className="text-sage-500 text-sm">Professional catering company handling food and service</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition hover:border-sage-300"
              style={{ borderColor: answers.foodTrucks ? '#9CAF88' : '#E8E4DC' }}>
              <input
                type="radio"
                name="catering"
                checked={answers.foodTrucks}
                onChange={() => { updateAnswer('foodTrucks', true); updateAnswer('bringOwnFood', false) }}
                className="mt-1 w-5 h-5 border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">Food trucks</span>
                <p className="text-sage-500 text-sm">Fun, casual option - requires additional staffing for setup/service</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition hover:border-sage-300"
              style={{ borderColor: answers.bringOwnFood ? '#9CAF88' : '#E8E4DC' }}>
              <input
                type="radio"
                name="catering"
                checked={answers.bringOwnFood}
                onChange={() => { updateAnswer('bringOwnFood', true); updateAnswer('foodTrucks', false) }}
                className="mt-1 w-5 h-5 border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">Self-catered / Family cooking</span>
                <p className="text-sage-500 text-sm">Bringing in your own food or having family prepare meals</p>
              </div>
            </label>
          </div>

          {answers.foodTrucks && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mt-4">
              <h4 className="font-medium text-amber-800 mb-2">Food Truck Tips</h4>
              <ul className="text-amber-700 text-sm space-y-1">
                <li>• For ~120 guests: 3 dinner trucks + 1 dessert truck recommended</li>
                <li>• Have at least one truck provide cocktail hour apps</li>
                <li>• Wood-fired pizza is great for grab-and-go</li>
                <li>• Limit menu options and put menus on tables</li>
                <li>• Consider matching disposable plate sets from Amazon</li>
                <li>• You'll need separate rentals for linens/napkins</li>
              </ul>
            </div>
          )}

          {!answers.foodTrucks && (
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-cream-50 transition mt-4">
              <input
                type="checkbox"
                checked={answers.cateringNoHelp}
                onChange={(e) => updateAnswer('cateringNoHelp', e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">Catering doesn't include serving/cleanup</span>
                <p className="text-sage-500 text-sm">Some caterers (especially for Friday/Sunday) don't provide service staff</p>
              </div>
            </label>
          )}
        </div>
      )
    },
    // Step 4: Extra Hands Triggers
    {
      title: 'Extra Hands',
      content: (
        <div className="space-y-4">
          <div className="bg-sage-50 rounded-xl p-4 border border-sage-200">
            <p className="text-sage-700 text-sm">
              <strong>We strongly recommend at least one extra set of hands at any wedding</strong> to cover the things that fall between the cracks of your other vendors' contracts.
            </p>
          </div>

          <p className="text-sage-600">
            Select any that apply to your wedding:
          </p>
          <p className="text-sage-400 text-xs mb-2">One person can typically handle at least 2 of these tasks</p>

          {answers.hasFridayEvent && answers.fridayDinnerOnsite && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-amber-800 text-sm font-medium flex items-center gap-2">
                <span>⚠️</span> Friday dinner on-site
              </p>
              <p className="text-amber-700 text-xs mt-1">
                You indicated dinner on Friday - extra hands for setup and cleanup is almost always required.
              </p>
            </div>
          )}

          {[
            { key: 'newVendorTeam', label: 'Large team of new vendors', desc: 'Especially new caterers or photographers who haven\'t worked here before' },
            { key: 'largeWedding', label: 'Large wedding', desc: 'Your coordinator needs to cover more ground with more guests' },
            { key: 'multipleGatherings', label: 'Multiple large gatherings', desc: 'E.g., ceremonial aspects on Friday night' },
            { key: 'earlyCeremony', label: 'Early ceremony', desc: 'Ceremony being held earlier in the day' },
            { key: 'lotsDIYDecor', label: 'Lots of DIY decor', desc: 'Significant setup required for decorations' },
            { key: 'noShuttles', label: 'No shuttles', desc: 'Extra help needed for parking assistance' },
            { key: 'diyFlowers', label: 'DIY flowers on site', desc: 'Any flower arranging happening at the venue' },
          ].map(opt => (
            <label key={opt.key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-cream-50 transition">
              <input
                type="checkbox"
                checked={answers[opt.key]}
                onChange={(e) => updateAnswer(opt.key, e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-cream-300 text-sage-600"
              />
              <div>
                <span className="font-medium text-sage-700">{opt.label}</span>
                <p className="text-sage-500 text-sm">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      )
    },
    // Step 5: Summary
    {
      title: 'Your Staffing Estimate',
      content: (
        <div className="space-y-5">
          {/* Friday */}
          {friday.total > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <h4 className="font-medium text-amber-800 flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <span className="text-xl">🌅</span> Friday Night
                </span>
                <span className="text-lg">{friday.total} staff</span>
              </h4>

              <div className="space-y-2 text-sm">
                {friday.bartenders > 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sage-600">🍸 Bartenders</span>
                    <span className="font-medium text-sage-800">{friday.bartenders}</span>
                  </div>
                )}
                {friday.extraHands > 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sage-600">🙋 Extra Hands</span>
                    <span className="font-medium text-sage-800">{friday.extraHands}</span>
                  </div>
                )}
              </div>

              {friday.reasons.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-100">
                  <ul className="text-sage-600 text-xs space-y-1">
                    {friday.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-amber-100">
                <p className="text-amber-700 font-medium text-sm">
                  Friday: ${(friday.total * STAFF_RATE).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Saturday */}
          <div className="bg-white rounded-xl border border-sage-200 p-4">
            <h4 className="font-medium text-sage-800 flex items-center justify-between mb-3">
              <span className="flex items-center gap-2">
                <span className="text-xl">💒</span> Saturday (Wedding Day)
              </span>
              <span className="text-lg">{saturday.total} staff</span>
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-sage-600">🍸 Bartenders</span>
                <span className="font-medium text-sage-800">{saturday.bartenders}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sage-600">🙋 Extra Hands</span>
                <span className="font-medium text-sage-800">{saturday.extraHands}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-cream-100 space-y-2">
              {saturday.bartenderReasons.length > 0 && (
                <div>
                  <p className="text-sage-500 text-xs font-medium">Bartenders:</p>
                  <ul className="text-sage-600 text-xs">
                    {saturday.bartenderReasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {saturday.extraHandsReasons.length > 0 && (
                <div>
                  <p className="text-sage-500 text-xs font-medium">Extra Hands:</p>
                  <ul className="text-sage-600 text-xs">
                    {saturday.extraHandsReasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-sage-100">
              <p className="text-sage-700 font-medium text-sm">
                Saturday: ${(saturday.total * STAFF_RATE).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Total */}
          <div className="bg-sage-50 rounded-xl border border-sage-200 p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-sage-800">Weekend Total</p>
                <p className="text-sage-500 text-sm">@ ${STAFF_RATE} per person per day</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-sage-700">{totalStaff} staff</p>
                <p className="text-sage-600 font-medium">${totalCost.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-cream-50 rounded-lg p-4 border border-cream-200">
            <p className="text-sage-600 text-sm">
              <strong>Remember:</strong> This is an estimate to help you plan. Your coordinator will discuss your specific needs at your planning meetings and finalize staffing recommendations based on your unique event details.
            </p>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition ${
              i <= step ? 'bg-sage-500' : 'bg-cream-200'
            }`}
          />
        ))}
      </div>

      {/* Step Title */}
      <h3 className="font-serif text-xl text-sage-700 mb-4">{steps[step].title}</h3>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {steps[step].content}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-cream-200">
        {step > 0 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 text-sage-600 hover:text-sage-800"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        {step < steps.length - 1 ? (
          <button
            onClick={() => {
              const nextStep = step + 1
              setStep(nextStep)
              // Auto-save when reaching summary
              if (nextStep === steps.length - 1 && weddingId) {
                saveStaffing()
              }
            }}
            className="px-6 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700"
          >
            Continue →
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </span>
            )}
            {weddingId && (
              <button
                onClick={saveStaffing}
                disabled={saving}
                className="px-4 py-2 text-sage-600 hover:text-sage-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button
              onClick={() => setStep(0)}
              className="px-6 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

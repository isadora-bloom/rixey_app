import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Accommodations() {
  const navigate = useNavigate()
  const [accommodations, setAccommodations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadAccommodations()
  }, [])

  const loadAccommodations = async () => {
    const { data, error } = await supabase
      .from('accommodations')
      .select('*')
      .order('price_per_night', { ascending: true, nullsFirst: false })

    if (!error) {
      setAccommodations(data || [])
    }
    setLoading(false)
  }

  const platforms = ['all', ...new Set(accommodations.map(a => a.booking_platform).filter(Boolean))]

  const filtered = filter === 'all'
    ? accommodations
    : accommodations.filter(a => a.booking_platform === filter)

  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Airbnb': return 'bg-red-100 text-red-700'
      case 'VRBO': return 'bg-blue-100 text-blue-700'
      case 'Hotel': return 'bg-purple-100 text-purple-700'
      case 'Boutique Hotel': return 'bg-amber-100 text-amber-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <p className="text-sage-500">Loading accommodations...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="bg-white border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl text-sage-700">Accommodation Recommendations</h1>
            <p className="text-sage-400 text-sm">Places to stay near Rixey Manor</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sage-500 hover:text-sage-700 text-sm font-medium"
          >
            Back to Portal
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> We cannot vouch for these places as we haven't personally stayed in them.
            We chose them based on past guest experience, location, and numbers slept.
          </p>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {platforms.map(platform => (
            <button
              key={platform}
              onClick={() => setFilter(platform)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === platform
                  ? 'bg-sage-600 text-white'
                  : 'bg-white text-sage-600 border border-sage-200 hover:bg-sage-50'
              }`}
            >
              {platform === 'all' ? 'All Types' : platform}
            </button>
          ))}
        </div>

        {/* Accommodations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(accommodation => (
            <div
              key={accommodation.id}
              className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-serif text-lg text-sage-800">{accommodation.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(accommodation.booking_platform)}`}>
                  {accommodation.booking_platform}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {accommodation.sleeps && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sage-600">Sleeps {accommodation.sleeps}</span>
                  </div>
                )}

                {accommodation.distance && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sage-600">{accommodation.distance} from Manor</span>
                  </div>
                )}

                {accommodation.rating && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sage-600">{accommodation.rating}</span>
                  </div>
                )}

                {accommodation.availability && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sage-600">{accommodation.availability}</span>
                  </div>
                )}
              </div>

              {(accommodation.price_per_night || accommodation.price_per_person) && (
                <div className="mt-4 pt-4 border-t border-cream-200">
                  <div className="flex justify-between items-center">
                    {accommodation.price_per_night && (
                      <div>
                        <p className="text-sage-800 font-semibold">${accommodation.price_per_night}</p>
                        <p className="text-sage-400 text-xs">per night</p>
                      </div>
                    )}
                    {accommodation.price_per_person && (
                      <div className="text-right">
                        <p className="text-sage-600">${accommodation.price_per_person}</p>
                        <p className="text-sage-400 text-xs">per person</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sage-500">No accommodations found for this filter.</p>
          </div>
        )}
      </main>
    </div>
  )
}

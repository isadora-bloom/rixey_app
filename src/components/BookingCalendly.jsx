import { useState } from 'react'

const APPOINTMENT_TYPES = [
  {
    category: 'Getting Started',
    appointments: [
      {
        name: 'Onboarding & Initial Planning',
        description: 'Your first planning session to go over all the details',
        duration: '60 min',
        url: 'https://calendly.com/rixeymanor/onboarding-and-initial-planning',
        icon: '🎉'
      },
      {
        name: 'Quick Phone Call',
        description: 'A brief call to answer questions or check in',
        duration: '15 min',
        url: 'https://calendly.com/rixeymanor/15-minute-phone-call',
        icon: '📞'
      }
    ]
  },
  {
    category: 'Planning Meetings',
    appointments: [
      {
        name: 'Planning Meeting (Zoom)',
        description: 'Virtual planning session from anywhere',
        duration: '60 min',
        url: 'https://calendly.com/rixeymanor/1hr-planning-meeting-zoom',
        icon: '💻'
      },
      {
        name: 'Planning Meeting (In-Person)',
        description: 'Meet at Rixey Manor to plan in person',
        duration: '60 min',
        url: 'https://calendly.com/rixeymanor/1hr-wedding-planning',
        icon: '🏛️'
      }
    ]
  },
  {
    category: 'Pre-Wedding',
    appointments: [
      {
        name: 'Final Walkthrough',
        description: 'Walk through everything 3-6 weeks before your date',
        duration: 'Varies',
        url: 'https://calendly.com/rixeymanor/final-walkthrough-6-3-weeks-before-wedding-date',
        icon: '📋'
      },
      {
        name: 'Pre-Wedding Drop Off',
        description: 'Drop off decorations and items before the weekend',
        duration: 'Varies',
        url: 'https://calendly.com/rixeymanor/pre-wedding-drop-off',
        icon: '📦'
      },
      {
        name: 'Vendor Walkthrough',
        description: 'Bring your vendors to see the space',
        duration: 'Varies',
        url: 'https://calendly.com/rixeymanor/vendor-meeting-walk-through',
        icon: '👥'
      }
    ]
  }
]

export default function BookingCalendly({ compact = false, hideTitle = false }) {
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showEmbed, setShowEmbed] = useState(false)

  const handleBook = (appointment) => {
    setSelectedAppointment(appointment)
    setShowEmbed(true)
  }

  const closeEmbed = () => {
    setShowEmbed(false)
    setSelectedAppointment(null)
  }

  // Compact view - just show a button that links to main calendly
  if (compact) {
    return (
      <a
        href="https://calendly.com/rixeymanor"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium">Book a Call</span>
        <span className="ml-auto text-sage-200">↗</span>
      </a>
    )
  }

  return (
    <div>
      {!hideTitle && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-sage-700">Schedule a Meeting</h2>
          <a
            href="https://calendly.com/rixeymanor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sage-500 hover:text-sage-700 text-sm"
          >
            View all times ↗
          </a>
        </div>
      )}

      <div className="space-y-6">
        {APPOINTMENT_TYPES.map(category => (
          <div key={category.category}>
            <h3 className="text-sm font-medium text-sage-500 mb-2">{category.category}</h3>
            <div className="space-y-2">
              {category.appointments.map(apt => (
                <div
                  key={apt.url}
                  className="flex items-center gap-3 p-3 bg-cream-50 rounded-lg border border-cream-200 hover:border-sage-300 transition cursor-pointer group"
                  onClick={() => handleBook(apt)}
                >
                  <span className="text-2xl">{apt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sage-800 text-sm">{apt.name}</p>
                    <p className="text-sage-500 text-xs truncate">{apt.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-sage-400">{apt.duration}</span>
                    <div className="text-sage-600 text-sm font-medium group-hover:text-sage-800">
                      Book →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Calendly Embed Modal */}
      {showEmbed && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-cream-200">
              <div>
                <h3 className="font-serif text-lg text-sage-700">{selectedAppointment.name}</h3>
                <p className="text-sage-500 text-sm">{selectedAppointment.description}</p>
              </div>
              <button
                onClick={closeEmbed}
                className="text-sage-400 hover:text-sage-600 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[600px]">
              <iframe
                src={`${selectedAppointment.url}?embed_domain=${window.location.hostname}&embed_type=Inline`}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Schedule Appointment"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

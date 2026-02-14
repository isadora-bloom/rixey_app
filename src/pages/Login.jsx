import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const ROLE_OPTIONS = [
  { value: 'couple-bride', label: 'Couple (Bride)', isCouple: true },
  { value: 'couple-groom', label: 'Couple (Groom)', isCouple: true },
  { value: 'couple-custom', label: 'Couple (Other term)', isCouple: true },
  { value: 'mother-bride', label: 'Mother of the Bride', isCouple: false },
  { value: 'mother-groom', label: 'Mother of the Groom', isCouple: false },
  { value: 'father-bride', label: 'Father of the Bride', isCouple: false },
  { value: 'father-groom', label: 'Father of the Groom', isCouple: false },
  { value: 'best-man', label: 'Best Man', isCouple: false },
  { value: 'maid-of-honor', label: 'Maid of Honor', isCouple: false },
  { value: 'vip', label: 'VIP Guest', isCouple: false },
]

// Generate a random 6-character event code
function generateEventCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [customRoleTerm, setCustomRoleTerm] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [coupleNames, setCoupleNames] = useState('')
  const [eventCode, setEventCode] = useState('')
  const [phone, setPhone] = useState('')
  const [dateBlocked, setDateBlocked] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const selectedRole = ROLE_OPTIONS.find(r => r.value === role)
  const isCouple = selectedRole?.isCouple || false

  // Check if date is already taken when date changes
  const handleDateChange = async (date) => {
    setWeddingDate(date)
    setDateBlocked(false)
    setEventCode('')

    if (!date) return

    // Check if this date already has a wedding
    const { data: existingWedding } = await supabase
      .from('weddings')
      .select('id, event_code, couple_names')
      .eq('wedding_date', date)
      .single()

    if (existingWedding) {
      setDateBlocked(true)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (isSignUp) {
      // Validate required fields
      if (!name.trim()) {
        setError('Please enter your name')
        setLoading(false)
        return
      }
      if (!role) {
        setError('Please select your role')
        setLoading(false)
        return
      }
      if (role === 'couple-custom' && !customRoleTerm.trim()) {
        setError('Please enter your preferred term')
        setLoading(false)
        return
      }
      if (!weddingDate && !eventCode.trim()) {
        setError('Please enter your wedding date or an event code')
        setLoading(false)
        return
      }

      let weddingId = null
      let finalWeddingDate = weddingDate

      // If date is blocked OR they entered a code, validate the code
      if (dateBlocked || eventCode.trim()) {
        if (!eventCode.trim()) {
          setError('This date is already booked. Please enter the event code to join that wedding.')
          setLoading(false)
          return
        }

        // Look up wedding by event code
        const { data: wedding, error: weddingError } = await supabase
          .from('weddings')
          .select('id, wedding_date')
          .eq('event_code', eventCode.trim().toUpperCase())
          .single()

        if (weddingError || !wedding) {
          setError('Event code not found. Please check and try again.')
          setLoading(false)
          return
        }

        // If they entered a date AND a code, make sure they match
        if (weddingDate && wedding.wedding_date && weddingDate !== wedding.wedding_date) {
          setError('The event code doesn\'t match that wedding date. Please check and try again.')
          setLoading(false)
          return
        }

        weddingId = wedding.id
        finalWeddingDate = wedding.wedding_date
      }

      const { data, error: signUpError } = await signUp(email, password)

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data?.user) {
        // If no existing wedding, create one (only if couple and has date)
        if (!weddingId && weddingDate && isCouple) {
          const newEventCode = generateEventCode()
          const { data: newWedding, error: weddingCreateError } = await supabase
            .from('weddings')
            .insert([{
              event_code: newEventCode,
              couple_names: coupleNames.trim() || null,
              wedding_date: weddingDate,
              created_by: data.user.id
            }])
            .select()
            .single()

          if (weddingCreateError) {
            console.error('Wedding creation error:', weddingCreateError)
          } else {
            weddingId = newWedding.id
            // Create admin notification for new wedding
            await supabase.from('admin_notifications').insert([{
              type: 'new_wedding',
              message: `New wedding created: ${coupleNames || 'Unknown'} on ${weddingDate}. Event code: ${newEventCode}. Please add HoneyBook and Google Sheets links.`,
              wedding_id: newWedding.id,
              user_id: data.user.id
            }])

            // Initialize default planning checklist for the new wedding
            try {
              await fetch(`${API_URL}/api/checklist/initialize/${newWedding.id}`, {
                method: 'POST'
              })
              console.log('Default checklist initialized for new wedding')
            } catch (checklistErr) {
              console.error('Checklist initialization error:', checklistErr)
            }
          }
        }

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: data.user.id,
            name: name.trim(),
            email: email,
            phone: phone.trim() || null,
            role: role,
            custom_role_term: role === 'couple-custom' ? customRoleTerm.trim() : null,
            wedding_date: finalWeddingDate || null,
            wedding_id: weddingId
          }])

        if (profileError) {
          console.error('Profile creation error:', profileError)
        }
      }

      setMessage('Account created! You can now sign in.')
      setIsSignUp(false)
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    }
    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the password reset link!')
      setShowForgotPassword(false)
      setResetEmail('')
    }
    setLoading(false)
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition bg-cream-50"

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-sage-700 mb-2">Rixey Manor</h1>
          <p className="text-sage-500 text-lg">Planning Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-cream-200">
          <h2 className="text-2xl font-serif text-sage-700 mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-sage-600 mb-1">
                    Your Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="First and last name"
                  />
                </div>

                {/* Role */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-sage-600 mb-1">
                    Your Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select your role...</option>
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom role term */}
                {role === 'couple-custom' && (
                  <div>
                    <label htmlFor="customRole" className="block text-sm font-medium text-sage-600 mb-1">
                      Preferred Term
                    </label>
                    <input
                      id="customRole"
                      type="text"
                      value={customRoleTerm}
                      onChange={(e) => setCustomRoleTerm(e.target.value)}
                      required
                      className={inputClass}
                      placeholder="e.g., Partner, Spouse, etc."
                    />
                  </div>
                )}

                {/* Wedding Date */}
                <div>
                  <label htmlFor="weddingDate" className="block text-sm font-medium text-sage-600 mb-1">
                    Wedding Date
                  </label>
                  <input
                    id="weddingDate"
                    type="date"
                    value={weddingDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={inputClass}
                  />
                  {dateBlocked && (
                    <p className="text-amber-600 text-sm mt-2 bg-amber-50 p-2 rounded">
                      This date already has a wedding. Enter the event code below to join.
                    </p>
                  )}
                </div>

                {/* Event Code - required if date blocked, optional otherwise */}
                <div className={`${dateBlocked ? 'bg-amber-50 border-amber-200' : 'bg-cream-50 border-cream-200'} p-4 rounded-lg border`}>
                  <label htmlFor="eventCode" className="block text-sm font-medium text-sage-600 mb-2">
                    {dateBlocked ? 'Event Code (Required)' : 'Have an Event Code?'}
                  </label>
                  <input
                    id="eventCode"
                    type="text"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                    required={dateBlocked}
                    className={inputClass}
                    placeholder="Enter 6-character code"
                    maxLength={6}
                  />
                  <p className="text-sage-400 text-xs mt-2">
                    {dateBlocked
                      ? 'Ask the couple for their event code to join their wedding'
                      : 'If someone shared a code with you, enter it here to join their wedding'
                    }
                  </p>
                </div>

                {/* Couple names - only for couples creating new wedding */}
                {isCouple && !dateBlocked && !eventCode && weddingDate && (
                  <div>
                    <label htmlFor="coupleNames" className="block text-sm font-medium text-sage-600 mb-1">
                      Couple Names
                    </label>
                    <input
                      id="coupleNames"
                      type="text"
                      value={coupleNames}
                      onChange={(e) => setCoupleNames(e.target.value)}
                      className={inputClass}
                      placeholder="e.g., Sarah & John"
                    />
                    <p className="text-sage-400 text-xs mt-1">This will appear on your wedding's planning portal</p>
                  </div>
                )}

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-sage-600 mb-1">
                    Phone Number <span className="text-sage-400">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="(555) 123-4567"
                  />
                  <p className="text-sage-400 text-xs mt-1">Used to sync planning notes from your texts</p>
                </div>

                {/* Data Protection Notice - for first person creating wedding */}
                {isCouple && !dateBlocked && !eventCode && weddingDate && (
                  <div className="bg-sage-50 border border-sage-200 rounded-lg p-4 text-sm">
                    <p className="text-sage-700 font-medium mb-2">Important Information</p>
                    <p className="text-sage-600">
                      By creating this wedding profile, you understand that Rixey Manor can only process wedding planning information from communications (emails, texts, calls) that come from registered members of your event within this planning app.
                    </p>
                    <p className="text-sage-600 mt-2">
                      Please share your event code with anyone helping plan your wedding so their communications can be linked to your planning file.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sage-600 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sage-600 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="••••••••"
              />
              {isSignUp && (
                <p className="text-sage-400 text-xs mt-1">At least 6 characters</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-sage-50 text-sage-700 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sage-600 text-white py-3 rounded-lg font-medium hover:bg-sage-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setMessage('')
                setDateBlocked(false)
                setEventCode('')
              }}
              className="text-sage-500 hover:text-sage-700 text-sm transition"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="block mx-auto mt-2 text-sage-400 hover:text-sage-600 text-sm transition"
              >
                Forgot your password?
              </button>
            )}
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
              <h3 className="font-serif text-xl text-sage-700 mb-2">Reset Password</h3>
              <p className="text-sage-500 text-sm mb-4">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setResetEmail('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-3 text-sage-600 rounded-lg font-medium hover:bg-cream-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-sage-600 text-white py-3 rounded-lg font-medium hover:bg-sage-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <p className="text-center text-sage-400 text-sm mt-6">
          Your wedding planning journey awaits
        </p>
      </div>
    </div>
  )
}

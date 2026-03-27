// Shared sign-up logic used by Login.jsx and Preview.jsx
// Creates: Supabase auth account, wedding row, profile row, checklist, admin notification

// Generate a random 6-character event code (no ambiguous chars)
function generateEventCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a full wedding account: auth user, wedding row, profile, checklist, admin notification.
 *
 * @param {object} opts
 * @param {string} opts.email
 * @param {string} opts.password
 * @param {string} opts.coupleNames    - e.g. "Sarah & John" (optional)
 * @param {string} opts.weddingDate    - ISO date string
 * @param {string} opts.role           - one of the ROLE_OPTIONS values (e.g. 'couple-bride')
 * @param {string} [opts.customRoleTerm] - if role === 'couple-custom'
 * @param {string} [opts.name]         - user display name (falls back to coupleNames or email)
 * @param {string} [opts.phone]        - optional phone number
 * @param {object} opts.supabase       - Supabase client instance
 * @param {string} opts.API_URL        - backend API base URL
 * @param {function} opts.authHeaders  - async fn returning headers object with Authorization
 * @param {function} opts.signUp       - auth context signUp(email, password)
 * @returns {{ user, wedding, profile }}
 */
export async function createWeddingAccount({
  email,
  password,
  coupleNames,
  weddingDate,
  role,
  customRoleTerm,
  name,
  phone,
  supabase,
  API_URL,
  authHeaders,
  signUp,
}) {
  // 1. Sign up with Supabase auth
  const { data, error: signUpError } = await signUp(email, password)
  if (signUpError) throw signUpError
  const user = data?.user
  if (!user) throw new Error('Something went wrong creating your account.')

  // 2. Create the wedding record
  const eventCode = generateEventCode()
  const { data: wedding, error: weddingCreateError } = await supabase
    .from('weddings')
    .insert([{
      event_code: eventCode,
      couple_names: coupleNames?.trim() || null,
      wedding_date: weddingDate,
      created_by: user.id,
    }])
    .select()
    .single()

  if (weddingCreateError) {
    console.error('Wedding creation error:', weddingCreateError)
  }

  const weddingId = wedding?.id || null

  // 3. Create the profile
  const displayName = name?.trim() || coupleNames?.trim() || email
  const { error: profileError } = await supabase
    .from('profiles')
    .insert([{
      id: user.id,
      name: displayName,
      email: email,
      phone: phone?.trim() || null,
      role: role,
      custom_role_term: role === 'couple-custom' ? customRoleTerm?.trim() : null,
      wedding_date: weddingDate || null,
      wedding_id: weddingId,
    }])

  if (profileError) {
    console.error('Profile creation error:', profileError)
  }

  // 4. Initialize default planning checklist
  if (weddingId) {
    try {
      const headers = typeof authHeaders === 'function' ? await authHeaders() : { 'Content-Type': 'application/json' }
      await fetch(`${API_URL}/api/checklist/initialize/${weddingId}`, {
        method: 'POST',
        headers,
      })
    } catch (checklistErr) {
      console.error('Checklist initialization error:', checklistErr)
    }
  }

  // 5. Create admin notification
  if (weddingId) {
    try {
      const headers = typeof authHeaders === 'function' ? await authHeaders() : { 'Content-Type': 'application/json' }
      await fetch(`${API_URL}/api/admin/notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'new_wedding',
          message: `New wedding created: ${coupleNames?.trim() || email} on ${weddingDate}. Event code: ${eventCode}. Please add HoneyBook and Google Sheets links.`,
          wedding_id: weddingId,
          user_id: user.id,
        }),
      })
    } catch (notifErr) {
      console.error('Admin notification error:', notifErr)
    }
  }

  return {
    user,
    wedding: wedding || null,
    profile: { id: user.id, name: displayName, email, role, wedding_id: weddingId },
  }
}

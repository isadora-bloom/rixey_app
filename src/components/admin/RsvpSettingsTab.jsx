import RsvpSettings from '../RsvpSettings'

/**
 * The venue's view of a wedding's RSVP settings.
 *
 * RsvpSettings.jsx already takes weddingId as a prop rather than reading the
 * couple's own wedding off AuthContext, and it saves through apiFetch, which
 * carries whatever token is signed in. An admin token passes weddingAccess
 * for any wedding (see server/middleware/weddingAccess.js), so no server
 * change was needed here — this is a thin wrapper: a banner saying who is
 * editing, then the couple's own editor underneath.
 *
 * PLAN-UX-NAV.md item 9.
 */
export default function RsvpSettingsTab({ weddingId }) {
  if (!weddingId) return null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        You&apos;re editing this on behalf of the couple. Changes save straight to their RSVP form.
      </div>
      <RsvpSettings weddingId={weddingId} />
    </div>
  )
}

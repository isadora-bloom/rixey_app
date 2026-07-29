/**
 * Empty-string coercion.
 *
 * A form field that the user left blank arrives as "". Postgres accepts that
 * for a text column and rejects it for anything else:
 *
 *   invalid input syntax for type integer: ""
 *
 * That is how the Shuttle Schedule tab broke. "Generate Suggested Runs" sent
 * seat_count: "" and every insert died, so the whole tab looked dead to the
 * couple. Same trap sits under every numeric, boolean and date field in the
 * app, so this is fixed once, centrally, rather than per endpoint.
 *
 * COERCE_TO_NULL lists every column in the Supabase schema whose type is
 * numeric, boolean, date or time. It was generated from the PostgREST schema
 * spec, not written by hand. Names that are a risky type in one table but text
 * in another are deliberately excluded (see EXCLUDED below), because for those
 * "" may be a legitimate value.
 *
 * Regenerate after a migration that adds numeric/boolean/date columns:
 *   node scripts/generate-coerce-list.mjs
 */

// Generated from the PostgREST schema spec — do not hand-edit, regenerate.
export const COERCE_TO_NULL = new Set([
  'active', 'added_to_kb', 'answered_at', 'applied_at', 'archived',
  'caterer_alerted', 'ceremony_start', 'ceremony_time', 'chair_sash', 'checked',
  'checklist_item_completed', 'cocktail_tables', 'completed_at',
  'confidence_level', 'contract_date', 'contract_uploaded',
  'couple_photo_uploaded', 'created_at', 'display_order', 'dogs_coming',
  'due_date', 'email_sent', 'escalation_handled_at', 'executed', 'expiry_date',
  'featured', 'fired', 'first_message_sent', 'friday_bartenders',
  'friday_extra_hands', 'friday_total', 'from_calculator', 'guest_count',
  'guests_per_table', 'has_multiple_events', 'head_table', 'head_table_size',
  'high_chairs_needed', 'include_on_website', 'input_tokens', 'inspo_uploaded',
  'is_active', 'is_admin', 'is_booked', 'is_budget_friendly', 'is_completed',
  'is_custom', 'is_draft', 'is_local', 'is_published', 'is_read', 'is_shared',
  'kids_count', 'kids_table', 'last_activity', 'last_vendor_update',
  'leaving_it', 'linen_venue_choice', 'lounge_area', 'onboarding_dismissed',
  'output_tokens', 'partner1_parents_met', 'partner2_parents_met',
  'plated_meal', 'price_per_night', 'price_per_person', 'processed_at',
  'providing_cake_cutter', 'providing_cake_topper',
  'providing_champagne_glasses', 'providing_charger_plates',
  'providing_table_numbers', 'published', 'quantity', 'read_at',
  'reception_end', 'reception_start', 'reception_time', 'renting_china',
  'renting_flatware', 'rsvp_deadline', 'saturday_bartenders',
  'saturday_extra_hands', 'saturday_total', 'scheduled_for', 'seat_count',
  'serves_chinese', 'serves_indian', 'servings_basis', 'show_accommodations',
  'show_dress_code', 'show_faq', 'show_gallery', 'show_registry', 'show_rsvp',
  'show_schedule', 'show_story', 'show_things_to_do', 'show_transport',
  'show_wedding_party', 'sleeps', 'sort_order', 'special_expiry',
  'staying_overnight', 'sweetheart_table', 'total_budget', 'total_cost',
  'total_staff', 'unity_table', 'unplugged_ceremony', 'updated_at',
  'using_disposables', 'vendor_added', 'wedding_date', 'worked_here_before',
]);

/**
 * high_chairs_count is integer on rehearsal_dinner but text on wedding_details,
 * so a blank string is valid for one of them. Left alone on purpose.
 */
export const EXCLUDED = ['high_chairs_count'];

/**
 * Walk an object (or array of objects) and turn "" into null for any key in
 * COERCE_TO_NULL. Recurses one level into arrays and plain objects so nested
 * payloads like { runs: [{ seat_count: "" }] } are covered too.
 */
export function coerceEmptyStrings(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = coerceEmptyStrings(value[i], depth + 1);
    return value;
  }

  for (const key of Object.keys(value)) {
    const v = value[key];
    if (typeof v === 'string' && v.trim() === '' && COERCE_TO_NULL.has(key)) {
      value[key] = null;
    } else if (v !== null && typeof v === 'object') {
      value[key] = coerceEmptyStrings(v, depth + 1);
    }
  }
  return value;
}

/** Express middleware form. Mount once, before the routes. */
export function coerceBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') coerceEmptyStrings(req.body);
  next();
}

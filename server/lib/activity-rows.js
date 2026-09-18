/**
 * Activity entries for the couple's own row-per-thing tables.
 *
 * These tables all logged their DELETE and nothing else. The feed recorded a
 * couple removing one bridesmaid and stayed silent while they added thirty
 * eight, which is how Corinna's missing wedding party came to be untraceable:
 * her wedding had 122 activity entries and none of them was about her website
 * or about the party she had just typed in.
 *
 * The delete handlers each did this by hand, which is why the naming drifted:
 * decor_inventory logs `decor_deleted`, shuttle_schedule logs
 * `shuttle_run_deleted`, makeup_schedule logs `makeup_schedule_deleted`. Those
 * strings are already in the table and the admin feed renders them, so the
 * stems below keep them exactly as they are rather than tidying them and
 * orphaning months of history.
 *
 *   stem  the activity_type prefix, giving <stem>_added / _updated / _deleted
 *   name  the column holding the thing's name, for the details line
 *   noun  what to call it when there is no name to use
 *
 * scripts/audit-activity-logging.mjs checks that every wedding-scoped table a
 * route writes to is either listed here or excused there by name.
 */
export const ROW_ACTIVITY = {
  allergy_registry:      { stem: 'allergy',            name: 'guest_name',       noun: 'an allergy' },
  bar_recipes:           { stem: 'bar_recipe',         name: 'name',             noun: 'a recipe' },
  bar_shopping_list:     { stem: 'bar_shopping_item',  name: 'item_name',        noun: 'a bar item' },
  ceremony_order:        { stem: 'ceremony_order',     name: 'participant_name', noun: 'a ceremony order entry' },
  day_of_media:          { stem: 'day_of_media',       name: 'filename',         noun: 'a day-of file' },
  decor_inventory:       { stem: 'decor',              name: 'item_name',        noun: 'a decor item' },
  guest_meal_options:    { stem: 'meal_option',        name: 'label',            noun: 'a meal option' },
  guest_tag_options:     { stem: 'guest_tag',          name: 'label',            noun: 'a guest tag' },
  makeup_schedule:       { stem: 'makeup_schedule',    name: 'participant_name', noun: 'a hair and makeup slot' },
  shuttle_schedule:      { stem: 'shuttle_run',        name: 'run_label',        noun: 'a shuttle run' },
  wedding_contacts:      { stem: 'wedding_contact',    name: 'name',             noun: 'a contact' },
  wedding_internal_notes:{ stem: 'internal_note',      name: null,               noun: 'a note' },
  wedding_party:         { stem: 'wedding_party',      name: 'member_name',      noun: 'someone' },
  wedding_photos:        { stem: 'wedding_photo',      name: 'caption',          noun: 'a photo' },
}

/** Verbs, in the order a person would read them. */
const VERBS = { added: 'added', updated: 'updated', deleted: 'removed' }

/**
 * The type and details for one row changing, or null when the table is not one
 * we log per row.
 *
 * `row` is whatever the write returned, so it carries the name column and the
 * wedding_id. A row with no usable name falls back to the noun rather than
 * printing a bare uuid at the couple.
 *
 * @param {string} table
 * @param {'added'|'updated'|'deleted'} action
 * @param {object} row
 * @returns {{type: string, details: string}|null}
 */
export function activityFor(table, action, row) {
  const config = ROW_ACTIVITY[table]
  if (!config) return null
  if (!VERBS[action]) return null

  const raw = config.name ? row?.[config.name] : null
  const name = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null

  return {
    type: `${config.stem}_${action}`,
    details: name ? `${VERBS[action]} ${name}` : `${VERBS[action]} ${config.noun}`,
  }
}

/** Every activity_type this module can produce, for the feed's label map. */
export function allActivityTypes() {
  const out = []
  for (const { stem } of Object.values(ROW_ACTIVITY)) {
    for (const action of Object.keys(VERBS)) out.push(`${stem}_${action}`)
  }
  return out.sort()
}

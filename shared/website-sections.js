/**
 * What is actually showing on a couple's wedding website, and why not.
 *
 * Three separate things decide whether a guest sees a section, and until now
 * each surface knew about a different subset:
 *
 *   1. is the site published at all
 *   2. is the section's toggle on
 *   3. is there any content for it to render
 *
 * The builder's Sections panel only ever showed (3), as a readiness count, and
 * worded it as though it settled the matter. "38 members ready" in green sat
 * next to a switch that reads null as on, on a site whose toggle was off. The
 * couple had three true statements in front of them and no way to reach the
 * false one. Corinna spent three days on it (14-17 Sep), and her photo gallery
 * was in the same state at the same time without anyone noticing: one photo
 * tagged "website", which the panel counted, but that photo was also the hero,
 * and the site builds its gallery from the website-tagged photos that are NOT
 * the hero. Count of one, gallery of none.
 *
 * So the content tests live here, next to the rule they mirror, rather than
 * being re-derived per surface. `needs` is the same predicate the site renders
 * on, keyed off a plain content object any caller can assemble.
 *
 * KEEP IN STEP WITH src/pages/WeddingWebsite.jsx. Each `needs` below is the
 * second half of that file's render guard, and `tests/unit/website-sections.
 * test.mjs` pins the pairs. If you change a guard there, change it here.
 *
 * Plain ESM with no React in it, so the server, the scripts and the tests can
 * read the same rules the couple's panel does.
 */

/**
 * @typedef {object} SectionContent
 * @property {string} [ourStory]
 * @property {string} [theProposal]
 * @property {string} [ceremonyTime]
 * @property {string} [receptionTime]
 * @property {string} [dressCode]
 * @property {number} [partyCount]        members whose include flag is not false
 * @property {number} [shuttleCount]
 * @property {number} [registryCount]     links with a url
 * @property {number} [faqCount]          items with a question
 * @property {number} [galleryCount]      website-tagged photos that are not the hero
 * @property {number} [thingsToDoCount]   entries with a name
 */

const filled = (v) => typeof v === 'string' && v.trim() !== ''
const some = (n) => typeof n === 'number' && n > 0

/**
 * One row per toggle, in the order the panel offers them by default.
 *
 * label     what the couple calls it
 * source    where the content comes from, in their words
 * needs     the site's own content guard
 * empty     what is missing, said as the thing to go and do
 */
export const WEBSITE_SECTIONS = [
  {
    key: 'show_story',
    label: 'Our Story',
    source: 'Written by you, in Our Story below',
    needs: (c) => filled(c.ourStory),
    empty: 'Nothing written yet. Add your story below and it appears here.',
  },
  {
    key: 'show_proposal',
    label: 'The Proposal',
    source: 'Written by you, in The Proposal below',
    needs: (c) => filled(c.theProposal),
    empty: 'Nothing written yet. Add the proposal below and it appears here.',
  },
  {
    key: 'show_wedding_party',
    label: 'Wedding Party',
    source: 'From your Wedding Party list',
    needs: (c) => some(c.partyCount),
    empty: 'No one to show yet. Add people in Wedding Party, and tick "Show on wedding website" for each one.',
    count: (c) => `${c.partyCount} ${c.partyCount === 1 ? 'person' : 'people'}`,
  },
  {
    key: 'show_dress_code',
    label: 'Dress Code',
    source: 'Set below',
    needs: (c) => filled(c.dressCode),
    empty: 'No dress code chosen yet. Pick one below and it appears here.',
  },
  {
    key: 'show_schedule',
    label: 'The Day',
    source: 'Ceremony and reception times',
    needs: (c) => filled(c.ceremonyTime) || filled(c.receptionTime),
    empty: 'No times set yet. Add a ceremony or reception time below.',
  },
  {
    key: 'show_transport',
    label: 'Transportation',
    source: 'From your Shuttle Schedule',
    needs: (c) => some(c.shuttleCount),
    empty: 'No shuttle runs yet. Set them up in Shuttle Schedule.',
    count: (c) => `${c.shuttleCount} ${c.shuttleCount === 1 ? 'run' : 'runs'}`,
  },
  {
    key: 'show_accommodations',
    label: 'Where to Stay',
    source: "Rixey's curated list",
    // The site reads the venue-wide accommodations table, so there is nothing
    // for the couple to fill in and nothing that can be empty for them.
    needs: () => true,
    empty: '',
  },
  {
    key: 'show_registry',
    label: 'Registry',
    source: 'Links set below',
    needs: (c) => some(c.registryCount),
    empty: 'No links yet. Add a registry link below.',
    count: (c) => `${c.registryCount} ${c.registryCount === 1 ? 'link' : 'links'}`,
  },
  {
    key: 'show_faq',
    label: 'FAQ',
    source: 'Questions set below',
    needs: (c) => some(c.faqCount),
    empty: 'No questions yet. Add one below.',
    count: (c) => `${c.faqCount} ${c.faqCount === 1 ? 'question' : 'questions'}`,
  },
  {
    key: 'show_gallery',
    label: 'Photo Gallery',
    source: 'Photos tagged "website" in Photo Library',
    // Not simply the website-tagged count. The site pulls the website-tagged
    // photos and then builds the gallery from the ones that are not the hero,
    // so a single photo tagged both leaves the gallery empty.
    needs: (c) => some(c.galleryCount),
    empty: 'No gallery photos yet. Tag photos "website" in Photo Library. The one tagged "hero" is your header image, so it does not count here.',
    count: (c) => `${c.galleryCount} ${c.galleryCount === 1 ? 'photo' : 'photos'}`,
  },
  {
    key: 'show_rsvp',
    label: 'RSVP',
    source: 'Lets guests confirm attendance on your site',
    // The form renders whether or not there are guests on the list yet.
    needs: () => true,
    empty: '',
  },
  {
    key: 'show_things_to_do',
    label: 'Things to Do',
    source: 'Nearby restaurants, activities, wineries',
    needs: (c) => some(c.thingsToDoCount),
    empty: 'Nothing added yet. Add a place below.',
    count: (c) => `${c.thingsToDoCount} ${c.thingsToDoCount === 1 ? 'place' : 'places'}`,
  },
]

export const WEBSITE_SECTION_KEYS = WEBSITE_SECTIONS.map((s) => s.key)

/** A toggle that has never been written reads as on, everywhere. */
export const isOn = (value) => value !== false

/**
 * The state of one section, from the couple's point of view.
 *
 * live    a guest looking at the site right now sees it
 * ready   it would show, but the site is not published
 * empty   the toggle is on and there is nothing to render
 * off     they turned it off
 *
 * `empty` beats `ready` on purpose: if there is nothing to show, saying
 * "publish to make it live" would be a lie.
 */
export function sectionState({ published, toggle, content, section }) {
  if (!isOn(toggle)) return 'off'
  if (!section.needs(content || {})) return 'empty'
  return published ? 'live' : 'ready'
}

const HEADLINES = {
  live: 'Showing on your website',
  ready: 'Ready, not published yet',
  empty: 'On, but nothing to show yet',
  off: 'Hidden from guests',
}

/**
 * Everything a surface needs to describe one section in plain words.
 *
 * Returns { key, label, state, headline, detail }. `detail` is the sentence
 * that tells them what to do, or what is being shown, and is never blank for a
 * state they can act on.
 */
export function describeSection(section, { published, toggles, content }) {
  const c = content || {}
  const state = sectionState({
    published,
    toggle: (toggles || {})[section.key],
    content: c,
    section,
  })

  let detail
  if (state === 'empty') {
    detail = section.empty
  } else if (state === 'off') {
    detail = 'Guests will not see this, even once your site is live.'
  } else {
    const what = section.count ? section.count(c) : section.source
    detail = state === 'live'
      ? (section.count ? `${what} showing` : section.source)
      : (section.count ? `${what} ready. Publish your site to make it live.` : 'Publish your site to make it live.')
  }

  return { key: section.key, label: section.label, state, headline: HEADLINES[state], detail }
}

/** Every section described, in default order. */
export function describeAll(args) {
  return WEBSITE_SECTIONS.map((s) => describeSection(s, args))
}

/**
 * What changed about a couple's website, for the activity feed, in their words.
 *
 * Saving the website wrote nothing to the feed until 18 Sep, which is why
 * Corinna's toggle could not be traced. The builder autosaves the whole form on
 * a debounce, so this has to stay quiet unless something of substance moved:
 * the switches, the address, the password and the publish state. Prose edits are
 * not events, and logging every burst is the flood that buried the timeline feed
 * in September.
 *
 * `before` is the stored row, `after` the fields being written. A key absent
 * from either side is not a change. An unset toggle reads as on, the same rule
 * the site uses, so writing `true` over `null` is not "turned on".
 *
 * @returns {string} the sentence, or '' when nothing worth a line changed
 */
export function describeSettingsChange(before, after) {
  const b = before || {}
  const a = after || {}
  const changes = []

  if (a.published !== undefined && !!a.published !== !!b.published) {
    changes.push(a.published ? 'published their website' : 'unpublished their website')
  }
  if (a.slug !== undefined && b.slug && a.slug !== b.slug) {
    changes.push(`changed the address to /w/${a.slug}`)
  }
  if (a.access_password !== undefined && !!a.access_password !== !!b.access_password) {
    changes.push(a.access_password ? 'added a site password' : 'removed the site password')
  }

  const turnedOn = []
  const turnedOff = []
  for (const { key, label } of WEBSITE_SECTIONS) {
    if (a[key] === undefined) continue
    if (!(key in b)) continue
    if (isOn(a[key]) === isOn(b[key])) continue
    ;(isOn(a[key]) ? turnedOn : turnedOff).push(label)
  }
  if (turnedOn.length) changes.push(`turned on ${turnedOn.join(', ')}`)
  if (turnedOff.length) changes.push(`turned off ${turnedOff.join(', ')}`)

  return changes.join('; ')
}

/**
 * One sentence for the top of the panel, so the first thing they read is the
 * answer rather than twelve rows to add up themselves.
 */
export function summarise(described, published) {
  const live = described.filter((d) => d.state === 'live').length
  const ready = described.filter((d) => d.state === 'ready').length
  const empty = described.filter((d) => d.state === 'empty').length

  if (!published) {
    return ready > 0
      ? `Nothing is live yet. ${ready} ${ready === 1 ? 'section is' : 'sections are'} ready and waiting for you to publish.`
      : 'Nothing is live yet, and no section has content in it so far.'
  }
  const parts = [`${live} ${live === 1 ? 'section is' : 'sections are'} showing on your site`]
  if (empty > 0) parts.push(`${empty} ${empty === 1 ? 'is' : 'are'} switched on with nothing in ${empty === 1 ? 'it' : 'them'} yet`)
  return parts.join('. ') + '.'
}

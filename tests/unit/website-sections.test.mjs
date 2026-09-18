import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  WEBSITE_SECTIONS,
  WEBSITE_SECTION_KEYS,
  isOn,
  sectionState,
  describeSection,
  describeAll,
  summarise,
  describeSettingsChange,
} from '../../shared/website-sections.js'

const find = (key) => WEBSITE_SECTIONS.find((s) => s.key === key)

// A couple with everything filled in, to vary one field at a time from.
const full = {
  ourStory: 'We met in a queue',
  theProposal: 'On the roof',
  ceremonyTime: '16:00',
  receptionTime: '18:00',
  dressCode: 'cocktail',
  partyCount: 38,
  shuttleCount: 2,
  registryCount: 1,
  faqCount: 3,
  galleryCount: 4,
  thingsToDoCount: 2,
}

test('a toggle that was never written counts as on', () => {
  assert.equal(isOn(undefined), true)
  assert.equal(isOn(null), true)
  assert.equal(isOn(true), true)
  assert.equal(isOn(false), false)
})

test('off beats everything, however much content there is', () => {
  const state = sectionState({ published: true, toggle: false, content: full, section: find('show_wedding_party') })
  assert.equal(state, 'off')
})

test('content missing reads as empty, not as ready to publish', () => {
  const state = sectionState({ published: false, toggle: true, content: { partyCount: 0 }, section: find('show_wedding_party') })
  assert.equal(state, 'empty')
})

test('on with content but an unpublished site is ready, not live', () => {
  const state = sectionState({ published: false, toggle: true, content: full, section: find('show_wedding_party') })
  assert.equal(state, 'ready')
})

test('on with content on a published site is live', () => {
  const state = sectionState({ published: true, toggle: true, content: full, section: find('show_wedding_party') })
  assert.equal(state, 'live')
})

test("Corinna's case: 38 members ready and the toggle off is reported as hidden", () => {
  const d = describeSection(find('show_wedding_party'), {
    published: true,
    toggles: { show_wedding_party: false },
    content: full,
  })
  assert.equal(d.state, 'off')
  assert.equal(d.headline, 'Hidden from guests')
  // The old panel said "38 members ready" in green here. It must not any more.
  assert.ok(!d.detail.includes('38'), 'a hidden section must not advertise its count')
})

test('the gallery counts website photos that are not the hero', () => {
  const gallery = find('show_gallery')
  // Her real state on 18 Sep: one photo, tagged both "website" and "hero".
  // The old panel counted it and the site rendered no gallery.
  assert.equal(gallery.needs({ galleryCount: 0 }), false)
  assert.equal(gallery.needs({ galleryCount: 1 }), true)
  const d = describeSection(gallery, { published: true, toggles: {}, content: { galleryCount: 0 } })
  assert.equal(d.state, 'empty')
  assert.match(d.detail, /hero/)
})

test('accommodations and RSVP never read as empty, as the couple fills in neither', () => {
  for (const key of ['show_accommodations', 'show_rsvp']) {
    const d = describeSection(find(key), { published: true, toggles: {}, content: {} })
    assert.equal(d.state, 'live', `${key} should be live with no content of its own`)
  }
})

test('every section needs its own content before it claims to be live', () => {
  const needContent = WEBSITE_SECTIONS.filter((s) => !s.needs({}))
  for (const s of needContent) {
    const d = describeSection(s, { published: true, toggles: {}, content: {} })
    assert.equal(d.state, 'empty', `${s.key} with no content should be empty`)
    assert.ok(s.empty.trim() !== '', `${s.key} must say what is missing`)
  }
})

test('an actionable state always says something', () => {
  for (const published of [true, false]) {
    for (const toggle of [true, false]) {
      for (const content of [full, {}]) {
        for (const d of describeAll({ published, toggles: Object.fromEntries(WEBSITE_SECTION_KEYS.map((k) => [k, toggle])), content })) {
          assert.ok(d.headline, `${d.key} has no headline`)
          assert.ok(d.detail && d.detail.trim() !== '', `${d.key} (${d.state}) has no detail`)
        }
      }
    }
  }
})

test('an unpublished site leads with that, not with a section count', () => {
  const described = describeAll({ published: false, toggles: {}, content: full })
  const line = summarise(described, false)
  assert.match(line, /^Nothing is live yet/)
})

test('a published site says how many sections a guest can see', () => {
  const described = describeAll({ published: true, toggles: {}, content: full })
  assert.match(summarise(described, true), /showing on your site/)
})

// The point of the module: these predicates are the site's, not a second guess
// at them. If a guard moves in WeddingWebsite.jsx this test is the thing that
// notices.
test("each content guard is still the one WeddingWebsite.jsx renders on", () => {
  const site = readFileSync(new URL('../../src/pages/WeddingWebsite.jsx', import.meta.url), 'utf8')

  const guards = {
    show_story: 'settings.show_story && settings.our_story',
    show_proposal: 'settings.show_proposal !== false && settings.the_proposal',
    show_schedule: 'settings.show_schedule && (settings.ceremony_time || settings.reception_time)',
    show_wedding_party: 'settings.show_wedding_party && party.length > 0',
    show_dress_code: 'settings.show_dress_code && settings.dress_code',
    show_transport: 'settings.show_transport && shuttle.length > 0',
    show_accommodations: 'settings.show_accommodations && accommodations.length > 0',
    show_things_to_do: 'settings.show_things_to_do && settings.things_to_do?.length > 0',
    show_registry: 'settings.show_registry && settings.registry_links?.length > 0',
    show_faq: 'settings.show_faq && settings.faq_items?.length > 0',
    show_gallery: 'settings.show_gallery && galleryPhotos.length > 0',
  }

  for (const [key, guard] of Object.entries(guards)) {
    assert.ok(
      site.includes(guard),
      `The guard for ${key} is no longer \`${guard}\` in WeddingWebsite.jsx. ` +
      `Update shared/website-sections.js to match, then update this test.`
    )
  }

  // And the gallery really is the website-tagged photos minus the hero.
  assert.ok(site.includes("const galleryPhotos = photos.filter(p => !p.tags?.includes('hero'))"))

  // Every toggle the site knows about is one we describe, and the reverse.
  const onSite = [...site.matchAll(/settings\.(show_[a-z_]+)/g)].map((m) => m[1])
  for (const key of new Set(onSite)) {
    assert.ok(WEBSITE_SECTION_KEYS.includes(key), `${key} is on the site but not in WEBSITE_SECTIONS`)
  }
  for (const key of WEBSITE_SECTION_KEYS) {
    assert.ok(onSite.includes(key), `${key} is in WEBSITE_SECTIONS but the site never reads it`)
  }
})

// ── The activity entry ────────────────────────────────────────────────────────
//
// The builder autosaves the whole form on a debounce, so the thing that matters
// most here is what does NOT get logged.

const stored = {
  slug: 'lovelyboyles',
  published: true,
  access_password: null,
  show_wedding_party: true,
  show_gallery: true,
}

test('an autosave that changed nothing of substance logs nothing', () => {
  assert.equal(describeSettingsChange(stored, { ...stored }), '')
})

test('a prose edit is not an event', () => {
  assert.equal(describeSettingsChange(stored, { ...stored, our_story: 'a new draft of our story' }), '')
})

test('turning the wedding party off is recorded, by name', () => {
  const line = describeSettingsChange(stored, { ...stored, show_wedding_party: false })
  assert.equal(line, 'turned off Wedding Party')
})

test('turning it back on is recorded too', () => {
  const off = { ...stored, show_wedding_party: false }
  assert.equal(describeSettingsChange(off, { ...off, show_wedding_party: true }), 'turned on Wedding Party')
})

test('writing true over a column that was never set is not a change', () => {
  // The builder writes every toggle explicitly on its first save. That must not
  // read as the couple turning twelve sections on.
  const fresh = { slug: 'x', published: false }
  assert.equal(describeSettingsChange(fresh, { ...fresh, show_wedding_party: true, show_gallery: true }), '')
})

test('null in the stored row counts as on, so writing false is turning it off', () => {
  const nulled = { ...stored, show_gallery: null }
  assert.equal(describeSettingsChange(nulled, { ...nulled, show_gallery: false }), 'turned off Photo Gallery')
})

test('publishing and unpublishing are both recorded', () => {
  assert.match(describeSettingsChange({ published: false }, { published: true }), /^published their website$/)
  assert.match(describeSettingsChange({ published: true }, { published: false }), /^unpublished their website$/)
})

test('the address and the password are recorded, the password itself is not', () => {
  assert.equal(describeSettingsChange(stored, { ...stored, slug: 'boyles-2027' }), 'changed the address to /w/boyles-2027')
  const withPw = describeSettingsChange(stored, { ...stored, access_password: 'hunter2' })
  assert.equal(withPw, 'added a site password')
  assert.ok(!withPw.includes('hunter2'), 'the password must never reach the activity feed')
  assert.equal(describeSettingsChange({ ...stored, access_password: 'hunter2' }, { ...stored, access_password: '' }), 'removed the site password')
})

test('several changes in one save read as one sentence', () => {
  const line = describeSettingsChange(stored, { ...stored, published: false, show_wedding_party: false })
  assert.equal(line, 'unpublished their website; turned off Wedding Party')
})

test('a first save has no stored row to compare against and does not throw', () => {
  assert.equal(describeSettingsChange(null, { published: true, show_gallery: false }), 'published their website')
  assert.equal(describeSettingsChange(undefined, undefined), '')
})

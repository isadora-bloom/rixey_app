# Plan: one navigation for couple and venue

Ten UX fixes agreed 14 Sep, after the audit fixes shipped. The point of all
ten: Isadora or Grace on the phone with a couple should be able to say "open
Bar Planner" and both land in the same place, see the same state, and read
the same words.

Same working rules as `PLAN-AUDIT-FIXES.md`: own your files, explicit
staging, no pushes, plain commit messages, British spelling, no em dashes,
every mutation through apiFetch, audit green before reporting.

## The ten

1. One shared section registry, both menus rendered from it, same group
   order on both sides.
2. One key per section on both sides (`vendor`/`vendors`,
   `photos`/`photo-library`, `guestcare`/`guest-care` unified).
3. Section in the URL on both sides: couple `?section=`, admin
   `?wedding=&section=`, same keys.
4. Same labels on both sides.
5. One distinct icon per section, same icon on both sides (lucide-react).
6. Same status marks in both menus: a tick when the couple has signed the
   section off, a count when something waits on the venue.
7. Collapsible groups that remember themselves, plus type-to-jump with
   Ctrl+K, on both sides.
8. Get Started shrinks: Wedding Details and Walkthrough Notes move to Plan;
   the group collapses once onboarding is complete.
9. Parity gaps closed: couple gets read-only Documents and Completeness;
   venue gets an RSVP Settings tab.
10. "View as couple" on the wedding profile.

## Canonical registry (agreed up front so agents can build in parallel)

`shared/sections.js` exports `SECTIONS`: an ordered array of
`{ key, label, group, icon, sides: ['couple','venue'] | ['venue'] | ['couple'], aliases: [] }`.

Group order on both sides: Get Started, Plan, Day Of, Guests, Website,
Rixey, After the Day, Connect, then Venue only (venue side only).

| key | label | group | sides | old keys (aliases) |
|---|---|---|---|---|
| chat | Chat with Sage | Get Started | couple | |
| worksheets | Worksheets | Get Started | both | |
| checklist | Checklist | Get Started | both | |
| wedding-details | Wedding Details | Plan | both | |
| walkthrough | Walkthrough Notes | Plan | both | |
| budget | Budget | Plan | both | |
| guests | Guest List | Plan | both | |
| vendors | Vendors | Plan | both | couple: vendor |
| vendor-directory | Vendor Directory | Plan | couple | preferred-vendors |
| timeline | Timeline | Plan | both | |
| tables | Tables | Plan | both | |
| documents | Documents | Plan | both | |
| completeness | Completeness | Plan | both | |
| ceremony-order | Ceremony Order | Day Of | both | |
| ceremony-chairs | Ceremony Chairs | Day Of | both | |
| table-map | Table Map | Day Of | both | |
| staffing | Staffing Guide | Day Of | both | |
| bar | Bar Planner | Day Of | both | |
| makeup | Hair & Makeup | Day Of | both | |
| shuttle | Shuttle Schedule | Day Of | both | |
| rehearsal | Rehearsal Dinner | Day Of | both | |
| bedrooms | Bedroom Assignments | Day Of | both | |
| decor | Decor Inventory | Day Of | both | |
| rsvp-settings | RSVP Settings | Guests | both | |
| allergies | Allergy Registry | Guests | both | |
| guest-care | Guest Care Notes | Guests | both | couple: guestcare |
| website-builder | Website Builder | Website | both | |
| photo-library | Photo Library | Website | both | couple: photos |
| wedding-party | Wedding Party | Website | both | |
| inspo | Inspiration | Rixey | both | |
| borrow | Borrow Brochure | Rixey | both | |
| picks | Rixey Picks | Rixey | couple | |
| downloads | Manor Downloads | Rixey | couple | |
| day-of-memories | Day-of Memories | After the Day | both | |
| inbox | Inbox | Connect | both | venue: direct-messages |
| booking | Book a Meeting | Connect | couple | |
| resources | Resources | Connect | couple | |
| overview | Overview | Venue only | venue | |
| notes | Planning Notes | Venue only | venue | |
| conversations | Sage Conversations | Venue only | venue | messages |
| contacts | Family & Contacts | Venue only | venue | |
| uncertain | Uncertain Q's | Venue only | venue | |
| meetings | Meetings | Venue only | venue | |
| activity | Recent Activity | Venue only | venue | |
| sheet-sync | Sync from Sheet | Venue only | venue | |
| contract-upload | Upload Contract | Venue only | venue | |
| ask | Ask About Wedding | Venue only | venue | |
| api-usage | API Usage | Venue only | venue | |

Aliases are accepted everywhere an old key can arrive: `?section=` links in
old emails, `focusTab`, `section_finalisations.section` rows already in the
database, notification bodies. Nothing stored is rewritten.

## Wave A, two agents in parallel

### U1 navigation core, Opus
Owns `shared/sections.js` (new), `src/pages/dashboard/DashboardNav.jsx`,
`src/pages/admin/weddingTabs.js`, `src/pages/admin/AdminHeader.jsx`,
`src/pages/Dashboard.jsx` (section switch, alias resolution, `?section=`),
`src/pages/admin/AdminWeddingProfile.jsx` (tab switch and labels),
`src/pages/Admin.jsx` (activeTab and the `?wedding=&section=` URL),
`scripts/audit-nav-parity.mjs`, `package.json` (lucide-react),
`src/components/ui/SectionIcon.jsx` (new). Items 1, 2, 3, 4, 5, 8.

### U2 parity components, Sonnet
Owns new `src/components/CoupleDocuments.jsx`,
`src/components/CoupleCompleteness.jsx`, the admin wrapper
`src/components/admin/RsvpSettingsTab.jsx` (new), and the server routes
they need (couple-readable GET for a wedding's documents and completeness,
under a non-admin prefix, scoped by weddingAccess). Item 9. Does NOT wire
the sections into either menu; U1 registers the keys and the orchestrator
wires the imports at merge.

### Gate A
Merge U2 then U1, wire U2's components into the three registered keys,
build, audit, `scripts/audit-nav-parity.mjs`, push, smoke.

## Wave B, two agents in parallel, after Gate A

### U3 menu chrome, Sonnet
Owns `DashboardNav.jsx`, `AdminHeader.jsx`, `weddingTabs.js` (badges and
marks only), new `src/components/ui/SectionJump.jsx`, new
`src/hooks/useSectionStatus.js`. Items 6 and 7. Status data: couple side
already loads `section_finalisations`; venue side gets pending counts per
section from planning notes (category to section map lives in the
registry) and worksheets. Both menus render the same two marks.

### U4 view as couple, Opus
Owns `src/pages/Dashboard.jsx` (a `viewAs={{ weddingId, profile }}`
prop path that makes every loader read that wedding and every mutation
disabled), `src/pages/admin/AdminWeddingProfile.jsx` (a "View as couple"
toggle rendering `<Dashboard viewAs>` inside the profile), and the
`src/context/AuthContext.jsx` read path if a shim is needed. Item 10. Admin
tokens already pass weddingAccess for any wedding, so no server change.

### Gate B
Merge U3 then U4, build, audit, push, smoke, handoff.

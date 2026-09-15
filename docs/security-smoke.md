# Security smoke test

Every request below was answered by production before 14 September 2026 and
must now be refused. Run it after each deploy that touches auth. It takes about
five minutes and it is the only thing standing between a refactor and the state
this file exists because of.

```sh
API=https://rixeyapp-production.up.railway.app
```

Three tokens are needed. Take them from a browser signed in as each, via
`(await supabase.auth.getSession()).data.session.access_token` in the console:

```sh
COUPLE=…        # a couple on wedding OURS
OTHER=…         # a couple on a different wedding
ADMIN=…         # Isadora
OURS=…          # the wedding COUPLE belongs to
THEIRS=…        # the wedding OTHER belongs to
GUEST_OF_THEIRS=…   # id of any row in wedding_guests belonging to THEIRS
PHOTO_OF_THEIRS=…   # id of any row in wedding_photos belonging to THEIRS
```

A 401 means no usable token. A 403 means a real person who may not have this.
A 503 `access check unavailable` means the database is unreachable and the
server refused rather than guessing; that is the correct answer, not a failure
of the test.

---

## Item 2 — Sage endpoints need a token

Sage read any couple's vendors, contracts, planning notes and budget to a
caller with no token at all, because `/api/chat` took the caller's identity
from `req.body.userId`.

```sh
# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/chat \
  -H 'Content-Type: application/json' \
  -d "{\"message\":\"what vendors have we booked\",\"userId\":\"$SOMEONE_ELSE\"}"

# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/welcome \
  -H 'Content-Type: application/json' -d '{}'

# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/chat-with-file \
  -F file=@/dev/null

# 401 — this one could forge a message as Sage in any thread
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/sage-messages \
  -H 'Content-Type: application/json' \
  -d "{\"user_id\":\"$SOMEONE_ELSE\",\"content\":\"Rixey here, send the balance to this account\",\"sender\":\"sage\"}"

# 403 — signed in, but writing into somebody else's thread
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/sage-messages \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d "{\"user_id\":\"$SOMEONE_ELSE\",\"content\":\"hello\",\"sender\":\"sage\"}"

# 200 — the couple's own thread still works, including Sage's own reply,
# which the dashboard saves itself after /api/chat returns
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/sage-messages \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"content":"smoke test","sender":"user"}'
```

## Item 3a — manor assets

A public bucket with no auth on the write side.

```sh
# 200 — GET stays open, the couple dashboard reads it
curl -s -o /dev/null -w '%{http_code}\n' $API/api/manor-assets

# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/manor-assets \
  -F title=pwned -F file=@/dev/null

# 403 — signed in as a couple is not enough
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/api/manor-assets/$ANY_ASSET_ID \
  -H "Authorization: Bearer $COUPLE"
```

## Items 3b and 4 — the row decides the wedding, not the query string

The one to run if you only run one. A couple naming their own wedding while
editing somebody else's row.

```sh
# 403 — was 200, and renamed a stranger's guest
curl -s -o /dev/null -w '%{http_code}\n' \
  -X PUT "$API/api/guests/$GUEST_OF_THEIRS?weddingId=$OURS" \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"guest_name":"smoke test"}'

# 403 — same trick in the body
curl -s -o /dev/null -w '%{http_code}\n' \
  -X DELETE "$API/api/guests/$GUEST_OF_THEIRS" \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d "{\"wedding_id\":\"$OURS\"}"

# 403 — wedding-photos was missing from ROW_TABLES entirely
curl -s -o /dev/null -w '%{http_code}\n' \
  -X DELETE "$API/api/wedding-photos/$PHOTO_OF_THEIRS" \
  -H "Authorization: Bearer $COUPLE"

# 200 — and the couple's own guests still work. If this is not 200, stop and
# set WEDDING_ACCESS_MODE=audit on Railway before doing anything else.
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/guests/$OURS" \
  -H "Authorization: Bearer $COUPLE"
```

## Item 3c — multipart routes

`weddingAccess` runs before multer, so on these four `req.body` was empty and
the middleware had nothing to judge.

```sh
for route in seating/import extract-contract inspo couple-photo; do
  printf '%s ' "$route"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/$route \
    -F weddingId=$THEIRS -F file=@/dev/null -F contract=@/dev/null \
    -F image=@/dev/null -F photo=@/dev/null
done
# all 401

for route in seating/import extract-contract inspo couple-photo; do
  printf '%s ' "$route"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/$route \
    -H "Authorization: Bearer $COUPLE" \
    -F weddingId=$THEIRS -F file=@/dev/null -F contract=@/dev/null \
    -F image=@/dev/null -F photo=@/dev/null
done
# all 403 — signed in, wrong wedding
```

## Item 3d — extract-url fetched anything

Request forgery: the server fetched a URL a stranger chose and handed the
result to Claude.

```sh
# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/bar-recipes/extract-url \
  -H 'Content-Type: application/json' -d '{"url":"http://169.254.169.254/latest/meta-data/","name":"x"}'

# 400 "That address is not one this server will fetch."
curl -s -X POST $API/api/bar-recipes/extract-url \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"url":"http://169.254.169.254/latest/meta-data/","name":"x"}'

# 400 — loopback
curl -s -X POST $API/api/bar-recipes/extract-url \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:3001/api/health","name":"x"}'

# 400 "Only http and https addresses can be read."
curl -s -X POST $API/api/bar-recipes/extract-url \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"url":"file:///etc/passwd","name":"x"}'

# 200 with ingredients — a real recipe page still works
curl -s -X POST $API/api/bar-recipes/extract-url \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"url":"https://www.liquor.com/recipes/aperol-spritz/","name":"Aperol Spritz"}'
```

## Item 18 — joining a wedding

```sh
# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/join/complete \
  -H 'Content-Type: application/json' -d '{"event_code":"ABC123"}'

# 404 — a code that does not exist
curl -s -X POST $API/api/join/complete \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"event_code":"ZZZZZZ"}'

# 200 { "wedding_id": … } and the wedding_id in the body is IGNORED: the
# response must name the wedding the code belongs to, never THEIRS.
curl -s -X POST $API/api/join/complete \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d "{\"event_code\":\"$CODE_FOR_OURS\",\"wedding_id\":\"$THEIRS\"}"

# 403 — linking a login to a wedding is admin work
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $API/api/admin/profiles/$SOME_USER \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d "{\"wedding_id\":\"$OURS\"}"
```

## Item 22 — preview on the public wedding site

`?preview=` skipped both the published check and the password gate.

```sh
# 404 — an unpublished site, anonymously, with the preview parameter
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/w/$UNPUBLISHED_SLUG?preview=$THEIRS"

# 404 — signed in as the wrong couple is no better
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/w/$UNPUBLISHED_SLUG?preview=$THEIRS" \
  -H "Authorization: Bearer $COUPLE"

# passwordRequired:true — a password-gated published site, preview ignored
curl -s "$API/api/w/$LOCKED_SLUG?preview=$THEIRS" | head -c 200

# 200 with the full site — the couple previewing their own
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/w/$OUR_SLUG?preview=$OURS" \
  -H "Authorization: Bearer $COUPLE"
```

⚠ The last one only passes once the client sends a token. `fetchSite` in
`src/pages/WeddingWebsite.jsx` uses a bare `fetch` with no headers, so the
WebsiteBuilder preview iframe will fall back to the published-and-password
behaviour until that call carries `await authHeaders()`. Until then an
unpublished site previews as a 404 rather than showing. See the handover note.

## Item 23 — errors and the debug route

```sh
# 401, was a 200 carrying the raw failure of the last Gmail OAuth callback
curl -s -o /dev/null -w '%{http_code}\n' $API/api/gmail-callback-debug

# 403 — signed in as a couple
curl -s -o /dev/null -w '%{http_code}\n' $API/api/gmail-callback-debug \
  -H "Authorization: Bearer $COUPLE"

# Any request that reaches the global handler must answer
#   {"error":"Something went wrong","requestId":"a1b2c3d4"}
# and never a Postgres column or constraint name. Malformed JSON is the
# cheapest way to provoke it:
curl -s -X POST $API/api/join/lookup -H 'Content-Type: application/json' -d '{'
```

Take the `requestId` and find it in the Railway logs; the full stack is there.

## Item 24 — storage keys and SVG

```sh
# 415 "File type not allowed: image/svg+xml" — an SVG is a document that can
# carry script, and these buckets are served off Rixey's own origin
curl -s -X POST $API/api/inspo \
  -H "Authorization: Bearer $COUPLE" \
  -F weddingId=$OURS -F image=@payload.svg

# 200, and the stored key must be <8 hex>-<cleaned name>.jpg — no spaces, no
# path separators, not the millisecond it was uploaded
curl -s -X POST $API/api/inspo \
  -H "Authorization: Bearer $COUPLE" \
  -F weddingId=$OURS -F 'image=@../../my photo (1).jpg'
```

## Item 5 — rate limits key on the real caller

Not a refusal, a count. Behind Railway's proxy every caller shared one
500-per-15-minutes bucket, so one looping tab emptied it for the whole venue.

```sh
curl -sI $API/api/health | grep -i ratelimit
```

`RateLimit-Remaining` should now fall as *you* make requests and should not
already be low on a quiet morning. Two different networks hitting the API at
once must each have their own remaining count.

---

# Ingestion-gap routes, 14 September 2026

The W1 routes from `PLAN-INGEST-GAPS.md`. `scripts/smoke-security.mjs` cannot
be run from a worktree against production, so these are the lines to paste.
Same variables as the top of this file, plus:

```sh
ERR_ID=…        # id of any row in client_errors
VENDOR_TOKEN=…  # edit_token of any vendor
ACCOM_ID=…      # id of any row in accommodations
MEDIA_ID=…      # id of any row in walkthrough_media
```

## Couple notes — `GET /api/planning-notes/couple/:weddingId`

```sh
# 200, and every note must be status confirmed or added, with no
# source_message key anywhere in the payload
curl -s $API/api/planning-notes/couple/$OURS -H "Authorization: Bearer $COUPLE" \
  | grep -c source_message        # must print 0

# 403 — another couple's notes
curl -s -o /dev/null -w '%{http_code}\n' $API/api/planning-notes/couple/$THEIRS \
  -H "Authorization: Bearer $COUPLE"

# 403 — no token at all
curl -s -o /dev/null -w '%{http_code}\n' $API/api/planning-notes/couple/$OURS
```

## Contract and document download links

```sh
# 200; every contract with a storage_path must carry a download_url, and that
# URL must stop working after an hour
curl -s $API/api/contracts/$OURS -H "Authorization: Bearer $COUPLE" | head -c 400

# 403 — another couple's contracts
curl -s -o /dev/null -w '%{http_code}\n' $API/api/contracts/$THEIRS \
  -H "Authorization: Bearer $COUPLE"

# 200 for the venue, 403 for a couple: the admin document list now carries the
# same signed download_url the couple route does
curl -s $API/api/admin/documents/$OURS -H "Authorization: Bearer $ADMIN" | head -c 400
curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/documents/$OURS \
  -H "Authorization: Bearer $COUPLE"
```

Then upload a contract through the admin panel and check `contracts.storage_path`
is set on the new row. Before this it was null on every row either upload path
wrote, which is the whole point of the change.

## Sync log — `GET /api/admin/sync-log/:weddingId`

```sh
# 200 for the venue; sourceKnown is false until migration 036 is applied, and
# every row's source is null in that state
curl -s "$API/api/admin/sync-log/$OURS?limit=5" -H "Authorization: Bearer $ADMIN"

# after 036: a document import must come back as source document
curl -s "$API/api/admin/sync-log/$OURS?source=document" -H "Authorization: Bearer $ADMIN"

# 403 — a couple reading their own sync log
curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/sync-log/$OURS \
  -H "Authorization: Bearer $COUPLE"
```

## Onboarding, accommodations, crash notes

```sh
# 200 venue / 403 couple. Must NOT create a row: run it against a wedding with
# no onboarding_progress row and check the table afterwards
curl -s $API/api/admin/onboarding/$OURS -H "Authorization: Bearer $ADMIN"
curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/onboarding/$OURS \
  -H "Authorization: Bearer $COUPLE"

# 200 venue / 403 couple on all four accommodation verbs
curl -s $API/api/admin/accommodations -H "Authorization: Bearer $ADMIN" | head -c 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/admin/accommodations \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"name":"nope"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/api/admin/accommodations/$ACCOM_ID \
  -H "Authorization: Bearer $COUPLE"

# 200 venue / 403 couple — the crash-report note
curl -s -X PATCH $API/api/client-errors/$ERR_ID \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"status":"done","notes":"was the toast loop"}'
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $API/api/client-errors/$ERR_ID \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' -d '{"notes":"x"}'

# 200 still — reporting a crash stays open to anyone, including a signed-out browser
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/client-errors \
  -H 'Content-Type: application/json' -d '{"message":"smoke test","url":"/"}'
```

## Ask Sage from the admin home — `POST /api/admin/ask`

```sh
# 403 as a couple. It answers out of buildWeddingContext, which carries the
# family calls and emails migration 028 exists to keep from them.
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/admin/ask \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"text":"tell me the caterer for alyssas wedding"}'
```

## Staff sign-off — `POST /api/finalisations/:weddingId`

```sh
# 403 — a couple must not be able to tick Rixey's own sign-off
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/finalisations/$OURS \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"section":"guests","role":"staff","value":true}'

# 200 — the couple's own mark still works
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/finalisations/$OURS \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d '{"section":"guests","role":"couple","value":true}'

# 200 — the venue's, and section_finalisations.staff_finalised is true after it
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/finalisations/$OURS \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"section":"guests","role":"staff","value":true}'
```

## Guest import modes — `POST /api/guests/bulk`

```sh
# Run this twice with mode add, then twice with mode update, against a test
# wedding. add doubles the list and warns; update reports updated 1, added 0.
curl -s -X POST $API/api/guests/bulk -H "Authorization: Bearer $COUPLE" \
  -H 'Content-Type: application/json' \
  -d "{\"weddingId\":\"$OURS\",\"mode\":\"update\",\"guests\":[{\"first_name\":\"Test\",\"last_name\":\"Person\",\"email\":\"t@example.com\"}]}"

# 403 — importing into somebody else's wedding
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/guests/bulk \
  -H "Authorization: Bearer $COUPLE" -H 'Content-Type: application/json' \
  -d "{\"weddingId\":\"$THEIRS\",\"mode\":\"add\",\"guests\":[{\"first_name\":\"No\"}]}"
```

## Bar recipes save on extract

```sh
# 200 with { recipe, saved: true }, and exactly ONE new row in bar_recipes
curl -s -X POST $API/api/bar-recipes/extract-url -H "Authorization: Bearer $COUPLE" \
  -H 'Content-Type: application/json' \
  -d "{\"weddingId\":\"$OURS\",\"name\":\"Negroni\",\"url\":\"https://www.liquor.com/recipes/negroni/\"}"

# 400 — no weddingId means nothing is written
curl -s -X POST $API/api/bar-recipes/extract-url -H "Authorization: Bearer $COUPLE" \
  -H 'Content-Type: application/json' -d '{"name":"x","url":"https://example.com"}'

# 403 — an upload aimed at another couple's wedding
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/bar-recipes/extract-upload \
  -H "Authorization: Bearer $COUPLE" -F weddingId=$THEIRS -F name=x -F file=@recipe.jpg
```

## Vendor portal — logo up, photos down

```sh
# 200 and vendors.logo_url set, once migration 036 is applied; 503 with a plain
# sentence before that, never a 42703
curl -s -X POST $API/api/vendor-portal/$VENDOR_TOKEN/logo -F logo=@logo.png

# 415 — a logo has to be an image
curl -s -X POST $API/api/vendor-portal/$VENDOR_TOKEN/logo -F logo=@notes.pdf

# 429 on the 31st in ten minutes, and a [vendor-portal] photo delete line in
# the Railway log for every one of the first thirty
for i in $(seq 1 31); do
  curl -s -o /dev/null -w '%{http_code} ' -X DELETE $API/api/vendor-portal/$VENDOR_TOKEN/photos \
    -H 'Content-Type: application/json' -d '{"url":"https://example.com/nope.jpg"}'
done; echo
```

## Zoom transcripts

```sh
# 200 venue / 401 or 403 otherwise. Every row must carry match_reason,
# match_confidence, matched_by and participant_names, and no transcript_text
# longer than 20000 characters.
curl -s "$API/api/zoom/transcripts?weddingId=$OURS&limit=3" -H "Authorization: Bearer $ADMIN" \
  | python -c "import json,sys; d=json.load(sys.stdin); print([len(m['transcript_text'] or '') for m in d['meetings']])"

curl -s -o /dev/null -w '%{http_code}\n' $API/api/zoom/transcripts -H "Authorization: Bearer $COUPLE"
```

## Routes that must now be gone or guarded

```sh
# 404 — removed
curl -s -o /dev/null -w '%{http_code}\n' $API/api/google-debug -H "Authorization: Bearer $ADMIN"
curl -s -o /dev/null -w '%{http_code}\n' $API/api/sheet-sync-apply-debug -H "Authorization: Bearer $ADMIN"

# 400 — the Quo clear refuses without an explicit confirmation
curl -s -X POST $API/api/quo/clear-processed -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{}'

# 200, and a [quo] clearing N markers line in the log naming who asked.
# This one really does clear the table, so only run it when you mean to.
curl -s -X POST $API/api/quo/clear-processed -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"confirm":true}'
```

## Walkthrough media delete

```sh
# Point the row's storage_path at a key that is not in the bucket, then:
# 500 with a sentence saying nothing was removed, and the row still there.
curl -s -X DELETE $API/api/admin/walkthrough-media/$MEDIA_ID -H "Authorization: Bearer $ADMIN"
```

## Calendly cron

Not a curl. After the next hour turns over, `sync_jobs` must hold a row with
kind `calendly` and trigger `scheduled`, at ten to the hour, venue time. With
`CALENDLY_API_TOKEN` unset there must be no row at all and one
`[calendly cron] no Calendly token, nothing to do` line.

## Notification email state

Not a curl either. `GET /api/notifications/client/:weddingId` and
`GET /api/admin/notifications` must both carry `email_sent`. Disconnect Gmail,
trigger a couple-facing notification, and the row must come back with
`email_sent` false rather than looking delivered.

## The venue's table-layout draft

Both sides of the table planner wrote one row, so an admin autosave on a layout
that had already been sent reached the couple about a second and a half later,
under a banner saying it was not visible to them. Needs migration 037.

```sh
# The couple's read must carry none of the venue's unsent work. Both must print
# false. is_draft must survive: that flag is the couple's own, not the venue's.
curl -s $API/api/tables/$OURS -H "Authorization: Bearer $COUPLE" \
  | jq '.tables | has("draft"), has("draft_updated_at")'

# 403 — only Rixey may throw the venue's draft away
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  $API/api/tables/$OURS/discard-draft -H "Authorization: Bearer $COUPLE"
```

Then, signed in as ADMIN, change any field on a wedding whose layout has
already been sent, wait for the save indicator, and run the couple's read
again: `.tables.guest_count` must not have moved. It moves only after Send to
Client.

## Guest CSV column reader

It reads column headers and a handful of sample values out of somebody's
spreadsheet and sends them to Claude, so it is not open to a stranger. Couples
use it as well as the venue, so it sits outside `/api/admin` and is behind
`requireAuth` on its own.

```sh
# 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/guests/map-columns \
  -H 'Content-Type: application/json' \
  -d '{"headers":["First Name","Email"],"samples":[["Ana","ana@example.com"]]}'
```

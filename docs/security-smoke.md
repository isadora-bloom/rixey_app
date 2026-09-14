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

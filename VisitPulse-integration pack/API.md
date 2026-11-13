# VisitPulse API v1

## Public event collection

`POST https://personal-website-53mf.onrender.com/clientportal/api/analytics/v1/events`

Headers: `Content-Type: application/json`, browser-provided `Origin`. Credentials: omit. No cookies, CSRF token or Authorization header. `/clientportal/api/analytics/event` is a path alias with the same new contract; old callers must add username.

```json
{"username":"nielseninnovations","sessionId":"c13c128bbd164c7891ab12f529f7f955","path":"/services","title":"Services","referrer":"https://www.google.com"}
```

| Field | Contract |
| --- | --- |
| username | Required, exact lowercase portal username, 3?32 characters, a-z/0-9/dot/underscore/hyphen. Active account and registered origin required. |
| sessionId | Required, 16?64 ASCII letters/digits/underscore/hyphen. Reuse per tab session, never a user email or account identifier. |
| path | Required, starts with one slash, not two. Trimmed/truncated to 300 characters; query and fragment stripped. |
| title | Optional string, trimmed/truncated to 160 characters. |
| referrer | Optional URL; only hostname is stored, otherwise Direct. Tracker sends only origin. |

Server supplies ownerId, site (validated Origin), username, device/browser derived from User-Agent, occurredAt and expiresAt. Client timestamps/ownership fields are ignored. Server rejects unsafe object keys. Browser sessions are scoped per username/site; sessionStorage failure uses an in-memory session. No persistent visitor ID, cookie, raw user agent or IP is stored in analytics records. Hosting/access logs may independently contain IPs. GPC and DNT=1 suppress browser tracking. The tracker returns false on rejection/failure and never retries automatically.

| Status | Meaning |
| --- | --- |
| 202 | Database insert completed; `{ "ok": true }`. |
| 204 | Accepted OPTIONS preflight. |
| 400 | Invalid JSON, username, session, path or unsafe keys. |
| 403 | Missing/unregistered Origin, username-origin mismatch, or unavailable account. |
| 413 | JSON body exceeds 4 KB. |
| 415 | Content-Type is not application/json. |
| 429 | More than 60 POST attempts/minute/IP (per backend process). |
| 503 | Invalid server registration config or unavailable storage. |

Rejected origins do not receive CORS permission; browsers may show a CORS error rather than the response body. Unknown fields are ignored except dangerous keys. A username is a public destination, not a secret. Origin checks restrict browser submissions; non-browser callers can forge Origin, so this is not cryptographic proof of traffic. Use a shared limiter/edge protection when scaling to multiple backend instances.

Manual smoke test (POSIX shell; replace the origin and username with a registered pair):

```sh
curl -i 'https://personal-website-53mf.onrender.com/clientportal/api/analytics/v1/events' \
  -H 'Origin: https://nielseninnovations.com' \
  -H 'Content-Type: application/json' \
  --data '{"username":"nielseninnovations","sessionId":"integration_test_1234","path":"/integration-check","title":"Integration check"}'
```

In Windows use curl.exe and a JSON file with `--data-binary @event.json` to avoid shell quoting differences. CLI/server callers must set their registered Origin explicitly. Never forward untrusted arbitrary browser payloads from your server without validating them.

## Private reports

`GET /clientportal/api/analytics/summary?days=30` requires the existing portal login cookie. Allowed periods: 7, 30, 90; otherwise 30. Owner is always the authenticated user ID, never a query username. Response retains totals, daily, pages, referrers, devices, browsers, recent and storage, and adds sites. Recent events include site. No session IDs are returned. Returns 401 for unauthenticated callers and 503 if storage fails.

Reports use the latest 50,000 events within the period, with UTC daily buckets. Each ranking shows the top ten. Pages are grouped by path across sites; Websites ranks by origin. Visitors are tab sessions per site, not distinct people. Dashboard refresh is manual/period-change/page-load, not push streaming.

## Troubleshooting

- No request: check GPC/DNT, consent, script loading, username config, CSP/connect-src and blockers.
- 403: check exact origin including scheme/port/www, full VISITPULSE_SITES map and active portal account.
- 400: check session format and slash-prefixed path.
- 503: check backend config JSON, MongoDB connection, collection/index permissions and logs.
- Accepted but missing: sign into the matching account, refresh, check period and report cap. Username changes require updating tracker configuration and registration keys; existing data remains with the same stable account ID.

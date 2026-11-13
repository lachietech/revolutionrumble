# Backend operations and implementation

The central service uses the existing Express API and MONGO_URI_CLIENT database. Existing backend secrets/config remain required; consuming websites receive none of them.

Implementation in the source repository:
- backend/apis.js and visitpulse-api/index.js mount the public router before portal sessions/CSRF, while reports remain protected.
- backend/visitpulse-api/routing/collect.js provides v1 ingestion, per-account origin registration, validation, bounded JSON parsing and rate limiting.
- backend/visitpulse-api/routing/analytics.js filters reports by authenticated ownerId.
- backend/visitpulse-api/models/AnalyticsEvent.js adds ownerId, username and site, with an owner/date index and existing expiry TTL.
- backend/visitpulse-api/services/analyticsStorage.js creates storage/indexes and assigns pre-existing ownerless events to the nielseninnovations account only.
- frontend/src/visitpulse-tracker.js is identical to the portable copy in this pack; frontend/src/analytics.js supplies this application's environment values/default username.
- VisitPulseApp and AnalyticsPanel display reports for all signed-in account roles, including a website ranking.

## Migration/deployment

Deploy backend first, frontend second; legacy /event callers without username are rejected until updated. Back up the analytics collection according to your normal deployment process. Startup lazily creates the collection and indexes and backfills only records where ownerId is absent, using the exact nielseninnovations account. Legacy records are labelled https://nielseninnovations.com because their original origin was not stored. Records already assigned to an account are never reassigned. If that account does not exist, legacy records remain hidden; create it and restart to retry migration. Startup initialization failures are logged; collection/report requests retry storage initialization.

Data expires after 395 days using MongoDB TTL (deletion is asynchronous). Stable owner IDs protect ownership after a username change; update public username configuration and the origin map together. Deactivating an account blocks collection and portal access. Deleting/recreating a username creates a different owner ID and does not transfer its history.

The tracker is best-effort page-load analytics, not a guaranteed delivery queue. Blockers, privacy preferences, network loss and rate limits can reduce counts. No automatic retry/idempotency or bounce/duration tracking is implemented.

## Local validation

From repository root:

```sh
node --test backend/visitpulse-api/tests/*.test.js
npm run build
```

Tests use isolated fake persistence and local HTTP requests; they do not modify a live database. Production smoke testing requires a deployed backend, registered site and active account. Keep both tracker copies identical when updating the pack.

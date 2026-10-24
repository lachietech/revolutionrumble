# Security and functionality audit

Date: 23 October 2026

Migration note (24 October 2026): this document records the audit of the former
HTML frontend. The React migration retains the backend protections and replaces
the legacy rendering checks with React escaping, routing, scoring, and desktop/mobile
workflow tests. See README.md for current commands and verification boundaries.

Reviewed the local Express/Mongoose application, authentication and authorization,
public registrations, result maintenance, frontend rendering, email templates,
dependency tree, and available checks. Implemented fixes in the working tree.
This is a high-level code audit, not a production penetration test or a guarantee
that every business workflow is correct.

## Findings fixed

| Severity | Finding | Change |
| --- | --- | --- |
| High | Stored player names and other database strings were inserted into admin and public HTML without escaping. | Added shared text/attribute escaping, corrected affected renderers, and isolated email previews in a sandboxed iframe. |
| High | Guest registrations overwrote an existing bowler's name, phone, gender and average using only an email address. | Existing profile fields now require the owner's session or an admin session to change. |
| High | The admin force-sync route could reassign every other player's results in the selected player's tournaments. | Relinking now requires a registration belonging to that player. |
| Medium | Login did not regenerate the session; OTP consumption and failed-attempt updates could race. | Rotate session IDs on login, await session persistence, atomically count attempts and consume OTPs, and store OTP hashes. |
| Medium | OTP routes bypassed CSRF; admin logout used GET. | Enforce CSRF on login and logout; update the browser's token after login and use POST for admin logout. |
| Medium | Direct admin HTML paths bypassed page authorization. | Apply authorization to static aliases, including encoded paths; return JSON denial for protected APIs. API data was separately protected before this fix. |
| Medium | Dependencies contained 15 affected packages, including the mail library and old watcher dependency chain. | Upgrade Nodemailer and replace Nodemon with Node's built-in watcher. Final npm audit reports zero known vulnerabilities. |
| Medium | Reservation lookup/release relied only on a supplied reservation identifier. | Require the owning browser session. |
| Medium | Squad edits could bypass qualifying requirements; duplicate IDs could inflate selections. | Deduplicate IDs and enforce qualifying and re-entry rules during squad edits. |
| Low | Integer validation accepted partially numeric input, and email normalization could change the destination mailbox. | Enforce strict scalar validation and preserve legitimate mailbox characters. |
| Low | CSV exports could interpret user fields as spreadsheet formulas. | Prefix formula-like exported values. |

Additional hardening: security headers, no-store responses for private APIs,
random development session secrets, explicit proxy-hop validation, database
connection before listening, and proper 400/413 responses for malformed/oversized
bodies. The existing production secret-length and secure-cookie requirements remain.

## Functional failures repaired

- Restored missing round-robin and tri-matchplay form markup. The HTML contained
  a literal truncation marker, causing tournament-page initialization to throw.
- Allowed an unnamed, first-time bowler OTP record to validate before profile completion.
- Checked Resend's returned error field so failed deliveries are not reported as successful.
- Fixed an evaluated JavaScript expression in the default confirmation-email template;
  template creation now succeeds and displays the entry fee correctly.
- Removed invalid population of embedded squad IDs after squad updates, and handled
  missing bowler/tournament records without dereferencing null.
- Added the browser's favicon route.

## Verification

- `npm test`: syntax checks for 44 JavaScript files and 15 passing regression tests.
- `npm run test:browser`: 12 pages pass in headless Microsoft Edge, with no captured
  JavaScript exceptions, console errors or failed local HTTP resources. Exercises
  creation and editing inputs for all five stage types.
- Page tests resolve local script, stylesheet and media references.
- Regression tests cover authorization, encoded admin aliases, CSRF, session rotation,
  OTP reuse/exhaustion, provider error handling, profile protection, safe rendering,
  email generation, result ownership, reservation ownership and logout.
- `npm audit`: zero known vulnerabilities after the dependency changes.
- `git diff --check`: passes.

Tests use isolated sessions and mocked database/email operations. They do not load
the project's `.env`, mutate production records or send real messages. Browser
checks use fixture tournament data. No live MongoDB persistence, indexes, deployment
proxy/TLS configuration or end-to-end email delivery has been verified. A mocked
OTP concurrency test validates the handler's behavior; it is not a database load test.

## Remaining findings and limits

1. **Medium — capacity and reservations are not transactional.** Registration and
   squad-edit routes count available places before separately saving changes.
   Simultaneous requests can overbook. Reservations also do not provide a fully
   enforced, atomic capacity guarantee. Use database transactions or atomic inventory
   counters across reservation, registration, edit and cancellation operations;
   verify against the actual MongoDB deployment with concurrent requests.
2. **Medium — guest registration trusts the submitted email.** Guest entries can
   still be submitted for another person's mailbox and associated with their
   tournament history. Personal profile fields are now protected. Eliminating
   impersonated entries requires email verification for guest registration, which
   changes the existing product flow.
3. **Medium — rate limits are process-local.** Multiple server instances do not
   share counters, and OTP requests can replace a pending code. Shared counters and
   account-level resend cooldowns would strengthen resistance to distributed abuse.
4. **Maintenance — CSRF dependency and CSP.** `csurf` remains an older dependency.
   Plan a supported replacement with equivalent regression coverage. The new CSP
   restricts framing, objects and base URLs; it does not prohibit inline scripts,
   because the application still uses inline event handlers. Escaping is the primary
   XSS defense in this change.
5. **Coverage — tournament scoring and external services.** The tests do not prove
   every scoring format, carryover calculation, data migration, email-provider
   behavior or database hook under real data and concurrency. Validate these in a
   staging environment before claiming complete production readiness.

## Running and deployment notes

Use `npm start` to run normally and `npm run dev` for Node's native watcher.
Verification used Node 24.18.0. The browser check requires Windows Edge at its usual
path, or an explicit `EDGE_PATH`. Run `npm ci` to install the updated lockfile.
The lockfile already had local changes when this audit began; dependency changes
were applied to that working version.

Login now rotates sessions and CSRF tokens. Previously issued, unhashed OTP codes
will need to be requested again when the updated server is deployed. Production
requires a reachable `MONGO_URI`, a sufficiently strong `SECRET_KEY`, HTTPS and the
correct `TRUST_PROXY_HOPS`. The server now fails startup when MongoDB cannot connect.
Changes have not been deployed.

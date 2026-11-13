# AI integration instructions

Implement VisitPulse in the receiving application, using this pack as the API contract.

1. Read README.md and API.md. Inspect the application's entry points, routing, CSP and environment conventions before editing.
2. Obtain the target portal username, VisitPulse endpoint and website origins from application configuration or the owner. Do not silently route another customer's traffic to nielseninnovations. That username applies only to Nielsen Innovations.
3. Copy visitpulse-tracker.js into an appropriate source/public folder. It requires no npm package. Preserve privacy checks, failure isolation, credential omission and session fallback.
4. Configure endpoint and username through the framework's public environment mechanism. Add placeholders to its env example and describe required build/restart steps. Never expose secrets.
5. Instantiate once and call start() once for ordinary page loads. For SPAs implement completed-navigation tracking with no duplicate initial event or React StrictMode duplicate. Do not automatically track every render.
6. Keep consent and privacy controls intact. Paths and titles must not contain personal data; override with safe route templates if necessary.
7. Ensure the central VisitPulse operator has registered exact origins for this active username using VISITPULSE_SITES. This is a server deployment prerequisite, not something client code can grant. Do not weaken portal CORS or CSRF middleware.
8. Update connect-src only as needed. Run the application's build/checks, verify an accepted event in Network, and verify dashboard ownership with two accounts where a deployed test environment is available. Verify privacy opt-out and unavailable API do not break the page.
9. Report changed files, validation results and any remaining operator deployment steps. Do not claim a live database verification unless it was performed.

Do not implement a second database, invent credentials, add a login requirement for visitors, or introduce automatic POST retries (the API has no idempotency key).

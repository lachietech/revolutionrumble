# VisitPulse integration pack

Give this entire folder to an AI and ask it to follow `AI-INSTRUCTIONS.md`. The only runtime file to copy into another website is `visitpulse-tracker.js` (dependency-free browser ES module). Do not copy the VisitPulse backend into each website.

## How it works

Website page load -> JSON POST to VisitPulse -> registered origin and active username validated -> MongoDB `analytics_events` -> signed-in account's VisitPulse dashboard. The server resolves the username to a stable portal user ID, so accounts cannot read one another's reports. Administrators also see only their own analytics. Multiple websites can belong to one account; the dashboard includes a Websites ranking.

## 1. Register the website on the VisitPulse server

1. Create or identify an active Client Portal account. Its exact lowercase username is the tracking destination. This application uses `nielseninnovations`; the account must exist under that name.
2. Set `VISITPULSE_SITES` on the **VisitPulse backend**, using `backend.env.example`. Include every allowed website origin (scheme, hostname, optional port; no trailing slash/path). Apex and www are separate origins. Add local development origins explicitly.
3. Restart/deploy the backend. This setting replaces the default map, so retain existing websites when adding one. Do not add external tracker websites to `TRUSTED_ORIGINS`: that variable controls privileged portal APIs.
4. The defaults cover nielseninnovations.com and www.nielseninnovations.com, plus localhost/127.0.0.1 ports 5000 and 5173 outside production. No public registration endpoint or secret browser key is needed.

## 2. Integrate the client

Copy `visitpulse-tracker.js` into your source folder. For Vite, copy the values from `frontend.env.example` into the application's frontend `.env` and use:

```js
import { createVisitPulse } from './visitpulse-tracker.js';
const analytics = createVisitPulse({
  endpoint: import.meta.env.VITE_VISITPULSE_ENDPOINT,
  username: import.meta.env.VITE_VISITPULSE_USERNAME,
});
analytics.start();
```

Run this once in the browser entry point. `start()` sends one page view when load completes and ignores repeat calls on the same tracker instance. For plain HTML, use `example.html` with an ES module script. Host over HTTP(S), not file://. For other frameworks pass their public runtime/build configuration into the same two fields (e.g. Next.js NEXT_PUBLIC_*). These values are public configuration, never secrets. Rebuild after changing build-time environment values.

For a single-page application, call `analytics.trackPageView({path: location.pathname, title: document.title})` after each completed route change. Avoid recording the first route twice: use either `start()` plus subsequent navigation hooks, or only the router's initial/subsequent page-view hook. Create the tracker once outside React render/effects; account for StrictMode effect repetition. Hash routers must explicitly map the route to a slash-prefixed path. Only call tracking after your application's required consent decision. `enabled: false` disables an instance; create/start a new enabled instance after consent is granted.

Allow the API origin in the website's CSP `connect-src`. Requests omit cookies and need no CSRF roundtrip. Do not send account passwords, portal tokens, or database credentials. Do not put personal information in page paths/titles.

## 3. Verify

Deploy the backend before the updated frontend. With tracking permitted by the visitor's privacy settings, load a page and inspect Network: OPTIONS may return 204 and POST must return 202 with `{ "ok": true }`. Sign into the matching account and open `/clientportal/visitpulse`; refresh its report. A second account must not see the visit. Verify a route change separately for SPAs. Use `API.md` for curl and negative checks.

## Files

- `AI-INSTRUCTIONS.md`: implementation checklist for an AI agent.
- `visitpulse-tracker.js`: portable tracker, also used by this repository's frontend.
- `frontend.env.example` / `backend.env.example`: public client settings and server registration map.
- `example.html`: minimal working HTML integration.
- `API.md`: request/response contract, limits and troubleshooting.
- `OPERATIONS.md`: backend architecture, migration, validation and deployment notes.

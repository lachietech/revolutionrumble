# Revolution Rumble — MERN

Tournament management with MongoDB/Mongoose, Express, React, and Node.js. The React application replaces the former HTML pages and global browser scripts; existing MongoDB collections and API URLs remain in use.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended), npm, and a reachable MongoDB database.

```sh
npm ci
# Create .env from .env.example and set your own values.
npm run dev
```

Open **http://localhost:5000** (or your configured `PORT`). Express hosts the API and Vite development middleware on the same origin, including hot reload. Restart `npm run dev` if an older server is already running. No separate frontend server or CORS configuration is needed.

The development command watches only `backend/` and `shared/` for server restarts. Vite handles frontend changes itself; watching Vite's generated dependency files with Node would cause a restart loop. Restart the command after changing `vite.config.js` or environment settings.

## Production

```sh
npm ci
npm run build
# Set NODE_ENV=production in your hosting environment.
npm start
```

The server serves `dist/` and the retained assets in `frontend/static/`. Include both directories and `backend/` plus `shared/` in the deployed application. Set a random `SECRET_KEY` of at least 32 characters. Production requires HTTPS because session cookies are secure. Configure `TRUST_PROXY_HOPS` only for the actual number of trusted reverse proxies. Do not set it to trust arbitrary clients.

## Pages and workflows

- Home, searchable events, individual event details, squad lists, stage results, and public player statistics.
- Registration with squad selection, a timed reservation, validation, and confirmation/payment instructions.
- Bowler Hub with email-code login, profile editing, entry management, squad changes, cancellation, and tournament history.
- Admin email-code login, tournament and squad editing, all five stage types, registration/payment management, CSV export, scoring, advancement, and confirmation-email editing with a sandboxed preview.
- Former `.html` URLs and player-stat aliases redirect to the React routes. Admin routes and APIs retain server-side access checks.

Dates are displayed in Australia/Brisbane. Tournament editor dates and times are interpreted in that timezone. Existing database schemas and records are preserved; no data migration, seed, or database reset is required. The confirmation-email transport and OTP provider settings are unchanged.

## Verification

```sh
npm test              # JavaScript checks, production build, security and scoring tests
npm run test:browser  # Desktop/mobile Edge checks and fixture-backed user workflows
```

Browser checks require Microsoft Edge on Windows; set `EDGE_PATH` to use another Chromium executable. Tests use in-memory fixtures, never load `.env`, never connect to a real MongoDB server, and stub outbound mail. They produce ignored `qa-home-1440.png` and `qa-home-390.png` screenshots. These checks do not verify delivery through the live mail providers or writes to a deployed database.

Score entry preserves zero-pin games and rejects gaps before later games. Clearing a row clears its saved scores. Advancement runs on the server, checks that the field is complete, rejects ties at the cut, honours zero-percent carryover, and advances one stage at a time. Multi-match formats retain the existing scoring model: administrators record the game outcomes and bonuses. Squad capacity checks retain the existing database concurrency model; they are not a transactional booking system.

## Source map

- `frontend/src/pages/` — React pages and workflow forms.
- `frontend/src/components.jsx`, `styles.css` — shared interface and responsive styling.
- `frontend/src/api.js` — same-origin API client with CSRF/session handling.
- `backend/frontend.js` — Vite integration, production assets, legacy redirects.
- `backend/routes/`, `models/` — Express endpoints and Mongoose persistence.
- `shared/scoring.js` — shared stage draws and score totals.
- `tests/`, `scripts/check-browser.js` — automated regression coverage.

The React/Vite integration follows the [React build-tool guidance](https://react.dev/learn/build-a-react-app-from-scratch) and [Vite backend integration guidance](https://vite.dev/guide/backend-integration).

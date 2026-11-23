# Architecture

Folio is one small Node.js process with one SQLite file. There is no framework, no build server and no external service: the browser code, styles, fonts and images are bundled into a single server module at build time, and every account's records are one JSON document.

```
Browser (public/*.js)                       Node.js 24 (scripts/serve.mjs)                SQLite (FOLIO_DB_PATH)
┌────────────────────────┐   HTTPS via a    ┌────────────────────────────────────┐        ┌──────────────────────┐
│ auth.js  sign-in,      │   reverse proxy  │ serve.mjs  Node HTTP → fetch()     │        │ folio_accounts       │
│          passkeys      │ ───────────────► │ server/index.js  the request       │ ─────► │   workspace (JSON),  │
│ app.js   the workspace │                  │   handler: assets, /api/*, auth,   │        │   revision           │
│ investments.js         │ ◄─────────────── │   sessions, passkeys, rate limits  │        │ folio_sessions       │
└────────────────────────┘   JSON + cookie  │ scripts/sqlite.mjs  DB interface   │        │ folio_passkeys       │
                                            │ scripts/database.mjs  migrations   │        │ folio_challenges     │
                                            └────────────────────────────────────┘        │ folio_auth_limits    │
                                                                                          └──────────────────────┘
```

## Source map

| Path | What it is |
| --- | --- |
| `scripts/serve.mjs` | Entry point. Validates `FOLIO_ORIGIN` and `PORT`, opens the database, turns each Node HTTP request into a standard `Request`, calls the handler, writes the `Response` back with a `Content-Length`. Listens on `FOLIO_HOST` (127.0.0.1 by default). Overwrites the client IP from `X-Folio-Client-IP` only. |
| `server/index.js` | The request handler (`export default { fetch(request, env) }`). Serves the bundled assets and the JSON API: sign-in, sessions, password change, passkeys, workspace load and save. Sets the security headers on every response. |
| `server/password.js` | Argon2id password hashing (`@noble/hashes`, m=19456 KiB, t=2, p=1), constant-time comparison, random tokens, base64url helpers, SHA-256 fingerprints. |
| `server/workspace-schema.js` | `admissibleWorkspace()`: the server-side shape check for a workspace before it is stored. |
| `scripts/database.mjs` | Opens SQLite (WAL, foreign keys, busy timeout) and applies `drizzle/*.sql` in order inside one transaction, recording each file's SHA-256. Refuses to start if an applied migration was edited. |
| `scripts/sqlite.mjs` | A small D1-style adapter over `node:sqlite` (`prepare().bind().first()/all()/run()`, `batch()` in a transaction), so the handler doesn't depend on the driver. |
| `scripts/account.mjs` | Creates an account with a random temporary password (printed once); the user must change it on first sign-in. |
| `scripts/build.mjs` | esbuild: bundles `server/index.js` with the HTML, CSS, fonts and images as embedded strings or bytes into `dist/server/index.js`, and bundles `public/auth.js` with `@simplewebauthn/browser`. |
| `public/index.html` | The single page: sign-in screens plus the app shell. |
| `public/auth.js` | Session check, sign-in with password or passkey, forced password change, passkey management; loads `investments.js` and `app.js` after sign-in. Exposes `window.Folio.api()` for JSON calls. |
| `public/app.js` | The workspace UI: hash routes (`#overview`, `#transactions`, `#budgets`, `#debts`, `#subscriptions`, `#goals`, `#currency`, `#investments`), forms and dialogs, charts, reminders, export and import, and `save()`. |
| `public/balance.js` | Pure tracked-cash and correction-delta calculations shared by the browser UI and focused tests. |
| `public/investments.js` | Holdings, buy/sell/income activity, cost basis, realized and unrealized gains, allocation. |
| `public/style.css` | All styles; dark theme, mobile layout under 780 px, iPhone safe-area padding. |
| `drizzle/` | SQL migrations, applied on start. Append new files; never edit an applied one. |
| `install.sh`, `install.ps1` | One-command installers (Docker or native; Windows with Docker Desktop). |
| `test/` | End-to-end tests with `node:test` against the real server. |

## Request flow

1. The reverse proxy terminates HTTPS and forwards to `127.0.0.1:PORT`, setting `X-Folio-Client-IP`.
2. `serve.mjs` rejects malformed paths, builds a `Request` and calls `server/index.js`.
3. Paths outside `/api/` are looked up in the asset map (`/`, scripts, CSS, font, images, icons, manifest). Anything else is a 404.
4. For `/api/*`, every non-GET request must carry `Origin` equal to `FOLIO_ORIGIN` (cross-site request protection), then the route runs.
5. The handler returns JSON with the security headers; `serve.mjs` sends it with an exact `Content-Length`.

## Data model

Each account row holds the whole workspace as one JSON document plus a `revision` counter.

```jsonc
{
  "version": 1, "demo": false, "currency": "IDR", "reportRate": 1, "reportDate": "",
  "assetCategories": [{ "id", "name", "type": "bank|cash|emoney|crypto|stock|investment|other" }],
  "assetGroups":     [{ "id", "categoryId", "name" }],
  "unassignedCashAssignment": { "categoryId", "groupId?" },
  "accounts":      [{ "id", "name", "type": "bank|emoney|cash|other", "categoryId?", "groupId?" }],
  "transactions":  [{ "id", "date", "type": "income|expense", "title", "amount", "currency", "rate", "account", "accountId?", "category", "note", "balanceAdjustment?": true }],
  "budgets":       [{ "id", "title", "category", "amount", "currency", "rate" }],
  "debts":         [{ "id", "title", "source", "direction": "owe|owed", "amount", "due", "lead", "payments": [{ "date", "amount" }] }],
  "subscriptions": [{ "id", "title", "amount", "cycle": "weekly|monthly|yearly", "due", "status": "active|paused", "lead" }],
  "goals":         [{ "id", "title", "amount", "due", "contributions": [{ "date", "amount" }] }],
  "investments":   [{ "id", "name", "symbol", "kind", "account", "currency", "categoryId?", "groupId?", "mark": { "date", "price", "rate" }, "activity": [{ "type": "buy|sell|income", "date", "quantity", "price", "fee", "rate" }] }]
}
```

`rate` converts an entry's own currency to IDR; `currency` and `reportRate` select the global display currency. Optional categories and subcategories organize liquid accounts and investment holdings without changing their calculations. Liquid account balances are derived from transactions linked by `accountId`; there is no second editable balance. Existing unlinked transactions remain part of total liquid cash. A transaction with `balanceAdjustment: true` is a dated opening-balance or correction record: it changes tracked cash but is excluded from operational income, expense, budget, spending and cash-flow reporting. A directly entered stock or cryptocurrency position value is represented as one synthetic unit with a matching valuation, so later edits still use the normal holding model. All new hierarchy fields are optional, so existing version-1 workspaces and backups remain valid without a migration. Total tracked value combines liquid cash with priced investment holdings at presentation time. `docs/demo/demo-workspace.json` is a complete example.

**Saving.** The browser sends `{ workspace, revision }`. The server stores it only if `revision` matches the stored value, then increments it (`UPDATE … WHERE revision = ?`). A stale tab gets `409` and must reload, so two windows can't silently overwrite each other. The JSON is capped at 1 MB and checked by `admissibleWorkspace()`; the browser runs a stricter `validBackup()` on imports.

`unassignedCashAssignment` places the aggregate balance of transactions without an `accountId` in a managed category or subcategory. It changes presentation only and never rewrites the original transactions.

## Security model

- **Passwords:** Argon2id with a random 16-byte salt per password; comparison in constant time. Temporary passwords are 18 random bytes and must be changed before the workspace opens (`must_change`).
- **Sessions:** a random 32-byte token in a `__Host-folio_session` cookie (`HttpOnly; Secure; SameSite=Strict`, 12 hours). Only its SHA-256 is stored. Changing the password bumps `auth_epoch`, which invalidates every other session at once.
- **Passkeys (WebAuthn):** user verification required, resident keys, up to 10 per account. Sign-in is discoverable: the authenticator offers matching Folio credentials and the chosen credential resolves the account without an email. Challenges are single-use, expire after 5 minutes and, for enrolment, are bound to the authenticated session. Adding a passkey uses session authentication plus device user verification; removing one requires the current password. Passkeys are bound to the hostname in `FOLIO_ORIGIN`.
- **Rate limits:** sign-in, passkey, password-change, enrol and remove attempts are counted per IP and per IP+account in 10-minute windows (`folio_auth_limits`), answering `429` when exceeded.
- **Cross-site requests:** writes need the exact `Origin`; cookies are `SameSite=Strict`.
- **Headers:** a strict Content Security Policy (`default-src 'none'`, scripts and styles from self only, `connect-src` self plus the optional Frankfurter rate API), `no-store` caching for pages and API, `nosniff`, `no-referrer`, and a Permissions-Policy that allows only WebAuthn.
- **Network:** the server listens on loopback; the Docker image publishes on the host's 127.0.0.1 only. HTTPS belongs to the reverse proxy.
- **Files:** the process runs with `umask 077`; the database folder is created with mode 700.

## Build and release

`npm run build` writes `dist/server/index.js`. CI (`.github/workflows/ci.yml`) runs syntax checks, the build, the end-to-end tests, `npm audit`, ShellCheck, a PowerShell parse, native installs on Ubuntu and macOS, and the Docker image with the installer. A `vX.Y.Z` tag runs `.github/workflows/release.yml`: the same gates, a version and changelog check, the multi-arch image on GHCR, a smoke test of that image, and the GitHub release. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Design choices

- **One JSON document per account** keeps backups, imports and conflict checks simple; a workspace is small enough (1 MB cap) to load and save whole.
- **No framework** keeps the attack surface and the dependency list short: three runtime dependencies (`@noble/hashes`, `@simplewebauthn/server`, `@simplewebauthn/browser`).
- **Assets compiled into the server** means one file to run and no static folder to misconfigure.

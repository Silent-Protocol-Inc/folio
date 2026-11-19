# Folio project instructions

## Scope

This checkout runs Folio on Node.js 24+ with SQLite. Keep changes compatible with a single long-running process behind an HTTPS reverse proxy. Keep API and browser feature changes small and preserve support for previously exported workspace backups.

## Layout

- `public/` holds the HTML, CSS, images, and browser code.
- `server/` holds the shared request handler, authentication, and workspace validation.
- `scripts/serve.mjs` adapts Node HTTP requests to the application handler.
- `scripts/database.mjs` opens the SQLite database and applies migrations. `scripts/sqlite.mjs` implements the database interface used by the request handler.
- `scripts/account.mjs` provisions accounts locally. `drizzle/` holds the SQL migrations.
- `deploy/` contains reverse-proxy and service examples.

## Working locally

Copy `.env.example` to `.env`, choose a local loopback origin, then run `npm ci`, `npm run build`, and `npm start`. Use a separate database and generated test account for verification. Build output lives in `dist/` and is generated from source.

## Invariants

- Keep runtime secrets, actual financial records, password provisioning output, `.env`, and database files out of commits and archives.
- Keep Folio's HTTP listener on loopback. Preserve HTTPS, secure session cookies, origin checks, and the account scope for workspace and passkey operations.
- Do not edit applied migrations. Append a migration when the schema changes.
- Keep workspace revisions and conflict checks intact when changing the save path.
- Verify touched workflows with test accounts, and check that any storage changes survive a restart. Build and check the exact source included in any release package.

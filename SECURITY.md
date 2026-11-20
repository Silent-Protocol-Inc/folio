# Security policy

Folio holds personal financial records, so security reports get priority.

## Reporting a vulnerability

Email **team@silentprotocol.top** with:

- what you found and where (file, endpoint or screen),
- steps to reproduce it,
- the version or commit you tested.

Please don't open a public issue for security problems. We aim to reply within 3 working days and will tell you when a fix is released.

## Supported versions

Security fixes go into the latest release. Run the newest version: `docker compose pull && docker compose up -d`.

## Running Folio safely

- Serve it only over HTTPS, behind a reverse proxy; the app port stays on 127.0.0.1.
- Keep `.env` and the `data/` folder private (the installer creates them with owner-only permissions).
- Back up the database and keep a copy off the server; see `deploy/backup.sh`.

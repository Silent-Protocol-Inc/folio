# Changelog

## 1.0.0 (2026-11-20)

First open-source release.

- Personal finance workspace: transactions, budgets, debts, subscriptions, savings goals and investments.
- Accounts with password and passkey sign-in; one private workspace per account; JSON export and import.
- Standalone Node.js 24 server with SQLite (WAL), loopback-only listener behind an HTTPS reverse proxy.
- Docker image and Compose file; data kept in `FOLIO_DATA_DIR` outside the image.
- Home-screen app: web app manifest, Apple touch icon and 192/512 px icons; responses carry Content-Length and icons are cacheable so iOS shows the real icon.
- `deploy/backup.sh` for checked daily online backups.
- Licensed under Apache-2.0.

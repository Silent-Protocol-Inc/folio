# Changelog

## 1.1.0 (2026-11-20)

- One-command install: `curl -fsSL https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.sh | bash` sets up Docker, starts Folio and creates the first account.
- Prebuilt Docker image for amd64 and arm64 on GitHub Container Registry, built on every release tag.
- Docker runs on Linux, macOS and Windows: the container listens on `FOLIO_HOST=0.0.0.0` and publishes the port on the host's 127.0.0.1 only; it runs as the owner of the data folder (`FOLIO_UID`/`FOLIO_GID`).
- Home-screen app on iPhones with a notch or Dynamic Island: the top bar, sidebar and sign-in header stay below the status bar.
- Sample workspace (`docs/demo/demo-workspace.json`) to try Folio, and screenshots in the README.
- New README with badges, screenshots, configuration table and install options; `SECURITY.md` with a contact address for security reports.

## 1.0.0 (2026-11-20)

First open-source release.

- Personal finance workspace: transactions, budgets, debts, subscriptions, savings goals and investments.
- Accounts with password and passkey sign-in; one private workspace per account; JSON export and import.
- Standalone Node.js 24 server with SQLite (WAL), loopback-only listener behind an HTTPS reverse proxy.
- Docker image and Compose file; data kept in `FOLIO_DATA_DIR` outside the image.
- Home-screen app: web app manifest, Apple touch icon and 192/512 px icons; responses carry Content-Length and icons are cacheable so iOS shows the real icon.
- `deploy/backup.sh` for checked daily online backups.
- Licensed under Apache-2.0.

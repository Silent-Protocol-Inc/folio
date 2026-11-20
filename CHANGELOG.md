# Changelog

## Unreleased

## 1.2.0 (2026-11-20)

- Opening balances: set the money already on hand from the overview or Settings without recording it as income.
- Auditable balance corrections: enter the actual balance and effective date; Folio records only the difference in Transactions, where it can be reviewed, edited or deleted.
- Reporting stays accurate: balance corrections affect tracked cash but are excluded from income, expenses, budgets, spending breakdowns and cash-flow charts.
- Backward-compatible workspace data: existing version-1 workspaces and backups need no migration; JSON export/import preserves the optional adjustment marker.
- Documentation for contributors: `docs/ARCHITECTURE.md` (source map, request flow, data model, security model), `docs/API.md` (every endpoint), Code of Conduct (Contributor Covenant 2.1), `SUPPORT.md`, `CODEOWNERS`, a fuller `CONTRIBUTING.md`, and a header comment on every source file.

## 1.1.0 (2026-11-20)

- One-command install: `curl -fsSL https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.sh | bash` sets up Docker, starts Folio and creates the first account.
- Installs everywhere: `install.sh` for Linux, macOS and Android (Termux) uses Docker when present and otherwise installs natively with Node.js 24 (a `folio` control command: start, stop, status, logs, add-user, update); `install.ps1` for Windows with Docker Desktop.
- CI/CD: every pull request runs syntax checks, the build, end-to-end tests, a dependency audit, ShellCheck, a PowerShell parse, native installs on Ubuntu and macOS, and the Docker image with the installer. Tags run the same gates, check the version and changelog, publish the image, smoke-test it and create the GitHub release. Dependabot, issue and PR templates, CONTRIBUTING.md.
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

# Changelog

## Unreleased

## 1.5.0 (2026-11-23)

- Overview now calls the total **Account balance**, shows balanced category cards at tablet widths, and adds a review-before-apply AI financial-plan panel.
- Owners can create workspace accounts and assign owner/member roles from Security; the last owner is protected from demotion.
- AI planning reads aggregate transaction, budget, debt, subscription, goal, and investment figures only when the user chooses Codex or Claude. Applying a proposal creates or updates only the proposed budgets.

## 1.4.2 (2026-11-23)

- Manage Structure can assign aggregate unassigned cash to any managed category and optional subcategory without rewriting legacy transactions.
- Assigned categories and subcategories cannot be deleted until unassigned cash is moved or returned to automatic grouping.
- Existing workspaces remain valid and continue using the automatic Cash category until an assignment is saved.

## 1.4.1 (2026-11-23)

- Docker deployments built from owner-only checkouts now assign application files to the unprivileged runtime user, preventing a startup crash when the host uses `umask 077`.

## 1.4.0 (2026-11-23)

- Asset hierarchy: create, rename, and remove optional categories and subcategories for banks, cash, e-wallets, exchanges, brokers, stocks, cryptocurrency, and other holdings.
- Grouped overview: the tracked cash balance now shows each source under its category and optional provider subcategory while preserving one global-currency total.
- Flexible positions: stocks and cryptocurrency can start from either asset quantity plus unit price or a total position value in the reporting currency.
- Passkey enrollment no longer asks for the current password; authenticated sessions use device user verification, and discoverable sign-in is independent of the email and password fields.
- Backward compatibility: existing workspaces without category or subcategory references continue to load and receive automatic grouping.

## 1.3.0 (2026-11-23)

- Tracked assets: create bank, e-money, cash, or other liquid sources; balances derive from linked transactions and auditable corrections.
- Total tracked value: one dashboard total combines liquid balances with priced stocks, crypto, funds, and other existing investment holdings in the global reporting currency.
- Source breakdown: the overview identifies every liquid source and open investment by category and type without duplicating portfolio data.
- Transaction ordering: sort all matching transactions by date, value, or name in ascending or descending order.
- Dashboard privacy: the eye control masks the total and source values and remembers the choice on that browser.
- Passkey parity: discoverable passkeys now sign in without an email, matching the TableTap console flow while retaining required user verification and hostname binding.
- Backward compatibility: version-1 workspaces and backups without liquid accounts or account links remain valid.

## 1.2.1 (2026-11-20)

- iPhone home-screen app: the status bar is now solid and the header sits 12 px lower, so the logo and buttons stay clear of the notch and nothing scrolls behind the clock. Remove Folio from the home screen and add it again to pick up the change.
- Transactions page: removed the second "Add transaction" button; the one in the top bar stays on every page.

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

# HTTP API

Folio's browser code talks to the server with JSON over HTTPS. The API is internal: it can change between versions. Use it to build tools for your own instance, and pin the Folio version you test against.

## Conventions

- **Base:** your `FOLIO_ORIGIN`, for example `https://folio.example.com`.
- **Body:** requests with a body send `Content-Type: application/json`. Most bodies are capped at 8 KB; the workspace at 1 MB.
- **Origin:** every request except `GET` must carry `Origin: <FOLIO_ORIGIN>` exactly, or it is rejected with `403`.
- **Session:** signing in sets the cookie `__Host-folio_session` (`HttpOnly; Secure; SameSite=Strict`, 12 hours). Send it back on later calls.
- **Errors:** `{ "error": "Message for people." }` with the status code below.

| Status | Meaning |
| --- | --- |
| `400` | Invalid input |
| `401` | Wrong credentials, expired challenge, or not signed in |
| `403` | Wrong `Origin`, or the temporary password must be changed first |
| `409` | Conflict: the workspace or a passkey changed meanwhile |
| `413` / `415` | Body too large / not JSON |
| `429` | Too many attempts; wait a few minutes |
| `503` | Storage unavailable |

## Session

### `GET /api/session`

Who is signed in. Works without a session.

```json
{ "user": { "email": "you@example.com", "role": "owner", "mustChange": false } }
```

`user` is `null` when signed out. `mustChange: true` means only `/api/password` and `/api/logout` are allowed until the password is changed.

### `POST /api/login`

```json
{ "email": "you@example.com", "password": "…" }
```

`200` with the same body as `/api/session` and the session cookie. `401` for any wrong email or password (the message doesn't say which). Rate limited per IP and per account.

### `POST /api/logout`

Ends this session and clears the cookie. `{ "ok": true }`.

### `POST /api/password`

```json
{ "currentPassword": "…", "newPassword": "at least 8 characters" }
```

Clears `mustChange`, signs out every other session, and returns a fresh session cookie.

## Workspace

Requires a session whose password is not temporary.

### `GET /api/workspace`

```json
{ "workspace": { "version": 1, "...": "..." }, "revision": 4 }
```

`workspace` is `null` for a new account. The format is in [ARCHITECTURE.md](ARCHITECTURE.md#data-model).

### `PUT /api/workspace`

```json
{ "revision": 4, "workspace": { "version": 1, "demo": false, "currency": "IDR", "...": "..." } }
```

Saves only if `revision` matches the stored one; returns `{ "revision": 5 }`. A stale revision returns `409`: reload, then save again. An invalid workspace returns `400`.

## AI financial plan

### `POST /api/advice`

`{ "provider": "codex" }` or `{ "provider": "claude" }` generates an educational proposal from aggregate saved-workspace figures: transaction totals by expense category, budgets, debts, active subscriptions, goal progress, and investment valuations. It never writes the workspace. The browser shows the proposal and must receive an explicit user action before it writes the returned budget actions. Codex requests use `store: false`; provider API keys and model names are server-only environment variables.

## Workspace accounts

Only an `owner` may use these endpoints. Every account has a separate private workspace.

### `GET /api/accounts`

Lists account email, role, temporary-password status, and workspace revision.

### `POST /api/accounts`

`{ "email": "member@example.com", "role": "member", "password": "owner current password" }` creates an account and returns its one-time temporary password.

### `PUT /api/accounts/:id`

`{ "role": "owner", "password": "owner current password" }` changes an account role. Folio keeps at least one owner.

## Passkeys

Passkeys use WebAuthn through `@simplewebauthn`. Each flow has two calls: get options (a single-use challenge, valid 5 minutes), then send the browser's response.

### `POST /api/passkeys/login/options`

`{}` → `{ "id": "challenge id", "options": { … } }`. The passkey is discoverable: the device presents matching Folio credentials and the selected credential identifies the account, so no email is required.

### `POST /api/passkeys/login/verify`

`{ "id": "challenge id", "response": { … } }` → session cookie and `{ "user": { … } }`. Accounts with a temporary password can't sign in with a passkey.

### `GET /api/passkeys`

`{ "passkeys": [{ "id", "name", "created", "used" }] }` (times in Unix seconds).

### `POST /api/passkeys/enroll/options`

`{}` → `{ "id", "options" }`. Requires an authenticated session; the authenticator must verify the user. Up to 10 passkeys per account.

### `POST /api/passkeys/enroll/verify`

`{ "id": "challenge id", "name": "iPhone", "response": { … } }` → `{ "ok": true }`.

### `POST /api/passkeys/remove`

`{ "id": "credential id", "password": "current password" }` → `{ "ok": true }`.

## Static files

`GET /` (the app), `/auth.js`, `/app.js`, `/investments.js`, `/style.css`, `/geist.woff2`, `/folio-art.webp`, `/mark.svg`, `/manifest.webmanifest`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`, `/icon-192.png`, `/icon-512.png`, `/favicon.ico`. Icons and the manifest are cacheable for a day; everything else is `no-store`. Every other path returns `404`.

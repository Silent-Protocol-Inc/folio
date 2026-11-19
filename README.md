# Folio on a VPS

Folio is a personal finance tracker for transactions, budgets, debts, subscriptions, savings goals, and investments. This package contains the application source and a standalone Node.js server with persistent SQLite. It runs independently of ChatGPT Sites. It starts with an empty database and no default accounts.

## Requirements

- Linux VPS with Node.js **24 or newer** and npm.
- A hostname for Folio, such as `folio.example.com`, with HTTPS terminated by a reverse proxy.
- A dedicated OS user for the service and a writable directory for the database.
- Internet access during the dependency install. The currency converter can contact Frankfurter from the browser at runtime.

## First run

Extract the archive and run the commands below from `folio-vps/` as the account that will run Folio.

```sh
cp .env.example .env
chmod 600 .env

# Edit .env before continuing, then run:
npm ci
npm run build
npm run account:add -- owner@example.com
npm start
```

Set `FOLIO_ORIGIN` in `.env` to your exact public HTTPS origin, for example `https://folio.example.com`, without a trailing slash or path. Change `PORT` if port 4173 is already in use, and use the same port in the proxy. Use an absolute `FOLIO_DB_PATH` to keep the database outside the release directory if you plan to replace that directory during upgrades.

The account command prints a randomly generated temporary password once. Use it to sign in and choose a new password of at least eight characters. Run the account command again to add another user. Each user gets an empty workspace.

`npm start` listens on `127.0.0.1` only. For a local test on the same machine, set `FOLIO_ORIGIN=http://localhost:4173` and visit that origin. Use HTTPS for a remote deployment. Set the final hostname before enrolling passkeys, since credentials are scoped to the hostname where they were created.

## HTTPS reverse proxy

`deploy/Caddyfile.example` is ready to adapt. Point your DNS record at the VPS, copy the site block into your Caddy configuration, replace the hostname, and reload Caddy. For a direct public deployment, allow inbound TCP 80 and 443 to Caddy. Folio's application port stays on loopback.

If you already use Nginx, add these directives inside the HTTPS virtual host for Folio:

```nginx
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $host;
    proxy_set_header X-Folio-Client-IP $remote_addr;
}
```

The proxy must overwrite `X-Folio-Client-IP` with the peer address it trusts. If another proxy sits in front, configure your reverse proxy's trusted-proxy settings before forwarding a real client IP. Leave the browser's `Origin` header intact. The Node server uses it to validate write requests.

## Run as a service

The example unit assumes `/opt/folio`, a dedicated `folio` user/group, and Node at `/usr/bin/node`.

1. Put the project in `/opt/folio`. Give the service user permission to read the project and `.env` and write the database directory.
2. Run the first-run build and account commands with the same service user and `.env` the service will use.
3. Edit paths in `deploy/folio.service.example` to match your server. If you installed Node elsewhere, use its full executable path in `ExecStart`.
4. Install and start the unit.

```sh
sudo install -m 644 deploy/folio.service.example /etc/systemd/system/folio.service
sudo systemctl daemon-reload
sudo systemctl enable --now folio
sudo journalctl -u folio -n 50 --no-pager
```

After HTTPS is working, open the site and confirm you see the login screen. Sign in, change the temporary password, and enroll a new passkey under **Settings → Security** if desired.

## Move existing data

Export a JSON backup from **Settings → Export backup** in the current Folio account. Create the matching account on the VPS, sign in, and restore via **Settings → Import backup**. Import replaces the destination account's workspace. Passwords, sessions, and passkeys do not travel with a workspace backup.

## Backups and upgrades

- An app-level JSON backup covers one workspace. For a full instance backup, use SQLite's online backup command with the actual database path, such as `sqlite3 /var/lib/folio/folio.sqlite '.backup /secure/backups/folio.sqlite'`. Protect the resulting file because it includes financial records and authentication data. Keep a backup outside the VPS.
- SQLite runs in WAL mode. Use the SQLite backup command for a live database. For an offline restore, stop the service, move the prior database and any `-wal` and `-shm` sidecars aside, install the backup at `FOLIO_DB_PATH` with the correct owner and permissions, and restart.
- Before an upgrade, back up the database. Keep `.env` and the database, run `npm ci && npm run build` in the new release, and restart. The server applies pending SQL migrations on startup. Check the service logs, then sign in and verify your workspace.

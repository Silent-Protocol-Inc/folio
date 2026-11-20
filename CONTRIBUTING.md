# Contributing to Folio

Thanks for helping. Folio holds people's financial records, so changes stay small, tested and backwards compatible.

## Develop

Needs Node.js 24.

```sh
npm ci
cp .env.example .env          # FOLIO_ORIGIN=http://localhost:4173, FOLIO_DB_PATH=./data/folio.sqlite
npm run build
npm run account:add -- you@example.com
npm start                      # http://localhost:4173
```

Before opening a pull request:

```sh
npm run check    # syntax of every source file
npm run build
npm test         # end-to-end: real server, throwaway SQLite, sign-in, password change, workspace save
```

Rules that keep users safe:

- Never commit `.env`, database files, real financial data or credentials.
- Keep old workspace backups importable. Schema changes go in a new file in `drizzle/`; never edit an applied migration.
- Keep the HTTP listener on loopback by default, session cookies secure and the Origin check on writes.
- Keep workspace revisions and the conflict check on saves.

## Pipeline

```
pull request ──► CI ─┬─ check, build, end-to-end tests, npm audit
                     ├─ ShellCheck install.sh, parse install.ps1
                     ├─ native install on Ubuntu and macOS
                     └─ Docker build + install.sh in Docker mode
                          │  all green + review
                          ▼
                     merge to main ──► CI again
                          │
              tag vX.Y.Z  ▼
                     Release ─► CI gates ─► tag = package.json, CHANGELOG has the section
                              ─► image to ghcr.io (amd64, arm64): X.Y.Z, X.Y, latest
                              ─► smoke test of the published image
                              ─► GitHub release with notes and source zip
```

`main` is protected: changes arrive by pull request with CI passing.

## Release (maintainers)

1. On a branch, bump `version` in `package.json` and add a `## X.Y.Z (date)` section at the top of `CHANGELOG.md`.
2. Open a pull request, wait for CI, merge.
3. Tag the merge commit and push the tag:

   ```sh
   git checkout main && git pull
   git tag -a vX.Y.Z -m "Folio X.Y.Z" && git push origin vX.Y.Z
   ```

4. The Release workflow publishes the image and the GitHub release. If a step fails, nothing is released; fix it in a new version.

Rollback: users pin the previous image with `FOLIO_IMAGE=ghcr.io/silent-protocol-inc/folio:<previous>` and run `docker compose up -d`, or reinstall natively with `FOLIO_VERSION=v<previous>`.

## Contact

Questions: open an issue. Security: see [SECURITY.md](SECURITY.md).

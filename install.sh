#!/usr/bin/env bash
# Folio one-command install (Docker).
#   curl -fsSL https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.sh | bash
# Optional, to skip the questions: FOLIO_DIR, FOLIO_ORIGIN, FOLIO_PORT, FOLIO_EMAIL, FOLIO_IMAGE.
set -euo pipefail

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
ask() { # ask VAR "Question" default — reads from the terminal even when the script is piped into bash
  local var=$1 question=$2 default=$3 answer=""
  if [ -n "${!var:-}" ]; then return; fi
  if [ -r /dev/tty ]; then read -r -p "$question [$default]: " answer < /dev/tty || true; fi
  printf -v "$var" '%s' "${answer:-$default}"
}

command -v docker >/dev/null || fail "Docker is required. Install it from https://docs.docker.com/get-docker/ and run this again."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required (the 'docker compose' command)."
docker info >/dev/null 2>&1 || fail "Docker is installed but not reachable. Start Docker, or run this as a user in the docker group."

say "Folio installer"
ask FOLIO_DIR "Install folder" "$HOME/folio"
ask FOLIO_PORT "Port on this machine (127.0.0.1 only)" "4173"
ask FOLIO_ORIGIN "Address you will open Folio at (https://folio.example.com, or http://localhost:PORT to try it here)" "http://localhost:${FOLIO_PORT}"
FOLIO_IMAGE=${FOLIO_IMAGE:-ghcr.io/silent-protocol-inc/folio:latest}

case "$FOLIO_ORIGIN" in
  https://*|http://localhost:*|http://127.0.0.1:*) ;;
  *) fail "The address must start with https:// (or be http://localhost:PORT for a local try)." ;;
esac
FOLIO_ORIGIN=${FOLIO_ORIGIN%/}

mkdir -p "$FOLIO_DIR/data"
cd "$FOLIO_DIR"
# The container runs as the owner of ./data (uid 1000, the image's node user, when installing as root).
if [ "$(id -u)" = 0 ]; then chown 1000:1000 data; uid=1000 gid=1000; else uid=$(id -u) gid=$(id -g); fi
umask 077
if [ -f .env ]; then
  say "Keeping the existing $FOLIO_DIR/.env"
else
  printf 'FOLIO_ORIGIN=%s\nPORT=%s\nFOLIO_UID=%s\nFOLIO_GID=%s\n' "$FOLIO_ORIGIN" "$FOLIO_PORT" "$uid" "$gid" > .env
fi
umask 022
cat > docker-compose.yml <<EOF
# Written by the Folio installer. Data lives in ./data; the app is published on 127.0.0.1 only.
services:
  folio:
    image: ${FOLIO_IMAGE}
    env_file: .env
    user: "\${FOLIO_UID:-1000}:\${FOLIO_GID:-1000}"
    environment:
      FOLIO_HOST: 0.0.0.0
      FOLIO_DB_PATH: /data/folio.sqlite
    ports:
      - "127.0.0.1:\${PORT}:\${PORT}"
    volumes:
      - ./data:/data
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    restart: unless-stopped
EOF

say "Starting Folio"
if [[ "$FOLIO_IMAGE" == */* ]]; then docker compose pull --quiet; fi
docker compose up -d
port=$(sed -n 's/^PORT=//p' .env)
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://127.0.0.1:${port}/api/session" 2>/dev/null && break
  sleep 1
done
curl -fsS -o /dev/null "http://127.0.0.1:${port}/api/session" || fail "Folio did not start. See: docker compose -f $FOLIO_DIR/docker-compose.yml logs"

ask FOLIO_EMAIL "Email for your Folio account (leave empty to add one later)" ""
if [ -n "$FOLIO_EMAIL" ]; then
  docker compose exec -T folio node scripts/account.mjs "$FOLIO_EMAIL"
fi

origin=$(sed -n 's/^FOLIO_ORIGIN=//p' .env)
say "Folio is running."
echo "  Open:          $origin"
echo "  Add a user:    cd $FOLIO_DIR && docker compose exec folio node scripts/account.mjs you@example.com"
echo "  Update:        cd $FOLIO_DIR && docker compose pull && docker compose up -d"
echo "  Stop:          cd $FOLIO_DIR && docker compose down    (your data stays in $FOLIO_DIR/data)"
case "$origin" in
  https://*) echo "  HTTPS:         point a reverse proxy at 127.0.0.1:${port}, e.g. Caddy: '${origin#https://} { reverse_proxy 127.0.0.1:${port} { header_up X-Folio-Client-IP {remote_host} } }'" ;;
esac

#!/usr/bin/env bash
# Folio installer for Linux, macOS and Android (Termux).
#   curl -fsSL https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.sh | bash
#
# Uses Docker when it is available, otherwise installs natively with Node.js 24 (Termux: installed for you).
# Optional settings, to skip the questions or force a mode:
#   FOLIO_DIR, FOLIO_PORT, FOLIO_ORIGIN, FOLIO_EMAIL, FOLIO_MODE=docker|native,
#   FOLIO_IMAGE (docker), FOLIO_VERSION (native, a tag such as v1.1.0), FOLIO_SOURCE (native, a local folder or .tar.gz)
set -euo pipefail

REPO=Silent-Protocol-Inc/folio
say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }
ask() { # ask VAR "Question" default: reads from the terminal even when the script is piped into bash
  local var=$1 question=$2 default=$3 answer=""
  if [ -n "${!var:-}" ]; then return; fi
  if [ -r /dev/tty ] && [ -z "${CI:-}" ]; then read -r -p "$question [$default]: " answer < /dev/tty || true; fi
  printf -v "$var" '%s' "${answer:-$default}"
}
node_ok() { has node && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 24 ]; }
is_termux() { [ -n "${TERMUX_VERSION:-}" ] || [[ "${PREFIX:-}" == *com.termux* ]]; }
docker_ok() { has docker && docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

# ---------- pick a mode ----------
mode=${FOLIO_MODE:-auto}
if [ "$mode" = auto ]; then
  if is_termux; then mode=native
  elif docker_ok; then mode=docker
  elif node_ok; then mode=native
  else
    cat >&2 <<'EOF'
Folio needs Docker or Node.js 24+. Install one, then run this again:
  Docker:   https://docs.docker.com/get-docker/  (Linux: curl -fsSL https://get.docker.com | sh)
  Node.js:  macOS: brew install node     Debian/Ubuntu: https://github.com/nodesource/distributions
            Fedora: sudo dnf install nodejs     Arch: sudo pacman -S nodejs npm     Alpine: apk add nodejs npm
EOF
    exit 1
  fi
fi

say "Folio installer ($mode)"
ask FOLIO_DIR "Install folder" "$HOME/folio"
ask FOLIO_PORT "Port on this machine (127.0.0.1 only)" "4173"
ask FOLIO_ORIGIN "Address you will open Folio at (https://folio.example.com, or http://localhost:PORT to use it on this device)" "http://localhost:${FOLIO_PORT}"
case "$FOLIO_ORIGIN" in
  https://*|http://localhost:*|http://127.0.0.1:*) ;;
  *) fail "The address must start with https:// (or be http://localhost:PORT on this device)." ;;
esac
FOLIO_ORIGIN=${FOLIO_ORIGIN%/}
mkdir -p "$FOLIO_DIR/data"
cd "$FOLIO_DIR"

wait_up() {
  local port=$1
  for _ in $(seq 1 45); do
    curl -fsS -o /dev/null "http://127.0.0.1:${port}/api/session" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

# ---------- Docker ----------
if [ "$mode" = docker ]; then
  docker_ok || fail "Docker with Compose v2 is not reachable. Start Docker, or run as a user in the docker group."
  image=${FOLIO_IMAGE:-ghcr.io/silent-protocol-inc/folio:latest}
  # The container runs as the owner of ./data (uid 1000, the image's node user, when installing as root).
  if [ "$(id -u)" = 0 ]; then chown 1000:1000 data; uid=1000 gid=1000; else uid=$(id -u) gid=$(id -g); fi
  if [ ! -f .env ]; then
    (umask 077; printf 'FOLIO_ORIGIN=%s\nPORT=%s\nFOLIO_UID=%s\nFOLIO_GID=%s\n' "$FOLIO_ORIGIN" "$FOLIO_PORT" "$uid" "$gid" > .env)
  else say "Keeping the existing $FOLIO_DIR/.env"; fi
  cat > docker-compose.yml <<EOF
# Written by the Folio installer. Data lives in ./data; the app is published on 127.0.0.1 only.
services:
  folio:
    image: ${image}
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
  if [[ "$image" == */* ]]; then docker compose pull --quiet; fi
  docker compose up -d
  port=$(sed -n 's/^PORT=//p' .env)
  wait_up "$port" || fail "Folio did not start. See: docker compose -f $FOLIO_DIR/docker-compose.yml logs"
  add_user() { docker compose exec -T folio node scripts/account.mjs "$1"; }
  hint_add="cd $FOLIO_DIR && docker compose exec folio node scripts/account.mjs you@example.com"
  hint_update="cd $FOLIO_DIR && docker compose pull && docker compose up -d"
  hint_stop="cd $FOLIO_DIR && docker compose down"
fi

# ---------- Native (Node.js 24) ----------
if [ "$mode" = native ]; then
  if ! node_ok; then
    if is_termux; then say "Installing Node.js (Termux)"; pkg install -y nodejs curl tar >/dev/null; fi
    node_ok || fail "Node.js 24 or newer is required (found: $(node -v 2>/dev/null || echo none))."
  fi
  has npm || fail "npm is required."
  has curl || fail "curl is required."
  say "Getting Folio"
  rm -rf app.new && mkdir app.new
  if [ -n "${FOLIO_SOURCE:-}" ]; then
    if [ -d "$FOLIO_SOURCE" ]; then (cd "$FOLIO_SOURCE" && tar cf - --exclude=node_modules --exclude=dist --exclude=data --exclude=.git --exclude=.env .) | tar xf - -C app.new
    else tar xzf "$FOLIO_SOURCE" -C app.new --strip-components=1; fi
  else
    tag=${FOLIO_VERSION:-$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)}
    [ -n "$tag" ] || fail "Could not find the latest Folio release."
    curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/tags/$tag" | tar xz -C app.new --strip-components=1
  fi
  say "Building (this takes a minute)"
  (cd app.new && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent && npm prune --omit=dev --no-audit --no-fund --loglevel=error)
  [ -x ./folio ] && ./folio stop >/dev/null 2>&1 || true
  rm -rf app && mv app.new app
  if [ ! -f .env ]; then
    (umask 077; printf 'FOLIO_ORIGIN=%s\nPORT=%s\nFOLIO_DB_PATH=%s\n' "$FOLIO_ORIGIN" "$FOLIO_PORT" "$FOLIO_DIR/data/folio.sqlite" > .env)
  else say "Keeping the existing $FOLIO_DIR/.env"; fi
  cat > folio <<'EOF'
#!/usr/bin/env bash
# Folio control script (written by the installer): start | stop | restart | status | logs | add-user EMAIL | update
set -euo pipefail
cd "$(dirname "$0")"
pid() { [ -f folio.pid ] && kill -0 "$(cat folio.pid)" 2>/dev/null && cat folio.pid; }
case "${1:-status}" in
  start) if pid >/dev/null; then echo "Folio is already running."; exit 0; fi
         # Background only node itself (not a wrapper shell), with no inherited stdin/stdout, so folio.pid is node's pid.
         (cd app; nohup node --env-file=../.env scripts/serve.mjs >> ../folio.log 2>&1 < /dev/null & echo $! > ../folio.pid)
         sleep 1; pid >/dev/null && echo "Folio started: $(sed -n 's/^FOLIO_ORIGIN=//p' .env)" || { echo "Folio did not start; see folio.log"; exit 1; } ;;
  stop) if p=$(pid); then kill "$p"; rm -f folio.pid; echo "Folio stopped."; else echo "Folio is not running."; fi ;;
  restart) "$0" stop; "$0" start ;;
  status) if p=$(pid); then echo "Folio is running (pid $p)."; else echo "Folio is not running."; fi ;;
  logs) tail -n 50 -f folio.log ;;
  add-user) [ -n "${2:-}" ] || { echo "Usage: $0 add-user you@example.com"; exit 1; }; (cd app && node --env-file=../.env scripts/account.mjs "$2") ;;
  update) curl -fsSL https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.sh | FOLIO_MODE=native FOLIO_DIR="$PWD" FOLIO_EMAIL=- \
           FOLIO_PORT="$(sed -n 's/^PORT=//p' .env)" FOLIO_ORIGIN="$(sed -n 's/^FOLIO_ORIGIN=//p' .env)" bash ;;
  *) echo "Usage: $0 start|stop|restart|status|logs|add-user EMAIL|update"; exit 1 ;;
esac
EOF
  chmod +x folio
  ./folio start
  port=$(sed -n 's/^PORT=//p' .env)
  wait_up "$port" || fail "Folio did not start. See $FOLIO_DIR/folio.log"
  add_user() { ./folio add-user "$1"; }
  hint_add="$FOLIO_DIR/folio add-user you@example.com"
  hint_update="$FOLIO_DIR/folio update"
  hint_stop="$FOLIO_DIR/folio stop    (start again: $FOLIO_DIR/folio start)"
fi

# ---------- first account ----------
ask FOLIO_EMAIL "Email for your Folio account (leave empty to add one later)" ""
if [ -n "$FOLIO_EMAIL" ] && [ "$FOLIO_EMAIL" != "-" ]; then add_user "$FOLIO_EMAIL"; fi

origin=$(sed -n 's/^FOLIO_ORIGIN=//p' .env)
say "Folio is running."
echo "  Open:        $origin"
echo "  Add a user:  $hint_add"
echo "  Update:      $hint_update"
echo "  Stop:        $hint_stop"
echo "  Your data:   $FOLIO_DIR/data (back it up)"
case "$origin" in
  https://*) echo "  HTTPS:       point a reverse proxy at 127.0.0.1:${port}; see the README (Caddy and Nginx examples)." ;;
esac
if is_termux; then echo "  Termux:      run 'termux-wake-lock' so Android keeps Folio running; '$FOLIO_DIR/folio start' after a reboot."; fi

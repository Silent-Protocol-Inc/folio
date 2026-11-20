# Folio installer for Windows (Docker Desktop).
#   irm https://raw.githubusercontent.com/Silent-Protocol-Inc/folio/main/install.ps1 | iex
# Optional, to skip the questions: $env:FOLIO_DIR, $env:FOLIO_PORT, $env:FOLIO_ORIGIN, $env:FOLIO_EMAIL, $env:FOLIO_IMAGE
$ErrorActionPreference = 'Stop'

function Ask([string]$Name, [string]$Question, [string]$Default) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ($value) { return $value }
  $answer = Read-Host "$Question [$Default]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $Default } else { return $answer.Trim() }
}

Write-Host 'Folio installer (Docker Desktop)' -ForegroundColor Magenta
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required. Install it from https://www.docker.com/products/docker-desktop/ (or: winget install Docker.DockerDesktop), start it, and run this again.'
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required (the "docker compose" command). Update Docker Desktop.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is installed but not running. Start it and run this again.' }

$dir = Ask 'FOLIO_DIR' 'Install folder' (Join-Path $HOME 'folio')
$port = Ask 'FOLIO_PORT' 'Port on this computer (127.0.0.1 only)' '4173'
$origin = (Ask 'FOLIO_ORIGIN' 'Address you will open Folio at (https://folio.example.com, or http://localhost:PORT on this computer)' "http://localhost:$port").TrimEnd('/')
if ($origin -notmatch '^(https://|http://localhost:|http://127\.0\.0\.1:)') { throw 'The address must start with https:// (or be http://localhost:PORT on this computer).' }
$image = if ($env:FOLIO_IMAGE) { $env:FOLIO_IMAGE } else { 'ghcr.io/silent-protocol-inc/folio:latest' }

New-Item -ItemType Directory -Force -Path (Join-Path $dir 'data') | Out-Null
Set-Location $dir
if (-not (Test-Path '.env')) {
  "FOLIO_ORIGIN=$origin`nPORT=$port`n" | Set-Content -NoNewline -Encoding ascii '.env'
} else { Write-Host "Keeping the existing $dir\.env" }

@"
# Written by the Folio installer. Data lives in ./data; the app is published on 127.0.0.1 only.
services:
  folio:
    image: $image
    env_file: .env
    environment:
      FOLIO_HOST: 0.0.0.0
      FOLIO_DB_PATH: /data/folio.sqlite
    ports:
      - "127.0.0.1:`${PORT}:`${PORT}"
    volumes:
      - ./data:/data
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    restart: unless-stopped
"@ | Set-Content -Encoding ascii 'docker-compose.yml'

Write-Host 'Starting Folio' -ForegroundColor Magenta
if ($image -like '*/*') { docker compose pull --quiet; if ($LASTEXITCODE -ne 0) { throw 'Could not pull the Folio image.' } }
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw 'Folio did not start. See: docker compose logs' }

$up = $false
for ($i = 0; $i -lt 45 -and -not $up; $i++) {
  try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/api/session" -TimeoutSec 2 | Out-Null; $up = $true } catch { Start-Sleep -Seconds 1 }
}
if (-not $up) { throw "Folio did not start. See: cd $dir; docker compose logs" }

$email = Ask 'FOLIO_EMAIL' 'Email for your Folio account (leave empty to add one later)' ''
if ($email -and $email -ne '-') { docker compose exec -T folio node scripts/account.mjs $email }

Write-Host 'Folio is running.' -ForegroundColor Green
Write-Host "  Open:        $origin"
Write-Host "  Add a user:  cd $dir; docker compose exec folio node scripts/account.mjs you@example.com"
Write-Host "  Update:      cd $dir; docker compose pull; docker compose up -d"
Write-Host "  Stop:        cd $dir; docker compose down"
Write-Host "  Your data:   $dir\data (back it up)"

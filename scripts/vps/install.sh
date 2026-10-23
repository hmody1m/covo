#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Covo — VPS installer (Ubuntu/Debian). Run as root:
#   curl -fsSL <raw-url>/scripts/vps/install.sh | bash        (or)   sudo bash scripts/vps/install.sh
# Two modes:
#   1) Docker + Caddy (HTTPS on your domain)            ← recommended
#   2) Native Node.js + systemd (+ optional Caddy)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/covo}
REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || echo "")

echo "== Covo VPS installer =="
if [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/package.json" ] && [ "$REPO_DIR" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"; cp -r "$REPO_DIR"/. "$APP_DIR"/
fi
cd "$APP_DIR"
read -rp "Domain for HTTPS (e.g. covo.example.com, leave empty for IP:8787 without HTTPS): " DOMAIN
read -rp "Mode: [1] Docker (recommended)  [2] Native systemd : " MODE
MODE=${MODE:-1}

if [ "$MODE" = "1" ]; then
  command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
  if [ -n "$DOMAIN" ]; then
    printf "COVO_DOMAIN=%s\nANTHROPIC_API_KEY=\n" "$DOMAIN" > docker/.env
    docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
    echo "✔ Open https://$DOMAIN"
  else
    docker build -f docker/Dockerfile -t covo .
    docker rm -f covo 2>/dev/null || true
    docker run -d --name covo --restart unless-stopped -p 8787:8787 -v covo-data:/data covo
    echo "✔ Open http://$(curl -s ifconfig.me):8787  (no HTTPS: push notifications and mic need HTTPS)"
  fi
else
  if ! command -v node >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
  id covo >/dev/null 2>&1 || useradd -r -m -d /var/lib/covo covo
  npm install --omit=dev --no-audit --no-fund
  mkdir -p /var/lib/covo/data && chown -R covo:covo /var/lib/covo "$APP_DIR"
  cat > /etc/systemd/system/covo.service <<UNIT
[Unit]
Description=Covo agent
After=network-online.target
[Service]
User=covo
WorkingDirectory=$APP_DIR
Environment=PORT=8787 HOST=127.0.0.1 DATA_DIR=/var/lib/covo/data SECURE_COOKIES=$([ -n "$DOMAIN" ] && echo 1 || echo 0)
ExecStart=$(command -v node) server/index.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
  if [ -z "$DOMAIN" ]; then sed -i 's/HOST=127.0.0.1/HOST=0.0.0.0/' /etc/systemd/system/covo.service; fi
  systemctl daemon-reload && systemctl enable --now covo
  if [ -n "$DOMAIN" ]; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
    printf "%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8787\n}\n" "$DOMAIN" > /etc/caddy/Caddyfile
    systemctl reload caddy
    echo "✔ Open https://$DOMAIN"
  else
    echo "✔ Open http://$(curl -s ifconfig.me):8787"
  fi
fi
echo "Tip: logs → docker logs -f covo   or   journalctl -u covo -f"

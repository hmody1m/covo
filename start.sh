#!/usr/bin/env bash
# Covo — start on macOS / Linux
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 20+ first: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --omit=dev --no-audit --no-fund
export PORT="${PORT:-8787}"
echo "Covo → http://localhost:$PORT"
exec node server/index.js

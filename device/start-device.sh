#!/usr/bin/env bash
# Covo device runner for macOS / Linux.
# Usage: ./start-device.sh   (reads device.config.json)  or  ./start-device.sh --server https://… --token dev_…
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 20+ first: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
while true; do
  node covo-device.js "$@" || true
  echo "Runner stopped. Restarting in 5s (Ctrl+C to quit)…"
  sleep 5
done

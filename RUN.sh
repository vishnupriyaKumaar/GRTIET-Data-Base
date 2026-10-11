#!/usr/bin/env bash
# macOS / Linux: install, build and start the app on http://localhost:5000
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js LTS from https://nodejs.org first."; exit 1; }
[ -d node_modules/express ] || npm install --no-audit --no-fund
[ -f .env ] || cp .env.example .env
npm run build && OPEN_BROWSER=1 node backend/server.js

#!/usr/bin/env bash
# ONE-TIME DEPLOY (macOS / Linux): frontend + backend go to Vercel as ONE project.
# Run:  bash deploy-vercel.sh
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Get the LTS version from https://nodejs.org"; exit 1; }
echo "[1/3] Installing packages..."; npm install
echo "[2/3] Checking the build works..."; npm run build
echo "[3/3] Deploying to Vercel (log in when asked, press Enter for the questions)..."
npx vercel@latest --prod
echo
echo "Done. First deploy? Add the environment variables in Vercel -> Project -> Settings -> Environment Variables"
echo "(see DEPLOY-ONE-TIME.md) and run this script again."

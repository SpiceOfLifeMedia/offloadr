#!/usr/bin/env bash
# Push current main branch to GitHub (SpiceOfLifeMedia/offloadr)
# Usage: bash push-to-github.sh
# Requires: GITHUB_TOKEN environment variable (set in Replit Secrets)

set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN is not set. Add it in Replit Secrets."
  exit 1
fi

REMOTE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/SpiceOfLifeMedia/offloadr.git"

echo "Pushing main -> github.com/SpiceOfLifeMedia/offloadr..."
git push "$REMOTE_URL" main:main
echo "Done."

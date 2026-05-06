#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/SpiceOfLifeMedia/offloadr.git"

echo "Pushing to GitHub..."
git push "$REMOTE_URL" main:main
echo "Done."

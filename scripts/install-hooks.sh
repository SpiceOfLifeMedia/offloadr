#!/usr/bin/env bash
# Install tracked git hooks into .git/hooks/.
# Run this once after cloning or when setting up a new environment:
#   bash scripts/install-hooks.sh
set -euo pipefail

HOOKS_SRC="scripts/hooks"
HOOKS_DEST=".git/hooks"

if [ ! -d "$HOOKS_DEST" ]; then
  echo "install-hooks: .git/hooks directory not found — are you in the repo root?" >&2
  exit 1
fi

for hook in "$HOOKS_SRC"/*; do
  name="$(basename "$hook")"
  cp "$hook" "$HOOKS_DEST/$name"
  chmod +x "$HOOKS_DEST/$name"
  echo "install-hooks: installed $name"
done

echo "install-hooks: done."

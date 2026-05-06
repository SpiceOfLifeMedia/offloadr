#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Reinstall git hooks from the tracked source
bash scripts/install-hooks.sh

#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Reinstall git hooks from the tracked source
cp scripts/hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `bash scripts/install-hooks.sh` — install git hooks (run once in a fresh environment)
- `bash push-to-github.sh` — manually push main branch to GitHub

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## GitHub Auto-Push

Every Replit checkpoint commit automatically pushes `main` to GitHub via a `post-commit` git hook.

- Hook source (tracked in git): `scripts/hooks/post-commit`
- Hook destination: `.git/hooks/post-commit` (installed by `scripts/install-hooks.sh`)
- Requires: `GITHUB_TOKEN` secret (already set) with `repo` push scope
- `scripts/post-merge.sh` reinstalls the hook after every task merge
- In a fresh environment, run `bash scripts/install-hooks.sh` once to bootstrap

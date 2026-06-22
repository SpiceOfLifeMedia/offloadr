# Offloadr Platform

Student video upload and media management platform for schools.

**Production:** https://www.useoffloadr.com  
**Student login:** https://www.useoffloadr.com/student-login/demo-school  
**API:** https://api.useoffloadr.com

## Architecture

```
apps/web/    — React + Vite SPA (deployed to Vercel)
apps/api/    — Express API + Node.js (deployed to Railway)
packages/db/ — Drizzle ORM schema (Neon PostgreSQL)
packages/api-zod/ — Shared Zod validators
```

## Development

```bash
pnpm install
pnpm dev      # starts both API and web dev servers
```

## Deployment

See `docs/deployment.md` for full environment variable and DNS setup.

Frontend → Vercel (reads `vercel.json`)  
API → Railway (reads `railway.json`)

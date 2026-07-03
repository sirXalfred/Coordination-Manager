---
name: vercel-deploy
description: Build locally and deploy the frontend to Vercel using zero build minutes via Vercel CLI
---

# vercel-deploy

## Purpose

Deploy the Coordination Manager frontend to Vercel production (or preview) using local builds. This bypasses Vercel's remote build system entirely, consuming **zero build minutes** on the free tier. Uses `vercel build --prod` + `vercel deploy --prebuilt --prod`.

## When to Use

- Deploying frontend changes to production or preview
- Vercel build minutes are exhausted or limited
- Need a fast deploy without waiting for Vercel's remote builder
- Troubleshooting deployment issues from the CLI

## Prerequisites

| Requirement | Detail |
|-------------|--------|
| Vercel CLI | `pnpm add -g vercel` (v50+) |
| Logged in | `vercel login` |
| Project linked | `.vercel/project.json` at repo root, linked to `coordination-manager` |
| Environment | Production env vars pulled via `vercel pull --environment=production` |

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Deploy target | `--prod` (production) or `--preview` | yes |
| Skip build | `--SkipBuild` flag to reuse existing build | no |

## Workflow

### Quick Deploy (Script)

```powershell
# Production deploy (build + deploy, 0 remote build minutes)
.\scripts\deploy-vercel.ps1

# Preview deploy
.\scripts\deploy-vercel.ps1 -Preview

# Redeploy without rebuilding (e.g. upload failed, retry)
.\scripts\deploy-vercel.ps1 -SkipBuild
```

### Manual Steps (CLI)

```powershell
# 1. Ensure repo root
cd "C:\Project Folders\Coordination Manager"

# 2. Link to project (one-time setup)
vercel link --project coordination-manager

# 3. Build locally with production env vars
vercel build --prod

# 4. Deploy prebuilt output to production
vercel deploy --prebuilt --prod

# Preview deploy (no --prod on deploy):
vercel deploy --prebuilt
```

### First-Time Setup

If `.vercel/project.json` does not exist at the repo root:

```powershell
cd "C:\Project Folders\Coordination Manager"
vercel link --project coordination-manager
```

This creates `.vercel/` with project ID and org ID. The directory is gitignored.

### How It Works

1. `vercel build --prod` pulls production environment variables from Vercel, then runs the project's build command (`pnpm run build:with-docs`) locally, producing `.vercel/output/`
2. `vercel deploy --prebuilt --prod` uploads the pre-built `.vercel/output/` directory directly to Vercel's CDN -- no remote build occurs, so **0 build minutes** are consumed
3. Vercel applies `vercel.json` headers (CSP, HSTS, etc.) and rewrites from the output

### Project Configuration

| Setting | Value |
|---------|-------|
| Vercel project | `coordination-manager` |
| Scope | `tevo-kasks-projects` |
| Domain | `coordinationmanager.com` |
| Framework | Vite |
| Root directory | `Code/apps/web` |
| Build command | `pnpm run build:with-docs` |
| Output directory | `dist` |
| Node version | 24.x |

### Environment Variables

Production env vars are pulled automatically by `vercel build --prod`:
- `VITE_API_URL` -- API backend URL (e.g. `https://api.coordinationmanager.com`)
- `VITE_SUPABASE_URL` -- Supabase project URL
- `VITE_SUPABASE_ANON_KEY` -- Supabase anon key
- `VITE_TURNSTILE_SITE_KEY` -- Cloudflare Turnstile captcha key

All `VITE_*` variables are bundled into the client JS at build time -- **never put secrets here**.

### Vercel API (Programmatic)

For automation beyond CLI, use the Vercel REST API:

```
# List deployments
GET https://api.vercel.com/v6/deployments?projectId=<PROJECT_ID>
Authorization: Bearer <VERCEL_TOKEN>

# Get deployment status
GET https://api.vercel.com/v13/deployments/<DEPLOYMENT_ID>

# List environment variables
GET https://api.vercel.com/v9/projects/<PROJECT_ID>/env
```

Generate a token at: `https://vercel.com/account/tokens`

Do NOT store Vercel tokens in source code. Use environment variables or a secrets manager.

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Local build | Directory | `.vercel/output/` at repo root |
| Deploy script | PowerShell | `scripts/deploy-vercel.ps1` |
| Production URL | Live | `https://coordinationmanager.com` |
| Inspect URL | Live | Printed by `vercel deploy` |

## Constraints

- MUST run from the repo root (`C:\Project Folders\Coordination Manager`) where `.vercel/project.json` exists
- MUST NOT have a `.vercel/` inside `Code/apps/web` (causes project mismatch)
- The Vercel project's root directory setting (`Code/apps/web`) tells the CLI where to find `vercel.json` and the build script
- NEVER store Vercel API tokens in source code or `.env` files that are committed
- Security headers in `vercel.json` MUST include CSP, HSTS, X-Frame-Options
- CSP `connect-src` MUST include `https://api.coordinationmanager.com` (custom API domain)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No prebuilt output found" | Run from repo root, not `Code/apps/web` |
| "No Project Settings found" | Run `vercel link --project coordination-manager` at repo root |
| Wrong project linked | Delete `.vercel/` dir, re-run `vercel link --project coordination-manager` |
| CSP blocks API calls | Add API domain to `connect-src` in `vercel.json`, redeploy |
| Build minutes exhausted | Use this skill -- local builds consume 0 remote minutes |
| Env vars missing in build | `vercel pull --environment=production` to refresh local env cache |

## Self-Validation

### Trigger Indicators
- [ ] User asked to deploy frontend to production/preview
- [ ] Build minutes are exhausted on Vercel
- [ ] CSP or header change needs deploying
- [ ] User mentioned `vercel deploy`, `deploy-vercel.ps1`, or CLI deploy

### Completion Markers
- [ ] `vercel deploy --prebuilt --prod` succeeded
- [ ] Production URL responds (https://coordinationmanager.com)
- [ ] Inspect URL printed for verification
- [ ] 0 build minutes consumed

### Quality Signals
- [ ] Security headers present in response (`curl -I`)
- [ ] CSP includes all required connect-src domains
- [ ] SPA routing works on page refresh
- [ ] Build used correct production environment variables

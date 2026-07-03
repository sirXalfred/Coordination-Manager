---
name: deployment
description: Deploy frontend to Vercel and backend to Railway with security headers and config
---

# deployment

## Purpose

Guides deployment of the Coordination Manager platform: frontend to Vercel (with docs), backend API to Railway via Nixpacks, and Discord guardian to Railway. Covers build configuration, environment variables, security headers, SPA routing, and production troubleshooting.

## When to Use

- Deploying the frontend or backend for the first time
- Configuring security headers or SPA rewrites
- Troubleshooting build failures or deployment issues
- Adding a custom domain
- Updating production environment variables
- Reviewing Railway or Vercel configuration

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Target | frontend (Vercel), backend (Railway), or guardian (Railway) | yes |
| Change description | What deployment config to modify | yes |

## Workflow

1. **Frontend deployment (Vercel)**:
   - Push to GitHub; import at vercel.com
   - Build settings:
     | Setting | Value |
     |---------|-------|
     | Framework | Vite |
     | Root Directory | `Code/apps/web` |
     | Build Command | `pnpm run build:with-docs` (builds frontend + docs into single dist) |
     | Output Directory | `dist` |
     | Install Command | `pnpm install` |
   - Web build uses 4GB heap: `node --max-old-space-size=4096`
   - Domain: `coordinationmanager.com`
   - Auto-deploys from `main` branch; preview deployments for PRs
   - If build fails on workspace deps: set `ENABLE_EXPERIMENTAL_COREPACK=1`

2. **Frontend security headers** (in `Code/apps/web/vercel.json`):
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(), microphone=(), geolocation=()
   - Strict-Transport-Security: max-age=31536000; includeSubDomains (HSTS -- enforce HTTPS)
   - Content-Security-Policy: strict policy with script-src, style-src, connect-src
     tailored to the app's needs (nonce/hash-based preferred for strict CSP)
   - Applied to all routes via `"source": "/(.*)"` pattern

3. **Frontend SPA rewrites** (in `Code/apps/web/vercel.json`):
   - `/docs/*` rewrites to `/docs/index.html` (separate docs SPA)
   - Everything else (except assets and docs) rewrites to `/index.html`
   - This enables React Router client-side navigation

4. **Frontend environment variables** (Vercel Dashboard):
   - `VITE_API_URL` -- production API URL (Railway deployment)
   - `VITE_SUPABASE_URL` -- Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` -- Supabase anon key (safe, RLS-protected)
   - `VITE_TURNSTILE_SITE_KEY` -- Cloudflare Turnstile (captcha)
   - Use different values per scope (Production/Preview/Development)
   - **All VITE_* vars are public**: Vite bundles them into client JS at build time.
     NEVER put secrets in VITE_* variables.
   - **Mark sensitive vars as sensitive** in Vercel: these are stored in an unreadable
     format and cannot be viewed after creation. Use for API keys that only Vercel
     build process needs (not VITE_* vars which are bundled into the frontend).

5. **Backend deployment (Railway)**:
   - Auto-deploys from `main` branch
   - Build config in `Code/apps/api/nixpacks.toml`:
     ```
     [phases.setup] nixPkgs = ["nodejs_20", "pnpm"]
     [phases.install] cmds = ["pnpm install --frozen-lockfile"]
     [phases.build] cmds = ["pnpm build"]
     [start] cmd = "node dist/index.js"
     ```
   - NODE_ENV=production enables:
     - `trust proxy` for rate limiting behind Railway's reverse proxy
     - Production CORS settings
     - Helmet security headers

6. **Guardian deployment (Railway)** -- separate service:
   - Same nixpacks pattern as API
   - Separate bot token from the main Discord bot
   - Needs SUPABASE_URL, SUPABASE_KEY for rule lookups

7. **Backend environment variables** (Railway Dashboard):
   - All variables from `Code/apps/api/.env.example`
   - Critical: SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, AI_API_KEY
   - FRONTEND_URL must point to production Vercel domain (CORS whitelist)
   - PORT is auto-assigned by Railway (do not hardcode)
   - **Use sealed variables** where possible: Railway sealed variables are provided
     to builds/deployments but are not visible in UI and not retrievable via API.
     Use for highly sensitive values (service role keys, JWT secrets).
   - **Environment isolation**: Never share secrets across production/preview/development.
     Use separate secret values per environment to limit blast radius of a compromise.

8. **Secret rotation as deployment practice**:
   - Rotate secrets on a schedule (see security-hardening skill for rotation table)
   - Rotation procedure: deploy new secret -> verify app works -> revoke old secret
   - Use platform features: Vercel sensitive vars, Railway sealed vars
   - After rotating: redeploy all services that use the rotated secret
   - Log rotation events for audit trail

9. **Post-deployment checks**:
   - [ ] Frontend loads at production URL
   - [ ] API health check: `GET /api/health` returns 200
   - [ ] OAuth callback URLs updated in Google Cloud Console
   - [ ] Supabase Auth redirect URLs include production domain
   - [ ] CORS whitelist in API includes production frontend URL
   - [ ] Security headers visible in browser dev tools (Network tab)
   - [ ] SPA routing works (refresh on /calendar/:hash returns app, not 404)
   - [ ] `trust proxy` working (rate limiter sees real IPs, not Railway proxy)

10. **Troubleshoot common issues**:
   | Problem | Solution |
   |---------|----------|
   | Build fails on workspace deps | Set ENABLE_EXPERIMENTAL_COREPACK=1 on Vercel |
   | Build OOM | Ensure --max-old-space-size=4096 in build script |
   | 404 on page refresh | Check SPA rewrites in vercel.json |
   | CORS errors | Add production URL to API CORS whitelist (FRONTEND_URL) |
   | Rate limiter sees proxy IP | Ensure trust proxy enabled in production (NODE_ENV check) |
   | Env vars not available | Ensure VITE_ prefix for frontend; redeploy after changes |

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Vercel config | JSON | `Code/apps/web/vercel.json` |
| Railway config | TOML | `Code/apps/api/nixpacks.toml` |
| Deployment | Live | coordinationmanager.com + Railway URL |

## Constraints

- NEVER put secrets in VITE_* variables (they are bundled into client JS)
- NEVER commit API tokens for Vercel or Railway
- Security headers MUST be present in vercel.json (including HSTS and CSP)
- Production deployments MUST come from main branch only
- CORS whitelist MUST be updated when adding new deployment URLs
- Backend PORT is Railway-assigned in production (do not hardcode)
- Guardian needs its own Railway service with separate bot token
- Use Vercel sensitive env vars for build-only secrets
- Use Railway sealed variables for highly sensitive values
- Never share secrets across production/preview/development environments
- Rotate secrets on schedule and after suspected compromise

## Self-Validation

### Trigger Indicators
- [ ] User asked to deploy, configure hosting, or fix deployment issues
- [ ] Task involves vercel.json, nixpacks.toml, or deployment settings
- [ ] User mentioned Vercel, Railway, or production configuration

### Completion Markers
- [ ] vercel.json has security headers and SPA rewrites
- [ ] nixpacks.toml configures Node 20 + pnpm + frozen-lockfile
- [ ] Environment variables configured per deployment target
- [ ] Health check passes on deployed API

### Quality Signals
- [ ] Security headers respond correctly in production
- [ ] SPA routing works on page refresh
- [ ] CORS allows production frontend to reach API
- [ ] No secrets in frontend environment
- [ ] trust proxy enabled for correct rate limiting behind proxy

### Lint Checks
- [ ] vercel.json is valid JSON
- [ ] nixpacks.toml uses frozen-lockfile for reproducible builds
- [ ] No hardcoded URLs that should be environment variables

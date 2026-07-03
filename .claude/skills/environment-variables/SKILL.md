---
name: environment-variables
description: Environment variable structure, security classification, and multi-app configuration
---

# environment-variables

## Purpose

Defines the environment variable structure across all 5 apps, the agent, and deployment targets. Ensures secrets stay out of frontend bundles, all apps have consistent configuration, and new variables are properly classified and documented.

## When to Use

- Adding a new environment variable to any app
- Setting up a new developer's local environment
- Configuring deployment variables (Vercel, Railway)
- Auditing which variables are public vs private
- Debugging missing or misconfigured environment variables
- Adding a new third-party integration that needs API keys

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Variable name and value source | User provides | yes |
| Target app(s) | Which app needs the variable | yes |

## Workflow

1. **Classify the variable** using this security table:
   | Prefix / Pattern | Visibility | Rule |
   |-----------------|------------|------|
   | `VITE_*` | **Public** (bundled into browser JS) | Only low-sensitivity values |
   | `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | **Public** | Safe -- protected by RLS |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Private** | Backend only -- bypasses RLS |
   | `JWT_SECRET` | **Private** | Backend only -- wallet credential derivation |
   | `DISCORD_BOT_TOKEN` | **Private** | Bot apps only (separate per bot) |
   | `BOT_API_SECRET` | **Private** | Bot-to-API internal auth (must match both sides) |
   | `AI_API_KEY`, `ASI_API_KEY` | **Private** | Backend only (OpenAI + ASI1-mini fallback) |
   | `SMTP_PASS`, `SMTP_ENCRYPTION_KEY` | **Private** | Backend only (64 hex chars for AES-256-GCM) |
   | `ZOOM_CLIENT_SECRET` | **Private** | Backend only |
   | `FIGMA_ACCESS_TOKEN` | **Private** | Backend only |
   | `TURNSTILE_SECRET_KEY` | **Private** | Backend only (verify side) |

   **Rule:** If it starts with `VITE_`, it is in the browser. Everything else stays server-side.

2. **Identify the correct .env file**:
   | App | .env Location | Key Variables |
   |-----|--------------|---------------|
   | API | `Code/apps/api/.env` | SUPABASE_*, JWT_SECRET, AI_API_KEY, ASI_API_KEY, SMTP_*, DISCORD_*, ZOOM_*, FIGMA_*, PORT |
   | Web | `Code/apps/web/.env` | VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TURNSTILE_SITE_KEY |
   | Discord Bot | `Code/apps/discord-bot/.env` | DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, SUPABASE_*, API_URL, BOT_API_SECRET, PORT |
   | Guardian | `Code/apps/discord-guardian/.env` | DISCORD_BOT_TOKEN (separate), SUPABASE_*, DISABLE_BOT (set true for local dev without Discord) |
   | Agent | `Code/agents/meeting-scheduler/.env` | COORDINATION_API_URL, AGENT_*_KEY, LANGFLOW_* |

3. **Add to `.env.example`** in the target app with a placeholder:
   - Group variables under headers: Database, OAuth, Discord, AI, SMTP, etc.
   - Use descriptive placeholders: `your_supabase_url`, `<64-hex-chars>`
   - Never put real values in .env.example

4. **Add to `.env`** (git-ignored) with the real value

5. **Source values** from the correct location:
   | Variable | Source |
   |----------|--------|
   | SUPABASE_URL, SUPABASE_KEY | Supabase Dashboard > Settings > API |
   | SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard > Settings > API |
   | JWT_SECRET | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | SMTP_ENCRYPTION_KEY | Generate: 64 hex chars (same method as JWT_SECRET) -- used for AES-256-GCM per-user SMTP password encryption |
   | GOOGLE_CLIENT_* | Google Cloud Console > Credentials |
   | DISCORD_BOT_TOKEN | Discord Developer Portal > Bot (separate token per bot) |
   | AI_API_KEY | OpenAI Dashboard > API Keys |
   | ASI_API_KEY | ASI platform (fallback model, $0.01/prompt) |
   | TURNSTILE_SECRET_KEY | Cloudflare Dashboard > Turnstile |
   | ZOOM_CLIENT_* | Zoom App Marketplace > Build > OAuth |
   | FIGMA_ACCESS_TOKEN | Figma > Settings > Personal Access Tokens |

6. **Configure for deployment**:
   - **Vercel (frontend):** Project Settings > Environment Variables; add `VITE_*` vars only
   - **Railway (API + Guardian):** Service > Variables; add all non-VITE backend vars per service
   - Use different credentials for Production vs Development

7. **Run the safety checklist**:
   - [ ] `.env` and `.env.local` are in `.gitignore`
   - [ ] No secrets in `VITE_*` variables
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in API .env (not frontend, not bots)
   - [ ] Discord bots use separate tokens from each other
   - [ ] `BOT_API_SECRET` matches between bot and API configurations
   - [ ] Production and development use different credentials
   - [ ] Guardian has `DISABLE_BOT=true` option documented for local dev

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| .env.example update | env file | Target app's .env.example |
| .env update | env file | Target app's .env (git-ignored) |
| Deployment config | Dashboard | Vercel / Railway variables |

## Constraints

- NEVER put secrets in `VITE_*` variables (bundled into browser JS)
- NEVER commit `.env` files with real values
- SUPABASE_SERVICE_ROLE_KEY MUST only exist in API backend environment
- Each Discord bot MUST have its own token
- BOT_API_SECRET MUST match between bot and API configurations
- All new variables MUST be added to .env.example with placeholders
- SMTP_ENCRYPTION_KEY must be 64 hex chars for AES-256-GCM (format: iv:authTag:ciphertext)

## Self-Validation

### Trigger Indicators
- [ ] User asked to add, configure, or audit environment variables
- [ ] New integration requires API keys or secrets
- [ ] Deployment environment needs variable configuration

### Completion Markers
- [ ] Variable added to correct .env.example with placeholder
- [ ] Variable classified as public or private
- [ ] Deployment target identified and configured

### Quality Signals
- [ ] No secrets in VITE_* variables
- [ ] .env files are in .gitignore
- [ ] Safety checklist passes (including BOT_API_SECRET match check)
- [ ] Bot tokens are separate per bot
- [ ] Agent env vars included when relevant

### Lint Checks
- [ ] No .env files with real values in git staging
- [ ] VITE_ prefix used only for frontend-safe values
- [ ] .env.example has all variables documented

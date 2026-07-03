---
name: monorepo-conventions
description: Follow pnpm workspace conventions for cross-app development and shared packages
---

# monorepo-conventions

## Purpose

Guides monorepo-wide development patterns in the Coordination Manager pnpm workspace. Covers dependency management, workspace scripts, shared database package, multi-process development, and cross-app patterns across 5 apps and 1 shared package.

## When to Use

- Adding dependencies to any workspace package
- Working with the shared database package in `Code/packages/database/`
- Running dev, build, test, or lint commands across the monorepo
- Creating or modifying workspace-level scripts
- Resolving cross-package import or build issues
- Starting or stopping individual services

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Change request | User describes cross-app work | yes |
| Workspace config | `Code/pnpm-workspace.yaml`, `Code/package.json` | auto |

## Workflow

1. **Add dependencies correctly**: Use pnpm filter:
   ```
   pnpm add <package> --filter @coordination-manager/web
   pnpm add <package> --filter @coordination-manager/api
   pnpm add <package> --filter @coordination-manager/discord-bot
   ```
   For dev dependencies: `pnpm add -D <package> --filter @coordination-manager/{app}`

2. **Workspace structure**:
   ```
   Code/
     apps/api/             @coordination-manager/api (Express, port 3001)
     apps/web/             @coordination-manager/web (React+Vite, port 5173)
     apps/discord-bot/     @coordination-manager/discord-bot (port 3002 internal API)
     apps/discord-guardian/ @coordination-manager/discord-guardian (DISABLE_BOT=true for local)
     apps/docs/            @coordination-manager/docs (Vite, port 5174)
     packages/database/    Supabase schema + migrations (not a published package)
     figma-plugin/         Wireframe generator (separate concern)
     agents/               Fetch.ai uAgent (meeting-scheduler, has own .env.example)
   ```

3. **Use workspace scripts** (run from `Code/` directory):
   - `pnpm dev` -- start all services via concurrently
   - `pnpm dev:web` / `pnpm dev:api` / `pnpm dev:bot` / `pnpm dev:guardian` / `pnpm dev:docs`
   - `pnpm stop` / `pnpm stop:{service}` -- safe shutdown via `node scripts/stop-servers.js`
   - `pnpm restart` / `pnpm restart:{service}` -- stop then start
   - `pnpm build` -- build all packages (`pnpm -r build`)
   - `pnpm test` / `pnpm test:api` / `pnpm test:web` / `pnpm test:public` / `pnpm test:coverage`
   - `pnpm lint` / `pnpm lint:fix` -- lint all packages
   - `pnpm typecheck` -- typecheck all packages
   - `pnpm format` -- format with Prettier

4. **Build configuration details**:
   - Web build uses 4GB heap: `node --max-old-space-size=4096` (Vite bundling of large app)
   - Web `build:with-docs` builds frontend + docs into single dist (used in Vercel deployment)
   - Guardian has `DISABLE_BOT=true` env option for concurrent local dev without Discord connection
   - Only built dependencies to keep `pnpm install` fast: esbuild, chacha-native

5. **Shared database package** (`Code/packages/database/`):
   - Contains SQL migrations and the consolidated schema
   - Not a published npm package -- referenced by path in migrations workflow
   - Run migrations via Supabase SQL Editor (copy-paste) or Supabase CLI

6. **Multi-process development**:
   - Uses `concurrently` for parallel process management (not Turborepo)
   - `Code/scripts/stop-servers.js` handles graceful shutdown:
     - Finds processes by port (Get-NetTCPConnection on Windows, lsof on macOS/Linux)
     - Excludes VS Code processes (Code.exe) from kill list
     - Phase 1: graceful SIGTERM, Phase 2: wait 1.5s, Phase 3: force kill survivors
   - Each app has its own `pnpm dev` script for independent operation
   - Hot reload works independently per app (Vite HMR on port 24678 for web, tsx watch for API)

7. **Code formatting and linting**:
   - Prettier: configured in `Code/.prettierrc`
   - EditorConfig: `Code/.editorconfig` for consistent formatting
   - Per-app lint configs as needed

8. **Engine requirements**:
   - Node >= 20.0.0 (enforced in root package.json)
   - pnpm >= 8.0.0 (packageManager: pnpm@10.28.0)

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Package configs | JSON | `Code/{app}/package.json` |
| Workspace config | YAML | `Code/pnpm-workspace.yaml` |
| Shared scripts | JS | `Code/scripts/` |

## Constraints

- ALWAYS use pnpm (not npm or yarn) for package management
- ALWAYS use `pnpm --filter` to add dependencies to specific packages
- NEVER add app-specific dependencies to the root package.json
- NEVER use `Stop-Process -Name node` or `taskkill /IM node.exe /F` (kills VS Code)
- Run workspace commands from `Code/` directory (not repo root)
- The repo root also has a `package.json` but it is NOT the monorepo root
- Database package is not a publishable npm package
- Node >= 20.0.0 required

## Self-Validation

### Trigger Indicators
- [ ] User asked about workspace setup, dependencies, or scripts
- [ ] Changes span multiple workspace packages
- [ ] Build or dependency resolution errors

### Completion Markers
- [ ] Dependencies added with correct pnpm filter command
- [ ] Workspace scripts updated if needed
- [ ] All affected packages build independently

### Quality Signals
- [ ] No duplicate dependencies across workspace packages
- [ ] DISABLE_BOT flag used for guardian when developing without Discord
- [ ] Web build uses 4GB heap allocation
- [ ] Stop script used instead of manual process killing

### Lint Checks
- [ ] No root-level app dependencies
- [ ] pnpm-workspace.yaml includes all app directories
- [ ] Package names follow @coordination-manager/ namespace

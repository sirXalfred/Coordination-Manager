---
name: dev-server-workflow
description: Start, stop, and restart the 5 development services with safe process management
---

# dev-server-workflow

## Purpose

Manages the 5 concurrent development services in the Coordination Manager monorepo. Covers starting all or individual services, safe shutdown (protecting VS Code processes), port conflict resolution, and health verification.

## When to Use

- Starting the development environment (all services or individual ones)
- Stopping or restarting services after code changes
- Resolving port conflicts (another process using 5173, 3001, 3002)
- Verifying all services are running correctly
- Debugging a service that fails to start

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Action | start, stop, restart, or verify | yes |
| Target service(s) | all, web, api, bot, guardian, docs | no (default: all) |

## Workflow

1. **Service port map**:
   | Service | Package | Port | Start Command |
   |---------|---------|------|---------------|
   | web | @coordination-manager/web | 5173 | `pnpm dev:web` |
   | api | @coordination-manager/api | 3001 | `pnpm dev:api` |
   | bot (internal API) | @coordination-manager/discord-bot | 3002 | `pnpm dev:bot` |
   | guardian | @coordination-manager/discord-guardian | (no HTTP) | `pnpm dev:guardian` |
   | docs | @coordination-manager/docs | 5174 | `pnpm dev:docs` |
   | HMR | Vite hot module reload | 24678 | (auto with web) |

2. **Start services (preferred, script-first sequence)**:
   - Run from repo root: `.\start.ps1`
   - Equivalent wrapper: `pnpm dev:stack`
   - The script enforces sequence:
     1) stop existing services safely (`Code/scripts/stop-servers.js`)
     2) wait for port release
     3) launch 5 dedicated service terminals/tabs
     4) run `check-health.ps1` (unless `-SkipHealthCheck` is explicitly requested)
   - Use `.\start.ps1 -SkipHealthCheck` only when user explicitly asks to skip checks.
   - For individual services, use `pnpm dev:{service}` from `Code/`.

3. **Stop services safely**:
   - All: `pnpm stop` (runs `node scripts/stop-servers.js`)
   - Individual: `pnpm stop:web`, `pnpm stop:api`, `pnpm stop:guardian`, `pnpm stop:bot`, `pnpm stop:docs`
   - The stop script (cross-platform):
     - Windows: `Get-NetTCPConnection` to find processes by port
     - macOS/Linux: `lsof -i :<port>` to find processes
     - Finds bot process by command-line pattern matching
     - Excludes VS Code processes (Code.exe) from kill list
     - Phase 1: graceful SIGTERM
     - Phase 2: wait 1.5 seconds
     - Phase 3: force kill survivors
   - NEVER use `Stop-Process -Name node` or `taskkill /IM node.exe /F` (kills VS Code)

4. **Restart services**:
   - All (preferred): run `.\start.ps1` again (it performs safe stop + start + health check).
   - Alternative (Code root): `pnpm restart` (stop all, wait 2s, start all)
   - Individual: `pnpm restart:web`, `pnpm restart:api`, `pnpm restart:bot`, `pnpm restart:guardian`

5. **Resolve port conflicts**:
   - Check what is using a port (Windows):
     `Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess`
   - Check on macOS/Linux: `lsof -i :5173`
   - If VS Code owns the process, do NOT kill it
   - Use the stop script to safely clear ports: `pnpm stop:web`

6. **Verify services are running**:
   - Web: open `http://localhost:5173` in browser
   - API: `curl http://localhost:3001/health` or browser
   - Bot: check port 3002 (internal API) and console for "Bot logged in"
   - Guardian: check console output for rule loading (no HTTP port in guardian)
   - Docs: open `http://localhost:5174`
   - HMR: check port 24678 is responsive; if stuck, restart web

7. **Common issues**:
   | Problem | Solution |
   |---------|----------|
   | Port already in use | `pnpm stop:{service}` then retry |
   | All node processes killed (VS Code crash) | Restart VS Code, then run `.\start.ps1` |
   | Bot fails: invalid token | Check DISCORD_BOT_TOKEN in apps/discord-bot/.env |
   | Guardian errors on startup | Set DISABLE_BOT=true or check SUPABASE_URL in .env |
   | HMR not working | Check port 24678 is not blocked; restart web |
   | Web build slow or OOM | Build uses 4GB heap (--max-old-space-size=4096) |

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Running services | Processes | localhost:5173, 3001, 3002, 5174, 24678 |
| Stop script | .js | `Code/scripts/stop-servers.js` |

## Constraints

- NEVER use `Stop-Process -Name node` or `taskkill /IM node.exe /F`
- ALWAYS use the stop script (`pnpm stop`) for safe shutdown
- Use repo-root start script for full-stack startup: `.\start.ps1` (or `pnpm dev:stack`)
- Run per-service pnpm commands from the `Code/` directory (not repo root)
- The repo root package.json is NOT the monorepo workspace root
- Bot internal API runs on port 3002 (not guardian)
- Guardian has no HTTP port; verify via console output only

## Self-Validation

### Trigger Indicators
- [ ] User asked to start, stop, or restart development servers
- [ ] Port conflict needs resolution
- [ ] Service failed to start or is unresponsive

### Completion Markers
- [ ] Requested services are running on correct ports
- [ ] No orphaned node processes from previous sessions
- [ ] VS Code processes were not affected

### Quality Signals
- [ ] Stop script used instead of manual process killing
- [ ] All 5 services start via `.\start.ps1` and health check reports PASS
- [ ] Port conflicts resolved before starting services
- [ ] DISABLE_BOT used for guardian when Discord not needed

### Lint Checks
- [ ] Commands run from Code/ directory
- [ ] No destructive process kill commands used
- [ ] Service port assignments match the port map table

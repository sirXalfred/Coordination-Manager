# Public Sync Exclusions

Authoritative list of files and patterns that MUST be excluded when
syncing the private repo (`whitevo/Coordination-Manager`) to the public
repo (`whitevo/coordination-manager-public`).

Used by `scripts/sync-public.ps1` and the public-sync workflow step in
`SKILL.md`.

## Categories

### 1. Secrets and credentials (CRITICAL -- never sync)

| Pattern | Reason |
|---------|--------|
| `.env`, `.env.*` (except `.env.example`) | Keep real/local/prod env files private while allowing public templates |
| `.vscode/mcp.json` | Contains MCP server API tokens (Improvmx, Miro, etc.) |
| `.claude/settings.local.json` | Personal Claude config |
| `**/*.pem`, `**/*.key` | Cryptographic keys |
| `**/serviceAccount*.json` | Cloud service account credentials |

### 2. Internal scratch and ad-hoc scripts

| Pattern | Reason |
|---------|--------|
| `_test.js`, `_test_wrap.txt` | Local scratch files at repo root |
| `Code/apps/api/_*.cjs` | One-off DB query / export scripts (e.g. `_export_ratings.cjs`, `_query_recent.cjs`) |
| `Code/apps/api/_*.js` | Same convention |

The leading underscore is the project convention for "do not ship".

### 3. Internal documentation

| Pattern | Reason |
|---------|--------|
| `CHANGELOG_*.md` | Date-bound internal changelogs (release notes belong in PR descriptions or GitHub Releases) |
| `docs/private/**` | Private working documents, temp guides, and scratch notes |
| `**/*-REVIEW.md` | Generic pattern for review docs |
| `**/*-INTERNAL.md` | Explicit internal marker |

### 4. Personal / workspace config

| Pattern | Reason |
|---------|--------|
| `workspace.code-workspace` | Personal VS Code workspace |
| `.vscode/` (entire folder) | Personal editor settings |
| `.idea/` | JetBrains config |
| `tools/improvmx-mcp/` | Personal MCP tooling, not part of product |

### 5. Project-internal assets

| Pattern | Reason |
|---------|--------|
| (none currently) | -- |

### 6. Memory and session state

| Pattern | Reason |
|---------|--------|
| `/memories/**` | Per-user memory, not in repo but listed for safety |
| `.claude/session/**` | Session notes |

## What to preserve from public/main

As of 2026-06-07 the open-source governance files live in the private
repo and sync forward to public. Nothing needs to be restored from
`public/main` by default.

If at any point a file diverges (e.g. a hot-fix lands on public
directly), restore it during sync by listing it here:

| File | Reason |
|------|--------|
| (none currently) | -- |

### Public OSS files now sourced from private repo

These files are authored and maintained in the private repo and ship
publicly via normal sync:

- `LICENSE` -- MIT
- `NOTICE` -- copyright, licence, trademark, third-party attribution
- `TRADEMARKS.md` -- trademark policy (adapted from Model Trademark Guidelines)
- `CONTRIBUTING.md` -- contribution workflow
- `CLA.md` -- Contributor License Agreement text
- `CODE_OF_CONDUCT.md` -- Contributor Covenant 2.1
- `GOVERNANCE.md` -- open governance, BDFL bootstrap
- `SECURITY.md` -- security reporting (already existed)
- `.github/ISSUE_TEMPLATE/**` -- issue templates
- `.github/PULL_REQUEST_TEMPLATE.md` -- PR template

## Safety checks before pushing the sync branch

Run these greps against the staged tree:

```powershell
# 1. No non-example env files
git ls-files | Select-String '(?i)(^|/)\.env($|\.((?!example$).+))'

# 2. No leading-underscore script files at api root
git ls-files Code/apps/api/_*

# 3. No mcp.json
git ls-files .vscode/mcp.json

# 4. No tools/improvmx-mcp
git ls-files tools/improvmx-mcp/

# 5. No private docs folder
git ls-files 'docs/private/**'
```

Each must return zero results before pushing.

## Updating this list

When adding a new internal-only file pattern:
1. Add the pattern to the appropriate category above with the reason
2. Add a corresponding safety check at the bottom
3. Update `scripts/sync-public.ps1` exclusion list (if/when the script exists)
4. Note the change in the commit message

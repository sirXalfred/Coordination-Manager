# Open-Source Preparation

Guide for preparing the Coordination Manager repository for public release.

> **NOTE**: URLs, project IDs, and file paths below are Coordination Manager specific.
> Adjust for other projects.

## Safe to Publish

All TypeScript/React source code, database migrations/schema, package files,
`.env.example` files, documentation, CI config.

## Must Scrub Before Publishing

| Item | Action |
|------|--------|
| Git history | Run `gitleaks detect` to find leaked secrets; use `git filter-repo` or BFG to purge |
| Real deployment URLs | Replace `coordinationmanager.com` and Railway URLs with placeholders in docs |
| Hardcoded Discord Client ID | Move to environment variable |
| Supabase project ID | Replace real project IDs with placeholders |
| Deployment Guide URLs | Genericize all real service URLs |

## Pre-Open-Source Checklist

- [ ] Run full gitleaks history scan: `gitleaks detect --source . --verbose`
  - Rotate any real secrets found before continuing
  - Add confirmed false-positives to `.gitleaks.toml` allowlist
  - Commit `.gitleaks-baseline.json` after first clean pass
- [ ] Enable GitHub Secret Scanning + Push Protection
- [ ] Enable Dependabot alerts + security updates
- [ ] Remove/genericize real URLs from docs
- [ ] Move hardcoded Discord client ID to env var
- [ ] Verify no `.env` files tracked (`git ls-files | grep .env`)
- [ ] SECURITY.md with responsible disclosure instructions exists
- [ ] LICENSE file exists
- [ ] Rotate ALL secrets after open-sourcing

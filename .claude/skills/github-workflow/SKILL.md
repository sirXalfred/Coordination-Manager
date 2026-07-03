---
name: github-workflow
description: Branching strategy, commit conventions, repo security, and CI/CD patterns
---

# github-workflow

## Purpose

Defines the GitHub workflow for Coordination Manager: branching strategy, commit conventions, repository security settings, .gitignore configuration, and deployment integration with Vercel and Railway.

## When to Use

- Creating branches for features, fixes, or maintenance
- Writing commit messages
- Setting up or auditing branch protection rules
- Configuring repository security features
- Setting up CI/CD with GitHub Actions
- Reviewing pull request conventions

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Work type | Feature, fix, or chore | yes |
| Description | What the change does | yes |

## Workflow

1. **Follow the branching strategy**:
   ```
   main             -- production, always deployable (auto-deploys)
     feature/*      -- new features (e.g., feature/calendar-recurrence)
     fix/*          -- bug fixes (e.g., fix/wallet-auth-redirect)
     chore/*        -- maintenance (e.g., chore/update-deps)
   ```
   - Create from main: `git checkout -b feature/my-feature`
   - Push and open PR: `git push -u origin feature/my-feature`
   - Merge via PR (squash or merge commit)

2. **Use conventional commit messages**:
   ```
   feat: add biweekly recurrence option to meetings
   fix: resolve wallet auth redirect after account merge
   chore: update Discord.js to v15
   docs: add deployment troubleshooting guide
   refactor: extract availability overlap logic to service
   test: add wallet auth integration tests
   ```
   - Prefix with scope when useful: `feat(calendar): add time zone support`
   - Keep subject line under 72 characters
   - Use imperative mood: "add" not "added" or "adds"

3. **Enable security features** (Settings > Code Security):
   | Feature | Purpose |
   |---------|---------|
   | Secret Scanning | Alerts if API keys or tokens appear in commits |
   | Push Protection | Blocks pushes containing detected secrets |
   | Dependabot Alerts | Notifies about vulnerable npm dependencies |
   | Dependabot Security Updates | Auto-creates PRs to fix vulnerable deps |
   | CodeQL Code Scanning | SAST -- scans code for vulnerabilities on PRs + weekly |
   | Private Vulnerability Reporting | Lets researchers disclose issues privately (not public issues) |

4. **Configure branch protection** for `main`:
   - [x] Require pull request reviews before merging
   - [x] Require status checks to pass (when CI configured)
   - [x] Do not allow force pushes
   - [x] Do not allow deletions

5. **Maintain .gitignore** with essential entries:
   - Dependencies: `node_modules/`, `pnpm-debug.log*`
   - Build: `dist/`, `build/`, `*.tsbuildinfo`
   - Secrets: `.env`, `.env.local`, `.env.*.local`
   - VS Code: `.vscode/mcp.json` (contains API tokens)
   - Claude: `.claude/settings.local.json`
   - OS: `.DS_Store`, `Thumbs.db`
   - Temporary: `*.tmp`, `.cache`
   - Note: both repo root and `Code/` have .gitignore files

6. **Deployment integration**:
   - Pushing to `main` triggers: Vercel production deploy + Railway auto-deploy (API + guardian)
   - PRs trigger: Vercel preview deployments
   - No manual deployment steps required for standard workflow
   - Breaking main = breaking production (auto-deploys immediately)

7. **Set up GitHub Actions CI** (`.github/workflows/ci.yml`):
   ```yaml
   name: CI
   on: [push, pull_request]

   # Default to minimal permissions -- escalate only per-job
   permissions:
     contents: read

   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         # Pin actions to immutable commit SHAs (not mutable tags)
         - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
         - uses: pnpm/action-setup@a3252b78c470c02df07e9d59298aecedc3ccdd6d  # v2.4.0
         - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8  # v4.0.2
           with: { node-version: 20, cache: pnpm, cache-dependency-path: Code/pnpm-lock.yaml }
         - run: pnpm install --frozen-lockfile
           working-directory: Code
         - run: pnpm audit --audit-level=high
           working-directory: Code
         - run: pnpm typecheck
           working-directory: Code
         - run: pnpm lint
           working-directory: Code
         - run: pnpm test
           working-directory: Code
   ```
   - **Pin all actions to commit SHAs**: Tags like `@v4` can be moved maliciously.
     SHA pins are immutable. Add a comment with the version for readability.
   - **Minimal token permissions**: Default `permissions: contents: read` at workflow
     level. Only escalate per-job (e.g., `security-events: write` for CodeQL).
   - **Dependency audit in CI**: `pnpm audit --audit-level=high` fails the build
     on high/critical vulnerabilities.
   - Cache pnpm store: `cache-dependency-path: Code/pnpm-lock.yaml`
   - All commands run from `Code/` working-directory (not repo root)

8. **CodeQL scanning** (`.github/workflows/codeql.yml`):
   ```yaml
   name: CodeQL Analysis
   on:
     push: { branches: [main] }
     pull_request: { branches: [main] }
     schedule:
       - cron: '0 6 * * 1'  # Weekly Monday
   permissions:
     security-events: write
     contents: read
   jobs:
     analyze:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@SHA
         - uses: github/codeql-action/init@SHA
           with: { languages: javascript-typescript }
         - uses: github/codeql-action/analyze@SHA
   ```
   Detects XSS, injection, path traversal, hardcoded credentials, prototype pollution.

9. **Fork workflow security**:
   - Use `pull_request` trigger for untrusted fork PRs (no secret access -- safe)
   - NEVER use `pull_request_target` with `actions/checkout` of fork code + secret access
   - If secrets are needed for fork validation, use a two-workflow pattern:
     1. `pull_request` runs tests without secrets
     2. `workflow_run` runs trusted checks after PR workflow completes
   - Never expose secrets in PR logs or artifact uploads

10. **OpenSSF Scorecard** (optional, run as GitHub Action):
   - Continuously audits: branch protection, token permissions, dependency hygiene,
     vulnerability disclosure, signed releases, code review requirements
   - Run weekly in CI to detect security posture drift
   - Results publishable as a badge in README

11. **PR review checklist**:
   - [ ] No secrets or .env values in diff
   - [ ] All new env vars added to .env.example
   - [ ] No `any` types added
   - [ ] New API endpoints have rate limiting and input validation
   - [ ] Database changes include migration + 000_full_schema.sql update
   - [ ] ASCII-safe text in all UI strings

12. **Public repo sync** (private -> `whitevo/coordination-manager-public`):
   - The public repo is a curated snapshot of private `main`, NOT a mirror.
   - Full workflow, exclusion list, and safety checks live in the
     [open-source-pipeline](../open-source-pipeline/SKILL.md) skill.
   - Use that skill whenever publishing a public snapshot or adding a
     new private-only file pattern.

13. **Security habits**:
   | Habit | Frequency |
   |-------|-----------|
   | Check Dependabot alerts | Weekly |
   | Review secret scanning alerts | Immediately |
   | Rotate exposed secrets | Immediately |
   | Audit repo access | Monthly |
   | Review PR diffs for hardcoded secrets | Every PR |
   | Check OpenSSF Scorecard | Weekly |
   | Verify action SHA pins when updating CI | Every CI change |
   | Run `pnpm audit` | Every CI run |

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Repository config | GitHub settings | Branch protection + security |
| .gitignore | Text file | Repo root + Code/ |
| CI workflow | YAML | `.github/workflows/ci.yml` |

## Constraints

- NEVER force push to main
- NEVER commit secrets or credentials to the repository
- NEVER use mutable tag references for GitHub Actions (pin to commit SHA)
- NEVER expose secrets to fork PR workflows (pull_request_target + checkout)
- All changes to main MUST go through pull requests
- Branch names MUST follow feature/*, fix/*, chore/* convention
- Commit messages MUST use conventional commit format
- GITHUB_TOKEN MUST default to minimal permissions (contents: read)
- Vercel and Railway auto-deploy from main -- broken main breaks production
- CI working-directory must be `Code/` (not repo root)
- CI MUST run `pnpm audit --audit-level=high` to catch vulnerable deps

## Self-Validation

### Trigger Indicators
- [ ] User asked about branching, commits, PRs, or CI/CD
- [ ] Task involves creating a branch or writing commit messages
- [ ] User mentioned GitHub settings or security features

### Completion Markers
- [ ] Branch follows naming convention
- [ ] Commit messages use conventional format
- [ ] .gitignore covers all sensitive and build files

### Quality Signals
- [ ] No secrets in any committed files
- [ ] All commits follow conventional format
- [ ] PRs required for changes to main
- [ ] CI runs typecheck + lint + test on PRs
- [ ] PR review checklist used before merge

### Lint Checks
- [ ] No .env files with real values in git staging
- [ ] .gitignore includes all required patterns
- [ ] Branch name matches convention

---
description: Dependency governance, CI supply-chain hardening, SBOM, and pnpm security
---

# supply-chain-security

## Purpose

Guides JavaScript/TypeScript supply-chain security across the pnpm monorepo: dependency
governance, CI/CD workflow hardening, SBOM generation, build provenance, and continuous
dependency monitoring. Based on OWASP Top 10:2025, SLSA framework, and OpenSSF Scorecard.

## When to Use

- Adding or updating dependencies in any workspace package
- Configuring CI/CD pipelines or GitHub Actions
- Auditing dependency health or responding to vulnerability alerts
- Preparing releases with SBOM or provenance artifacts
- Reviewing pnpm configuration for security controls
- Responding to compromised package advisories

## Workflow

1. Identify action type: audit, configure, generate-sbom, review-ci, or respond-to-advisory
2. For **audit**: run `pnpm audit` from `Code/` directory, review high/critical findings
3. For **configure**: verify pnpm.onlyBuiltDependencies and blockExoticSubdeps are set (see references)
4. For **add dependency**: check package health (maintenance, downloads, transitive deps), verify no suspicious postinstall scripts, use `pnpm why <package>` to understand dep tree
5. For **CI hardening**: pin all GitHub Actions to commit SHAs, set minimal token permissions, use `pull_request` (not `pull_request_target`) for untrusted code
6. For **SBOM**: generate CycloneDX JSON with `npx @cyclonedx/cyclonedx-npm`, include in release artifacts
7. For **advisory response**: follow incident response checklist (check exposure, pin safe version, audit lockfile, rotate credentials if needed)
8. Document any overrides or incident responses in team security channel
9. Run OpenSSF Scorecard weekly to track supply-chain posture drift

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Audit report | CI logs / terminal | pnpm audit output |
| pnpm config | `Code/package.json` | JSON (pnpm key) |
| CI workflow | `.github/workflows/*.yml` | YAML with SHA-pinned actions |
| SBOM | Release artifacts | CycloneDX JSON |
| Override docs | `Code/package.json` comments | Inline justification |
| Incident report | Security channel | Markdown summary |

## Constraints

- NEVER use `dangerouslyAllowAllBuilds` in pnpm config
- NEVER use mutable tag references for GitHub Actions in CI (pin to SHA)
- NEVER expose secrets to untrusted PR contexts (fork workflows)
- ALWAYS use `--frozen-lockfile` in CI installs (reproducible builds)
- ALWAYS audit before deploying (fail CI on high/critical vulns)
- Keep pnpm up to date for integrity hashing fixes
- Document all pnpm.overrides with reason and review date

## Self-Validation

### Trigger Indicators
- [ ] User asks about dependencies, npm audit, supply chain, or CI security
- [ ] Dependabot alert or vulnerability advisory needs response
- [ ] New dependency being added to any workspace package
- [ ] CI/CD pipeline being created or modified

### Completion Markers
- [ ] pnpm config includes blockExoticSubdeps and onlyBuiltDependencies
- [ ] CI workflow pins actions to SHAs with minimal token permissions
- [ ] pnpm audit passes or overrides are documented with justification
- [ ] SBOM generated for release artifacts (if release workflow)

### Quality Signals
- [ ] No exotic subdependency sources in lockfile
- [ ] All CI actions pinned to immutable SHAs (not tags)
- [ ] Dependabot alerts at zero or documented overrides
- [ ] OpenSSF Scorecard score stable or improving

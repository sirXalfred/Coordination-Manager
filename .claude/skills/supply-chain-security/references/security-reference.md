# Supply Chain Security Reference

## pnpm Configuration

### Required settings (in `Code/package.json` under `"pnpm"` key):

```jsonc
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "chacha-native"],
  "blockExoticSubdeps": true
}
```

- **onlyBuiltDependencies**: Restricts which packages can run install scripts
  (postinstall, preinstall). Limits blast radius of supply-chain attacks.
- **blockExoticSubdeps**: Prevents transitive dependencies from pulling packages
  from git URLs, direct tarball URLs, or other untrusted locations.

### Override pattern for transitive vulns:

```jsonc
"pnpm": {
  "overrides": {
    "vulnerable-package": ">=2.0.1"
  }
}
```

## GitHub Actions Security

### Token permissions (minimal by default):
```yaml
permissions:
  contents: read

jobs:
  check:
    permissions:
      contents: read
      security-events: write  # only if CodeQL needs it
```

### Pin actions to commit SHAs:
```yaml
# GOOD: pinned to immutable SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
- uses: pnpm/action-setup@a3252b78c470c02df07e9d59298aecedc3ccdd6d  # v2.4.0
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8  # v4.0.2

# BAD: mutable tag reference
- uses: actions/checkout@v4
```

### Fork workflow security:
- Never use `pull_request_target` with checkout of PR code + secret access
- Use `pull_request` trigger for untrusted code (no secret access)
- Two-workflow pattern if secrets needed: `pull_request` (no secrets) + `workflow_run` (trusted)

## CodeQL Configuration

```yaml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6am

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@SHA
      - uses: github/codeql-action/init@SHA
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@SHA
```

## SBOM Generation

```bash
# Using CycloneDX (recommended for npm/pnpm ecosystems)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json --output-format json
```

- Formats: CycloneDX (JSON/XML) or SPDX
- Include in release artifacts alongside the build
- SLSA Level 1+: locked dependencies (`--frozen-lockfile`), provenance metadata

## Incident Response (Compromised Package)

1. Check exposure: `pnpm why <package>`
2. Pin to known-good version via `pnpm.overrides`
3. Verify integrity: `pnpm install --frozen-lockfile`
4. Check for postinstall scripts in the compromised package
5. Rotate credentials if package could access env vars during install
6. Update lockfile once patched version available
7. Document incident and response

## Ongoing Habits

| Habit | Frequency |
|-------|-----------|
| Run `pnpm audit` | Every CI run |
| Review Dependabot alerts | Weekly |
| Update dependencies | Monthly (patch), quarterly (minor/major) |
| Regenerate SBOM | Each release |
| Review pnpm.overrides | Monthly (remove stale overrides) |
| Check OpenSSF Scorecard | Weekly (automated in CI) |
| Verify action SHA pins | When updating CI workflows |

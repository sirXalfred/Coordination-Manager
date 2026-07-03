# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Coordination Manager, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@coordinationmanager.com** (or contact the maintainers directly via GitHub)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 1 week
- **Fix/Patch:** As soon as possible, depending on severity

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅         |
| Older   | ❌         |

## Security Practices

- All API endpoints require authentication via Supabase JWT
- Row Level Security (RLS) is enabled on all database tables
- Rate limiting is applied to all API routes
- Error messages are sanitized in production to prevent information leakage
- Discord bot messages suppress all mention parsing (`@everyone`, `@here`, `@role`)
- Internal bot-to-API communication requires a shared secret
- Security headers (X-Frame-Options, CSP, etc.) are applied to the frontend

## Secret & Key Rotation

### When to Rotate

- **Immediately** if a secret is suspected to be compromised or accidentally exposed
- **Proactively** on a regular schedule (e.g. annually) for defense-in-depth and to have a muscle memory to protect our data

### Secrets Inventory

| Secret | Location | Rotation Impact |
|--------|----------|-----------------|
| `JWT_SECRET` | API `.env` | HMAC-signs OAuth state & wallet credentials. Rotating invalidates in-flight OAuth flows. Rotate during low-traffic window. |
| `SUPABASE_SERVICE_ROLE_KEY` | API `.env` | Full DB access. Rotate via Supabase dashboard, then update env vars on Railway. |
| `BOT_API_SECRET` | API + Bot `.env` | Shared secret for bot-to-API calls. Update both services simultaneously. |
| `SMTP_ENCRYPTION_KEY` | API `.env` | Encrypts stored SMTP passwords (AES-256-GCM). Requires re-encryption migration (see below). |
| `DISCORD_BOT_TOKEN` | Bot `.env` | Regenerate in Discord Developer Portal, then update Railway env. |
| `GOOGLE_CLIENT_SECRET` | API `.env` | Regenerate in Google Cloud Console. Existing OAuth tokens remain valid. |

### SMTP Encryption Key Rotation Procedure

1. Set `SMTP_ENCRYPTION_KEY_OLD` to the current key value
2. Set `SMTP_ENCRYPTION_KEY` to the new key value
3. Run re-encryption: for each stored SMTP config, decrypt with old key, re-encrypt with new key, update the row
4. Verify all SMTP configs still work (send test emails)
5. Remove `SMTP_ENCRYPTION_KEY_OLD` from env

### General Rotation Steps

1. Generate the new secret (use `openssl rand -hex 32` or equivalent)
2. Update the env var in the deployment platform (Railway, Vercel)
3. Restart the affected service(s)
4. Verify functionality with unit tests (OAuth flows, bot communication, email delivery)
5. Revoke or delete the old secret where applicable (e.g. Discord token, Google secret)

## Security Testing

We maintain a private security test suite that covers authentication bypass,
rate limiting, Discord abuse scenarios, and data exposure tests.
If you're contributing and need access to security tests, contact the maintainers.

## Secret Scanning Tooling

This project uses [Gitleaks](https://github.com/gitleaks/gitleaks) for secret detection.
Gitleaks scans the full git history (`git log -p`) and the working tree for hardcoded
credentials, API keys, tokens, and private keys.

- Local developer gate: `pnpm security:check` (from repo root)
- CI gate: runs on every PR and push to `main` via `.github/workflows/ci.yml`
- Pre-release: full-history scan before every public milestone sync

If Gitleaks is not installed, run `pnpm security:check -InstallGitleaks` or install
manually via `winget install --id Gitleaks.Gitleaks --exact`.

# Platform Dashboard Settings

Configuration tables for each platform's security settings.
These are **manual dashboard actions** -- they cannot be automated via code.

> **NOTE**: These paths and settings are specific to the Coordination Manager project.
> Adjust service names, URLs, and project IDs for other deployments.

## Supabase (Manual -- Dashboard)

| Setting | Action |
|---------|--------|
| RLS on ALL tables | Verify green "RLS" badge on every table |
| Auth rate limits | Lower email sign-ups/hr and token refreshes/hr to reasonable numbers |
| JWT expiry | Set to 3600s (1 hour) or less |
| Email confirmations | Enable "Confirm email" for account verification |
| Unused auth providers | Disable providers not in use |
| pgAudit extension | Enable to audit DDL and writes on sensitive tables |

## Vercel (Manual -- Dashboard)

| Setting | Action |
|---------|--------|
| Deployment Protection | Enable for preview deployments |
| RBAC | Restrict Admin role to core team |
| Git branch protection | Only deploy from `main`; require PR reviews |

## Railway (Manual -- Dashboard)

| Setting | Action |
|---------|--------|
| Private networking | Enable between API and Discord bot; use internal DNS |
| Environment isolation | Separate production and staging secrets |
| Restart policy | Set crash restart limits to detect crash loops |

## Discord Developer Portal (Manual -- Dashboard)

| Setting | Action |
|---------|--------|
| Privileged Intents | Disable MessageContent if bot only uses slash commands |
| Bot Permissions | Verify minimum permissions (currently 3072: Send Messages + Read Message History) |
| Bot Token | Regenerate if ever exposed in commits or logs |

## Secret Rotation Schedule

| Secret | Frequency |
|--------|-----------|
| SUPABASE_SERVICE_ROLE_KEY | Every 6 months or after suspected leak |
| JWT_SECRET | Every 6 months |
| DISCORD_BOT_TOKEN | After any suspected exposure |
| GOOGLE_CLIENT_SECRET | After any suspected exposure |
| BOT_API_SECRET | Every 6 months |

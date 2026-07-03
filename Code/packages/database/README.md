# Database Package

Contains the SQL schema for the Coordination Manager application, targeting Supabase (PostgreSQL).

## Setup

For a fresh database, run the consolidated schema:

```sql
-- Copy and run in Supabase SQL Editor:
-- migrations/000_full_schema.sql
```

This creates all required tables, indexes, RLS policies, and functions.

## Tables

| Table | Purpose |
|-------|---------|
| `public.users` | User profiles (linked to `auth.users`) |
| `calendars` | Coordination calendars with config and permissions |
| `availability` | User availability time slots per calendar |
| `meetings` | Confirmed meetings within calendars |
| `calendar_sources` | External calendar connections (Google OAuth, public URLs) |
| `discord_integrations` | Links platform users to their Discord accounts |
| `discord_guild_channels` | Discord server channels enabled for announcements |
| `announcement_templates` | Reusable announcement message templates |
| `announcement_schedules` | Scheduled announcement deliveries with targets |
| `announcement_delivery_log` | Per-target delivery status tracking |

## Schema

The full schema lives in a single idempotent file:

- `migrations/000_full_schema.sql` — All tables, indexes, RLS policies, triggers, and functions

Feature migrations are flat files in `migrations/` with `000_` prefixes:

- `migrations/000_feature-agent-platform.sql`
- `migrations/000_feature-announcements-and-comms.sql`
- `migrations/000_feature-discord-guardian.sql`
- `migrations/000_feature-feedback.sql`
- `migrations/000_feature-integrations.sql`
- `migrations/000_feature-maintenance-and-seeding.sql`
- `migrations/000_feature-network.sql`
- `migrations/000_feature-security.sql`
- `migrations/000_feature-time-and-calendar.sql`
- `migrations/000_feature-wallet-and-auth.sql`

Examples:

- `migrations/000_feature-discord-guardian.sql`
- `migrations/000_feature-time-and-calendar.sql`

Historical per-step files were removed during migration cleanup.

See `migrations/README.md` for a feature-to-migration index.

Copy and run it in the Supabase SQL Editor to set up a fresh database.

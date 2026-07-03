---
name: supabase-database
description: Manage Supabase schema, migrations, RLS policies, and database patterns
---

# supabase-database

## Purpose

Guides database work with Supabase (PostgreSQL) including schema design, migrations, Row Level Security policies, and the project's established patterns for identity, JSONB configs, and hash-based lookups.

## When to Use

- Creating or modifying database tables
- Writing SQL migrations in `Code/packages/database/migrations/`
- Adding or updating RLS policies
- Working with JSONB columns (config, time_slots, theme_preferences)
- Implementing traveler account expiry or cleanup logic
- Adding indexes for performance

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Table or feature name | User provides | yes |
| Column definitions | User describes the data model | yes |
| Access patterns | Who reads/writes and when | no |

## Workflow

1. **Write the migration**: Create `Code/packages/database/migrations/NNN_{description}.sql`
   - Use next sequential number after existing migrations
   - Also update `000_full_schema.sql` to keep the consolidated schema current
   - Use `CREATE TABLE IF NOT EXISTS` and `DO $$ BEGIN ... END $$` for idempotency

2. **Follow established column patterns**:
   - Primary key: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
   - Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
   - Foreign keys: `REFERENCES {table}(id) ON DELETE CASCADE` where appropriate
   - JSONB for flexible config: `config JSONB`, `time_slots JSONB`, `theme_preferences JSONB`
   - Text constraints: `CHECK (column IN ('value1', 'value2'))` for enums

3. **Identity patterns** (critical for this project):
   - `created_by TEXT` -- can hold UUID, email, traveler_name, or wallet_address
   - `creator_account_type TEXT CHECK (account_type IN ('google', 'traveler', 'cardano'))`
   - Users table links: `id UUID REFERENCES auth.users(id)`
   - `wallet_address TEXT` -- for Cardano wallet lookup after account merge
   - `expires_at TIMESTAMPTZ` -- for traveler auto-expiry (64 days)
   - Nullable unique indexes: `CREATE UNIQUE INDEX ... WHERE column IS NOT NULL`
     (used for `email` and `google_id` which are null for travelers)

4. **Hash-based lookup** (for public-facing URLs):
   - `hash TEXT UNIQUE NOT NULL` -- nanoid(10) generated in app layer
   - Index: `CREATE INDEX idx_{table}_hash ON {table}(hash)`
   - Public interface uses hash; UUIDs stay internal

5. **Add RLS policies**:
   - Enable RLS: `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY`
   - Public read: `CREATE POLICY "name" ON {table} FOR SELECT USING (true)`
   - Owner write: `CREATE POLICY "name" ON {table} FOR UPDATE USING (auth.uid() = user_id)`
   - Service-only: `CREATE POLICY "Deny all" ON {table} FOR SELECT USING (false)`
   - App-layer enforcement supplements RLS (e.g., hash-gated calendar access)
   - Backend uses `supabaseAdmin` (service role) to bypass RLS when needed
   - **View security**: Views bypass RLS by default (security definer context).
     On Postgres 15+, use `CREATE VIEW ... WITH (security_invoker = true)` so the
     view executes with the calling user's permissions. For older versions, revoke
     direct access to the view or place it in an unexposed schema.

6. **RLS regression testing** (release gate):
   OWASP API BOLA guidance: write tests for authorization mechanisms and don't deploy
   changes that break them. A pragmatic RLS test suite should prove:
   - **Cross-tenant reads fail**: User A cannot SELECT User B's objects
   - **Cross-tenant writes fail**: User A cannot UPDATE/DELETE User B's rows
   - **Insert ownership enforced**: New rows must have created_by / user_id
     consistent with session identity
   - **Privileged operations guarded**: Admin actions require roles stored in
     `raw_app_meta_data` (not user-writable `raw_user_meta_data`)
   - **Performance checked**: Index columns used in policy expressions to avoid
     full table scans. Use `EXPLAIN ANALYZE` to verify policy performance.
   Run these tests in CI for any PR that modifies migrations or RLS policies.

7. **JWT and authorization data placement**:
   - Supabase JWTs are foundational to RLS -- policies use `auth.uid()` and claims
   - **NEVER store authorization data in `raw_user_meta_data`** -- end users can
     modify this via `supabase.auth.updateUser()`. It is NOT safe for roles/permissions.
   - **USE `raw_app_meta_data`** for authorization decisions (roles, permissions,
     account type) -- this is NOT user-modifiable and requires service role to change.
   - **JWT freshness**: JWT data won't reflect changes until the token is refreshed.
     After role/permission changes, force a token refresh before relying on new claims.
   - Helper functions: use `auth.uid()` and `auth.jwt()` in policy expressions

8. **Add indexes** (including partial indexes for filtered queries):
   - Hash lookups: `CREATE INDEX idx_{table}_hash ON {table}(hash)`
   - Visibility filters: `CREATE INDEX idx_{table}_visibility ON {table}(visibility)`
   - Foreign keys: `CREATE INDEX idx_{table}_{fk} ON {table}({fk_column})`
   - Account type: `CREATE INDEX idx_users_account_type ON users(account_type)`
   - Expiry queries: `CREATE INDEX idx_users_expires_at ON users(expires_at)`
   - Partial indexes for polling: `CREATE INDEX ... WHERE status = 'pending'`
     (used on `announcement_schedules` for efficient scheduled send queries)
   - **RLS policy columns**: Always index columns used in RLS policy expressions
     (e.g., `user_id`, `created_by`) to prevent full table scans on every query

9. **JSONB column conventions**:
   - Calendar config: `{ eventName, timeInterval, meetingHours, dateRange, notes }`
   - Time slots: `["2025-01-15T09:00", "2025-01-15T09:30", ...]` (ISO 8601 cell IDs)
   - Theme preferences: `{ mode, darkThemeId, lightThemeId, customThemes, aiSettings }`
   - Permissions: `{ ... }` (fine-grained calendar access control)
   - Roles: `["user", "admin"]` (JSONB array; auth middleware parses first element + full array)
   - AI settings: `{ preferredModel, sentimentToolEnabled }` (nested in theme_preferences)

10. **Guardian and Discord tables**:
   - `guardian_rule_groups`: `{ guild_id, name, is_enabled, action_delete_message, action_timeout_member, action_timeout_duration, action_ban_member }`
   - `guardian_rules`: `{ group_id, pattern, pattern_type ('regex'|'wildcard'), is_enabled }`
   - `guardian_message_log`: all scanned messages (for dashboard stats)
   - `guardian_flagged_messages`: violations only (for review); edit versioning with incremented version number
   - `discord_integrations`: cascades deactivation to `discord_guild_channels`

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Migration file | .sql | `Code/packages/database/migrations/` |
| Schema update | .sql | `Code/packages/database/migrations/000_full_schema.sql` |

## Constraints

- Migrations MUST be idempotent (safe to re-run)
- NEVER store secrets or API keys in the database
- ALWAYS enable RLS on new tables
- ALWAYS add a policy (even if it is `USING (false)` for service-only tables)
- NEVER store authorization data in `raw_user_meta_data` (user-writable)
- USE `raw_app_meta_data` for roles/permissions (service-role only)
- Views MUST use `security_invoker = true` (Postgres 15+) or be in unexposed schemas
- Index all columns used in RLS policy expressions
- Use `TIMESTAMPTZ` for all timestamp columns (timezone-aware)
- `created_by` is TEXT, not UUID -- it holds multiple identity types
- Keep 000_full_schema.sql in sync with individual migrations
- RLS regression tests required for PRs modifying policies

## Self-Validation

### Trigger Indicators
- [ ] User asked to create/modify database tables or schema
- [ ] Task involves SQL migrations or RLS policies
- [ ] User mentioned Supabase, PostgreSQL, or database

### Completion Markers
- [ ] Migration file created with idempotent SQL
- [ ] RLS enabled and policies defined for new tables
- [ ] 000_full_schema.sql updated to reflect changes
- [ ] Appropriate indexes added (including partial indexes where needed)

### Quality Signals
- [ ] No secrets stored in database columns
- [ ] JSONB patterns match existing conventions (roles as array, nested aiSettings)
- [ ] Identity columns use TEXT type (not UUID) where polymorphic
- [ ] Nullable unique indexes used where columns can be null

### Lint Checks
- [ ] Migration is idempotent (uses IF NOT EXISTS, DO $$ blocks)
- [ ] All new tables have RLS enabled
- [ ] Foreign keys have ON DELETE behavior specified

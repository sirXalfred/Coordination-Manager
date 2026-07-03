# Migrations Layout

This folder is organized for two use cases:

1. Fresh setup: run only `000_full_schema.sql`.
2. Feature updates: run one consolidated SQL file per feature.

## Canonical Baseline

- `000_full_schema.sql` -- single idempotent baseline schema for new environments.

## Feature Files

- `000_feature-agent-platform.sql` -- agent API keys and quota/ethics controls
- `000_feature-announcements-and-comms.sql` -- announcements, DM subscriptions, email contacts, SMTP, invite flows
- `000_feature-discord-guardian.sql` -- guardian moderation schema and operational state tables
- `000_feature-feedback.sql` -- feedback domain, responses, sentiment, attachments
- `000_feature-integrations.sql` -- third-party integrations (Luma, Zoom, embed behavior)
- `000_feature-maintenance-and-seeding.sql` -- cleanup, compatibility, polling, seed/maintenance migrations
- `000_feature-network.sql` -- network relation schemas
- `000_feature-security.sql` -- RLS hardening, policy/search_path fixes, privilege revocations
- `000_feature-time-and-calendar.sql` -- recurrence, event calendar, time-management page schema
- `000_feature-wallet-and-auth.sql` -- Cardano wallet and managed wallet auth support
- `000_feature-misc.sql` -- uncategorized cross-cutting migrations

## Page/Feature Quick Map

- Time Management page -> `000_feature-time-and-calendar.sql`
- Discord Guardian app -> `000_feature-discord-guardian.sql`
- Announcements and DM calendar subscriptions -> `000_feature-announcements-and-comms.sql`
- Feedback pages and agent feedback -> `000_feature-feedback.sql`
- Security/RLS hardening -> `000_feature-security.sql`

## Notes

- Historical incremental files were removed during migration cleanup.
- Keep new changes grouped into the consolidated feature file unless there is a strong reason to split.

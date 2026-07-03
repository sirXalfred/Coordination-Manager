-- Consolidated feature migration file: feature-discord-guardian
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 021_discord_guardian.sql
-- ============================================================
-- Migration 021: Discord Guardian — Moderation Bot Schema
-- Adds tables for:
--   1. guardian_rule_groups — Named groups of regex/filter rules
--   2. guardian_rules — Individual regex patterns or wildcard phrases within a group
--   3. guardian_flagged_messages — Messages flagged by the bot
--   4. guardian_message_log — All scanned messages (recent window for dashboard)
--   5. guardian_config — Bot-level configuration (guilds, channels, etc.)

-- ─── Rule Groups ──────────────────────────────────────────────────────
-- Each group has a name (e.g. "URL-Encoded Phishing Links", "Scam Phrases")
-- and can be enabled/disabled independently.

CREATE TABLE IF NOT EXISTS public.guardian_rule_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Rules ────────────────────────────────────────────────────────────
-- Each rule belongs to a group. Can be a regex pattern or a wildcard phrase.
-- pattern_type: 'regex' | 'wildcard'
--   regex: standard JS regex (stored without delimiters)
--   wildcard: uses * for partial matching, auto-converted to regex at scan time

CREATE TABLE IF NOT EXISTS public.guardian_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.guardian_rule_groups(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'regex' CHECK (pattern_type IN ('regex', 'wildcard')),
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_rules_group_id ON public.guardian_rules(group_id);

-- ─── Flagged Messages ─────────────────────────────────────────────────
-- Messages that matched one or more rules. Stores the message content,
-- author info, which rule matched, and the matched text.

CREATE TABLE IF NOT EXISTS public.guardian_flagged_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  message_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_username TEXT,
  author_display_name TEXT,
  content TEXT,
  referenced_content TEXT,
  matched_rule_id UUID REFERENCES public.guardian_rules(id) ON DELETE SET NULL,
  matched_rule_group_id UUID REFERENCES public.guardian_rule_groups(id) ON DELETE SET NULL,
  matched_rule_group_name TEXT,
  matched_pattern TEXT,
  matched_text TEXT,
  source_type TEXT NOT NULL DEFAULT 'direct' CHECK (source_type IN ('direct', 'reply', 'forward', 'embed')),
  action_taken TEXT DEFAULT 'flagged' CHECK (action_taken IN ('flagged', 'deleted', 'ignored')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_flagged_guild ON public.guardian_flagged_messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_guardian_flagged_author ON public.guardian_flagged_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_guardian_flagged_at ON public.guardian_flagged_messages(flagged_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_flagged_group ON public.guardian_flagged_messages(matched_rule_group_id);

-- ─── Message Log (recent window) ─────────────────────────────────────
-- Stores recent scanned messages for dashboard stats.
-- Should be periodically pruned (keep last 7 days).

CREATE TABLE IF NOT EXISTS public.guardian_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  author_id TEXT NOT NULL,
  author_username TEXT,
  content_preview TEXT,
  was_flagged BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_log_scanned ON public.guardian_message_log(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_log_guild ON public.guardian_message_log(guild_id);

-- ─── Bot Config ───────────────────────────────────────────────────────
-- Stores per-guild configuration for the Demon X bot.

CREATE TABLE IF NOT EXISTS public.guardian_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL UNIQUE,
  guild_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  log_channel_id TEXT,
  scan_replies BOOLEAN DEFAULT TRUE,
  scan_forwards BOOLEAN DEFAULT TRUE,
  scan_embeds BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── RLS Policies ─────────────────────────────────────────────────────
-- Only users with 'moderator' or 'admin' role can access guardian tables.

ALTER TABLE public.guardian_rule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_flagged_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_bot_config ENABLE ROW LEVEL SECURITY;

-- Moderators and admins can read/write all guardian tables
DO $$ BEGIN
  -- Rule Groups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_rule_groups' AND policyname = 'Moderators can manage rule groups') THEN
    CREATE POLICY "Moderators can manage rule groups" ON public.guardian_rule_groups
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;

  -- Rules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_rules' AND policyname = 'Moderators can manage rules') THEN
    CREATE POLICY "Moderators can manage rules" ON public.guardian_rules
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;

  -- Flagged Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_flagged_messages' AND policyname = 'Moderators can view flagged messages') THEN
    CREATE POLICY "Moderators can view flagged messages" ON public.guardian_flagged_messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;

  -- Message Log
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_message_log' AND policyname = 'Moderators can view message log') THEN
    CREATE POLICY "Moderators can view message log" ON public.guardian_message_log
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;

  -- Bot Config
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_bot_config' AND policyname = 'Moderators can manage bot config') THEN
    CREATE POLICY "Moderators can manage bot config" ON public.guardian_bot_config
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;
END $$;


-- END SOURCE: 021_discord_guardian.sql

-- ============================================================
-- BEGIN SOURCE: 022_guardian_flagged_unique.sql
-- ============================================================
-- Migration 022: Add unique constraint on message_id for guardian_flagged_messages
-- Prevents the same message from being flagged multiple times.

-- First, remove duplicates (keep the earliest flagged entry per message_id)
DELETE FROM public.guardian_flagged_messages a
USING public.guardian_flagged_messages b
WHERE a.id > b.id
  AND a.message_id = b.message_id;

-- Add unique constraint
ALTER TABLE public.guardian_flagged_messages
  ADD CONSTRAINT guardian_flagged_messages_message_id_unique UNIQUE (message_id);


-- END SOURCE: 022_guardian_flagged_unique.sql

-- ============================================================
-- BEGIN SOURCE: 023_moderator_role.sql
-- ============================================================
-- Migration 023: Moderator Role Definition & Guardian Access Refinement
--
-- Formally defines the "moderator" role within the Coordination Manager.
-- This role is manually assigned by an admin (not self-service).
-- Admins can overlay the moderator role onto themselves via Settings.
-- Moderators (non-admin) cannot remove the role from themselves.
--
-- ─── Role: moderator ──────────────────────────────────────────────────
--
-- Description:
--   Moderators are trusted community members who oversee Discord moderation
--   through the Discord Guardian system. This role is granted manually by
--   a platform administrator.
--
-- Capabilities:
--   - Access the Discord Guardian moderation dashboard
--   - View flagged messages and message scan logs
--   - Review and take action on flagged content (flag, delete, ignore)
--   - Create, edit, and delete Guardian rule groups
--   - Create, edit, and delete Guardian filter rules (regex/wildcard)
--   - Manage Guardian bot configuration (guilds, channels, scanning options)
--   - View Discord Guardian analytics and statistics
--
-- Limitations (compared to admin):
--   - Cannot manage other users or assign roles
--   - Cannot silence/un-silence user accounts
--   - Cannot access admin-only endpoints or dashboards
--   - Cannot modify platform-wide settings
--
-- Assignment:
--   - For non-admins: Manually granted via SQL by a platform administrator.
--   - For admins: Self-toggle via Settings > Role & Permissions > Moderator Overlay.
--   - Moderators (non-admin) cannot remove the role from themselves.
--   See bottom of this file for the grant/revoke queries.
--
-- Technical:
--   The role is stored in the users.roles JSONB array column.
--   Checked via: hasRole(req, 'moderator') in the API
--   Admin role alone no longer grants Guardian access — admins must
--   enable the Moderator Overlay to get the moderator role added.
--
-- ─── RLS Policy Update ──────────────────────────────────────────────
-- Guardian tables now check ONLY for 'moderator' role (not 'admin').
-- Admins who want Guardian access must have 'moderator' in their roles.

-- Drop old policies that checked for both moderator and admin
DO $$ BEGIN
  -- Rule Groups
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_rule_groups' AND policyname = 'Moderators can manage rule groups') THEN
    DROP POLICY "Moderators can manage rule groups" ON public.guardian_rule_groups;
  END IF;

  -- Rules
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_rules' AND policyname = 'Moderators can manage rules') THEN
    DROP POLICY "Moderators can manage rules" ON public.guardian_rules;
  END IF;

  -- Flagged Messages
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_flagged_messages' AND policyname = 'Moderators can view flagged messages') THEN
    DROP POLICY "Moderators can view flagged messages" ON public.guardian_flagged_messages;
  END IF;

  -- Message Log
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_message_log' AND policyname = 'Moderators can view message log') THEN
    DROP POLICY "Moderators can view message log" ON public.guardian_message_log;
  END IF;

  -- Bot Config
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_bot_config' AND policyname = 'Moderators can manage bot config') THEN
    DROP POLICY "Moderators can manage bot config" ON public.guardian_bot_config;
  END IF;
END $$;

-- Recreate policies checking ONLY for moderator role
CREATE POLICY "Moderators can manage rule groups" ON public.guardian_rule_groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.roles @> '"moderator"'::jsonb
    )
  );

CREATE POLICY "Moderators can manage rules" ON public.guardian_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.roles @> '"moderator"'::jsonb
    )
  );

CREATE POLICY "Moderators can view flagged messages" ON public.guardian_flagged_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.roles @> '"moderator"'::jsonb
    )
  );

CREATE POLICY "Moderators can view message log" ON public.guardian_message_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.roles @> '"moderator"'::jsonb
    )
  );

CREATE POLICY "Moderators can manage bot config" ON public.guardian_bot_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.roles @> '"moderator"'::jsonb
    )
  );

-- ─── Helper: Grant moderator role to a user ──────────────────────────
-- Usage: SELECT grant_moderator_role('user-uuid-here');

CREATE OR REPLACE FUNCTION public.grant_moderator_role(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET roles = CASE
    WHEN roles IS NULL THEN '["moderator", "user"]'::jsonb
    WHEN NOT (roles @> '"moderator"'::jsonb) THEN roles || '"moderator"'::jsonb
    ELSE roles
  END
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Helper: Revoke moderator role from a user ──────────────────────
-- Usage: SELECT revoke_moderator_role('user-uuid-here');

CREATE OR REPLACE FUNCTION public.revoke_moderator_role(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET roles = roles - 'moderator'
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Manual SQL Examples ─────────────────────────────────────────────
--
-- Grant moderator by user ID:
--   SELECT grant_moderator_role('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
--
-- Grant moderator by email:
--   SELECT grant_moderator_role(id) FROM public.users WHERE email = 'user@example.com';
--
-- Revoke moderator:
--   SELECT revoke_moderator_role('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
--
-- List all moderators:
--   SELECT id, name, email FROM public.users WHERE roles @> '"moderator"'::jsonb;


-- END SOURCE: 023_moderator_role.sql

-- ============================================================
-- BEGIN SOURCE: 046_guardian_server_roles.sql
-- ============================================================
-- Migration 046: Discord Guardian — Server Roles & Message Types
-- Adds:
--   1. guardian_server_roles — Cached Discord roles per guild, with ignore toggle
--   2. message_type column on guardian_message_log — Classify empty-content messages

-- ─── Server Roles ─────────────────────────────────────────────────────
-- The bot syncs guild roles here on startup and periodically.
-- Moderators can toggle is_ignored to whitelist certain roles from scanning.

CREATE TABLE IF NOT EXISTS public.guardian_server_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  role_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_color INTEGER DEFAULT 0,
  role_position INTEGER DEFAULT 0,
  is_ignored BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_server_roles_guild ON public.guardian_server_roles(guild_id);

-- ─── Message Type on Log ──────────────────────────────────────────────
-- Classify messages so the dashboard can show meaningful info instead of "(no content)"
-- Values: 'text', 'attachment', 'embed', 'sticker', 'system', 'mixed'

ALTER TABLE public.guardian_message_log
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_embeds BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attachment_types TEXT;

-- ─── RLS for server roles ─────────────────────────────────────────────

ALTER TABLE public.guardian_server_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_server_roles' AND policyname = 'Moderators can manage server roles') THEN
    CREATE POLICY "Moderators can manage server roles" ON public.guardian_server_roles
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;
END $$;


-- END SOURCE: 046_guardian_server_roles.sql

-- ============================================================
-- BEGIN SOURCE: 047_guardian_edit_tracking.sql
-- ============================================================
-- Migration 047: Guardian Edit Tracking & Server Name in Message Log
-- Changes:
--   1. Drop UNIQUE on guardian_message_log.message_id to allow multiple rows per edit
--   2. Add guild_name, channel_name, edit_version, is_edit to guardian_message_log
--   3. Add edit_version, is_edit to guardian_flagged_messages
--   4. Indexes for edit grouping

-- ─── Message Log: allow multiple rows per message_id (edit versions) ──
ALTER TABLE public.guardian_message_log
  DROP CONSTRAINT IF EXISTS guardian_message_log_message_id_key;

-- ─── Message Log: new columns ─────────────────────────────────────────
ALTER TABLE public.guardian_message_log
  ADD COLUMN IF NOT EXISTS guild_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_name TEXT,
  ADD COLUMN IF NOT EXISTS edit_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_edit BOOLEAN DEFAULT FALSE;

-- ─── Flagged Messages: edit tracking ──────────────────────────────────
ALTER TABLE public.guardian_flagged_messages
  ADD COLUMN IF NOT EXISTS edit_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_edit BOOLEAN DEFAULT FALSE;

-- ─── Indexes for fast edit grouping ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guardian_log_message_id ON public.guardian_message_log(message_id);
CREATE INDEX IF NOT EXISTS idx_guardian_log_edit ON public.guardian_message_log(message_id, edit_version DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_flagged_message_edit ON public.guardian_flagged_messages(message_id, edit_version DESC);


-- END SOURCE: 047_guardian_edit_tracking.sql

-- ============================================================
-- BEGIN SOURCE: 047_guardian_group_actions.sql
-- ============================================================
-- Migration 047: Guardian Rule Group Actions
-- Adds configurable bot actions per rule group:
--   - Delete flagged message
--   - Timeout the member for a specified duration
--   - Ban the member from the server

ALTER TABLE public.guardian_rule_groups
  ADD COLUMN IF NOT EXISTS action_delete_message BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS action_timeout_member BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS action_timeout_duration INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS action_ban_member BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.guardian_rule_groups.action_delete_message IS 'Delete the flagged message automatically';
COMMENT ON COLUMN public.guardian_rule_groups.action_timeout_member IS 'Timeout the message author for action_timeout_duration seconds';
COMMENT ON COLUMN public.guardian_rule_groups.action_timeout_duration IS 'Timeout duration in seconds (default 60)';
COMMENT ON COLUMN public.guardian_rule_groups.action_ban_member IS 'Ban the message author from the server';

-- Relax the action_taken CHECK to allow comma-separated action strings
-- (e.g. 'flagged,deleted,timeout,banned')
ALTER TABLE public.guardian_flagged_messages DROP CONSTRAINT IF EXISTS guardian_flagged_messages_action_taken_check;


-- END SOURCE: 047_guardian_group_actions.sql

-- ============================================================
-- BEGIN SOURCE: 048_guardian_channel_settings.sql
-- ============================================================
-- Migration 048: Discord Guardian — Channel Monitoring Settings
-- Adds guardian_server_channels table so server owners can disable
-- monitoring on specific channels instead of fiddling with Discord bot permissions.

CREATE TABLE IF NOT EXISTS public.guardian_server_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_type INTEGER DEFAULT 0,        -- Discord channel type enum (0=text, 2=voice, 5=announcement, etc.)
  is_monitored BOOLEAN DEFAULT TRUE,     -- TRUE = bot scans this channel, FALSE = skip
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_server_channels_guild ON public.guardian_server_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_guardian_server_channels_monitored ON public.guardian_server_channels(guild_id, channel_id) WHERE is_monitored = FALSE;

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.guardian_server_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardian_server_channels' AND policyname = 'Moderators can manage server channels') THEN
    CREATE POLICY "Moderators can manage server channels" ON public.guardian_server_channels
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;
END $$;


-- END SOURCE: 048_guardian_channel_settings.sql

-- ============================================================
-- BEGIN SOURCE: 060_guardian_notifications_and_deletion.sql
-- ============================================================
-- Migration 060: Guardian -- deletion tracking, user notifications, and per-guild notification channels
--
-- Adds:
--   1. Deletion tracking columns on guardian_message_log + guardian_flagged_messages
--      (no new rows -- columns are updated in place when an action is taken)
--   2. DM tracking columns on guardian_flagged_messages so we know we already
--      sent the user their flagged content + reaction prompt
--   3. New guardian_user_responses table to capture reactions ("false flag",
--      "escalate", "republish", "unmute") that users place on the bot's DM
--   4. Two new per-guild notification channel columns on guardian_bot_config:
--        - actions_log_channel_id  (where the bot posts moderation actions)
--        - user_feedback_channel_id (where the bot posts user reaction signals)

-- ---------------------------------------------------------------------
-- 1. Deletion tracking (no new rows -- update existing rows in place)
-- ---------------------------------------------------------------------

ALTER TABLE public.guardian_message_log
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_kind TEXT
    CHECK (deleted_by_kind IS NULL OR deleted_by_kind IN ('bot', 'user', 'moderator', 'unknown'));

ALTER TABLE public.guardian_flagged_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_kind TEXT
    CHECK (deleted_by_kind IS NULL OR deleted_by_kind IN ('bot', 'user', 'moderator', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_guardian_log_deleted_at
  ON public.guardian_message_log(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_flagged_deleted_at
  ON public.guardian_flagged_messages(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. DM tracking on flagged messages
-- ---------------------------------------------------------------------

ALTER TABLE public.guardian_flagged_messages
  ADD COLUMN IF NOT EXISTS dm_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dm_message_id TEXT,
  ADD COLUMN IF NOT EXISTS dm_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS channel_notice_message_id TEXT;

-- Look up flagged record by the DM we sent (used by reaction handler)
CREATE INDEX IF NOT EXISTS idx_guardian_flagged_dm_message_id
  ON public.guardian_flagged_messages(dm_message_id)
  WHERE dm_message_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. User responses (reactions on the bot's DM)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guardian_user_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_message_id UUID NOT NULL REFERENCES public.guardian_flagged_messages(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  response_kind TEXT NOT NULL CHECK (response_kind IN ('false_flag', 'escalate', 'republish', 'unmute')),
  emoji TEXT,
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  resolution_kind TEXT CHECK (resolution_kind IS NULL OR resolution_kind IN ('confirmed', 'rejected', 'republished', 'unmuted', 'no_action')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Idempotency: one row per (flagged_message, user, kind)
  UNIQUE (flagged_message_id, discord_user_id, response_kind)
);

CREATE INDEX IF NOT EXISTS idx_guardian_user_responses_flagged
  ON public.guardian_user_responses(flagged_message_id);
CREATE INDEX IF NOT EXISTS idx_guardian_user_responses_guild
  ON public.guardian_user_responses(guild_id);
CREATE INDEX IF NOT EXISTS idx_guardian_user_responses_unresolved
  ON public.guardian_user_responses(created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.guardian_user_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guardian_user_responses'
      AND policyname = 'Moderators can manage user responses'
  ) THEN
    CREATE POLICY "Moderators can manage user responses" ON public.guardian_user_responses
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Per-guild notification channels
-- ---------------------------------------------------------------------

ALTER TABLE public.guardian_bot_config
  ADD COLUMN IF NOT EXISTS actions_log_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS user_feedback_channel_id TEXT;


-- END SOURCE: 060_guardian_notifications_and_deletion.sql

-- ============================================================
-- BEGIN SOURCE: 061_guardian_seed_invite_rules.sql
-- ============================================================
-- Migration 061: Seed default Discord-invite phishing rules for the Guardian bot
--
-- Real-world scam example that bypassed prior configurations:
--   .-.contact.-.team.<emoji> > >📥👉**<ht > tp > > :////\\\@dis > cord > app > .com/ >
--    invite\<code> > >>**<@<userId>>
--
-- The raw text never contains the literal substring "discord.gg" or
-- "discordapp.com/invite" because Discord markdown control characters
-- (>, *, \, <, >) and stray whitespace fragment the URL. The Guardian bot
-- now scans a deobfuscated variant of the message in addition to the raw
-- text, so the wildcard rules below match both the obfuscated and
-- non-obfuscated forms.
--
-- This migration is idempotent: it only seeds the group + rules if the
-- group does not already exist. Operators may freely edit/disable rules
-- via the Guardian admin UI after seeding.

DO $$
DECLARE
  group_uuid UUID;
BEGIN
  -- Skip if a group with this exact name already exists
  SELECT id INTO group_uuid
  FROM public.guardian_rule_groups
  WHERE name = 'Discord Invite Links (default)'
  LIMIT 1;

  IF group_uuid IS NULL THEN
    INSERT INTO public.guardian_rule_groups (
      name,
      description,
      is_enabled,
      action_delete_message,
      action_timeout_member,
      action_timeout_duration,
      action_ban_member
    ) VALUES (
      'Discord Invite Links (default)',
      'Catches off-server Discord invite links (discord.gg, discord.com/invite, discordapp.com/invite) including obfuscated variants. Same-server channel links are excluded by the bot.',
      TRUE,
      TRUE,   -- delete the message
      FALSE,  -- do not timeout by default; admins can opt in
      60,
      FALSE
    )
    RETURNING id INTO group_uuid;

    INSERT INTO public.guardian_rules (group_id, pattern, pattern_type, description, is_enabled) VALUES
      (group_uuid, '*discord.gg/*',            'wildcard', 'discord.gg invite domain',                     TRUE),
      (group_uuid, '*discord.com/invite*',     'wildcard', 'Canonical Discord invite path',                TRUE),
      (group_uuid, '*discordapp.com/invite*',  'wildcard', 'Legacy discordapp.com invite path',            TRUE),
      (group_uuid, '*discord.com/servers/*',   'wildcard', 'Discord server discovery share links',         TRUE),
      -- Regex catches scheme-prefixed invites with optional userinfo (e.g. "://@discord.com/invite/...")
      (group_uuid, '(?:https?:)?\/{2,}(?:[^\s/@]*@)?discord(?:app)?\.com\/invite\/[A-Za-z0-9-]+', 'regex',
        'Scheme + optional userinfo prefix on canonical invite URL', TRUE),
      (group_uuid, '(?:https?:)?\/{2,}(?:[^\s/@]*@)?discord\.gg\/[A-Za-z0-9-]+', 'regex',
        'Scheme + optional userinfo prefix on discord.gg invite URL', TRUE);
  END IF;
END $$;


-- END SOURCE: 061_guardian_seed_invite_rules.sql

-- ============================================================
-- BEGIN SOURCE: 062_guardian_renumber_duplicate_versions.sql
-- ============================================================
-- Backfill: renumber duplicate v1 rows that came from gateway resumes /
-- duplicate MessageCreate deliveries. The bot now bumps edit_version on
-- repeat inserts (see logMessage / logFlaggedMessage), but rows written
-- before that fix all share edit_version = 1, which makes them appear as
-- separate "first versions" of the same message in the dashboard.
--
-- For each (message_id) that has more than one row, renumber them by
-- chronological insert order (oldest = v1, next = v2, ...) and mark the
-- non-first rows as is_edit = true. Idempotent: the WHERE clause restricts
-- the update to message_ids that actually have duplicates, and the row_number()
-- ordering is deterministic so re-running yields the same numbers.

-- guardian_message_log
DO $$
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY scanned_at, id) AS rn
    FROM guardian_message_log
    WHERE message_id IN (
      SELECT message_id
      FROM guardian_message_log
      WHERE message_id IS NOT NULL AND message_id <> ''
      GROUP BY message_id
      HAVING COUNT(*) > 1
    )
  )
  UPDATE guardian_message_log m
  SET edit_version = r.rn,
      is_edit = (r.rn > 1)
  FROM ranked r
  WHERE m.id = r.id
    AND (m.edit_version IS DISTINCT FROM r.rn OR m.is_edit IS DISTINCT FROM (r.rn > 1));
END $$;

-- guardian_flagged_messages
DO $$
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY flagged_at, id) AS rn
    FROM guardian_flagged_messages
    WHERE message_id IN (
      SELECT message_id
      FROM guardian_flagged_messages
      WHERE message_id IS NOT NULL AND message_id <> ''
      GROUP BY message_id
      HAVING COUNT(*) > 1
    )
  )
  UPDATE guardian_flagged_messages f
  SET edit_version = r.rn,
      is_edit = (r.rn > 1)
  FROM ranked r
  WHERE f.id = r.id
    AND (f.edit_version IS DISTINCT FROM r.rn OR f.is_edit IS DISTINCT FROM (r.rn > 1));
END $$;


-- END SOURCE: 062_guardian_renumber_duplicate_versions.sql

-- ============================================================
-- BEGIN SOURCE: 063_guardian_state_checked_at.sql
-- ============================================================
-- Track when each guardian message had its live state (deleted yes/no) verified
-- against the Discord REST API. This lets the dashboard reconcile only rows
-- that have not been recently checked, and lets us "freeze" rows that have
-- been verified at least once after the 3-day observation window without
-- needing repeated polling.

ALTER TABLE guardian_message_log
  ADD COLUMN IF NOT EXISTS state_checked_at TIMESTAMPTZ;

ALTER TABLE guardian_flagged_messages
  ADD COLUMN IF NOT EXISTS state_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_guardian_message_log_state_checked_at
  ON guardian_message_log (state_checked_at);

CREATE INDEX IF NOT EXISTS idx_guardian_flagged_messages_state_checked_at
  ON guardian_flagged_messages (state_checked_at);


-- END SOURCE: 063_guardian_state_checked_at.sql

-- ============================================================
-- BEGIN SOURCE: 066_guardian_action_log.sql
-- ============================================================
-- Migration 066: Guardian -- per-action audit log
--
-- Adds a dedicated table that records ONE row per moderation action taken
-- by the bot (flag, delete, mute, ban). This enables a clean breakdown
-- chart ("Activity Over Time" by action type) and per-user/per-rule
-- aggregations that the comma-separated action_taken column cannot
-- support without parsing.
--
-- Backwards compatibility: guardian_flagged_messages.action_taken is
-- still written (legacy consumers depend on it). The new table is an
-- additive, normalised mirror.

CREATE TABLE IF NOT EXISTS public.guardian_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What action was taken
  action TEXT NOT NULL CHECK (action IN ('flag', 'delete', 'mute', 'ban')),
  -- Why it was taken
  matched_rule_id UUID REFERENCES public.guardian_rules(id) ON DELETE SET NULL,
  matched_rule_group_id UUID REFERENCES public.guardian_rule_groups(id) ON DELETE SET NULL,
  matched_rule_group_name TEXT,
  matched_pattern TEXT,
  matched_text TEXT,
  source_type TEXT CHECK (source_type IN ('direct', 'reply', 'forward', 'embed')),

  -- Who/where
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  message_id TEXT,
  author_id TEXT,
  author_username TEXT,

  -- Action-specific extras
  duration_seconds INTEGER,         -- non-null for action='mute'
  actor_kind TEXT NOT NULL DEFAULT 'bot'
    CHECK (actor_kind IN ('bot', 'user', 'moderator', 'unknown')),
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,

  -- Cross-reference back to the flagged message row (best effort)
  flagged_message_id UUID REFERENCES public.guardian_flagged_messages(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_action_log_created_at
  ON public.guardian_action_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_action_log_guild_action_time
  ON public.guardian_action_log(guild_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_action_log_author
  ON public.guardian_action_log(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_action_log_message
  ON public.guardian_action_log(message_id);

ALTER TABLE public.guardian_action_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guardian_action_log'
      AND policyname = 'Moderators can read action log'
  ) THEN
    CREATE POLICY "Moderators can read action log" ON public.guardian_action_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND (u.roles @> '"moderator"'::jsonb OR u.roles @> '"admin"'::jsonb)
        )
      );
  END IF;
END $$;

-- Only the service role (bot) inserts; no policy needed for INSERT/UPDATE
-- because RLS denies by default and the bot uses SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS.

COMMENT ON TABLE public.guardian_action_log IS
  'One row per moderation action taken by Demon X. Powers the Activity Over Time chart and per-action aggregations.';


-- END SOURCE: 066_guardian_action_log.sql

-- ============================================================
-- BEGIN SOURCE: 067_guardian_instance_lock.sql
-- ============================================================
-- Migration 067: Guardian -- singleton instance lock
--
-- When more than one guardian bot process is running (e.g. local dev + Railway
-- production both connected to Discord, possibly with different tokens but
-- watching the same guild), Discord can deliver events to both, causing
-- duplicate actions (double DMs, duplicate flag rows, duplicate deletes).
--
-- This table acts as a singleton "leader lease". All guardian instances
-- connect to Discord and keep their gateway warm, but only the instance that
-- currently owns the lease acts on events. The lease is renewed via heartbeat
-- and considered stale if not refreshed within the staleness window, allowing
-- automatic failover when the active instance crashes or is restarted.
--
-- Local dev can intentionally steal the lease via GUARDIAN_FORCE_TAKEOVER=true
-- to test the latest code path while production stays connected but idle.

CREATE TABLE IF NOT EXISTS public.guardian_instance_lock (
  -- Singleton row: only one row ever exists in this table.
  id TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),

  -- Unique per-process identifier (uuid generated at boot).
  instance_id TEXT NOT NULL,

  -- Human-readable label for ops visibility (e.g. 'local-dev', 'railway-prod').
  instance_label TEXT,

  -- When this instance first acquired the current lease.
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Last heartbeat from the lease holder. Used to detect stale leases.
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role only -- bot writes via SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.guardian_instance_lock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guardian_instance_lock'
      AND policyname = 'guardian_instance_lock_deny_all'
  ) THEN
    CREATE POLICY guardian_instance_lock_deny_all
      ON public.guardian_instance_lock
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.guardian_instance_lock IS
  'Singleton leader-lease for the Discord guardian bot. Only the instance whose instance_id matches the row acts on Discord events; others stay connected but idle. Renewed via heartbeat; auto-failover when stale.';


-- END SOURCE: 067_guardian_instance_lock.sql

-- ============================================================
-- BEGIN SOURCE: 068_guardian_instance_lock_force_rls.sql
-- ============================================================
-- Migration 068: Guardian instance lock -- FORCE row-level security
--
-- Migration 067 created guardian_instance_lock with a "deny all" policy and
-- ENABLE ROW LEVEL SECURITY, but did not FORCE it. Without FORCE, the table
-- owner (e.g. the supabase admin role) can bypass RLS, which weakens the
-- "only the service role writes to this table" guarantee documented on the
-- table comment. The Discord guardian bot already uses SUPABASE_SERVICE_ROLE_KEY
-- (which bypasses RLS regardless), so adding FORCE has no functional impact
-- on the bot but closes the owner-bypass gap. Matches the FORCE pattern used
-- by migration 065 on agent_api_keys.

ALTER TABLE public.guardian_instance_lock FORCE ROW LEVEL SECURITY;


-- END SOURCE: 068_guardian_instance_lock_force_rls.sql


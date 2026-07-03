-- ============================================================
-- Coordination Manager — Full Database Schema
-- Run this in the Supabase SQL Editor to set up a fresh database.
-- This script is idempotent (safe to run multiple times).
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USER PROFILES (linked to Supabase auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  google_id TEXT,
  timezone TEXT DEFAULT 'UTC',
  default_reminder_minutes INTEGER DEFAULT 30,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'traveler')),
  account_type TEXT DEFAULT 'google' CHECK (account_type IN ('google', 'traveler')),
  traveler_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  theme_preferences JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN users.theme_preferences IS 'User color theme preferences: mode (light/dark/system), active theme ID, and saved custom themes with full color palettes';

-- Unique constraints that allow NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique ON public.users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_expires_at ON public.users(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users(account_type);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================================
-- 26. TIME MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.time_management_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  sort_order INTEGER NOT NULL DEFAULT 0,
  font_color TEXT NOT NULL DEFAULT '#ffffff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tm_categories_user_id
  ON public.time_management_categories(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tm_categories_user_label
  ON public.time_management_categories(user_id, lower(label));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_categories_label_len_chk'
      AND conrelid = 'public.time_management_categories'::regclass
  ) THEN
    ALTER TABLE public.time_management_categories
      ADD CONSTRAINT tm_categories_label_len_chk
      CHECK (char_length(trim(label)) BETWEEN 1 AND 80);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_categories_color_hex_chk'
      AND conrelid = 'public.time_management_categories'::regclass
  ) THEN
    ALTER TABLE public.time_management_categories
      ADD CONSTRAINT tm_categories_color_hex_chk
      CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_categories_font_color_hex_chk'
      AND conrelid = 'public.time_management_categories'::regclass
  ) THEN
    ALTER TABLE public.time_management_categories
      ADD CONSTRAINT tm_categories_font_color_hex_chk
      CHECK (font_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_categories_sort_order_range_chk'
      AND conrelid = 'public.time_management_categories'::regclass
  ) THEN
    ALTER TABLE public.time_management_categories
      ADD CONSTRAINT tm_categories_sort_order_range_chk
      CHECK (sort_order BETWEEN -10000 AND 10000);
  END IF;
END $$;

ALTER TABLE public.time_management_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'time_management_categories'
      AND policyname = 'Users manage own time-management categories'
  ) THEN
    CREATE POLICY "Users manage own time-management categories"
      ON public.time_management_categories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_tm_categories_updated_at
  ON public.time_management_categories;
CREATE TRIGGER trigger_tm_categories_updated_at
  BEFORE UPDATE ON public.time_management_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.time_management_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  main_color TEXT NOT NULL DEFAULT '#2563eb',
  main_label TEXT NOT NULL DEFAULT 'Coordination Manager Main',
  category_color_display_style TEXT NOT NULL DEFAULT 'horizontal',
  active_mode_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_prefs_color_hex_chk'
      AND conrelid = 'public.time_management_prefs'::regclass
  ) THEN
    ALTER TABLE public.time_management_prefs
      ADD CONSTRAINT tm_prefs_color_hex_chk
      CHECK (main_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_prefs_label_len_chk'
      AND conrelid = 'public.time_management_prefs'::regclass
  ) THEN
    ALTER TABLE public.time_management_prefs
      ADD CONSTRAINT tm_prefs_label_len_chk
      CHECK (char_length(trim(main_label)) BETWEEN 1 AND 80);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_prefs_category_color_display_style_chk'
      AND conrelid = 'public.time_management_prefs'::regclass
  ) THEN
    ALTER TABLE public.time_management_prefs
      ADD CONSTRAINT tm_prefs_category_color_display_style_chk
      CHECK (category_color_display_style IN ('horizontal', 'vertical_left', 'vertical_right'));
  END IF;
END $$;

ALTER TABLE public.time_management_prefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'time_management_prefs'
      AND policyname = 'Users manage own time-management prefs'
  ) THEN
    CREATE POLICY "Users manage own time-management prefs"
      ON public.time_management_prefs FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_tm_prefs_updated_at
  ON public.time_management_prefs;
CREATE TRIGGER trigger_tm_prefs_updated_at
  BEFORE UPDATE ON public.time_management_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.time_management_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  main_color TEXT NOT NULL DEFAULT '#2563eb',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  category_color_display_style TEXT NOT NULL DEFAULT 'horizontal',
  sync_calendars JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_backgrounds JSONB NOT NULL DEFAULT '[]'::jsonb,
  collapsed_background_ids TEXT[] NOT NULL DEFAULT '{}',
  quick_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_quick_templates_in_main BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tm_modes_user_id
  ON public.time_management_modes(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tm_modes_user_name
  ON public.time_management_modes(user_id, lower(name));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_modes_name_len_chk'
      AND conrelid = 'public.time_management_modes'::regclass
  ) THEN
    ALTER TABLE public.time_management_modes
      ADD CONSTRAINT tm_modes_name_len_chk
      CHECK (char_length(trim(name)) BETWEEN 1 AND 80);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_modes_color_hex_chk'
      AND conrelid = 'public.time_management_modes'::regclass
  ) THEN
    ALTER TABLE public.time_management_modes
      ADD CONSTRAINT tm_modes_color_hex_chk
      CHECK (main_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_modes_category_color_display_style_chk'
      AND conrelid = 'public.time_management_modes'::regclass
  ) THEN
    ALTER TABLE public.time_management_modes
      ADD CONSTRAINT tm_modes_category_color_display_style_chk
      CHECK (category_color_display_style IN ('horizontal', 'vertical_left', 'vertical_right'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_modes_slot_minutes_chk'
      AND conrelid = 'public.time_management_modes'::regclass
  ) THEN
    ALTER TABLE public.time_management_modes
      ADD CONSTRAINT tm_modes_slot_minutes_chk
      CHECK (slot_minutes IN (15, 30, 60));
  END IF;
END $$;

ALTER TABLE public.time_management_modes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'time_management_modes'
      AND policyname = 'Users manage own time-management modes'
  ) THEN
    CREATE POLICY "Users manage own time-management modes"
      ON public.time_management_modes FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_tm_modes_updated_at
  ON public.time_management_modes;
CREATE TRIGGER trigger_tm_modes_updated_at
  BEFORE UPDATE ON public.time_management_modes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tm_prefs_active_mode_fk'
      AND conrelid = 'public.time_management_prefs'::regclass
  ) THEN
    ALTER TABLE public.time_management_prefs
      ADD CONSTRAINT tm_prefs_active_mode_fk
      FOREIGN KEY (active_mode_id)
      REFERENCES public.time_management_modes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.user_events
  ADD COLUMN IF NOT EXISTS category_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.user_events
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_events_category_ids
  ON public.user_events USING GIN (category_ids);

-- ============================================================
-- 2. CALENDARS
-- ============================================================

CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hash TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  config JSONB,
  permissions JSONB,
  created_by TEXT,
  visibility TEXT DEFAULT 'unlisted' CHECK (visibility IN ('unlisted', 'public')),
  creator_account_type TEXT DEFAULT 'google',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_hash ON calendars(hash);
CREATE INDEX IF NOT EXISTS idx_calendars_visibility ON calendars(visibility) WHERE visibility = 'public';

-- RLS (hash-based access — broader policies, app layer enforces via hash)
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendars' AND policyname = 'Public calendars are viewable') THEN
    CREATE POLICY "Public calendars are viewable"
    ON public.calendars FOR SELECT
    USING (visibility = 'public' OR visibility = 'unlisted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendars' AND policyname = 'Authenticated users can create calendars') THEN
    CREATE POLICY "Authenticated users can create calendars"
    ON public.calendars FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendars' AND policyname = 'Creator can update own calendars') THEN
    CREATE POLICY "Creator can update own calendars"
    ON public.calendars FOR UPDATE TO authenticated
    USING (created_by = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendars' AND policyname = 'Creator can delete own calendars') THEN
    CREATE POLICY "Creator can delete own calendars"
    ON public.calendars FOR DELETE TO authenticated
    USING (created_by = auth.uid()::text);
  END IF;
END $$;

COMMENT ON POLICY "Public calendars are viewable" ON public.calendars IS 'Allow reading calendars that are public or unlisted (hash-gated at app layer)';
COMMENT ON POLICY "Creator can update own calendars" ON public.calendars IS 'Only the calendar creator can modify it';
COMMENT ON POLICY "Creator can delete own calendars" ON public.calendars IS 'Only the calendar creator can delete it';

-- ============================================================
-- 3. AVAILABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  time_slots JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(calendar_id, username)
);

CREATE INDEX IF NOT EXISTS idx_availability_calendar_id ON availability(calendar_id);

-- RLS (broader — availability is tied to hash-gated calendars, app layer enforces)
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'Availability is viewable for accessible calendars') THEN
    CREATE POLICY "Availability is viewable for accessible calendars" ON public.availability FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'Users can insert availability') THEN
    CREATE POLICY "Users can insert availability" ON public.availability FOR INSERT WITH CHECK (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'Users can update availability') THEN
    CREATE POLICY "Users can update availability" ON public.availability FOR UPDATE USING (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'Users can delete availability') THEN
    CREATE POLICY "Users can delete availability" ON public.availability FOR DELETE USING (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
END $$;

-- ============================================================
-- 4. MEETINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  meeting_link TEXT,
  created_by TEXT,
  time_slots JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_calendar_id ON meetings(calendar_id);

-- RLS (broader — meetings are tied to hash-gated calendars, app layer enforces)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Meetings viewable for calendar members') THEN
    CREATE POLICY "Meetings viewable for calendar members" ON public.meetings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Authenticated users can create meetings') THEN
    CREATE POLICY "Authenticated users can create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Users can update meetings') THEN
    CREATE POLICY "Users can update meetings" ON public.meetings FOR UPDATE TO authenticated USING (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Users can delete meetings') THEN
    CREATE POLICY "Users can delete meetings" ON public.meetings FOR DELETE TO authenticated USING (
      calendar_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
    );
  END IF;
END $$;

-- ============================================================
-- 5. CALENDAR SOURCES (external calendar connections)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE calendar_source_type AS ENUM ('google_oauth', 'google_public_url');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type calendar_source_type NOT NULL,
  google_email TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  public_url TEXT,
  display_name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  last_synced TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sources_user_id ON public.calendar_sources(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sources_google_email
  ON public.calendar_sources(user_id, google_email) WHERE source_type = 'google_oauth';
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sources_public_url
  ON public.calendar_sources(user_id, public_url) WHERE source_type = 'google_public_url';

-- RLS for calendar_sources
ALTER TABLE public.calendar_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_sources' AND policyname = 'Users can view own calendar sources') THEN
    CREATE POLICY "Users can view own calendar sources" ON public.calendar_sources FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_sources' AND policyname = 'Users can insert own calendar sources') THEN
    CREATE POLICY "Users can insert own calendar sources" ON public.calendar_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_sources' AND policyname = 'Users can update own calendar sources') THEN
    CREATE POLICY "Users can update own calendar sources" ON public.calendar_sources FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_sources' AND policyname = 'Users can delete own calendar sources') THEN
    CREATE POLICY "Users can delete own calendar sources" ON public.calendar_sources FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 6. DISCORD INTEGRATIONS (user ↔ Discord link)
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Custom key the user shares with the bot via DM to authenticate
  link_key TEXT UNIQUE NOT NULL,
  link_key_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Populated after user authenticates via Discord OAuth2
  discord_user_id TEXT,
  discord_username TEXT,
  discord_avatar TEXT,

  -- Populated after bot verifies the link_key
  bot_verified BOOLEAN DEFAULT FALSE,
  bot_verified_at TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_integrations_user
  ON discord_integrations(user_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_integrations_discord_user
  ON discord_integrations(discord_user_id) WHERE discord_user_id IS NOT NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_discord_integrations_link_key
  ON discord_integrations(link_key);

ALTER TABLE discord_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discord_integrations' AND policyname = 'Users manage own discord integrations') THEN
    CREATE POLICY "Users manage own discord integrations" ON discord_integrations FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE discord_integrations IS 'Links platform users to their Discord accounts via the Swarm Coordinator bot';

-- ============================================================
-- 7. DISCORD GUILD CHANNELS (servers + channels the bot has access to)
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_guild_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which user added this channel mapping
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES discord_integrations(id) ON DELETE CASCADE,

  -- Discord IDs
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  guild_icon TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,

  -- User-defined label for this channel (e.g. "Raid Announcements")
  label TEXT,

  -- Permission tracking
  bot_can_send BOOLEAN DEFAULT TRUE,
  user_can_send BOOLEAN DEFAULT TRUE,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_channels_user
  ON discord_guild_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_guild_channels_integration
  ON discord_guild_channels(integration_id);

ALTER TABLE discord_guild_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discord_guild_channels' AND policyname = 'Users manage own guild channels') THEN
    CREATE POLICY "Users manage own guild channels" ON discord_guild_channels FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE discord_guild_channels IS 'Discord server channels the user has enabled for announcements';
COMMENT ON COLUMN discord_guild_channels.bot_can_send IS 'Whether the bot has SendMessages permission in this channel';
COMMENT ON COLUMN discord_guild_channels.user_can_send IS 'Whether the linked Discord user has SendMessages permission in this channel';

-- ============================================================
-- 8. ANNOUNCEMENT TEMPLATES (reusable message content)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Optional: linked calendar for meeting-related announcements
  calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,

  -- Tags for filtering / grouping
  tags TEXT[] DEFAULT '{}',

  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_templates_user
  ON announcement_templates(user_id);

ALTER TABLE announcement_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcement_templates' AND policyname = 'Users manage own templates') THEN
    CREATE POLICY "Users manage own templates" ON announcement_templates FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE announcement_templates IS 'Reusable announcement message templates';

-- ============================================================
-- 9. ANNOUNCEMENT SCHEDULES (when to send)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES announcement_templates(id) ON DELETE SET NULL,

  -- Schedule info
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),

  -- Where to send (array of channel references)
  -- Each entry: { "type": "discord_channel" | "discord_dm", "target_id": "...", "label": "..." }
  targets JSONB NOT NULL DEFAULT '[]',

  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_schedules_user
  ON announcement_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_schedules_status
  ON announcement_schedules(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_announcement_schedules_scheduled_at
  ON announcement_schedules(scheduled_at) WHERE status = 'pending';

ALTER TABLE announcement_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcement_schedules' AND policyname = 'Users manage own schedules') THEN
    CREATE POLICY "Users manage own schedules" ON announcement_schedules FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE announcement_schedules IS 'Scheduled announcement deliveries with target channels';

-- ============================================================
-- 10. ANNOUNCEMENT DELIVERY LOG (per-target delivery tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES announcement_schedules(id) ON DELETE CASCADE,

  -- Target info
  channel_type TEXT NOT NULL, -- 'discord_channel', 'discord_dm', 'email', etc.
  target_id TEXT NOT NULL,    -- Discord channel ID, Discord user ID, email address
  target_label TEXT,          -- Human-readable label

  -- Delivery
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  discord_message_id TEXT,    -- For Discord: the sent message ID
  error_message TEXT,
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_schedule
  ON announcement_delivery_log(schedule_id);

ALTER TABLE announcement_delivery_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcement_delivery_log' AND policyname = 'Users view own delivery logs') THEN
    CREATE POLICY "Users view own delivery logs" ON announcement_delivery_log
      FOR SELECT USING (
        schedule_id IN (SELECT id FROM announcement_schedules WHERE user_id = auth.uid())
      );
  END IF;
END $$;

COMMENT ON TABLE announcement_delivery_log IS 'Per-target delivery status tracking for announcements';

-- ============================================================
-- 11. DM OPT-OUTS (recipients block DMs from specific senders)
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_discord_id TEXT NOT NULL,          -- Discord user who opted out
  sender_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL = block all bot DMs

  reason TEXT,                                 -- Optional feedback: 'spam', 'unwanted', etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_opt_outs_unique
  ON dm_opt_outs(recipient_discord_id, COALESCE(sender_user_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_dm_opt_outs_recipient
  ON dm_opt_outs(recipient_discord_id);

COMMENT ON TABLE dm_opt_outs IS 'DM recipients who opted out of receiving messages from specific senders or all bot DMs';

-- RLS — only service_role can manage opt-outs (backend only)
ALTER TABLE public.dm_opt_outs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. DM FIRST-CONTACT TRACKING (intro message sent once per pair)
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_first_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_discord_id TEXT NOT NULL,

  first_sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_first_contacts_unique
  ON dm_first_contacts(sender_user_id, recipient_discord_id);

COMMENT ON TABLE dm_first_contacts IS 'Tracks first-contact between platform senders and DM recipients for intro message logic';

-- RLS — only service_role can manage first-contacts (backend only)
ALTER TABLE public.dm_first_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. FEEDBACK (user + bot submissions)
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who submitted it (one of these will be set)
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- web submissions
  discord_user_id TEXT,                                          -- bot submissions
  discord_username TEXT,                                         -- bot submissions

  -- Content
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'bug', 'feature', 'other')),
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'bot')),

  -- Admin management
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed', 'affirmed')),
  admin_response TEXT,

  -- Attached images (base64 data URLs stored as JSONB array)
  attachments JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users view own feedback') THEN
    CREATE POLICY "Users view own feedback" ON feedback
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users insert own feedback') THEN
    CREATE POLICY "Users insert own feedback" ON feedback
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins view all feedback') THEN
    CREATE POLICY "Admins view all feedback" ON feedback
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins update feedback') THEN
    CREATE POLICY "Admins update feedback" ON feedback
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

COMMENT ON TABLE feedback IS 'User and Discord feedback submissions with admin management';

-- ============================================================
-- 13b. FEEDBACK RESPONSES (threaded admin replies)
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback_id ON feedback_responses(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_created_at ON feedback_responses(created_at ASC);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Users view feedback responses') THEN
    CREATE POLICY "Users view feedback responses" ON feedback_responses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM feedback f
          WHERE f.id = feedback_responses.feedback_id
          AND (
            f.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins insert feedback responses') THEN
    CREATE POLICY "Admins insert feedback responses" ON feedback_responses
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins update own responses') THEN
    CREATE POLICY "Admins update own responses" ON feedback_responses
      FOR UPDATE USING (
        admin_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins delete own responses') THEN
    CREATE POLICY "Admins delete own responses" ON feedback_responses
      FOR DELETE USING (
        admin_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

COMMENT ON TABLE feedback_responses IS 'Admin responses to feedback items, supporting threaded conversations';

-- ============================================================
-- 14. TRIGGERS (auto-update updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS trigger_calendar_sources_updated_at ON public.calendar_sources;
CREATE TRIGGER trigger_calendar_sources_updated_at
  BEFORE UPDATE ON public.calendar_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_discord_integrations_updated_at ON discord_integrations;
CREATE TRIGGER trigger_discord_integrations_updated_at
  BEFORE UPDATE ON discord_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_discord_guild_channels_updated_at ON discord_guild_channels;
CREATE TRIGGER trigger_discord_guild_channels_updated_at
  BEFORE UPDATE ON discord_guild_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_announcement_templates_updated_at ON announcement_templates;
CREATE TRIGGER trigger_announcement_templates_updated_at
  BEFORE UPDATE ON announcement_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_announcement_schedules_updated_at ON announcement_schedules;
CREATE TRIGGER trigger_announcement_schedules_updated_at
  BEFORE UPDATE ON announcement_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_feedback_updated_at ON feedback;
CREATE TRIGGER trigger_feedback_updated_at
  BEFORE UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_feedback_responses_updated_at ON feedback_responses;
CREATE TRIGGER trigger_feedback_responses_updated_at
  BEFORE UPDATE ON feedback_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 15. TRAVELER ACCOUNT CLEANUP
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_travelers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_user RECORD;
BEGIN
  FOR expired_user IN
    SELECT id FROM public.users
    WHERE account_type = 'traveler'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  LOOP
    DELETE FROM availability WHERE calendar_id IN (
      SELECT id FROM calendars WHERE created_by = expired_user.id::text
    );
    DELETE FROM meetings WHERE calendar_id IN (
      SELECT id FROM calendars WHERE created_by = expired_user.id::text
    );
    DELETE FROM calendars WHERE created_by = expired_user.id::text;
    DELETE FROM public.users WHERE id = expired_user.id;
    DELETE FROM auth.users WHERE id = expired_user.id;
  END LOOP;
END;
$$;

-- To schedule daily cleanup in Supabase (enable pg_cron extension first):
-- SELECT cron.schedule('cleanup-expired-travelers', '0 3 * * *', $$ SELECT cleanup_expired_travelers(); $$);

-- ============================================================
-- 16. NETWORK RELATIONS (group calendars/meetings by network)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.networks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.network_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  source_string TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('calendar_title', 'meeting_title', 'description')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.network_mappings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_network_mappings_network_id ON public.network_mappings(network_id);
CREATE INDEX IF NOT EXISTS idx_network_mappings_source_string ON public.network_mappings(source_string);

CREATE TABLE IF NOT EXISTS public.network_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'starts_with', 'exact', 'regex')),
  match_field TEXT NOT NULL CHECK (match_field IN ('calendar_title', 'meeting_title', 'description')),
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.network_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_network_rules_network_id ON public.network_rules(network_id);
CREATE INDEX IF NOT EXISTS idx_network_rules_active ON public.network_rules(is_active) WHERE is_active = true;

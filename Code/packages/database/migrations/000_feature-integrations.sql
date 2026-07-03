-- Consolidated feature migration file: feature-integrations
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 018_luma_integrations.sql
-- ============================================================
-- Luma Event Platform Integration
-- Allows users to connect their Luma account via API key
-- and publish meetings as Luma events.

-- ============================================================
-- LUMA INTEGRATIONS (stores user's Luma API key + account info)
-- ============================================================

CREATE TABLE IF NOT EXISTS luma_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encrypted API key (server-side only — never exposed to frontend)
  api_key_encrypted TEXT NOT NULL,

  -- Luma account info (populated on connect via GET /user/get-self)
  luma_user_id TEXT,
  luma_user_name TEXT,
  luma_user_email TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_luma_integrations_user_id
  ON luma_integrations(user_id);

ALTER TABLE luma_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'luma_integrations' AND policyname = 'Users manage own luma integration') THEN
    CREATE POLICY "Users manage own luma integration" ON luma_integrations FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE luma_integrations IS 'Stores per-user Luma API key and account metadata for event publishing';
COMMENT ON COLUMN luma_integrations.api_key_encrypted IS 'Luma API key — stored encrypted, never returned to frontend';

-- ============================================================
-- LUMA PUBLISHED EVENTS (tracks which meetings were published)
-- ============================================================

CREATE TABLE IF NOT EXISTS luma_published_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL,

  -- Luma event identifiers
  luma_event_id TEXT NOT NULL,
  luma_event_url TEXT,

  -- Snapshot of what was published
  published_title TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_luma_published_events_user_id
  ON luma_published_events(user_id);
CREATE INDEX IF NOT EXISTS idx_luma_published_events_meeting_id
  ON luma_published_events(meeting_id);

ALTER TABLE luma_published_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'luma_published_events' AND policyname = 'Users manage own luma published events') THEN
    CREATE POLICY "Users manage own luma published events" ON luma_published_events FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE luma_published_events IS 'Tracks meetings that have been published as Luma events';


-- END SOURCE: 018_luma_integrations.sql

-- ============================================================
-- BEGIN SOURCE: 019_zoom_integrations.sql
-- ============================================================
-- Zoom Video Conferencing Integration
-- Allows users to connect their Zoom account via OAuth 2.0
-- and create Zoom meetings directly from the calendar.

-- ============================================================
-- ZOOM INTEGRATIONS (stores user's Zoom OAuth tokens)
-- ============================================================

CREATE TABLE IF NOT EXISTS zoom_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encrypted OAuth tokens (server-side only — never exposed to frontend)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,

  -- Zoom account info (populated on connect via GET /v2/users/me)
  zoom_user_id TEXT,
  zoom_email TEXT,
  zoom_display_name TEXT,

  -- Token expiry tracking
  token_expires_at TIMESTAMPTZ,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_integrations_user_id
  ON zoom_integrations(user_id);

ALTER TABLE zoom_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zoom_integrations' AND policyname = 'Users manage own zoom integration') THEN
    CREATE POLICY "Users manage own zoom integration" ON zoom_integrations FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE zoom_integrations IS 'Stores per-user Zoom OAuth tokens and account metadata for meeting creation';
COMMENT ON COLUMN zoom_integrations.access_token_encrypted IS 'Zoom access token — stored encrypted, never returned to frontend';
COMMENT ON COLUMN zoom_integrations.refresh_token_encrypted IS 'Zoom refresh token — stored encrypted, never returned to frontend';


-- END SOURCE: 019_zoom_integrations.sql

-- ============================================================
-- BEGIN SOURCE: 032_suppress_embeds.sql
-- ============================================================
-- 032: Add suppress_embeds flag to announcement_schedules
-- Allows users to suppress Discord link-preview embeds on sent messages

ALTER TABLE public.announcement_schedules
  ADD COLUMN IF NOT EXISTS suppress_embeds BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.announcement_schedules.suppress_embeds IS
  'When true, Discord link-preview embeds are suppressed after sending the message';


-- END SOURCE: 032_suppress_embeds.sql


-- Consolidated feature migration file: feature-maintenance-and-seeding
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 005_polls.sql
-- ============================================================
-- ============================================================
-- 005: Add poll_options support to announcement_schedules
-- Enables reaction-based polling in Discord announcements.
-- The bot adds emoji reactions after sending so members can vote.
-- ============================================================

ALTER TABLE public.announcement_schedules
  ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT NULL;

COMMENT ON COLUMN public.announcement_schedules.poll_options IS
  'Array of {emoji, text} objects for reaction-based polling; bot adds emoji reactions after sending the message';


-- END SOURCE: 005_polls.sql

-- ============================================================
-- BEGIN SOURCE: 020_cleanup_legacy_fields.sql
-- ============================================================
-- ============================================================
-- Migration 020: Clean up legacy/deprecated fields
--
-- 1. Migrate feedback.admin_response values into feedback_responses
--    table (threaded replies system from migration 003).
-- 2. Drop the legacy admin_response column from feedback table.
-- 3. Remove deprecated activeThemeId from any stored JSONB prefs.
--
-- NOTE: ai_feedback.admin_response is NOT touched — it is still
--       actively used and has no threaded replacement yet.
--
-- Run this in the Supabase SQL Editor for existing databases.
-- ============================================================

-- ── 1. Migrate feedback.admin_response → feedback_responses ──────────

-- For every feedback row that has a non-null admin_response, insert
-- a corresponding row into feedback_responses.  Use the first admin
-- user found as the author (the original column had no author info).

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Find the first admin user to attribute legacy responses to
  SELECT id INTO admin_user_id
  FROM public.users
  WHERE roles @> '["admin"]'::jsonb
  ORDER BY created_at ASC
  LIMIT 1;

  -- Only proceed if we have an admin and there are legacy responses
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.feedback_responses (feedback_id, admin_id, message, created_at)
    SELECT
      f.id,
      admin_user_id,
      f.admin_response,
      COALESCE(f.updated_at, f.created_at)
    FROM public.feedback f
    WHERE f.admin_response IS NOT NULL
      AND f.admin_response <> ''
      -- Avoid duplicating if migration is re-run
      AND NOT EXISTS (
        SELECT 1 FROM public.feedback_responses fr
        WHERE fr.feedback_id = f.id
          AND fr.message = f.admin_response
      );
  END IF;
END $$;

-- ── 2. Drop the legacy column ────────────────────────────────────────

ALTER TABLE public.feedback DROP COLUMN IF EXISTS admin_response;

-- ── 3. Strip deprecated activeThemeId from stored theme_preferences ──

UPDATE public.users
SET theme_preferences = theme_preferences - 'activeThemeId'
WHERE theme_preferences ? 'activeThemeId';


-- END SOURCE: 020_cleanup_legacy_fields.sql

-- ============================================================
-- BEGIN SOURCE: 043_drop_legacy_role_column.sql
-- ============================================================
-- Migration 043: Drop legacy `role` TEXT column
--
-- The `roles` JSONB array (added in migration 011) is now the sole source
-- of truth for user roles.  All application code has been updated to use
-- `roles` exclusively, so the old single-value `role` column is no longer
-- needed.
--
-- Step 1: Ensure every user has a populated `roles` array (safety net)

UPDATE public.users
SET roles = CASE
  WHEN role = 'admin'    THEN '["admin", "user"]'::jsonb
  WHEN role = 'traveler' THEN '["traveler"]'::jsonb
  ELSE '["user"]'::jsonb
END
WHERE roles IS NULL;

-- Step 2: Replace any remaining RLS policies that reference the old column

-- Drop old feedback policies that use role = 'admin'
DROP POLICY IF EXISTS "Admin users can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin users can update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can view responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Users view feedback responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admin can insert responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admins insert feedback responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admin can update responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admins update own responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admin can delete responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Admins delete own responses" ON public.feedback_responses;

-- Recreate using roles JSONB check
CREATE POLICY "Admin users can view all feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
  );

CREATE POLICY "Admin users can update feedback" ON public.feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
  );

CREATE POLICY "Users view feedback responses" ON public.feedback_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback f
      WHERE f.id = feedback_responses.feedback_id
      AND (
        f.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
      )
    )
  );

CREATE POLICY "Admins insert feedback responses" ON public.feedback_responses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
  );

CREATE POLICY "Admins update own responses" ON public.feedback_responses
  FOR UPDATE USING (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
  );

CREATE POLICY "Admins delete own responses" ON public.feedback_responses
  FOR DELETE USING (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"'::jsonb)
  );

-- Step 3: Drop the legacy column
ALTER TABLE public.users DROP COLUMN IF EXISTS role;


-- END SOURCE: 043_drop_legacy_role_column.sql

-- ============================================================
-- BEGIN SOURCE: 044_add_signup_source.sql
-- ============================================================
-- Migration 044: Add signup_source column to users table
-- Tracks where each account was created from: 'production', 'localhost', or 'test'
-- This lets the Platform Oversight dashboard separate real users from dev/test accounts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT NULL;

-- Backfill existing accounts using heuristics:
-- 1. Traveler guest.local accounts created when only localhost was running
--    (we can't know for sure, so leave them NULL = unknown)
-- 2. For all existing accounts, mark as 'unknown' so they're distinguishable
--    from future tracked accounts
UPDATE public.users
  SET signup_source = 'unknown'
  WHERE signup_source IS NULL;

COMMENT ON COLUMN public.users.signup_source IS 'Origin of account creation: production, localhost, test, or unknown (pre-tracking)';


-- END SOURCE: 044_add_signup_source.sql

-- ============================================================
-- BEGIN SOURCE: 068_user_event_sync_prefs.sql
-- ============================================================
-- User Event Sync Preferences
-- Persists server-side auto-sync settings so sync continues when user is offline.

CREATE TABLE IF NOT EXISTS public.user_event_sync_prefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_oauth', 'google_public_url', 'coordination_calendar')),
  source_id TEXT NOT NULL,
  auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
  auto_publish_new BOOLEAN NOT NULL DEFAULT FALSE,
  range_months INTEGER NOT NULL DEFAULT 12 CHECK (range_months BETWEEN 1 AND 24),
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_sync_prefs_user_id
  ON public.user_event_sync_prefs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_event_sync_prefs_auto_sync
  ON public.user_event_sync_prefs(auto_sync)
  WHERE auto_sync = TRUE;

ALTER TABLE public.user_event_sync_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_event_sync_prefs'
      AND policyname = 'Users can manage own user event sync prefs'
  ) THEN
    CREATE POLICY "Users can manage own user event sync prefs"
      ON public.user_event_sync_prefs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_event_sync_prefs'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_user_event_sync_prefs_updated_at ON public.user_event_sync_prefs;
    CREATE TRIGGER trigger_user_event_sync_prefs_updated_at
      BEFORE UPDATE ON public.user_event_sync_prefs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- END SOURCE: 068_user_event_sync_prefs.sql


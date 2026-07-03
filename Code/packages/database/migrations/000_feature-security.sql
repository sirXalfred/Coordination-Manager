-- Consolidated feature migration file: feature-security
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 012_security_hardening.sql
-- ============================================================
-- ============================================================
-- Migration 012: Supabase Security Advisor — Hardening
-- Addresses the following warnings:
--   1. RLS Disabled on 6 tables (events, notifications,
--      calendar_syncs, discord_channels, dm_opt_outs,
--      dm_first_contacts)
--   2. Function Search Path Mutable on 5 functions
--   3. RLS Policy Always True on 4 tables (availability,
--      meetings, users, wallet_challenges)
--
-- NOTE: "Leaked Password Protection Disabled" must be toggled
-- on in the Supabase Dashboard → Authentication → Settings.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. ENABLE RLS ON TABLES THAT ARE MISSING IT
-- ────────────────────────────────────────────────────────────
-- events, notifications, calendar_syncs, discord_channels are
-- legacy/planned tables managed exclusively by the backend
-- (service_role bypasses RLS). Enabling RLS with no permissive
-- policies locks them to service_role-only access.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'calendar_syncs') THEN
    ALTER TABLE public.calendar_syncs ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'discord_channels') THEN
    ALTER TABLE public.discord_channels ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- dm_opt_outs & dm_first_contacts are managed by the Discord
-- bot backend (service_role). Lock down direct client access.
ALTER TABLE public.dm_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_first_contacts ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 2. FIX FUNCTION SEARCH PATH MUTABLE
-- ────────────────────────────────────────────────────────────
-- SECURITY DEFINER functions without a fixed search_path are
-- vulnerable to search-path injection. Recreate each function
-- with SET search_path = '' and fully-qualified table names.

-- 2a. update_updated_at_column (trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 2b. cleanup_expired_travelers
CREATE OR REPLACE FUNCTION public.cleanup_expired_travelers()
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
    DELETE FROM public.availability WHERE calendar_id IN (
      SELECT id FROM public.calendars WHERE created_by = expired_user.id::text
    );
    DELETE FROM public.meetings WHERE calendar_id IN (
      SELECT id FROM public.calendars WHERE created_by = expired_user.id::text
    );
    DELETE FROM public.calendars WHERE created_by = expired_user.id::text;
    DELETE FROM public.users WHERE id = expired_user.id;
    DELETE FROM auth.users WHERE id = expired_user.id;
  END LOOP;
END;
$$;

-- 2c. cleanup_expired_wallet_challenges
CREATE OR REPLACE FUNCTION public.cleanup_expired_wallet_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM public.wallet_challenges
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 2d. user_has_role (multi-role helper)
CREATE OR REPLACE FUNCTION public.user_has_role(uid UUID, check_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid
    AND roles @> to_jsonb(check_role)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

-- 2e. update_calendar_sources_updated_at (may exist from manual creation)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_calendar_sources_updated_at'
  ) THEN
    ALTER FUNCTION public.update_calendar_sources_updated_at() SET search_path = '';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. FIX RLS POLICIES WITH USING(true) / WITH CHECK(true)
-- ────────────────────────────────────────────────────────────

-- 3a. availability ──────────────────────────────────────────
-- Replace blanket USING(true) INSERT/UPDATE/DELETE with a
-- check that the referenced calendar actually exists.

DROP POLICY IF EXISTS "Users can insert availability" ON public.availability;
CREATE POLICY "Users can insert availability" ON public.availability
  FOR INSERT WITH CHECK (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

DROP POLICY IF EXISTS "Users can update availability" ON public.availability;
CREATE POLICY "Users can update availability" ON public.availability
  FOR UPDATE USING (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

DROP POLICY IF EXISTS "Users can delete availability" ON public.availability;
CREATE POLICY "Users can delete availability" ON public.availability
  FOR DELETE USING (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

-- 3b. meetings ──────────────────────────────────────────────
-- Similarly validate the calendar exists for INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS "Authenticated users can create meetings" ON public.meetings;
CREATE POLICY "Authenticated users can create meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

DROP POLICY IF EXISTS "Users can update meetings" ON public.meetings;
CREATE POLICY "Users can update meetings" ON public.meetings
  FOR UPDATE TO authenticated USING (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

DROP POLICY IF EXISTS "Users can delete meetings" ON public.meetings;
CREATE POLICY "Users can delete meetings" ON public.meetings
  FOR DELETE TO authenticated USING (
    calendar_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.calendars WHERE id = calendar_id)
  );

-- 3c. users ─────────────────────────────────────────────────
-- "Service role can insert profiles" uses WITH CHECK(true),
-- allowing ANY user to insert arbitrary rows. The service_role
-- bypasses RLS entirely, so this policy is unnecessary.
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.users;

-- 3d. wallet_challenges ─────────────────────────────────────
-- "Service role manages wallet challenges" uses FOR ALL
-- USING(true) WITH CHECK(true), giving everyone full access.
-- service_role bypasses RLS, so drop the policy — only the
-- backend can manage challenges.
DROP POLICY IF EXISTS "Service role manages wallet challenges" ON public.wallet_challenges;


-- END SOURCE: 012_security_hardening.sql

-- ============================================================
-- BEGIN SOURCE: 034_enable_rls_missing_tables.sql
-- ============================================================
-- 034_enable_rls_missing_tables.sql
-- Enable Row Level Security on all public tables flagged by the Supabase linter.

-- ============================================================
-- 1. email_contacts  (owner_user_id)
-- ============================================================
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_contacts' AND policyname = 'Users manage own email contacts') THEN
    CREATE POLICY "Users manage own email contacts" ON public.email_contacts
      FOR ALL USING (auth.uid() = owner_user_id);
  END IF;
END $$;

-- ============================================================
-- 2. notification_preferences  (user_id)
-- ============================================================
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_preferences' AND policyname = 'Users manage own notification preferences') THEN
    CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 3. privacy_settings  (user_id)
-- ============================================================
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'privacy_settings' AND policyname = 'Users manage own privacy settings') THEN
    CREATE POLICY "Users manage own privacy settings" ON public.privacy_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. connection_invites  (sender_user_id / used_by_user_id)
-- ============================================================
ALTER TABLE public.connection_invites ENABLE ROW LEVEL SECURITY;

-- Senders can view and manage their own invites
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'connection_invites' AND policyname = 'Senders manage own invites') THEN
    CREATE POLICY "Senders manage own invites" ON public.connection_invites
      FOR ALL USING (auth.uid() = sender_user_id);
  END IF;
END $$;

-- Recipients can view invites used by them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'connection_invites' AND policyname = 'Recipients view own invites') THEN
    CREATE POLICY "Recipients view own invites" ON public.connection_invites
      FOR SELECT USING (auth.uid() = used_by_user_id);
  END IF;
END $$;

-- ============================================================
-- 5. user_connections  (user_a_id / user_b_id)
-- ============================================================
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_connections' AND policyname = 'Users manage own connections') THEN
    CREATE POLICY "Users manage own connections" ON public.user_connections
      FOR ALL USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
  END IF;
END $$;

-- ============================================================
-- 6. email_opt_outs  (sender_user_id)
-- ============================================================
ALTER TABLE public.email_opt_outs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_opt_outs' AND policyname = 'Users manage own email opt outs') THEN
    CREATE POLICY "Users manage own email opt outs" ON public.email_opt_outs
      FOR ALL USING (auth.uid() = sender_user_id);
  END IF;
END $$;

-- ============================================================
-- 7. email_verification_timeouts  (service-role only)
-- ============================================================
-- No user-facing policies: this table is accessed only via service role.
-- RLS is enabled so the linter is satisfied; service_role bypasses RLS.
ALTER TABLE public.email_verification_timeouts ENABLE ROW LEVEL SECURITY;


-- END SOURCE: 034_enable_rls_missing_tables.sql

-- ============================================================
-- BEGIN SOURCE: 035_fix_search_path_and_permissive_policies.sql
-- ============================================================
-- 035_fix_search_path_and_permissive_policies.sql
-- Fix Supabase linter warnings:
--   1. Set search_path on 6 functions (function_search_path_mutable)
--   2. Replace overly permissive RLS policies (rls_policy_always_true)

-- ============================================================
-- 1. Fix mutable search_path on functions
--    Re-create each function with SET search_path = ''
-- ============================================================

-- 1b. cleanup_expired_invites
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.connection_invites
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 1c. grant_moderator_role
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 1d. update_user_smtp_configs_updated_at
CREATE OR REPLACE FUNCTION public.update_user_smtp_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 1e. revoke_moderator_role
CREATE OR REPLACE FUNCTION public.revoke_moderator_role(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET roles = roles - 'moderator'
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- 2. Fix overly permissive RLS policies
--    These tables are accessed via supabaseAdmin (service role)
--    which bypasses RLS. Replace USING(true) with restrictive
--    policies so direct client access is locked down.
-- ============================================================

-- 2a. governance_ratings
--     Anonymous UUIDs are not in auth.users, so auth.uid() won't match.
--     Service role bypasses RLS. Deny all direct client access.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'governance_ratings') THEN
    DROP POLICY IF EXISTS "Users manage own governance ratings" ON public.governance_ratings;

    CREATE POLICY "Deny direct client access to governance ratings" ON public.governance_ratings
      FOR ALL USING (false);
  END IF;
END $$;

-- 2b. governance_facilitator_sentiments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'governance_facilitator_sentiments') THEN
    DROP POLICY IF EXISTS "Users manage own facilitator sentiments" ON public.governance_facilitator_sentiments;

    CREATE POLICY "Deny direct client access to facilitator sentiments" ON public.governance_facilitator_sentiments
      FOR ALL USING (false);
  END IF;
END $$;


-- END SOURCE: 035_fix_search_path_and_permissive_policies.sql

-- ============================================================
-- BEGIN SOURCE: 036_rls_deny_service_only_tables.sql
-- ============================================================
-- 036_rls_deny_service_only_tables.sql
-- Fix Supabase linter warning: rls_enabled_no_policy
-- These tables are accessed exclusively via service_role (which bypasses RLS).
-- Adding explicit USING(false) policies locks out direct client/anon access
-- and satisfies the linter requirement for at least one policy per RLS-enabled table.

-- ============================================================
-- 1. calendar_syncs
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'calendar_syncs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_syncs' AND schemaname = 'public') THEN
      CREATE POLICY "Deny direct client access to calendar syncs" ON public.calendar_syncs
        FOR ALL USING (false);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. discord_channels
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'discord_channels') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discord_channels' AND schemaname = 'public') THEN
      CREATE POLICY "Deny direct client access to discord channels" ON public.discord_channels
        FOR ALL USING (false);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3. dm_first_contacts
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dm_first_contacts' AND schemaname = 'public') THEN
    CREATE POLICY "Deny direct client access to dm first contacts" ON public.dm_first_contacts
      FOR ALL USING (false);
  END IF;
END $$;

-- ============================================================
-- 4. dm_opt_outs
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dm_opt_outs' AND schemaname = 'public') THEN
    CREATE POLICY "Deny direct client access to dm opt outs" ON public.dm_opt_outs
      FOR ALL USING (false);
  END IF;
END $$;

-- ============================================================
-- 5. email_verification_timeouts
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_verification_timeouts' AND schemaname = 'public') THEN
    CREATE POLICY "Deny direct client access to email verification timeouts" ON public.email_verification_timeouts
      FOR ALL USING (false);
  END IF;
END $$;

-- ============================================================
-- 6. events
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'events') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND schemaname = 'public') THEN
      CREATE POLICY "Deny direct client access to events" ON public.events
        FOR ALL USING (false);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 7. notifications
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public') THEN
      CREATE POLICY "Deny direct client access to notifications" ON public.notifications
        FOR ALL USING (false);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 8. wallet_challenges
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_challenges' AND schemaname = 'public') THEN
    CREATE POLICY "Deny direct client access to wallet challenges" ON public.wallet_challenges
      FOR ALL USING (false);
  END IF;
END $$;


-- END SOURCE: 036_rls_deny_service_only_tables.sql

-- ============================================================
-- BEGIN SOURCE: 056_security_hardening_round2.sql
-- ============================================================
-- ============================================================
-- Security hardening round 2:
--   1. Explicit deny-all RLS policies on dm_opt_ins, dm_calendar_invites
--   2. Create ai_prompt_usage table for database-backed rate limiting
-- ============================================================

-- ── 1. Deny-all RLS policies (service-role bypasses; anon/user role blocked) ──

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dm_opt_ins' AND policyname = 'dm_opt_ins_deny_all') THEN
    CREATE POLICY "dm_opt_ins_deny_all" ON dm_opt_ins FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dm_calendar_invites' AND policyname = 'dm_calendar_invites_deny_all') THEN
    CREATE POLICY "dm_calendar_invites_deny_all" ON dm_calendar_invites FOR ALL USING (false);
  END IF;
END $$;

-- ── 2. AI prompt usage table for database-backed daily rate limiting ──

CREATE TABLE IF NOT EXISTS ai_prompt_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast daily count queries (user_id + created_at)
CREATE INDEX IF NOT EXISTS idx_ai_prompt_usage_user_day
  ON ai_prompt_usage(user_id, created_at DESC);

-- Cleanup: auto-delete rows older than 90 days to prevent unbounded growth
-- (Run periodically via cron or Supabase Edge Function)
COMMENT ON TABLE ai_prompt_usage IS 'Tracks per-user AI prompt usage for daily rate limiting. Rows older than 90 days can be safely deleted.';

-- Enable RLS + deny-all (only accessed via service role from backend)
ALTER TABLE ai_prompt_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_prompt_usage' AND policyname = 'ai_prompt_usage_deny_all') THEN
    CREATE POLICY "ai_prompt_usage_deny_all" ON ai_prompt_usage FOR ALL USING (false);
  END IF;
END $$;


-- END SOURCE: 056_security_hardening_round2.sql

-- ============================================================
-- BEGIN SOURCE: 057_network_relations_rls_write_deny.sql
-- ============================================================
-- 057: Fix incomplete RLS on network_relations tables.
-- Migration 049 only added FOR SELECT deny policies, leaving INSERT/UPDATE/DELETE
-- unprotected for direct anon/authenticated role access. Add explicit deny-all
-- for all write operations. Service role (supabaseAdmin) bypasses RLS and
-- continues to work normally.
--
-- Guard: each block checks whether the table exists before touching it so this
-- migration is idempotent regardless of whether 049 has been applied.

-- networks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'networks') THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'networks' AND policyname = 'networks_deny_all') THEN
      DROP POLICY "networks_deny_all" ON public.networks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'networks' AND policyname = 'networks_deny_all') THEN
      CREATE POLICY "networks_deny_all" ON public.networks FOR ALL USING (false) WITH CHECK (false);
    END IF;
  END IF;
END $$;

-- network_mappings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'network_mappings') THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_mappings' AND policyname = 'network_mappings_deny_all') THEN
      DROP POLICY "network_mappings_deny_all" ON public.network_mappings;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_mappings' AND policyname = 'network_mappings_deny_all') THEN
      CREATE POLICY "network_mappings_deny_all" ON public.network_mappings FOR ALL USING (false) WITH CHECK (false);
    END IF;
  END IF;
END $$;

-- network_rules
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'network_rules') THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_rules' AND policyname = 'network_rules_deny_all') THEN
      DROP POLICY "network_rules_deny_all" ON public.network_rules;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_rules' AND policyname = 'network_rules_deny_all') THEN
      CREATE POLICY "network_rules_deny_all" ON public.network_rules FOR ALL USING (false) WITH CHECK (false);
    END IF;
  END IF;
END $$;


-- END SOURCE: 057_network_relations_rls_write_deny.sql

-- ============================================================
-- BEGIN SOURCE: 064_security_hardening_round3.sql
-- ============================================================
-- ============================================================
-- 064: Security hardening round 3
--   Fixes Supabase database linter warnings (May 2026 scan):
--     1. function_search_path_mutable on 3 governance trigger fns
--     2. rls_policy_always_true on governance_sessions
--     3. anon/authenticated EXECUTE on 6 SECURITY DEFINER fns
--
--   Manual (dashboard-only, NOT in this migration):
--     - auth_leaked_password_protection: enable HaveIBeenPwned check
--       Supabase Dashboard > Authentication > Providers > Email >
--       "Leaked Password Protection" toggle
-- ============================================================

-- ── 1. Set search_path on governance trigger functions ─────────

CREATE OR REPLACE FUNCTION public.update_governance_chart_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_governance_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_governance_chart_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ── 2. Replace permissive governance_sessions policy ───────────
-- Table is accessed exclusively via supabaseAdmin (service role),
-- which bypasses RLS. Replace USING(true) with deny-all so direct
-- anon/authenticated client access is blocked.

DROP POLICY IF EXISTS "Service role full access to governance_sessions" ON public.governance_sessions;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_sessions'
      AND policyname = 'governance_sessions_deny_all'
  ) THEN
    CREATE POLICY "governance_sessions_deny_all" ON public.governance_sessions
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- ── 3. Revoke EXECUTE on SECURITY DEFINER fns from public roles ─
-- These functions are intended to be called from backend service
-- code (supabaseAdmin) only. Revoking from anon + authenticated
-- prevents direct invocation via PostgREST /rest/v1/rpc/*.
-- service_role retains EXECUTE via default grants.

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_invites() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_travelers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_wallet_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_moderator_role(target_user_id UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_moderator_role(target_user_id UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_role(uid UUID, check_role TEXT) FROM PUBLIC, anon, authenticated;


-- END SOURCE: 064_security_hardening_round3.sql

-- ============================================================
-- BEGIN SOURCE: 069_revoke_agent_key_usage_from_anon_authenticated.sql
-- ============================================================
-- Migration 069: Revoke increment_agent_key_usage from anon and authenticated
--
-- Migration 065 created `increment_agent_key_usage(uuid)` as SECURITY DEFINER
-- and ran `REVOKE ALL ... FROM PUBLIC`. However, Supabase grants EXECUTE on
-- functions in the `public` schema to the `anon` and `authenticated` roles
-- by default (via role-level default privileges), and those explicit grants
-- are not removed by `REVOKE ... FROM PUBLIC`. The Supabase database linter
-- (lints 0028 / 0029) flags this because the function is callable via
-- `/rest/v1/rpc/increment_agent_key_usage` by any anon or signed-in user.
--
-- The function is only ever invoked by the API using the service role key
-- (see apps/api/src/routes/agent-api.ts), so it is safe -- and required --
-- to remove the anon/authenticated grants.

REVOKE EXECUTE ON FUNCTION public.increment_agent_key_usage(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_agent_key_usage(UUID) FROM authenticated;

-- Defensive: re-revoke PUBLIC and re-grant service_role in case a later
-- migration accidentally re-grants. Idempotent.
REVOKE ALL ON FUNCTION public.increment_agent_key_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_agent_key_usage(UUID) TO service_role;


-- END SOURCE: 069_revoke_agent_key_usage_from_anon_authenticated.sql


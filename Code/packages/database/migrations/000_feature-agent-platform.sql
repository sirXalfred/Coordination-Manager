-- Consolidated feature migration file: feature-agent-platform
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 007_agent_api_keys.sql
-- ============================================================
-- Agent API Keys — allows AI agents/uAgents to access coordination data
-- via the /api/agent/* endpoints using Bearer token authentication.

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unnamed Agent',
  api_key TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_api_key ON agent_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_user_id ON agent_api_keys(user_id);

-- Enable RLS
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own keys
CREATE POLICY agent_api_keys_select ON agent_api_keys
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY agent_api_keys_insert ON agent_api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY agent_api_keys_update ON agent_api_keys
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY agent_api_keys_delete ON agent_api_keys
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE agent_api_keys IS 'API keys for AI agents and uAgents to access coordination features via /api/agent/*';
COMMENT ON COLUMN agent_api_keys.scopes IS 'Allowed scopes: read, write:calendars, write:meetings, write:announcements, *';
COMMENT ON COLUMN agent_api_keys.api_key IS 'Bearer token. Generated client-side, stored hashed in production (plaintext for MVP).';


-- END SOURCE: 007_agent_api_keys.sql

-- ============================================================
-- BEGIN SOURCE: 010_agent_api_schema_fixes.sql
-- ============================================================
-- ============================================================
-- 010: Fix schema for Agent API compatibility
-- Adds missing columns that the Agent API references:
--   • announcement_templates.is_poll — boolean flag for poll templates
--   • announcement_templates.poll_options — JSONB array of poll choices
-- ============================================================

-- Add poll support columns to announcement_templates
ALTER TABLE public.announcement_templates
  ADD COLUMN IF NOT EXISTS is_poll BOOLEAN DEFAULT FALSE;

ALTER TABLE public.announcement_templates
  ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.announcement_templates.is_poll IS
  'Whether this template represents a poll (reaction-based voting)';

COMMENT ON COLUMN public.announcement_templates.poll_options IS
  'Array of poll option strings (e.g. ["Monday 10am", "Tuesday 2pm"])';


-- END SOURCE: 010_agent_api_schema_fixes.sql

-- ============================================================
-- BEGIN SOURCE: 065_agent_api_keys_ethics_and_quota.sql
-- ============================================================
-- Agent API Keys -- ethics acknowledgement + per-key daily quota
-- Adds columns + an atomic RPC the API can call once per agent request to
-- enforce a rolling 24h request quota without race conditions.
--
-- ack_writes_at:   timestamp the user explicitly opted-in to grant any
--                  non-read scope on this key. NULL means key is read-only.
-- daily_request_limit: per-key cap on requests in a rolling 24h window.
-- rate_window_start / rate_window_count: counter state.

ALTER TABLE agent_api_keys
  ADD COLUMN IF NOT EXISTS ack_writes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_request_limit INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS rate_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rate_window_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN agent_api_keys.ack_writes_at IS
  'Timestamp when the owning user explicitly acknowledged enabling write scopes on this key. NULL means key is read-only regardless of stored scopes.';
COMMENT ON COLUMN agent_api_keys.daily_request_limit IS
  'Maximum requests allowed in a rolling 24h window. Defaults to 1000.';
COMMENT ON COLUMN agent_api_keys.rate_window_start IS
  'Start timestamp of the current 24h rate-limit window. Auto-resets when expired.';
COMMENT ON COLUMN agent_api_keys.rate_window_count IS
  'Number of requests counted in the current 24h window.';

-- Backfill: any pre-existing key that already has a write scope is treated as
-- ack'd at migration time (we cannot retroactively ask the user, and stripping
-- access would break agents in production).
UPDATE agent_api_keys
SET ack_writes_at = now()
WHERE ack_writes_at IS NULL
  AND EXISTS (
    SELECT 1 FROM unnest(scopes) s
    WHERE s LIKE 'write:%' OR s = '*'
  );

-- ─── increment_agent_key_usage(p_key_id) ────────────────────────────────────
-- Atomically:
--   1. Resets the rate window if older than 24h.
--   2. Increments the request counter.
--   3. Updates last_used_at.
--   4. Returns the new count + the configured limit so the caller can decide
--      whether to allow or 429.
-- Caller (service role) is responsible for enforcing the limit.

CREATE OR REPLACE FUNCTION increment_agent_key_usage(p_key_id UUID)
RETURNS TABLE(new_count INT, window_limit INT, window_start TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  UPDATE agent_api_keys
  SET
    rate_window_start = CASE
      WHEN v_now - rate_window_start > INTERVAL '24 hours' THEN v_now
      ELSE rate_window_start
    END,
    rate_window_count = CASE
      WHEN v_now - rate_window_start > INTERVAL '24 hours' THEN 1
      ELSE rate_window_count + 1
    END,
    last_used_at = v_now
  WHERE id = p_key_id
    AND is_active = true
  RETURNING
    rate_window_count,
    daily_request_limit,
    rate_window_start
  INTO new_count, window_limit, window_start;

  -- If the key disappeared or was deactivated between auth lookup and this
  -- call, refuse to emit a row -- otherwise the caller would see a synthetic
  -- zero-limit row and incorrectly let the request through.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_api_key not found or inactive: %', p_key_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION increment_agent_key_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_agent_key_usage(UUID) TO service_role;

COMMENT ON FUNCTION increment_agent_key_usage(UUID) IS
  'Atomic rate-limit counter for agent API keys. Service-role only. Returns new_count, window_limit, and window_start.';

-- ─── RLS sanity ─────────────────────────────────────────────────────────────
-- The new columns above (ack_writes_at, daily_request_limit, rate_window_*)
-- are covered by the existing per-row policies on agent_api_keys (migration
-- 007), which gate every SELECT/INSERT/UPDATE/DELETE on user_id = auth.uid().
-- The service role bypasses RLS, which is correct: only the API can call the
-- usage RPC, and the API enforces ownership before calling it. Re-asserting
-- RLS here in case a future drop-and-recreate forgets to re-enable it.
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_keys FORCE ROW LEVEL SECURITY;


-- END SOURCE: 065_agent_api_keys_ethics_and_quota.sql


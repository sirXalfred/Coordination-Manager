-- Consolidated feature migration file: feature-feedback
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 002_feedback.sql
-- ============================================================
-- ============================================================
-- Migration 002: Feedback System
-- Run this in the Supabase SQL Editor for existing databases.
-- ============================================================

-- ── Feedback table ────────────────────────────────────────────

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

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can see their own feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users view own feedback') THEN
    CREATE POLICY "Users view own feedback" ON feedback
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can insert their own feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users insert own feedback') THEN
    CREATE POLICY "Users insert own feedback" ON feedback
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Admins can see all feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins view all feedback') THEN
    CREATE POLICY "Admins view all feedback" ON feedback
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Admins can update any feedback (status, admin_response)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins update feedback') THEN
    CREATE POLICY "Admins update feedback" ON feedback
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_feedback_updated_at ON feedback;
CREATE TRIGGER trigger_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback IS 'User and Discord feedback submissions with admin management';


-- END SOURCE: 002_feedback.sql

-- ============================================================
-- BEGIN SOURCE: 003_feedback_responses.sql
-- ============================================================
-- ============================================================
-- Migration 003: Feedback Responses & Affirm Status
-- Adds threaded admin replies and 'affirmed' status to feedback.
-- Run this in the Supabase SQL Editor for existing databases.
-- ============================================================

-- ── 1. Add 'affirmed' to the feedback status constraint ───────

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed', 'affirmed'));

-- ── 2. Feedback responses table (threaded admin replies) ──────

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

-- Users can view responses on feedback they can see
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

-- Admins can insert responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins insert feedback responses') THEN
    CREATE POLICY "Admins insert feedback responses" ON feedback_responses
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Admins can update their own responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins update own responses') THEN
    CREATE POLICY "Admins update own responses" ON feedback_responses
      FOR UPDATE USING (
        admin_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Admins can delete their own responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_responses' AND policyname = 'Admins delete own responses') THEN
    CREATE POLICY "Admins delete own responses" ON feedback_responses
      FOR DELETE USING (
        admin_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_feedback_responses_updated_at ON feedback_responses;
CREATE TRIGGER trigger_feedback_responses_updated_at
  BEFORE UPDATE ON feedback_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback_responses IS 'Admin responses to feedback items, supporting threaded conversations';


-- END SOURCE: 003_feedback_responses.sql

-- ============================================================
-- BEGIN SOURCE: 004_feedback_sort_preference.sql
-- ============================================================
-- ============================================================
-- Migration 004: Feedback Status Order Preference
-- Stores a per-user custom status group ordering for feedback.
-- Run this in the Supabase SQL Editor for existing databases.
-- ============================================================

-- Add feedback_status_order column to users table
-- Stores a JSON array of status strings defining the display order,
-- e.g. ["open","reviewed","affirmed","resolved","dismissed"]
-- Default: NULL (uses the built-in pipeline order)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS feedback_status_order JSONB DEFAULT NULL;

COMMENT ON COLUMN public.users.feedback_status_order IS 'Custom status group ordering for the feedback page. JSON array of status strings, e.g. ["open","reviewed","affirmed","resolved","dismissed"]. NULL = default pipeline order.';


-- END SOURCE: 004_feedback_sort_preference.sql

-- ============================================================
-- BEGIN SOURCE: 009_feedback_agent_source.sql
-- ============================================================
-- Migration 009: Allow 'agent' as a feedback source
-- Extends the source CHECK constraint on the feedback table so that
-- AI agents can submit feedback via the Agent API.

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_source_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_source_check
  CHECK (source IN ('web', 'bot', 'agent'));


-- END SOURCE: 009_feedback_agent_source.sql

-- ============================================================
-- BEGIN SOURCE: 011_ai_feedback.sql
-- ============================================================
-- ============================================================
-- Migration 011: Multi-Role System + AI Feedback with Sentiment
-- 1. Converts single `role` TEXT column to `roles` JSONB array
--    so users can hold multiple roles (e.g. admin + oversight).
-- 2. Creates ai_feedback table for sentiment analysis on AI chat.
-- Run this in the Supabase SQL Editor for existing databases.
-- ============================================================

-- ── 1. Convert single role → multi-role JSONB array ───────────

-- Add new roles column (JSONB array of strings)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '["user"]'::jsonb;

-- Migrate existing role data into the array.
-- Admin/oversight get their role + 'user'; travelers get 'traveler'.
UPDATE public.users
SET roles = CASE
  WHEN role = 'admin'     THEN '["admin", "user"]'::jsonb
  WHEN role = 'oversight'  THEN '["oversight", "user"]'::jsonb
  WHEN role = 'traveler'   THEN '["traveler"]'::jsonb
  ELSE '["user"]'::jsonb
END
WHERE roles = '["user"]'::jsonb OR roles IS NULL;

-- Drop the old column constraint (no longer needed)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Keep the old `role` column for now (backward compat) but it's no
-- longer the source of truth. New code reads `roles` JSONB array.

-- Helper function: check if a user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(uid UUID, check_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid
    AND roles @> to_jsonb(check_role)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

COMMENT ON COLUMN public.users.roles IS 'JSONB array of role strings, e.g. ["admin","oversight","user"]. Replaces single-value role column.';

-- ── 2. Update existing RLS policies to use roles JSONB ────────

-- Feedback: admin SELECT
DROP POLICY IF EXISTS "Admins view all feedback" ON feedback;
CREATE POLICY "Admins view all feedback" ON feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
  );

-- Feedback: admin UPDATE
DROP POLICY IF EXISTS "Admins update feedback" ON feedback;
CREATE POLICY "Admins update feedback" ON feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
  );

-- Feedback responses: user SELECT
DROP POLICY IF EXISTS "Users view feedback responses" ON feedback_responses;
CREATE POLICY "Users view feedback responses" ON feedback_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback f
      WHERE f.id = feedback_responses.feedback_id
      AND (
        f.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
      )
    )
  );

-- Feedback responses: admin INSERT
DROP POLICY IF EXISTS "Admins insert feedback responses" ON feedback_responses;
CREATE POLICY "Admins insert feedback responses" ON feedback_responses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
  );

-- Feedback responses: admin UPDATE
DROP POLICY IF EXISTS "Admins update feedback responses" ON feedback_responses;
CREATE POLICY "Admins update feedback responses" ON feedback_responses
  FOR UPDATE USING (
    feedback_responses.admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
  );

-- Feedback responses: admin DELETE
DROP POLICY IF EXISTS "Admins delete feedback responses" ON feedback_responses;
CREATE POLICY "Admins delete feedback responses" ON feedback_responses
  FOR DELETE USING (
    feedback_responses.admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
  );

-- ── 3. AI Feedback table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who submitted it
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The conversation context
  user_prompt TEXT NOT NULL,
  ai_answer TEXT NOT NULL,

  -- Sentiment grid values (-1.0 to 1.0 on each axis)
  -- Y-axis: valence (1 = good, -1 = bad, 0 = unknown/neutral)
  -- X-axis: trust   (1 = trust, -1 = untrust, 0 = unknown/neutral)
  sentiment_valence NUMERIC(4,2) DEFAULT 0 CHECK (sentiment_valence BETWEEN -1 AND 1),
  sentiment_trust   NUMERIC(4,2) DEFAULT 0 CHECK (sentiment_trust BETWEEN -1 AND 1),

  -- Written feedback
  feedback_text TEXT,

  -- Admin management (same statuses as normal feedback)
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed', 'affirmed')),
  admin_response TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_status ON ai_feedback(status);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at DESC);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can see their own AI feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'Users view own ai feedback') THEN
    CREATE POLICY "Users view own ai feedback" ON ai_feedback
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can insert their own AI feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'Users insert own ai feedback') THEN
    CREATE POLICY "Users insert own ai feedback" ON ai_feedback
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Admins can see all AI feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'Admins view all ai feedback') THEN
    CREATE POLICY "Admins view all ai feedback" ON ai_feedback
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
      );
  END IF;
END $$;

-- Admins can update any AI feedback (status, admin_response)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'Admins update ai feedback') THEN
    CREATE POLICY "Admins update ai feedback" ON ai_feedback
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"admin"')
      );
  END IF;
END $$;

-- Oversight users can see all AI feedback (read-only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'Oversight view all ai feedback') THEN
    CREATE POLICY "Oversight view all ai feedback" ON ai_feedback
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> '"oversight"')
      );
  END IF;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_ai_feedback_updated_at ON ai_feedback;
CREATE TRIGGER trigger_ai_feedback_updated_at
  BEFORE UPDATE ON ai_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ai_feedback IS 'AI chat sentiment feedback with 2D grid (valence/trust) and admin management';


-- END SOURCE: 011_ai_feedback.sql

-- BEGIN SOURCE: 045_feedback_support_category.sql
-- ============================================================
-- Add 'support' to the feedback category check constraint
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_category_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_category_check
  CHECK (category IN ('general', 'bug', 'feature', 'support', 'other'));


-- END SOURCE: 045_feedback_support_category.sql

-- ============================================================
-- BEGIN SOURCE: 058_feedback_attachments.sql
-- ============================================================
-- Migration 058: Add attachments column to feedback table
-- Stores an array of base64 data URLs for images attached to feedback/support requests.

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;


-- END SOURCE: 058_feedback_attachments.sql


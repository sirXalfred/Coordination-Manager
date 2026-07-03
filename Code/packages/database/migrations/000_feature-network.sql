-- Consolidated feature migration file: feature-network
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 049_network_relations.sql
-- ============================================================
-- Network Relations: group calendars/meetings under canonical network names
-- and define automated string-matching rules for auto-classification.

-- 1. Canonical network table
CREATE TABLE IF NOT EXISTS public.networks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6',  -- hex color for consistent display
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

-- Service-role only: managed by admins through the API
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'networks' AND policyname = 'networks_deny_all'
  ) THEN
    CREATE POLICY "networks_deny_all" ON public.networks FOR SELECT USING (false);
  END IF;
END $$;

-- 2. Mapping table: link calendar_title or meeting_title strings to a network
CREATE TABLE IF NOT EXISTS public.network_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  source_string TEXT NOT NULL,  -- the original calendar_title / meeting title
  source_type TEXT NOT NULL CHECK (source_type IN ('calendar_title', 'meeting_title', 'description')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.network_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'network_mappings' AND policyname = 'network_mappings_deny_all'
  ) THEN
    CREATE POLICY "network_mappings_deny_all" ON public.network_mappings FOR SELECT USING (false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_mappings_network_id ON public.network_mappings(network_id);
CREATE INDEX IF NOT EXISTS idx_network_mappings_source_string ON public.network_mappings(source_string);

-- 3. Automated matching rules: regex/contains patterns that auto-classify
CREATE TABLE IF NOT EXISTS public.network_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,           -- the match pattern string
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'starts_with', 'exact', 'regex')),
  match_field TEXT NOT NULL CHECK (match_field IN ('calendar_title', 'meeting_title', 'description')),
  priority INTEGER NOT NULL DEFAULT 0,  -- higher = checked first
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.network_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'network_rules' AND policyname = 'network_rules_deny_all'
  ) THEN
    CREATE POLICY "network_rules_deny_all" ON public.network_rules FOR SELECT USING (false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_rules_network_id ON public.network_rules(network_id);
CREATE INDEX IF NOT EXISTS idx_network_rules_active ON public.network_rules(is_active) WHERE is_active = true;


-- END SOURCE: 049_network_relations.sql


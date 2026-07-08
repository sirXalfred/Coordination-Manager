import dotenv from 'dotenv'
dotenv.config()

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isMeaningfulEnvValue } from './services/local-config.js'

// ---------------------------------------------------------------------------
// Lazy / tolerant Supabase clients
// ---------------------------------------------------------------------------
// Historically this module threw at import time if SUPABASE_URL / SUPABASE_KEY
// were missing. That made it impossible for the API to boot into a "setup
// wizard" state. We now create placeholder clients pointing at a non-routable
// URL when env vars are absent; any actual DB call will fail at runtime
// (which is correct -- unconfigured = no DB), but the process stays up so
// /api/setup/* endpoints can serve the wizard.
//
// `isSupabaseConfigured()` is the canonical check for "do we have real creds?"
// ---------------------------------------------------------------------------

const PLACEHOLDER_URL = 'http://localhost:0'
// Valid JWT-shaped placeholder so the supabase-js client constructor accepts it.
// This will never authenticate against anything; it's purely a parsing placeholder.
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-not-configured'

const supabaseUrl = process.env.SUPABASE_URL || PLACEHOLDER_URL
const supabaseKey = process.env.SUPABASE_KEY || PLACEHOLDER_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function isSupabaseConfigured(): boolean {
  return isMeaningfulEnvValue('SUPABASE_URL', process.env.SUPABASE_URL)
    && isMeaningfulEnvValue('SUPABASE_KEY', process.env.SUPABASE_KEY)
}

if (!isSupabaseConfigured()) {
  console.warn(
    '[supabaseClient] SUPABASE_URL / SUPABASE_KEY not set -- running in UNCONFIGURED mode.\n' +
    '                  DB calls will fail until configured via the Setup Wizard at /setup.'
  )
} else if (!supabaseServiceRoleKey) {
  console.warn(
    '[supabaseClient] SUPABASE_SERVICE_ROLE_KEY is not set -- supabaseAdmin will fall back to the anon-key client.\n' +
    '                  RLS will NOT be bypassed and many admin operations will return empty results.'
  )
}

// Public client (uses anon key, respects RLS)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

// Admin client (uses service role key, bypasses RLS) -- for backend admin operations
export const supabaseAdmin: SupabaseClient = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : supabase

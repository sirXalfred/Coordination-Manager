import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Tolerant Supabase client
// ---------------------------------------------------------------------------
// If env vars are missing the app should still boot so the Setup Wizard at
// /setup can render. We construct a client against a non-routable URL and
// expose `isSupabaseConfigured` so feature code can avoid making calls that
// would fail anyway.
// ---------------------------------------------------------------------------

const PLACEHOLDER_URL = 'http://localhost:0'
// JWT-shaped placeholder so the supabase-js constructor accepts it.
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-not-configured'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PLACEHOLDER_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PLACEHOLDER_KEY

export const isSupabaseConfigured: boolean = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
)

if (!isSupabaseConfigured) {
   
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'The app is running in UNCONFIGURED mode -- visit /setup to configure.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

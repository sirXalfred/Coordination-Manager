import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const missingSupabaseEnvVars: string[] = [
  ...(!supabaseUrl ? ['SUPABASE_URL'] : []),
  ...(!supabaseServiceRoleKey ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
]

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0

// Bot always uses service role (server-side, no user context)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseServiceRoleKey as string)
  : null

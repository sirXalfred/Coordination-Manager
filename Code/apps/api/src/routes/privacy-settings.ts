import { Router, Response } from 'express'
import type { Router as RouterType } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { safeErrorMessage } from '../middleware/validation.js'

const router: RouterType = Router()

router.use(authMiddleware)

// ─── GET /api/privacy-settings — Get current user's privacy settings ─────────

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('privacy_settings')
      .select('*')
      .eq('user_id', req.userId!)
      .maybeSingle()

    if (error) throw error

    res.json({ settings: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── PUT /api/privacy-settings — Upsert the user's privacy settings ─────────

router.put('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      followers_enabled,
      contacts_enabled,
      public_enabled,
      followers_show_email,
      followers_show_preferences,
      followers_allow_connection_requests,
      contacts_show_email,
      contacts_show_preferences,
      contacts_allow_connection_requests,
      public_show_email,
      public_show_preferences,
      public_allow_connection_requests,
      public_features_snapshot,
    } = req.body

    const private_enabled = !followers_enabled && !contacts_enabled && !public_enabled

    const row = {
      user_id: req.userId,
      private_enabled,
      followers_enabled: !!followers_enabled,
      contacts_enabled: !!contacts_enabled,
      public_enabled: !!public_enabled,
      followers_show_email: !!followers_show_email,
      followers_show_preferences: !!followers_show_preferences,
      followers_allow_connection_requests: !!followers_allow_connection_requests,
      contacts_show_email: !!contacts_show_email,
      contacts_show_preferences: !!contacts_show_preferences,
      contacts_allow_connection_requests: !!contacts_allow_connection_requests,
      public_show_email: !!public_show_email,
      public_show_preferences: !!public_show_preferences,
      public_allow_connection_requests: !!public_allow_connection_requests,
      public_features_snapshot: public_features_snapshot ?? null,
      public_enabled_at: public_enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('privacy_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    res.json({ settings: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router

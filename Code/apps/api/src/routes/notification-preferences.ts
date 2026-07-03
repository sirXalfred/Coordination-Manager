import { Router, Response } from 'express'
import type { Router as RouterType } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { sanitizeString, safeErrorMessage } from '../middleware/validation.js'

const router: RouterType = Router()

router.use(authMiddleware)

// ─── GET /api/notification-preferences — Get current user's prefs ────────────

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', req.userId!)
      .maybeSingle()

    if (error) throw error

    res.json({ preferences: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── PUT /api/notification-preferences — Upsert notification prefs ───────────

router.put('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const description = sanitizeString(req.body.preference_description, 2000)
    const channels = Array.isArray(req.body.preferred_channels)
      ? req.body.preferred_channels.filter((c: unknown) => typeof c === 'string').slice(0, 10)
      : []
    const visibility = ['private', 'followers', 'contacts', 'public'].includes(req.body.preference_visibility)
      ? req.body.preference_visibility
      : 'private'
    const channelToggles = req.body.channel_toggles && typeof req.body.channel_toggles === 'object'
      ? req.body.channel_toggles
      : null
    const channelPriority = Array.isArray(req.body.channel_priority)
      ? req.body.channel_priority.filter((c: unknown) => typeof c === 'string').slice(0, 10)
      : null

    const row: Record<string, unknown> = {
      user_id: req.userId,
      preference_description: description || null,
      preferred_channels: channels,
      preference_visibility: visibility,
      updated_at: new Date().toISOString(),
    }

    // Store channel_toggles and channel_priority in the existing preferred_channels
    // or as part of a JSONB approach. Since the table has limited columns, we'll
    // encode the extra data into preference_description as structured JSON suffix,
    // or we can add it to the themePreferences. Better: store as JSONB in the table.
    // For now, we store toggles + priority in a composite preferred_channels array
    // with a special format, or we can extend the table.
    //
    // Simplest approach: store toggles/priority alongside in the same row using
    // the existing columns. preferred_channels can hold the priority-ordered list,
    // and the description can hold the free-text.
    // Channel toggles (which are enabled) determine what goes into preferred_channels.
    if (channelToggles && channelPriority) {
      // Only include channels that are toggled on, in priority order
      const enabledInOrder = channelPriority.filter(
        (ch: string) => channelToggles[ch] === true
      )
      row.preferred_channels = enabledInOrder
    }

    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    res.json({ preferences: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router

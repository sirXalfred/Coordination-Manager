import { Router, Response } from 'express'
import type { Router as RouterType } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { safeErrorMessage } from '../middleware/validation.js'

const router: RouterType = Router()

const LUMA_API_BASE = 'https://public-api.luma.com'

// Encryption for API key storage — uses AES-256-GCM
// Key derived from LUMA_ENCRYPTION_KEY env var (or falls back to a dev-only default)
function getEncryptionKey(): Buffer {
  const envKey = process.env.LUMA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (envKey) return Buffer.from(envKey, 'hex').subarray(0, 32)
  // Dev-only fallback — log a warning in production
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  LUMA_ENCRYPTION_KEY not set — using insecure dev fallback!')
  }
  return Buffer.alloc(32, 'dev-luma-key-not-for-production!!')
}

function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptApiKey(stored: string): string {
  const key = getEncryptionKey()
  const [ivHex, tagHex, ciphertextHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}

// All routes require authentication
router.use(authMiddleware)

// ─── GET /api/luma/integration — Get connection status ────────────────────────

router.get('/integration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('luma_integrations')
      .select('id, luma_user_id, luma_user_name, luma_user_email, is_active, created_at, updated_at')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error

    res.json({ integration: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/luma/connect — Save API key & verify with Luma ─────────────────

router.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { apiKey } = req.body

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ error: 'A valid Luma API key is required' })
    }

    const trimmedKey = apiKey.trim()

    // Verify the key by calling Luma's GET /user/get-self
    const verifyRes = await fetch(`${LUMA_API_BASE}/v1/user/get-self`, {
      headers: {
        'accept': 'application/json',
        'x-luma-api-key': trimmedKey,
      },
    })

    if (!verifyRes.ok) {
      const status = verifyRes.status
      if (status === 401 || status === 403) {
        return res.status(400).json({ error: 'Invalid API key — Luma rejected it. Check that the key is correct.' })
      }
      return res.status(400).json({ error: `Luma API returned status ${status}. Please try again.` })
    }

    const lumaUser = await verifyRes.json() as {
      id?: string
      name?: string
      email?: string
      user?: { id?: string; name?: string; email?: string }
    }

    // Extract user info from Luma response
    const lumaUserId = lumaUser?.id || lumaUser?.user?.id || null
    const lumaUserName = lumaUser?.name || lumaUser?.user?.name || null
    const lumaUserEmail = lumaUser?.email || lumaUser?.user?.email || null

    // Encrypt the API key
    const encryptedKey = encryptApiKey(trimmedKey)

    // Upsert — one integration per user
    const { data, error } = await supabaseAdmin
      .from('luma_integrations')
      .upsert({
        user_id: req.userId!,
        api_key_encrypted: encryptedKey,
        luma_user_id: lumaUserId,
        luma_user_name: lumaUserName,
        luma_user_email: lumaUserEmail,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select('id, luma_user_id, luma_user_name, luma_user_email, is_active, created_at, updated_at')
      .single()

    if (error) throw error

    res.json({ integration: data, message: 'Luma connected successfully' })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/luma/disconnect — Remove integration ─────────────────────────

router.delete('/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from('luma_integrations')
      .delete()
      .eq('user_id', req.userId!)

    if (error) throw error

    res.json({ message: 'Luma integration disconnected' })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/luma/publish-event — Publish a meeting as a Luma event ─────────

router.post('/publish-event', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meetingId, name, description, startAt, endAt, timezone, meetingUrl, visibility } = req.body

    if (!name || !startAt || !timezone) {
      return res.status(400).json({ error: 'name, startAt, and timezone are required' })
    }

    // Get the user's Luma API key
    const { data: integration, error: intError } = await supabaseAdmin
      .from('luma_integrations')
      .select('api_key_encrypted')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .maybeSingle()

    if (intError) throw intError
    if (!integration) {
      return res.status(400).json({ error: 'No Luma integration found. Connect Luma in Settings first.' })
    }

    const apiKey = decryptApiKey(integration.api_key_encrypted)

    // Build the Luma create event payload
    const lumaPayload: Record<string, unknown> = {
      name,
      start_at: startAt,
      timezone,
    }
    if (endAt) lumaPayload.end_at = endAt
    if (description) lumaPayload.description_md = description
    if (meetingUrl) lumaPayload.meeting_url = meetingUrl
    if (visibility) lumaPayload.visibility = visibility

    const createRes = await fetch(`${LUMA_API_BASE}/v1/event/create`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-luma-api-key': apiKey,
      },
      body: JSON.stringify(lumaPayload),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      console.error('Luma create event error:', createRes.status, errBody)
      return res.status(createRes.status === 429 ? 429 : 502).json({
        error: createRes.status === 429
          ? 'Luma rate limit exceeded. Please wait a moment and try again.'
          : `Luma API error: ${errBody}`,
      })
    }

    const lumaEvent = await createRes.json() as {
      id?: string
      url?: string
      event?: { api_id?: string; id?: string; url?: string }
    }
    const lumaEventId = lumaEvent?.id || lumaEvent?.event?.api_id || lumaEvent?.event?.id || ''
    const lumaEventUrl = lumaEvent?.url || (lumaEvent?.event?.url ? `https://lu.ma/${lumaEvent.event.url}` : null)

    // Track the published event if we have a meetingId
    if (meetingId) {
      await supabaseAdmin
        .from('luma_published_events')
        .upsert({
          user_id: req.userId!,
          meeting_id: meetingId,
          luma_event_id: lumaEventId,
          luma_event_url: lumaEventUrl,
          published_title: name,
          published_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,meeting_id',
        })
    }

    res.json({
      event: lumaEvent,
      luma_event_id: lumaEventId,
      luma_event_url: lumaEventUrl,
      message: 'Event published to Luma',
    })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/luma/published/:meetingId — Check if meeting was published ──────

router.get('/published/:meetingId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meetingId } = req.params

    const { data, error } = await supabaseAdmin
      .from('luma_published_events')
      .select('id, luma_event_id, luma_event_url, published_title, published_at')
      .eq('user_id', req.userId!)
      .eq('meeting_id', meetingId)
      .maybeSingle()

    if (error) throw error

    res.json({ published: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router

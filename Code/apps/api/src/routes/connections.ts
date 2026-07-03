import { Router, Response } from 'express'
import type { Router as RouterType } from 'express'
import crypto from 'crypto'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { safeErrorMessage } from '../middleware/validation.js'

const router: RouterType = Router()

router.use(authMiddleware)

// ─── POST /api/connections/invites — Generate a one-time invite code ─────────

router.post('/invites', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const inviteCode = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date()
    expiresAt.setTime(expiresAt.getTime() + 48 * 60 * 60 * 1000) // 48-hour expiry

    const { data, error } = await supabaseAdmin
      .from('connection_invites')
      .insert({
        sender_user_id: req.userId,
        invite_code: inviteCode,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    res.json({ invite: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/connections/invites/accept — Accept an invite code ────────────

router.post('/invites/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invite code is required' })
    }
    // Invite codes are 'sc-' + 32 hex chars = 35 chars; reject oversized input
    if (code.length > 64) {
      return res.status(400).json({ error: 'Invite code is invalid' })
    }

    // Look up the invite
    const { data: invite, error: lookupErr } = await supabaseAdmin
      .from('connection_invites')
      .select('*')
      .eq('invite_code', code)
      .single()

    if (lookupErr || !invite) {
      return res.status(404).json({ error: 'Invite not found or invalid' })
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'This invite has already been used' })
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite has expired' })
    }

    if (invite.sender_user_id === req.userId) {
      return res.status(400).json({ error: 'You cannot accept your own invite' })
    }

    // Ensure the accepting user exists in the users table.
    // For brand-new accounts the profile may still be in-flight (created by
    // GET /api/auth/me).  Wait briefly and retry once to avoid FK violations.
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', req.userId!)
      .maybeSingle()

    if (!userRow) {
      // Profile not created yet — wait and check once more
      await new Promise(r => setTimeout(r, 1500))
      const { data: retry } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', req.userId!)
        .maybeSingle()
      if (!retry) {
        return res.status(409).json({ error: 'Your account is still being set up. Please try again in a moment.' })
      }
    }

    // Mark invite as connected
    const { error: updateErr } = await supabaseAdmin
      .from('connection_invites')
      .update({ status: 'connected', used_by_user_id: req.userId, used_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (updateErr) throw updateErr

    // Create user connection (user_a = sender, user_b = accepter)
    const { error: connErr } = await supabaseAdmin
      .from('user_connections')
      .insert({
        user_a_id: invite.sender_user_id,
        user_b_id: req.userId,
        invite_id: invite.id,
        status: 'connected',
      })

    if (connErr) {
      // If duplicate, that's okay - they're already connected
      if (connErr.code !== '23505') throw connErr
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/connections — List the user's connections ──────────────────────

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Connections where user is either side
    const { data, error } = await supabaseAdmin
      .from('user_connections')
      .select('*')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'connected')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Enrich with user display info
    const otherUserIds = (data || []).map(c => c.user_a_id === userId ? c.user_b_id : c.user_a_id)
    const usersMap: Record<string, { id: string; display_name: string | null; email: string | null; avatar_url: string | null }> = {}
    const privacyMap: Record<string, { user_id: string; contacts_show_email: boolean }> = {}
    if (otherUserIds.length > 0) {
      const [usersResult, privacyResult] = await Promise.all([
        supabaseAdmin
          .from('users')
          .select('id, display_name, email, avatar_url')
          .in('id', otherUserIds),
        supabaseAdmin
          .from('privacy_settings')
          .select('user_id, contacts_show_email')
          .in('user_id', otherUserIds),
      ])
      if (usersResult.data) {
        for (const u of usersResult.data) usersMap[u.id] = u
      }
      if (privacyResult.data) {
        for (const p of privacyResult.data) privacyMap[p.user_id] = p
      }
    }

    const connections = (data || []).map(c => {
      const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id
      const other = usersMap[otherId]
      // Respect the other user's privacy setting — only expose email if they allow it
      const privacy = privacyMap[otherId]
      const emailAllowed = privacy?.contacts_show_email === true
      return {
        id: c.id,
        user_id: otherId,
        display_name: other?.display_name || 'Unknown',
        email: emailAllowed ? (other?.email || null) : null,
        avatar_url: other?.avatar_url || null,
        status: c.status,
        connected_via: c.invite_id ? 'invite' : 'manual',
        created_at: c.created_at,
      }
    })

    res.json({ connections })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/connections/:id — Remove a friend connection ────────────────

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const connectionId = req.params.id
    if (!connectionId) return res.status(400).json({ error: 'Connection ID is required' })

    // Verify the connection exists and the user is part of it
    const { data: conn, error: lookupErr } = await supabaseAdmin
      .from('user_connections')
      .select('id, user_a_id, user_b_id')
      .eq('id', connectionId)
      .single()

    if (lookupErr || !conn) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    if (conn.user_a_id !== req.userId && conn.user_b_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to remove this connection' })
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('user_connections')
      .delete()
      .eq('id', connectionId)

    if (deleteErr) throw deleteErr

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/connections/new-count — Count unseen new connections ───────────

router.get('/new-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!
    const lastSeen = req.query.since as string | undefined

    let query = supabaseAdmin
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'connected')

    if (lastSeen) {
      query = query.gt('created_at', lastSeen)
    }

    const { count, error } = await query

    if (error) throw error

    res.json({ count: count || 0 })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/connections/invites/:id — Revoke a pending invite ───────────

router.delete('/invites/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const inviteId = req.params.id
    if (!inviteId) return res.status(400).json({ error: 'Invite ID is required' })

    // Only allow revoking own invites that are still pending
    const { data: invite, error: lookupErr } = await supabaseAdmin
      .from('connection_invites')
      .select('id, sender_user_id, status')
      .eq('id', inviteId)
      .single()

    if (lookupErr || !invite) {
      return res.status(404).json({ error: 'Invite not found' })
    }

    if (invite.sender_user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to revoke this invite' })
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending invites can be revoked' })
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('connection_invites')
      .delete()
      .eq('id', inviteId)

    if (deleteErr) throw deleteErr

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/connections/invites — List the user's sent invites ─────────────

router.get('/invites', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('connection_invites')
      .select('*')
      .eq('sender_user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    res.json({ invites: data || [] })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/connections/manual-contacts — List manual contacts ─────────────

router.get('/manual-contacts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_contacts')
      .select('*')
      .eq('owner_user_id', req.userId!)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Enrich with linked user display names
    const linkedIds = (data || []).filter(c => c.linked_user_id).map(c => c.linked_user_id)
    const usersMap: Record<string, string> = {}
    if (linkedIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, display_name')
        .in('id', linkedIds)
      if (users) {
        for (const u of users) usersMap[u.id] = u.display_name || 'Unknown'
      }
    }

    const contacts = (data || []).map(c => ({
      id: c.id,
      type: (c.email && !c.email.includes('@') ? 'wallet' : 'email') as 'email' | 'wallet',
      value: c.email,
      display_name: c.display_name || null,
      linked_user_id: c.linked_user_id || null,
      linked_display_name: c.linked_user_id ? (usersMap[c.linked_user_id] || null) : null,
      created_at: c.created_at,
    }))

    res.json({ contacts })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/connections/manual-contacts — Add a manual contact ────────────

router.post('/manual-contacts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, value, display_name } = req.body
    if (!value || typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({ error: 'Contact value is required' })
    }
    if (type !== 'email' && type !== 'wallet') {
      return res.status(400).json({ error: 'Type must be "email" or "wallet"' })
    }

    const trimmedValue = value.trim()

    // Try to find a matching user
    let linkedUserId: string | null = null
    if (type === 'email') {
      const { data: matchedUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', trimmedValue)
        .maybeSingle()
      if (matchedUser) linkedUserId = matchedUser.id
    }

    const { data, error } = await supabaseAdmin
      .from('email_contacts')
      .insert({
        owner_user_id: req.userId!,
        email: trimmedValue,
        display_name: display_name || null,
        source: 'manual',
        linked_user_id: linkedUserId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This contact already exists' })
      }
      throw error
    }

    res.json({
      contact: {
        id: data.id,
        type,
        value: data.email,
        display_name: data.display_name,
        linked_user_id: data.linked_user_id,
        linked_display_name: null,
        created_at: data.created_at,
      }
    })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/connections/manual-contacts/:id — Remove a manual contact ───

router.delete('/manual-contacts/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contactId = req.params.id

    const { error } = await supabaseAdmin
      .from('email_contacts')
      .delete()
      .eq('id', contactId)
      .eq('owner_user_id', req.userId!)

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router

import { Router, Response } from 'express'
import type { Router as RouterType } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import crypto from 'crypto'
import { sanitizeString, safeErrorMessage } from '../middleware/validation.js'

const router: RouterType = Router()

// All routes require authentication
router.use(authMiddleware)

// ─── GET /api/discord/integration — Get current user's Discord integration ────

router.get('/integration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('discord_integrations')
      .select('id, link_key, link_key_expires_at, discord_user_id, discord_username, discord_avatar, bot_verified, bot_verified_at, is_active, created_at')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error

    res.json({ integration: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/discord/generate-key — Generate a new link key ─────────────────

router.post('/generate-key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const linkKey = `sc-${crypto.randomBytes(16).toString('hex')}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h

    // Deactivate any existing integration for this user
    await supabaseAdmin
      .from('discord_integrations')
      .update({ is_active: false })
      .eq('user_id', req.userId!)
      .eq('is_active', true)

    // Create new integration with the link key
    const { data, error } = await supabaseAdmin
      .from('discord_integrations')
      .insert({
        user_id: req.userId,
        link_key: linkKey,
        link_key_expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    res.json({
      integration: data,
      linkKey,
      expiresAt,
      botInviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=3136&scope=bot%20applications.commands`,
    })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/discord/integration — Disconnect Discord ─────────────────────

router.delete('/integration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Deactivate integration and cascade delete channels
    const { error } = await supabaseAdmin
      .from('discord_integrations')
      .update({ is_active: false })
      .eq('user_id', req.userId!)
      .eq('is_active', true)

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/discord/guilds — Get guilds the bot shares with the user ────────

router.get('/guilds', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get user's Discord integration
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('id, discord_user_id')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .single()

    if (!integration?.discord_user_id) {
      return res.json({ guilds: [], message: 'Discord not linked or not verified' })
    }

    // The bot service populates guild info — we just query from guild_channels
    const { data: channels, error } = await supabaseAdmin
      .from('discord_guild_channels')
      .select('guild_id, guild_name, guild_icon, channel_id, channel_name, label, is_active, bot_can_send, user_can_send')
      .eq('user_id', req.userId!)
      .eq('integration_id', integration.id)
      .order('guild_name')
      .order('channel_name')

    if (error) throw error

    // Group by guild
    const guildsMap = new Map<string, {
      guild_id: string
      guild_name: string
      guild_icon: string | null
      channels: Array<{
        channel_id: string
        channel_name: string
        label: string | null
        is_active: boolean
        bot_can_send: boolean
        user_can_send: boolean
      }>
    }>()

    for (const ch of channels || []) {
      if (!guildsMap.has(ch.guild_id)) {
        guildsMap.set(ch.guild_id, {
          guild_id: ch.guild_id,
          guild_name: ch.guild_name,
          guild_icon: ch.guild_icon,
          channels: [],
        })
      }
      guildsMap.get(ch.guild_id)!.channels.push({
        channel_id: ch.channel_id,
        channel_name: ch.channel_name,
        label: ch.label,
        is_active: ch.is_active,
        bot_can_send: ch.bot_can_send ?? true,
        user_can_send: ch.user_can_send ?? true,
      })
    }

    res.json({ guilds: Array.from(guildsMap.values()) })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/discord/dm-subscription-statuses — Lightweight subscription status lookup ──

router.get('/dm-subscription-statuses', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Parse optional calendar IDs
    const rawIds = typeof req.query.calendarIds === 'string'
      ? req.query.calendarIds
      : typeof req.query.calendarId === 'string'
        ? req.query.calendarId
        : null
    const calendarIds = rawIds
      ? rawIds.split(',').map(id => sanitizeString(id.trim())).filter((id): id is string => id !== null && id.length > 0)
      : []

    // Priority determines which status wins when a user appears across multiple sources/calendars.
    // opted_out (Stop button) must beat invited so old invites never hide an explicit stop action.
    const STATUS_PRIORITY: Record<string, number> = { subscribed: 5, opted_out: 4, unsubscribed: 3, invited: 2, muted_bot: 1 }
    const statuses: Record<string, string> = {}

    // ── Source 1: dm_calendar_invites ──
    // Subscriptions are calendar-specific. Only query when calendarIds is provided so that
    // subscribers from one calendar never appear as opted-in for another. When no calendar
    // context is supplied, no per-calendar status is returned (only global Source 3 below).
    // NOTE: filter by calendar_id ONLY (no sender_user_id). Anyone subscribed to a calendar
    // is a valid subscriber regardless of who originally sent the invite (co-hosts, merged
    // accounts, etc.).
    let inviteRowCount = 0
    let inviteError: string | null = null
    if (calendarIds.length > 0) {
      const { data: subs, error: subsErr } = await supabaseAdmin
        .from('dm_calendar_invites')
        .select('recipient_discord_id, status')
        .in('calendar_id', calendarIds)
      inviteError = subsErr ? subsErr.message : null
      inviteRowCount = (subs || []).length
      for (const s of (subs || []) as Array<{ recipient_discord_id: string; status: string }>) {
        const existing = statuses[s.recipient_discord_id]
        if (!existing || (STATUS_PRIORITY[s.status] ?? 0) > (STATUS_PRIORITY[existing] ?? 0)) {
          statuses[s.recipient_discord_id] = s.status
        }
      }
    }

    // ── Source 2: announcement_delivery_log (most recent recipient_response per user) ──
    // This catches DMs sent without a calendar attached + has the latest button-click status.
    // Note: every successfully sent DM has recipient_response set (at minimum 'invited'), so
    // all sent DMs are captured here. Pagination ensures we never miss entries due to row limits.
    let deliveryRowCount = 0
    let deliveryError: string | null = null
    let scheduleCount = 0
    // Only query delivery history when a calendar is selected. Otherwise subscribers from
    // unrelated calendars would leak into the current view (recipient_response = 'subscribed'
    // is per-calendar, not global). Schedules with NULL calendar_id are also excluded since
    // they cannot be attributed to the requested calendar.
    if (calendarIds.length > 0) {
      const { data: schedules, error: schedErr } = await supabaseAdmin
        .from('announcement_schedules')
        .select('id')
        .eq('user_id', userId)
        .in('calendar_id', calendarIds)

      if (schedErr) {
        deliveryError = schedErr.message
      } else if (schedules && schedules.length > 0) {
        scheduleCount = schedules.length
        const scheduleIds = schedules.map((s: { id: string }) => s.id)

        // Batch schedule IDs in chunks of 50 to avoid PostgREST query string limits.
        // Within each chunk, paginate to retrieve ALL matching rows (no row limit).
        const CHUNK_SIZE = 50
        const PAGE_SIZE = 1000
        const allLogs: Array<{ target_id: string; recipient_response: string; delivered_at: string }> = []
        for (let i = 0; i < scheduleIds.length; i += CHUNK_SIZE) {
          const chunk = scheduleIds.slice(i, i + CHUNK_SIZE)
          let offset = 0
          for (;;) {
            const { data: logs, error: logErr } = await supabaseAdmin
              .from('announcement_delivery_log')
              .select('target_id, recipient_response, delivered_at')
              .in('schedule_id', chunk)
              .eq('channel_type', 'discord_dm')
              .not('recipient_response', 'is', null)
              .order('delivered_at', { ascending: false })
              .range(offset, offset + PAGE_SIZE - 1)

            if (logErr) {
              deliveryError = logErr.message
              break
            }
            const rows = (logs || []) as Array<{ target_id: string; recipient_response: string; delivered_at: string }>
            allLogs.push(...rows)
            if (rows.length < PAGE_SIZE) break
            offset += PAGE_SIZE
          }
          if (deliveryError) break
        }
        deliveryRowCount = allLogs.length

        // Sort all logs by delivered_at descending so most recent wins
        allLogs.sort((a, b) => (b.delivered_at || '').localeCompare(a.delivered_at || ''))

        // Build latest status per user (most recent first)
        const seen = new Set<string>()
        for (const log of allLogs) {
          if (seen.has(log.target_id)) continue
          seen.add(log.target_id)

          const logStatus = log.recipient_response
          const existing = statuses[log.target_id]
          // Only override if delivery log has higher priority or no existing status
          if (!existing || (STATUS_PRIORITY[logStatus] ?? 0) > (STATUS_PRIORITY[existing] ?? 0)) {
            statuses[log.target_id] = logStatus
          }
        }

        // ── Source 2b: pre-migration sent DMs with recipient_response = NULL ──
        // Old bot versions stored NULL for successful sends. These users got the message
        // but have no status record. Treat them as 'invited' (Did Not Respond) so they
        // don't show as "Ready to receive message" as if they'd never been contacted.
        let source2bCount = 0
        for (let j = 0; j < scheduleIds.length; j += CHUNK_SIZE) {
          const chunk = scheduleIds.slice(j, j + CHUNK_SIZE)
          let offset2 = 0
          for (;;) {
            const { data: sentLogs } = await supabaseAdmin
              .from('announcement_delivery_log')
              .select('target_id')
              .in('schedule_id', chunk)
              .eq('channel_type', 'discord_dm')
              .eq('status', 'sent')
              .is('recipient_response', null)
              .range(offset2, offset2 + PAGE_SIZE - 1)

            const rows2 = (sentLogs || []) as Array<{ target_id: string }>
            for (const log of rows2) {
              // Only set if no higher-priority status already exists
              if (!statuses[log.target_id]) {
                statuses[log.target_id] = 'invited'
                source2bCount++
              }
            }
            if (rows2.length < PAGE_SIZE) break
            offset2 += PAGE_SIZE
          }
        }
        deliveryRowCount += source2bCount  // include in total row count for debug
      }
    }

    // ── Source 3: dm_opt_outs (global opt-outs for this sender) ──
    let optOutCount = 0
    {
      const { data: optOuts } = await supabaseAdmin
        .from('dm_opt_outs')
        .select('recipient_discord_id, reason')
        .or(`sender_user_id.eq.${userId},sender_user_id.is.null`)

      for (const o of (optOuts || []) as Array<{ recipient_discord_id: string; reason: string }>) {
        if (o.reason === 'private') {
          // muted_bot (DMs closed) — only applies if no higher-priority subscription state exists.
          // A stale dm_opt_outs 'private' entry should not erase an explicit 'unsubscribed' (priority 2).
          const newStatus = 'muted_bot'
          const existing = statuses[o.recipient_discord_id]
          if (!existing || (STATUS_PRIORITY[newStatus] ?? 0) >= (STATUS_PRIORITY[existing] ?? 0)) {
            statuses[o.recipient_discord_id] = newStatus
          }
        } else {
          // Explicit opt-out (e.g. "Stop" button) — always overrides any subscription status
          statuses[o.recipient_discord_id] = 'opted_out'
        }
        optOutCount++
      }
    }

    // Count statuses by type for debug
    const statusCounts: Record<string, number> = {}
    for (const v of Object.values(statuses)) {
      statusCounts[v] = (statusCounts[v] || 0) + 1
    }

    res.json({
      statuses,
      debug: {
        sources: {
          invites: { calendarIds, rows: inviteRowCount, error: inviteError },
          deliveryLog: { schedules: scheduleCount, rows: deliveryRowCount, error: deliveryError },
          optOuts: { count: optOutCount },
        },
        uniqueRecipients: Object.keys(statuses).length,
        statusCounts,
        sampleRecipientIds: Object.keys(statuses).slice(0, 5),
        _v: 2,  // version tag — confirms this code is running
      },
    })
  } catch (err: unknown) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/discord/dm-members — Stream DM-eligible members via SSE ────────

router.get('/dm-members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('id, discord_user_id')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .single()

    if (!integration?.discord_user_id) {
      return res.json({ members: [], message: 'Discord not linked or not verified' })
    }

    const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3002'
    const botSecret = process.env.BOT_API_SECRET
    if (!botSecret) throw new Error('BOT_API_SECRET is not configured')

    // Set up SSE headers for the client
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    // Stream from bot — bot also returns SSE
    const botResponse = await fetch(`${botApiUrl}/list-dm-members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': botSecret,
      },
      body: JSON.stringify({
        discordUserId: integration.discord_user_id,
      }),
    })

    if (!botResponse.ok || !botResponse.body) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to connect to bot' })}\n\n`)
      return res.end()
    }

    // Parse SSE from bot, pass through progress events, enrich 'done' with opt-out data
    const reader = botResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          res.write(line + '\n')
          continue
        }

        try {
          const event = JSON.parse(line.slice(6))

          if (event.type === 'done' && event.members?.length > 0) {
            // Fetch opt-outs for this sender (include reason for private status)
            const { data: optOuts } = await supabaseAdmin
              .from('dm_opt_outs')
              .select('recipient_discord_id, reason')
              .or(`sender_user_id.eq.${req.userId},sender_user_id.is.null`)

            const optOutMap = new Map<string, string | null>()
            for (const o of (optOuts || []) as Array<{ recipient_discord_id: string; reason: string | null }>) {
              // Prefer 'private' reason over other reasons if multiple records exist
              const existing = optOutMap.get(o.recipient_discord_id)
              if (!existing || o.reason === 'private') {
                optOutMap.set(o.recipient_discord_id, o.reason)
              }
            }

            // Fetch per-calendar subscription statuses if a calendarId is provided
            const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : null
            const subStatusMap = new Map<string, string>()
            if (calendarId) {
              const { data: subs } = await supabaseAdmin
                .from('dm_calendar_invites')
                .select('recipient_discord_id, status')
                .eq('calendar_id', calendarId)

              for (const s of (subs || []) as Array<{ recipient_discord_id: string; status: string }>) {
                subStatusMap.set(s.recipient_discord_id, s.status)
              }
            }

            // Annotate each member with opted_out flag and opt_out_reason
            event.members = event.members.map((m: { user_id: string; [key: string]: unknown }) => ({
              ...m,
              opted_out: optOutMap.has(m.user_id),
              opt_out_reason: optOutMap.get(m.user_id) || null,
              subscription_status: subStatusMap.get(m.user_id) || null,
            }))

            res.write(`data: ${JSON.stringify(event)}\n\n`)
          } else {
            // Pass through init, progress, error events unchanged
            res.write(line + '\n')
          }
        } catch {
          res.write(line + '\n')
        }
      }
    }
    res.end()
  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: safeErrorMessage(err) })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: safeErrorMessage(err) })
    }
  }
})

// ─── POST /api/discord/channels — Add a channel for announcements ─────────────

router.post('/channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { guildId, guildName, guildIcon, channelId, channelName, label } = req.body

    if (!guildId || !channelId || !channelName || !guildName) {
      return res.status(400).json({ error: 'guildId, guildName, channelId, and channelName are required' })
    }

    // Validate Discord snowflake IDs (17-20 digit numeric strings)
    const snowflakePattern = /^\d{17,20}$/
    if (!snowflakePattern.test(guildId) || !snowflakePattern.test(channelId)) {
      return res.status(400).json({ error: 'Invalid guildId or channelId format' })
    }

    // Sanitize user-provided name strings before storage
    const cleanGuildName = sanitizeString(guildName, 100)
    const cleanChannelName = sanitizeString(channelName, 100)
    const cleanLabel = label ? sanitizeString(label, 100) : null
    const cleanGuildIcon = guildIcon ? sanitizeString(guildIcon, 200) : null

    if (!cleanGuildName || !cleanChannelName) {
      return res.status(400).json({ error: 'guildName and channelName must be non-empty strings (max 100 chars)' })
    }

    // Get integration
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('id')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .single()

    if (!integration) {
      return res.status(400).json({ error: 'Discord not linked or not verified' })
    }

    const { data, error } = await supabaseAdmin
      .from('discord_guild_channels')
      .upsert({
        user_id: req.userId,
        integration_id: integration.id,
        guild_id: guildId,
        guild_name: cleanGuildName,
        guild_icon: cleanGuildIcon,
        channel_id: channelId,
        channel_name: cleanChannelName,
        label: cleanLabel,
        is_active: true,
      }, {
        onConflict: 'user_id,guild_id,channel_id',
      })
      .select()
      .single()

    if (error) throw error

    res.json({ channel: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/discord/channels/:id — Remove a channel ──────────────────────

router.delete('/channels/:channelId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from('discord_guild_channels')
      .delete()
      .eq('user_id', req.userId!)
      .eq('channel_id', req.params.channelId)

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/discord/guilds/:guildId — Remove a server and its channels ───

router.delete('/guilds/:guildId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from('discord_guild_channels')
      .delete()
      .eq('user_id', req.userId!)
      .eq('guild_id', req.params.guildId)

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/discord/refresh-guilds — Sync guilds from bot ──────────────────

router.post('/refresh-guilds', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('id, discord_user_id')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .single()

    if (!integration?.discord_user_id) {
      return res.status(400).json({ error: 'Discord not linked or not verified' })
    }

    // Call the bot's internal API to sync channels
    const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3002'
    const botSecret = process.env.BOT_API_SECRET
    if (!botSecret) throw new Error('BOT_API_SECRET is not configured')

    const response = await fetch(`${botApiUrl}/sync-channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': botSecret,
      },
      body: JSON.stringify({
        integrationId: integration.id,
        userId: req.userId,
        discordUserId: integration.discord_user_id,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to sync with bot')
    }

    res.json({ success: true, message: 'Channels synced from Discord' })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/discord/channels/:channelId/toggle — Toggle channel active ─────

router.post('/channels/:channelId/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get current state
    const { data: channel } = await supabaseAdmin
      .from('discord_guild_channels')
      .select('is_active')
      .eq('user_id', req.userId!)
      .eq('channel_id', req.params.channelId)
      .single()

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    const { data, error } = await supabaseAdmin
      .from('discord_guild_channels')
      .update({ is_active: !channel.is_active })
      .eq('user_id', req.userId!)
      .eq('channel_id', req.params.channelId)
      .select()
      .single()

    if (error) throw error

    res.json({ channel: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/discord/dm-members/recent — Quick load: self + top 50 recent DM recipients ──

router.get('/dm-members/recent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get the user's Discord integration for self info
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('discord_user_id, discord_username, discord_avatar')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .maybeSingle()

    if (!integration?.discord_user_id) {
      return res.json({ self: null, recentRecipients: [] })
    }

    // Build self member
    const selfMember = {
      user_id: integration.discord_user_id,
      username: integration.discord_username || integration.discord_user_id,
      display_name: `${integration.discord_username || integration.discord_user_id} (You)`,
      avatar: integration.discord_avatar || null,
      guild_names: [] as string[],
      roles: [] as Array<{ id: string; name: string; color: number }>,
    }

    // Query top 50 recent DM recipients from delivery log
    const { data: recentRows } = await supabaseAdmin
      .from('announcement_delivery_log')
      .select(`
        target_id,
        target_label,
        schedule_id,
        announcement_schedules!inner ( user_id )
      `)
      .eq('channel_type', 'discord_dm')
      .eq('status', 'sent')
      .eq('announcement_schedules.user_id', req.userId!)

    // Aggregate by target_id, count messages, pick most recent label
    const recipientMap = new Map<string, { target_id: string; target_label: string; message_count: number }>()
    for (const row of (recentRows || []) as Array<{ target_id: string; target_label: string | null }>) {
      // Skip self
      if (row.target_id === integration.discord_user_id) continue
      const existing = recipientMap.get(row.target_id)
      if (existing) {
        existing.message_count++
        // Keep whichever label is non-null
        if (row.target_label) existing.target_label = row.target_label
      } else {
        recipientMap.set(row.target_id, {
          target_id: row.target_id,
          target_label: row.target_label || row.target_id,
          message_count: 1,
        })
      }
    }

    // Sort by most messages, take top 50
    const sorted = Array.from(recipientMap.values())
      .sort((a, b) => b.message_count - a.message_count)
      .slice(0, 50)

    // Fetch opt-outs for these recipients
    const recipientIds = sorted.map(r => r.target_id)
    const optOutMap = new Map<string, string | null>()
    if (recipientIds.length > 0) {
      const { data: optOuts } = await supabaseAdmin
        .from('dm_opt_outs')
        .select('recipient_discord_id, reason')
        .or(`sender_user_id.eq.${req.userId},sender_user_id.is.null`)
        .in('recipient_discord_id', recipientIds)

      for (const o of (optOuts || []) as Array<{ recipient_discord_id: string; reason: string | null }>) {
        const existing = optOutMap.get(o.recipient_discord_id)
        if (!existing || o.reason === 'private') {
          optOutMap.set(o.recipient_discord_id, o.reason)
        }
      }
    }

    // Fetch subscription statuses if calendarId provided
    const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : null
    const subStatusMap = new Map<string, string>()
    if (calendarId && recipientIds.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from('dm_calendar_invites')
        .select('recipient_discord_id, status')
        .eq('calendar_id', calendarId)
        .in('recipient_discord_id', recipientIds)

      for (const s of (subs || []) as Array<{ recipient_discord_id: string; status: string }>) {
        subStatusMap.set(s.recipient_discord_id, s.status)
      }
    }

    // Build member objects matching DmMember shape
    const recentRecipients = sorted.map(r => ({
      user_id: r.target_id,
      username: r.target_label,
      display_name: r.target_label,
      avatar: null as string | null,
      guild_names: [] as string[],
      roles: [] as Array<{ id: string; name: string; color: number }>,
      opted_out: optOutMap.has(r.target_id),
      opt_out_reason: optOutMap.get(r.target_id) || null,
      subscription_status: subStatusMap.get(r.target_id) || null,
      message_count: r.message_count,
    }))

    res.json({ self: selfMember, recentRecipients })
  } catch (err: unknown) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── GET /api/discord/guild-emojis — Fetch custom emojis from user's Discord guilds ──

router.get('/guild-emojis', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: integration } = await supabaseAdmin
      .from('discord_integrations')
      .select('id, discord_user_id')
      .eq('user_id', req.userId!)
      .eq('is_active', true)
      .eq('bot_verified', true)
      .single()

    if (!integration?.discord_user_id) {
      return res.json({ emojis: [] })
    }

    const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3002'
    const botSecret = process.env.BOT_API_SECRET
    if (!botSecret) throw new Error('BOT_API_SECRET is not configured')

    const botResponse = await fetch(`${botApiUrl}/guild-emojis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': botSecret,
      },
      body: JSON.stringify({ discordUserId: integration.discord_user_id }),
    })

    if (!botResponse.ok) {
      return res.json({ emojis: [] })
    }

    const data = await botResponse.json() as { emojis: unknown[] }
    res.json({ emojis: data.emojis || [] })
  } catch (err: unknown) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendDM,
  handleSubscribe,
  handleUnsubscribe,
  handleOptOut,
  wrapUrlsForEmbed,
} from '../dm-flow.js'
import type { DmDeps, DmOptions } from '../dm-flow.js'

// ─── Mock factories ───────────────────────────────────────────────────

/** Build a chainable Supabase query mock with configurable return data. */
function mockQuery(returnData: unknown = null, returnError: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const terminal = vi.fn().mockResolvedValue({ data: returnData, error: returnError })

  for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'or', 'limit', 'is', 'neq', 'in', 'order']) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.maybeSingle = terminal
  chain.single = terminal
  // insert/delete also resolve directly when not chained further
  chain.insert.mockResolvedValue({ data: returnData, error: returnError })
  chain.delete.mockReturnValue(chain) // delete always chains .eq()
  chain.upsert.mockResolvedValue({ data: returnData, error: returnError })

  return chain
}

/** Build a mock Supabase client whose .from() returns table-specific chains. */
function mockSupabase(tableOverrides: Record<string, ReturnType<typeof mockQuery>> = {}) {
  const defaultChain = mockQuery()
  const fromFn = vi.fn((table: string) => tableOverrides[table] ?? defaultChain)
  return { from: fromFn } as unknown as DmDeps['supabase']
}

/** Build a mock Discord message object returned by dm.send(). */
function mockMessage(id = 'msg-123') {
  return {
    id,
    react: vi.fn().mockResolvedValue(undefined),
    suppressEmbeds: vi.fn().mockResolvedValue(undefined),
  }
}

/** Build a mock DM channel. */
function mockDmChannel(msg = mockMessage()) {
  return {
    send: vi.fn().mockResolvedValue(msg),
  }
}

/** Build a mock Discord user. */
function mockUser(dm = mockDmChannel()) {
  return {
    id: 'user-456',
    createDM: vi.fn().mockResolvedValue(dm),
  }
}

/** Build a mock Discord.js Client. */
function mockClient(user = mockUser()) {
  return {
    users: {
      fetch: vi.fn().mockResolvedValue(user),
    },
  } as unknown as DmDeps['client']
}

// ─── Defaults ─────────────────────────────────────────────────────────

function defaultOpts(overrides: Partial<DmOptions> = {}): DmOptions {
  return {
    userId: 'recipient-001',
    content: 'Hello, world!',
    senderUsername: 'alice',
    senderUserId: 'sender-001',
    calendarId: 'cal-001',
    calendarName: 'Weekly Sync',
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  wrapUrlsForEmbed
// ═══════════════════════════════════════════════════════════════════════

describe('wrapUrlsForEmbed', () => {
  it('wraps a bare http URL', () => {
    expect(wrapUrlsForEmbed('Visit http://example.com now'))
      .toBe('Visit <http://example.com> now')
  })

  it('wraps a bare https URL', () => {
    expect(wrapUrlsForEmbed('See https://example.com/page'))
      .toBe('See <https://example.com/page>')
  })

  it('does not double-wrap already bracketed URLs', () => {
    expect(wrapUrlsForEmbed('Link: <https://example.com>'))
      .toBe('Link: <https://example.com>')
  })

  it('wraps multiple URLs in one string', () => {
    const input = 'A https://a.com B https://b.com C'
    expect(wrapUrlsForEmbed(input)).toBe('A <https://a.com> B <https://b.com> C')
  })

  it('returns text unchanged when no URLs present', () => {
    expect(wrapUrlsForEmbed('No links here')).toBe('No links here')
  })

  it('preserves markdown links unchanged (no > leak in DMs)', () => {
    expect(wrapUrlsForEmbed('[Click here](https://example.com/path)'))
      .toBe('[Click here](https://example.com/path)')
  })

  it('wraps bare URL but preserves markdown link in same string', () => {
    const input = 'See https://bare.com and [link](https://markdown.com/page)'
    expect(wrapUrlsForEmbed(input))
      .toBe('See <https://bare.com> and [link](https://markdown.com/page)')
  })

  it('preserves calendar Add to calendar markdown link', () => {
    const input = '\uD83D\uDCC5 [Add to calendar](https://coordinationmanager.com/meeting/abc-123)'
    expect(wrapUrlsForEmbed(input))
      .toBe('\uD83D\uDCC5 [Add to calendar](https://coordinationmanager.com/meeting/abc-123)')
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - opt-out blocking
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - opt-out blocking', () => {
  it('returns error when recipient has opted out from sender', async () => {
    const optOutsChain = mockQuery({ id: 'existing-opt-out' })
    const supabase = mockSupabase({ dm_opt_outs: optOutsChain })
    const client = mockClient()

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(false)
    expect(result.error).toContain('opted out')
    // Should never attempt to fetch the user or send a DM
    expect(client.users.fetch).not.toHaveBeenCalled()
  })

  it('proceeds when no opt-out exists', async () => {
    const optOutsChain = mockQuery(null) // no opt-out
    const invitesChain = mockQuery(null) // first calendar invite
    const firstContactsChain = mockQuery(null) // first contact
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const msg = mockMessage()
    const dm = mockDmChannel(msg)
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('msg-123')
    expect(dm.send).toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - calendar invite flow
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - calendar invite flow', () => {
  it('allows first DM for a calendar (invite) and records the invite with status=invited', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // no prior invite => first invite
    const firstContactsChain = mockQuery(null)
    const integrationsChain = mockQuery(null) // no linked CM account
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
      discord_integrations: integrationsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(true)
    // Should have inserted a calendar invite row
    expect(supabase.from).toHaveBeenCalledWith('dm_calendar_invites')
  })

  it('blocks second DM when recipient has status=invited (did not respond)', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'invited' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(false)
    expect(result.blockedByStatus).toBe('invited')
    expect(result.error).toContain('did not respond')
    expect(client.users.fetch).not.toHaveBeenCalled()
  })

  it('blocks DM when recipient has status=opted_out', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'opted_out' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const client = mockClient()

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(false)
    expect(result.blockedByStatus).toBe('opted_out')
  })

  it('blocks DM when recipient has status=unsubscribed', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'unsubscribed' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const client = mockClient()

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(false)
    expect(result.blockedByStatus).toBe('unsubscribed')
  })

  it('includes calendar name in unsubscribed error message', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'unsubscribed' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const client = mockClient()

    const result = await sendDM({ client, supabase }, defaultOpts({ calendarName: 'Team Standup' }))

    expect(result.success).toBe(false)
    expect(result.error).toContain('Team Standup')
    expect(result.error).toContain('unsubscribed')
  })

  it('uses generic unsubscribed message when no calendarName', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'unsubscribed' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const client = mockClient()

    const result = await sendDM(
      { client, supabase },
      defaultOpts({ calendarName: undefined }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Recipient unsubscribed from this calendar')
  })

  it('includes calendar name in invited-blocked error message', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'invited' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
    })
    const client = mockClient()

    const result = await sendDM({ client, supabase }, defaultOpts({ calendarName: 'Team Standup' }))

    expect(result.success).toBe(false)
    expect(result.error).toContain('Team Standup')
    expect(result.blockedByStatus).toBe('invited')
  })

  it('allows follow-up DM when recipient has status=subscribed', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'subscribed' })
    const firstContactsChain = mockQuery({ id: 'existing-contact' }) // not first contact
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(true)
    expect(dm.send).toHaveBeenCalled()
  })

  it('returns subscriptionStatus=invited for first calendar message', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // no prior invite => first invite
    const firstContactsChain = mockQuery({ id: 'exists' }) // not first contact
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(true)
    expect(result.subscriptionStatus).toBe('invited')
    expect(result.isFirstCalendarMessage).toBe(true)
  })

  it('returns subscriptionStatus=subscribed for subscribed recipient', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'subscribed' })
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(true)
    expect(result.subscriptionStatus).toBe('subscribed')
    expect(result.isFirstCalendarMessage).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - first-contact intro
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - first-contact intro', () => {
  it('sends intro message on first contact', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // first invite
    const firstContactsChain = mockQuery(null) // first contact
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts())

    // First call = intro, second call = actual message
    expect(dm.send).toHaveBeenCalledTimes(2)
    const introCall = dm.send.mock.calls[0][0]
    expect(introCall.content).toContain("Swarm Coordinator Bot")
    expect(introCall.content).toContain('@alice')
    expect(introCall.content).toContain('share the same Discord server')
  })

  it('skips intro on subsequent contact', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // first invite
    const firstContactsChain = mockQuery({ id: 'existing' }) // NOT first contact
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts())

    // Only the actual message, no intro
    expect(dm.send).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - button content
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - button content', () => {
  it('shows Subscribe button on calendar invite', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // first invite
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts())

    const msgCall = dm.send.mock.calls[0][0]
    const components = msgCall.components
    expect(components).toHaveLength(1)

    // ActionRowBuilder stores components internally
    const row = components[0]
    const buttons = row.components
    expect(buttons).toHaveLength(2) // Subscribe + Opt Out

    // First button should be Subscribe
    const subBtn = buttons[0].data
    expect(subBtn.custom_id).toContain('dm_subscribe:')
    expect(subBtn.label).toContain('Subscribe')
    expect(subBtn.style).toBe(3) // ButtonStyle.Success = 3

    // Second button should be Opt Out
    const optOutBtn = buttons[1].data
    expect(optOutBtn.custom_id).toContain('dm_optout:')
    expect(optOutBtn.label).toContain('Opt Out')
    expect(optOutBtn.style).toBe(4) // ButtonStyle.Danger = 4
  })

  it('shows Unsubscribe button for subscribed users', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery({ id: 'existing-invite', status: 'subscribed' }) // subscribed
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts())

    const msgCall = dm.send.mock.calls[0][0]
    const buttons = msgCall.components[0].components

    // Only Unsubscribe button — no Opt Out for subscribed users
    expect(buttons).toHaveLength(1)

    const unsubBtn = buttons[0].data
    expect(unsubBtn.custom_id).toContain('dm_unsubscribe:')
    expect(unsubBtn.label).toContain('Unsubscribe')
    expect(unsubBtn.style).toBe(2) // ButtonStyle.Secondary = 2
  })

  it('includes calendar invite disclaimer text', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null) // first invite
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts())

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.content).toContain('Subscribe')
    expect(msgCall.content).toContain('future updates')
    expect(msgCall.content).toContain('last message you receive from this initiative')
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - suppress embeds
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - suppress embeds', () => {
  it('applies SuppressEmbeds flag when suppressEmbeds is true', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({
      content: 'Check https://example.com now',
      suppressEmbeds: true,
    }))

    const msgCall = dm.send.mock.calls[0][0]
    // URLs should be wrapped
    expect(msgCall.content).toContain('<https://example.com>')
    // MessageFlags.SuppressEmbeds === 1 << 2 === 4
    expect(msgCall.flags).toBeTruthy()
  })

  it('does not apply SuppressEmbeds flag when suppressEmbeds is false', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({ suppressEmbeds: false }))

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.flags).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - poll options
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - poll options', () => {
  it('appends poll option lines and adds reactions', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const msg = mockMessage()
    const dm = mockDmChannel(msg)
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({
      pollOptions: [
        { emoji: '👍', text: 'Yes' },
        { emoji: '👎', text: 'No' },
      ],
    }))

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.content).toContain('👍 Yes')
    expect(msgCall.content).toContain('👎 No')
    expect(msg.react).toHaveBeenCalledWith('👍')
    expect(msg.react).toHaveBeenCalledWith('👎')
  })

  it('deduplicates emojis in reactions', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const msg = mockMessage()
    const dm = mockDmChannel(msg)
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({
      pollOptions: [
        { emoji: '👍', text: 'Option A' },
        { emoji: '👍', text: 'Option B' },
      ],
    }))

    // Should only react once with 👍
    expect(msg.react).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - message formatting
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - message formatting', () => {
  it('appends sender attribution line', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({ isImmediate: true }))

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.content).toContain('Posted via')
    expect(msgCall.content).toContain('@alice')
  })

  it('uses "Scheduled" verb when not immediate', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({ isImmediate: false }))

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.content).toContain('Scheduled via')
  })

  it('truncates message to 2000 chars', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    await sendDM({ client, supabase }, defaultOpts({
      content: 'A'.repeat(2100),
    }))

    const msgCall = dm.send.mock.calls[0][0]
    expect(msgCall.content.length).toBeLessThanOrEqual(2000)
    expect(msgCall.content).toMatch(/\.\.\.$/u)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - no calendarId (plain DM, no subscription gate)
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - plain DM without calendarId', () => {
  it('sends without subscription check when no calendarId', async () => {
    const optOutsChain = mockQuery(null)
    const firstContactsChain = mockQuery({ id: 'exists' })
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_first_contacts: firstContactsChain,
    })
    const dm = mockDmChannel()
    const user = mockUser(dm)
    const client = mockClient(user)

    const result = await sendDM({ client, supabase }, defaultOpts({ calendarId: undefined }))

    expect(result.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  sendDM - error handling
// ═══════════════════════════════════════════════════════════════════════

describe('sendDM - error handling', () => {
  it('returns error when user.createDM fails (DMs disabled)', async () => {
    const optOutsChain = mockQuery(null)
    const invitesChain = mockQuery(null)
    const firstContactsChain = mockQuery(null)
    const supabase = mockSupabase({
      dm_opt_outs: optOutsChain,
      dm_calendar_invites: invitesChain,
      dm_first_contacts: firstContactsChain,
    })
    const user = {
      id: 'user-456',
      createDM: vi.fn().mockRejectedValue(new Error('Cannot send messages to this user')),
    }
    const client = {
      users: { fetch: vi.fn().mockResolvedValue(user) },
    } as unknown as DmDeps['client']

    const result = await sendDM({ client, supabase }, defaultOpts())

    expect(result.success).toBe(false)
    expect(result.error).toContain('Cannot send messages')
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  handleSubscribe
// ═══════════════════════════════════════════════════════════════════════

describe('handleSubscribe', () => {
  it('upserts calendar invite status, opt-in, and removes opt-out', async () => {
    const invitesChain = mockQuery()
    const optInsChain = mockQuery()
    const optOutsChain = mockQuery()
    const integrationsChain = mockQuery(null) // no linked CM account
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      dm_opt_outs: optOutsChain,
      discord_integrations: integrationsChain,
    })

    const result = await handleSubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    expect(result.action).toBe('subscribed')
    expect(supabase.from).toHaveBeenCalledWith('dm_calendar_invites')
    expect(supabase.from).toHaveBeenCalledWith('dm_opt_ins')
    expect(supabase.from).toHaveBeenCalledWith('dm_opt_outs')
    expect(supabase.from).toHaveBeenCalledWith('discord_integrations')
  })

  it('does not remove opt-out when senderUserId is unknown', async () => {
    const invitesChain = mockQuery()
    const optInsChain = mockQuery()
    const integrationsChain = mockQuery(null)
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      discord_integrations: integrationsChain,
    })

    const result = await handleSubscribe(supabase, 'recipient-001', 'unknown', 'cal-001')

    expect(result.success).toBe(true)
    // Should not have called dm_opt_outs for deletion
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).not.toContain('dm_opt_outs')
  })

  it('looks up linked CM user from discord_integrations', async () => {
    const invitesChain = mockQuery()
    const optInsChain = mockQuery()
    const optOutsChain = mockQuery()
    const integrationsChain = mockQuery({ user_id: 'cm-user-abc' }) // linked account
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      dm_opt_outs: optOutsChain,
      discord_integrations: integrationsChain,
    })

    const result = await handleSubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('discord_integrations')
    expect(integrationsChain.eq).toHaveBeenCalledWith('discord_user_id', 'recipient-001')
    expect(integrationsChain.eq).toHaveBeenCalledWith('is_active', true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  handleUnsubscribe
// ═══════════════════════════════════════════════════════════════════════

describe('handleUnsubscribe', () => {
  it('updates calendar invite status and deletes opt-in', async () => {
    const invitesChain = mockQuery()
    const optInsChain = mockQuery()
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
    })

    const result = await handleUnsubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    expect(result.action).toBe('unsubscribed')
    expect(supabase.from).toHaveBeenCalledWith('dm_calendar_invites')
    expect(supabase.from).toHaveBeenCalledWith('dm_opt_ins')
    expect(optInsChain.delete).toHaveBeenCalled()
    expect(optInsChain.eq).toHaveBeenCalledWith('recipient_discord_id', 'recipient-001')
    expect(optInsChain.eq).toHaveBeenCalledWith('calendar_id', 'cal-001')
    expect(optInsChain.eq).toHaveBeenCalledWith('sender_user_id', 'sender-001')
  })

  it('syncs to web calendar_subscriptions when CM user is linked via invite', async () => {
    const invitesChain = mockQuery({ cm_user_id: 'cm-user-xyz' }) // invite returns cm_user_id
    const optInsChain = mockQuery()
    const subscriptionsChain = mockQuery()
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      calendar_subscriptions: subscriptionsChain,
    })

    const result = await handleUnsubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('calendar_subscriptions')
    expect(subscriptionsChain.delete).toHaveBeenCalled()
    expect(subscriptionsChain.eq).toHaveBeenCalledWith('user_id', 'cm-user-xyz')
    expect(subscriptionsChain.eq).toHaveBeenCalledWith('calendar_id', 'cal-001')
  })

  it('falls back to discord_integrations lookup when invite has no cm_user_id', async () => {
    const invitesChain = mockQuery({ cm_user_id: null }) // no cm_user_id on invite
    const optInsChain = mockQuery()
    const integrationsChain = mockQuery({ user_id: 'cm-user-fallback' })
    const subscriptionsChain = mockQuery()
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      discord_integrations: integrationsChain,
      calendar_subscriptions: subscriptionsChain,
    })

    const result = await handleUnsubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('discord_integrations')
    expect(supabase.from).toHaveBeenCalledWith('calendar_subscriptions')
    expect(subscriptionsChain.eq).toHaveBeenCalledWith('user_id', 'cm-user-fallback')
  })

  it('skips calendar_subscriptions delete when no CM user found', async () => {
    const invitesChain = mockQuery({ cm_user_id: null })
    const optInsChain = mockQuery()
    const integrationsChain = mockQuery(null) // no linked account
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_ins: optInsChain,
      discord_integrations: integrationsChain,
    })

    const result = await handleUnsubscribe(supabase, 'recipient-001', 'sender-001', 'cal-001')

    expect(result.success).toBe(true)
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).not.toContain('calendar_subscriptions')
  })
})

// ═══════════════════════════════════════════════════════════════════════
//  handleOptOut
// ═══════════════════════════════════════════════════════════════════════

describe('handleOptOut', () => {
  it('updates all calendar invites, inserts opt-out, and removes subscriptions from sender', async () => {
    const invitesChain = mockQuery()
    const optOutsChain = mockQuery()
    const optInsChain = mockQuery()
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_outs: optOutsChain,
      dm_opt_ins: optInsChain,
    })

    const result = await handleOptOut(supabase, 'recipient-001', 'sender-001')

    expect(result.success).toBe(true)
    expect(result.action).toBe('opted_out')
    expect(supabase.from).toHaveBeenCalledWith('dm_calendar_invites')
    expect(supabase.from).toHaveBeenCalledWith('dm_opt_outs')
    expect(supabase.from).toHaveBeenCalledWith('dm_opt_ins')
  })

  it('updates all calendar invites globally when sender is unknown', async () => {
    const invitesChain = mockQuery()
    const optOutsChain = mockQuery()
    const optInsChain = mockQuery()
    const supabase = mockSupabase({
      dm_calendar_invites: invitesChain,
      dm_opt_outs: optOutsChain,
      dm_opt_ins: optInsChain,
    })

    const result = await handleOptOut(supabase, 'recipient-001', 'unknown')

    expect(result.success).toBe(true)
    expect(result.action).toBe('opted_out')
    expect(supabase.from).toHaveBeenCalledWith('dm_calendar_invites')
  })
})

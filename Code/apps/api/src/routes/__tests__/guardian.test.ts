import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/error-handler.js'

// ─── Mock Supabase ──────────────────────────────────────────

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockIn = vi.fn()
const mockNot = vi.fn()
const mockIs = vi.fn()
const mockIlike = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockOrder = vi.fn()
const mockRange = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
    eq: mockEq,
    neq: mockNeq,
    in: mockIn,
    not: mockNot,
    is: mockIs,
    ilike: mockIlike,
    gte: mockGte,
    lte: mockLte,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    range: mockRange,
  }
}

vi.mock('../../supabaseClient.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return createChain()
    },
  },
}))

// ─── Mock auth ──────────────────────────────────────────────

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
let mockUserRoles: string[] = ['moderator', 'user']

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = 'mod@example.com'
    req.userRole = mockUserRoles[0]
    req.userRoles = mockUserRoles
    next()
  },
  hasRole: (req: any, role: string) => req.userRoles?.includes(role) ?? false,
  AuthenticatedRequest: {},
}))

// ─── Test setup ─────────────────────────────────────────────

let app: express.Express

async function createApp() {
  const { default: guardianRouter } = await import('../guardian.js')
  app = express()
  app.use(express.json())
  app.use('/api/guardian', guardianRouter)
  app.use(errorHandler)
  return app
}

function resetChainMocks() {
  for (const m of [
    mockSelect, mockEq, mockNeq, mockIn, mockNot, mockIs, mockIlike,
    mockGte, mockLte, mockInsert, mockUpdate, mockDelete, mockUpsert,
    mockOrder, mockRange,
  ]) {
    m.mockReturnThis()
  }
}

// ═══════════════════════════════════════════════════════════════

describe('Guardian Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockUserRoles = ['moderator', 'user']
    resetChainMocks()
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── Access ───────────────────────────────────────────────

  describe('GET /access', () => {
    it('reports moderator role for authorised users', async () => {
      const res = await request(app).get('/api/guardian/access')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ isModerator: true, roles: ['moderator', 'user'] })
    })

    it('reports non-moderator for users without role', async () => {
      mockUserRoles = ['user']
      const res = await request(app).get('/api/guardian/access')
      expect(res.status).toBe(200)
      expect(res.body.isModerator).toBe(false)
    })
  })

  // ─── Moderator Guard ──────────────────────────────────────

  describe('Moderator guard', () => {
    it('rejects non-moderators with 403 on protected routes', async () => {
      mockUserRoles = ['user']
      const res = await request(app).get('/api/guardian/rule-groups')
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/moderator/i)
    })
  })

  // ─── Rule Groups ──────────────────────────────────────────

  describe('GET /rule-groups', () => {
    it('returns the rule groups list', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [{ id: 'g1', name: 'Spam', is_enabled: true, guardian_rules: [{ count: 3 }] }],
        error: null,
      })
      const res = await request(app).get('/api/guardian/rule-groups')
      expect(res.status).toBe(200)
      expect(res.body.groups).toHaveLength(1)
      expect(res.body.groups[0].name).toBe('Spam')
      expect(mockFrom).toHaveBeenCalledWith('guardian_rule_groups')
    })

    it('returns 500 on db error', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      const res = await request(app).get('/api/guardian/rule-groups')
      expect(res.status).toBe(500)
    })
  })

  describe('POST /rule-groups', () => {
    it('creates a rule group with trimmed name', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'g1', name: 'Spam', description: null },
        error: null,
      })
      const res = await request(app)
        .post('/api/guardian/rule-groups')
        .send({ name: '  Spam  ', description: '  filters  ' })
      expect(res.status).toBe(201)
      expect(res.body.name).toBe('Spam')
    })

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/guardian/rule-groups').send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })

    it('rejects whitespace-only name', async () => {
      const res = await request(app).post('/api/guardian/rule-groups').send({ name: '   ' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /rule-groups/:id', () => {
    it('rejects out-of-range timeout duration', async () => {
      const res = await request(app)
        .put('/api/guardian/rule-groups/g1')
        .send({ action_timeout_duration: 0 })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/timeout/i)
    })

    it('rejects timeout duration above 28 days', async () => {
      const res = await request(app)
        .put('/api/guardian/rule-groups/g1')
        .send({ action_timeout_duration: 99999999 })
      expect(res.status).toBe(400)
    })

    it('accepts valid timeout duration', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'g1', action_timeout_duration: 600 }, error: null })
      const res = await request(app)
        .put('/api/guardian/rule-groups/g1')
        .send({ action_timeout_duration: 600 })
      expect(res.status).toBe(200)
      expect(res.body.action_timeout_duration).toBe(600)
    })
  })

  // ─── Rules ────────────────────────────────────────────────

  describe('POST /rules', () => {
    it('creates a regex rule', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'r1', group_id: 'g1', pattern: 'foo.*', pattern_type: 'regex' },
        error: null,
      })
      const res = await request(app)
        .post('/api/guardian/rules')
        .send({ group_id: 'g1', pattern: 'foo.*' })
      expect(res.status).toBe(201)
      expect(res.body.pattern).toBe('foo.*')
    })

    it('rejects missing group_id', async () => {
      const res = await request(app).post('/api/guardian/rules').send({ pattern: 'x' })
      expect(res.status).toBe(400)
    })

    it('rejects missing pattern', async () => {
      const res = await request(app).post('/api/guardian/rules').send({ group_id: 'g1' })
      expect(res.status).toBe(400)
    })

    it('rejects invalid pattern_type', async () => {
      const res = await request(app)
        .post('/api/guardian/rules')
        .send({ group_id: 'g1', pattern: 'x', pattern_type: 'glob' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/pattern_type/i)
    })

    it('rejects invalid regex syntax', async () => {
      const res = await request(app)
        .post('/api/guardian/rules')
        .send({ group_id: 'g1', pattern: '([unterminated', pattern_type: 'regex' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/regex/i)
    })

    it('skips regex validation for wildcard patterns', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'r1', pattern: '([unterminated', pattern_type: 'wildcard' },
        error: null,
      })
      const res = await request(app)
        .post('/api/guardian/rules')
        .send({ group_id: 'g1', pattern: '([unterminated', pattern_type: 'wildcard' })
      expect(res.status).toBe(201)
    })
  })

  describe('POST /rules/bulk', () => {
    it('processes newline-separated patterns and reports per-pattern results', async () => {
      // Two patterns: one valid regex, one invalid -> insert called once
      mockInsert.mockResolvedValue({ error: null })
      const res = await request(app)
        .post('/api/guardian/rules/bulk')
        .send({ group_id: 'g1', patterns: 'good.*\n([bad', pattern_type: 'regex' })
      expect(res.status).toBe(201)
      expect(res.body.total).toBe(2)
      expect(res.body.succeeded).toBe(1)
      expect(res.body.failed).toBe(1)
      const failed = res.body.results.find((r: any) => !r.success)
      expect(failed.error).toMatch(/regex/i)
    })

    it('rejects empty patterns string', async () => {
      const res = await request(app)
        .post('/api/guardian/rules/bulk')
        .send({ group_id: 'g1', patterns: '' })
      expect(res.status).toBe(400)
    })

    it('rejects when only blank lines/whitespace are supplied', async () => {
      const res = await request(app)
        .post('/api/guardian/rules/bulk')
        .send({ group_id: 'g1', patterns: '  \n   \n ' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/group_id and patterns are required/i)
    })

    it('reports DB insert error per-pattern without 500', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'unique violation' } })
      const res = await request(app)
        .post('/api/guardian/rules/bulk')
        .send({ group_id: 'g1', patterns: 'foo', pattern_type: 'regex' })
      expect(res.status).toBe(201)
      expect(res.body.failed).toBe(1)
      expect(res.body.results[0].error).toMatch(/unique/i)
    })
  })

  describe('PUT /rules/:id', () => {
    it('rejects invalid regex when updating pattern', async () => {
      const res = await request(app)
        .put('/api/guardian/rules/r1')
        .send({ pattern: '([nope', pattern_type: 'regex' })
      expect(res.status).toBe(400)
    })

    it('updates a valid pattern', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'r1', pattern: 'new.*', pattern_type: 'regex' },
        error: null,
      })
      const res = await request(app)
        .put('/api/guardian/rules/r1')
        .send({ pattern: 'new.*', pattern_type: 'regex' })
      expect(res.status).toBe(200)
      expect(res.body.pattern).toBe('new.*')
    })
  })

  // ─── Notification Channels ────────────────────────────────

  describe('PUT /servers/:guildId/notification-channels', () => {
    it('rejects invalid guild snowflake', async () => {
      const res = await request(app)
        .put('/api/guardian/servers/abc/notification-channels')
        .send({ actions_log_channel_id: '123456789012345678' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/guild_id/i)
    })

    it('rejects malformed channel id', async () => {
      const res = await request(app)
        .put('/api/guardian/servers/123456789012345678/notification-channels')
        .send({ actions_log_channel_id: 'not-a-snowflake' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/actions_log_channel_id/i)
    })

    it('rejects channel not in synced channel list', async () => {
      // Channel verification: .from('guardian_server_channels').select().eq().in()
      mockIn.mockResolvedValueOnce({ data: [], error: null })
      const res = await request(app)
        .put('/api/guardian/servers/123456789012345678/notification-channels')
        .send({ actions_log_channel_id: '987654321098765432' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/synced channel list/i)
    })

    it('clears channel when null is supplied', async () => {
      // No verification needed (no string ids), goes straight to upsert
      mockSingle.mockResolvedValueOnce({
        data: { guild_id: '123456789012345678', actions_log_channel_id: null, user_feedback_channel_id: null },
        error: null,
      })
      const res = await request(app)
        .put('/api/guardian/servers/123456789012345678/notification-channels')
        .send({ actions_log_channel_id: null })
      expect(res.status).toBe(200)
      expect(res.body.actions_log_channel_id).toBeNull()
    })
  })

  describe('GET /servers/:guildId/notification-channels', () => {
    it('rejects invalid guild snowflake', async () => {
      const res = await request(app).get('/api/guardian/servers/abc/notification-channels')
      expect(res.status).toBe(400)
    })

    it('returns null channels when no config exists', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
      const res = await request(app)
        .get('/api/guardian/servers/123456789012345678/notification-channels')
      expect(res.status).toBe(200)
      expect(res.body.actions_log_channel_id).toBeNull()
      expect(res.body.user_feedback_channel_id).toBeNull()
    })
  })

  // ─── Timeseries ───────────────────────────────────────────

  describe('GET /timeseries', () => {
    it('rejects invalid since/until pair', async () => {
      const res = await request(app)
        .get('/api/guardian/timeseries')
        .query({ since: 'not-a-date', until: 'also-bad' })
      expect(res.status).toBe(400)
    })

    it('returns 24 hourly buckets for range=1d', async () => {
      mockLte.mockResolvedValueOnce({ data: [], error: null })  // scanned query
      mockLte.mockResolvedValueOnce({ data: [], error: null })  // flagged query
      const res = await request(app).get('/api/guardian/timeseries').query({ range: '1d' })
      expect(res.status).toBe(200)
      expect(res.body.mode).toBe('hourly')
      expect(res.body.buckets).toHaveLength(24)
      expect(res.body.buckets[0]).toMatchObject({ scanned: 0, flagged: 0, usersFlagged: 0 })
    })

    it('returns 30 daily buckets for range=30d', async () => {
      mockLte.mockResolvedValueOnce({ data: [], error: null })
      mockLte.mockResolvedValueOnce({ data: [], error: null })
      const res = await request(app).get('/api/guardian/timeseries').query({ range: '30d' })
      expect(res.status).toBe(200)
      expect(res.body.mode).toBe('daily')
      expect(res.body.buckets).toHaveLength(30)
    })

    it('aggregates flagged authors into unique user counts per bucket', async () => {
      const now = new Date()
      const inBucket = new Date(now.getTime() - 30 * 60 * 1000).toISOString()  // 30 min ago
      mockLte.mockResolvedValueOnce({ data: [{ scanned_at: inBucket }, { scanned_at: inBucket }], error: null })
      mockLte.mockResolvedValueOnce({
        data: [
          { flagged_at: inBucket, author_id: 'u1' },
          { flagged_at: inBucket, author_id: 'u1' },
          { flagged_at: inBucket, author_id: 'u2' },
        ],
        error: null,
      })
      const res = await request(app).get('/api/guardian/timeseries').query({ range: '1d' })
      expect(res.status).toBe(200)
      const totalScanned = res.body.buckets.reduce((sum: number, b: any) => sum + b.scanned, 0)
      const totalFlagged = res.body.buckets.reduce((sum: number, b: any) => sum + b.flagged, 0)
      const totalUsers = res.body.buckets.reduce((sum: number, b: any) => sum + b.usersFlagged, 0)
      expect(totalScanned).toBe(2)
      expect(totalFlagged).toBe(3)
      // Two unique users in the same bucket
      expect(totalUsers).toBe(2)
    })

    it('returns 500 when scanned query errors', async () => {
      mockLte.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
      const res = await request(app).get('/api/guardian/timeseries').query({ range: '1d' })
      expect(res.status).toBe(500)
    })
  })

  // ─── Reconcile State ──────────────────────────────────────

  describe('POST /reconcile-state', () => {
    it('returns zero counts for empty targets', async () => {
      const original = process.env.GUARDIAN_BOT_TOKEN
      process.env.GUARDIAN_BOT_TOKEN = 'fake.token.value'
      try {
        const res = await request(app)
          .post('/api/guardian/reconcile-state')
          .send({ targets: [] })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ checked: 0, deleted: 0, skipped: 0 })
      } finally {
        if (original === undefined) delete process.env.GUARDIAN_BOT_TOKEN
        else process.env.GUARDIAN_BOT_TOKEN = original
      }
    })

    it('returns zero counts when targets all fail input validation', async () => {
      const original = process.env.GUARDIAN_BOT_TOKEN
      process.env.GUARDIAN_BOT_TOKEN = 'fake.token.value'
      try {
        const res = await request(app)
          .post('/api/guardian/reconcile-state')
          .send({ targets: [
            { table: 'wrong_table', channel_id: '123', message_id: '456' },
            { table: 'guardian_message_log', channel_id: 'bad', message_id: '456' },
          ] })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ checked: 0, deleted: 0, skipped: 0 })
      } finally {
        if (original === undefined) delete process.env.GUARDIAN_BOT_TOKEN
        else process.env.GUARDIAN_BOT_TOKEN = original
      }
    })

    it('returns 500 when bot token is missing', async () => {
      const original = process.env.GUARDIAN_BOT_TOKEN
      delete process.env.GUARDIAN_BOT_TOKEN
      try {
        const res = await request(app)
          .post('/api/guardian/reconcile-state')
          .send({ targets: [{ table: 'guardian_message_log', channel_id: '123456789012345', message_id: '987654321098765' }] })
        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/GUARDIAN_BOT_TOKEN/)
      } finally {
        if (original !== undefined) process.env.GUARDIAN_BOT_TOKEN = original
      }
    })
  })

  // ─── Bot Invite ───────────────────────────────────────────

  describe('GET /bot-invite', () => {
    it('returns 500 when client id is not configured', async () => {
      const originalClientId = process.env.GUARDIAN_CLIENT_ID
      const originalToken = process.env.GUARDIAN_BOT_TOKEN
      delete process.env.GUARDIAN_CLIENT_ID
      delete process.env.GUARDIAN_BOT_TOKEN
      try {
        const res = await request(app).get('/api/guardian/bot-invite')
        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/GUARDIAN_CLIENT_ID/)
      } finally {
        if (originalClientId !== undefined) process.env.GUARDIAN_CLIENT_ID = originalClientId
        if (originalToken !== undefined) process.env.GUARDIAN_BOT_TOKEN = originalToken
      }
    })

    it('returns an invite URL when client id is set', async () => {
      const originalClientId = process.env.GUARDIAN_CLIENT_ID
      process.env.GUARDIAN_CLIENT_ID = '1234567890'
      try {
        const res = await request(app).get('/api/guardian/bot-invite')
        expect(res.status).toBe(200)
        expect(res.body.url).toContain('discord.com/oauth2/authorize')
        expect(res.body.url).toContain('client_id=1234567890')
      } finally {
        if (originalClientId === undefined) delete process.env.GUARDIAN_CLIENT_ID
        else process.env.GUARDIAN_CLIENT_ID = originalClientId
      }
    })
  })

  // ─── Edit History ─────────────────────────────────────────

  describe('GET /message-history/:messageId', () => {
    it('returns ordered versions', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { id: 'm1', message_id: '111', edit_version: 1 },
          { id: 'm2', message_id: '111', edit_version: 2 },
        ],
        error: null,
      })
      const res = await request(app).get('/api/guardian/message-history/111')
      expect(res.status).toBe(200)
      expect(res.body.versions).toHaveLength(2)
      expect(res.body.versions[0].edit_version).toBe(1)
    })

    it('returns 500 on db error', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
      const res = await request(app).get('/api/guardian/message-history/111')
      expect(res.status).toBe(500)
    })
  })

  // ─── Server Roles ─────────────────────────────────────────

  describe('PUT /servers/roles/:id/ignore', () => {
    it('rejects non-boolean is_ignored', async () => {
      const res = await request(app)
        .put('/api/guardian/servers/roles/r1/ignore')
        .send({ is_ignored: 'yes' })
      expect(res.status).toBe(400)
    })

    it('updates is_ignored when boolean supplied', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'r1', is_ignored: true },
        error: null,
      })
      const res = await request(app)
        .put('/api/guardian/servers/roles/r1/ignore')
        .send({ is_ignored: true })
      expect(res.status).toBe(200)
      expect(res.body.is_ignored).toBe(true)
    })
  })

  // ─── Channel Monitor ──────────────────────────────────────

  describe('PUT /servers/channels/:id/monitor', () => {
    it('rejects non-boolean is_monitored', async () => {
      const res = await request(app)
        .put('/api/guardian/servers/channels/c1/monitor')
        .send({ is_monitored: 1 })
      expect(res.status).toBe(400)
    })

    it('updates is_monitored when boolean supplied', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'c1', is_monitored: false },
        error: null,
      })
      const res = await request(app)
        .put('/api/guardian/servers/channels/c1/monitor')
        .send({ is_monitored: false })
      expect(res.status).toBe(200)
      expect(res.body.is_monitored).toBe(false)
    })
  })
})

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
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockOrder = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
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

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = 'test@example.com'
    req.userRole = 'user'
    req.userRoles = ['user']
    next()
  },
  AuthenticatedRequest: {},
}))

vi.mock('../../middleware/validation.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    safeErrorMessage: (err: any) => err?.message || 'An internal error occurred',
    sanitizeString: actual.sanitizeString,
  }
})

// ─── Test setup ─────────────────────────────────────────────

let app: express.Express

async function createApp() {
  const { default: discordRouter } = await import('../discord.js')
  app = express()
  app.use(express.json())
  app.use('/api/discord', discordRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Discord Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    mockOrder.mockReturnThis()
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── GET /api/discord/integration ─────────────────────────

  describe('GET /integration', () => {
    it('returns the active Discord integration', async () => {
      const mockIntegration = {
        id: 'int-1',
        link_key: 'sc-abc123',
        discord_user_id: '12345',
        discord_username: 'TestUser#1234',
        is_active: true,
      }
      mockMaybeSingle.mockResolvedValue({ data: mockIntegration, error: null })

      const res = await request(app).get('/api/discord/integration')

      expect(res.status).toBe(200)
      expect(res.body.integration).toBeDefined()
      expect(res.body.integration.discord_username).toBe('TestUser#1234')
    })

    it('returns null integration when none exists', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const res = await request(app).get('/api/discord/integration')

      expect(res.status).toBe(200)
      expect(res.body.integration).toBeNull()
    })

    it('returns 500 on database error', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('DB error') })

      const res = await request(app).get('/api/discord/integration')

      expect(res.status).toBe(500)
    })
  })

  // ─── POST /api/discord/generate-key ───────────────────────

  describe('POST /generate-key', () => {
    it('deactivates existing integration and creates new one with link key', async () => {
      // Deactivate existing
      mockEq.mockReturnThis()
      // Insert new integration
      mockSingle.mockResolvedValue({
        data: {
          id: 'int-2',
          link_key: 'sc-newkey',
          link_key_expires_at: '2026-04-18T00:00:00Z',
          is_active: true,
        },
        error: null,
      })

      const res = await request(app).post('/api/discord/generate-key')

      expect(res.status).toBe(200)
      expect(res.body.linkKey).toBeDefined()
      // Link key should start with sc- prefix
      expect(res.body.linkKey).toMatch(/^sc-/)
      expect(res.body.expiresAt).toBeDefined()
      expect(res.body.botInviteUrl).toContain('discord.com')
    })

    it('returns 500 on insert error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Insert failed') })

      const res = await request(app).post('/api/discord/generate-key')

      expect(res.status).toBe(500)
    })
  })

  // ─── DELETE /api/discord/integration ──────────────────────

  describe('DELETE /integration', () => {
    it('deactivates the active integration', async () => {
      // Chain: .update().eq('user_id').eq('is_active', true)
      // Terminal eq (2nd call) must resolve with no error
      let eqCallCount = 0
      mockEq.mockImplementation(() => {
        eqCallCount++
        if (eqCallCount >= 2) {
          return Promise.resolve({ error: null })
        }
        return createChain()
      })

      const res = await request(app).delete('/api/discord/integration')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith('discord_integrations')
      mockEq.mockReturnThis()
    })

    it('returns 500 on database error', async () => {
      // The terminal .eq('is_active', true) must resolve with error
      // Since eq is chained, we need the last eq to resolve with error
      // We override eq to reject on the last call
      let eqCallCount = 0
      mockEq.mockImplementation(() => {
        eqCallCount++
        // The chain is: .update().eq('user_id').eq('is_active', true)
        // On the 2nd eq call, return the result with error
        if (eqCallCount >= 2) {
          return Promise.resolve({ error: new Error('Update failed') })
        }
        return createChain()
      })

      const res = await request(app).delete('/api/discord/integration')

      expect(res.status).toBe(500)
      // Restore eq mock
      mockEq.mockReturnThis()
    })
  })

  // ─── GET /api/discord/guilds ──────────────────────────────

  describe('GET /guilds', () => {
    it('returns empty guilds when no integration is verified', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      const res = await request(app).get('/api/discord/guilds')

      expect(res.status).toBe(200)
      expect(res.body.guilds).toEqual([])
    })

    it('returns grouped guilds when integration exists', async () => {
      // Integration lookup
      mockSingle.mockResolvedValueOnce({
        data: { id: 'int-1', discord_user_id: '12345' },
        error: null,
      })
      // Channel list: .eq().eq().order().order() — second order is terminal
      // Need to track order calls and resolve on the second one
      let orderCallCount = 0
      mockOrder.mockImplementation(() => {
        orderCallCount++
        if (orderCallCount >= 2) {
          return Promise.resolve({
            data: [
              {
                guild_id: 'g1',
                guild_name: 'Test Guild',
                guild_icon: null,
                channel_id: 'ch1',
                channel_name: 'general',
                label: null,
                is_active: true,
                bot_can_send: true,
                user_can_send: true,
              },
              {
                guild_id: 'g1',
                guild_name: 'Test Guild',
                guild_icon: null,
                channel_id: 'ch2',
                channel_name: 'announcements',
                label: null,
                is_active: true,
                bot_can_send: true,
                user_can_send: false,
              },
            ],
            error: null,
          })
        }
        return createChain()
      })

      const res = await request(app).get('/api/discord/guilds')

      expect(res.status).toBe(200)
      expect(res.body.guilds).toHaveLength(1)
      expect(res.body.guilds[0].guild_name).toBe('Test Guild')
      expect(res.body.guilds[0].channels).toHaveLength(2)
      // Restore order mock
      mockOrder.mockReturnThis()
    })
  })
})

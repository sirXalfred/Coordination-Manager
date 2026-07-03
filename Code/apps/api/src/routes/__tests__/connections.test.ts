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
const mockOr = vi.fn()
const mockOrder = vi.fn()
const mockIn = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    or: mockOr,
    in: mockIn,
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
  }
})

// ─── Test setup ─────────────────────────────────────────────

let app: express.Express

async function createApp() {
  const { default: connectionsRouter } = await import('../connections.js')
  app = express()
  app.use(express.json())
  app.use('/api/connections', connectionsRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Connections Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    mockOr.mockReturnThis()
    mockIn.mockReturnThis()
    mockOrder.mockReturnThis()
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── POST /api/connections/invites ────────────────────────

  describe('POST /invites', () => {
    it('generates a one-time invite code', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'inv-1',
          sender_user_id: MOCK_USER_ID,
          invite_code: 'abc123',
          status: 'pending',
          expires_at: '2026-04-19T00:00:00Z',
        },
        error: null,
      })

      const res = await request(app).post('/api/connections/invites')

      expect(res.status).toBe(200)
      expect(res.body.invite).toBeDefined()
      expect(res.body.invite.status).toBe('pending')
    })

    it('returns 500 on database error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('Insert failed') })

      const res = await request(app).post('/api/connections/invites')

      expect(res.status).toBe(500)
    })
  })

  // ─── POST /api/connections/invites/accept ─────────────────

  describe('POST /invites/accept', () => {
    it('accepts a valid pending invite', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // Invite lookup
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'inv-1',
          sender_user_id: 'other-user-id',
          invite_code: 'validcode',
          status: 'pending',
          expires_at: futureDate,
        },
        error: null,
      })
      // User existence check
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: MOCK_USER_ID }, error: null })
      // Update invite and insert connection: terminal eq/insert return chain, error undefined = success

      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({ code: 'validcode' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 400 when code is missing', async () => {
      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invite code is required')
    })

    it('returns 404 for unknown invite code', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({ code: 'badcode' })

      expect(res.status).toBe(404)
    })

    it('rejects already-used invite', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'inv-1',
          sender_user_id: 'other-user',
          invite_code: 'usedcode',
          status: 'connected',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({ code: 'usedcode' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('already been used')
    })

    it('rejects expired invite', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'inv-1',
          sender_user_id: 'other-user',
          invite_code: 'expiredcode',
          status: 'pending',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({ code: 'expiredcode' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('expired')
    })

    it('prevents accepting own invite', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'inv-1',
          sender_user_id: MOCK_USER_ID,
          invite_code: 'mycode',
          status: 'pending',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/connections/invites/accept')
        .send({ code: 'mycode' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('cannot accept your own invite')
    })
  })

  // ─── GET /api/connections ─────────────────────────────────

  describe('GET /', () => {
    it('returns enriched connections list', async () => {
      mockOrder.mockResolvedValue({
        data: [
          {
            id: 'conn-1',
            user_a_id: MOCK_USER_ID,
            user_b_id: 'friend-id',
            status: 'connected',
            invite_id: 'inv-1',
            created_at: '2026-04-17T00:00:00Z',
          },
        ],
        error: null,
      })
      // Users enrichment
      mockIn.mockReturnThis()
      // Promise.all results (users + privacy)
      mockIn.mockResolvedValueOnce({
        data: [{ id: 'friend-id', display_name: 'Alice', email: 'alice@test.com', avatar_url: null }],
      })
      mockIn.mockResolvedValueOnce({
        data: [{ user_id: 'friend-id', contacts_show_email: true }],
      })

      const res = await request(app).get('/api/connections')

      expect(res.status).toBe(200)
      expect(res.body.connections).toBeDefined()
    })
  })

  // ─── DELETE /api/connections/:id ──────────────────────────

  describe('DELETE /:id', () => {
    it('returns 404 when connection not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      const res = await request(app).delete('/api/connections/nonexistent')

      expect(res.status).toBe(404)
    })
  })
})

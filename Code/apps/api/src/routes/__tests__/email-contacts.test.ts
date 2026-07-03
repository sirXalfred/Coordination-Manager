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
const mockOrder = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
    upsert: mockInsert,
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
  const { default: emailContactsRouter } = await import('../email-contacts.js')
  app = express()
  app.use(express.json())
  app.use('/api/email-contacts', emailContactsRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Email Contacts Routes', () => {
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

  // ─── GET /api/email-contacts ──────────────────────────────

  describe('GET /', () => {
    it('returns user contacts', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { id: 'c1', email: 'alice@test.com', display_name: 'Alice', tags: ['work'] },
          { id: 'c2', email: 'bob@test.com', display_name: 'Bob', tags: [] },
        ],
        error: null,
      })

      const res = await request(app).get('/api/email-contacts')

      expect(res.status).toBe(200)
      expect(res.body.contacts).toHaveLength(2)
    })

    it('returns 500 on database error', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: new Error('DB error') })

      const res = await request(app).get('/api/email-contacts')

      expect(res.status).toBe(500)
    })
  })

  // ─── POST /api/email-contacts ─────────────────────────────

  describe('POST /', () => {
    it('creates a new contact with valid email', async () => {
      // upsert().select().single() chain
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'c1',
          email: 'new@test.com',
          display_name: 'New Contact',
          tags: ['friend'],
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/email-contacts')
        .send({ email: 'new@test.com', display_name: 'New Contact', tags: ['friend'] })

      expect(res.status).toBe(201)
      expect(res.body.contact.email).toBe('new@test.com')
    })

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/email-contacts')
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('valid email')
    })

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/email-contacts')
        .send({})

      expect(res.status).toBe(400)
    })
  })
})

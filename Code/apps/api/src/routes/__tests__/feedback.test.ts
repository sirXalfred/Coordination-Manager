import { describe, it, expect, vi, beforeEach } from 'vitest'
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
const mockNeq = vi.fn()
const mockOr = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockOrder = vi.fn()
const mockRange = vi.fn()

type MockQueryResult = {
  data?: unknown
  error?: { message: string } | null
  count?: number
}

const mockThenResults: MockQueryResult[] = []

function queueThenResult(result: MockQueryResult) {
  mockThenResults.push(result)
}

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    neq: mockNeq,
    or: mockOr,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    range: mockRange,
    then: (resolve: (value: MockQueryResult) => void, reject?: (reason: unknown) => void) => {
      const next = mockThenResults.shift()
      if (!next) {
        return Promise.resolve().then(() => resolve({ data: null, error: null, count: 0 }))
      }
      if (next.error) {
        if (reject) {
          reject(next.error)
        }
        return Promise.resolve(next)
      }
      return Promise.resolve().then(() => resolve(next))
    },
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
let mockIsAdmin = false

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = 'test@example.com'
    req.userRole = mockIsAdmin ? 'admin' : 'user'
    req.userRoles = mockIsAdmin ? ['admin', 'user'] : ['user']
    next()
  },
  hasRole: (req: any, role: string) => req.userRoles?.includes(role) ?? false,
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
  const { default: feedbackRouter } = await import('../feedback.js')
  app = express()
  app.use(express.json())
  app.use('/api/feedback', feedbackRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Feedback Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockThenResults.length = 0
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockNeq.mockReturnThis()
    mockOr.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    mockOrder.mockReturnThis()
    mockIsAdmin = false
    await createApp()
  })

  // ─── POST /api/feedback ───────────────────────────────────

  describe('POST /', () => {
    it('submits feedback with valid message', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'fb-1',
          message: 'Great app!',
          category: 'general',
          status: 'open',
          user_id: MOCK_USER_ID,
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/feedback')
        .send({ message: 'Great app!' })

      expect(res.status).toBe(201)
      expect(res.body.feedback.message).toBe('Great app!')
    })

    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('message is required')
    })

    it('returns 400 for invalid category', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ message: 'Test', category: 'invalid-cat' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid category')
    })

    it('accepts valid categories', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'fb-1', message: 'Bug found', category: 'bug' },
        error: null,
      })

      const res = await request(app)
        .post('/api/feedback')
        .send({ message: 'Bug found', category: 'bug' })

      expect(res.status).toBe(201)
    })
  })

  // ─── GET /api/feedback ────────────────────────────────────

  describe('GET /', () => {
    it('returns paginated feedback for non-admin (own only)', async () => {
      // Discord integration lookup
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
      // Status counts (open + reviewed + affirmed + resolved + dismissed)
      queueThenResult({ count: 1, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      // Open status page fetch
      mockRange.mockResolvedValueOnce({
        data: [
          { id: 'fb-1', message: 'My feedback', status: 'open', created_at: '2026-04-17T00:00:00Z', users: null },
        ],
        error: null,
        count: 1,
      })
      // User's saved status order
      mockSingle.mockResolvedValueOnce({ data: { feedback_status_order: null }, error: null })

      const res = await request(app).get('/api/feedback')

      expect(res.status).toBe(200)
      expect(res.body.feedback).toBeDefined()
      expect(res.body.isAdmin).toBe(false)
    })

    it('applies status order before pagination', async () => {
      // Discord integration lookup
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
      // Status counts (open + reviewed + affirmed + resolved + dismissed)
      queueThenResult({ count: 1, error: null })
      queueThenResult({ count: 1, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      // Only one row should be fetched for page 1
      mockRange.mockResolvedValueOnce({
        data: [
          { id: 'fb-1', message: 'Older open item', status: 'open', created_at: '2026-04-16T00:00:00Z', users: null },
        ],
        error: null,
        count: 1,
      })
      // User's saved status order
      mockSingle.mockResolvedValueOnce({ data: { feedback_status_order: null }, error: null })

      const res = await request(app).get('/api/feedback?limit=1&page=1')

      expect(res.status).toBe(200)
      expect(res.body.feedback).toHaveLength(1)
      expect(res.body.feedback[0].status).toBe('open')
      expect(res.body.total).toBe(2)
    })

    it('admin sees all feedback', async () => {
      mockIsAdmin = true
      await createApp()

      queueThenResult({ count: 1, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      queueThenResult({ count: 0, error: null })
      mockRange.mockResolvedValueOnce({
        data: [
          { id: 'fb-1', message: 'Feedback 1', status: 'open', created_at: '2026-04-17T00:00:00Z', users: null },
        ],
        error: null,
        count: 1,
      })
      mockSingle.mockResolvedValueOnce({ data: { feedback_status_order: null }, error: null })

      const res = await request(app).get('/api/feedback')

      expect(res.status).toBe(200)
      expect(res.body.isAdmin).toBe(true)
    })
  })

  // ─── PATCH /api/feedback/:id (admin status update) ────────

  describe('PATCH /:id', () => {
    it('updates feedback status (admin)', async () => {
      mockIsAdmin = true
      await createApp()

      mockSingle.mockResolvedValueOnce({
        data: { id: 'fb-1', status: 'reviewed' },
        error: null,
      })

      const res = await request(app)
        .patch('/api/feedback/fb-1')
        .send({ status: 'reviewed' })

      expect(res.status).toBe(200)
      expect(res.body.feedback).toBeDefined()
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .patch('/api/feedback/fb-1')
        .send({ status: 'reviewed' })

      expect(res.status).toBe(403)
    })

    it('returns 400 for invalid status', async () => {
      mockIsAdmin = true
      await createApp()

      const res = await request(app)
        .patch('/api/feedback/fb-1')
        .send({ status: 'bogus' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid status')
    })
  })
})

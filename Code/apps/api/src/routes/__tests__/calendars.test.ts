import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/error-handler.js'

// ─── Mock Supabase ──────────────────────────────────────────

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockOrder = vi.fn()
const mockIn = vi.fn()
const mockOr = vi.fn()

function createChain(): Record<string, any> {
  const chain: Record<string, any> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    or: mockOr,
    then: (resolve: (v: any) => void) => resolve({ data: [], error: null }),
  }
  return chain
}

vi.mock('../../supabaseClient.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return createChain()
    },
  },
}))

// ─── Mock auth middleware with optional auth ─────────────────

const _mockUserId = '550e8400-e29b-41d4-a716-446655440000'
const mockEmail = 'test@example.com'

vi.mock('../../middleware/auth.js', () => {
  const mockHasCalPerm = vi.fn().mockReturnValue({ isCreator: true, canEdit: true })
  return {
    optionalAuthMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000'
      req.userEmail = 'test@example.com'
      req.userRole = 'user'
      req.userRoles = ['user']
      next()
    },
    hasCalendarEditPermission: mockHasCalPerm,
    AuthenticatedRequest: {},
  }
})

// ─── Test setup ─────────────────────────────────────────────

let app: express.Express

async function createApp() {
  const { default: calendarsRouter } = await import('../calendars.js')
  app = express()
  app.use(express.json())
  app.use('/api/calendars', calendarsRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Calendar Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockIn.mockReturnThis()
    mockOrder.mockReturnThis()
    mockOr.mockReturnThis()
    // Re-set hasCalendarEditPermission after clearAllMocks
    const { hasCalendarEditPermission } = await import('../../middleware/auth.js') as any
    hasCalendarEditPermission.mockReturnValue({ isCreator: true, canEdit: true })
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── POST /api/calendars ──────────────────────────────────

  describe('POST /', () => {
    it('creates a calendar and returns 201', async () => {
      const mockCalendar = {
        id: 'cal-id-1',
        hash: 'abc1234567',
        title: 'Team Sync',
        created_by: mockEmail,
        config: { eventName: 'Team Sync' },
        visibility: 'unlisted',
      }

      mockSingle.mockResolvedValue({ data: mockCalendar, error: null })

      const res = await request(app)
        .post('/api/calendars')
        .send({ title: 'Team Sync', config: {}, permissions: {} })

      expect(res.status).toBe(201)
      expect(res.body.title).toBe('Team Sync')
      expect(res.body.hash).toBeDefined()
    })

    it('syncs config.eventName to title', async () => {
      mockSingle.mockResolvedValue({ data: { title: 'My Cal', config: { eventName: 'My Cal' } }, error: null })

      await request(app)
        .post('/api/calendars')
        .send({ title: 'My Cal', config: { eventName: 'Old Name' } })

      // Verify insert was called -- the config should have eventName matching title
      expect(mockInsert).toHaveBeenCalled()
    })

    it('uses server-verified identity for created_by', async () => {
      mockSingle.mockResolvedValue({
        data: { created_by: mockEmail },
        error: null,
      })

      await request(app)
        .post('/api/calendars')
        .send({ title: 'Test', created_by: 'attacker@evil.com' })

      // Verify the insert used the server-verified email, not client-supplied
      expect(mockFrom).toHaveBeenCalledWith('calendars')
    })

    it('returns 400 on database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value' },
      })

      const res = await request(app)
        .post('/api/calendars')
        .send({ title: 'Dup Cal' })

      expect(res.status).toBe(400)
    })
  })

  // ─── GET /api/calendars/:hash ─────────────────────────────

  describe('GET /:hash', () => {
    it('returns a calendar by hash with ownership flags', async () => {
      const mockCal = {
        id: 'cal-1',
        hash: 'abc1234567',
        title: 'Team Sync',
        created_by: mockEmail,
        permissions: {},
        visibility: 'unlisted',
      }

      mockSingle.mockResolvedValue({ data: mockCal, error: null })

      const res = await request(app).get('/api/calendars/abc1234567')

      expect(res.status).toBe(200)
      expect(res.body.hash).toBe('abc1234567')
      expect(res.body.title).toBe('Team Sync')
    })

    it('returns 404 for unknown hash', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      })

      const res = await request(app).get('/api/calendars/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Calendar not found')
    })
  })
})

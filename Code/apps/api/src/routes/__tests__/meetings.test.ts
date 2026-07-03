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
const MOCK_EMAIL = 'test@example.com'

const mockHasCalendarEditPermission = vi.fn()

vi.mock('../../middleware/auth.js', () => ({
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = MOCK_EMAIL
    req.userRole = 'user'
    req.userRoles = ['user']
    next()
  },
  hasCalendarEditPermission: (...args: unknown[]) => mockHasCalendarEditPermission(...args),
  AuthenticatedRequest: {},
}))

// ─── Test setup ─────────────────────────────────────────────

let app: express.Express

async function createApp() {
  const { default: meetingsRouter } = await import('../meetings.js')
  app = express()
  app.use(express.json())
  app.use('/api/meetings', meetingsRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Meetings Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    mockOrder.mockReturnThis()
    mockHasCalendarEditPermission.mockReturnValue({ isCreator: true, canEdit: true })
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── POST /api/meetings ───────────────────────────────────

  describe('POST /', () => {
    it('creates a meeting when user is calendar creator', async () => {
      // Calendar lookup
      mockSingle.mockResolvedValueOnce({
        data: { id: 'cal-1', created_by: MOCK_EMAIL, permissions: {} },
        error: null,
      })
      // Meeting insert
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'meeting-1',
          title: 'Standup',
          start_time: '2026-04-20T09:00:00Z',
          end_time: '2026-04-20T09:30:00Z',
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/meetings')
        .send({
          calendar_hash: 'abc123',
          title: 'Standup',
          start_time: '2026-04-20T09:00:00Z',
          end_time: '2026-04-20T09:30:00Z',
          duration_minutes: 30,
          time_slots: ['2026-04-20T09:00'],
        })

      expect(res.status).toBe(201)
      expect(res.body.title).toBe('Standup')
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ calendar_hash: 'abc123', title: 'Test' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Missing required fields')
    })

    it('returns 404 when calendar not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const res = await request(app)
        .post('/api/meetings')
        .send({
          calendar_hash: 'bad',
          title: 'Test',
          start_time: '2026-04-20T09:00:00Z',
          end_time: '2026-04-20T09:30:00Z',
          duration_minutes: 30,
          time_slots: ['slot'],
        })

      expect(res.status).toBe(404)
    })

    it('returns 403 when user is not calendar creator', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'cal-1', created_by: 'other@user.com', permissions: {} },
        error: null,
      })
      mockHasCalendarEditPermission.mockReturnValue({ isCreator: false, canEdit: false })

      const res = await request(app)
        .post('/api/meetings')
        .send({
          calendar_hash: 'abc123',
          title: 'Test',
          start_time: '2026-04-20T09:00:00Z',
          end_time: '2026-04-20T09:30:00Z',
          duration_minutes: 30,
          time_slots: ['slot'],
        })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Only the calendar creator')
    })
  })

  // ─── GET /api/meetings/single/:meetingId ──────────────────

  describe('GET /single/:meetingId', () => {
    it('returns a meeting with calendar info', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'meeting-1',
          title: 'Standup',
          start_time: '2026-04-20T09:00:00',
          end_time: '2026-04-20T09:30:00',
          duration_minutes: 30,
          meeting_link: null,
          calendars: { hash: 'abc123', title: 'Team', visibility: 'unlisted' },
        },
        error: null,
      })

      const res = await request(app).get('/api/meetings/single/meeting-1')

      expect(res.status).toBe(200)
      expect(res.body.meeting.title).toBe('Standup')
      expect(res.body.meeting.calendar_hash).toBe('abc123')
      // Should append Z to timestamps without timezone suffix
      expect(res.body.meeting.start_time).toBe('2026-04-20T09:00:00Z')
    })

    it('returns 404 when meeting not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      const res = await request(app).get('/api/meetings/single/nonexistent')

      expect(res.status).toBe(404)
    })
  })

  // ─── GET /api/meetings/:hash ──────────────────────────────

  describe('GET /:hash', () => {
    it('returns all meetings for a calendar with UTC timestamps', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'cal-1' }, error: null })
      mockOrder.mockResolvedValueOnce({
        data: [
          { id: 'm1', start_time: '2026-04-20T09:00:00', end_time: '2026-04-20T09:30:00' },
          { id: 'm2', start_time: '2026-04-21T09:00:00Z', end_time: '2026-04-21T09:30:00Z' },
        ],
        error: null,
      })

      const res = await request(app).get('/api/meetings/abc123')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      // First meeting should have Z appended
      expect(res.body[0].start_time).toBe('2026-04-20T09:00:00Z')
      // Second already had Z, should stay unchanged
      expect(res.body[1].start_time).toBe('2026-04-21T09:00:00Z')
    })

    it('returns 404 when calendar not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const res = await request(app).get('/api/meetings/bad')

      expect(res.status).toBe(404)
    })
  })

  // ─── PUT /api/meetings/:id ────────────────────────────────

  describe('PUT /:id', () => {
    it('updates a meeting when user has permission', async () => {
      // Meeting lookup
      mockSingle.mockResolvedValueOnce({
        data: { id: 'meeting-1', calendar_id: 'cal-1' },
        error: null,
      })
      // Calendar lookup
      mockSingle.mockResolvedValueOnce({
        data: { created_by: MOCK_EMAIL, permissions: {} },
        error: null,
      })
      // Update result
      mockSingle.mockResolvedValueOnce({
        data: { id: 'meeting-1', title: 'Updated' },
        error: null,
      })

      const res = await request(app)
        .put('/api/meetings/meeting-1')
        .send({ title: 'Updated' })

      expect(res.status).toBe(200)
    })

    it('returns 403 when user lacks permission', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'meeting-1', calendar_id: 'cal-1' },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { created_by: 'other@user.com', permissions: {} },
        error: null,
      })
      mockHasCalendarEditPermission.mockReturnValue({ isCreator: false, canEdit: false })

      const res = await request(app)
        .put('/api/meetings/meeting-1')
        .send({ title: 'Hacked' })

      expect(res.status).toBe(403)
    })
  })

  // ─── DELETE /api/meetings/:id ─────────────────────────────

  describe('DELETE /:id', () => {
    it('deletes a meeting when user is creator', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'meeting-1', calendar_id: 'cal-1' },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { created_by: MOCK_EMAIL, permissions: {} },
        error: null,
      })
      // Delete chain: .delete().eq() - terminal eq returns chain, error undefined = success

      const res = await request(app).delete('/api/meetings/meeting-1')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 403 when user is not creator', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'meeting-1', calendar_id: 'cal-1' },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { created_by: 'other@user.com', permissions: {} },
        error: null,
      })
      mockHasCalendarEditPermission.mockReturnValue({ isCreator: false, canEdit: false })

      const res = await request(app).delete('/api/meetings/meeting-1')

      expect(res.status).toBe(403)
    })

    it('returns 404 when meeting not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const res = await request(app).delete('/api/meetings/nonexistent')

      expect(res.status).toBe(404)
    })
  })
})

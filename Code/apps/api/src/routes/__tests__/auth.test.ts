import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/error-handler.js'

// ─── Mock Supabase ──────────────────────────────────────────

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockIn = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  }
}

const mockCreateUser = vi.fn()
const mockDeleteUser = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockGetUserById = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../../supabaseClient.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return createChain()
    },
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        getUserById: (...args: unknown[]) => mockGetUserById(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  }),
}))

// ─── Mock auth middleware ───────────────────────────────────

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = '550e8400-e29b-41d4-a716-446655440000'
    req.userEmail = 'test@example.com'
    req.userRole = 'user'
    req.userRoles = ['user']
    req.accessToken = 'mock.jwt.token'
    next()
  },
  AuthenticatedRequest: {},
}))

// ─── Mock captcha and signup tracker ────────────────────────

vi.mock('../../services/captcha.js', () => ({
  verifyCaptcha: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/signup-rate-tracker.js', () => ({
  recordSignup: vi.fn(),
  getCaptchaStatus: vi.fn().mockReturnValue({ active: false }),
  getSignupSource: vi.fn().mockReturnValue('web'),
}))

vi.mock('../../services/account-merge.js', () => ({
  createMergeToken: vi.fn().mockReturnValue('merge-token-123'),
  mergeTokenStore: new Map(),
  mergeAccounts: vi.fn().mockResolvedValue(undefined),
}))

// ─── Mock env ───────────────────────────────────────────────

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

// ─── Test setup ─────────────────────────────────────────────

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

let app: express.Express

async function createApp() {
  const { default: authRouter } = await import('../auth.js')
  app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use(errorHandler)
  return app
}

// ═══════════════════════════════════════════════════════════════

describe('Auth Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── POST /api/auth/guest ─────────────────────────────────

  describe('POST /guest', () => {
    it('creates a traveler account and returns session', async () => {
      const mockUser = {
        id: 'new-traveler-id',
        email: 'traveler-xxx@guest.local',
        user_metadata: { account_type: 'traveler', display_name: 'Wandering Falcon 42' },
      }

      mockCreateUser.mockResolvedValue({ data: { user: mockUser }, error: null })
      mockUpsert.mockResolvedValue({ data: null, error: null })
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'at-123',
            refresh_token: 'rt-123',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
          },
        },
        error: null,
      })

      const res = await request(app)
        .post('/api/auth/guest')
        .send({ captchaToken: 'valid-token' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.session.access_token).toBe('at-123')
      expect(res.body.user.accountType).toBe('traveler')
      expect(res.body.user.displayName).toBeDefined()
      expect(res.body.user.roles).toEqual(['traveler'])
    })

    it('returns 503 when user creation fails', async () => {
      mockCreateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Service unavailable', status: 503 },
      })

      const res = await request(app)
        .post('/api/auth/guest')
        .send({ captchaToken: 'valid-token' })

      expect(res.status).toBe(503)
      expect(res.body.message).toContain('Unable to create traveler account')
    })

    it('cleans up auth user when sign-in fails', async () => {
      const mockUser = {
        id: 'new-traveler-id',
        user_metadata: { account_type: 'traveler' },
      }

      mockCreateUser.mockResolvedValue({ data: { user: mockUser }, error: null })
      mockUpsert.mockResolvedValue({ data: null, error: null })
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Sign in failed' },
      })
      mockDeleteUser.mockResolvedValue({ data: null, error: null })

      const res = await request(app)
        .post('/api/auth/guest')
        .send({ captchaToken: 'valid-token' })

      expect(res.status).toBe(503)
      expect(mockDeleteUser).toHaveBeenCalledWith('new-traveler-id')
    })
  })

  // ─── GET /api/auth/me ─────────────────────────────────────

  describe('GET /me', () => {
    it('returns user profile when it exists', async () => {
      const mockProfile = {
        id: MOCK_USER_ID,
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        roles: ['user'],
        account_type: 'google',
        timezone: 'UTC',
      }

      // 1) select profile .select().eq().single()
      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null })
      // 2) getUserById for avatar refresh
      mockGetUserById.mockResolvedValueOnce({ data: { user: { user_metadata: {} } } })
      // 3) update last_login .update().eq().select().single()
      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null })

      const res = await request(app).get('/api/auth/me')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.user).toBeDefined()
    })
  })

  // ─── PUT /api/auth/profile ────────────────────────────────

  describe('PUT /profile', () => {
    it('updates display name', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: MOCK_USER_ID,
          display_name: 'New Name',
          email: 'test@example.com',
        },
        error: null,
      })

      const res = await request(app)
        .put('/api/auth/profile')
        .send({ displayName: 'New Name' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('rejects empty display name', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ displayName: '' })

      expect(res.status).toBe(400)
    })

    it('validates email format', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Invalid email')
    })

    it('rejects non-string timezone', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ timezone: 123 })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Timezone must be a string')
    })

    it('rejects negative reminder minutes', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ defaultReminderMinutes: -5 })

      expect(res.status).toBe(400)
    })

    it('validates feedbackStatusOrder has all required statuses', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ feedbackStatusOrder: ['open', 'reviewed'] })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('feedbackStatusOrder')
    })
  })

  // ─── POST /api/auth/logout ────────────────────────────────

  describe('POST /logout', () => {
    it('signs out the user and returns success', async () => {
      mockSignOut.mockResolvedValue({ error: null })

      const res = await request(app).post('/api/auth/logout')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toBe('Logged out successfully')
    })
  })

  // ─── DELETE /api/auth/account ────────────────────────────

  describe('DELETE /account', () => {
    it('deletes owned calendar data, user profile, and auth user', async () => {
      const ownedCalendars = [
        { id: 'calendar-1' },
        { id: 'calendar-2' },
      ]

      mockMaybeSingle.mockResolvedValueOnce({
        data: { account_type: 'google', signup_source: 'localhost', wallet_address: null },
        error: null,
      })

      mockIn
        .mockResolvedValueOnce({ data: ownedCalendars, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      mockDeleteUser.mockResolvedValue({ data: null, error: null })

      const res = await request(app).delete('/api/auth/account')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      expect(mockFrom).toHaveBeenCalledWith('calendars')
      expect(mockFrom).toHaveBeenCalledWith('availability')
      expect(mockFrom).toHaveBeenCalledWith('meetings')
      expect(mockFrom).toHaveBeenCalledWith('calendar_sources')
      expect(mockFrom).toHaveBeenCalledWith('users')

      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteUser).toHaveBeenCalledWith(MOCK_USER_ID)
    })

    it('still deletes account-level data when user owns no calendars', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { account_type: 'traveler', signup_source: 'localhost', wallet_address: null },
        error: null,
      })

      mockIn.mockResolvedValueOnce({ data: [], error: null })

      mockDeleteUser.mockResolvedValue({ data: null, error: null })

      const res = await request(app).delete('/api/auth/account')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockDeleteUser).toHaveBeenCalledWith(MOCK_USER_ID)
    })
  })
})

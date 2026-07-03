import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Response, type NextFunction } from 'express'
import request from 'supertest'

// ─── Mock Supabase ──────────────────────────────────────────

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockMaybeSingle = vi.fn()
const mockDelete = vi.fn()
const mockThen = vi.fn()

function createChain() {
  const chain: Record<string, any> = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    delete: mockDelete.mockReturnThis(),
    then: mockThen,
  }
  return chain
}

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return createChain()
    },
  },
}))

// ─── Helpers ────────────────────────────────────────────────

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const MOCK_EMAIL = 'test@example.com'

let authMiddleware: typeof import('../../middleware/auth.js').authMiddleware
let optionalAuthMiddleware: typeof import('../../middleware/auth.js').optionalAuthMiddleware
let hasRole: typeof import('../../middleware/auth.js').hasRole
let hasCalendarEditPermission: typeof import('../../middleware/auth.js').hasCalendarEditPermission

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../auth.js')
  authMiddleware = mod.authMiddleware
  optionalAuthMiddleware = mod.optionalAuthMiddleware
  hasRole = mod.hasRole
  hasCalendarEditPermission = mod.hasCalendarEditPermission
})

afterEach(() => {
  vi.restoreAllMocks()
})

function buildApp(middleware: express.RequestHandler) {
  const app = express()
  app.use(express.json())
  app.use(middleware)
  app.get('/test', (req: any, res: Response) => {
    res.json({
      userId: req.userId,
      userEmail: req.userEmail,
      userRole: req.userRole,
      userRoles: req.userRoles,
      rawAuthUserId: req.rawAuthUserId,
    })
  })
  app.use((err: any, _req: express.Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.code, message: err.message })
  })
  return app
}

// ═══════════════════════════════════════════════════════════════
// hasRole
// ═══════════════════════════════════════════════════════════════

describe('hasRole', () => {
  it('returns true when role is in userRoles', () => {
    const req = { userRoles: ['admin', 'user'] } as any
    expect(hasRole(req, 'admin')).toBe(true)
  })

  it('returns false when role is not in userRoles', () => {
    const req = { userRoles: ['user'] } as any
    expect(hasRole(req, 'admin')).toBe(false)
  })

  it('falls back to userRole when userRoles is undefined', () => {
    const req = { userRole: 'admin' } as any
    expect(hasRole(req, 'admin')).toBe(true)
  })

  it('returns false when no roles are present', () => {
    const req = {} as any
    expect(hasRole(req, 'admin')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// hasCalendarEditPermission
// ═══════════════════════════════════════════════════════════════

describe('hasCalendarEditPermission', () => {
  it('returns isCreator=true when created_by matches userEmail', () => {
    const calendar = { created_by: MOCK_EMAIL, permissions: null }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(true)
    expect(result.canEdit).toBe(true)
  })

  it('returns isCreator=true when created_by matches userId', () => {
    const calendar = { created_by: MOCK_USER_ID, permissions: null }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(true)
    expect(result.canEdit).toBe(true)
  })

  it('returns canEdit=true when email is in permissions.canEdit array', () => {
    const calendar = { created_by: 'other@test.com', permissions: { canEdit: [MOCK_EMAIL] } }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(false)
    expect(result.canEdit).toBe(true)
  })

  it('returns canEdit=true when userId is in permissions.canEdit array', () => {
    const calendar = { created_by: 'other@test.com', permissions: { canEdit: [MOCK_USER_ID] } }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(false)
    expect(result.canEdit).toBe(true)
  })

  it('returns canEdit=false when user is not creator and not in canEdit', () => {
    const calendar = { created_by: 'other@test.com', permissions: { canEdit: ['someone@else.com'] } }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(false)
    expect(result.canEdit).toBe(false)
  })

  it('handles legacy space-separated canEdit string', () => {
    const calendar = { created_by: 'other@test.com', permissions: { canEdit: `someone@test.com ${MOCK_EMAIL}` } }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.canEdit).toBe(true)
  })

  it('handles null permissions', () => {
    const calendar = { created_by: 'other@test.com', permissions: null }
    const req = { userEmail: MOCK_EMAIL, userId: MOCK_USER_ID } as any
    const result = hasCalendarEditPermission(calendar, req)
    expect(result.isCreator).toBe(false)
    expect(result.canEdit).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// authMiddleware
// ═══════════════════════════════════════════════════════════════

describe('authMiddleware', () => {
  it('rejects requests without Authorization header', async () => {
    const app = buildApp(authMiddleware as express.RequestHandler)
    const res = await request(app).get('/test')
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Missing authentication token')
  })

  it('rejects invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } })

    const app = buildApp(authMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer invalid-token')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid or expired token')
  })

  it('attaches user info when token is valid and profile exists', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_EMAIL,
          user_metadata: {},
        },
      },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({
      data: { roles: ['admin', 'user'], wallet_address: null },
      error: null,
    })

    const app = buildApp(authMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBe(MOCK_USER_ID)
    expect(res.body.userEmail).toBe(MOCK_EMAIL)
    expect(res.body.userRole).toBe('admin')
    expect(res.body.userRoles).toEqual(['admin', 'user'])
  })

  it('defaults to user role when no profile exists and no wallet', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_EMAIL,
          user_metadata: {},
        },
      },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const app = buildApp(authMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    expect(res.body.userRole).toBe('user')
    expect(res.body.userRoles).toEqual(['user'])
  })

  it('preserves rawAuthUserId before any redirect', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_EMAIL,
          user_metadata: {},
        },
      },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({
      data: { roles: ['user'], wallet_address: null },
      error: null,
    })

    const app = buildApp(authMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer valid-token')

    expect(res.body.rawAuthUserId).toBe(MOCK_USER_ID)
  })
})

// ═══════════════════════════════════════════════════════════════
// optionalAuthMiddleware
// ═══════════════════════════════════════════════════════════════

describe('optionalAuthMiddleware', () => {
  it('proceeds without auth when no token is present', async () => {
    const app = buildApp(optionalAuthMiddleware as express.RequestHandler)
    const res = await request(app).get('/test')
    expect(res.status).toBe(200)
    expect(res.body.userId).toBeUndefined()
  })

  it('attaches user info when valid token is present', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_EMAIL,
          user_metadata: {},
        },
      },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({
      data: { roles: ['user'], wallet_address: null },
      error: null,
    })

    const app = buildApp(optionalAuthMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBe(MOCK_USER_ID)
    expect(res.body.userEmail).toBe(MOCK_EMAIL)
  })

  it('proceeds without auth when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })

    const app = buildApp(optionalAuthMiddleware as express.RequestHandler)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer bad-token')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeUndefined()
  })
})

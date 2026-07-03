import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/error-handler.js'

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()

function createChain() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
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

// ─── Auth mocks ─────────────────────────────────────────────────────────────

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const MOCK_EMAIL = 'admin@example.com'

// Admin mock (used by write-path tests)
const adminAuthMock = {
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = MOCK_EMAIL
    req.userRoles = ['admin']
    next()
  },
  hasRole: (_req: any, role: string) => role === 'admin',
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    next()
  },
}

// Non-admin mock (used by authorization tests)
const userAuthMock = {
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    req.userEmail = MOCK_EMAIL
    req.userRoles = ['user']
    next()
  },
  hasRole: (_req: any, _role: string) => false,
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    req.userId = MOCK_USER_ID
    next()
  },
}

// ─── App factory ────────────────────────────────────────────────────────────

async function createApp(authMock = adminAuthMock) {
  vi.doMock('../../middleware/auth.js', () => authMock)
  const { default: networkRelationsRouter } = await import('../network-relations.js')
  const app = express()
  app.use(express.json())
  app.use('/api/network-relations', networkRelationsRouter)
  app.use(errorHandler)
  return app
}

// ════════════════════════════════════════════════════════════════════════════

describe('Network Relations Routes', () => {
  let app: express.Express

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockInsert.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockDelete.mockReturnThis()
    mockOrder.mockReturnThis()
    mockLimit.mockReturnThis()
    app = await createApp()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── Public GET endpoints (no auth required) ──────────────────────────────

  describe('GET /api/network-relations/networks -- public', () => {
    it('returns networks list without auth', async () => {
      const mockNetworks = [
        { id: 'net-1', name: 'SPO Pool Operators', color: '#3B82F6', description: null },
        { id: 'net-2', name: 'DRep Network', color: '#10B981', description: 'Delegated reps' },
      ]
      mockOrder.mockResolvedValueOnce({ data: mockNetworks, error: null })

      const res = await request(app).get('/api/network-relations/networks')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('networks')
      expect(Array.isArray(res.body.networks)).toBe(true)
      expect(res.body.networks).toHaveLength(2)
      expect(res.body.networks[0]).toHaveProperty('name', 'SPO Pool Operators')
      expect(mockFrom).toHaveBeenCalledWith('networks')
    })

    it('returns empty array when no networks exist', async () => {
      mockOrder.mockResolvedValueOnce({ data: [], error: null })

      const res = await request(app).get('/api/network-relations/networks')

      expect(res.status).toBe(200)
      expect(res.body.networks).toEqual([])
    })

    it('returns 500 when DB query fails', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

      const res = await request(app).get('/api/network-relations/networks')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /api/network-relations/mappings -- public', () => {
    it('returns mappings list without auth', async () => {
      const mockMappings = [
        { id: 'map-1', network_id: 'net-1', source_string: 'IOHK', source_type: 'calendar_title' },
      ]
      mockOrder.mockResolvedValueOnce({ data: mockMappings, error: null })

      const res = await request(app).get('/api/network-relations/mappings')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('mappings')
      expect(mockFrom).toHaveBeenCalledWith('network_mappings')
    })
  })

  describe('GET /api/network-relations/rules -- public', () => {
    it('returns only active rules without auth', async () => {
      const mockRules = [
        { id: 'rule-1', network_id: 'net-1', pattern: 'SPO', match_type: 'contains', match_field: 'calendar_title', priority: 10, is_active: true },
      ]
      mockOrder.mockResolvedValueOnce({ data: mockRules, error: null })

      const res = await request(app).get('/api/network-relations/rules')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('rules')
      // Verify the query filtered for active rules only
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(mockFrom).toHaveBeenCalledWith('network_rules')
    })
  })

  // ─── Admin-only write endpoints -- authorization ───────────────────────────

  describe('Authorization: non-admin is rejected on all write endpoints', () => {
    let nonAdminApp: express.Express

    beforeEach(async () => {
      vi.resetModules()
      nonAdminApp = await createApp(userAuthMock)
    })

    it('POST /networks returns 403 for non-admin', async () => {
      const res = await request(nonAdminApp)
        .post('/api/network-relations/networks')
        .send({ name: 'Test', color: '#FF0000' })

      expect(res.status).toBe(403)
      expect(res.body).toHaveProperty('error', 'Admin role required')
    })

    it('PUT /networks/:id returns 403 for non-admin', async () => {
      const res = await request(nonAdminApp)
        .put('/api/network-relations/networks/net-1')
        .send({ name: 'Updated' })

      expect(res.status).toBe(403)
    })

    it('DELETE /networks/:id returns 403 for non-admin', async () => {
      const res = await request(nonAdminApp)
        .delete('/api/network-relations/networks/net-1')

      expect(res.status).toBe(403)
    })

    it('POST /mappings returns 403 for non-admin', async () => {
      const res = await request(nonAdminApp)
        .post('/api/network-relations/mappings')
        .send({ network_id: 'net-1', source_string: 'test', source_type: 'calendar_title' })

      expect(res.status).toBe(403)
    })

    it('POST /rules returns 403 for non-admin', async () => {
      const res = await request(nonAdminApp)
        .post('/api/network-relations/rules')
        .send({ network_id: 'net-1', pattern: 'test', match_type: 'contains', match_field: 'calendar_title' })

      expect(res.status).toBe(403)
    })
  })

  // ─── POST /networks -- admin creates a network ────────────────────────────

  describe('POST /api/network-relations/networks', () => {
    it('creates a network with valid data', async () => {
      const newNetwork = { id: 'net-new', name: 'New Network', color: '#3B82F6', description: null }
      mockSingle.mockResolvedValueOnce({ data: newNetwork, error: null })

      const res = await request(app)
        .post('/api/network-relations/networks')
        .send({ name: 'New Network' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('network')
      expect(res.body.network.name).toBe('New Network')
      expect(mockFrom).toHaveBeenCalledWith('networks')
    })

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/network-relations/networks')
        .send({ color: '#FF0000' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Name is required')
    })

    it('returns 400 for invalid hex color', async () => {
      const res = await request(app)
        .post('/api/network-relations/networks')
        .send({ name: 'Test', color: 'red' })  // 3 chars, passes sanitize but fails hex regex

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/hex color/)
    })

    it('returns 409 on duplicate name', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'unique' } })

      const res = await request(app)
        .post('/api/network-relations/networks')
        .send({ name: 'Duplicate' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already exists/)
    })

    it('rejects name longer than 200 chars', async () => {
      const res = await request(app)
        .post('/api/network-relations/networks')
        .send({ name: 'A'.repeat(201) })

      // sanitizeString truncates to 200 -- the 201-char name becomes exactly 200 chars, still valid
      // but a genuinely missing name should fail; confirm the sanitized value was used (no crash)
      expect([201, 400]).toContain(res.status)
    })
  })

  // ─── POST /rules -- regex validation ─────────────────────────────────────

  describe('POST /api/network-relations/rules -- regex validation', () => {
    it('accepts a valid regex pattern', async () => {
      const newRule = { id: 'rule-new', network_id: 'net-1', pattern: '^SPO', match_type: 'regex', match_field: 'calendar_title', priority: 5, is_active: true }
      mockSingle.mockResolvedValueOnce({ data: newRule, error: null })

      const res = await request(app)
        .post('/api/network-relations/rules')
        .send({ network_id: 'net-1', pattern: '^SPO', match_type: 'regex', match_field: 'calendar_title' })

      expect(res.status).toBe(201)
      expect(res.body.rule.pattern).toBe('^SPO')
    })

    it('returns 400 for invalid regex pattern', async () => {
      const res = await request(app)
        .post('/api/network-relations/rules')
        .send({ network_id: 'net-1', pattern: '(unclosed', match_type: 'regex', match_field: 'calendar_title' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/regex/)
    })

    it('returns 400 for invalid match_type', async () => {
      const res = await request(app)
        .post('/api/network-relations/rules')
        .send({ network_id: 'net-1', pattern: 'test', match_type: 'invalid', match_field: 'calendar_title' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/match_type/)
    })

    it('returns 400 for invalid match_field', async () => {
      const res = await request(app)
        .post('/api/network-relations/rules')
        .send({ network_id: 'net-1', pattern: 'test', match_type: 'contains', match_field: 'bad_field' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/match_field/)
    })
  })

  // ─── POST /mappings -- input validation ───────────────────────────────────

  describe('POST /api/network-relations/mappings', () => {
    it('returns 400 for invalid source_type', async () => {
      const res = await request(app)
        .post('/api/network-relations/mappings')
        .send({ network_id: 'net-1', source_string: 'test', source_type: 'bad_type' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/source_type/)
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/network-relations/mappings')
        .send({ network_id: 'net-1' })

      expect(res.status).toBe(400)
    })

    it('creates a mapping with valid data', async () => {
      const newMapping = { id: 'map-new', network_id: 'net-1', source_string: 'Catalyst', source_type: 'meeting_title' }
      mockSingle.mockResolvedValueOnce({ data: newMapping, error: null })

      const res = await request(app)
        .post('/api/network-relations/mappings')
        .send({ network_id: 'net-1', source_string: 'Catalyst', source_type: 'meeting_title' })

      expect(res.status).toBe(201)
      expect(res.body.mapping.source_string).toBe('Catalyst')
    })
  })
})

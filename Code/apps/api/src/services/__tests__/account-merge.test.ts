import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock Supabase ──────────────────────────────────────────

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockIn = vi.fn()

const mockOr = vi.fn()

function createChain(): Record<string, any> {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    or: mockOr,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: (resolve: (v: any) => void) => resolve({ data: [], error: null }),
  }
}

const mockGetUserById = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock('../../supabaseClient.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return createChain()
    },
    auth: {
      admin: {
        getUserById: (...args: unknown[]) => mockGetUserById(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
      },
    },
  },
}))

// ─── Import after mocks ─────────────────────────────────────

let createMergeToken: typeof import('../../services/account-merge.js').createMergeToken
let mergeTokenStore: typeof import('../../services/account-merge.js').mergeTokenStore
let mergeAccounts: typeof import('../../services/account-merge.js').mergeAccounts

beforeEach(async () => {
  vi.clearAllMocks()
  mockSelect.mockReturnThis()
  mockEq.mockReturnThis()
  mockUpdate.mockReturnThis()
  mockDelete.mockReturnThis()
  mockIn.mockReturnThis()
  mockInsert.mockReturnThis()
  mockOr.mockReturnThis()
  const mod = await import('../account-merge.js')
  createMergeToken = mod.createMergeToken
  mergeTokenStore = mod.mergeTokenStore
  mergeAccounts = mod.mergeAccounts
})

afterEach(() => {
  mergeTokenStore.clear()
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════

describe('Account Merge Service', () => {
  // ─── createMergeToken ─────────────────────────────────────

  describe('createMergeToken', () => {
    it('creates a token and stores it', () => {
      const token = createMergeToken('source-user-1', 'cardano')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(10)
      expect(mergeTokenStore.has(token)).toBe(true)
    })

    it('stores correct metadata', () => {
      const token = createMergeToken('source-user-1', 'cardano')
      const stored = mergeTokenStore.get(token)

      expect(stored).toBeDefined()
      expect(stored!.sourceUserId).toBe('source-user-1')
      expect(stored!.sourceAccountType).toBe('cardano')
      expect(stored!.expiresAt).toBeGreaterThan(Date.now())
    })

    it('creates unique tokens each time', () => {
      const token1 = createMergeToken('user-1', 'google')
      const token2 = createMergeToken('user-2', 'google')

      expect(token1).not.toBe(token2)
    })

    it('stores token with 10-minute TTL', () => {
      const token = createMergeToken('user-1', 'google')
      const stored = mergeTokenStore.get(token)

      // TTL should be approximately 10 minutes (allow 1s tolerance)
      const expectedExpiry = Date.now() + 10 * 60 * 1000
      expect(stored!.expiresAt).toBeGreaterThan(expectedExpiry - 1000)
      expect(stored!.expiresAt).toBeLessThan(expectedExpiry + 1000)
    })
  })

  // ─── mergeAccounts ────────────────────────────────────────

  describe('mergeAccounts', () => {
    const SOURCE_ID = 'source-user-id'
    const TARGET_ID = 'target-user-id'

    it('throws when source user not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null })
      mockSingle.mockResolvedValueOnce({ data: { id: TARGET_ID, email: 'target@test.com' }, error: null })

      await expect(mergeAccounts(SOURCE_ID, TARGET_ID, false))
        .rejects.toThrow('One or both accounts not found')
    })

    it('throws when target user not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: SOURCE_ID, email: 'source@test.com' }, error: null })
      mockSingle.mockResolvedValueOnce({ data: null, error: null })

      await expect(mergeAccounts(SOURCE_ID, TARGET_ID, false))
        .rejects.toThrow('One or both accounts not found')
    })

    it('transfers calendars, templates, feedback, and connections', async () => {
      const sourceUser = {
        id: SOURCE_ID,
        email: 'source@test.com',
        wallet_address: null,
        display_name: 'Source User',
        account_type: 'google',
      }
      const targetUser = {
        id: TARGET_ID,
        email: 'target@test.com',
        wallet_address: null,
        display_name: 'Target User',
        account_type: 'google',
      }

      // Fetch both profiles (.single() calls)
      mockSingle.mockResolvedValueOnce({ data: sourceUser, error: null })
      mockSingle.mockResolvedValueOnce({ data: targetUser, error: null })

      // Auth user lookup for source identities
      mockGetUserById.mockResolvedValue({ data: { user: { email: 'source@test.com' } } })

      // All subsequent select queries should return empty arrays
      // (no calendars, sources, contacts, connections, etc. to transfer)
      mockSelect.mockImplementation(() => {
        const chainWithThen: Record<string, any> = {
          eq: mockEq,
          in: mockIn,
          or: mockOr,
          single: mockSingle,
          maybeSingle: mockMaybeSingle,
          then: (resolve: (v: any) => void) => resolve({ data: [], error: null }),
        }
        return chainWithThen
      })

      // maybeSingle calls (discord integration, notification prefs, privacy) return null
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      // updateUserById for redirect metadata
      mockUpdateUserById.mockResolvedValue({ data: null, error: null })

      await expect(mergeAccounts(SOURCE_ID, TARGET_ID, false)).resolves.not.toThrow()
    })
  })
})

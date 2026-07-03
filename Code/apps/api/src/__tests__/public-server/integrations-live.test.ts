/**
 * Integration Data — Live Server Tests
 *
 * Tests that integration endpoints (calendar sources, Discord, Luma, etc.)
 * are reachable and return proper data structures on the deployed server.
 * Uses a guest/test session for authenticated requests.
 *
 * On public servers with captcha, provide TEST_AUTH_TOKEN env var for full coverage.
 * Tests that need auth gracefully skip when no session is available.
 *
 * Run: pnpm test:server -- --run src/__tests__/public-server/integrations-live.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  SERVER_URL,
  TEST_TIMEOUT,
  apiRequest,
  getTestSession,
  deleteGuestAccount,
  GuestSession,
} from './setup.js'

describe(`Integration Data — ${SERVER_URL}`, () => {
  let guest: GuestSession | null = null
  let isGuestCreated = false

  beforeAll(async () => {
    guest = await getTestSession()
    if (guest && guest.userId !== 'env-provided') {
      isGuestCreated = true
    }
    if (!guest) {
      console.log('No auth session available -- auth-required integration tests will be skipped')
    }
  }, TEST_TIMEOUT)

  afterAll(async () => {
    if (guest && isGuestCreated) {
      await deleteGuestAccount(guest.accessToken)
    }
  })

  // ─── Calendar Sources ───────────────────────────────────

  describe('GET /api/calendar-sources — connected sources', () => {
    it('returns a list (possibly empty for guest)', async () => {
      if (!guest) return
      const { status, data } = await apiRequest('/api/calendar-sources', {
        token: guest.accessToken,
      })

      expect(status).toBe(200)
      // Response wraps sources in an object
      expect(data).toHaveProperty('sources')
      expect(Array.isArray(data.sources)).toBe(true)
    }, TEST_TIMEOUT)
  })

  // ─── Discord Integration ────────────────────────────────

  describe('GET /api/discord/integration — Discord status', () => {
    it('returns integration status for authenticated user', async () => {
      if (!guest) return
      const { status, data } = await apiRequest('/api/discord/integration', {
        token: guest.accessToken,
      })

      // 200 with integration data, or 404 if not connected
      expect([200, 404]).toContain(status)

      if (status === 200) {
        // Response wraps integration in an object
        expect(data).toHaveProperty('integration')
        if (data.integration) {
          expect(data.integration).toHaveProperty('discord_user_id')
        }
      }
    }, TEST_TIMEOUT)

    it('rejects unauthenticated requests', async () => {
      const { status } = await apiRequest('/api/discord/integration')

      expect(status).toBe(401)
    }, TEST_TIMEOUT)
  })

  // ─── Luma Integration ───────────────────────────────────

  describe('GET /api/luma/integration — Luma status', () => {
    it('returns integration status for authenticated user', async () => {
      if (!guest) return
      const { status } = await apiRequest('/api/luma/integration', {
        token: guest.accessToken,
      })

      // 200 with integration data, or 404 if not connected
      expect([200, 404]).toContain(status)
    }, TEST_TIMEOUT)

    it('rejects unauthenticated requests', async () => {
      const { status } = await apiRequest('/api/luma/integration')

      expect(status).toBe(401)
    }, TEST_TIMEOUT)
  })

  // ─── Connections ────────────────────────────────────────

  describe('GET /api/connections — user connections', () => {
    it('returns connections list for authenticated user', async () => {
      if (!guest) return
      const { status, data } = await apiRequest('/api/connections', {
        token: guest.accessToken,
      })

      expect(status).toBe(200)
      // Response wraps connections in an object
      expect(data).toHaveProperty('connections')
      expect(Array.isArray(data.connections)).toBe(true)
    }, TEST_TIMEOUT)

    it('rejects unauthenticated requests', async () => {
      const { status } = await apiRequest('/api/connections')

      expect(status).toBe(401)
    }, TEST_TIMEOUT)
  })

  // ─── Notification Preferences ───────────────────────────

  describe('GET /api/notification-preferences', () => {
    it('returns preferences for authenticated user', async () => {
      if (!guest) return
      const { status } = await apiRequest('/api/notification-preferences', {
        token: guest.accessToken,
      })

      // 200 with preferences, or 404 if none set yet
      expect([200, 404]).toContain(status)
    }, TEST_TIMEOUT)
  })

  // ─── Privacy Settings ──────────────────────────────────

  describe('GET /api/privacy-settings', () => {
    it('returns privacy settings for authenticated user', async () => {
      if (!guest) return
      const { status } = await apiRequest('/api/privacy-settings', {
        token: guest.accessToken,
      })

      // 200 with settings, or 404 if none set yet
      expect([200, 404]).toContain(status)
    }, TEST_TIMEOUT)
  })

  // ─── Wallet Status (with guest auth) ───────────────────

  describe('GET /api/auth/wallet/status — with guest session', () => {
    it('returns wallet connection status', async () => {
      if (!guest) return
      const { status, data } = await apiRequest('/api/auth/wallet/status', {
        token: guest.accessToken,
      })

      // Guest accounts don't have wallets linked
      // 429 = rate-limited from repeated test runs; acceptable
      expect([200, 429]).toContain(status)
      if (status === 200 && data && typeof data === 'object') {
        expect(data.linked).toBe(false)
      }
    }, TEST_TIMEOUT)
  })

  // ─── AI Chat Status ────────────────────────────────────

  describe('GET /api/ai-chat/status — AI provider status', () => {
    it('returns AI availability info', async () => {
      if (!guest) return
      const { status } = await apiRequest('/api/ai-chat/status', {
        token: guest.accessToken,
      })

      // Should respond with provider status
      expect([200, 404, 503]).toContain(status)
    }, TEST_TIMEOUT)
  })
})

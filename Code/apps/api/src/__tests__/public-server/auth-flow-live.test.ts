/**
 * Auth Flow — Live Server Tests
 *
 * Tests the full authentication lifecycle against the real server:
 * guest account creation, profile retrieval, and cleanup.
 *
 * On public servers with captcha enabled, guest creation may be unavailable.
 * Provide TEST_AUTH_TOKEN env var or run against localhost for full coverage.
 *
 * Run: pnpm test:server -- --run src/__tests__/public-server/auth-flow-live.test.ts
 */

import { describe, it, expect, afterAll } from 'vitest'
import {
  SERVER_URL,
  TEST_TIMEOUT,
  apiRequest,
  getTestSession,
  createGuestSession,
  deleteGuestAccount,
  GuestSession,
} from './setup.js'

describe(`Auth Flow — ${SERVER_URL}`, () => {
  let guest: GuestSession | null = null
  let isGuestCreated = false

  afterAll(async () => {
    if (guest && isGuestCreated) {
      await deleteGuestAccount(guest.accessToken)
    }
  })

  // ─── Guest account creation ─────────────────────────────

  describe('POST /api/auth/guest — create guest account', () => {
    it('creates a guest account or reports captcha requirement', async () => {
      guest = await createGuestSession()

      if (guest) {
        isGuestCreated = true
        expect(guest.accessToken).toBeTruthy()
        expect(typeof guest.accessToken).toBe('string')
        expect(guest.accessToken.length).toBeGreaterThan(10)
        expect(guest.userId).toBeTruthy()
      } else {
        // On public server with captcha -- this is expected
        console.log('Guest session unavailable (captcha/rate-limit) -- skipping auth-dependent tests')
      }
    }, TEST_TIMEOUT)
  })

  // ─── Profile retrieval ──────────────────────────────────

  describe('GET /api/auth/me — user profile', () => {
    it('returns user profile with valid session', async () => {
      if (!guest) guest = await getTestSession()
      if (!guest) return // skip silently if no session available

      const { status, data } = await apiRequest('/api/auth/me', {
        token: guest.accessToken,
      })

      expect(status).toBe(200)
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('id')
    }, TEST_TIMEOUT)

    it('profile contains expected fields', async () => {
      if (!guest) guest = await getTestSession()
      if (!guest) return

      const { data } = await apiRequest('/api/auth/me', {
        token: guest.accessToken,
      })

      // Guest accounts have auto-generated display names
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('displayName')
      expect(typeof data.user.displayName).toBe('string')
      expect(data.user.displayName.length).toBeGreaterThan(0)
    }, TEST_TIMEOUT)

    it('rejects requests with invalid token', async () => {
      const { status } = await apiRequest('/api/auth/me', {
        token: 'this-is-not-a-valid-jwt-token',
      })

      expect(status).toBe(401)
    }, TEST_TIMEOUT)

    it('rejects requests with no token', async () => {
      const { status } = await apiRequest('/api/auth/me')

      expect(status).toBe(401)
    }, TEST_TIMEOUT)
  })

  // ─── Profile update ─────────────────────────────────────

  describe('PUT /api/auth/profile — update profile', () => {
    it('can update display name', async () => {
      if (!guest) guest = await getTestSession()
      if (!guest) return

      const newName = `Test Runner ${Date.now()}`
      const { status } = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        token: guest.accessToken,
        body: { displayName: newName },
      })

      expect(status).toBe(200)

      // Verify the update stuck
      const { data: profile } = await apiRequest('/api/auth/me', {
        token: guest.accessToken,
      })
      expect(profile.user.displayName).toBe(newName)
    }, TEST_TIMEOUT)
  })

  // ─── Logout ─────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('logout endpoint responds successfully', async () => {
      const logoutGuest = await createGuestSession()
      if (!logoutGuest) return // captcha blocked

      const { status, data } = await apiRequest('/api/auth/logout', {
        method: 'POST',
        token: logoutGuest.accessToken,
      })

      expect(status).toBe(200)
      expect(data.success).toBe(true)

      await deleteGuestAccount(logoutGuest.accessToken)
    }, TEST_TIMEOUT)
  })

  // ─── Account deletion ──────────────────────────────────

  describe('DELETE /api/auth/account — cleanup', () => {
    it('can delete a guest account', async () => {
      const throwaway = await createGuestSession()
      if (!throwaway) return // captcha blocked

      const { status } = await apiRequest('/api/auth/account', {
        method: 'DELETE',
        token: throwaway.accessToken,
      })

      expect(status).toBe(200)

      // Verify the account is gone
      const { status: verifyStatus } = await apiRequest('/api/auth/me', {
        token: throwaway.accessToken,
      })

      // Should be 401 (token invalid) or 404 (user not found)
      expect(verifyStatus).toBeGreaterThanOrEqual(400)
    }, TEST_TIMEOUT)

    it('deletes account with calendars, availability, and meetings', async () => {
      const throwaway = await createGuestSession()
      if (!throwaway) return // captcha blocked

      // 1) Seed a calendar owned by this account
      const calRes = await apiRequest('/api/calendars', {
        method: 'POST',
        token: throwaway.accessToken,
        body: {
          title: `Delete Cascade ${Date.now()}`,
          config: { eventName: 'Delete Cascade', timeInterval: 30 },
          permissions: { canEdit: [] },
          visibility: 'unlisted',
        },
      })

      if (calRes.status !== 201) {
        // Some public environments may deny write operations.
        // If this cannot be seeded, skip this scenario.
        return
      }

      const calendarHash = calRes.data?.hash as string | undefined
      expect(typeof calendarHash).toBe('string')

      // 2) Seed availability for this calendar
      const availabilityRes = await apiRequest('/api/availability', {
        method: 'POST',
        token: throwaway.accessToken,
        body: {
          calendar_hash: calendarHash,
          username: 'Delete Test User',
          time_slots: ['2030-01-01_09:00', '2030-01-01_09:30'],
        },
      })
      expect([200, 201]).toContain(availabilityRes.status)

      // 3) Seed one meeting for this calendar
      const meetingRes = await apiRequest('/api/meetings', {
        method: 'POST',
        token: throwaway.accessToken,
        body: {
          calendar_hash: calendarHash,
          title: 'Delete Cascade Meeting',
          description: 'Seed data for deletion test',
          start_time: '2030-01-01T09:00:00Z',
          end_time: '2030-01-01T09:30:00Z',
          duration_minutes: 30,
          time_slots: ['2030-01-01_09:00'],
        },
      })
      expect([201, 429]).toContain(meetingRes.status)

      // 4) Delete account
      const deleteRes = await apiRequest('/api/auth/account', {
        method: 'DELETE',
        token: throwaway.accessToken,
      })
      expect(deleteRes.status).toBe(200)

      // 5) Verify auth is invalidated
      const meRes = await apiRequest('/api/auth/me', {
        token: throwaway.accessToken,
      })
      expect(meRes.status).toBeGreaterThanOrEqual(400)

      // 6) Verify calendar, availability, and meetings are no longer accessible
      const calendarAfterDelete = await apiRequest(`/api/calendars/${calendarHash}`)
      expect(calendarAfterDelete.status).toBe(404)

      const availabilityAfterDelete = await apiRequest(`/api/availability/${calendarHash}`)
      expect(availabilityAfterDelete.status).toBe(404)

      const meetingsAfterDelete = await apiRequest(`/api/meetings/${calendarHash}`)
      expect(meetingsAfterDelete.status).toBe(404)
    }, TEST_TIMEOUT)
  })
})

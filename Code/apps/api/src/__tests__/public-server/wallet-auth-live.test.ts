/**
 * Wallet Auth — Live Server Tests
 *
 * Tests the Cardano wallet authentication flow against the real server.
 * Does NOT require an actual wallet -- tests challenge generation,
 * supported wallets list, and address validation only.
 *
 * Run: pnpm test:server -- --run src/__tests__/public-server/wallet-auth-live.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  SERVER_URL,
  TEST_TIMEOUT,
  apiRequest,
  VALID_CARDANO_ADDRESS,
  INVALID_CARDANO_ADDRESS,
} from './setup.js'

describe(`Wallet Auth — ${SERVER_URL}`, () => {

  // ─── GET /api/auth/wallet/supported ─────────────────────

  describe('GET /api/auth/wallet/supported', () => {
    it('returns list of supported wallet types', async () => {
      const { status, data } = await apiRequest('/api/auth/wallet/supported')

      // 429 = rate-limited, expected on public server during batch runs
      if (status === 429) return

      expect(status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.wallets).toBeInstanceOf(Array)
      expect(data.wallets.length).toBeGreaterThanOrEqual(3)
    }, TEST_TIMEOUT)

    it('each wallet has id, name, and icon fields', async () => {
      const { status, data } = await apiRequest('/api/auth/wallet/supported')
      if (status === 429) return

      for (const wallet of data.wallets) {
        expect(wallet).toHaveProperty('id')
        expect(wallet).toHaveProperty('name')
        expect(wallet).toHaveProperty('icon')
        expect(typeof wallet.id).toBe('string')
        expect(typeof wallet.name).toBe('string')
      }
    }, TEST_TIMEOUT)

    it('includes well-known wallets (Eternl, Lace)', async () => {
      const { status, data } = await apiRequest('/api/auth/wallet/supported')
      if (status === 429) return

      const ids = data.wallets.map((w: { id: string }) => w.id)

      expect(ids).toContain('eternl')
      expect(ids).toContain('lace')
    }, TEST_TIMEOUT)
  })

  // ─── POST /api/auth/wallet/challenge ────────────────────

  describe('POST /api/auth/wallet/challenge', () => {
    it('generates a challenge for a valid Cardano address', async () => {
      const { status, data } = await apiRequest('/api/auth/wallet/challenge', {
        method: 'POST',
        body: { address: VALID_CARDANO_ADDRESS },
      })

      // May require captcha in production -- 200 means success, 400/403 means captcha required
      if (status === 200) {
        expect(data).toHaveProperty('nonce')
        expect(data).toHaveProperty('message')
        expect(typeof data.nonce).toBe('string')
        expect(data.nonce.length).toBeGreaterThan(0)
        expect(typeof data.message).toBe('string')
      } else if (status === 400 || status === 403 || status === 429) {
        // Captcha required or rate-limited on public server -- expected behavior
        expect(data).toHaveProperty('error')
      } else {
        expect.unreachable(`Unexpected status ${status}: ${JSON.stringify(data)}`)
      }
    }, TEST_TIMEOUT)

    it('rejects an invalid (too short) address', async () => {
      const { status } = await apiRequest('/api/auth/wallet/challenge', {
        method: 'POST',
        body: { address: INVALID_CARDANO_ADDRESS },
      })

      // Should be 400 (bad request) for invalid address
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    }, TEST_TIMEOUT)

    it('rejects empty body', async () => {
      const { status } = await apiRequest('/api/auth/wallet/challenge', {
        method: 'POST',
        body: {},
      })

      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    }, TEST_TIMEOUT)

    it('rejects non-Cardano address prefixes', async () => {
      const { status } = await apiRequest('/api/auth/wallet/challenge', {
        method: 'POST',
        body: { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
      })

      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    }, TEST_TIMEOUT)
  })

  // ─── POST /api/auth/wallet/verify (negative tests) ─────

  describe('POST /api/auth/wallet/verify — error cases', () => {
    it('rejects verify with missing fields', async () => {
      const { status } = await apiRequest('/api/auth/wallet/verify', {
        method: 'POST',
        body: { address: VALID_CARDANO_ADDRESS },
        // Missing nonce, signature, key
      })

      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    }, TEST_TIMEOUT)

    it('rejects verify with invalid nonce', async () => {
      const { status } = await apiRequest('/api/auth/wallet/verify', {
        method: 'POST',
        body: {
          address: VALID_CARDANO_ADDRESS,
          nonce: 'not-a-real-nonce',
          signature: 'deadbeef',
          key: 'deadbeef',
        },
      })

      // Should be 400 or 401 (invalid/expired challenge)
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    }, TEST_TIMEOUT)
  })

  // ─── Wallet status without auth ─────────────────────────

  describe('GET /api/auth/wallet/status — unauthenticated', () => {
    it('returns 401 or 429 without auth token', async () => {
      const { status } = await apiRequest('/api/auth/wallet/status')

      // 401 = unauthorized (expected), 429 = rate-limited (also expected on public)
      expect([401, 429]).toContain(status)
    }, TEST_TIMEOUT)
  })

  // ─── Managed wallet lifecycle ───────────────────────────

  describe('POST /api/auth/wallet/managed/register + DELETE /api/auth/account', () => {
    it('can create and delete a managed wallet account', async () => {
      const keyHex = `${Date.now().toString(16).padStart(16, '0')}${'a'.repeat(48)}`.slice(0, 64)
      const address = `managed_${keyHex}`

      const registerRes = await apiRequest('/api/auth/wallet/managed/register', {
        method: 'POST',
        body: {
          address,
          publicKey: keyHex,
          encryptedBlob: 'dGVzdF9lbmNyeXB0ZWRfYmxvYg',
        },
      })

      // Public environments may block by captcha/rate-limit.
      if ([400, 403, 429].includes(registerRes.status)) {
        return
      }

      expect(registerRes.status).toBe(200)
      expect(registerRes.data?.success).toBe(true)

      const accessToken = registerRes.data?.session?.access_token as string | undefined
      expect(typeof accessToken).toBe('string')

      const deleteRes = await apiRequest('/api/auth/account', {
        method: 'DELETE',
        token: accessToken,
      })
      expect(deleteRes.status).toBe(200)

      const meAfterDelete = await apiRequest('/api/auth/me', {
        token: accessToken,
      })
      expect(meAfterDelete.status).toBeGreaterThanOrEqual(400)
    }, TEST_TIMEOUT)
  })
})

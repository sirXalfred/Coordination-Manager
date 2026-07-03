/**
 * Public Data — Live Server Tests
 *
 * Tests endpoints that should work WITHOUT authentication.
 * These verify that public-facing data is accessible on the deployed server.
 *
 * Run: pnpm test:server -- --run src/__tests__/public-server/public-data-live.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  SERVER_URL,
  TEST_TIMEOUT,
  apiRequest,
} from './setup.js'

describe(`Public Data — ${SERVER_URL}`, () => {

  // ─── Public Events ──────────────────────────────────────

  describe('GET /api/user-events/public — public events', () => {
    it('returns public events without auth', async () => {
      const { status, data } = await apiRequest('/api/user-events/public')

      expect(status).toBe(200)

      // Response may be an array directly or an object with events array
      const events = Array.isArray(data) ? data : data?.events ?? data?.data
      if (Array.isArray(events) && events.length > 0) {
        const event = events[0]
        expect(event).toHaveProperty('id')
      }
    }, TEST_TIMEOUT)
  })

  // ─── Network Relations (public read) ────────────────────

  describe('GET /api/network-relations/networks -- public', () => {
    it('returns networks array without auth', async () => {
      const { status, data } = await apiRequest('/api/network-relations/networks')

      expect(status).toBe(200)
      expect(data).toHaveProperty('networks')
      expect(Array.isArray(data.networks)).toBe(true)
    }, TEST_TIMEOUT)
  })

  describe('GET /api/network-relations/mappings -- public', () => {
    it('returns mappings array without auth', async () => {
      const { status, data } = await apiRequest('/api/network-relations/mappings')

      expect(status).toBe(200)
      expect(data).toHaveProperty('mappings')
      expect(Array.isArray(data.mappings)).toBe(true)
    }, TEST_TIMEOUT)
  })

  describe('GET /api/network-relations/rules -- public', () => {
    it('returns active rules array without auth', async () => {
      const { status, data } = await apiRequest('/api/network-relations/rules')

      expect(status).toBe(200)
      expect(data).toHaveProperty('rules')
      expect(Array.isArray(data.rules)).toBe(true)
    }, TEST_TIMEOUT)
  })

  describe('POST /api/network-relations/networks -- write requires auth+admin', () => {
    it('returns 401 without auth', async () => {
      const { status } = await apiRequest('/api/network-relations/networks', {
        method: 'POST',
        body: { name: 'Security Test Network', color: '#FF0000' },
      })

      expect(status).toBe(401)
    }, TEST_TIMEOUT)
  })

  // ─── Rate Limiting ──────────────────────────────────────

  describe('Rate limiting — server enforces limits', () => {
    it('health endpoint allows multiple rapid requests', async () => {
      // Health should be generous with rate limits
      const results = await Promise.all(
        Array.from({ length: 5 }, () => apiRequest('/health'))
      )

      // All 5 should succeed (well within the 300/15min global limit)
      for (const r of results) {
        expect(r.status).toBe(200)
      }
    }, TEST_TIMEOUT)
  })

  // ─── Error Response Format ──────────────────────────────

  describe('Error responses — consistent format', () => {
    it('404 errors return structured JSON', async () => {
      const { status, data } = await apiRequest('/api/nonexistent-endpoint')

      expect(status).toBe(404)
      expect(typeof data).toBe('object')
      expect(data).toHaveProperty('error', 'NOT_FOUND')
    }, TEST_TIMEOUT)

    it('401 errors include error message', async () => {
      const { status, data } = await apiRequest('/api/auth/me')

      expect(status).toBe(401)
      expect(data).toHaveProperty('error')
    }, TEST_TIMEOUT)
  })

  // ─── Response Time Sanity Check ─────────────────────────

  describe('Response time — basic performance', () => {
    it('health endpoint responds within 5 seconds', async () => {
      const start = Date.now()
      const { status } = await apiRequest('/health')
      const elapsed = Date.now() - start

      expect(status).toBe(200)
      expect(elapsed).toBeLessThan(5000)
    }, TEST_TIMEOUT)

    it('public events endpoint responds within 10 seconds', async () => {
      const start = Date.now()
      const { status } = await apiRequest('/api/user-events/public')
      const elapsed = Date.now() - start

      expect(status).toBe(200)
      expect(elapsed).toBeLessThan(10000)
    }, TEST_TIMEOUT)
  })
})

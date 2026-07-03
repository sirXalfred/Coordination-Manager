/**
 * Server Health & Connectivity Tests
 *
 * Verifies the server is reachable and responding correctly.
 * These are the most basic smoke tests -- if these fail, nothing else will work.
 *
 * Run: pnpm test:server -- --run src/__tests__/public-server/server-health.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  SERVER_URL,
  isPublicServer,
  TEST_TIMEOUT,
  apiRequest,
} from './setup.js'

describe(`Server Health — ${SERVER_URL}`, () => {
  it('GET /health returns 200 with status info', async () => {
    const { status, data } = await apiRequest('/health')

    expect(status).toBe(200)
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('ok')
    expect(data).toHaveProperty('timestamp')
  }, TEST_TIMEOUT)

  it('returns proper JSON content-type', async () => {
    const { headers } = await apiRequest('/health')
    const contentType = headers.get('content-type') || ''

    expect(contentType).toContain('application/json')
  }, TEST_TIMEOUT)

  it('has security headers (Helmet)', async () => {
    const { headers } = await apiRequest('/health')

    // Helmet sets these headers
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('x-frame-options')).toBeTruthy()
  }, TEST_TIMEOUT)

  it('allows CORS from known origins', async () => {
    const origin = isPublicServer
      ? 'https://coordinationmanager.com'
      : 'http://localhost:5173'

    const res = await fetch(`${SERVER_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    })

    // Should get 204 (preflight OK) or 200
    expect(res.status).toBeLessThan(300)

    const allowOrigin = res.headers.get('access-control-allow-origin')
    // CORS should either mirror the origin or be '*'
    expect(
      allowOrigin === origin || allowOrigin === '*'
    ).toBe(true)
  }, TEST_TIMEOUT)

  it('rejects requests to unknown routes with 404', async () => {
    const { status } = await apiRequest('/api/this-route-does-not-exist')

    expect(status).toBe(404)
  }, TEST_TIMEOUT)

  it('API base path responds (not just root)', async () => {
    // Auth endpoints should return 401 without a token, not 404
    const { status } = await apiRequest('/api/auth/me')

    // 401 means the route exists but requires auth -- that's correct
    expect(status).toBe(401)
  }, TEST_TIMEOUT)
})

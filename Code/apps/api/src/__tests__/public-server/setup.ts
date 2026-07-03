/**
 * Shared test configuration and helpers for public-server tests.
 *
 * These tests hit a REAL server (localhost or production).
 * Set TEST_SERVER_URL to target a specific deployment.
 */

// ─── Server URL ─────────────────────────────────────────────

export const SERVER_URL =
  process.env.TEST_SERVER_URL || 'http://localhost:3001'

export const isPublicServer =
  !SERVER_URL.includes('localhost') && !SERVER_URL.includes('127.0.0.1')

// ─── Timeouts ───────────────────────────────────────────────

/** Per-request timeout (public servers are slower) */
export const REQUEST_TIMEOUT = Number(process.env.TEST_TIMEOUT) || (isPublicServer ? 15_000 : 5_000)

/** Vitest test-level timeout */
export const TEST_TIMEOUT = REQUEST_TIMEOUT + 5_000

// ─── Auth helpers ───────────────────────────────────────────

export interface GuestSession {
  accessToken: string
  refreshToken: string
  userId: string
}

/**
 * Create a guest traveler account and return the session tokens.
 * The caller is responsible for deleting the account in afterAll.
 *
 * On public servers with captcha enabled, this will return null
 * (tests that need auth should skip when session is unavailable).
 */
export async function createGuestSession(): Promise<GuestSession | null> {
  const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    // Captcha or rate-limit on public server -- expected, not an error
    if (res.status === 400 || res.status === 429) {
      console.warn(`Guest session unavailable (${res.status}): ${body}`)
      return null
    }
    throw new Error(`Failed to create guest session (${res.status}): ${body}`)
  }

  const body = await res.json()

  // The API returns { user, session } where session has access_token/refresh_token
  const session = body.session
  if (!session?.access_token) {
    throw new Error(`Guest session response missing access_token: ${JSON.stringify(body)}`)
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: body.user?.id || session.user?.id,
  }
}

/**
 * Get a session token for authenticated tests.
 * Prefers TEST_AUTH_TOKEN env var, falls back to guest session.
 * Returns null if neither is available (public server with captcha).
 */
export async function getTestSession(): Promise<GuestSession | null> {
  const envToken = process.env.TEST_AUTH_TOKEN
  if (envToken) {
    return {
      accessToken: envToken,
      refreshToken: '',
      userId: 'env-provided',
    }
  }
  return createGuestSession()
}

/**
 * Delete a guest account to clean up after tests.
 */
export async function deleteGuestAccount(accessToken: string): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    // Best-effort cleanup -- don't fail tests if cleanup fails
    console.warn('Warning: failed to delete guest test account')
  }
}

// ─── Request helpers ────────────────────────────────────────

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string
  headers?: Record<string, string>
}

/**
 * Thin fetch wrapper with timeout, auth, and JSON handling.
 */
export async function apiRequest(path: string, opts: RequestOptions = {}) {
  const { method = 'GET', body, token, headers = {} } = opts

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await res.json()
      : await res.text()

    return { status: res.status, data, headers: res.headers }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Test address constants ─────────────────────────────────

/** Valid Cardano mainnet address for testing challenge requests */
export const VALID_CARDANO_ADDRESS =
  'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp'

/** Deliberately malformed address */
export const INVALID_CARDANO_ADDRESS = 'addr1abc'

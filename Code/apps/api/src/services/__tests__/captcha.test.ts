import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must mock fetch before importing the module
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock the signup-rate tracker so we can control when captcha is "required"
const mockIsCaptchaRequired = vi.fn(() => true)
vi.mock('../signup-rate-tracker.js', () => ({
  isCaptchaRequired: () => mockIsCaptchaRequired(),
}))

import { verifyCaptcha } from '../captcha.js'

describe('verifyCaptcha', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    mockFetch.mockReset()
    // Default: pretend a spike is active so captcha is enforced
    mockIsCaptchaRequired.mockReturnValue(true)
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ── Dev mode (no secret configured) ──────────────────────

  it('skips verification when TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY

    await expect(verifyCaptcha(undefined)).resolves.toBeUndefined()
    await expect(verifyCaptcha('some-token')).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Dynamic mode: no spike ───────────────────────────────

  it('skips verification when no signup spike is detected', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockIsCaptchaRequired.mockReturnValue(false)

    await expect(verifyCaptcha(undefined)).resolves.toBeUndefined()
    await expect(verifyCaptcha('some-token')).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Missing token ────────────────────────────────────────

  it('throws when secret is set but no token is provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'

    await expect(verifyCaptcha(undefined)).rejects.toThrow('Captcha verification is required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when secret is set and token is empty string', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'

    await expect(verifyCaptcha('')).rejects.toThrow('Captcha verification is required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Successful verification ──────────────────────────────

  it('passes when Cloudflare returns success: true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await expect(verifyCaptcha('valid-token')).resolves.toBeUndefined()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(options.method).toBe('POST')

    const body = JSON.parse(options.body)
    expect(body.secret).toBe('test-secret')
    expect(body.response).toBe('valid-token')
  })

  // ── Failed verification ──────────────────────────────────

  it('throws when Cloudflare returns success: false', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    })

    await expect(verifyCaptcha('bad-token')).rejects.toThrow('Captcha verification failed')
  })

  // ── IP forwarding ────────────────────────────────────────

  it('includes remoteip when provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await verifyCaptcha('valid-token', '192.168.1.1')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.remoteip).toBe('192.168.1.1')
  })

  it('omits remoteip when not provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await verifyCaptcha('valid-token')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.remoteip).toBeUndefined()
  })

  // ── Network errors ───────────────────────────────────────

  it('throws user-friendly error on fetch failure', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(verifyCaptcha('valid-token')).rejects.toThrow('Captcha service unavailable')
  })
})

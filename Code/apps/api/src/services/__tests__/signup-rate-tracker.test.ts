import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Each test needs a fresh module to reset in-memory state.
// We use dynamic import + vi.resetModules() for isolation.

describe('signup-rate-tracker', () => {
  let recordSignup: () => void
  let isCaptchaRequired: () => boolean
  let getCaptchaStatus: () => { required: boolean; elevatedUntil: number | null; manualOverride: boolean | null }
  let setCaptchaOverride: (mode: 'on' | 'off' | 'auto') => void
  let getSignupTimestamps: () => number[]
  let getSignupSource: (req: { socket?: { remoteAddress?: string } }) => string

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const mod = await import('../signup-rate-tracker.js')
    recordSignup = mod.recordSignup
    isCaptchaRequired = mod.isCaptchaRequired
    getCaptchaStatus = mod.getCaptchaStatus
    setCaptchaOverride = mod.setCaptchaOverride
    getSignupTimestamps = mod.getSignupTimestamps
    getSignupSource = mod.getSignupSource
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── Baseline state ─────────────────────────────────────────

  it('starts with captcha not required', () => {
    expect(isCaptchaRequired()).toBe(false)
  })

  it('starts with empty timestamps', () => {
    expect(getSignupTimestamps()).toEqual([])
  })

  it('getCaptchaStatus returns defaults', () => {
    const status = getCaptchaStatus()
    expect(status.required).toBe(false)
    expect(status.elevatedUntil).toBeNull()
    expect(status.manualOverride).toBeNull()
  })

  // ── Recording signups ──────────────────────────────────────

  it('records signup timestamps', () => {
    recordSignup()
    recordSignup()
    expect(getSignupTimestamps()).toHaveLength(2)
  })

  it('does not trigger captcha for signups below threshold', () => {
    for (let i = 0; i < 10; i++) recordSignup()
    expect(isCaptchaRequired()).toBe(false)
  })

  it('triggers captcha when signups exceed threshold (>10 in 1 min)', () => {
    for (let i = 0; i < 12; i++) recordSignup()
    expect(isCaptchaRequired()).toBe(true)
  })

  it('getCaptchaStatus reflects elevated state after spike', () => {
    for (let i = 0; i < 12; i++) recordSignup()
    const status = getCaptchaStatus()
    expect(status.required).toBe(true)
    expect(status.elevatedUntil).toBeTypeOf('number')
    expect(status.elevatedUntil).toBeGreaterThan(Date.now())
  })

  // ── TURNSTILE_SECRET_KEY dependency ────────────────────────

  it('returns false when TURNSTILE_SECRET_KEY is not set', async () => {
    vi.resetModules()
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    const mod = await import('../signup-rate-tracker.js')
    for (let i = 0; i < 12; i++) mod.recordSignup()
    expect(mod.isCaptchaRequired()).toBe(false)
  })

  // ── Manual override ────────────────────────────────────────

  it('setCaptchaOverride("on") forces captcha on', () => {
    setCaptchaOverride('on')
    expect(isCaptchaRequired()).toBe(true)
  })

  it('setCaptchaOverride("off") forces captcha off even during spike', () => {
    for (let i = 0; i < 12; i++) recordSignup()
    setCaptchaOverride('off')
    expect(isCaptchaRequired()).toBe(false)
  })

  it('setCaptchaOverride("auto") restores automatic behavior', () => {
    setCaptchaOverride('on')
    expect(isCaptchaRequired()).toBe(true)
    setCaptchaOverride('auto')
    expect(isCaptchaRequired()).toBe(false) // no spike yet
  })

  it('getCaptchaStatus reflects manual override', () => {
    setCaptchaOverride('on')
    expect(getCaptchaStatus().manualOverride).toBe(true)
    setCaptchaOverride('off')
    expect(getCaptchaStatus().manualOverride).toBe(false)
    setCaptchaOverride('auto')
    expect(getCaptchaStatus().manualOverride).toBeNull()
  })

  // ── getSignupSource ────────────────────────────────────────

  it('returns "localhost" for 127.0.0.1', () => {
    expect(getSignupSource({ socket: { remoteAddress: '127.0.0.1' } })).toBe('localhost')
  })

  it('returns "localhost" for ::1 (IPv6 loopback)', () => {
    expect(getSignupSource({ socket: { remoteAddress: '::1' } })).toBe('localhost')
  })

  it('returns "localhost" for ::ffff:127.0.0.1', () => {
    expect(getSignupSource({ socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe('localhost')
  })

  it('returns "production" for external IPs', () => {
    expect(getSignupSource({ socket: { remoteAddress: '203.0.113.42' } })).toBe('production')
  })

  it('returns "production" when socket is missing', () => {
    expect(getSignupSource({})).toBe('production')
    expect(getSignupSource({ socket: {} })).toBe('production')
  })

  // ── getSignupTimestamps returns a copy ─────────────────────

  it('getSignupTimestamps returns a copy (not a reference)', () => {
    recordSignup()
    const ts = getSignupTimestamps()
    ts.push(99999)
    expect(getSignupTimestamps()).toHaveLength(1)
  })
})

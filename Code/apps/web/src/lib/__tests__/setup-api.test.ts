/**
 * Tests for setup-api -- the small surface the Setup page uses to talk to
 * /api/setup and to gate access to the wizard itself.
 *
 * Critical invariants:
 *  - Setup token storage: round-trips through localStorage, empty string
 *    clears the entry, exceptions never propagate.
 *  - isSetupAccessible: in a non-dev build only localhost hostnames may
 *    reach the wizard (production deployments must hide it -- it leaks
 *    deployment topology).
 *  - shouldTakeOverHome: never takes over outside localhost, never takes
 *    over when the API reports environment === 'production'.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getStoredSetupToken,
  storeSetupToken,
  isSetupAccessible,
  shouldTakeOverHome,
  type SetupStatus,
} from '../setup-api'

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname },
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('setup token storage', () => {
  it('returns empty string when nothing is stored', () => {
    expect(getStoredSetupToken()).toBe('')
  })

  it('round-trips a token through localStorage', () => {
    storeSetupToken('abc123')
    expect(getStoredSetupToken()).toBe('abc123')
    expect(localStorage.getItem('cm_setup_token')).toBe('abc123')
  })

  it('clears the entry when given an empty string', () => {
    storeSetupToken('abc')
    storeSetupToken('')
    expect(getStoredSetupToken()).toBe('')
    expect(localStorage.getItem('cm_setup_token')).toBeNull()
  })
})

describe('isSetupAccessible', () => {
  it('returns true when import.meta.env.DEV is true (Vite dev build)', () => {
    // jsdom defaults to localhost so we can't isolate DEV alone, but the
    // function must return true here either way; pin host to a public name
    // to prove DEV=true overrides the hostname gate.
    setHostname('app.example.com')
    vi.stubEnv('DEV', true)
    expect(isSetupAccessible()).toBe(true)
  })

  it('returns true on localhost in a prod build', () => {
    vi.stubEnv('DEV', false)
    setHostname('localhost')
    expect(isSetupAccessible()).toBe(true)
    setHostname('127.0.0.1')
    expect(isSetupAccessible()).toBe(true)
  })

  it('returns false on a public hostname in a prod build (wizard must stay hidden in production)', () => {
    vi.stubEnv('DEV', false)
    setHostname('coordinationmanager.com')
    expect(isSetupAccessible()).toBe(false)
  })
})

describe('shouldTakeOverHome', () => {
  function makeStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
    return {
      mode: 'unconfigured',
      setupCompleted: false,
      isApiConfigured: false,
      isSupabaseConfigured: false,
      missing: { api: [], web: [] },
      required: { api: [], web: [] },
      cloudApiUrl: null,
      lastConfiguredAt: null,
      environment: 'development',
      isLocalhostRequest: true,
      canConfigure: true,
      ...overrides,
    }
  }

  it('returns false on a public hostname even when the API is unconfigured', () => {
    setHostname('coordinationmanager.com')
    expect(shouldTakeOverHome(makeStatus({ isApiConfigured: false }), null)).toBe(false)
  })

  it('returns true on localhost when the API is unreachable (statusError)', () => {
    setHostname('localhost')
    expect(shouldTakeOverHome(null, 'API unreachable')).toBe(true)
  })

  it('returns false on localhost when API is reachable but status is missing (no error)', () => {
    setHostname('localhost')
    expect(shouldTakeOverHome(null, null)).toBe(false)
  })

  it('returns false when status.environment is "production" -- never wizard-over a hosted instance', () => {
    setHostname('localhost')
    expect(
      shouldTakeOverHome(makeStatus({ environment: 'production', isApiConfigured: true }), null),
    ).toBe(false)
  })

  it('returns true on localhost when API env keys are missing', () => {
    setHostname('localhost')
    expect(shouldTakeOverHome(makeStatus({ isApiConfigured: false }), null)).toBe(true)
  })

  it('returns true on localhost when the web bundle is missing required keys', () => {
    setHostname('localhost')
    expect(
      shouldTakeOverHome(
        makeStatus({ isApiConfigured: true, missing: { api: [], web: ['VITE_SUPABASE_URL'] } }),
        null,
      ),
    ).toBe(true)
  })

  it('returns false on localhost when fully configured', () => {
    setHostname('localhost')
    expect(
      shouldTakeOverHome(
        makeStatus({ isApiConfigured: true, missing: { api: [], web: [] } }),
        null,
      ),
    ).toBe(false)
  })
})

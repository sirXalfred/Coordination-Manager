/**
 * In-memory sliding-window tracker for account creation rate.
 *
 * When more than SPIKE_THRESHOLD accounts are created within a single
 * WINDOW_MS window, Cloudflare Turnstile captcha is activated for
 * ELEVATED_DURATION_MS (1 hour) to slow down automated sign-ups.
 *
 * This keeps captcha off during normal usage so pages load faster and
 * quick-links work without friction, while still protecting against
 * sudden bursts of bot-driven account creation.
 */

import { getDisabledFeatures } from './local-config.js'

const WINDOW_MS = 60_000          // 1-minute sliding window
const SPIKE_THRESHOLD = 10        // activations threshold per window
const ELEVATED_DURATION_MS = 60 * 60 * 1000  // 1 hour

/** Timestamps (ms) of recent account creations */
const timestamps: number[] = []

/** When elevated protection expires (0 = not active) */
let elevatedUntil = 0

/** Admin manual override: null = auto, true = force on, false = force off */
let manualOverride: boolean | null = null

/** Prune entries older than the sliding window */
function prune(): void {
  const cutoff = Date.now() - WINDOW_MS
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift()
  }
}

/**
 * Record a new account creation.
 * If the count in the current window exceeds SPIKE_THRESHOLD,
 * elevated protection is activated for ELEVATED_DURATION_MS.
 */
export function recordSignup(): void {
  const now = Date.now()
  timestamps.push(now)
  prune()

  if (timestamps.length > SPIKE_THRESHOLD && now < elevatedUntil) {
    // Already elevated — nothing to do
    return
  }

  if (timestamps.length > SPIKE_THRESHOLD) {
    elevatedUntil = now + ELEVATED_DURATION_MS
    console.log(
      `[signup-rate] Spike detected: ${timestamps.length} signups in last minute. ` +
      `Captcha enabled until ${new Date(elevatedUntil).toISOString()}`
    )
  }
}

/**
 * Whether captcha enforcement is available right now. False when either the
 * Turnstile secret is missing (the wizard never configured it) or when the
 * operator has explicitly flipped the "Disable" toggle for captcha on the
 * Setup page. Used both by isCaptchaRequired() and by the oversight UI.
 */
export function isCaptchaAvailable(): { available: boolean; reason: 'ok' | 'missing-keys' | 'disabled' } {
  if (!process.env.TURNSTILE_SECRET_KEY) return { available: false, reason: 'missing-keys' }
  if (getDisabledFeatures().captcha) return { available: false, reason: 'disabled' }
  return { available: true, reason: 'ok' }
}

/**
 * Check whether captcha should be enforced right now.
 * Returns true only when elevated protection is active (spike detected
 * within the last hour) AND the server has captcha available.
 */
export function isCaptchaRequired(): boolean {
  if (!isCaptchaAvailable().available) return false
  if (manualOverride !== null) return manualOverride
  return Date.now() < elevatedUntil
}

/**
 * Return status info for the /api/auth/captcha-required endpoint.
 */
export function getCaptchaStatus(): {
  required: boolean
  elevatedUntil: number | null
  manualOverride: boolean | null
  available: boolean
  unavailableReason: 'missing-keys' | 'disabled' | null
} {
  const required = isCaptchaRequired()
  const avail = isCaptchaAvailable()
  return {
    required,
    elevatedUntil: elevatedUntil > Date.now() ? elevatedUntil : null,
    manualOverride,
    available: avail.available,
    unavailableReason: avail.available ? null : (avail.reason as 'missing-keys' | 'disabled'),
  }
}

/**
 * Admin: set manual captcha override.
 * @param mode 'on' = force captcha, 'off' = force disable, 'auto' = restore automatic behavior
 */
export function setCaptchaOverride(mode: 'on' | 'off' | 'auto'): void {
  if (mode === 'on') manualOverride = true
  else if (mode === 'off') manualOverride = false
  else manualOverride = null
  console.log(`[signup-rate] Captcha manual override set to: ${mode}`)
}

/**
 * Return recent signup timestamps for the oversight dashboard.
 */
export function getSignupTimestamps(): number[] {
  return [...timestamps]
}

/**
 * Determine the signup source from the incoming request.
 * Uses socket-level remote address (cannot be spoofed via headers).
 */
export function getSignupSource(req: { socket?: { remoteAddress?: string } }): string {
  const addr = req.socket?.remoteAddress ?? ''
  if (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1') {
    return 'localhost'
  }
  return 'production'
}

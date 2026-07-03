/**
 * Cloudflare Turnstile server-side verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Captcha is only enforced dynamically: when the signup-rate tracker
 * detects a spike (>10 accounts/minute), it activates for 1 hour.
 * Outside of that window captcha is skipped for faster page loads.
 */

import { ApplicationError } from '../middleware/error-handler.js'
import { isCaptchaRequired } from './signup-rate-tracker.js'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export class CaptchaError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, 'CAPTCHA_ERROR')
  }
}

export async function verifyCaptcha(token: string | undefined, remoteIp?: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // If no secret is configured, skip verification (development mode)
    return
  }

  // Dynamic mode: only enforce captcha when a signup spike is detected
  if (!isCaptchaRequired()) {
    return
  }

  if (!token) {
    throw new CaptchaError('Captcha verification is required')
  }

  const body: Record<string, string> = {
    secret,
    response: token,
  }
  if (remoteIp) {
    body.remoteip = remoteIp
  }

  let res: Response
  try {
    res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error('Turnstile API fetch error:', err)
    throw new CaptchaError('Captcha service unavailable — please try again')
  }

  let data: { success: boolean; 'error-codes'?: string[] }
  try {
    data = await res.json() as { success: boolean; 'error-codes'?: string[] }
  } catch {
    console.error('Turnstile API returned non-JSON response, status:', res.status)
    throw new CaptchaError('Captcha service returned an invalid response')
  }

  if (!data.success) {
    console.error('Turnstile verification failed:', data['error-codes'])
    throw new CaptchaError('Captcha verification failed')
  }
}

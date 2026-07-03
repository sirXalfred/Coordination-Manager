import { useState, useEffect } from 'react'
import { dedupedGet } from './api-client'

/**
 * Shared hook that checks whether captcha mode is active.
 *
 * When captcha mode is ON (signup spike detected on the backend),
 * login quick links should redirect to the login page so the user
 * can complete the Turnstile challenge.
 *
 * When captcha mode is OFF, Traveler and Wallet quick links can
 * trigger account creation directly for a snappier experience.
 */
export function useCaptchaMode(): { captchaMode: boolean; loading: boolean } {
  const [captchaMode, setCaptchaMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    dedupedGet<{ required?: boolean }>('/api/auth/captcha-required')
      .then(res => { if (!cancelled) setCaptchaMode(res.data?.required === true) })
      .catch(() => { /* If check fails, stay permissive (no captcha) */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { captchaMode, loading }
}

/**
 * Live health probes for Setup page components.
 *
 * Browser-side liveness checks are limited by CORS. We do what we can:
 *   - API: HEAD/GET /health (always reachable from browser)
 *   - Database, JWT, Google, Discord, SMTP, AI, Captcha:
 *       derived from `status.features` (env-present) since true backend
 *       liveness checks would need new dedicated endpoints.
 *
 * The shape is intentionally extensible -- as we add backend probe endpoints
 * (e.g. /api/setup/probe/discord) we can return 'live' with latency.
 */
import { useEffect, useState, useCallback } from 'react'
import type { SetupStatus, FeatureFlag } from './setup-api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export type HealthState = 'unknown' | 'live' | 'configured' | 'off' | 'down'

export interface ComponentHealth {
  state: HealthState
  /** Optional human note: latency, error code, etc. */
  detail?: string
  /** Epoch ms of last successful check. */
  checkedAt?: number
}

export type HealthMap = Partial<Record<string, ComponentHealth>>

/** Map of component id -> health. Keys mirror COMPONENTS[].id in SetupPage. */
const FEATURE_BY_ID: Partial<Record<string, FeatureFlag>> = {
  jwt: 'jwt',
  google: 'google',
  discord: 'discord',
  smtp: 'smtp',
  captcha: 'captcha',
  ai: 'ai',
}

async function probeApi(): Promise<ComponentHealth> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    const dt = Date.now() - t0
    if (!res.ok) return { state: 'down', detail: `HTTP ${res.status}` }
    return { state: 'live', detail: `${dt} ms`, checkedAt: Date.now() }
  } catch (err) {
    return { state: 'down', detail: (err as Error).message }
  }
}

export function useComponentHealth(status: SetupStatus | null): {
  health: HealthMap
  loading: boolean
  refresh: () => Promise<void>
} {
  const [health, setHealth] = useState<HealthMap>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const next: HealthMap = {}
    next.api = await probeApi()

    // Database -- isApiConfigured implies SUPABASE_URL + KEY are present.
    // We can't safely probe Supabase from the browser without leaking the
    // anon key here, but the connection is exercised by the API itself, so
    // a live API + isApiConfigured is a reasonable proxy for "configured".
    next.database = status?.isApiConfigured
      ? { state: 'configured', detail: 'env present', checkedAt: Date.now() }
      : { state: 'off' }

    next.deployment = { state: 'configured', detail: 'inferred from running app' }

    for (const [id, flag] of Object.entries(FEATURE_BY_ID)) {
      if (!flag) continue
      const on = Boolean(status?.features?.[flag])
      next[id] = on
        ? { state: 'configured', detail: 'env present', checkedAt: Date.now() }
        : { state: 'off' }
    }

    setHealth(next)
    setLoading(false)
  }, [status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { health, loading, refresh }
}

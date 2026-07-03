/**
 * Production / Template view overrides for the Setup page.
 *
 * The API only knows the values in the locally-running `.env` files. When the
 * user toggles to the "Production" view, they may want to record what their
 * deployed instance actually uses (e.g. https://coordinationmanager.com,
 * https://api.coordinationmanager.com) so the page can give them confidence
 * about that environment.
 *
 * These overrides are stored in localStorage and never sent to the server.
 * They are purely for the user's own reference.
 *
 * Template view uses built-in safe defaults (only public deployment fields
 * are pre-filled; all secrets are blank by design).
 */
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cm_setup_view_overrides_v1'
const EVENT = 'cm-setup-overrides-changed'

export type Target = 'api' | 'web' | 'bot' | 'guardian'

export interface OverrideEntry {
  /** Plain value (or masked summary the user is OK with storing locally). */
  value: string
  /** True when the value is a secret the user does not want surfaced. */
  isSecret?: boolean
}

export interface OverridesByTarget {
  api: Record<string, OverrideEntry>
  web: Record<string, OverrideEntry>
  bot?: Record<string, OverrideEntry>
  guardian?: Record<string, OverrideEntry>
}

export interface ViewOverrides {
  /** User-entered "what production looks like" snapshot. */
  production: OverridesByTarget
}

const EMPTY: ViewOverrides = {
  production: { api: {}, web: {} },
}

function read(): ViewOverrides {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    return {
      production: {
        api: (parsed?.production?.api as Record<string, OverrideEntry>) || {},
        web: (parsed?.production?.web as Record<string, OverrideEntry>) || {},
      },
    }
  } catch {
    return EMPTY
  }
}

function write(next: ViewOverrides): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function getViewOverrides(): ViewOverrides {
  return read()
}

export function setProductionOverride(target: Target, key: string, value: string, isSecret = false): void {
  const cur = read()
  const next: ViewOverrides = {
    production: {
      api: { ...cur.production.api },
      web: { ...cur.production.web },
      bot: { ...(cur.production.bot ?? {}) },
      guardian: { ...(cur.production.guardian ?? {}) },
    },
  }
  const bucket = next.production[target] ?? (next.production[target] = {})
  if (!value) {
    delete bucket[key]
  } else {
    bucket[key] = { value, isSecret }
  }
  write(next)
}

export function clearProductionOverrides(): void {
  write(EMPTY)
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = () => cb()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function useViewOverrides(): ViewOverrides {
  return useSyncExternalStore(subscribe, getViewOverrides, () => EMPTY)
}

// ---------------------------------------------------------------------------
// Template defaults -- the values a brand-new clone of this repo starts with
// when running `pnpm dev`. Template view serves as a reference of the default
// local dev state for onboarding and comparison, so the deployment fields
// use the same localhost URLs and ports the running stack uses.
// ---------------------------------------------------------------------------

export const TEMPLATE_DEFAULTS: OverridesByTarget = {
  api: {
    NODE_ENV: { value: 'development' },
    PORT: { value: '3001' },
    FRONTEND_URL: { value: 'http://localhost:5173' },
  },
  web: {
    VITE_API_URL: { value: 'http://localhost:3001' },
  },
}

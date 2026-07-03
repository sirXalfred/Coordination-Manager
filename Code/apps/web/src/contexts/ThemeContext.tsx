import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from './AuthContext'
import {
  type ColorTheme,
  type ThemeColors,
  type ThemePreferences,
  PRESET_THEMES,
  COLOR_VAR_MAP,
} from '../lib/theme-types'
import { apiClient, dedupedGet } from '../lib/api-client'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  /** Current theme mode: 'light', 'dark', or 'system' */
  mode: ThemeMode
  /** Whether the resolved/active appearance is dark */
  isDark: boolean
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void
  /** Toggle between light and dark (ignores system) */
  toggleDark: () => void

  /** ID of the color-theme overlay for the *current* mode (dark or light) */
  activeThemeId: string | null
  /** The resolved active ColorTheme object, or null for default */
  activeColorTheme: ColorTheme | null
  /** User's saved custom themes */
  customThemes: ColorTheme[]

  /** Apply a color-theme overlay for the *current* mode (null = reset) */
  applyTheme: (themeId: string | null) => void
  /** Save a custom theme (add or update) */
  saveCustomTheme: (theme: ColorTheme) => void
  /** Delete a custom theme by ID */
  deleteCustomTheme: (themeId: string) => void
  /**
   * Force a re-fetch of theme preferences from the backend.
   * Call this after an account merge so the new merged settings
   * (custom themes, notification settings, etc.) are picked up.
   */
  reloadThemeFromBackend: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// ─── Persistence helpers ──────────────────────────────────────────────

function loadLocal(): ThemePreferences {
  try {
    const raw = localStorage.getItem('theme-preferences')
    if (raw) {
      const parsed = JSON.parse(raw) as ThemePreferences
      // Ensure fields exist even if missing in old data
      if (parsed.darkThemeId === undefined) (parsed as { darkThemeId: string | null }).darkThemeId = null
      if (parsed.lightThemeId === undefined) (parsed as { lightThemeId: string | null }).lightThemeId = null
      return parsed
    }
  } catch { /* ignore */ }

  // Migrate from old localStorage keys
  const oldMode = localStorage.getItem('theme-mode') as ThemeMode | null
  const oldEnabled = localStorage.getItem('random-color-enabled') === 'true'
  const oldThemeRaw = localStorage.getItem('active-color-theme')
  let oldThemeName: string | null = null
  if (oldThemeRaw) {
    try { oldThemeName = (JSON.parse(oldThemeRaw) as { name: string }).name } catch { /* ignore */ }
  }

  // Map old random theme name to new preset ID
  let legacyThemeId: string | null = null
  if (oldEnabled && oldThemeName) {
    const preset = PRESET_THEMES.find(p => p.name === oldThemeName)
    if (preset) legacyThemeId = preset.id
  }

  return {
    mode: oldMode || 'dark',
    darkThemeId: legacyThemeId,
    lightThemeId: null,
    customThemes: [],
  }
}

function saveLocal(prefs: ThemePreferences) {
  localStorage.setItem('theme-preferences', JSON.stringify(prefs))
  // Also keep legacy key for dark mode toggle in Layout which reads theme-mode
  localStorage.setItem('theme-mode', prefs.mode)
}

// Debounced save to backend
let saveTimer: ReturnType<typeof setTimeout> | null = null
function saveToBackend(prefs: ThemePreferences) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await apiClient.put('/api/auth/profile', { themePreferences: prefs })
    } catch {
      // Best-effort — if backend is down we still have localStorage
    }
  }, 1000)
}

// ─── Apply CSS variables ──────────────────────────────────────────────

function applyCssVariables(colors: ThemeColors | null) {
  const root = document.documentElement
  if (!colors) {
    // Remove all overrides → fall back to CSS defaults
    for (const cssVar of Object.values(COLOR_VAR_MAP)) {
      root.style.removeProperty(cssVar)
    }
    return
  }
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
    const value = colors[key as keyof ThemeColors]
    if (value) root.style.setProperty(cssVar, value)
  }
}

// ─── Provider ─────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  // Increment to trigger a forced reload from backend (e.g. after account merge)
  const [backendLoadKey, setBackendLoadKey] = useState(0)
  const lastLoadedKey = useRef(-1)

  // ─── State ──────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<ThemePreferences>(loadLocal)
  const [systemDark, setSystemDark] = useState(getSystemPrefersDark)

  const mode = prefs.mode
  const isDark = mode === 'system' ? systemDark : mode === 'dark'

  const activeThemeIdForMode = isDark ? prefs.darkThemeId : prefs.lightThemeId

  const allThemes = useMemo(
    () => [...PRESET_THEMES, ...prefs.customThemes],
    [prefs.customThemes]
  )

  const activeColorTheme = useMemo(
    () => allThemes.find(t => t.id === activeThemeIdForMode) || null,
    [allThemes, activeThemeIdForMode]
  )

  // ─── Persist helper (functional updater — avoids stale closures) ──
  const persistUpdate = useCallback((updater: (prev: ThemePreferences) => ThemePreferences) => {
    setPrefs(prev => {
      const next = updater(prev)
      saveLocal(next)
      if (isAuthenticated) saveToBackend(next)
      return next
    })
  }, [isAuthenticated])

  // ─── Mode ────────────────────────────────────────────────────
  const setMode = useCallback((m: ThemeMode) => {
    persistUpdate(prev => ({ ...prev, mode: m }))
  }, [persistUpdate])

  const toggleDark = useCallback(() => {
    setMode(isDark ? 'light' : 'dark')
  }, [isDark, setMode])

  // Apply / remove `.dark` class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [isDark])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // ─── Color theme (per-mode overlay) ───────────────────────────────
  const applyTheme = useCallback((themeId: string | null) => {
    persistUpdate(prev => {
      // Resolve which mode is currently active
      const currentlyDark = prev.mode === 'system' ? getSystemPrefersDark() : prev.mode === 'dark'
      if (currentlyDark) {
        return { ...prev, darkThemeId: themeId }
      } else {
        return { ...prev, lightThemeId: themeId }
      }
    })
  }, [persistUpdate])

  const saveCustomTheme = useCallback((theme: ColorTheme) => {
    persistUpdate(prev => {
      const existing = prev.customThemes.findIndex(t => t.id === theme.id)
      const updated = [...prev.customThemes]
      if (existing >= 0) {
        updated[existing] = theme
      } else {
        // Enforce max 3 custom themes
        if (updated.length >= 3) return prev
        updated.push(theme)
      }
      return { ...prev, customThemes: updated }
    })
  }, [persistUpdate])

  const deleteCustomTheme = useCallback((themeId: string) => {
    persistUpdate(prev => {
      const updated = prev.customThemes.filter(t => t.id !== themeId)
      return {
        ...prev,
        customThemes: updated,
        darkThemeId: prev.darkThemeId === themeId ? null : prev.darkThemeId,
        lightThemeId: prev.lightThemeId === themeId ? null : prev.lightThemeId,
      }
    })
  }, [persistUpdate])

  // Apply CSS variables whenever active theme or mode changes
  useEffect(() => {
    if (activeColorTheme) {
      applyCssVariables(activeColorTheme.colors)
    } else {
      applyCssVariables(null)
    }
  }, [activeColorTheme, isDark])

  // Load theme preferences from AuthContext user data (avoids duplicate /api/auth/me call)
  const _appliedUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isAuthenticated || !user) return
    // On normal login, read theme prefs from the user object already fetched by AuthContext
    if (backendLoadKey === 0 && lastLoadedKey.current >= 0) return // already applied
    // For forced reloads (backendLoadKey > 0, e.g. after account merge), fetch fresh
    if (backendLoadKey > 0 && lastLoadedKey.current === backendLoadKey) return

    const applyPrefs = (backendPrefs: ThemePreferences | null | undefined) => {
      if (backendPrefs) {
        const merged: ThemePreferences = {
          ...backendPrefs,
          mode: backendPrefs.mode || 'dark',
          darkThemeId: backendPrefs.darkThemeId ?? null,
          lightThemeId: backendPrefs.lightThemeId ?? null,
          customThemes: backendPrefs.customThemes ?? [],
        }
        setPrefs(merged)
        saveLocal(merged)
      }
      lastLoadedKey.current = backendLoadKey
    }

    if (backendLoadKey > 0) {
      // Forced reload (e.g. after account merge) — fetch fresh from backend
      dedupedGet<{ user?: { themePreferences?: ThemePreferences | null } }>('/api/auth/me').then(res => {
        applyPrefs(res.data?.user?.themePreferences as ThemePreferences | null)
      }).catch(() => { /* best-effort */ })
    } else {
      // Normal login — reuse user data from AuthContext (no extra API call)
      applyPrefs(user.themePreferences)
    }
  }, [isAuthenticated, user, backendLoadKey])  

  // Reset to clean defaults when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      lastLoadedKey.current = -1
      // Clear overlay and custom themes, revert to default dark mode
      const cleanDefaults: ThemePreferences = {
        mode: 'dark',
        darkThemeId: null,
        lightThemeId: null,
        customThemes: [],
      }
      setPrefs(cleanDefaults)
      saveLocal(cleanDefaults)
      applyCssVariables(null) // immediately strip any lingering overlay
    }
  }, [isAuthenticated])

  const reloadThemeFromBackend = useCallback(() => {
    setBackendLoadKey(k => k + 1)
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        setMode,
        toggleDark,
        activeThemeId: activeThemeIdForMode,
        activeColorTheme,
        customThemes: prefs.customThemes,
        applyTheme,
        saveCustomTheme,
        deleteCustomTheme,
        reloadThemeFromBackend,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with its provider
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

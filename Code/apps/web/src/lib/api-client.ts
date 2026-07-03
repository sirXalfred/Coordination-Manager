import axios from 'axios';
import { supabase } from './supabase';

// ─── Request deduplication for GET requests ──────────────────
// Coalesces identical in-flight GET requests so multiple components
// mounting simultaneously share a single network call.
const inflightGets = new Map<string, Promise<unknown>>();

/** Clear all in-flight GET deduplication entries (e.g. on logout). */
export function clearInflightRequests(): void {
  inflightGets.clear();
}

function dedupeKey(url: string, params?: Record<string, unknown>): string {
  const qs = params ? JSON.stringify(params) : '';
  return `${url}::${qs}`;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Supabase auth token to every request when available
apiClient.interceptors.request.use(async (config) => {
  // Skip if Authorization header is already set (e.g. fetchUserProfile)
  // This also avoids a potential deadlock when called from within onAuthStateChange
  if (config.headers.Authorization) {
    return config;
  }
  try {
    // Race getSession against a 3-second timeout to prevent hangs
    // (e.g. when Supabase client is stuck refreshing an expired token)
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (result && 'data' in result) {
      const session = result.data.session;
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  } catch {
    // No token available — request proceeds without auth
  }
  return config;
});

// ─── Rate-limit soft warning event ───────────────────────────
// When the server indicates we're approaching the hard limit,
// emit a custom event so the UI can show a yellow warning banner.
export const RATE_LIMIT_WARN_EVENT = 'rate-limit-warn';
const RATE_LIMIT_WARN_KEY = 'rateLimitWarnAt';
let _rateLimitWarnTimeout: ReturnType<typeof setTimeout> | null = null;

/** Check if a persisted rate-limit warning exists (for admin visibility). */
export function getPersistedRateLimitWarn(): { active: boolean; since: string | null } {
  try {
    const ts = localStorage.getItem(RATE_LIMIT_WARN_KEY);
    if (ts) return { active: true, since: ts };
  } catch { /* ignore */ }
  return { active: false, since: null };
}

function checkRateLimitWarn(headers: Record<string, unknown> | undefined) {
  if (headers?.['x-ratelimit-warn'] === 'true') {
    // Persist the first occurrence timestamp (don't overwrite if already set)
    try {
      if (!localStorage.getItem(RATE_LIMIT_WARN_KEY)) {
        localStorage.setItem(RATE_LIMIT_WARN_KEY, new Date().toISOString());
      }
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(RATE_LIMIT_WARN_EVENT, { detail: { warn: true } }));
    // Auto-clear for non-admin users after 2 minutes of no further warnings.
    // Admins use the persisted 6-hour TTL checked in Layout.
    if (_rateLimitWarnTimeout) clearTimeout(_rateLimitWarnTimeout);
    _rateLimitWarnTimeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(RATE_LIMIT_WARN_EVENT, { detail: { warn: false } }));
    }, 120_000);
  }
}

// Handle error responses with improved messages
apiClient.interceptors.response.use(
  (response) => {
    checkRateLimitWarn(response.headers);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 429 Too Many Requests — extract and rethrow with server message
    if (error.response?.status === 429) {
      const serverMessage = error.response.data?.error || 'Too many requests. Please wait a moment and try again.';
      const enhancedError = new Error(serverMessage);
      (enhancedError as { response?: unknown }).response = error.response;
      (enhancedError as { isRateLimitError?: boolean }).isRateLimitError = true;
      return Promise.reject(enhancedError);
    }

    // Only attempt refresh once per request, and only on 401
    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;

      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !data.session) {
          // Refresh failed — sign out and redirect to login
          await supabase.auth.signOut();
          window.location.href = '/auth/login';
          return Promise.reject(error);
        }

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return apiClient(originalRequest);
      } catch {
        await supabase.auth.signOut();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Deduplicated GET — identical concurrent calls share one in-flight request.
 * Use this for endpoints that multiple components call simultaneously on mount
 * (e.g. /api/auth/me, /health, /api/auth/captcha-required).
 */
export function dedupedGet<T = unknown>(url: string, config?: Parameters<typeof apiClient.get>[1]): Promise<import('axios').AxiosResponse<T>> {
  const key = dedupeKey(url, config?.params);
  const existing = inflightGets.get(key);
  if (existing) return existing as Promise<import('axios').AxiosResponse<T>>;

  const request = apiClient.get<T>(url, config).finally(() => {
    inflightGets.delete(key);
  });
  inflightGets.set(key, request);
  return request;
}

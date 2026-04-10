/** Wall-clock session limit from last successful sign-in (client-only). */
export const AUTH_SESSION_START_KEY = 'authSessionStartedAt'

export const MAX_AUTH_SESSION_MS = 8 * 60 * 60 * 1000

export function markAuthSessionStart() {
  if (import.meta.client) {
    localStorage.setItem(AUTH_SESSION_START_KEY, String(Date.now()))
  }
}

export function clearAuthSessionClock() {
  if (import.meta.client) {
    localStorage.removeItem(AUTH_SESSION_START_KEY)
  }
}

/** Existing Supabase sessions (before this feature) get a clock starting now. */
export function ensureAuthSessionClockFromHydration() {
  if (!import.meta.client) return
  if (!localStorage.getItem(AUTH_SESSION_START_KEY)) {
    localStorage.setItem(AUTH_SESSION_START_KEY, String(Date.now()))
  }
}

export function isAuthSessionExpired(): boolean {
  if (!import.meta.client) return false
  const raw = localStorage.getItem(AUTH_SESSION_START_KEY)
  if (!raw) return false
  const start = Number(raw)
  if (!Number.isFinite(start)) return false
  return Date.now() - start > MAX_AUTH_SESSION_MS
}

/** GoTrue signup can return `{ user }` or a flat user object when email confirmation is on. */
export function signupUserIdFromResponse(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined
  const r = res as Record<string, unknown>
  const nested = r.user
  if (nested && typeof nested === 'object') {
    const id = (nested as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) return id
  }
  if (typeof r.id === 'string' && r.id.length > 0) return r.id
  return undefined
}

export function signupErrorFromResponse(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined
  const r = res as Record<string, unknown>
  const msg = r.msg ?? r.error_description ?? r.message ?? r.error
  return typeof msg === 'string' && msg.length > 0 ? msg : undefined
}

/** Supabase may return a placeholder user when the email is already registered. */
export function signupLooksLikeDuplicate(res: unknown): boolean {
  if (!res || typeof res !== 'object') return false
  const r = res as Record<string, unknown>
  const user = (r.user ?? r) as Record<string, unknown>
  const identities = user.identities
  return Array.isArray(identities) && identities.length === 0
}

export function fetchErrorMessage(e: unknown): string | undefined {
  if (!e || typeof e !== 'object') return undefined
  const data = (e as { data?: unknown }).data
  const fromData = signupErrorFromResponse(data)
  if (fromData) return fromData
  const message = (e as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

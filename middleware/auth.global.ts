/**
 * Waits for Supabase session hydration before redirecting.
 * Without this, useSupabaseUser() is often still null on the first client tick
 * (middleware runs before onAuthStateChange / getSession sync), which causes
 * redirect loops or a stuck "loading" state when combined with the module's
 * built-in redirect (we disable that in nuxt.config via redirect: false).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const sessionRef = useSupabaseSession()
  const userRef = useSupabaseUser()

  if (import.meta.server) {
    if (to.path === '/login') {
      if (userRef.value) {
        return navigateTo('/dashboard')
      }
      return
    }
    if (!userRef.value) {
      return navigateTo('/login')
    }
    return
  }

  if (!sessionRef.value) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      sessionRef.value = data.session
      userRef.value = data.session.user
    }
  }

  if (to.path === '/login') {
    if (userRef.value) {
      return navigateTo('/dashboard')
    }
    return
  }

  if (!userRef.value) {
    return navigateTo('/login')
  }
})

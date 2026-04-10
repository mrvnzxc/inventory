export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()
  const sessionRef = useSupabaseSession()
  const userRef = useSupabaseUser()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    ensureAuthSessionClockFromHydration()
    if (isAuthSessionExpired()) {
      await useAuth().signOut()
      return
    }
    sessionRef.value = session
    userRef.value = session.user
    await authStore.loadProfile()
    await authStore.loadBranches()
  }

  // Never `await` inside this callback — it runs under GoTrue's auth lock; awaiting
  // Supabase/Pinia work here can deadlock `auth.signOut()` (stuck "Signing out…").
  // Defer async work so the listener returns immediately (see Supabase onAuthStateChange docs).
  supabase.auth.onAuthStateChange((_event, next) => {
    if (next?.user) {
      void Promise.resolve().then(async () => {
        await authStore.loadProfile()
        await authStore.loadBranches()
      })
    } else {
      authStore.reset()
    }
  })
})

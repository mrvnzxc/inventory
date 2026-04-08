export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()
  const sessionRef = useSupabaseSession()
  const userRef = useSupabaseUser()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    sessionRef.value = session
    userRef.value = session.user
    await authStore.loadProfile()
    await authStore.loadBranches()
  }

  supabase.auth.onAuthStateChange(async (_event, next) => {
    if (next?.user) {
      await authStore.loadProfile()
      await authStore.loadBranches()
    } else {
      authStore.reset()
    }
  })
})

export function useAuth() {
  const authStore = useAuthStore()
  const user = useSupabaseUser()
  const client = useSupabaseClient()

  async function signIn(email: string, password: string) {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    await authStore.loadProfile()
    await authStore.loadBranches()
  }

  async function signOut() {
    const session = useSupabaseSession()
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw error
    user.value = null
    session.value = null
    authStore.reset()
    await navigateTo('/login', { replace: true })
  }

  async function refreshSession() {
    await authStore.loadProfile()
    await authStore.loadBranches()
  }

  return {
    user,
    profile: computed(() => authStore.profile),
    branchId: computed(() => authStore.branchId),
    branches: computed(() => authStore.branches),
    ownerFocusBranchId: computed(() => authStore.ownerFocusBranchId),
    setOwnerFocusBranch: authStore.setOwnerFocusBranch,
    isOwner: computed(() => authStore.isOwner),
    loading: computed(() => authStore.loading),
    signIn,
    signOut,
    refreshSession,
    loadProfile: () => authStore.loadProfile(),
    loadBranches: () => authStore.loadBranches(),
    assignSalesman: authStore.assignSalesman,
    listSalesmen: authStore.listSalesmen,
  }
}

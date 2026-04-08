import type { Branch, Profile } from '~/types/models'

const OWNER_NAV_BRANCH_KEY = 'ownerNavBranchId'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)
  const branchId = ref<string | null>(null)
  const branches = ref<Branch[]>([])
  /** Owner’s branch from the sidebar (Calumpang / Palengke) */
  const ownerFocusBranchId = ref<string | null>(null)
  const loading = ref(false)

  const isOwner = computed(() => profile.value?.role === 'owner')

  function setOwnerFocusBranch(id: string | null) {
    ownerFocusBranchId.value = id
    if (import.meta.client) {
      if (id) localStorage.setItem(OWNER_NAV_BRANCH_KEY, id)
      else localStorage.removeItem(OWNER_NAV_BRANCH_KEY)
    }
  }

  function ensureOwnerBranchSelection() {
    if (!isOwner.value || branches.value.length === 0) return
    const cur = ownerFocusBranchId.value
    const valid = cur && branches.value.some((b) => b.id === cur)
    if (valid) return
    const cal = branches.value.find((b) => b.name.toLowerCase().includes('calumpang'))
    const pick = cal ?? branches.value[0]
    if (pick) setOwnerFocusBranch(pick.id)
  }

  async function loadBranches() {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.from('branches').select('id, name').order('name')
    if (error) throw error
    branches.value = data ?? []
    ensureOwnerBranchSelection()
  }

  async function loadProfile() {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    if (!user.value) {
      profile.value = null
      branchId.value = null
      return
    }
    loading.value = true
    try {
      const { data: p, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .eq('id', user.value.id)
        .single()
      if (error) throw error
      profile.value = p as Profile

      if (p?.role === 'salesman') {
        const { data: sb } = await supabase
          .from('salesman_branches')
          .select('branch_id')
          .eq('user_id', user.value.id)
          .maybeSingle()
        branchId.value = sb?.branch_id ?? null
        ownerFocusBranchId.value = null
      } else {
        branchId.value = null
        if (import.meta.client) {
          const stored =
            localStorage.getItem(OWNER_NAV_BRANCH_KEY) ?? localStorage.getItem('ownerFocusBranchId')
          ownerFocusBranchId.value = stored || null
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function assignSalesman(userId: string, bId: string) {
    const supabase = useSupabaseClient()
    const { error } = await supabase.from('salesman_branches').upsert(
      { user_id: userId, branch_id: bId },
      { onConflict: 'user_id', ignoreDuplicates: false },
    )
    if (error) throw error
  }

  function reset() {
    profile.value = null
    branchId.value = null
    ownerFocusBranchId.value = null
    if (import.meta.client) {
      localStorage.removeItem(OWNER_NAV_BRANCH_KEY)
    }
  }

  async function listSalesmen(): Promise<(Profile & { branch_id: string | null })[]> {
    const supabase = useSupabaseClient()
    const { data: profiles, error: e1 } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('role', 'salesman')
      .order('email')
    if (e1) throw e1
    const { data: links, error: e2 } = await supabase.from('salesman_branches').select('user_id, branch_id')
    if (e2) throw e2
    const byUser = new Map((links ?? []).map((l) => [l.user_id, l.branch_id]))
    return (profiles ?? []).map((p) => ({
      ...p,
      branch_id: byUser.get(p.id) ?? null,
    })) as (Profile & { branch_id: string | null })[]
  }

  return {
    profile,
    branchId,
    branches,
    ownerFocusBranchId,
    loading,
    isOwner,
    setOwnerFocusBranch,
    ensureOwnerBranchSelection,
    loadProfile,
    loadBranches,
    assignSalesman,
    listSalesmen,
    reset,
  }
})

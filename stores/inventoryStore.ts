import type { InventoryRow } from '~/types/models'

export const useInventoryStore = defineStore('inventory', () => {
  const rows = ref<InventoryRow[]>([])
  const loading = ref(false)
  const lastBranchFilter = ref<string | null>(null)

  async function fetchInventory(branchId?: string | null) {
    const supabase = useSupabaseClient()
    loading.value = true
    try {
      let q = supabase
        .from('inventory')
        .select(
          `
          id,
          product_id,
          branch_id,
          stock,
          updated_at,
          products (
            id,
            name,
            price,
            category_id,
            subcategory_id,
            categories (name),
            subcategories (name)
          ),
          branches (id, name)
        `,
        )
        .order('updated_at', { ascending: false })
      lastBranchFilter.value = branchId && branchId.trim() !== '' ? branchId : null
      if (lastBranchFilter.value) q = q.eq('branch_id', lastBranchFilter.value)
      const { data, error } = await q
      if (error) throw error
      rows.value = (data ?? []) as InventoryRow[]
    } finally {
      loading.value = false
    }
  }

  async function adjustStock(inventoryId: string, stock: number) {
    const supabase = useSupabaseClient()
    const { error } = await supabase
      .from('inventory')
      .update({ stock, updated_at: new Date().toISOString() })
      .eq('id', inventoryId)
    if (error) throw error
    await fetchInventory(lastBranchFilter.value)
  }

  return {
    rows,
    loading,
    fetchInventory,
    adjustStock,
  }
})

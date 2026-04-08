import type { InventoryRow } from '~/types/models'

export const useInventoryStore = defineStore('inventory', () => {
  const rows = ref<InventoryRow[]>([])
  const loading = ref(false)

  async function fetchInventory() {
    const supabase = useSupabaseClient()
    loading.value = true
    try {
      const { data, error } = await supabase
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
    await fetchInventory()
  }

  return {
    rows,
    loading,
    fetchInventory,
    adjustStock,
  }
})

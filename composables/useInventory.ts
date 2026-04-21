export function useInventory() {
  const store = useInventoryStore()
  return {
    rows: computed(() => store.rows),
    loading: computed(() => store.loading),
    fetchInventory: (branchId?: string | null) => store.fetchInventory(branchId),
    adjustStock: store.adjustStock,
  }
}

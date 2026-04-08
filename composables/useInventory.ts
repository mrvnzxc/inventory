export function useInventory() {
  const store = useInventoryStore()
  return {
    rows: computed(() => store.rows),
    loading: computed(() => store.loading),
    fetchInventory: () => store.fetchInventory(),
    adjustStock: store.adjustStock,
  }
}

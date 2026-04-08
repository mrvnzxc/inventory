export function useSales() {
  const store = useSalesStore()
  return {
    sales: computed(() => store.sales),
    loading: computed(() => store.loading),
    fetchSales: (opts?: { mineOnly?: boolean; branchOnly?: boolean }) => store.fetchSales(opts),
    createSale: store.createSale,
    createSalesBatch: store.createSalesBatch,
    computeDashboard: store.computeDashboard,
  }
}

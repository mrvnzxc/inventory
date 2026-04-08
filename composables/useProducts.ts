export function useProducts() {
  const store = useProductStore()
  return {
    products: computed(() => store.products),
    categories: computed(() => store.categories),
    subcategories: computed(() => store.subcategories),
    managerSubcategories: computed(() => store.managerSubcategories),
    loading: computed(() => store.loading),
    fetchProducts: (branchFilter?: string | null) => store.fetchProducts(branchFilter),
    fetchCategories: () => store.fetchCategories(),
    fetchSubcategories: (categoryId?: string) => store.fetchSubcategories(categoryId),
    fetchManagerSubcategories: (categoryId: string | null) => store.fetchManagerSubcategories(categoryId),
    createCategory: (name: string) => store.createCategory(name),
    createSubcategory: (categoryId: string, name: string) => store.createSubcategory(categoryId, name),
    createProduct: store.createProduct,
    updateProductPrice: store.updateProductPrice,
    updateProduct: store.updateProduct,
    deleteProduct: store.deleteProduct,
  }
}

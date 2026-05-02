export function useProducts() {
  const store = useProductStore()
  return {
    products: computed(() => store.products),
    categories: computed(() => store.categories),
    subcategories: computed(() => store.subcategories),
    managerSubcategories: computed(() => store.managerSubcategories),
    loading: computed(() => store.loading),
    fetchProducts: (branchFilter?: string | null) => store.fetchProducts(branchFilter),
    fetchCategories: (branchFilter?: string | null) => store.fetchCategories(branchFilter),
    fetchSubcategories: (categoryId?: string) => store.fetchSubcategories(categoryId),
    fetchManagerSubcategories: (categoryId: string | null) => store.fetchManagerSubcategories(categoryId),
    createCategory: (name: string) => store.createCategory(name),
    createSubcategory: (categoryId: string, name: string) => store.createSubcategory(categoryId, name),
    updateCategory: (categoryId: string, name: string) => store.updateCategory(categoryId, name),
    deleteCategory: (categoryId: string) => store.deleteCategory(categoryId),
    updateSubcategory: (subcategoryId: string, name: string) => store.updateSubcategory(subcategoryId, name),
    deleteSubcategory: (subcategoryId: string) => store.deleteSubcategory(subcategoryId),
    createProduct: store.createProduct,
    updateProductPrice: store.updateProductPrice,
    updateProduct: store.updateProduct,
    deleteProduct: store.deleteProduct,
  }
}

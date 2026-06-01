import type { Category, Product, Subcategory } from '~/types/models'

function postgrestErrorMessage(err: {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string
}): string {
  if (err.code === '23503') {
    if (err.message?.includes('products_category_id_fkey')) {
      return 'This category is still used by one or more products (including archived products). Reassign or remove those products first.'
    }
  }
  const parts = [err.message, err.details, err.hint].filter((p) => p != null && String(p).trim() !== '')
  return parts.length ? parts.join(' — ') : 'Database request failed'
}

export type CategoryUsage = { active: number; archived: number }

function normalizeUuid(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function isMissingImageUrlColumn(err: unknown): boolean {
  const msg =
    typeof err === 'object' && err != null && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : String(err ?? '')
  return msg.includes('image_url') && (msg.includes('schema cache') || msg.includes('column'))
}

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const categories = ref<Category[]>([])
  /** Subcategories for the New Product form (follows selected product category) */
  const subcategories = ref<Subcategory[]>([])
  /** Subcategories for the category manager panel (follows “Add subcategory” category) */
  const managerSubcategories = ref<Subcategory[]>([])
  const categoryUsage = ref<Record<string, CategoryUsage>>({})
  const loading = ref(false)

  async function fetchCategories(branchFilter?: string | null) {
    const supabase = useSupabaseClient()
    const authStore = useAuthStore()
    const effectiveFilter =
      branchFilter !== undefined ? branchFilter || null : authStore.isOwner ? authStore.ownerFocusBranchId : authStore.branchId
    let q = supabase.from('categories').select('id, name, branch_id').order('name')
    if (effectiveFilter) q = q.eq('branch_id', effectiveFilter)
    const { data, error } = await q
    if (error) throw error
    categories.value = data ?? []
  }

  async function fetchSubcategories(categoryId?: string) {
    const supabase = useSupabaseClient()
    let q = supabase.from('subcategories').select('id, category_id, name').order('name')
    if (categoryId) q = q.eq('category_id', categoryId)
    const { data, error } = await q
    if (error) throw error
    subcategories.value = data ?? []
  }

  async function fetchManagerSubcategories(categoryId: string | null) {
    if (!categoryId) {
      managerSubcategories.value = []
      return
    }
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, category_id, name')
      .eq('category_id', categoryId)
      .order('name')
    if (error) throw error
    managerSubcategories.value = data ?? []
  }

  /**
   * @param branchFilter - Override branch (e.g. POS). If omitted, owner uses sidebar branch; salesmen rely on RLS.
   */
  async function fetchProducts(branchFilter?: string | null) {
    const supabase = useSupabaseClient()
    const authStore = useAuthStore()
    loading.value = true
    try {
      let effectiveFilter: string | null | undefined =
        branchFilter !== undefined ? branchFilter || null : authStore.isOwner ? authStore.ownerFocusBranchId : null

      if (authStore.isOwner && effectiveFilter === null) {
        products.value = []
        return
      }

      const baseSelect = `
        id,
        branch_id,
        category_id,
        subcategory_id,
        name,
        price,
        deleted_at,
        created_at,
        categories (name),
        subcategories (name),
        branches (name)
      `
      let q = supabase.from('products').select(`${baseSelect}, image_url`).order('created_at', { ascending: false })

      if (effectiveFilter) {
        q = q.eq('branch_id', effectiveFilter)
      }
      q = q.is('deleted_at', null)

      let { data, error } = await q
      if (error && isMissingImageUrlColumn(error)) {
        const fallbackQ = supabase.from('products').select(baseSelect).order('created_at', { ascending: false }).is('deleted_at', null)
        const fallbackFiltered = effectiveFilter ? fallbackQ.eq('branch_id', effectiveFilter) : fallbackQ
        const fallback = await fallbackFiltered
        data = fallback.data
        error = fallback.error
      }
      if (error) throw error
      products.value = ((data ?? []) as Product[]).map((p) => ({ ...p, image_url: p.image_url ?? null }))
    } finally {
      loading.value = false
    }
  }

  async function createCategory(name: string) {
    const supabase = useSupabaseClient()
    const authStore = useAuthStore()
    const branchId = authStore.isOwner ? authStore.ownerFocusBranchId : authStore.branchId
    if (!branchId) throw new Error('Select a branch first before adding a category.')
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, branch_id: branchId })
      .select('id, name, branch_id')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchCategories(branchId)
    return data
  }

  async function createSubcategory(categoryId: string, name: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('subcategories')
      .insert({ category_id: categoryId, name })
      .select('id, category_id, name')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchManagerSubcategories(categoryId)
    return data
  }

  async function updateCategory(categoryId: string, name: string) {
    const supabase = useSupabaseClient()
    const next = name.trim()
    if (!next) throw new Error('Category name is required')
    const { data, error } = await supabase
      .from('categories')
      .update({ name: next })
      .eq('id', categoryId)
      .select('id, name')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchCategories()
    return data
  }

  async function fetchCategoryUsage(branchId: string | null) {
    if (!branchId) {
      categoryUsage.value = {}
      return
    }
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('category_id, deleted_at')
      .eq('branch_id', branchId)
    if (error) throw new Error(postgrestErrorMessage(error))
    const map: Record<string, CategoryUsage> = {}
    for (const row of data ?? []) {
      if (!row.category_id) continue
      const cur = map[row.category_id] ?? { active: 0, archived: 0 }
      if (row.deleted_at) cur.archived += 1
      else cur.active += 1
      map[row.category_id] = cur
    }
    categoryUsage.value = map
  }

  async function deleteCategory(categoryId: string) {
    const supabase = useSupabaseClient()

    try {
      await $fetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
      await fetchCategories()
      await fetchSubcategories()
      await fetchManagerSubcategories(null)
      const authStore = useAuthStore()
      const branchId = authStore.ownerFocusBranchId ?? authStore.branchId
      if (branchId) await fetchCategoryUsage(branchId)
      return
    } catch (apiErr: unknown) {
      const status =
        typeof apiErr === 'object' && apiErr != null && 'statusCode' in apiErr
          ? Number((apiErr as { statusCode?: number }).statusCode)
          : NaN
      if (status !== 501) {
        const msg =
          typeof apiErr === 'object' && apiErr != null && 'statusMessage' in apiErr
            ? String((apiErr as { statusMessage?: string }).statusMessage)
            : fetchErrorMessage(apiErr)
        throw new Error(msg || 'Failed to delete category')
      }
    }

    const { error: rpcErr } = await supabase.rpc('delete_category_safe', {
      p_category_id: categoryId,
    })
    if (!rpcErr) {
      await fetchCategories()
      await fetchSubcategories()
      await fetchManagerSubcategories(null)
      const authStore = useAuthStore()
      const branchId = authStore.ownerFocusBranchId ?? authStore.branchId
      if (branchId) await fetchCategoryUsage(branchId)
      return
    }

    const rpcMsg = postgrestErrorMessage(rpcErr)
    const rpcMissing =
      rpcErr.code === 'PGRST202' ||
      rpcMsg.includes('delete_category_safe') ||
      rpcMsg.includes('Could not find the function')
    if (!rpcMissing) {
      throw new Error(rpcMsg)
    }

    const { data: cat, error: catErr } = await supabase
      .from('categories')
      .select('id, branch_id')
      .eq('id', categoryId)
      .single()
    if (catErr) throw new Error(postgrestErrorMessage(catErr))

    const { data: refs, error: refsErr } = await supabase
      .from('products')
      .select('id, deleted_at')
      .eq('category_id', categoryId)
    if (refsErr) throw new Error(postgrestErrorMessage(refsErr))

    const linked = refs ?? []
    const active = linked.filter((p) => p.deleted_at == null)
    if (active.length > 0) {
      throw new Error(
        `Cannot delete: ${active.length} active product(s) use this category. Reassign or delete them on the Products page first.`,
      )
    }

    if (linked.length > 0) {
      let fallbackId: string | undefined
      const { data: fallback, error: fallbackErr } = await supabase
        .from('categories')
        .select('id')
        .eq('branch_id', cat.branch_id)
        .neq('id', categoryId)
        .order('name')
        .limit(1)
      if (fallbackErr) throw new Error(postgrestErrorMessage(fallbackErr))
      fallbackId = fallback?.[0]?.id

      if (!fallbackId) {
        const { data: created, error: createErr } = await supabase
          .from('categories')
          .insert({ branch_id: cat.branch_id, name: 'General' })
          .select('id')
          .single()
        if (createErr) throw new Error(postgrestErrorMessage(createErr))
        fallbackId = created?.id
      }
      if (!fallbackId) {
        throw new Error('Could not find or create a category to move archived products into.')
      }

      const { error: moveErr } = await supabase
        .from('products')
        .update({ category_id: fallbackId, subcategory_id: null })
        .eq('category_id', categoryId)
      if (moveErr) throw new Error(postgrestErrorMessage(moveErr))

      const { data: stillLinked, error: checkErr } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', categoryId)
        .limit(1)
      if (checkErr) throw new Error(postgrestErrorMessage(checkErr))
      if ((stillLinked?.length ?? 0) > 0) {
        throw new Error(
          'Products still reference this category. Run database/migrations/013_delete_category_safe.sql in Supabase, then try again.',
        )
      }
    }

    const { error } = await supabase.from('categories').delete().eq('id', categoryId)
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchCategories()
    await fetchSubcategories()
    await fetchManagerSubcategories(null)
    if (cat.branch_id) await fetchCategoryUsage(cat.branch_id)
  }

  async function updateSubcategory(subcategoryId: string, name: string) {
    const supabase = useSupabaseClient()
    const next = name.trim()
    if (!next) throw new Error('Subcategory name is required')
    const { data, error } = await supabase
      .from('subcategories')
      .update({ name: next })
      .eq('id', subcategoryId)
      .select('id, category_id, name')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchSubcategories(data.category_id)
    await fetchManagerSubcategories(data.category_id)
    return data
  }

  async function deleteSubcategory(subcategoryId: string) {
    const supabase = useSupabaseClient()
    const { data: sub, error: subErr } = await supabase
      .from('subcategories')
      .select('id, category_id, name')
      .eq('id', subcategoryId)
      .single()
    if (subErr) throw new Error(postgrestErrorMessage(subErr))
    const [{ count: activeCount, error: activeErr }, { count: archivedCount, error: archivedErr }] =
      await Promise.all([
        supabase
          .from('products')
          .select('id', { head: true, count: 'exact' })
          .eq('subcategory_id', subcategoryId)
          .is('deleted_at', null),
        supabase
          .from('products')
          .select('id', { head: true, count: 'exact' })
          .eq('subcategory_id', subcategoryId)
          .not('deleted_at', 'is', null),
      ])
    if (activeErr) throw new Error(postgrestErrorMessage(activeErr))
    if (archivedErr) throw new Error(postgrestErrorMessage(archivedErr))
    if ((activeCount ?? 0) > 0) {
      throw new Error(
        `Cannot delete: ${activeCount} active product(s) use this subcategory. Reassign them on the Products page first.`,
      )
    }
    if ((archivedCount ?? 0) > 0) {
      const { error: clearErr } = await supabase
        .from('products')
        .update({ subcategory_id: null })
        .eq('subcategory_id', subcategoryId)
        .not('deleted_at', 'is', null)
      if (clearErr) throw new Error(postgrestErrorMessage(clearErr))
    }
    const { error } = await supabase.from('subcategories').delete().eq('id', subcategoryId)
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchSubcategories(sub.category_id)
    await fetchManagerSubcategories(sub.category_id)
  }

  async function createProduct(payload: {
    branch_id: string
    category_id: string
    subcategory_id: string | null
    name: string
    price: number | null
    image_url: string | null
  }) {
    const supabase = useSupabaseClient()
    const branchId = normalizeUuid(payload.branch_id)
    const categoryId = normalizeUuid(payload.category_id)
    const subId = normalizeUuid(payload.subcategory_id)
    const imageUrl =
      typeof payload.image_url === 'string' && payload.image_url.trim() !== ''
        ? payload.image_url.trim()
        : null
    if (!branchId || !categoryId) {
      throw new Error('Branch and category are required')
    }
    const row = {
      branch_id: branchId,
      category_id: categoryId,
      subcategory_id: subId,
      name: payload.name.trim(),
      price: payload.price,
      image_url: imageUrl,
    }
    // Avoid embedding relations on insert — PostgREST often returns 400 if embed hints fail; fetchProducts refreshes the list.
    let { data, error } = await supabase.from('products').insert(row).select('id').single()
    if (error && isMissingImageUrlColumn(error)) {
      const retry = await supabase
        .from('products')
        .insert({
          branch_id: row.branch_id,
          category_id: row.category_id,
          subcategory_id: row.subcategory_id,
          name: row.name,
          price: row.price,
        })
        .select('id')
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) throw new Error(postgrestErrorMessage(error))
    if (!data?.id) throw new Error('Insert succeeded but no row was returned')
    await fetchProducts()
    return data as unknown as Product
  }

  async function updateProductPrice(productId: string, price: number | null) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .update({ price })
      .eq('id', productId)
      .select('id')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    if (!data?.id) {
      throw new Error('Price was not updated — no row matched (check you are logged in as owner).')
    }
    await fetchProducts()
  }

  async function updateProduct(
    productId: string,
    payload: {
      category_id: string
      subcategory_id: string | null
      name: string
      price: number | null
      image_url?: string | null
    },
  ) {
    const supabase = useSupabaseClient()
    const categoryId = normalizeUuid(payload.category_id)
    const subId = normalizeUuid(payload.subcategory_id)
    if (!categoryId || !payload.name.trim()) {
      throw new Error('Category and product name are required')
    }
    const { data, error } = await supabase
      .from('products')
      .update({
        category_id: categoryId,
        subcategory_id: subId,
        name: payload.name.trim(),
        price: payload.price,
        ...(payload.image_url !== undefined ? { image_url: payload.image_url } : {}),
      })
      .eq('id', productId)
      .select('id')
      .single()
    if (error) throw new Error(postgrestErrorMessage(error))
    if (!data?.id) throw new Error('Product was not updated.')
    await fetchProducts()
  }

  async function deleteProduct(productId: string) {
    const supabase = useSupabaseClient()
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', productId)
    if (error) throw new Error(postgrestErrorMessage(error))
    await fetchProducts()
  }

  return {
    products,
    categories,
    subcategories,
    managerSubcategories,
    categoryUsage,
    loading,
    fetchProducts,
    fetchCategories,
    fetchCategoryUsage,
    fetchSubcategories,
    fetchManagerSubcategories,
    createCategory,
    createSubcategory,
    updateCategory,
    deleteCategory,
    updateSubcategory,
    deleteSubcategory,
    createProduct,
    updateProductPrice,
    updateProduct,
    deleteProduct,
  }
})

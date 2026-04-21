<script setup lang="ts">
import Swal from 'sweetalert2'

definePageMeta({ layout: 'default' })

const { isOwner, loadProfile, loadBranches, ownerFocusBranchId, branches } = useAuth()
const supabase = useSupabaseClient()
const toast = useToast()
const {
  products,
  categories,
  subcategories,
  loading,
  fetchProducts,
  fetchCategories,
  fetchSubcategories,
  createCategory,
  createSubcategory,
  createProduct,
  updateProduct,
  deleteProduct,
} = useProducts()

const newCategory = ref('')
const subCatCategoryId = ref('')
const newSubcategory = ref('')

const form = reactive({
  category_id: '',
  subcategory_id: '' as string | '',
  name: '',
  price: '' as string | '',
})
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const imageInputKey = ref(0)

const modalOpen = ref(false)
const modalView = ref<'product' | 'taxonomy' | 'edit' | 'view'>('product')
const savingProduct = ref(false)
const productStatusMsg = ref('')
const productStatusType = ref<'success' | 'error' | ''>('')
const page = ref(1)
const pageSize = ref(10)
const searchTerm = ref('')
const catalogCategoryFilter = ref('all')
const catalogSubcategoryFilter = ref('all')
const editingProductId = ref<string | null>(null)
const savingEdit = ref(false)
const selectedProduct = ref<(typeof products.value)[number] | null>(null)
const editForm = reactive({
  category_id: '',
  subcategory_id: '' as string | '',
  name: '',
  price: '' as string | '',
})
const editImageFile = ref<File | null>(null)
const editImagePreviewUrl = ref('')
const removeExistingImage = ref(false)

function resolveProductImageUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) return v
  const path = v.replace(/^\/+/, '')
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl || null
}

/** Branch selected in the sidebar — this id is sent as products.branch_id when saving */
const focusedBranchName = computed(() => {
  const id = ownerFocusBranchId.value
  if (!id) return null
  return branches.value.find((b) => b.id === id)?.name ?? null
})

onMounted(async () => {
  await loadProfile()
  await loadBranches()
  await Promise.all([fetchCategories(), fetchProducts()])
  await fetchSubcategories()
})

watch(ownerFocusBranchId, () => {
  fetchProducts()
})

watch(
  () => form.category_id,
  async (id) => {
    form.subcategory_id = ''
    await fetchSubcategories(id || undefined)
  },
)

async function addCategory() {
  const name = newCategory.value.trim()
  if (!name) {
    toast.push('Enter a category name', 'error')
    return
  }
  try {
    await createCategory(name)
    newCategory.value = ''
    toast.push('Category added', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed', 'error')
  }
}

async function addSubcategory() {
  if (!subCatCategoryId.value) {
    toast.push('Choose a parent category for the subcategory', 'error')
    return
  }
  const name = newSubcategory.value.trim()
  if (!name) {
    toast.push('Enter a subcategory name', 'error')
    return
  }
  try {
    await createSubcategory(subCatCategoryId.value, name)
    await fetchSubcategories(subCatCategoryId.value)
    const created = [...subcategories.value]
      .reverse()
      .find((s) => s.category_id === subCatCategoryId.value && s.name.trim().toLowerCase() === name.toLowerCase())

    // Move user directly to New product with the new parent/subcategory preselected.
    form.category_id = subCatCategoryId.value
    form.subcategory_id = created?.id ?? ''
    newSubcategory.value = ''
    modalView.value = 'product'
    toast.push('Subcategory added. You can now create a product under it.', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed', 'error')
  }
}

async function addProduct() {
  if (savingProduct.value) return
  try {
    savingProduct.value = true
    productStatusMsg.value = ''
    productStatusType.value = ''
    // Keep owner/branch context fresh for repeated saves without page refresh.
    await loadProfile()
    await loadBranches()
    if (!form.category_id || !form.name.trim()) {
      toast.push('Category and product name are required', 'error')
      productStatusMsg.value = 'Category and product name are required.'
      productStatusType.value = 'error'
      return
    }
    if (isOwner.value && !ownerFocusBranchId.value) {
      toast.push('Select a branch in the sidebar first', 'error')
      productStatusMsg.value = 'Select a branch in the sidebar first.'
      productStatusType.value = 'error'
      return
    }
    if (
      isOwner.value &&
      branches.value.length > 0 &&
      !branches.value.some((b) => b.id === ownerFocusBranchId.value)
    ) {
      toast.push('Your selected branch is out of date — refresh the page and pick a branch again', 'error')
      productStatusMsg.value = 'Selected branch is out of date. Pick a branch again.'
      productStatusType.value = 'error'
      return
    }
    const price =
      form.price.trim() === '' ? null : Number.parseFloat(form.price)
    if (form.price.trim() !== '' && Number.isNaN(price as number)) {
      toast.push('Invalid price', 'error')
      productStatusMsg.value = 'Invalid price.'
      productStatusType.value = 'error'
      return
    }
    const subId = form.subcategory_id.trim()
    const subs = unref(subcategories) ?? []
    if (subId && !subs.some((s) => s.id === subId && s.category_id === form.category_id)) {
      toast.push('Subcategory does not match the selected category — choose again or None', 'error')
      productStatusMsg.value = 'Subcategory does not match selected category.'
      productStatusType.value = 'error'
      return
    }
    let uploadedImageUrl: string | null = null
    try {
      uploadedImageUrl = await uploadProductImage()
    } catch (e: unknown) {
      if (!isMissingProductImageBucket(e)) throw e
      const proceed = await Swal.fire({
        icon: 'warning',
        title: 'Image bucket is missing',
        text: 'Bucket "product-images" was not found. Save product without image for now?',
        showCancelButton: true,
        confirmButtonText: 'Save without image',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#eab308',
      })
      if (!proceed.isConfirmed) return
      uploadedImageUrl = null
    }
    await createProduct({
      branch_id: ownerFocusBranchId.value!,
      category_id: form.category_id,
      subcategory_id: form.subcategory_id || null,
      name: form.name.trim(),
      price: price as number | null,
      image_url: uploadedImageUrl,
    })
    form.name = ''
    form.price = ''
    imageFile.value = null
    if (imagePreviewUrl.value) {
      URL.revokeObjectURL(imagePreviewUrl.value)
      imagePreviewUrl.value = ''
    }
    imageInputKey.value += 1
    await Swal.fire({ icon: 'success', title: 'Saved', text: 'Product created successfully', timer: 1400, showConfirmButton: false })
    productStatusMsg.value = 'Product saved. You can add another one now.'
    productStatusType.value = 'success'
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Save failed', text: e instanceof Error ? e.message : 'Failed to save product' })
    productStatusMsg.value = e instanceof Error ? e.message : 'Failed to save product.'
    productStatusType.value = 'error'
  } finally {
    savingProduct.value = false
  }
}

function onPickImage(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  imageFile.value = file
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = ''
  }
  if (file) imagePreviewUrl.value = URL.createObjectURL(file)
}

async function uploadProductImage(): Promise<string | null> {
  if (!imageFile.value) return null
  const file = imageFile.value
  const ext = file.name.includes('.') ? (file.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg'
  const safeExt = ext.length <= 8 ? ext : 'jpg'
  const branch = ownerFocusBranchId.value ?? 'unassigned'
  const nameBase = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const filePath = `${branch}/${Date.now()}-${nameBase || 'product'}.${safeExt}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (error) {
    throw new Error(`Image upload failed (${error.message}). Create a public bucket named "product-images".`)
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath)
  return data.publicUrl || null
}

function isMissingProductImageBucket(error: unknown) {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return msg.includes('bucket not found') || msg.includes('product-images')
}

function openEditProduct(p: { id: string; category_id: string; subcategory_id: string | null; name: string; price: number | null }) {
  editingProductId.value = p.id
  editForm.category_id = p.category_id
  editForm.subcategory_id = p.subcategory_id ?? ''
  editForm.name = p.name
  editForm.price = p.price != null ? String(p.price) : ''
  fetchSubcategories(p.category_id)
  removeExistingImage.value = false
  editImageFile.value = null
  if (editImagePreviewUrl.value) {
    URL.revokeObjectURL(editImagePreviewUrl.value)
    editImagePreviewUrl.value = ''
  }
  modalView.value = 'edit'
  modalOpen.value = true
}

async function saveEditedProduct() {
  if (!editingProductId.value) return
  const price = editForm.price.trim() === '' ? null : Number.parseFloat(editForm.price)
  if (editForm.price.trim() !== '' && Number.isNaN(price as number)) {
    toast.push('Invalid price', 'error')
    return
  }
  savingEdit.value = true
  try {
    let nextImageUrl: string | null | undefined = undefined
    if (removeExistingImage.value) {
      nextImageUrl = null
    } else if (editImageFile.value) {
      try {
        const file = editImageFile.value
        const ext = file.name.includes('.') ? (file.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg'
        const safeExt = ext.length <= 8 ? ext : 'jpg'
        const branch = ownerFocusBranchId.value ?? 'unassigned'
        const base = editForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const filePath = `${branch}/${Date.now()}-${base || 'product'}.${safeExt}`
        const { error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, { upsert: false, contentType: file.type || 'image/jpeg' })
        if (error) throw new Error(`Image upload failed (${error.message})`)
        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath)
        nextImageUrl = data.publicUrl || null
      } catch (e: unknown) {
        if (!isMissingProductImageBucket(e)) throw e
        const proceed = await Swal.fire({
          icon: 'warning',
          title: 'Image bucket is missing',
          text: 'Bucket "product-images" was not found. Update product without replacing image?',
          showCancelButton: true,
          confirmButtonText: 'Continue update',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#eab308',
        })
        if (!proceed.isConfirmed) return
      }
    }
    await updateProduct(editingProductId.value, {
      category_id: editForm.category_id,
      subcategory_id: editForm.subcategory_id || null,
      name: editForm.name,
      price: price as number | null,
      image_url: nextImageUrl,
    })
    await Swal.fire({ icon: 'success', title: 'Updated', text: 'Product updated successfully', timer: 1300, showConfirmButton: false })
    modalOpen.value = false
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Update failed', text: e instanceof Error ? e.message : 'Failed' })
  } finally {
    savingEdit.value = false
  }
}

async function removeProduct(id: string) {
  const res = await Swal.fire({
    icon: 'warning',
    title: 'Delete product?',
    text: 'This performs soft-delete and keeps sales history intact.',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    confirmButtonColor: '#eab308',
  })
  if (!res.isConfirmed) return
  try {
    await deleteProduct(id)
    await Swal.fire({ icon: 'success', title: 'Deleted', text: 'Product deleted (soft delete)', timer: 1300, showConfirmButton: false })
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Delete failed', text: e instanceof Error ? e.message : 'Failed to delete product' })
  }
}

function openViewProduct(p: (typeof products.value)[number]) {
  selectedProduct.value = p
  modalView.value = 'view'
  modalOpen.value = true
}

function onPickEditImage(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  editImageFile.value = file
  removeExistingImage.value = false
  if (editImagePreviewUrl.value) {
    URL.revokeObjectURL(editImagePreviewUrl.value)
    editImagePreviewUrl.value = ''
  }
  if (file) editImagePreviewUrl.value = URL.createObjectURL(file)
}

function formatPeso(value: number | null) {
  if (value == null) return '—'
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function openModal(view: 'product' | 'taxonomy') {
  if (view === 'taxonomy') {
    // Reuse currently selected category context so users can add subcategories faster.
    if (form.category_id) subCatCategoryId.value = form.category_id
    else if (catalogCategoryFilter.value !== 'all') subCatCategoryId.value = catalogCategoryFilter.value
  }
  modalView.value = view
  modalOpen.value = true
}

const filteredCatalogProducts = computed(() => {
  let list = products.value
  if (catalogCategoryFilter.value !== 'all') {
    list = list.filter((p) => p.category_id === catalogCategoryFilter.value)
  }
  if (catalogSubcategoryFilter.value !== 'all') {
    list = list.filter((p) => p.subcategory_id === catalogSubcategoryFilter.value)
  }
  const q = searchTerm.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) =>
      [p.name, p.categories?.name ?? '', p.subcategories?.name ?? ''].join(' ').toLowerCase().includes(q),
    )
  }
  return list
})
const branchCategoryOptions = computed(() => {
  const map = new Map<string, string>()
  for (const p of products.value) {
    if (!p.category_id) continue
    map.set(p.category_id, p.categories?.name ?? 'Category')
  }
  const keepIds = [
    form.category_id,
    editForm.category_id,
    subCatCategoryId.value,
    catalogCategoryFilter.value !== 'all' ? catalogCategoryFilter.value : '',
  ].filter(Boolean)
  for (const id of keepIds) {
    if (map.has(id)) continue
    const fallback = categories.value.find((c) => c.id === id)
    if (fallback) map.set(fallback.id, fallback.name)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const availableCatalogSubcategories = computed(() => {
  const base =
    catalogCategoryFilter.value === 'all'
      ? products.value
      : products.value.filter((p) => p.category_id === catalogCategoryFilter.value)
  const map = new Map<string, string>()
  for (const p of base) {
    if (!p.subcategory_id) continue
    map.set(p.subcategory_id, p.subcategories?.name ?? 'Subcategory')
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredCatalogProducts.value.length / pageSize.value)))
const pagedProducts = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredCatalogProducts.value.slice(start, start + pageSize.value)
})
const showingFrom = computed(() => (filteredCatalogProducts.value.length === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const showingTo = computed(() => Math.min(page.value * pageSize.value, filteredCatalogProducts.value.length))

watch([products, catalogCategoryFilter, catalogSubcategoryFilter, searchTerm, pageSize], () => {
  page.value = 1
  if (page.value > totalPages.value) page.value = totalPages.value
})
watch(catalogCategoryFilter, () => {
  catalogSubcategoryFilter.value = 'all'
})

onBeforeUnmount(() => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  if (editImagePreviewUrl.value) URL.revokeObjectURL(editImagePreviewUrl.value)
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">🛍️ Products</h1>
      <p class="text-sm text-brand-700">
        Product catalog first. Use actions below to manage categories or add new products.
      </p>
    </div>

    <div v-if="isOwner" class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-sm ring-1 ring-yellow-500 transition hover:bg-yellow-300 hover:shadow"
        @click="openModal('product')"
      >
        ➕ New product
      </button>
      <button
        type="button"
        class="rounded-lg border border-yellow-500 bg-yellow-100 px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-yellow-200 hover:shadow"
        @click="openModal('taxonomy')"
      >
        Categories & subcategories
      </button>
    </div>

    <div class="rounded-xl border border-brand-200 bg-white shadow-sm">
      <div class="border-b border-brand-100 px-4 py-3">
        <h2 class="font-semibold text-brand-950">Catalog</h2>
        <div class="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label class="text-xs text-brand-700">Show entries</label>
            <select v-model.number="pageSize" class="mt-1 w-full max-w-[180px] rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </div>
          <div class="w-full md:w-auto">
            <label class="text-xs text-brand-700">Search</label>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search product, category..."
              class="mt-1 w-full md:w-80 rounded-lg border border-brand-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:gap-0">
          <div class="w-full md:w-auto">
            <label class="text-xs text-brand-700">Category</label>
            <select v-model="catalogCategoryFilter" class="mt-1 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option value="all">All categories</option>
              <option v-for="c in branchCategoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="w-full md:w-auto">
            <label class="text-xs text-brand-700">Subcategory</label>
            <select v-model="catalogSubcategoryFilter" class="mt-1 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option value="all">All subcategories</option>
              <option v-for="s in availableCatalogSubcategories" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-brand-100 text-sm">
          <thead class="bg-white">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Product</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Image</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Category</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Subcategory</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Price</th>
              <th v-if="isOwner" class="px-4 py-2 text-right font-medium text-brand-800">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-100">
            <tr v-for="p in pagedProducts" :key="p.id">
              <td class="px-4 py-2 font-medium text-brand-950">{{ p.name }}</td>
              <td class="px-4 py-2 text-brand-800">
                <img
                  v-if="resolveProductImageUrl(p.image_url)"
                  :src="resolveProductImageUrl(p.image_url)!"
                  :alt="p.name"
                  class="h-10 w-10 rounded-md object-cover"
                />
                <span v-else>—</span>
              </td>
              <td class="px-4 py-2 text-brand-800">{{ p.categories?.name ?? '—' }}</td>
              <td class="px-4 py-2 text-brand-800">{{ p.subcategories?.name ?? '—' }}</td>
              <td class="px-4 py-2 text-right tabular-nums text-brand-900">
                <span>{{ formatPeso(p.price) }}</span>
              </td>
              <td v-if="isOwner" class="px-4 py-2 text-right">
                <div class="flex justify-end gap-2">
                  <button type="button" class="rounded border border-brand-300 px-2 py-1 text-sm" title="View product" @click="openViewProduct(p)">👁️</button>
                  <button type="button" class="rounded border border-brand-300 px-2 py-1 text-sm" title="Edit product" @click="openEditProduct(p)">✏️</button>
                  <button type="button" class="rounded border border-red-300 px-2 py-1 text-sm" title="Delete product" @click="removeProduct(p.id)">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && filteredCatalogProducts.length === 0">
              <td :colspan="isOwner ? 6 : 5" class="px-4 py-8 text-center text-brand-600">No products yet</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-4 py-3 text-sm">
        <p class="text-brand-700">
          Showing {{ showingFrom }} to {{ showingTo }} of {{ filteredCatalogProducts.length }} entries
        </p>
        <div class="flex gap-2">
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page <= 1" @click="page -= 1">Prev</button>
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page >= totalPages" @click="page += 1">Next</button>
        </div>
      </div>
    </div>

    <div v-if="modalOpen && isOwner" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-brand-200 bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-brand-950">
            {{
              modalView === 'product'
                ? 'New product'
                : modalView === 'taxonomy'
                  ? 'Categories & subcategories'
                  : modalView === 'edit'
                    ? 'Edit product'
                    : 'Product details'
            }}
          </h2>
          <button
            type="button"
            class="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            @click="modalOpen = false"
          >
            Close
          </button>
        </div>

        <div v-if="modalView === 'product'">
          <p class="text-xs text-brand-600">
            <template v-if="focusedBranchName">
              Saved under branch <span class="font-medium text-brand-800">{{ focusedBranchName }}</span>.
            </template>
            <template v-else>Select a branch in the sidebar first.</template>
          </p>
          <form class="mt-4 grid gap-3" @submit.prevent="addProduct">
            <div>
              <label class="text-xs text-brand-700">Category</label>
              <select v-model="form.category_id" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm">
                <option value="" disabled>Select</option>
                <option v-for="c in branchCategoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-brand-700">Subcategory (optional)</label>
              <select v-model="form.subcategory_id" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm">
                <option value="">None</option>
                <option v-for="s in subcategories" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-brand-700">Name</label>
              <input v-model="form.name" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-brand-700">Price (optional)</label>
              <input v-model="form.price" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-brand-700">Product image (optional)</label>
              <input
                :key="imageInputKey"
                type="file"
                accept="image/*"
                class="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm"
                @change="onPickImage"
              />
              <img
                v-if="imagePreviewUrl"
                :src="imagePreviewUrl"
                alt="Selected image preview"
                class="mt-2 h-20 w-20 rounded-md border border-brand-200 object-cover"
              />
            </div>
            <button
              type="submit"
              class="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-sm ring-1 ring-yellow-500 transition hover:bg-yellow-300 hover:shadow disabled:opacity-60"
              :disabled="savingProduct"
            >
              {{ savingProduct ? 'Saving…' : 'Save product' }}
            </button>
            <p
              v-if="productStatusMsg"
              class="text-xs"
              :class="productStatusType === 'success' ? 'text-emerald-700' : 'text-red-700'"
            >
              {{ productStatusMsg }}
            </p>
          </form>
        </div>

        <div v-else-if="modalView === 'taxonomy'" class="space-y-4">
          <div>
            <label class="text-xs text-brand-700">New category name</label>
            <div class="mt-1 flex flex-wrap gap-2">
              <input
                v-model="newCategory"
                class="min-w-[12rem] flex-1 rounded-lg border border-brand-300 px-3 py-2 text-sm"
                placeholder="e.g. Beverages"
              />
              <button
                type="button"
                class="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-semibold text-black shadow-sm ring-1 ring-yellow-500 transition hover:bg-yellow-300 hover:shadow"
                @click="addCategory"
              >
                Add category
              </button>
            </div>
          </div>
          <div>
            <label class="text-xs text-brand-700">Parent category (for subcategories)</label>
            <select
              v-model="subCatCategoryId"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>Select</option>
              <option v-for="c in branchCategoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-brand-700">New subcategory name</label>
            <div class="mt-1 flex flex-wrap gap-2">
              <input
                v-model="newSubcategory"
                class="min-w-[12rem] flex-1 rounded-lg border border-brand-300 px-3 py-2 text-sm"
                placeholder="e.g. Energy drinks"
              />
              <button
                type="button"
                class="rounded-lg border border-yellow-500 bg-yellow-100 px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-yellow-200 hover:shadow"
                @click="addSubcategory"
              >
                Add subcategory
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="modalView === 'edit'" class="space-y-4">
          <form class="grid gap-3" @submit.prevent="saveEditedProduct">
            <div>
              <label class="text-xs text-brand-700">Category</label>
              <select v-model="editForm.category_id" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm">
                <option value="" disabled>Select</option>
                <option v-for="c in branchCategoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-brand-700">Subcategory (optional)</label>
              <select v-model="editForm.subcategory_id" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm">
                <option value="">None</option>
                <option v-for="s in subcategories" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-brand-700">Name</label>
              <input v-model="editForm.name" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-brand-700">Price (optional)</label>
              <input v-model="editForm.price" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-brand-700">Replace image (optional)</label>
              <input
                type="file"
                accept="image/*"
                class="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm"
                @change="onPickEditImage"
              />
              <div class="mt-2 flex items-center gap-2">
                <img
                  v-if="editImagePreviewUrl"
                  :src="editImagePreviewUrl"
                  alt="Edit image preview"
                  class="h-16 w-16 rounded-md border border-brand-200 object-cover"
                />
                <button type="button" class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" @click="removeExistingImage = true; editImageFile = null; editImagePreviewUrl = ''">
                  Remove existing image
                </button>
              </div>
            </div>
            <button type="submit" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-400 disabled:opacity-60" :disabled="savingEdit">
              {{ savingEdit ? 'Saving…' : 'Save changes' }}
            </button>
          </form>
        </div>

        <div v-else-if="selectedProduct" class="space-y-3 text-sm">
          <img
            v-if="resolveProductImageUrl(selectedProduct.image_url)"
            :src="resolveProductImageUrl(selectedProduct.image_url)!"
            :alt="selectedProduct.name"
            class="h-40 w-full rounded-lg border border-brand-200 object-cover"
          />
          <p><span class="font-semibold text-brand-900">Name:</span> {{ selectedProduct.name }}</p>
          <p><span class="font-semibold text-brand-900">Category:</span> {{ selectedProduct.categories?.name ?? '—' }}</p>
          <p><span class="font-semibold text-brand-900">Subcategory:</span> {{ selectedProduct.subcategories?.name ?? '—' }}</p>
          <p><span class="font-semibold text-brand-900">Price:</span> {{ formatPeso(selectedProduct.price) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

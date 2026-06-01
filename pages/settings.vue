<script setup lang="ts">
import Swal from 'sweetalert2'
import { Icon } from '@iconify/vue'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()
const { ownerFocusBranchId } = useAuth()
const toast = useToast()
const {
  products,
  categories,
  managerSubcategories,
  categoryUsage,
  fetchCategories,
  fetchCategoryUsage,
  fetchManagerSubcategories,
  fetchProducts,
  createCategory,
  createSubcategory,
  updateCategory,
  deleteCategory,
  updateSubcategory,
  deleteSubcategory,
} = useProducts()

const selectedCategoryId = ref('')

onMounted(async () => {
  await authStore.loadProfile()
  if (!authStore.isOwner) {
    await navigateTo('/dashboard')
    return
  }
  const branchId = ownerFocusBranchId.value ?? null
  await fetchCategories(branchId)
  await fetchProducts(branchId)
  await fetchCategoryUsage(branchId)
})

watch(ownerFocusBranchId, async (id) => {
  selectedCategoryId.value = ''
  await fetchCategories(id ?? null)
  await fetchProducts(id ?? null)
  await fetchCategoryUsage(id ?? null)
})

watch(selectedCategoryId, (id) => {
  fetchManagerSubcategories(id || null)
})

const branchCategories = computed(() => {
  const map = new Map<string, string>()
  for (const c of categories.value) {
    if (!c.id) continue
    map.set(c.id, c.name ?? 'Category')
  }
  for (const p of products.value) {
    if (!p.category_id) continue
    if (!map.has(p.category_id)) map.set(p.category_id, p.categories?.name ?? 'Category')
  }
  const out = [...map.entries()].map(([id, name]) => ({ id, name }))
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
})

const selectedCategoryName = computed(
  () => branchCategories.value.find((c) => c.id === selectedCategoryId.value)?.name ?? '',
)
const selectedCategory = computed(() => branchCategories.value.find((c) => c.id === selectedCategoryId.value) ?? null)

function categoryUsageLabel(categoryId: string): string {
  const u = categoryUsage.value[categoryId]
  if (!u) return '0 products'
  if (u.archived === 0) return `${u.active} product${u.active === 1 ? '' : 's'}`
  if (u.active === 0) return `${u.archived} archived`
  return `${u.active} active, ${u.archived} archived`
}

function canDeleteCategory(categoryId: string): boolean {
  const u = categoryUsage.value[categoryId]
  return !u || u.active === 0
}

const subcategoryUsageCount = computed(() => {
  const map = new Map<string, number>()
  for (const p of products.value) {
    if (!p.subcategory_id) continue
    map.set(p.subcategory_id, (map.get(p.subcategory_id) ?? 0) + 1)
  }
  return map
})

async function renameCategory(id: string, currentName: string) {
  const res = await Swal.fire({
    title: 'Rename category',
    input: 'text',
    inputValue: currentName,
    showCancelButton: true,
    confirmButtonText: 'Save',
    confirmButtonColor: '#eab308',
    inputValidator: (v) => (!v?.trim() ? 'Category name is required' : undefined),
  })
  if (!res.isConfirmed) return
  try {
    await updateCategory(id, String(res.value ?? ''))
    await fetchCategories()
    await fetchProducts(ownerFocusBranchId.value ?? null)
    toast.push('Category updated', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to update category', 'error')
  }
}

async function removeCategory(id: string, name: string) {
  const u = categoryUsage.value[id]
  if (u && u.active > 0) {
    toast.push(
      `Cannot delete "${name}": ${u.active} active product(s) still use it. Reassign or delete them on Products first.`,
      'error',
    )
    return
  }
  const archivedNote =
    u && u.archived > 0
      ? ` ${u.archived} archived product(s) will be moved to another category in this branch.`
      : ''
  const res = await Swal.fire({
    icon: 'warning',
    title: 'Delete category?',
    text: `Delete "${name}"? Subcategories under it will be removed.${archivedNote}`,
    showCancelButton: true,
    confirmButtonText: 'Delete',
    confirmButtonColor: '#eab308',
  })
  if (!res.isConfirmed) return
  try {
    await deleteCategory(id)
    if (selectedCategoryId.value === id) selectedCategoryId.value = ''
    const branchId = ownerFocusBranchId.value ?? null
    await fetchCategories(branchId)
    await fetchProducts(branchId)
    await fetchCategoryUsage(branchId)
    toast.push('Category deleted', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to delete category', 'error')
  }
}

async function renameSubcategory(id: string, currentName: string) {
  const res = await Swal.fire({
    title: 'Rename subcategory',
    input: 'text',
    inputValue: currentName,
    showCancelButton: true,
    confirmButtonText: 'Save',
    confirmButtonColor: '#eab308',
    inputValidator: (v) => (!v?.trim() ? 'Subcategory name is required' : undefined),
  })
  if (!res.isConfirmed) return
  try {
    await updateSubcategory(id, String(res.value ?? ''))
    await fetchProducts(ownerFocusBranchId.value ?? null)
    toast.push('Subcategory updated', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to update subcategory', 'error')
  }
}

async function removeSubcategory(id: string, name: string) {
  const res = await Swal.fire({
    icon: 'warning',
    title: 'Delete subcategory?',
    text: `Delete "${name}"? This only works when no active products use it.`,
    showCancelButton: true,
    confirmButtonText: 'Delete',
    confirmButtonColor: '#eab308',
  })
  if (!res.isConfirmed) return
  try {
    await deleteSubcategory(id)
    await fetchProducts(ownerFocusBranchId.value ?? null)
    toast.push('Subcategory deleted', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to delete subcategory', 'error')
  }
}
</script>

<template>
  <div v-if="authStore.isOwner" class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">⚙️ Settings</h1>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
        <h2 class="text-base font-bold text-brand-900">Categories</h2>
        <p v-if="!ownerFocusBranchId" class="mt-2 text-xs text-brand-600">Select a branch in the sidebar to manage categories for that branch.</p>
        <div class="mt-4">
          <label class="text-xs text-brand-700">Category</label>
          <select
            v-model="selectedCategoryId"
            class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
          >
            <option value="">Select category</option>
            <option v-for="c in branchCategories" :key="c.id" :value="c.id">
              {{ c.name }} ({{ categoryUsageLabel(c.id) }})
            </option>
          </select>
        </div>
        <div v-if="selectedCategory" class="mt-3 flex gap-2">
          <button
            type="button"
            class="rounded border border-yellow-500 bg-yellow-100 p-1.5 text-black hover:bg-yellow-200"
            title="Rename category"
            @click="renameCategory(selectedCategory.id, selectedCategory.name)"
          >
            <Icon icon="mdi:pencil-outline" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded border border-red-400 p-1.5 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            :class="canDeleteCategory(selectedCategory.id) ? 'bg-red-50' : 'bg-brand-50'"
            :disabled="!canDeleteCategory(selectedCategory.id)"
            :title="
              canDeleteCategory(selectedCategory.id)
                ? 'Delete category'
                : 'Remove or reassign active products before deleting'
            "
            @click="removeCategory(selectedCategory.id, selectedCategory.name)"
          >
            <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
          </button>
        </div>
      </section>

      <section class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
        <h2 class="text-base font-bold text-brand-900">Subcategories</h2>
        <p v-if="selectedCategoryId" class="mt-2 text-xs text-brand-600">Category: {{ selectedCategoryName }}</p>
        <p v-else class="mt-2 text-xs text-brand-600">Select a category from the left panel to view subcategories.</p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="s in managerSubcategories"
            :key="s.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-brand-100 px-3 py-2"
          >
            <p class="text-sm text-brand-900">
              {{ s.name }}
              <span class="ml-1 text-xs text-brand-600">({{ subcategoryUsageCount.get(s.id) ?? 0 }} products)</span>
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded border border-yellow-500 bg-yellow-100 p-1.5 text-black hover:bg-yellow-200"
                title="Rename subcategory"
                @click="renameSubcategory(s.id, s.name)"
              >
                <Icon icon="mdi:pencil-outline" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded border border-red-400 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                title="Delete subcategory"
                @click="removeSubcategory(s.id, s.name)"
              >
                <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
              </button>
            </div>
          </li>
          <li v-if="selectedCategoryId && managerSubcategories.length === 0" class="text-xs text-brand-600">
            No subcategories in this category yet.
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

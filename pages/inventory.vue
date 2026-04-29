<script setup lang="ts">
import Swal from 'sweetalert2'

definePageMeta({ layout: 'default' })

const { isOwner, branchId, ownerFocusBranchId, loadProfile, loadBranches } = useAuth()
const toast = useToast()
const { rows, loading, fetchInventory, adjustStock } = useInventory()
const config = useRuntimeConfig()
const page = ref(1)
const pageSize = ref(10)
const searchTerm = ref('')
const categoryFilter = ref('all')
const subcategoryFilter = ref('all')
const lowStockThreshold = Number(config.public.lowStockThreshold ?? 10)

const editingId = ref<string | null>(null)
const editingStock = ref('')

const effectiveBranchId = computed(() =>
  isOwner.value ? ownerFocusBranchId.value : branchId.value,
)

async function refreshInventoryForBranch() {
  await fetchInventory(effectiveBranchId.value ?? null)
}

onMounted(async () => {
  try {
    await loadProfile()
    await loadBranches()
    await refreshInventoryForBranch()
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to load inventory', 'error')
  }
})

watch(effectiveBranchId, () => {
  refreshInventoryForBranch().catch((e: unknown) =>
    toast.push(e instanceof Error ? e.message : 'Failed to load inventory', 'error'),
  )
})

const visibleRows = computed(() => {
  const list = rows.value
  if (!isOwner.value) {
    const b = branchId.value
    if (!b) return []
    return list.filter((r) => r.branch_id === b)
  }
  if (!ownerFocusBranchId.value) return []
  return list.filter((r) => r.branch_id === ownerFocusBranchId.value)
})

const categoryOptions = computed(() => {
  const map = new Map<string, { id: string; name: string; lowStockCount: number }>()
  for (const r of visibleRows.value) {
    const categoryId = r.products?.category_id
    if (!categoryId) continue
    const name = r.products?.categories?.name ?? 'Uncategorized'
    const existing = map.get(categoryId) ?? { id: categoryId, name, lowStockCount: 0 }
    if (r.stock <= lowStockThreshold) existing.lowStockCount += 1
    map.set(categoryId, existing)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const subcategoryOptions = computed(() => {
  const map = new Map<string, { id: string; name: string; lowStockCount: number }>()
  for (const r of visibleRows.value) {
    if (categoryFilter.value !== 'all' && r.products?.category_id !== categoryFilter.value) continue
    const subcategoryId = r.products?.subcategory_id
    if (!subcategoryId) continue
    const name = r.products?.subcategories?.name ?? 'Uncategorized'
    const existing = map.get(subcategoryId) ?? { id: subcategoryId, name, lowStockCount: 0 }
    if (r.stock <= lowStockThreshold) existing.lowStockCount += 1
    map.set(subcategoryId, existing)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredRows = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  const categoryFiltered = visibleRows.value.filter((r) => {
    if (categoryFilter.value !== 'all' && r.products?.category_id !== categoryFilter.value) return false
    if (subcategoryFilter.value !== 'all' && r.products?.subcategory_id !== subcategoryFilter.value) return false
    return true
  })
  if (!q) return categoryFiltered
  return categoryFiltered.filter((r) =>
    [
      r.products?.name ?? '',
      r.products?.categories?.name ?? '',
      r.products?.subcategories?.name ?? '',
      r.branches?.name ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const showingFrom = computed(() => (filteredRows.value.length === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const showingTo = computed(() => Math.min(page.value * pageSize.value, filteredRows.value.length))

watch([visibleRows, searchTerm, pageSize], () => {
  if (page.value < 1) page.value = 1
  if (page.value > totalPages.value) page.value = totalPages.value
})
watch(categoryFilter, () => {
  subcategoryFilter.value = 'all'
  page.value = 1
})
watch(subcategoryFilter, () => {
  page.value = 1
})

function startEdit(r: { id: string; stock: number }) {
  editingId.value = r.id
  editingStock.value = String(r.stock)
}

async function saveEdit() {
  if (!editingId.value) return
  const n = Number.parseInt(editingStock.value, 10)
  if (Number.isNaN(n) || n < 0) {
    toast.push('Stock must be a non-negative integer', 'error')
    return
  }
  try {
    await adjustStock(editingId.value, n)
    editingId.value = null
    await Swal.fire({ icon: 'success', title: 'Updated', text: 'Stock updated', timer: 1200, showConfirmButton: false })
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Update failed', text: e instanceof Error ? e.message : 'Update failed' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">📦 Inventory</h1>
    </div>

    <div class="rounded-xl border border-brand-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-3 border-b border-brand-100 px-4 py-3">
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
          <input v-model="searchTerm" type="text" placeholder="Search product or branch..." class="mt-1 w-full md:w-80 rounded-lg border border-brand-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div class="border-b border-brand-100 px-4 py-3">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-0">
          <div class="w-full md:w-auto">
            <label class="text-xs text-brand-700">Category</label>
            <select v-model="categoryFilter" class="mt-1 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option value="all">All categories</option>
              <option
                v-for="c in categoryOptions"
                :key="c.id"
                :value="c.id"
              >
                {{ c.lowStockCount > 0 ? `${c.name} ● ${c.lowStockCount}` : c.name }}
              </option>
            </select>
          </div>
          <div class="w-full md:w-auto">
            <label class="text-xs text-brand-700">Subcategory</label>
            <select v-model="subcategoryFilter" class="mt-1 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option value="all">All subcategories</option>
              <option
                v-for="s in subcategoryOptions"
                :key="s.id"
                :value="s.id"
              >
                {{ s.lowStockCount > 0 ? `${s.name} ● ${s.lowStockCount}` : s.name }}
              </option>
            </select>
            <p v-if="subcategoryOptions.length === 0" class="mt-1 text-xs text-brand-600">No subcategories in this category</p>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-brand-100 text-sm">
          <thead class="bg-white">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Product</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Category</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Subcategory</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Stock</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Adjust</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-100">
            <tr v-for="r in pagedRows" :key="r.id">
              <td class="px-4 py-2 font-medium text-brand-950">
                {{ r.products?.name ?? '—' }}
              </td>
              <td class="px-4 py-2 text-brand-800">{{ r.products?.categories?.name ?? '—' }}</td>
              <td class="px-4 py-2 text-brand-800">{{ r.products?.subcategories?.name ?? '—' }}</td>
              <td class="px-4 py-2 text-brand-800">{{ r.branches?.name ?? '—' }}</td>
              <td class="px-4 py-2 text-right tabular-nums text-brand-900">
                <span v-if="editingId !== r.id">{{ r.stock }}</span>
                <input
                  v-else
                  v-model="editingStock"
                  class="w-24 rounded border border-brand-300 px-2 py-1 text-right"
                />
              </td>
              <td class="px-4 py-2 text-right">
                <button
                  v-if="editingId !== r.id"
                  type="button"
                  class="text-sm font-medium text-brand-800 hover:underline"
                  @click="startEdit(r)"
                >
                  Edit
                </button>
                <div v-else class="flex justify-end gap-2">
                  <button type="button" class="text-sm text-brand-700 hover:underline" @click="editingId = null">
                    Cancel
                  </button>
                  <button type="button" class="text-sm font-semibold text-brand-900 hover:underline" @click="saveEdit">
                    Save
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && filteredRows.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-brand-600">
                No inventory rows yet — add products as owner to seed stock rows.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-4 py-3 text-sm">
        <p class="text-brand-700">Showing {{ showingFrom }} to {{ showingTo }} of {{ filteredRows.length }} entries</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            Prev
          </button>
          <button
            type="button"
            class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40"
            :disabled="page >= totalPages"
            @click="page += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

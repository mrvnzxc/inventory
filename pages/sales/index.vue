<script setup lang="ts">
import type { Product } from '~/types/models'
import Swal from 'sweetalert2'

definePageMeta({ layout: 'default' })

const { isOwner, branchId, branches, loadProfile, loadBranches, ownerFocusBranchId } = useAuth()
const productStore = useProductStore()
const inventoryStore = useInventoryStore()
const { createSalesBatch } = useSales()
const supabase = useSupabaseClient()
const toast = useToast()

const busy = ref(false)
const categoryFilter = ref<string>('all')
const subcategoryFilter = ref<string>('all')
const quantities = reactive<Record<string, number>>({})

const effectiveBranchId = computed(() =>
  isOwner.value ? ownerFocusBranchId.value : branchId.value,
)

async function refreshBranchData() {
  await Promise.all([
    productStore.fetchProducts(effectiveBranchId.value ?? null),
    inventoryStore.fetchInventory(effectiveBranchId.value ?? null),
  ])
}

function stockForProduct(productId: string): number {
  const b = effectiveBranchId.value
  if (!b) return 0
  const rows = inventoryStore.rows as { product_id: string; branch_id: string; stock: number }[]
  const row = rows.find((r) => r.product_id === productId && r.branch_id === b)
  return row?.stock ?? 0
}

function lineQty(productId: string) {
  return quantities[productId] ?? 0
}

function incrementQty(p: Product) {
  const cur = quantities[p.id] ?? 0
  const stock = stockForProduct(p.id)
  if (cur >= stock) {
    toast.push('Not enough stock for this branch', 'error')
    return
  }
  quantities[p.id] = cur + 1
}

function decrementQty(p: Product) {
  const cur = quantities[p.id] ?? 0
  if (cur <= 0) return
  quantities[p.id] = cur - 1
}

const availableSubcategories = computed(() => {
  const base =
    categoryFilter.value === 'all'
      ? productStore.products
      : productStore.products.filter((p) => p.category_id === categoryFilter.value)
  const map = new Map<string, string>()
  for (const p of base) {
    if (!p.subcategory_id) continue
    map.set(p.subcategory_id, p.subcategories?.name ?? 'Subcategory')
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})
const availableCategories = computed(() => {
  const map = new Map<string, string>()
  for (const p of productStore.products) {
    if (!p.category_id) continue
    map.set(p.category_id, p.categories?.name ?? 'Category')
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const filteredProducts = computed(() => {
  let list = productStore.products
  const c = categoryFilter.value
  const s = subcategoryFilter.value
  if (c !== 'all') list = list.filter((p) => p.category_id === c)
  if (s !== 'all') list = list.filter((p) => p.subcategory_id === s)
  return list
})

const cartLines = computed(() => {
  const lines: { product: Product; qty: number }[] = []
  for (const p of productStore.products) {
    const q = quantities[p.id] ?? 0
    if (q > 0) lines.push({ product: p, qty: q })
  }
  return lines
})

const cartTotal = computed(() =>
  cartLines.value.reduce((sum, line) => {
    const unit = line.product.price != null ? Number(line.product.price) : 0
    return sum + unit * line.qty
  }, 0),
)

const cartLineCount = computed(() => cartLines.value.reduce((s, l) => s + l.qty, 0))

function clearCart() {
  for (const k of Object.keys(quantities)) quantities[k] = 0
}

onMounted(async () => {
  await loadProfile()
  await loadBranches()
  await productStore.fetchCategories()
  await refreshBranchData()
})

watch(ownerFocusBranchId, async () => {
  if (!isOwner.value) return
  clearCart()
  categoryFilter.value = 'all'
  subcategoryFilter.value = 'all'
  await refreshBranchData()
})

watch(branchId, async () => {
  if (isOwner.value) return
  clearCart()
  categoryFilter.value = 'all'
  subcategoryFilter.value = 'all'
  await refreshBranchData()
})

watch(categoryFilter, () => {
  subcategoryFilter.value = 'all'
})

async function submitSale() {
  const b = effectiveBranchId.value
  if (!b) {
    toast.push(isOwner.value ? 'Select a branch in the sidebar' : 'You are not assigned to a branch', 'error')
    return
  }
  const payloads = cartLines.value.map((l) => ({
    product_id: l.product.id,
    branch_id: b,
    quantity: l.qty,
  }))
  if (payloads.length === 0) {
    toast.push('Use + on products to add quantities, then complete the sale', 'error')
    return
  }
  busy.value = true
  try {
    const { count } = await createSalesBatch(payloads)
    await Swal.fire({
      icon: 'success',
      title: 'Sale recorded',
      text: `${count} line item(s) saved. Stock updated.`,
      timer: 1300,
      showConfirmButton: false,
    })
    clearCart()
    await refreshBranchData()
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Sale failed', text: e instanceof Error ? e.message : 'Sale failed' })
  } finally {
    busy.value = false
  }
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function resolveProductImageUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) return v
  const path = v.replace(/^\/+/, '')
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl || null
}

function productCardBackgroundStyle(raw: string | null | undefined) {
  const url = resolveProductImageUrl(raw)
  if (!url) return {}
  return { backgroundImage: `url("${url.replace(/"/g, '%22')}")` }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 pb-32 md:pb-8">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">🧾 Point of sale</h1>
      <p class="text-sm text-brand-700">
        <span v-if="isOwner">Choose a category (or all), tap + to add quantities, then complete one sale for the whole cart.</span>
        <span v-else>Same flow — your branch is fixed. Stock is checked per line.</span>
      </p>
    </div>

    <div v-if="isOwner && ownerFocusBranchId" class="rounded-lg border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900">
      Selling for:
      <span class="font-semibold">{{ branches.find((x) => x.id === ownerFocusBranchId)?.name ?? '—' }}</span>
    </div>
    <div v-else-if="!isOwner" class="rounded-lg border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900">
      Your branch:
      <span class="font-semibold">{{ branches.find((x) => x.id === branchId)?.name ?? 'Not assigned' }}</span>
    </div>

    <div class="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm md:p-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-0">
        <div class="w-full md:w-auto">
          <label class="text-sm font-medium text-brand-900">Category</label>
          <select
            v-model="categoryFilter"
            class="mt-2 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2.5 text-sm"
            :disabled="isOwner && !ownerFocusBranchId"
          >
            <option value="all">All categories</option>
            <option v-for="c in availableCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="w-full md:w-auto">
          <label class="text-sm font-medium text-brand-900">Subcategory</label>
          <select
            v-model="subcategoryFilter"
            class="mt-2 w-full md:w-64 rounded-lg border border-brand-300 px-3 py-2.5 text-sm"
            :disabled="isOwner && !ownerFocusBranchId"
          >
            <option value="all">All subcategories</option>
            <option v-for="s in availableSubcategories" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="isOwner ? ownerFocusBranchId : branchId" class="space-y-4">
      <p class="text-sm text-brand-700">
        {{ filteredProducts.length }} product(s) in this view · Tap <span class="font-semibold">+</span> to add to this sale.
      </p>

      <div
        v-if="filteredProducts.length === 0"
        class="rounded-xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center text-sm text-brand-600"
      >
        No products in this category for this branch.
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="p in filteredProducts"
          :key="p.id"
          class="relative flex h-[220px] flex-col overflow-hidden rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <div
            v-if="resolveProductImageUrl(p.image_url)"
            class="pointer-events-none absolute inset-0 bg-cover bg-center opacity-55"
            :style="productCardBackgroundStyle(p.image_url)"
          />
          <div
            v-if="resolveProductImageUrl(p.image_url)"
            class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/55 to-white/75"
          />
          <div class="relative min-w-0 flex-1">
            <h3 class="font-semibold leading-snug text-brand-950">{{ p.name }}</h3>
            <p v-if="p.categories?.name" class="mt-0.5 text-xs text-brand-600">{{ p.categories.name }}</p>
            <p class="mt-2 text-lg font-semibold tabular-nums text-brand-900">
              {{ p.price != null ? `₱${formatMoney(Number(p.price))}` : '—' }}
            </p>
            <p class="mt-1 text-xs text-brand-600">
              Stock:
              <span class="font-medium text-brand-800">{{ stockForProduct(p.id) }}</span>
            </p>
          </div>

          <div class="relative mt-4 flex items-end justify-between gap-3 border-t border-brand-200 pt-3">
            <button
              type="button"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-400 text-xl font-bold leading-none text-brand-950 shadow hover:bg-brand-300 disabled:opacity-40"
              :disabled="stockForProduct(p.id) <= 0 || busy"
              aria-label="Add one"
              @click="incrementQty(p)"
            >
              +
            </button>
            <div class="flex flex-1 items-center justify-end gap-2">
              <span v-if="lineQty(p.id) > 0" class="text-sm tabular-nums text-brand-800">× {{ lineQty(p.id) }}</span>
              <button
                v-if="lineQty(p.id) > 0"
                type="button"
                class="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
                :disabled="busy"
                aria-label="Remove one"
                @click="decrementQty(p)"
              >
                −
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div
      v-else
      class="rounded-xl border border-dashed border-brand-200 bg-white px-6 py-8 text-center text-sm text-brand-600"
    >
      <span v-if="isOwner">Select a branch in the sidebar to sell.</span>
      <span v-else>Branch not available.</span>
    </div>

    <div
      v-if="cartLineCount > 0"
      class="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border border-brand-300 bg-white p-4 shadow-xl md:static md:z-0 md:border-brand-200 md:shadow-sm"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-brand-700">This sale</h2>
      <ul class="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
        <li v-for="line in cartLines" :key="line.product.id" class="flex justify-between gap-2 text-brand-900">
          <span class="min-w-0 truncate">{{ line.product.name }} × {{ line.qty }}</span>
          <span class="shrink-0 tabular-nums text-brand-800">
            {{
              line.product.price != null
                ? `₱${formatMoney(Number(line.product.price) * line.qty)}`
                : '—'
            }}
          </span>
        </li>
      </ul>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3">
        <p class="text-base font-bold text-brand-950">
          Total
          <span class="tabular-nums">{{ `₱${formatMoney(cartTotal)}` }}</span>
        </p>
        <button
          type="button"
          class="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-brand-950 shadow hover:bg-brand-400 disabled:opacity-60"
          :disabled="busy"
          @click="submitSale"
        >
          {{ busy ? 'Processing…' : '🧾 Complete sale' }}
        </button>
      </div>
    </div>
  </div>
</template>

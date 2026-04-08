<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { format } = useMoney()
const { ownerFocusBranchId, isOwner, branchId, loadProfile, loadBranches } = useAuth()
const productStore = useProductStore()
const inventoryStore = useInventoryStore()
const salesStore = useSalesStore()
const config = useRuntimeConfig()
const toast = useToast()

const stats = ref<Awaited<ReturnType<typeof salesStore.computeDashboard>> | null>(null)
const weeklySeries = ref<{ day: string; revenue: number }[]>([])
const topProducts = ref<{ name: string; revenue: number }[]>([])
const filteredSalesRows = ref<typeof salesStore.sales>([])
const currentInventoryRows = ref<typeof inventoryStore.rows>([])
const thresholdValue = Number(config.public.lowStockThreshold ?? 10)
const lowStockModalOpen = ref(false)
const lowStockPage = ref(1)
const lowStockPageSize = 12
const loading = ref(true)

async function loadDashboard() {
  loading.value = true
  try {
    await loadProfile()
    await loadBranches()
    await Promise.all([productStore.fetchProducts(), inventoryStore.fetchInventory(), salesStore.fetchSales(isOwner.value ? undefined : { branchOnly: true })])
    const priceMap = new Map(productStore.products.map((p) => [p.id, p.price]))
    const threshold = thresholdValue
    let inv = inventoryStore.rows
    if (isOwner.value && ownerFocusBranchId.value) {
      inv = inv.filter((r) => r.branch_id === ownerFocusBranchId.value)
    }
    currentInventoryRows.value = inv
    stats.value = await salesStore.computeDashboard(priceMap, inv, threshold)
    const filteredSales = salesStore.sales.filter((s) =>
      isOwner.value ? !ownerFocusBranchId.value || s.branch_id === ownerFocusBranchId.value : s.branch_id === branchId.value,
    )
    filteredSalesRows.value = filteredSales
    const today = new Date()
    const keys: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      keys.push(d.toISOString().slice(0, 10))
    }
    const dayMap = new Map(keys.map((k) => [k, 0]))
    const prodMap = new Map<string, number>()
    for (const s of filteredSales) {
      const key = new Date(s.created_at).toISOString().slice(0, 10)
      if (dayMap.has(key)) {
        const rev = (typeof s.products?.price === 'number' ? s.products.price : 0) * s.quantity
        dayMap.set(key, (dayMap.get(key) || 0) + rev)
      }
      const n = s.products?.name ?? 'Unknown'
      const rev2 = (typeof s.products?.price === 'number' ? s.products.price : 0) * s.quantity
      prodMap.set(n, (prodMap.get(n) || 0) + rev2)
    }
    weeklySeries.value = keys.map((k) => ({
      day: k.slice(5),
      revenue: dayMap.get(k) || 0,
    }))
    topProducts.value = [...prodMap.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to load dashboard', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)

watch(ownerFocusBranchId, () => {
  if (isOwner.value) loadDashboard()
})

const lowStockRows = computed(() =>
  currentInventoryRows.value
    .filter((r) => r.stock <= thresholdValue)
    .map((r) => ({
      id: r.id,
      product_name: r.products?.name ?? 'Product',
      branch_name: r.branches?.name ?? 'Branch',
      stock: r.stock,
    }))
    .sort((a, b) => a.stock - b.stock),
)

const lowStockTotalPages = computed(() => Math.max(1, Math.ceil(lowStockRows.value.length / lowStockPageSize)))
const pagedLowStockRows = computed(() => {
  const start = (lowStockPage.value - 1) * lowStockPageSize
  return lowStockRows.value.slice(start, start + lowStockPageSize)
})

const transactionCount = computed(() => filteredSalesRows.value.length)
const unitsSold = computed(() => filteredSalesRows.value.reduce((sum, s) => sum + s.quantity, 0))
const avgTicket = computed(() => {
  const tx = transactionCount.value
  const revenue = stats.value?.weeklyTotal ?? 0
  return tx > 0 ? revenue / tx : 0
})
const topProductSharePercent = computed(() => {
  const total = topProducts.value.reduce((s, p) => s + p.revenue, 0)
  if (total <= 0 || topProducts.value.length === 0) return 0
  return Math.round((topProducts.value[0].revenue / total) * 100)
})

</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">📊 Dashboard</h1>
      <p class="text-sm text-brand-700">
        <span v-if="isOwner">Overview of sales and stock health.</span>
        <span v-else>Overview for your assigned branch.</span>
      </p>
    </div>

    <div v-if="loading" class="text-brand-700">Loading…</div>

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-xl border-0 border-l-4 border-l-yellow-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-yellow-700">Today revenue</p>
        <p class="mt-2 text-2xl font-bold text-yellow-800">{{ format(stats?.dailyTotal ?? 0) }}</p>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-amber-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-amber-700">Last 7 days revenue</p>
        <p class="mt-2 text-2xl font-bold text-amber-800">{{ format(stats?.weeklyTotal ?? 0) }}</p>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-lime-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-lime-700">Low stock</p>
        <button type="button" class="mt-2 text-2xl font-bold text-lime-800 hover:underline" @click="lowStockModalOpen = true">
          {{ lowStockRows.length }} SKUs
        </button>
        <button type="button" class="mt-3 rounded border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-900 hover:bg-brand-50" @click="lowStockModalOpen = true">View items</button>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-sky-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-sky-700">Transactions (7d)</p>
        <p class="mt-2 text-2xl font-bold text-sky-800">{{ transactionCount }}</p>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-violet-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-violet-700">Units sold (7d)</p>
        <p class="mt-2 text-2xl font-bold text-violet-800">{{ unitsSold }}</p>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-rose-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-rose-700">Avg ticket (7d)</p>
        <p class="mt-2 text-2xl font-bold text-rose-800">{{ format(avgTicket) }}</p>
      </div>
    </div>

    <div v-if="!loading" class="grid gap-4 md:grid-cols-2">
      <div class="rounded-xl border-0 border-l-4 border-l-fuchsia-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-fuchsia-700">Top product share</p>
        <p class="mt-2 text-2xl font-bold text-fuchsia-800">{{ topProductSharePercent }}%</p>
        <div class="mt-3 h-2 rounded bg-brand-100">
          <div class="h-2 rounded bg-fuchsia-500" :style="{ width: `${Math.max(4, topProductSharePercent)}%` }" />
        </div>
      </div>
      <div class="rounded-xl border-0 border-l-4 border-l-orange-500 bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-orange-700">Low-stock pressure</p>
        <p class="mt-2 text-2xl font-bold text-orange-800">{{ lowStockRows.length }}</p>
        <div class="mt-3 h-2 rounded bg-brand-100">
          <div
            class="h-2 rounded bg-orange-500"
            :style="{ width: `${Math.min(100, lowStockRows.length * 8)}%` }"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border-0 bg-white shadow-sm">
        <div class="border-b border-brand-100 px-4 py-3">
          <h2 class="font-semibold text-brand-950">
            {{ isOwner ? 'Sales per branch (7 days)' : 'Sales trend (7 days)' }}
          </h2>
          <p class="text-xs text-brand-600">
            {{ isOwner ? 'Quantity and revenue from recorded prices' : 'Branch revenue day-by-day' }}
          </p>
        </div>
        <div v-if="isOwner" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-brand-100 text-sm">
            <thead class="bg-white">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
                <th class="px-4 py-2 text-right font-medium text-brand-800">Qty</th>
                <th class="px-4 py-2 text-right font-medium text-brand-800">Revenue</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-100">
              <tr v-for="b in stats?.byBranch ?? []" :key="b.branch_id">
                <td class="px-4 py-2 text-brand-900">{{ b.branch_name }}</td>
                <td class="px-4 py-2 text-right tabular-nums text-brand-900">{{ b.total_qty }}</td>
                <td class="px-4 py-2 text-right tabular-nums text-brand-900">{{ format(b.revenue) }}</td>
              </tr>
              <tr v-if="(stats?.byBranch?.length ?? 0) === 0">
                <td colspan="3" class="px-4 py-6 text-center text-brand-600">No sales in the last 7 days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="space-y-2 p-4">
          <div
            v-for="d in weeklySeries"
            :key="d.day"
            class="space-y-1"
          >
            <div class="flex items-center justify-between text-xs text-brand-700">
              <span>{{ d.day }}</span>
              <span>{{ format(d.revenue) }}</span>
            </div>
            <div class="h-2 rounded bg-brand-100">
              <div
                class="h-2 rounded bg-brand-500"
                :style="{ width: `${Math.max(6, (d.revenue / Math.max(...weeklySeries.map((x) => x.revenue), 1)) * 100)}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border-0 bg-white shadow-sm">
        <div class="border-b border-brand-100 px-4 py-3">
          <h2 class="font-semibold text-brand-950">{{ isOwner ? 'Low stock alerts' : 'Top products (revenue)' }}</h2>
          <p class="text-xs text-brand-600">{{ isOwner ? 'Across both branches' : 'Current branch mix' }}</p>
        </div>
        <div v-if="isOwner" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-brand-100 text-sm">
            <thead class="bg-white">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-brand-800">Product</th>
                <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
                <th class="px-4 py-2 text-right font-medium text-brand-800">Stock</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-100">
              <tr v-for="(r, idx) in stats?.lowStock ?? []" :key="idx">
                <td class="px-4 py-2 text-brand-900">{{ r.product_name }}</td>
                <td class="px-4 py-2 text-brand-800">{{ r.branch_name }}</td>
                <td class="px-4 py-2 text-right font-semibold text-amber-800">{{ r.stock }}</td>
              </tr>
              <tr v-if="(stats?.lowStock?.length ?? 0) === 0">
                <td colspan="3" class="px-4 py-6 text-center text-brand-600">No low-stock rows</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="space-y-2 p-4">
          <div v-for="p in topProducts" :key="p.name" class="space-y-1">
            <div class="flex items-center justify-between text-xs text-brand-700">
              <span class="truncate">{{ p.name }}</span>
              <span>{{ format(p.revenue) }}</span>
            </div>
            <div class="h-2 rounded bg-brand-100">
              <div
                class="h-2 rounded bg-amber-500"
                :style="{ width: `${Math.max(8, (p.revenue / Math.max(...topProducts.map((x) => x.revenue), 1)) * 100)}%` }"
              />
            </div>
          </div>
          <p v-if="topProducts.length === 0" class="text-sm text-brand-600">No sales data yet.</p>
        </div>
      </div>
    </div>

    <div v-if="lowStockModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-brand-200 bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-brand-950">Low stock items</h2>
          </div>
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50" @click="lowStockModalOpen = false">Close</button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-brand-100 text-sm">
            <thead class="bg-white">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-brand-800">Product</th>
                <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
                <th class="px-4 py-2 text-right font-medium text-brand-800">Stock</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-100">
              <tr v-for="r in pagedLowStockRows" :key="r.id">
                <td class="px-4 py-2 text-brand-900">{{ r.product_name }}</td>
                <td class="px-4 py-2 text-brand-800">{{ r.branch_name }}</td>
                <td class="px-4 py-2 text-right font-semibold text-amber-800">{{ r.stock }}</td>
              </tr>
              <tr v-if="pagedLowStockRows.length === 0">
                <td colspan="3" class="px-4 py-8 text-center text-brand-600">No low-stock items.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <p class="text-brand-700">Page {{ lowStockPage }} of {{ lowStockTotalPages }}</p>
          <div class="flex gap-2">
            <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="lowStockPage <= 1" @click="lowStockPage -= 1">Prev</button>
            <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="lowStockPage >= lowStockTotalPages" @click="lowStockPage += 1">Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

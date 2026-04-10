<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { isOwner, loadProfile, loadBranches, branchId } = useAuth()
const { format } = useMoney()
const { sales, loading, fetchSales } = useSales()
const page = ref(1)
const pageSize = ref(10)
const searchTerm = ref('')
const selectedTx = ref<{
  txCode: string
  created_at: string
  branch_name: string
  products: string[]
  total_qty: number
  total_amount: number
} | null>(null)

function productsPreview(products: string[]) {
  const joined = products.join(', ')
  const max = 70
  if (joined.length <= max) return joined
  return `${joined.slice(0, max)}...`
}

onMounted(async () => {
  await loadProfile()
  await loadBranches()
  await fetchSales(isOwner.value ? undefined : { branchOnly: true })
})

const groupedSales = computed(() => {
  const map = new Map<
    string,
    {
      txCode: string
      created_at: string
      branch_name: string
      products: string[]
      total_qty: number
      total_amount: number
    }
  >()

  for (const s of sales.value) {
    const txCode = s.transaction_code ?? s.id
    const lineUnit =
      typeof s.unit_price === 'number'
        ? s.unit_price
        : typeof s.products?.price === 'number'
          ? s.products.price
          : 0
    const lineTotal = lineUnit * s.quantity
    const productLabel = `${s.products?.name ?? 'Unknown'} x${s.quantity}`
    const existing = map.get(txCode)
    if (existing) {
      existing.products.push(productLabel)
      existing.total_qty += s.quantity
      existing.total_amount += lineTotal
      continue
    }
    map.set(txCode, {
      txCode,
      created_at: s.created_at,
      branch_name: s.branches?.name ?? '—',
      products: [productLabel],
      total_qty: s.quantity,
      total_amount: lineTotal,
    })
  }

  return [...map.values()]
})

const filteredSales = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return groupedSales.value
  return groupedSales.value.filter((s) =>
    [s.txCode, s.products.join(' '), s.branch_name, new Date(s.created_at).toLocaleString()].join(' ').toLowerCase().includes(q),
  )
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredSales.value.length / pageSize.value)))
const pagedSales = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredSales.value.slice(start, start + pageSize.value)
})
const showingFrom = computed(() => (filteredSales.value.length === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const showingTo = computed(() => Math.min(page.value * pageSize.value, filteredSales.value.length))

watch([sales, searchTerm, pageSize], () => {
  if (page.value < 1) page.value = 1
  if (page.value > totalPages.value) page.value = totalPages.value
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">📈 Sales history</h1>
      <p class="text-sm text-brand-700">
        <span v-if="isOwner">All transactions.</span>
        <span v-else>All transactions for your assigned branch.</span>
      </p>
    </div>

    <div v-if="!isOwner && !branchId" class="rounded-lg border border-dashed border-brand-300 bg-white px-4 py-3 text-sm text-brand-700">
      You are not assigned to a branch yet. Ask owner to assign your account in Team.
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
          <input v-model="searchTerm" type="text" placeholder="Search date, product, branch..." class="mt-1 w-full md:w-80 rounded-lg border border-brand-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-brand-100 text-sm">
          <thead class="bg-white">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Sales ID</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">When</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Products</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Qty</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Transaction total</th>
              <th class="px-4 py-2 text-center font-medium text-brand-800">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-100">
            <tr v-for="s in pagedSales" :key="s.txCode">
              <td class="whitespace-nowrap px-4 py-2 font-semibold text-brand-900">{{ s.txCode }}</td>
              <td class="whitespace-nowrap px-4 py-2 text-brand-800">
                {{ new Date(s.created_at).toLocaleString() }}
              </td>
              <td class="max-w-[320px] px-4 py-2 font-medium text-brand-950">
                <span :title="s.products.join(', ')">{{ productsPreview(s.products) }}</span>
              </td>
              <td class="px-4 py-2 text-brand-800">{{ s.branch_name }}</td>
              <td class="px-4 py-2 text-right tabular-nums">{{ s.total_qty }}</td>
              <td class="px-4 py-2 text-right tabular-nums text-brand-900">
                {{ format(s.total_amount) }}
              </td>
              <td class="px-4 py-2 text-center">
                <button
                  type="button"
                  class="rounded border border-brand-300 px-2 py-1 text-sm text-brand-900 hover:bg-brand-50"
                  aria-label="View transaction details"
                  title="View transaction details"
                  @click="selectedTx = s"
                >
                  👁
                </button>
              </td>
            </tr>
            <tr v-if="!loading && filteredSales.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-brand-600">No sales yet</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-4 py-3 text-sm">
        <p class="text-brand-700">Showing {{ showingFrom }} to {{ showingTo }} of {{ filteredSales.length }} entries</p>
        <div class="flex gap-2">
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page <= 1" @click="page -= 1">Prev</button>
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page >= totalPages" @click="page += 1">Next</button>
        </div>
      </div>
    </div>

    <div v-if="selectedTx" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-2xl rounded-2xl border border-brand-200 bg-white p-5 shadow-2xl">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-brand-950">Transaction {{ selectedTx.txCode }}</h2>
            <p class="text-xs text-brand-700">{{ new Date(selectedTx.created_at).toLocaleString() }} · {{ selectedTx.branch_name }}</p>
          </div>
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50" @click="selectedTx = null">Close</button>
        </div>
        <ul class="max-h-72 space-y-1 overflow-y-auto rounded border border-brand-100 p-3 text-sm">
          <li v-for="(item, idx) in selectedTx.products" :key="idx" class="text-brand-900">{{ item }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

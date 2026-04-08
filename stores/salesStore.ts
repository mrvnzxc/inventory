import type { InventoryRow, Sale } from '~/types/models'

function postgrestErrorMessage(err: {
  message?: string
  details?: string | null
  hint?: string | null
}): string {
  const parts = [err.message, err.details, err.hint].filter((p) => p != null && String(p).trim() !== '')
  return parts.length ? parts.join(' — ') : 'Database request failed'
}

export interface DashboardStats {
  dailyTotal: number
  weeklyTotal: number
  byBranch: { branch_id: string; branch_name: string; total_qty: number; revenue: number }[]
  lowStock: { product_name: string; branch_name: string; stock: number }[]
}

export const useSalesStore = defineStore('sales', () => {
  const sales = ref<Sale[]>([])
  const loading = ref(false)

  async function fetchSales(options?: { mineOnly?: boolean; branchOnly?: boolean }) {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    const authStore = useAuthStore()
    loading.value = true
    try {
      let q = supabase
        .from('sales')
        .select(
          `
          id,
          product_id,
          branch_id,
          quantity,
          sold_by,
          created_at,
          products (name, price),
          branches (name)
        `,
        )
        .order('created_at', { ascending: false })
      if (options?.mineOnly && user.value) {
        q = q.eq('sold_by', user.value.id)
      }
      if (options?.branchOnly && authStore.branchId) {
        q = q.eq('branch_id', authStore.branchId)
      }
      const { data, error } = await q
      if (error) throw error
      sales.value = (data ?? []) as Sale[]
    } finally {
      loading.value = false
    }
  }

  async function createSale(payload: { product_id: string; branch_id: string; quantity: number }) {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    if (!user.value) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('sales')
      .insert({
        product_id: payload.product_id,
        branch_id: payload.branch_id,
        quantity: payload.quantity,
        sold_by: user.value.id,
      })
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  /**
   * Record multiple line items in one request (single transaction on the server).
   */
  async function createSalesBatch(payloads: { product_id: string; branch_id: string; quantity: number }[]) {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    if (!user.value) throw new Error('Not signed in')
    const rows = payloads.filter((p) => p.quantity > 0)
    if (rows.length === 0) return { count: 0 }
    const insertRows = rows.map((p) => ({
      product_id: p.product_id,
      branch_id: p.branch_id,
      quantity: p.quantity,
      sold_by: user.value.id,
    }))
    const { error } = await supabase.from('sales').insert(insertRows)
    if (error) throw new Error(postgrestErrorMessage(error))
    return { count: rows.length }
  }

  async function computeDashboard(
    productPriceMap: Map<string, number | null>,
    inventoryRows: InventoryRow[],
    threshold: number,
  ): Promise<DashboardStats> {
    const supabase = useSupabaseClient()
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: daySales, error: e1 } = await supabase
      .from('sales')
      .select('product_id, quantity')
      .gte('created_at', startOfDay)
    if (e1) throw e1

    const { data: weekSales, error: e2 } = await supabase
      .from('sales')
      .select('product_id, quantity, branch_id, branches(name)')
      .gte('created_at', weekAgo)
    if (e2) throw e2

    const sumRevenue = (rows: { product_id: string; quantity: number }[]) =>
      rows.reduce((acc, r) => {
        const p = productPriceMap.get(r.product_id)
        const unit = typeof p === 'number' ? p : 0
        return acc + unit * r.quantity
      }, 0)

    const dailyTotal = sumRevenue(daySales ?? [])

    const branchMap = new Map<string, { branch_name: string; total_qty: number; revenue: number }>()
    for (const r of weekSales ?? []) {
      const b = r as { branch_id: string; quantity: number; product_id: string; branches?: { name?: string } }
      const name = b.branches?.name ?? 'Branch'
      const cur = branchMap.get(b.branch_id) ?? { branch_name: name, total_qty: 0, revenue: 0 }
      cur.total_qty += b.quantity
      const price = productPriceMap.get(b.product_id)
      cur.revenue += (typeof price === 'number' ? price : 0) * b.quantity
      branchMap.set(b.branch_id, cur)
    }

    const byBranch = [...branchMap.entries()].map(([branch_id, v]) => ({
      branch_id,
      branch_name: v.branch_name,
      total_qty: v.total_qty,
      revenue: v.revenue,
    }))

    const weeklyTotal = sumRevenue(weekSales ?? [])

    const lowStock = inventoryRows
      .filter((r) => r.stock <= threshold)
      .map((r) => ({
        product_name: r.products?.name ?? 'Product',
        branch_name: r.branches?.name ?? 'Branch',
        stock: r.stock,
      }))
      .slice(0, 12)

    return {
      dailyTotal,
      weeklyTotal,
      byBranch,
      lowStock,
    }
  }

  return {
    sales,
    loading,
    fetchSales,
    createSale,
    createSalesBatch,
    computeDashboard,
  }
})

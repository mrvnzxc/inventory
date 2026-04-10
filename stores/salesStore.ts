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
          transaction_code,
          product_id,
          branch_id,
          quantity,
          unit_price,
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
    const { data: txCode, error: txErr } = await supabase.rpc('next_sales_transaction_code')
    if (txErr) throw new Error(postgrestErrorMessage(txErr))
    const { data, error } = await supabase
      .from('sales')
      .insert({
        transaction_code: txCode,
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
    const { data: txCode, error: txErr } = await supabase.rpc('next_sales_transaction_code')
    if (txErr) throw new Error(postgrestErrorMessage(txErr))
    const insertRows = rows.map((p) => ({
      transaction_code: txCode,
      product_id: p.product_id,
      branch_id: p.branch_id,
      quantity: p.quantity,
      sold_by: user.value.id,
    }))
    const { error } = await supabase.from('sales').insert(insertRows)
    if (error) throw new Error(postgrestErrorMessage(error))
    return { count: rows.length }
  }

  async function computeDashboard(inventoryRows: InventoryRow[], threshold: number): Promise<DashboardStats> {
    const supabase = useSupabaseClient()
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: daySales, error: e1 } = await supabase
      .from('sales')
      .select('product_id, quantity, unit_price, products(price)')
      .gte('created_at', startOfDay)
    if (e1) throw e1

    const { data: weekSales, error: e2 } = await supabase
      .from('sales')
      .select('product_id, quantity, unit_price, branch_id, branches(name), products(price)')
      .gte('created_at', weekAgo)
    if (e2) throw e2

    const sumRevenue = (rows: { product_id: string; quantity: number; unit_price?: number | null; products?: { price?: number | null } | null }[]) =>
      rows.reduce((acc, r) => {
        const unit =
          typeof r.unit_price === 'number'
            ? r.unit_price
            : typeof r.products?.price === 'number'
              ? r.products.price
              : 0
        return acc + unit * r.quantity
      }, 0)

    const dailyTotal = sumRevenue(daySales ?? [])

    const branchMap = new Map<string, { branch_name: string; total_qty: number; revenue: number }>()
    for (const r of weekSales ?? []) {
      const b = r as { branch_id: string; quantity: number; product_id: string; branches?: { name?: string } }
      const name = b.branches?.name ?? 'Branch'
      const cur = branchMap.get(b.branch_id) ?? { branch_name: name, total_qty: 0, revenue: 0 }
      cur.total_qty += b.quantity
      const unit =
        typeof (b as { unit_price?: number | null }).unit_price === 'number'
          ? Number((b as { unit_price?: number | null }).unit_price)
          : typeof (b as { products?: { price?: number | null } }).products?.price === 'number'
            ? Number((b as { products?: { price?: number | null } }).products?.price)
            : 0
      cur.revenue += unit * b.quantity
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

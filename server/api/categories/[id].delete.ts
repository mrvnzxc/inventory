import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const categoryId = getRouterParam(event, 'id')
  if (!categoryId) {
    throw createError({ statusCode: 400, statusMessage: 'Category id is required' })
  }

  const config = useRuntimeConfig(event)
  const serviceKey = config.supabaseServiceRoleKey as string | undefined
  if (!serviceKey) {
    throw createError({
      statusCode: 501,
      statusMessage: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
    })
  }

  const authUser = await serverSupabaseUser(event)
  if (!authUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const sessionClient = await serverSupabaseClient(event)
  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single()
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }
  if (profile?.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owners can delete categories' })
  }

  const supabaseUrl =
    (config.public as { supabase?: { url?: string } }).supabase?.url ?? process.env.SUPABASE_URL
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL is not configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: cat, error: catError } = await admin
    .from('categories')
    .select('id, branch_id')
    .eq('id', categoryId)
    .single()
  if (catError || !cat) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id, deleted_at')
    .eq('category_id', categoryId)
  if (productsError) {
    throw createError({ statusCode: 500, statusMessage: productsError.message })
  }

  const active = (products ?? []).filter((p) => p.deleted_at == null)
  if (active.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete: ${active.length} active product(s) still use this category. Reassign or delete them on Products first.`,
    })
  }

  const { error: deleteError } = await admin.from('categories').delete().eq('id', categoryId)
  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return { ok: true }
})

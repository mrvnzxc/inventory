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

  const linked = products ?? []
  const active = linked.filter((p) => p.deleted_at == null)
  if (active.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete: ${active.length} active product(s) still use this category. Reassign or delete them on Products first.`,
    })
  }

  if (linked.length > 0) {
    let fallbackId: string | undefined
    const { data: fallback } = await admin
      .from('categories')
      .select('id')
      .eq('branch_id', cat.branch_id)
      .neq('id', categoryId)
      .order('name')
      .limit(1)

    fallbackId = fallback?.[0]?.id

    if (!fallbackId) {
      const { data: created, error: createError } = await admin
        .from('categories')
        .insert({ branch_id: cat.branch_id, name: 'General' })
        .select('id')
        .single()
      if (createError) {
        const { data: again } = await admin
          .from('categories')
          .select('id')
          .eq('branch_id', cat.branch_id)
          .neq('id', categoryId)
          .order('name')
          .limit(1)
        fallbackId = again?.[0]?.id
        if (!fallbackId) {
          throw createError({ statusCode: 500, statusMessage: createError.message })
        }
      } else {
        fallbackId = created?.id
      }
    }

    if (!fallbackId) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Could not find or create a fallback category',
      })
    }

    const { error: moveError } = await admin
      .from('products')
      .update({ category_id: fallbackId, subcategory_id: null })
      .eq('category_id', categoryId)
    if (moveError) {
      throw createError({ statusCode: 500, statusMessage: moveError.message })
    }

    const { data: stillLinked, error: checkError } = await admin
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1)
    if (checkError) {
      throw createError({ statusCode: 500, statusMessage: checkError.message })
    }
    if ((stillLinked?.length ?? 0) > 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Products still reference this category after reassignment',
      })
    }
  }

  const { error: deleteError } = await admin.from('categories').delete().eq('id', categoryId)
  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return { ok: true }
})

import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const serviceKey = config.supabaseServiceRoleKey as string | undefined
  if (!serviceKey) {
    throw createError({
      statusCode: 501,
      statusMessage: 'Admin signup not configured (set SUPABASE_SERVICE_ROLE_KEY)',
    })
  }

  const authUser = await serverSupabaseUser(event)
  if (!authUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const supabase = await serverSupabaseClient(event)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single()
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }
  if (profile?.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owners can create team members' })
  }

  const body = await readBody<{
    email?: string
    password?: string
    first_name?: string
    last_name?: string
  }>(event)
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 6 characters' })
  }

  const supabaseUrl =
    (config.public as { supabase?: { url?: string } }).supabase?.url ?? process.env.SUPABASE_URL
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL is not configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: body.first_name?.trim() || null,
      last_name: body.last_name?.trim() || null,
    },
  })
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  const userId = data.user?.id
  if (!userId) {
    throw createError({ statusCode: 500, statusMessage: 'User was created but no id was returned' })
  }

  return { userId }
})

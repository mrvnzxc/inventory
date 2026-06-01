<script setup lang="ts">
import Swal from 'sweetalert2'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()
const { listSalesmen, assignSalesman, loadBranches, branches } = useAuth()
const supabase = useSupabaseClient()
const toast = useToast()
const config = useRuntimeConfig()

const rows = ref<Awaited<ReturnType<typeof listSalesmen>>>([])
const busy = ref(false)
const creating = ref(false)
const createModalOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const searchTerm = ref('')
const createForm = reactive({
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  branch_id: '',
})
const editModalOpen = ref(false)
const editingMemberId = ref<string | null>(null)
const savingEdit = ref(false)
const editForm = reactive({
  first_name: '',
  last_name: '',
  email: '',
  branch_id: '',
})

onMounted(async () => {
  await authStore.loadProfile()
  if (!authStore.isOwner) {
    await navigateTo('/dashboard')
    return
  }
  await loadBranches()
  await refresh()
})

async function refresh() {
  rows.value = await listSalesmen()
}

const filteredRows = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) =>
    [
      r.first_name ?? '',
      r.last_name ?? '',
      r.email ?? '',
      branches.value.find((b) => b.id === r.branch_id)?.name ?? '',
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

watch([rows, searchTerm, pageSize], () => {
  if (page.value < 1) page.value = 1
  if (page.value > totalPages.value) page.value = totalPages.value
})

function openEdit(r: Awaited<ReturnType<typeof listSalesmen>>[number]) {
  editingMemberId.value = r.id
  editForm.first_name = r.first_name ?? ''
  editForm.last_name = r.last_name ?? ''
  editForm.email = r.email ?? ''
  editForm.branch_id = r.branch_id ?? ''
  editModalOpen.value = true
}

async function saveEditMember() {
  if (!editingMemberId.value) return
  savingEdit.value = true
  try {
    const { error: e1 } = await supabase
      .from('profiles')
      .update({
        first_name: editForm.first_name.trim() || null,
        last_name: editForm.last_name.trim() || null,
      })
      .eq('id', editingMemberId.value)
    if (e1) throw e1

    if (editForm.branch_id) {
      await assignSalesman(editingMemberId.value, editForm.branch_id)
    } else {
      const { error: e2 } = await supabase
        .from('salesman_branches')
        .delete()
        .eq('user_id', editingMemberId.value)
      if (e2) throw e2
    }

    await Swal.fire({ icon: 'success', title: 'Updated', text: 'Team member updated', timer: 1200, showConfirmButton: false })
    editModalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Update failed', text: e instanceof Error ? e.message : 'Failed' })
  } finally {
    savingEdit.value = false
  }
}

async function deleteTeamMember(userId: string) {
  const res = await Swal.fire({
    icon: 'warning',
    title: 'Delete team member?',
    text: 'This deletes the member profile record from app tables.',
    showCancelButton: true,
    confirmButtonText: 'Remove',
    confirmButtonColor: '#eab308',
  })
  if (!res.isConfirmed) return
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) throw error
    await Swal.fire({ icon: 'success', title: 'Deleted', text: 'Team member deleted', timer: 1200, showConfirmButton: false })
    await refresh()
  } catch (e: unknown) {
    await Swal.fire({ icon: 'error', title: 'Delete failed', text: e instanceof Error ? e.message : 'Failed' })
  }
}

async function createTeamMember() {
  const email = createForm.email.trim().toLowerCase()
  const password = createForm.password
  if (!email || !password) {
    toast.push('Email and password are required', 'error')
    return
  }
  if (password.length < 6) {
    toast.push('Password must be at least 6 characters', 'error')
    return
  }
  const supabaseUrl = String((config.public as { supabase?: { url?: string }; supabaseUrl?: string }).supabase?.url ?? (config.public as { supabaseUrl?: string }).supabaseUrl ?? '')
  const supabaseAnonKey = String((config.public as { supabase?: { key?: string }; supabaseKey?: string }).supabase?.key ?? (config.public as { supabaseKey?: string }).supabaseKey ?? '')
  if (!supabaseUrl || !supabaseAnonKey) {
    toast.push('Supabase URL/Key is missing in runtime config', 'error')
    return
  }
  const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')
  const emailRedirectTo = siteUrl ? `${siteUrl}/login` : ''
  creating.value = true
  try {
    const res = await $fetch<{ user?: { id?: string }; error_description?: string; msg?: string }>(
      `${supabaseUrl}/auth/v1/signup`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: {
          email,
          password,
          ...(emailRedirectTo
            ? {
                options: {
                  email_redirect_to: emailRedirectTo,
                },
              }
            : {}),
        },
      },
    )
    let newUserId = res?.user?.id
    if (!newUserId) {
      // Signup can succeed but return a payload without user.id.
      // Verify creation by checking profiles for the same email.
      for (let i = 0; i < 3 && !newUserId; i++) {
        await refresh()
        const created = rows.value.find((r) => (r.email ?? '').toLowerCase() === email)
        if (created?.id) {
          newUserId = created.id
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 350))
      }
    }
    if (!newUserId) {
      throw new Error(res?.error_description || res?.msg || 'Signup response was incomplete. Check Supabase Auth logs.')
    }
    const { error: ep } = await supabase
      .from('profiles')
      .update({
        first_name: createForm.first_name.trim() || null,
        last_name: createForm.last_name.trim() || null,
      })
      .eq('id', newUserId)
    if (ep) throw ep
    if (createForm.branch_id) {
      await assignSalesman(newUserId, createForm.branch_id)
    }
    await Swal.fire({ icon: 'success', title: 'Created', text: 'Team member account created', timer: 1300, showConfirmButton: false })
    createForm.first_name = ''
    createForm.last_name = ''
    createForm.email = ''
    createForm.password = ''
    createForm.branch_id = ''
    createModalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    const statusCode =
      typeof e === 'object' && e != null && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : NaN
    if (statusCode === 429) {
      await Swal.fire({
        icon: 'error',
        title: 'Rate limited',
        text: 'Too many signup requests. Wait a bit or increase Auth signup limit in Supabase.',
      })
    } else {
      await Swal.fire({ icon: 'error', title: 'Create failed', text: e instanceof Error ? e.message : 'Failed to create team member' })
    }
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div v-if="authStore.isOwner" class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">👥 Team</h1>
      <button
        type="button"
        class="mt-3 rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50"
        @click="createModalOpen = true"
      >
        ➕ Create team member
      </button>
    </div>

    <div v-if="createModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-2xl rounded-2xl border border-brand-200 bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-brand-950">New team member</h2>
          <button
            type="button"
            class="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            @click="createModalOpen = false"
          >
            Close
          </button>
        </div>
        <p class="mb-3 text-xs text-brand-600">
          Password is used only for Supabase Auth account creation; it is not stored in your app tables.
        </p>
        <form class="mt-3 grid gap-3 md:grid-cols-2" @submit.prevent="createTeamMember">
          <div>
            <label class="text-xs text-brand-700">First name</label>
            <input
              v-model="createForm.first_name"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
              placeholder="Juan"
            />
          </div>
          <div>
            <label class="text-xs text-brand-700">Last name</label>
            <input
              v-model="createForm.last_name"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
              placeholder="Dela Cruz"
            />
          </div>
          <div>
            <label class="text-xs text-brand-700">Email</label>
            <input
              v-model="createForm.email"
              type="email"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
              placeholder="staff@example.com"
            />
          </div>
          <div>
            <label class="text-xs text-brand-700">Password</label>
            <input
              v-model="createForm.password"
              type="password"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label class="text-xs text-brand-700">Assign branch (optional)</label>
            <select
              v-model="createForm.branch_id"
              class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
            >
              <option value="">Assign later</option>
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="flex items-end">
            <button
              type="submit"
              class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-400 disabled:opacity-60"
              :disabled="creating"
            >
              {{ creating ? 'Creating…' : 'Create member' }}
            </button>
          </div>
        </form>
      </div>
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
          <input v-model="searchTerm" type="text" placeholder="Search name, email, branch..." class="mt-1 w-full md:w-80 rounded-lg border border-brand-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-brand-100 text-sm">
          <thead class="bg-white">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Name</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Email</th>
              <th class="px-4 py-2 text-left font-medium text-brand-800">Branch</th>
              <th class="px-4 py-2 text-right font-medium text-brand-800">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-100">
            <tr v-for="r in pagedRows" :key="r.id">
              <td class="px-4 py-2 text-brand-900">
                {{ [r.first_name, r.last_name].filter(Boolean).join(' ') || '—' }}
              </td>
              <td class="px-4 py-2 text-brand-900">{{ r.email }}</td>
              <td class="px-4 py-2 text-brand-800">{{ branches.find((b) => b.id === r.branch_id)?.name ?? 'Unassigned' }}</td>
              <td class="px-4 py-2 text-right">
                <div class="flex justify-end gap-2">
                  <button type="button" class="rounded border border-brand-300 px-2 py-1 text-sm" title="Edit member" @click="openEdit(r)">✏️</button>
                  <button type="button" class="rounded border border-red-300 px-2 py-1 text-sm" title="Delete team member" :disabled="busy" @click="deleteTeamMember(r.id)">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-brand-600">No salesmen yet</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-4 py-3 text-sm">
        <p class="text-brand-700">Showing {{ showingFrom }} to {{ showingTo }} of {{ filteredRows.length }} entries</p>
        <div class="flex gap-2">
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page <= 1" @click="page -= 1">Prev</button>
          <button type="button" class="rounded border border-brand-300 px-3 py-1.5 text-brand-900 disabled:opacity-40" :disabled="page >= totalPages" @click="page += 1">Next</button>
        </div>
      </div>
    </div>

    <div v-if="editModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-xl rounded-2xl border border-brand-200 bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-brand-950">Edit team member</h2>
          <button type="button" class="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-50" @click="editModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="saveEditMember">
          <div>
            <label class="text-xs text-brand-700">First name</label>
            <input v-model="editForm.first_name" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs text-brand-700">Last name</label>
            <input v-model="editForm.last_name" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm" />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-brand-700">Email</label>
            <input v-model="editForm.email" disabled class="mt-1 w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700" />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-brand-700">Assigned branch</label>
            <select v-model="editForm.branch_id" class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <button type="submit" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-400 disabled:opacity-60" :disabled="savingEdit">
            {{ savingEdit ? 'Saving…' : 'Save changes' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

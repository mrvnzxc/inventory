<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const toast = useToast()

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const busy = ref(false)

async function changePassword() {
  const oldPassword = form.oldPassword.trim()
  const next = form.newPassword.trim()
  const confirm = form.confirmPassword.trim()
  if (!oldPassword || !next || !confirm) {
    toast.push('Enter old password and your new password details', 'error')
    return
  }
  if (next.length < 6) {
    toast.push('Password must be at least 6 characters', 'error')
    return
  }
  if (next !== confirm) {
    toast.push('Passwords do not match', 'error')
    return
  }
  busy.value = true
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) throw userErr
    const email = userData.user?.email
    if (!email) throw new Error('Unable to verify account email')

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    })
    if (verifyError) {
      toast.push('Old password is incorrect', 'error')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) throw error
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    toast.push('Password changed successfully', 'success')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Failed to change password', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-brand-950">🔐 Change password</h1>
      <p class="text-sm text-brand-700">
        Update your sign-in password for this account.
      </p>
    </div>

    <div class="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
      <form class="space-y-4" @submit.prevent="changePassword">
        <div>
          <label class="text-xs text-brand-700">Old password</label>
          <input
            v-model="form.oldPassword"
            type="password"
            autocomplete="current-password"
            class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
            placeholder="Enter current password"
          />
        </div>
        <div>
          <label class="text-xs text-brand-700">New password</label>
          <input
            v-model="form.newPassword"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label class="text-xs text-brand-700">Confirm new password</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
            placeholder="Re-enter password"
          />
        </div>
        <button
          type="submit"
          class="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-60"
          :disabled="busy"
        >
          {{ busy ? 'Updating…' : 'Update' }}
        </button>
      </form>
    </div>
  </div>
</template>

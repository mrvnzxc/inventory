<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const toast = useToast()

const form = reactive({
  newPassword: '',
  confirmPassword: '',
})
const busy = ref(false)

async function changePassword() {
  const next = form.newPassword.trim()
  const confirm = form.confirmPassword.trim()
  if (!next || !confirm) {
    toast.push('Enter and confirm your new password', 'error')
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
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) throw error
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
          class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-400 disabled:opacity-60"
          :disabled="busy"
        >
          {{ busy ? 'Updating…' : 'Update password' }}
        </button>
      </form>
    </div>
  </div>
</template>

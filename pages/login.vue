<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const busy = ref(false)
const { signIn } = useAuth()
const toast = useToast()

async function onSubmit() {
  busy.value = true
  try {
    await signIn(email.value.trim(), password.value)
    await navigateTo('/dashboard')
    toast.push('Welcome back', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Sign in failed'
    toast.push(msg, 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-white px-4">
    <div class="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-8 shadow-xl">
      <h1 class="text-2xl font-bold text-brand-950">Sign in</h1>
      <p class="mt-1 text-sm text-brand-700">Sales & Inventory — two-branch system</p>
      <form class="mt-8 space-y-4" @submit.prevent="onSubmit">
        <div>
          <label class="block text-sm font-medium text-brand-900">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-brand-950 outline-none ring-brand-400 focus:ring-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-brand-900">Password</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-brand-950 outline-none ring-brand-400 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          class="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-brand-950 shadow hover:bg-brand-400 disabled:opacity-60"
          :disabled="busy"
        >
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="mt-6 text-xs text-brand-600">
        First account: create the user in Supabase Auth, run the SQL schema, then set
        <code class="rounded bg-brand-100 px-1">profiles.role = 'owner'</code> for your user.
      </p>
    </div>
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const showPassword = ref(false)
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
  <div class="relative min-h-screen overflow-x-hidden bg-[#fffbeb]">
    <!-- Soft mesh — warm yellow / amber / cream -->
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/90 via-yellow-100/85 to-lime-100/70"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-yellow-300/45 blur-3xl"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-amber-400/40 blur-3xl"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#FEF08A]/60 blur-2xl"
      aria-hidden="true"
    />

    <!-- Decorative beauty / product silhouettes -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <!-- Lipstick -->
      <div
        class="login-float absolute left-[4%] top-[12%] w-16 opacity-[0.35] sm:left-[8%] sm:w-20 md:opacity-45"
        style="animation-delay: 0s"
      >
        <svg viewBox="0 0 64 120" class="h-auto w-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="22" y="8" width="20" height="48" rx="3" fill="#a16207" />
          <path d="M20 56h24v52H20z" fill="#fef9c3" />
          <rect x="18" y="104" width="28" height="10" rx="2" fill="#854d0e" />
          <ellipse cx="32" cy="8" rx="10" ry="6" fill="#eab308" />
        </svg>
      </div>
      <!-- Cream jar -->
      <div
        class="login-float-slow absolute right-[6%] top-[18%] w-20 opacity-[0.32] sm:right-[10%] sm:w-24 md:opacity-40"
        style="animation-delay: -2s"
      >
        <svg viewBox="0 0 80 88" class="h-auto w-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="40" cy="20" rx="28" ry="10" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.5" />
          <rect x="14" y="20" width="52" height="44" rx="6" fill="#fff" stroke="#ca8a04" stroke-width="1.5" />
          <rect x="22" y="64" width="36" height="8" rx="2" fill="#fef08a" />
          <path d="M28 36h24M28 46h18" stroke="#facc15" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <!-- Perfume bottle -->
      <div
        class="login-float absolute bottom-[22%] left-[10%] w-[4.5rem] opacity-[0.28] sm:w-[5.5rem] md:bottom-[28%] md:opacity-38"
        style="animation-delay: -1s"
      >
        <svg viewBox="0 0 72 100" class="h-auto w-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="4" width="12" height="14" rx="2" fill="#b45309" />
          <ellipse cx="36" cy="22" rx="8" ry="4" fill="#fef9c3" />
          <path
            d="M22 26h28c4 0 8 4 8 10v48c0 8-6 14-14 14H28c-8 0-14-6-14-14V36c0-6 4-10 8-10z"
            fill="#fff"
            fill-opacity="0.85"
            stroke="#ca8a04"
            stroke-width="1.5"
          />
          <ellipse cx="36" cy="88" rx="18" ry="6" fill="#fefce8" />
        </svg>
      </div>
      <!-- Compact / palette -->
      <div
        class="login-float-slow absolute bottom-[14%] right-[8%] w-24 opacity-[0.3] sm:right-[12%] sm:w-28 md:opacity-42"
        style="animation-delay: -3s"
      >
        <svg viewBox="0 0 96 64" class="h-auto w-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="12" width="88" height="44" rx="8" fill="#fff" fill-opacity="0.9" stroke="#ca8a04" stroke-width="1.5" />
          <circle cx="24" cy="34" r="10" fill="#eab308" />
          <circle cx="48" cy="34" r="10" fill="#facc15" />
          <circle cx="72" cy="34" r="10" fill="#fde047" />
          <rect x="36" y="4" width="24" height="10" rx="2" fill="#854d0e" />
        </svg>
      </div>
      <!-- Serum dropper -->
      <div
        class="login-float absolute right-[18%] top-[40%] hidden w-14 opacity-35 md:block lg:opacity-45"
        style="animation-delay: -1.5s"
      >
        <svg viewBox="0 0 48 120" class="h-auto w-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="4" width="12" height="28" rx="2" fill="#854d0e" />
          <path d="M24 32v48" stroke="#ca8a04" stroke-width="4" stroke-linecap="round" />
          <path d="M14 80h20l-4 36H18z" fill="#fff" fill-opacity="0.9" stroke="#ca8a04" stroke-width="1.2" />
          <ellipse cx="24" cy="108" rx="10" ry="6" fill="#fef9c3" />
        </svg>
      </div>
      <!-- Small lip gloss -->
      <div
        class="login-float-slow absolute left-[20%] bottom-[40%] hidden w-12 opacity-30 sm:block md:opacity-38"
        style="animation-delay: -2.5s"
      >
        <svg viewBox="0 0 40 96" class="h-auto w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="36" width="16" height="52" rx="3" fill="#fef9c3" stroke="#ca8a04" stroke-width="1" />
          <rect x="10" y="28" width="20" height="10" rx="2" fill="#a16207" />
          <path d="M20 8c-6 0-10 6-10 12v8h20v-8c0-6-4-12-10-12z" fill="#eab308" />
        </svg>
      </div>
    </div>

    <div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
      <div
        class="w-full max-w-[420px] rounded-3xl border border-yellow-100/80 bg-white/85 p-8 shadow-[0_24px_80px_-12px_rgba(180,83,9,0.12)] backdrop-blur-xl sm:p-10"
      >
        <div class="mb-8 text-center">
          <p
            class="inline-flex items-center gap-2 rounded-full bg-[#FEF9C3] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-900"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            Beauty inventory
          </p>
          <h1 class="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">Welcome back</h1>
          <p class="mt-2 text-sm text-neutral-600">Sign in to manage sales, stock, and branches.</p>
        </div>

        <form class="space-y-5" @submit.prevent="onSubmit">
          <div>
            <label for="login-email" class="block text-sm font-medium text-neutral-800">Email</label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="mt-1.5 w-full rounded-xl border border-yellow-200/90 bg-white/90 px-4 py-3 text-neutral-900 shadow-sm outline-none ring-yellow-400/35 transition placeholder:text-neutral-400 focus:border-amber-500 focus:ring-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label for="login-password" class="block text-sm font-medium text-neutral-800">Password</label>
            <div class="relative mt-1.5">
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="w-full rounded-xl border border-yellow-200/90 bg-white/90 py-3 pl-4 pr-12 text-neutral-900 shadow-sm outline-none ring-yellow-400/35 transition placeholder:text-neutral-400 focus:border-amber-500 focus:ring-2"
                placeholder="••••••••"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-neutral-500 outline-none transition hover:text-amber-800 focus-visible:ring-2 focus-visible:ring-yellow-400"
                :aria-pressed="showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <!-- eye open -->
                <svg
                  v-if="!showPassword"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.75"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <!-- eye slash -->
                <svg
                  v-else
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.75"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="submit"
            class="w-full rounded-xl bg-gradient-to-r from-[#EAB308] to-[#FACC15] px-4 py-3.5 text-sm font-semibold text-neutral-900 shadow-lg shadow-amber-500/30 transition hover:from-[#CA8A04] hover:to-[#EAB308] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="busy"
          >
            {{ busy ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
    <ToastHost />
  </div>
</template>

<style scoped>
.login-float {
  animation: login-float 7s ease-in-out infinite;
}
.login-float-slow {
  animation: login-float 10s ease-in-out infinite;
}
@keyframes login-float {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-12px) rotate(2deg);
  }
}
</style>

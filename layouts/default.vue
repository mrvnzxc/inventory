<script setup lang="ts">
const route = useRoute()
const { isOwner } = useAuth()
const mobileNavOpen = ref(false)
const sidebarCollapsed = ref(false)

const links = computed(() => {
  const base = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/sales', label: 'POS' },
    { to: '/sales/history', label: 'Sales history' },
  ]
  if (isOwner.value) base.push({ to: '/team', label: 'Team' })
  base.push({ to: '/account/password', label: 'Change password' })
  return base
})

function isActive(path: string) {
  if (path === '/sales') return route.path === '/sales'
  return route.path === path || route.path.startsWith(`${path}/`)
}

const breadcrumbLabelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  inventory: 'Inventory',
  sales: 'POS',
  history: 'Sales history',
  team: 'Team',
  account: 'Account',
  password: 'Change password',
}

const breadcrumbs = computed(() => {
  const clean = route.path.split('?')[0]
  const parts = clean.split('/').filter(Boolean)
  const out: { to: string; label: string }[] = [{ to: '/dashboard', label: 'Dashboard' }]
  let cur = ''
  for (const p of parts) {
    cur += `/${p}`
    if (cur === '/dashboard') continue
    out.push({
      to: cur,
      label: breadcrumbLabelMap[p] ?? p.charAt(0).toUpperCase() + p.slice(1),
    })
  }
  return out
})
</script>

<template>
  <div class="flex min-h-screen bg-white">
    <div
      v-if="mobileNavOpen"
      class="fixed inset-0 z-40 bg-black/30 md:hidden"
      @click="mobileNavOpen = false"
    />
    <div
      class="fixed inset-y-0 left-0 z-50 -translate-x-full transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0"
      :class="mobileNavOpen ? 'translate-x-0' : ''"
    >
      <AppSidebar :collapsed="sidebarCollapsed" @close="mobileNavOpen = false" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <header class="bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="flex min-w-0 items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-neutral-300 bg-[#FACC15] px-3 py-2 text-sm font-semibold text-black md:hidden"
              @click="mobileNavOpen = true"
            >
              ☰
            </button>
            <button
              type="button"
              class="hidden rounded-lg border border-neutral-300 bg-[#FACC15] px-3 py-2 text-sm font-semibold text-black hover:bg-[#EAB308] md:inline-flex"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              ☰
            </button>
          </div>
        </div>
        <div class="px-4 py-2">
          <div class="flex items-center gap-2 overflow-x-auto text-sm">
            <NuxtLink
              v-for="(b, idx) in breadcrumbs"
              :key="b.to"
              :to="b.to"
              class="shrink-0 rounded-md px-2 py-1 transition"
              :class="idx === breadcrumbs.length - 1 ? 'bg-[#FACC15] font-semibold text-black' : 'text-neutral-700 hover:bg-[#FEF9C3]'"
            >
              {{ idx > 0 ? ' / ' : '' }}{{ b.label }}
            </NuxtLink>
          </div>
        </div>
        <nav class="flex gap-2 overflow-x-auto px-4 py-2 md:hidden">
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
            :class="
              isActive(l.to)
                ? 'border-yellow-500 bg-[#FACC15] text-black'
                : 'border-neutral-300 bg-white text-neutral-800 hover:bg-[#FEF9C3]'
            "
            @click="mobileNavOpen = false"
          >
            {{ l.label }}
          </NuxtLink>
        </nav>
      </header>
      <main class="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-white p-3 sm:p-4 md:p-8">
        <div class="mx-auto w-full min-w-0 max-w-7xl">
          <slot />
        </div>
      </main>
    </div>
    <ToastHost />
  </div>
</template>

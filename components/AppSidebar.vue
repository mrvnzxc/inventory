<script setup lang="ts">
import { Icon } from '@iconify/vue'

const route = useRoute()
const { isOwner, branches, ownerFocusBranchId, setOwnerFocusBranch, loadBranches, signOut, profile } = useAuth()
const toast = useToast()
const emit = defineEmits<{ close: [] }>()
const props = withDefaults(defineProps<{ collapsed?: boolean }>(), {
  collapsed: false,
})
const signingOut = ref(false)

const links = computed(() => {
  const base = [
    { to: '/dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard-outline' },
    { to: '/products', label: 'Products', icon: 'mdi:package-variant-closed' },
    { to: '/inventory', label: 'Inventory', icon: 'mdi:warehouse' },
    { to: '/sales', label: 'POS', icon: 'mdi:cash-register' },
    { to: '/sales/history', label: 'Sales history', icon: 'mdi:chart-timeline-variant' },
  ]
  if (isOwner.value) {
    base.push({ to: '/team', label: 'Team', icon: 'mdi:account-group-outline' })
    base.push({ to: '/settings', label: 'Settings', icon: 'mdi:cog-outline' })
  }
  base.push({ to: '/account/password', label: 'Change password', icon: 'mdi:lock-reset' })
  return base
})

function isActive(path: string) {
  if (path === '/sales') {
    return route.path === '/sales'
  }
  return route.path === path || route.path.startsWith(`${path}/`)
}

onMounted(() => {
  loadBranches()
})

watch(isOwner, (v) => {
  if (v) loadBranches()
})

watch(
  () => route.fullPath,
  () => {
    emit('close')
  },
)

async function doSignOut() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await signOut()
    toast.push('Signed out', 'info')
  } catch (e: unknown) {
    toast.push(e instanceof Error ? e.message : 'Sign out failed', 'error')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <aside
    class="flex h-screen shrink-0 flex-col border-r border-neutral-300 bg-white transition-all duration-200"
    :class="props.collapsed ? 'w-20' : 'w-72'"
  >
    <div class="border-b border-brand-200 px-5 py-6">
      <div class="flex items-center justify-between gap-2">
        <div v-if="!props.collapsed" class="w-full text-center">
          <p class="text-lg font-bold leading-tight">
            <span class="text-[#a16207]">ReedGrey</span>
          </p>
        </div>
        <div v-else class="mx-auto rounded-lg bg-[#FACC15] px-2 py-1 text-xs font-bold text-black">
          <Icon icon="mdi:store-outline" class="h-5 w-5" />
        </div>
        <button
          type="button"
          class="rounded-md border border-brand-300 bg-white px-2 py-1 text-xs font-semibold text-brand-900 md:hidden"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>

    <div v-if="!props.collapsed && isOwner && branches.length" class="border-b border-brand-200 px-3 py-4">
      <p class="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">Branch</p>
      <div class="flex flex-col gap-1">
        <button
          v-for="b in branches"
          :key="b.id"
          type="button"
          class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"
          :class="
            ownerFocusBranchId === b.id
              ? 'bg-[#FACC15] text-black shadow-sm'
              : 'text-neutral-900 hover:bg-[#FEF08A]'
          "
          @click="setOwnerFocusBranch(b.id)"
        >
          <Icon icon="mdi:store-marker-outline" class="h-4 w-4 shrink-0" />
          <span class="truncate">{{ b.name }}</span>
        </button>
      </div>
    </div>

    <nav class="flex flex-1 flex-col gap-1 p-3">
      <NuxtLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="rounded-lg py-2.5 text-sm font-semibold transition"
        :title="props.collapsed ? l.label : ''"
        :class="[
          props.collapsed ? 'flex items-center justify-center px-2' : 'flex items-center gap-2 px-3',
          isActive(l.to)
            ? 'bg-[#FACC15] text-black shadow-sm'
            : 'text-neutral-900 hover:bg-[#FEF08A]',
        ]"
      >
        <Icon :icon="l.icon" class="h-5 w-5 shrink-0" />
        <span v-if="!props.collapsed" class="block truncate">{{ l.label }}</span>
      </NuxtLink>
    </nav>
    <div class="border-t border-brand-200 p-3">
      <div v-if="!props.collapsed" class="mb-2 text-xs text-brand-700">
        <p class="truncate font-semibold text-black">{{ profile?.email ?? 'User' }}</p>
      </div>
      <button
        type="button"
        class="w-full rounded-lg border border-yellow-500 bg-[#FACC15] px-3 py-2 text-xs font-semibold text-black hover:bg-[#EAB308]"
        :disabled="signingOut"
        @click="doSignOut"
      >
        <span v-if="props.collapsed">⎋</span>
        <span v-else>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
      </button>
    </div>
  </aside>
</template>

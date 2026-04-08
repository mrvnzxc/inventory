<script setup lang="ts">
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
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/sales', label: 'POS' },
    { to: '/sales/history', label: 'Sales history' },
  ]
  if (isOwner.value) {
    base.push({ to: '/team', label: 'Team' })
  }
  base.push({ to: '/account/password', label: 'Change password' })
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
        <div v-if="!props.collapsed">
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-700">Inventory</p>
          <p class="text-lg font-bold text-black">Branch POS</p>
        </div>
        <div v-else class="mx-auto rounded-lg bg-[#FACC15] px-2 py-1 text-xs font-bold text-black">POS</div>
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
          class="rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"
          :class="
            ownerFocusBranchId === b.id
              ? 'bg-[#FACC15] text-black shadow-sm'
              : 'text-neutral-900 hover:bg-[#FEF08A]'
          "
          @click="setOwnerFocusBranch(b.id)"
        >
          {{ b.name }}
        </button>
      </div>
    </div>

    <nav class="flex flex-1 flex-col gap-1 p-3">
      <NuxtLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="rounded-lg py-2.5 text-sm font-semibold transition"
        :class="[
          props.collapsed ? 'px-2 text-left text-[11px] leading-tight' : 'px-3',
          isActive(l.to)
            ? 'bg-[#FACC15] text-black shadow-sm'
            : 'text-neutral-900 hover:bg-[#FEF08A]',
        ]"
      >
        <span class="block break-words">{{ l.label }}</span>
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

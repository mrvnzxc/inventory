<script setup lang="ts">
const { toasts, dismiss } = useToast()

function ring(t: string) {
  if (t === 'success') return 'border-l-emerald-500 bg-white'
  if (t === 'error') return 'border-l-red-500 bg-white'
  return 'border-l-brand-500 bg-white'
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="pointer-events-auto rounded-lg border border-brand-200 shadow-lg"
      :class="ring(t.type)"
    >
      <div class="flex items-start gap-3 p-4">
        <p class="flex-1 text-sm text-brand-900">{{ t.message }}</p>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-100"
          @click="dismiss(t.id)"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>

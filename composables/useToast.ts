export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

export function useToast() {
  const toasts = useState<ToastItem[]>('app-toasts', () => [])

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(message: string, type: ToastType = 'info', durationMs = 4200) {
    const id =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    toasts.value = [...toasts.value, { id, message, type }]
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs)
    }
  }

  return { toasts, push, dismiss }
}

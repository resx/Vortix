import { create } from 'zustand'

export interface ToastItem {
  id: string
  type: 'success' | 'error'
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (type: 'success' | 'error', message: string) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = Date.now().toString(36)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

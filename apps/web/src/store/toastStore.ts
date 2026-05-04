import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

let idSeq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  pushToast: (message, variant = 'info') => {
    const id = `t-${++idSeq}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }].slice(-6) }));
    window.setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

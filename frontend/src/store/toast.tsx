"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; title: string; message?: string }

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, title: string, message?: string) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, title, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().push("success", title, message),
  error: (title: string, message?: string) => useToastStore.getState().push("error", title, message),
  info: (title: string, message?: string) => useToastStore.getState().push("info", title, message),
};

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-pine" />,
  error: <AlertTriangle className="h-5 w-5 text-destructive" />,
  info: <Info className="h-5 w-5 text-brass" />,
};

export function Toaster() {
  const [mounted, setMounted] = useState(false);
  const { toasts, dismiss } = useToastStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-in flex items-start gap-3 rounded-xl border border-border bg-ivory p-4 shadow-raised"
          role="status"
        >
          {icons[t.kind]}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-charcoal">{t.title}</p>
            {t.message && <p className="mt-0.5 text-sm text-sage">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-sage hover:bg-muted hover:text-charcoal" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
"use client";

import * as React from "react";
import { cn, statusClass, humanize } from "@/lib/utils";
import { X, Inbox, Loader2 } from "lucide-react";
import { Button } from "./button";

/* ---------- Status badge ---------- */
export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", statusClass(status), className)}>
      {humanize(status)}
    </span>
  );
}

export function Badge({ children, variant = "neutral", className }: { children: React.ReactNode; variant?: "success" | "warning" | "danger" | "neutral"; className?: string }) {
  const colors = { success: "bg-pine/10 text-pine", warning: "bg-brass-soft text-brass", danger: "bg-terracotta-soft text-terracotta", neutral: "bg-muted text-sage" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", colors[variant], className)}>{children}</span>;
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-ivory shadow-card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-charcoal">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-sage">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-charcoal">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-sage">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-pine-darker/50" onClick={onClose} />
      <div className={cn("animate-fade-in relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-ivory shadow-raised", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-ivory px-5 py-4">
          <h3 className="font-semibold text-charcoal">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-sage hover:bg-muted hover:text-charcoal" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Confirm dialog (promise-based) ---------- */
export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean; title: string; body: string; confirmLabel: string; danger: boolean; resolve?: (v: boolean) => void;
  }>({ open: false, title: "", body: "", confirmLabel: "Confirm", danger: false });

  const confirm = React.useCallback(
    (title: string, body: string, opts?: { confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setState({ open: true, title, body, confirmLabel: opts?.confirmLabel ?? "Confirm", danger: opts?.danger ?? false, resolve })),
    [],
  );
  const close = (v: boolean) => { state.resolve?.(v); setState((s) => ({ ...s, open: false })); };

  const confirmDialog = (
    <Modal open={state.open} onClose={() => close(false)} title={state.title}>
      <p className="text-sm text-sage">{state.body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
        <Button variant={state.danger ? "destructive" : "primary"} onClick={() => close(true)}>{state.confirmLabel}</Button>
      </div>
    </Modal>
  );

  return { confirm, confirmDialog };
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === t.key ? "bg-ivory text-charcoal shadow-card" : "text-sage hover:text-charcoal",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-xs", active === t.key ? "bg-terracotta-soft text-terracotta" : "bg-border text-sage")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Form field ---------- */
export function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const inputClass =
  "flex h-10 w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal placeholder:text-sage/70 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-pine disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClass, className)} {...props} />
));
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(inputClass, "pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, "min-h-[90px]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type = "checkbox", ...props }, ref) => (
  <input ref={ref} type={type} className={cn("h-4 w-4 rounded border-border text-pine accent-pine", className)} {...props} />
));
Checkbox.displayName = "Checkbox";

/* ---------- Table cells ---------- */
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sage", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm text-charcoal", className)}>{children}</td>;
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-4 text-sage">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <div>
        <p className="font-semibold text-charcoal">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-sage">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Loading ---------- */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-sage">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}
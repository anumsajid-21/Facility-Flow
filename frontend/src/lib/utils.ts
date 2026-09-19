import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return `PKR ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function dateShort(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeShort(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d: string | Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tailwind classes per status — earth palette. */
export const statusStyles: Record<string, string> = {
  DRAFT: "bg-muted text-sage border-border",
  OPEN: "bg-terracotta-soft text-terracotta border-terracotta/40",
  QUOTATIONS_RECEIVED: "bg-terracotta-soft text-terracotta border-terracotta/40",
  UNDER_REVIEW: "bg-[#EAE0F0] text-[#5B4A6B] border-[#C9B8DB]",
  PROVIDER_SELECTED: "bg-pine/10 text-pine border-pine/25",
  ACCEPTED: "bg-pine/10 text-pine border-pine/25",
  SUBMITTED: "bg-terracotta-soft text-terracotta border-terracotta/40",
  REJECTED: "bg-[#FADBD8] text-[#C0392B] border-[#E6B0AA]",
  WITHDRAWN: "bg-muted text-sage border-border",
  EXPIRED: "bg-muted text-sage border-border",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
  PENDING_APPROVAL: "bg-terracotta-soft text-terracotta border-terracotta/40",
  COMPLETED: "bg-pine/10 text-pine border-pine/25",
  AWAITING_APPROVAL: "bg-terracotta-soft text-terracotta border-terracotta/40",
  IN_PROGRESS: "bg-transparent text-[#0E5B6F] border-[#0E5B6F]/40",
  ASSIGNED: "bg-accent text-pine border-pine/25",
  SCHEDULED: "bg-transparent text-pine border-pine/40",
  REWORK: "bg-[#FADBD8] text-[#C0392B] border-[#E6B0AA]",
  CANCELLED: "bg-muted text-sage border-border",
  TERMINATED: "bg-[#FADBD8] text-[#C0392B] border-[#E6B0AA]",
  CLOSED: "bg-muted text-sage border-border",
  ISSUED: "bg-accent text-pine border-pine/25",
  PENDING: "bg-terracotta-soft text-terracotta border-terracotta/40",
  PAID: "bg-pine/10 text-pine border-pine/25",
  OVERDUE: "bg-[#FADBD8] text-[#C0392B] border-[#E6B0AA]",
  VERIFIED: "bg-[#DCEEF0] text-[#0E5B6F] border-pine/20",
  DOCUMENTS_SUBMITTED: "bg-terracotta-soft text-terracotta border-terracotta/40",
  UNVERIFIED: "bg-muted text-sage border-border",
  REJECTED_DOC: "bg-[#FADBD8] text-[#C0392B] border-[#E6B0AA]",
};

export function statusClass(s: string | null | undefined): string {
  return statusStyles[s ?? ""] ?? "bg-muted text-sage border-border";
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}


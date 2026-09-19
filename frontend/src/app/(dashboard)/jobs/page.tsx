"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { HardHat, ArrowRight, AlertTriangle } from "lucide-react";
import { jobsApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, EmptyState, Loading, StatusBadge } from "@/components/ui/kit";
import { dateShort, cn } from "@/lib/utils";

const COLUMNS = [
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "AWAITING_APPROVAL", label: "Awaiting Approval" },
  { key: "REWORK", label: "Rework" },
];

const COLUMN_STYLES: Record<string, { border: string; header: string; badge: string }> = {
  SCHEDULED: { border: "border-2 border-[#193225]/20 bg-white/70 shadow-sm", header: "text-[#193225] bg-[#193225]/5 border-b border-[#193225]/10", badge: "bg-[#193225]/10 text-[#193225]" },
  IN_PROGRESS: { border: "border-2 border-[#193225]/20 bg-white/70 shadow-sm", header: "text-[#193225] bg-[#193225]/5 border-b border-[#193225]/10", badge: "bg-[#193225]/10 text-[#193225]" },
  COMPLETED: { border: "border-2 border-[#193225]/20 bg-white/70 shadow-sm", header: "text-[#193225] bg-[#193225]/5 border-b border-[#193225]/10", badge: "bg-[#193225]/10 text-[#193225]" },
  AWAITING_APPROVAL: { border: "border-2 border-[#193225]/20 bg-white/70 shadow-sm", header: "text-[#193225] bg-[#193225]/5 border-b border-[#193225]/10", badge: "bg-[#193225]/10 text-[#193225]" },
  REWORK: { border: "border-2 border-[#193225]/20 bg-white/70 shadow-sm", header: "text-[#193225] bg-[#193225]/5 border-b border-[#193225]/10", badge: "bg-[#193225]/10 text-[#193225]" },
};

export default function JobsPage() {
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState<any[] | null>(null);
  useEffect(() => { jobsApi.list({ limit: 100 }).then((p) => setJobs(p.data)).catch(() => setJobs([])); }, []);

  const byCol = (key: string) => (jobs ?? []).filter((j) => j.status === key);
  const done = (jobs ?? []).filter((j) => j.status === "COMPLETED" || j.status === "AWAITING_APPROVAL" || j.status === "REWORK").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" subtitle={user?.role === "PROVIDER" ? "Today's work and upcoming assignments" : "Workflow across your active contracts"} />

      {jobs && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-sage">Total jobs</p><p className="mt-1 text-2xl font-bold text-charcoal">{jobs.length}</p></Card>
          <Card className="p-4"><p className="text-xs text-sage">Upcoming</p><p className="mt-1 text-2xl font-bold text-charcoal">{byCol("SCHEDULED").length}</p></Card>
          <Card className="p-4"><p className="text-xs text-sage">In progress</p><p className="mt-1 text-2xl font-bold text-emerald-700">{byCol("IN_PROGRESS").length}</p></Card>
          <Card className="p-4"><p className="text-xs text-sage">Completed / awaiting</p><p className="mt-1 text-2xl font-bold text-pine">{done}</p></Card>
        </div>
      )}

      {!jobs ? <Loading /> : jobs.length === 0 ? (
        <Card><EmptyState icon={<HardHat className="h-6 w-6" />} title="No jobs yet" description="Jobs are generated from your active contracts." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = byCol(col.key);
            const style = COLUMN_STYLES[col.key] || COLUMN_STYLES.SCHEDULED;
            return (
              <div key={col.key} className={cn("rounded-2xl p-3 transition-all", style.border)}>
                <p className={cn("mb-3 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider", style.header)}>
                  {col.label} <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", style.badge)}>{items.length}</span>
                </p>
                <div className="space-y-2.5">
                  {items.length === 0 ? <p className="px-2 py-8 text-center text-xs text-sage/70 italic">No jobs</p> : items.map((j) => (
                    <Card key={j.id} className="group p-3 transition-all hover:border-pine hover:shadow-raised">
                      <Link href={`/jobs/${j.id}`}>
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-charcoal group-hover:text-pine">{j.title || j.serviceName || "Job"}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge status={j.status} className="shrink-0 !px-2 !py-0.5 !text-[10px]" />
                          <span className="flex items-center gap-1 text-xs text-sage"><HardHat className="h-3 w-3" /> {dateShort(j.date)}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-sage truncate">{j.contract?.provider?.name || j.contract?.organization?.name}</p>
                        {j.sla?.status === "BREACHED" && <span className="mt-2 flex items-center gap-1 text-xs font-medium text-terracotta"><AlertTriangle className="h-3 w-3" /> SLA breached</span>}
                        <span className="mt-2 hidden items-center gap-1 text-xs font-medium text-pine group-hover:flex"><ArrowRight className="h-3 w-3" /> Open</span>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
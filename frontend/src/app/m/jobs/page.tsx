"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HardHat, Play, Check, Camera, LogOut } from "lucide-react";
import { jobsApi, proofApi, filesApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/kit";
import { toast } from "@/store/toast";
import { dateShort } from "@/lib/utils";

export default function MobileJobsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [step, setStep] = useState<"list" | "detail" | "photos">("list");
  const [beforeIds, setBeforeIds] = useState<string[]>([]);
  const [afterIds, setAfterIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const load = () => jobsApi.list({ limit: 50 }).then((p) => setJobs(p.data)).catch(() => setJobs([]));
  useEffect(() => { load(); }, []);

  const todaysJobs = (jobs ?? []).filter((j) => String(j.date).slice(0, 10) === today || ["SCHEDULED", "IN_PROGRESS", "ASSIGNED"].includes(j.status));
  const available = todaysJobs.filter((j) => ["SCHEDULED", "ASSIGNED"].includes(j.status));

  const start = async (id: string) => {
    setBusy(true);
    try { await jobsApi.start(id); toast.success("Job started"); setStep("photos"); setSelected((s: any) => ({ ...s, status: "IN_PROGRESS" })); load(); }
    catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(false); }
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await filesApi.upload(f, "JOB_PHOTO"); setter((p) => [...p, r.id]); toast.success("Photo added"); } catch (ex: any) { toast.error("Upload failed", ex?.message); }
  };
  const complete = async () => {
    if (beforeIds.length === 0 && afterIds.length === 0 && !notes) return toast.error("Add evidence", "Add at least one photo or a note.");
    setBusy(true);
    try {
      await proofApi.add(selected.id, { providerNote: notes, workerName: "Field worker" }, beforeIds, afterIds);
      await jobsApi.complete(selected.id);
      toast.success("Job completed"); setStep("list"); setSelected(null); setBeforeIds([]); setAfterIds([]); setNotes(""); load();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(false); }
  };

if (step === "list") {
    return (
      <div className="min-h-screen bg-sand px-4 pb-16 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-charcoal">Today&apos;s jobs</h1>
            <p className="text-xs text-sage">{dateShort(new Date())}</p>
          </div>
          <button onClick={() => { logout(); router.push("/login"); }} className="rounded-lg border border-border bg-ivory p-2 text-sage" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase text-sage">Ready to start ({available.length})</p>
        <div className="space-y-2">
          {available.length === 0 ? (
            <div className="rounded-xl border border-border bg-ivory p-6 text-center text-sm text-sage">No jobs ready to start right now.</div>
          ) : available.map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-xl border border-border bg-ivory p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine"><HardHat className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-charcoal">{j.title || j.serviceName || "Job"}</p>
                <p className="text-xs text-sage">{j.contract?.building?.name || "Building"} · {dateShort(j.date)}</p>
              </div>
              <Button size="sm" onClick={() => { setSelected(j); setStep("detail"); }}>Open</Button>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-6 text-xs font-semibold uppercase text-sage">Active & recent</p>
        <div className="space-y-2">
          {todaysJobs.filter((j) => !["SCHEDULED", "ASSIGNED"].includes(j.status)).map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-xl border border-border bg-ivory p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-charcoal">{j.title || j.serviceName || "Job"}</p>
                <StatusBadge status={j.status} className="mt-1" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelected(j); setStep("detail"); }}>View</Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "detail") {
    return (
      <div className="min-h-screen bg-sand px-4 pb-16 pt-5">
        <button onClick={() => setStep("list")} className="mb-3 text-sm font-medium text-pine">← Back to list</button>
        <h1 className="text-xl font-bold text-charcoal">{selected?.title || selected?.serviceName || "Job"}</h1>
        <p className="mt-1 text-sm text-sage">{selected?.contract?.building?.name || "Building"} · {dateShort(selected?.date)}</p>
        <StatusBadge status={selected?.status} className="mt-2" />
        {selected?.instructions && <p className="mt-4 rounded-xl border border-border bg-ivory p-4 text-sm text-sage">{selected.instructions}</p>}
        <div className="mt-6">
          {["SCHEDULED", "ASSIGNED"].includes(selected?.status) && (
            <Button className="w-full" size="lg" onClick={() => start(selected.id)} loading={busy}><Play className="h-5 w-5" /> Start job</Button>
          )}
          {selected?.status === "IN_PROGRESS" && (
            <Button className="w-full" size="lg" onClick={() => setStep("photos")}><Camera className="h-5 w-5" /> Add photos & complete</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand px-4 pb-16 pt-5">
      <button onClick={() => setStep("detail")} className="mb-3 text-sm font-medium text-pine">← Back</button>
      <h1 className="text-xl font-bold text-charcoal">{selected?.title || selected?.serviceName || "Job"}</h1>
      <p className="mt-1 text-xs text-sage">Add before/after photos and a note to complete this job.</p>
      <div className="mt-5 space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-ivory py-8 text-center">
          <Camera className="mb-2 h-6 w-6 text-pine" />
          <span className="text-sm font-medium text-sage">{beforeIds.length ? `${beforeIds.length} before photo(s)` : "Add before photo"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, setBeforeIds)} />
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-ivory py-8 text-center">
          <Camera className="mb-2 h-6 w-6 text-pine" />
          <span className="text-sm font-medium text-sage">{afterIds.length ? `${afterIds.length} after photo(s)` : "Add after photo"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, setAfterIds)} />
        </label>
        <div>
          <p className="mb-1 text-xs font-medium text-sage">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-24 w-full rounded-xl border border-input bg-ivory p-3 text-sm" placeholder="Describe the work completed" />
        </div>
      </div>
      <Button className="mt-4 w-full" size="lg" loading={busy} onClick={complete}><Check className="h-5 w-5" /> Complete job</Button>
    </div>
  );
}

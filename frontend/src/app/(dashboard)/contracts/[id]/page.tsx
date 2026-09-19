"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, DollarSign, HardHat, FileSignature } from "lucide-react";
import { contractsApi, jobsApi, recurringApi, apiError } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, Loading, StatusBadge, Modal, Field, Input, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { money, dateShort, cn } from "@/lib/utils";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [contract, setContract] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [openCreateJob, setOpenCreateJob] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", date: "", startTime: "", endTime: "", instructions: "" });
  const [schedule, setSchedule] = useState<any>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ frequency: "MONTHLY", startsAt: "" });
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  const [activity, setActivity] = useState<any[] | null>(null);

  useEffect(() => {
    contractsApi.get(id).then(setContract).catch(() => setContract(undefined));
    jobsApi.list({ limit: 100 }).then((p) => setJobs(p.data.filter((j: any) => j.contractId === id))).catch(() => setJobs([]));
    recurringApi.get(id).then(setSchedule).catch(() => setSchedule(null));
    contractsApi.activity(id).then(setActivity).catch(() => setActivity([]));
  }, [id]);

  const isHiring = user?.role === "HIRING_ORG" || user?.role === "ADMIN";
  const jobDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

  const createJob = async () => {
    if (!jobForm.title || !jobForm.date || !jobForm.startTime || !jobForm.endTime) return toast.error("Required", "Title, date, start time and end time are required.");
    setBusy(true);
    try {
      await jobsApi.create({
        contractId: id,
        buildingId: contract.buildingId,
        ...jobForm,
        date: jobDateTime(jobForm.date, jobForm.startTime),
        startTime: jobDateTime(jobForm.date, jobForm.startTime),
        endTime: jobDateTime(jobForm.date, jobForm.endTime),
      });
      toast.success("Job created");
      setOpenCreateJob(false);
      setJobForm({ title: "", date: "", startTime: "", endTime: "", instructions: "" });
      const updated = await jobsApi.list({ limit: 100 });
      setJobs(updated.data.filter((j: any) => j.contractId === id));
    } catch (e: any) { toast.error("Failed", e?.message || "Could not create job"); } finally { setBusy(false); }
  };
  const saveSchedule = async () => {
    if (!scheduleForm.startsAt) return toast.error("Required", "Choose the first run date.");
    try { setSchedule(await recurringApi.save(id, { ...scheduleForm, startsAt: new Date(scheduleForm.startsAt).toISOString() })); toast.success("Schedule saved"); } catch (e: any) { toast.error("Failed", e?.message || "Could not save schedule"); }
  };
  const toggleSchedule = async () => {
    setScheduleBusy(true);
    try {
      setSchedule(await recurringApi.pause(id, !schedule?.paused));
      toast.success(schedule?.paused ? "Schedule resumed" : "Schedule paused");
    } catch (e: any) {
      toast.error("Failed", apiError(e));
    } finally {
      setScheduleBusy(false);
    }
  };

  if (contract === undefined) return <div className="rounded-xl border border-border bg-ivory p-6 text-sm text-sage">Contract not found.</div>;
  if (!contract) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title={contract.title || contract.serviceName || "Contract"} subtitle={`${contract.provider?.name ?? "Provider"} · ${contract.organization?.name ?? "Organization"}`} actions={<><StatusBadge status={contract.status} className={contract.status === "ACTIVE" ? "border-green-200 bg-green-100 px-3 py-1 text-sm text-green-700" : undefined} /><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button></>} />
      <div className="flex gap-2 border-b border-border">
        {(["overview", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "border-terracotta text-pine" : "border-transparent text-sage hover:text-charcoal",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "activity" ? (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-semibold text-charcoal">Activity</h3>
            <p className="text-xs text-sage">Chronological history of events for this contract.</p>
          </div>
          {activity === null ? (
            <Loading />
          ) : activity.length === 0 ? (
            <p className="p-5 text-sm text-sage">No activity recorded yet.</p>
          ) : (
            <ol className="relative space-y-0 px-5 py-4">
              {activity.map((ev: any, i: number) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-terracotta ring-4 ring-terracotta-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-charcoal">{ev.description}</p>
                    <p className="text-xs text-sage">
                      {ev.type.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      {ev.actor ? ` · by ${ev.actor}` : ""} · {new Date(ev.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : (
      <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Contract Details</h3></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <span className="flex items-center gap-2 text-sm text-sage"><DollarSign className="h-4 w-4 text-pine" /> {money(contract.price)}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><Building2 className="h-4 w-4 text-pine" /> {contract.building?.name ?? "Building"}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><Calendar className="h-4 w-4 text-pine" /> {dateShort(contract.startDate)}{contract.endDate ? ` - ${dateShort(contract.endDate)}` : ""}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><FileSignature className="h-4 w-4 text-pine" /> {contract.frequency || "One-time"}</span>
          </div>
          {contract.paymentTerms && <p className="border-t border-border px-5 py-4 text-sm text-sage"><span className="font-medium text-charcoal">Payment terms:</span> {contract.paymentTerms}</p>}
          {contract.sla && <p className="border-t border-border px-5 py-4 text-sm text-sage"><span className="font-medium text-charcoal">SLA:</span> {contract.sla}</p>}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-charcoal">Quick Info</h3>
          <div className="mt-3 space-y-2 text-sm text-sage">
            <p>Status: <span className="font-medium text-charcoal">{contract.status}</span></p>
            <p>Provider: <span className="font-medium text-charcoal">{contract.provider?.name}</span></p>
            <p>Total Jobs: <span className="font-medium text-charcoal">{jobs.length}</span></p>
          </div>
          {isHiring && contract.status === "ACTIVE" && <Button className="mt-4 w-full" onClick={() => setOpenCreateJob(true)}><HardHat className="h-4 w-4" /> Create Job</Button>}
        </Card>
      </div>
      {contract.status === "ACTIVE" && <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-charcoal">Recurring schedule</h3><p className="text-xs text-sage">{schedule ? `${schedule.frequency} · next run ${dateShort(schedule.nextRunAt)}${schedule.paused ? " · paused" : ""}` : "Automatically generate jobs for this contract."}</p></div>{schedule && <Button variant="outline" size="sm" loading={scheduleBusy} onClick={toggleSchedule}>{schedule.paused ? "Resume" : "Pause"}</Button>}</div>{!schedule && <div className="mt-4 flex flex-wrap items-end gap-3"><Field label="Frequency"><select className="h-10 rounded-lg border border-input bg-ivory px-3 text-sm" value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option><option>QUARTERLY</option></select></Field><Field label="First run"><Input type="date" value={scheduleForm.startsAt} onChange={(e) => setScheduleForm({ ...scheduleForm, startsAt: e.target.value })} /></Field><Button onClick={saveSchedule}>Enable schedule</Button></div>}</Card>}
      <Card>
        <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Jobs ({jobs.length})</h3></div>
        {jobs.length === 0 ? (
          <p className="p-5 text-sm text-sage">No jobs created yet. {isHiring && "Create a job from this contract to get started."}</p>
        ) : (
          <div className="divide-y divide-border">
            {jobs.map((j: any) => (
              <div key={j.id} className="flex items-center gap-3 px-5 py-3">
                <HardHat className="h-4 w-4 text-terracotta" />
                <div className="flex-1"><p className="text-sm font-medium text-charcoal">{j.title}</p><p className="text-xs text-sage">{dateShort(j.date)}</p></div>
                <StatusBadge status={j.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
      </>
      )}
      <Modal open={openCreateJob} onClose={() => setOpenCreateJob(false)} title="Create Job">
        <form onSubmit={(e) => { e.preventDefault(); createJob(); }} className="space-y-4">
          <Field label="Title"><Input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} placeholder="Weekly cleaning" required /></Field>
          <Field label="Date"><Input type="date" value={jobForm.date} onChange={(e) => setJobForm({ ...jobForm, date: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time"><Input type="time" value={jobForm.startTime} onChange={(e) => setJobForm({ ...jobForm, startTime: e.target.value })} required /></Field>
            <Field label="End Time"><Input type="time" value={jobForm.endTime} onChange={(e) => setJobForm({ ...jobForm, endTime: e.target.value })} required /></Field>
          </div>
          <Field label="Instructions"><Textarea value={jobForm.instructions} onChange={(e) => setJobForm({ ...jobForm, instructions: e.target.value })} placeholder="Special instructions" /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpenCreateJob(false)}>Cancel</Button><Button type="submit" loading={busy}>Create Job</Button></div>
        </form>
      </Modal>
    </div>
  );
}
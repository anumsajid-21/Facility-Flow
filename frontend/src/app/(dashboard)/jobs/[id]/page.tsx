"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, CheckCircle, PlayCircle,
  Camera, FileText, ThumbsUp, RefreshCw, ChevronDown,
} from "lucide-react";
import { jobsApi, workersApi, proofApi, approvalsApi, filesApi, checklistsApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import {
  Card, PageHeader, Loading, StatusBadge, Modal, Field, Input, Textarea, Select, Checkbox,
} from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort, timeShort, cn } from "@/lib/utils";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [job, setJob] = useState<any | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<any[]>([]);
  const [myWorkers, setMyWorkers] = useState<any[]>([]);
  const [proof, setProof] = useState<any | null>(undefined);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [checklistResults, setChecklistResults] = useState<any[]>([]);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [openProof, setOpenProof] = useState(false);
  const [openRework, setOpenRework] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [proofForm, setProofForm] = useState({ providerNote: "", completionNote: "", workerName: "" });
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [reworkReason, setReworkReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [openApprove, setOpenApprove] = useState(false);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  const [activity, setActivity] = useState<any[] | null>(null);

  const loadChecklists = useCallback(() => {
    checklistsApi.jobResults(id).then(setChecklistResults).catch(() => setChecklistResults([]));
  }, [id]);

  const reload = async () => {
    const [j, aw] = await Promise.all([
      jobsApi.get(id),
      jobsApi.workers(id),
    ]);
    setJob(j);
    setAssignedWorkers(aw);
    proofApi.get(id).then(setProof).catch(() => setProof(null));
    approvalsApi.listForJob(id).then(setApprovals).catch(() => setApprovals([]));
    loadChecklists();
  };

  useEffect(() => {
    jobsApi.get(id).then(setJob).catch(() => setJob(undefined));
    jobsApi.workers(id).then(setAssignedWorkers).catch(() => setAssignedWorkers([]));
    workersApi.list().then((p) => setMyWorkers(p.data)).catch(() => setMyWorkers([]));
    proofApi.get(id).then(setProof).catch(() => setProof(null));
    approvalsApi.listForJob(id).then(setApprovals).catch(() => setApprovals([]));
    loadChecklists();
    jobsApi.activity(id).then(setActivity).catch(() => setActivity([]));
  }, [id, loadChecklists]);

  const isProvider = user?.role === "PROVIDER";
  const isHiring = user?.role === "HIRING_ORG" || user?.role === "ADMIN";

  const assignWorker = async () => {
    if (!selectedWorker) return toast.error("Required", "Select a worker first.");
    setBusy("assign");
    try {
      await jobsApi.assignWorker(id, selectedWorker);
      toast.success("Worker assigned");
      setOpenAssign(false);
      setSelectedWorker("");
      await reload();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const start = async () => {
    setBusy("start");
    try { await jobsApi.start(id); toast.success("Job started"); await reload(); }
    catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const complete = async () => {
    setBusy("complete");
    try { await jobsApi.complete(id); toast.success("Job marked complete"); await reload(); }
    catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const submitProof = async () => {
    setBusy("proof");
    try {
      // Upload photos first
      const uploadFiles = async (files: File[], kind: string) => {
        const ids: string[] = [];
        for (const f of files) {
          const res = await filesApi.upload(f, kind);
          ids.push(res.id);
        }
        return ids;
      };
      const beforeIds = await uploadFiles(beforeFiles, "JOB_PHOTO");
      const afterIds = await uploadFiles(afterFiles, "JOB_PHOTO");
      await proofApi.add(id, proofForm, beforeIds, afterIds);
      toast.success("Proof of work submitted");
      setOpenProof(false);
      setBeforeFiles([]);
      setAfterFiles([]);
      setProofForm({ providerNote: "", completionNote: "", workerName: "" });
      await reload();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const approve = async () => {
    setBusy("approve");
    try {
      await approvalsApi.approve(id, approveNotes);
      toast.success("Job approved", "An invoice has been issued.");
      setOpenApprove(false);
      setApproveNotes("");
      await reload();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const requestRework = async () => {
    if (!reworkReason.trim()) return toast.error("Required", "Please provide a rework reason.");
    setBusy("rework");
    try {
      await approvalsApi.rework(id, reworkReason);
      toast.success("Rework requested");
      setOpenRework(false);
      setReworkReason("");
      await reload();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  if (job === undefined) return (
    <div className="rounded-xl border border-border bg-ivory p-6 text-sm text-sage">Job not found.</div>
  );
  if (!job) return <Loading />;

  const canApprove = isHiring && (job.status === "COMPLETED" || job.status === "AWAITING_APPROVAL");
  const canAddProof = isProvider && job.status === "IN_PROGRESS";
  const latestApproval = approvals[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title || "Job"}
        subtitle={`${job.contract?.provider?.name ?? "Provider"} · ${dateShort(job.date)}`}
        actions={<><StatusBadge status={job.status} /><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button></>}
      />

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
            <p className="text-xs text-sage">Chronological history of events for this job.</p>
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
        {/* Details */}
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Details</h3></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <span className="flex items-center gap-2 text-sm text-sage"><MapPin className="h-4 w-4 text-pine" /> {job.building?.name ?? "Building"}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><Calendar className="h-4 w-4 text-pine" /> {dateShort(job.date)}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><Clock className="h-4 w-4 text-pine" /> {job.startTime ? timeShort(job.startTime) : ""} – {job.endTime ? timeShort(job.endTime) : ""}</span>
            <span className="flex items-center gap-2 text-sm text-sage"><Users className="h-4 w-4 text-pine" /> {assignedWorkers.length} worker{assignedWorkers.length !== 1 ? "s" : ""} assigned</span>
          </div>
          {job.instructions && <p className="border-t border-border px-5 py-4 text-sm text-sage">{job.instructions}</p>}
        </Card>

        {/* Checklist */}
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-charcoal flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-pine" /> Job Checklist
            </h3>
            {checklistResults.length > 0 && (
              <span className="rounded-full bg-pine/10 px-3 py-1 text-xs font-semibold text-pine">
                {checklistResults.filter((c: any) => c.isChecked).length} / {checklistResults.length} Completed ({Math.round((checklistResults.filter((c: any) => c.isChecked).length / checklistResults.length) * 100)}%)
              </span>
            )}
          </div>
          <div className="p-5 space-y-3">
            {checklistResults.length === 0 ? (
              <p className="text-sm text-sage">No checklist items assigned for this job.</p>
            ) : (
              checklistResults.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isProvider}
                      checked={item.isChecked}
                      onChange={async (e) => {
                        const updated = checklistResults.map((r: any) => r.id === item.id ? { ...r, isChecked: e.target.checked } : r);
                        setChecklistResults(updated);
                        if (isProvider) {
                          try {
                            await checklistsApi.saveResults(id, [{ checklistItemId: item.checklistItemId, isChecked: e.target.checked }]);
                          } catch (err: any) {
                            toast.error("Failed to save", err?.message);
                          }
                        }
                      }}
                      className="h-4 w-4 rounded border-border text-pine focus:ring-pine"
                    />
                    <span className={`text-sm ${item.isChecked ? "line-through text-sage" : "text-charcoal font-medium"}`}>
                      {item.checklistItem?.description || "Checklist Item"}
                    </span>
                  </label>
                  {item.checkedAt && item.isChecked && (
                    <span className="text-xs text-sage">{dateShort(item.checkedAt)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Actions */}
        <Card className="p-5">
          <h3 className="font-semibold text-charcoal">Actions</h3>
          <div className="mt-3 space-y-2">
            {isProvider && job.status === "SCHEDULED" && (
              <Button className="w-full" loading={busy === "start"} onClick={start}>
                <PlayCircle className="h-4 w-4" /> Start Job
              </Button>
            )}
            {isProvider && job.status === "IN_PROGRESS" && (
              <>
                <Button variant="outline" className="w-full" onClick={() => setOpenProof(true)}>
                  <Camera className="h-4 w-4" /> Add Proof of Work
                </Button>
                <Button className="w-full" loading={busy === "complete"} onClick={complete}>
                  <CheckCircle className="h-4 w-4" /> Mark Complete
                </Button>
              </>
            )}
            {isProvider && (job.status === "SCHEDULED" || job.status === "IN_PROGRESS" || job.status === "ASSIGNED") && (
              <Button variant="outline" className="w-full" onClick={() => setOpenAssign(true)}>
                <Users className="h-4 w-4" /> Assign Worker
              </Button>
            )}
            {canApprove && (
              <>
                <Button className="w-full" loading={busy === "approve"} onClick={() => setOpenApprove(true)}>
                  <ThumbsUp className="h-4 w-4" /> Approve Job
                </Button>
                <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" loading={busy === "rework"} onClick={() => setOpenRework(true)}>
                  <RefreshCw className="h-4 w-4" /> Request Rework
                </Button>
              </>
            )}
            {isProvider && job.status === "REWORK" && (
              <>
                <p className="rounded-lg bg-terracotta-soft px-3 py-2 text-xs text-terracotta">
                  Rework requested. Update your proof of work and re-complete the job.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setOpenProof(true)}>
                  <Camera className="h-4 w-4" /> Update Proof of Work
                </Button>
                <Button className="w-full" loading={busy === "complete"} onClick={complete}>
                  <CheckCircle className="h-4 w-4" /> Resubmit as Complete
                </Button>
              </>
            )}
            {!isProvider && !isHiring && <p className="text-sm text-sage">No actions available.</p>}
          </div>
        </Card>
      </div>
      </>
      )}

      {/* Assigned Workers */}
      <Card>
        <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Assigned Workers</h3></div>
        {assignedWorkers.length === 0 ? (
          <p className="p-5 text-sm text-sage">No workers assigned yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {assignedWorkers.map((aw: any) => (
              <div key={aw.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  {aw.worker?.name?.slice(0, 1)?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-charcoal">{aw.worker?.name}</p>
                  <p className="text-xs text-sage">{aw.worker?.skills || "No skills listed"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Proof of Work display */}
      {proof ? (
        <Card className="border-emerald-200/80 bg-emerald-50/10 shadow-sm">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between bg-emerald-50/30">
            <h3 className="font-semibold text-charcoal flex items-center gap-2">
              <Camera className="h-4 w-4 text-emerald-700" /> Proof of Work Submission
            </h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
              ✓ PROOF SUBMITTED
            </span>
          </div>
          <div className="space-y-4 p-5">
            {proof.workerName && (
              <div className="flex items-center gap-2 text-xs font-medium text-sage">
                <Users className="h-3.5 w-3.5 text-pine" /> Completed by: <span className="font-semibold text-charcoal">{proof.workerName}</span>
              </div>
            )}

            {proof.providerNote && (
              <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-pine mb-1">Provider Diagnostic Note</p>
                <p className="text-sm text-charcoal leading-relaxed">{proof.providerNote}</p>
              </div>
            )}

            {proof.completionNote && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Final Completion Summary</p>
                <p className="text-sm text-charcoal leading-relaxed">{proof.completionNote}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              {proof.beforePhotos?.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="mb-2 text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-amber-700" /> Before Photos ({proof.beforePhotos.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {proof.beforePhotos.map((f: any) => (
                      <a key={f.id} href={filesApi.url(f.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors">
                        <FileText className="h-3.5 w-3.5 text-amber-700" />
                        <span className="truncate max-w-[150px]">{f.originalName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {proof.afterPhotos?.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="mb-2 text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-emerald-700" /> After Photos ({proof.afterPhotos.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {proof.afterPhotos.map((f: any) => (
                      <a key={f.id} href={filesApi.url(f.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 transition-colors">
                        <FileText className="h-3.5 w-3.5 text-emerald-700" />
                        <span className="truncate max-w-[150px]">{f.originalName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : isProvider && (job.status === "IN_PROGRESS" || job.status === "REWORK") ? (
        <Card className="border-dashed border-2 border-brass/50 bg-brass-soft/20 p-5 text-center">
          <Camera className="mx-auto h-8 w-8 text-pine mb-2" />
          <h4 className="font-semibold text-sm text-charcoal">Proof of Work Needed</h4>
          <p className="text-xs text-sage mt-1 max-w-md mx-auto">
            Upload before & after photos, checklist items, and provider notes to submit this job for approval.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpenProof(true)}>
            <Camera className="mr-1.5 h-4 w-4" /> Add Proof of Work Now
          </Button>
        </Card>
      ) : null}

      {/* Approvals History */}
      {approvals.length > 0 && (
        <Card>
          <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Approval History</h3></div>
          <div className="divide-y divide-border">
            {approvals.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full ${a.decision === "APPROVED" ? "bg-pine" : "bg-terracotta"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-charcoal">{a.decision === "APPROVED" ? "Approved" : "Rework Requested"}</p>
                  {a.notes && <p className="text-xs text-sage">{a.notes}</p>}
                </div>
                <span className="text-xs text-sage">{dateShort(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      <Modal open={openAssign} onClose={() => setOpenAssign(false)} title="Assign Worker">
        <div className="space-y-4">
          <Field label="Select Worker">
            <Select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              <option value="">Choose a worker</option>
              {myWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenAssign(false)}>Cancel</Button>
            <Button loading={busy === "assign"} onClick={assignWorker}>Assign</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openProof} onClose={() => setOpenProof(false)} title="Add Proof of Work" wide>
        <div className="space-y-4">
          <Field label="Worker name (optional)">
            <Input value={proofForm.workerName} onChange={(e) => setProofForm({ ...proofForm, workerName: e.target.value })} placeholder="John Doe" />
          </Field>
          <Field label="Provider note">
            <Textarea value={proofForm.providerNote} onChange={(e) => setProofForm({ ...proofForm, providerNote: e.target.value })} placeholder="Describe work performed…" />
          </Field>
          <Field label="Completion note">
            <Textarea value={proofForm.completionNote} onChange={(e) => setProofForm({ ...proofForm, completionNote: e.target.value })} placeholder="Any final notes or observations…" />
          </Field>
          <Field label="Before photos">
            <input
              type="file" accept="image/*" multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setBeforeFiles(Array.from(e.target.files ?? []))}
            />
            {beforeFiles.length > 0 && <p className="mt-1 text-xs text-sage">{beforeFiles.length} file(s) selected</p>}
          </Field>
          <Field label="After photos">
            <input
              type="file" accept="image/*" multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setAfterFiles(Array.from(e.target.files ?? []))}
            />
            {afterFiles.length > 0 && <p className="mt-1 text-xs text-sage">{afterFiles.length} file(s) selected</p>}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenProof(false)}>Cancel</Button>
            <Button loading={busy === "proof"} onClick={submitProof}><Camera className="h-4 w-4" /> Submit Proof</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openApprove} onClose={() => setOpenApprove(false)} title="Approve Job">
        <div className="space-y-4">
          <p className="text-sm text-sage">Approving this job will mark it as approved and generate an invoice.</p>
          <Field label="Notes (optional)">
            <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Approval notes…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenApprove(false)}>Cancel</Button>
            <Button loading={busy === "approve"} onClick={approve}><ThumbsUp className="h-4 w-4" /> Approve</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openRework} onClose={() => setOpenRework(false)} title="Request Rework">
        <div className="space-y-4">
          <p className="text-sm text-sage">Explain what needs to be fixed. The provider will be notified and can resubmit.</p>
          <Field label="Reason for rework *">
            <Textarea value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} placeholder="Describe what needs to be redone…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenRework(false)}>Cancel</Button>
            <Button variant="destructive" loading={busy === "rework"} onClick={requestRework}><RefreshCw className="h-4 w-4" /> Request Rework</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
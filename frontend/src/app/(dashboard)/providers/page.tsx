"use client";
import { useEffect, useState } from "react";
import { Users, MapPin, BadgeCheck, Briefcase, Star, Camera, FileText, Plus, CheckCircle } from "lucide-react";
import { providersApi, reviewsApi, proofApi, jobsApi, filesApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, EmptyState, Loading, StatusBadge, Modal, Field, Input, Textarea, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort } from "@/lib/utils";

export default function ProvidersPage() {
  const { user } = useAuthStore();
  const [providers, setProviders] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [openUpload, setOpenUpload] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [proofForm, setProofForm] = useState({ providerNote: "", completionNote: "", workerName: "" });
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = () => providersApi.list({ limit: 50 }).then((p) => setProviders(p.data)).catch(() => setProviders([]));
  useEffect(() => { load(); }, []);

  const open = async (p: any) => {
    setSelected(p);
    setReviews([]);
    setProofs([]);
    try {
      const [r, pr] = await Promise.all([
        reviewsApi.byProvider(p.id).catch(() => []),
        proofApi.byProvider(p.id).catch(() => []),
      ]);
      setReviews(Array.isArray(r) ? r : (r?.items ?? []));
      setProofs(Array.isArray(pr) ? pr : []);
    } catch {
      setReviews([]);
      setProofs([]);
    }
  };

  const openUploadModal = async () => {
    try {
      const jRes = await jobsApi.list({ limit: 100 });
      const inProg = (jRes.data || []).filter((j: any) => j.status === "IN_PROGRESS" || j.status === "REWORK" || j.status === "SCHEDULED" || j.status === "COMPLETED");
      setAvailableJobs(inProg);
      if (inProg.length > 0) setSelectedJobId(inProg[0].id);
      setOpenUpload(true);
    } catch (e: any) {
      toast.error("Failed to load jobs", e?.message);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedJobId) return toast.error("Required", "Select a job first.");
    setUploading(true);
    try {
      const uploadFiles = async (files: File[], kind: string) => {
        const ids: string[] = [];
        for (const f of files) {
          const res = await filesApi.upload(f, kind);
          ids.push(res.id);
        }
        return ids;
      };
      const bIds = await uploadFiles(beforeFiles, "JOB_PHOTO");
      const aIds = await uploadFiles(afterFiles, "JOB_PHOTO");
      await proofApi.add(selectedJobId, proofForm, bIds, aIds);
      toast.success("Proof of Work added!", "Evidence attached to job.");
      setOpenUpload(false);
      setBeforeFiles([]);
      setAfterFiles([]);
      setProofForm({ providerNote: "", completionNote: "", workerName: "" });
      if (selected) open(selected);
    } catch (e: any) {
      toast.error("Failed to add proof", e?.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        subtitle="Vetted service providers in your network"
        actions={
          user?.role === "PROVIDER" ? (
            <Button onClick={openUploadModal} className="bg-pine text-white hover:bg-pine/90 font-semibold gap-2">
              <Camera className="h-4 w-4" /> Upload Proof of Work
            </Button>
          ) : undefined
        }
      />

      {!providers ? <Loading /> : providers.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No providers yet" description="Providers in your area will appear here once they're verified." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <Card key={p.id} className="flex flex-col p-5 transition-all hover:border-brass hover:shadow-raised">
              <div className="flex items-start justify-between">
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt={`${p.name} profile`} className="h-12 w-12 rounded-xl object-cover ring-1 ring-border" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pine/10 text-lg font-bold text-pine">{p.name?.slice(0, 1).toUpperCase()}</div>
                )}
                {p.verificationStatus === "VERIFIED" && <span className="flex items-center gap-1 rounded-full bg-pine/10 px-2 py-0.5 text-xs font-medium text-pine"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
                {p.verificationStatus !== "VERIFIED" && <StatusBadge status={p.verificationStatus} />}
              </div>
              <h3 className="mt-3 font-semibold text-charcoal">{p.name}</h3>
              {p.description && <p className="mt-1 line-clamp-2 text-sm text-sage">{p.description}</p>}
              <div className="mt-4 space-y-1.5 text-xs text-sage">
                {p.serviceAreaText && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {p.serviceAreaText}</span>}
                {p.experience && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {p.experience}</span>}
                {p.workforceCapacity ? <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Up to {p.workforceCapacity} workers</span> : null}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                {p.services?.length ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-sage">{p.services[0].category?.name || "Service"}{p.services.length > 1 ? ` +${p.services.length - 1}` : ""}</span> : null}
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => open(p)}>{p._count?.services ?? 0} services · View Profile</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Provider Details & Proof of Work Portfolio Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Provider Profile"} wide>
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                {selected.logoUrl ? <img src={selected.logoUrl} alt={`${selected.name} profile`} className="h-14 w-14 rounded-xl object-cover ring-1 ring-border" /> : null}
                <div>
                  <p className="font-semibold text-charcoal">{selected.name}</p>
                  <StatusBadge status={selected.verificationStatus} />
                  {selected.workforceCapacity && <span className="ml-3 text-xs text-sage">{selected.workforceCapacity} worker capacity</span>}
                </div>
              </div>
              {user?.role === "PROVIDER" && (
                <Button size="sm" onClick={openUploadModal} className="gap-1.5 bg-pine text-white text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Proof of Work
                </Button>
              )}
            </div>

            {selected.description && <p className="text-sm text-sage">{selected.description}</p>}

            {/* Proof of Work Portfolio Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-bold text-sm text-pine uppercase tracking-wider">
                  <Camera className="h-4 w-4 text-pine" /> Proof of Work Portfolio ({proofs.length})
                </h4>
              </div>

              {proofs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-sage">
                  No proof of work submitted yet. Click &quot;Add Proof of Work&quot; to upload evidence.
                </div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {proofs.map((pow: any) => (
                    <div key={pow.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <div>
                          <span className="font-bold text-sm text-charcoal">{pow.job?.title || pow.job?.serviceName || "Completed Job"}</span>
                          <span className="ml-2 text-xs text-sage">· {pow.job?.building?.name || "Facility"}</span>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                          ✓ PROOF SUBMITTED
                        </span>
                      </div>

                      {pow.workerName && (
                        <p className="text-xs text-sage font-medium">
                          Completed by: <span className="font-semibold text-charcoal">{pow.workerName}</span> · {dateShort(pow.completedAt)}
                        </p>
                      )}

                      {pow.providerNote && (
                        <div className="rounded-lg bg-white p-3 border border-border">
                          <p className="text-[11px] font-bold text-pine uppercase">Diagnostic Note</p>
                          <p className="text-xs text-charcoal mt-0.5">{pow.providerNote}</p>
                        </div>
                      )}

                      {pow.completionNote && (
                        <div className="rounded-lg bg-emerald-100/50 p-3 border border-emerald-200">
                          <p className="text-[11px] font-bold text-emerald-900 uppercase">Completion Summary</p>
                          <p className="text-xs text-charcoal mt-0.5">{pow.completionNote}</p>
                        </div>
                      )}

                      {/* Photo Attachments */}
                      <div className="grid gap-3 sm:grid-cols-2 pt-1">
                        {pow.beforePhotos?.length > 0 && (
                          <div className="rounded-lg bg-white p-2.5 border border-border">
                            <p className="text-[10px] font-bold text-amber-800 uppercase mb-1.5 flex items-center gap-1">
                              <Camera className="h-3 w-3 text-amber-600" /> Before Photos ({pow.beforePhotos.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {pow.beforePhotos.map((f: any) => (
                                <a
                                  key={f.id}
                                  href={filesApi.url(f.id)}
                                  target="_blank"
                                  rel="noopener"
                                  className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 border border-amber-200 hover:bg-amber-100"
                                >
                                  <FileText className="h-3 w-3 text-amber-700" />
                                  <span className="truncate max-w-[120px]">{f.originalName}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {pow.afterPhotos?.length > 0 && (
                          <div className="rounded-lg bg-white p-2.5 border border-border">
                            <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-600" /> After Photos ({pow.afterPhotos.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {pow.afterPhotos.map((f: any) => (
                                <a
                                  key={f.id}
                                  href={filesApi.url(f.id)}
                                  target="_blank"
                                  rel="noopener"
                                  className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                                >
                                  <FileText className="h-3 w-3 text-emerald-700" />
                                  <span className="truncate max-w-[120px]">{f.originalName}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Services List */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-sage">Offered Services</p>
              <div className="flex flex-wrap gap-2">
                {selected.services?.length ? selected.services.map((s: any) => (
                  <span key={s.id} className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-charcoal">{s.category?.name || "Service"}</span>
                )) : <span className="text-sm text-sage">No services listed.</span>}
              </div>
            </div>

            {/* Reviews Section */}
            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-sage"><Star className="h-3.5 w-3.5" /> Client Reviews ({reviews.length})</p>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {reviews.length === 0 ? <p className="text-sm text-sage">No reviews yet.</p> : reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-charcoal"><Star className="h-3.5 w-3.5 text-brass" /> {r.overallRating ?? "—"} / 5</p>
                    {r.comments && <p className="mt-1 text-sm text-sage">{r.comments}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Proof of Work Modal */}
      <Modal open={openUpload} onClose={() => setOpenUpload(false)} title="Upload Proof of Work" wide>
        <div className="space-y-4">
          <Field label="Select Job *">
            <Select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
              {availableJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title || j.serviceName || "Job"} ({j.status}) · {j.building?.name || "Building"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Worker Name">
            <Input
              value={proofForm.workerName}
              onChange={(e) => setProofForm({ ...proofForm, workerName: e.target.value })}
              placeholder="e.g. John Doe / Lead Technician"
            />
          </Field>

          <Field label="Provider Diagnostic Note">
            <Textarea
              value={proofForm.providerNote}
              onChange={(e) => setProofForm({ ...proofForm, providerNote: e.target.value })}
              placeholder="Detailed observations and work done…"
            />
          </Field>

          <Field label="Final Completion Summary">
            <Textarea
              value={proofForm.completionNote}
              onChange={(e) => setProofForm({ ...proofForm, completionNote: e.target.value })}
              placeholder="Final notes for client approval…"
            />
          </Field>

          <Field label="Before Photos (Optional — e.g. glass cleaning)">
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setBeforeFiles(Array.from(e.target.files ?? []))}
            />
            {beforeFiles.length > 0 && <p className="mt-1 text-xs text-sage">{beforeFiles.length} file(s) selected</p>}
          </Field>

          <Field label="After Photos (Optional — e.g. glass cleaning)">
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setAfterFiles(Array.from(e.target.files ?? []))}
            />
            {afterFiles.length > 0 && <p className="mt-1 text-xs text-sage">{afterFiles.length} file(s) selected</p>}
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenUpload(false)}>Cancel</Button>
            <Button loading={uploading} onClick={handleUploadProof} className="gap-2 bg-pine text-white">
              <Camera className="h-4 w-4" /> Submit Proof of Work
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
"use client";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { reviewsApi, jobsApi, providersApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, EmptyState, Loading, Field, Input, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort } from "@/lib/utils";

export default function ReviewsPage() {
  const { user } = useAuthStore();
  const isProvider = user?.role === "PROVIDER";
  const [provider, setProvider] = useState<any>(null);
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [form, setForm] = useState({ jobId: "", providerId: "", providerName: "", quality: 5, timeliness: 5, professionalism: 5, value: 5, overallRating: 5, comments: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isProvider && user?.providerId) {
      reviewsApi.byProvider(user.providerId)
        .then((r: any) => setReviews(Array.isArray(r) ? r : (r?.items ?? [])))
        .catch(() => setReviews([]));
    } else {
      jobsApi.list().then((p) => {
        const completed = p.data.filter((j: any) => j.status === "COMPLETED" || j.status === "AWAITING_APPROVAL");
        setJobs(completed);
      }).catch(() => setJobs([]));
      providersApi.list({ limit: 100 }).then((p) => setProviders(p.data.filter((pr: any) => pr.verificationStatus !== "SUSPENDED"))).catch(() => setProviders([]));
      reviewsApi.listMine().then((r) => setMyReviews(Array.isArray(r) ? r : [])).catch(() => setMyReviews([]));
      setReviews([]);
    }
  }, [isProvider, user]);

  // pick the provider automatically from the selected job's contract (user can override below)
  const onJobChange = async (jobId: string) => {
    setForm((f) => ({ ...f, jobId, providerId: "", providerName: "" }));
    if (!jobId) return;
    try {
      const j = await jobsApi.get(jobId);
      if (j?.contract?.provider?.id) setForm((f) => ({ ...f, providerId: j.contract.provider.id, providerName: j.contract.provider.name }));
    } catch { /* ignore */ }
  };

  const avg = reviews && reviews.length ? (reviews.reduce((s, r) => s + Number(r.overallRating ?? 0), 0) / reviews.length).toFixed(1) : null;

  const submit = async () => {
    setFormError("");
    if (!form.jobId) return setFormError("Select a completed job to review.");
    if (!form.providerId) return setFormError("Select the provider being reviewed.");
    setBusy(true);
    try {
      await reviewsApi.create({ jobId: form.jobId, providerId: form.providerId, quality: Number(form.quality), timeliness: Number(form.timeliness), professionalism: Number(form.professionalism), value: Number(form.value), overallRating: Number(form.overallRating), comments: form.comments });
      toast.success("Review submitted");
      setForm({ ...form, jobId: "", providerId: "", providerName: "", comments: "" });
      reviewsApi.listMine().then((r) => setMyReviews(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Could not submit review.";
      setFormError(typeof msg === "string" ? msg : "Could not submit review.");
      toast.error("Failed", typeof msg === "string" ? msg : "Could not submit review.");
    } finally { setBusy(false); }
  };

  if (isProvider) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reviews" subtitle="How clients rate your work" />
        {!reviews ? <Loading /> : reviews.length === 0 ? (
          <Card><EmptyState icon={<Star className="h-6 w-6" />} title="No reviews yet" description="Reviews from completed jobs will appear here." /></Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4"><p className="text-xs text-sage">Average rating</p><p className="mt-1 text-2xl font-bold text-charcoal">{avg ? `${avg} ★` : "—"}</p></Card>
              <Card className="p-4"><p className="text-xs text-sage">Total reviews</p><p className="mt-1 text-2xl font-bold text-charcoal">{reviews.length}</p></Card>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <Card key={r.id} className="p-4">
                  <p className="flex items-center gap-1 text-sm font-semibold text-charcoal"><Star className="h-4 w-4 text-brass" /> {r.overallRating ?? "—"} / 5</p>
                  {r.comments && <p className="mt-2 text-sm text-sage">{r.comments}</p>}
                  <p className="mt-2 text-xs text-sage">{dateShort(r.createdAt)}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" subtitle="Rate providers after job completion" />
      <Card className="max-w-2xl">
        <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Submit a review</h3></div>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Completed job"><select className="h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm" value={form.jobId} onChange={(e) => onJobChange(e.target.value)}>
              <option value="">Select…</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title || j.serviceName || "Job"}</option>)}
            </select></Field>
            <Field label="Provider">
              <select className="h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-sage" value={form.providerId}
                disabled={!!form.jobId}
                onChange={(e) => setForm({ ...form, providerId: e.target.value, providerName: providers.find((p) => p.id === e.target.value)?.name ?? "" })}>
                <option value="">{form.jobId ? "Auto-selected from the job" : "Select provider…"}</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                {form.providerId && !providers.some((p) => p.id === form.providerId) && <option value={form.providerId}>{form.providerName || "Selected provider"}</option>}
              </select>
              {form.jobId ? <p className="text-xs text-sage">Auto-filled from the job&apos;s contract so the review reaches the right provider.</p> : null}
            </Field>
          </div>
          {formError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["quality", "timeliness", "professionalism", "value"] as const).map((k) => (
              <Field key={k} label={k}><Input type="number" min={1} max={5} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <Field label="Comments"><Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Overall experience" /></Field>
          <div className="flex justify-end"><Button onClick={submit} loading={busy}>Submit review</Button></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Reviews you submitted</h3></div>
        {!myReviews ? <Loading /> : myReviews.length === 0 ? (
          <div className="p-5 text-sm text-sage">No reviews yet. Approve a completed job, then submit a review above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-pine/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Hiring Organization</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Comment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm font-medium text-charcoal">{r.organization?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{r.provider?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-charcoal">{r.overallRating} / 5</td>
                    <td className="px-4 py-3 max-w-xs text-sm text-sage">{r.comments || "—"}</td>
                    <td className="px-4 py-3 text-sm text-sage">{dateShort(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
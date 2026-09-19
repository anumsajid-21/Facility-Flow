"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, Sparkles } from "lucide-react";
import { serviceRequestsApi, quotationsApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, Loading, StatusBadge, Tabs } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { money, dateShort } from "@/lib/utils";

const VIEWS = [{ key: "overview", label: "Overview" }, { key: "quotations", label: "Quotations" }];

export default function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [sr, setSr] = useState<any | null>(null);
  const [quotations, setQuotations] = useState<any[] | null>(null);
  const [view, setView] = useState("overview");
  const [busy, setBusy] = useState("");

  useEffect(() => { serviceRequestsApi.get(id).then(setSr).catch(() => setSr(undefined)); }, [id]);

  const isHiring = user?.role === "HIRING_ORG" || user?.role === "ADMIN";
  const isProvider = user?.role === "PROVIDER";

  const loadQuotes = useCallback(() => quotationsApi.forRequest(id).then(setQuotations).catch(() => setQuotations([])), [id]);

  const submit = async () => {
    setBusy("submit");
    try { await serviceRequestsApi.submit(id); toast.success("Submitted", "Request is now open for quotes."); const r = await serviceRequestsApi.get(id); setSr(r); }
    catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };
  const accept = async (qid: string) => {
    setBusy(qid);
    try { await quotationsApi.accept(qid); toast.success("Quotation accepted"); loadQuotes(); }
    catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const recommended = quotations?.filter((q) => ["SUBMITTED", "SHORTLISTED", "UNDER_REVIEW"].includes(q.status)).sort((a, b) => Number(a.price) - Number(b.price))[0];

  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (sr?.status === "OPEN" && isHiring) {
      loadQuotes();
      serviceRequestsApi.matches(id).then((res) => {
        setMatches(res.providers || []);
      }).catch(() => setMatches([]));
    }
  }, [id, sr?.status, isHiring, loadQuotes]);

  if (sr === undefined) return <div className="rounded-xl border border-border bg-ivory p-6 text-sm text-sage">Request not found.</div>;
  if (!sr) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title={sr.title || "Service request"} subtitle={`${sr.organization?.name || "Request"} · Created ${dateShort(sr.createdAt)}`} actions={<><StatusBadge status={sr.status} /><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button></>} />

      <div className="flex flex-wrap items-center gap-4">
        <Tabs tabs={VIEWS.map((v) => ({ ...v, count: v.key === "quotations" ? quotations?.length ?? 0 : undefined }))} active={view} onChange={setView} />
        {isHiring && sr.status === "DRAFT" && <Button onClick={submit} loading={busy === "submit"}>Publish for quotes</Button>}
      </div>

      {view === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-charcoal">Details</h3></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <span className="flex items-center gap-2 text-sm text-sage"><MapPin className="h-4 w-4 text-pine" /> {sr.building?.name || "Building"}{sr.floor?.name ? ` · ${sr.floor.name}` : ""}{sr.area?.name ? ` · ${sr.area.name}` : ""}</span>
              {sr.preferredDate && <span className="flex items-center gap-2 text-sm text-sage"><Calendar className="h-4 w-4 text-pine" /> {dateShort(sr.preferredDate)}</span>}
              {sr.budget && <span className="text-sm text-sage">Budget: <span className="font-semibold text-charcoal">{money(sr.budget)}</span></span>}
              {sr.priority && <span className="text-sm text-sage">Priority: <span className="font-medium text-charcoal">{sr.priority}</span></span>}
            </div>
            <p className="border-t border-border px-5 py-4 text-sm text-sage">{sr.description}</p>
          </Card>

          <div className="space-y-4">
            {sr.quotations?.length > 0 && (
              <Card className="p-5">
                <p className="text-xs text-sage">Quotations received</p>
                <p className="mt-1 text-2xl font-bold text-charcoal">{sr.quotations.length}</p>
              </Card>
            )}

            {isHiring && matches.length > 0 && (
              <Card>
                <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                  <h4 className="font-semibold text-charcoal text-sm">Suggested Providers</h4>
                  <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs font-semibold text-pine">{matches.length} matches</span>
                </div>
                <div className="divide-y divide-border p-2">
                  {matches.map((m: any) => (
                    <div key={m.id || m.providerId} className="p-3 hover:bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-charcoal">{m.name || m.providerName}</span>
                        {m.matchScore && <span className="text-xs font-bold text-pine">{Math.round(m.matchScore * 100)}% match</span>}
                      </div>
                      {m.reason && <p className="mt-1 text-xs text-sage">{m.reason}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {view === "quotations" && (
        <div>
          {quotations === null ? <Loading /> : quotations.length === 0 ? (
            <Card className="p-10 text-center text-sm text-sage">{isProvider ? "Submit a quotation for this open request." : "No quotations yet."}</Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {quotations.map((q) => (
                <Card key={q.id} className={`p-5 ${q.status === "ACCEPTED" || recommended?.id === q.id ? "border-pine ring-1 ring-pine/30" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brass-soft font-bold text-[#7A5E2E]">{q.provider?.name?.slice(0, 1).toUpperCase()}</div>
                    <div className="flex flex-col items-end gap-1"><StatusBadge status={q.status} />{recommended?.id === q.id && <span className="flex items-center gap-1 text-[11px] font-bold text-pine"><Sparkles className="h-3 w-3" /> Recommended</span>}</div>
                  </div>
                  <h4 className="mt-3 font-semibold text-charcoal">{q.provider?.name || "Provider"}</h4>
                  <p className="mt-1 text-2xl font-bold text-charcoal">{money(q.price)}</p>
                  {q.numberOfWorkers && <p className="mt-1 text-xs text-sage">{q.numberOfWorkers} workers{q.duration ? ` · ${q.duration}` : ""}</p>}
                  {isHiring && q.status !== "ACCEPTED" && ["SUBMITTED", "SHORTLISTED", "UNDER_REVIEW"].includes(q.status) && (
                    <Button className="mt-4 w-full" size="sm" loading={busy === q.id} onClick={() => accept(q.id)}>Accept quotation</Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
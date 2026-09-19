"use client";
import { useEffect, useState } from "react";
import { Quote, Check, Plus, FileText, Send, Sparkles } from "lucide-react";
import { quotationsApi, serviceRequestsApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, EmptyState, Loading, StatusBadge, Modal, Field, Input, Textarea, Tabs } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { money, dateShort, humanize } from "@/lib/utils";
import { useConfirm } from "@/components/ui/kit";

const toDays = (value: any) => {
  const match = String(value || "").toLowerCase().match(/(\d+(?:\.\d+)?)\s*(hour|day|week|month)/);
  return match ? Number(match[1]) * ({ hour: 1 / 24, day: 1, week: 7, month: 30 } as any)[match[2]] : 14;
};

function recommendationScore(quote: any, quotes: any[]) {
  const prices = quotes.map((q) => Number(q.price)).filter((price) => price > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : Number(quote.price);
  const priceScore = Number(quote.price) > 0 ? lowestPrice / Number(quote.price) : 0;
  const durationDays = toDays(quote.duration);
  const fastest = Math.min(...quotes.map((q) => toDays(q.duration)));
  const speedScore = fastest / Math.max(durationDays, fastest);
  const detailScore = [quote.sla, quote.warranty, quote.terms, quote.notes].filter(Boolean).length / 4;
  return priceScore * 0.55 + speedScore * 0.25 + detailScore * 0.2;
}

const ELIGIBLE_STATUSES = ["SUBMITTED", "SHORTLISTED", "UNDER_REVIEW"];

function recommendedQuote(quotes: any[]) {
  return quotes.filter((q) => ELIGIBLE_STATUSES.includes(q.status)).sort((a, b) => recommendationScore(b, quotes) - recommendationScore(a, quotes))[0];
}

/** Human-readable "why" for the recommended quote. Only meaningful when
 *  there are at least two competing quotes to compare against. */
function recommendationReason(quote: any, quotes: any[]): string {
  const eligible = quotes.filter((q) => ELIGIBLE_STATUSES.includes(q.status));
  if (eligible.length < 2) return "";
  const prices = eligible.map((q) => Number(q.price)).filter((p) => p > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  if (lowestPrice != null && Number(quote.price) > 0 && Number(quote.price) === lowestPrice) return "Lowest price";
  const fastest = Math.min(...eligible.map((q) => toDays(q.duration)));
  if (toDays(quote.duration) === fastest) return "Fastest turnaround";
  return "Best overall value";
}

export default function QuotationsPage() {
  const { user } = useAuthStore();
  const isProvider = user?.role === "PROVIDER";
  const [quotations, setQuotations] = useState<any[] | null>(null);
  const [openRequests, setOpenRequests] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"quotations" | "browse">(isProvider ? "browse" : "quotations");
  const [openQuote, setOpenQuote] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [quoteForm, setQuoteForm] = useState({
    price: "", laborCost: "", materialCost: "", numberOfWorkers: "1",
    duration: "", equipment: "", sla: "", warranty: "", terms: "", notes: "",
    expiryDate: "",
  });
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const loadQuotations = () =>
    quotationsApi.list().then((p) => setQuotations(p.data)).catch(() => setQuotations([]));

  const loadOpenRequests = () =>
    quotationsApi.openRequests()
      .then((r) => setOpenRequests(Array.isArray(r) ? r : (r as any)?.items ?? []))
      .catch(() => setOpenRequests([]));

  useEffect(() => {
    loadQuotations();
    if (isProvider) loadOpenRequests();
  }, [isProvider]);

  // Group by service request for org side-by-side comparison
  const uniqueQuotations = Array.from(new Map((quotations ?? []).map((q) => [q.id, q])).values());
  const groups = uniqueQuotations.reduce<Record<string, any[]>>((acc, q) => {
    const id = q.serviceRequestId || "open";
    (acc[id] = acc[id] || []).push(q);
    return acc;
  }, {});
  const all = Object.entries(groups).sort((a, b) =>
    (b[1][0].createdAt || "").localeCompare(a[1][0].createdAt || ""),
  );

  const accept = async (id: string) => {
    const ok = await confirm(
      "Accept this quotation?",
      "Accepting will select this provider and reject competing quotations. A contract will be created automatically.",
      { confirmLabel: "Accept" },
    );
    if (!ok) return;
    setBusy(id);
    try {
      await quotationsApi.accept(id);
      toast.success("Quotation accepted", "Provider selected and contract created.");
      loadQuotations();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(null); }
  };

  const openQuoteModal = (req: any) => {
    setSelectedRequest(req);
    setQuoteForm({ price: "", laborCost: "", materialCost: "", numberOfWorkers: "1", duration: "", equipment: "", sla: "", warranty: "", terms: "", notes: "", expiryDate: "" });
    setOpenQuote(true);
  };

  const submitQuotation = async () => {
    if (submittingQuote) return;
    if (!quoteForm.price || Number(quoteForm.price) <= 0)
      return toast.error("Required", "Please enter a valid price.");
    setSubmittingQuote(true);
    try {
      const created = await quotationsApi.create({
        serviceRequestId: selectedRequest.id,
        price: Number(quoteForm.price),
        laborCost: quoteForm.laborCost ? Number(quoteForm.laborCost) : undefined,
        materialCost: quoteForm.materialCost ? Number(quoteForm.materialCost) : undefined,
        numberOfWorkers: Number(quoteForm.numberOfWorkers),
        duration: quoteForm.duration || undefined,
        equipment: quoteForm.equipment || undefined,
        sla: quoteForm.sla || undefined,
        warranty: quoteForm.warranty || undefined,
        terms: quoteForm.terms || undefined,
        notes: quoteForm.notes || undefined,
        expiryDate: quoteForm.expiryDate ? new Date(quoteForm.expiryDate).toISOString() : undefined,
      });
      // immediately submit so org can see it
      await quotationsApi.submit(created.id);
      toast.success("Quotation submitted", "The organization can now review your proposal.");
      setOpenQuote(false);
      loadQuotations();
      loadOpenRequests();
      setTab("quotations");
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setSubmittingQuote(false); }
  };

  const withdraw = async (id: string) => {
    const ok = await confirm("Withdraw quotation?", "This will remove your proposal from this request.", { confirmLabel: "Withdraw", danger: true });
    if (!ok) return;
    setBusy(id);
    try {
      await quotationsApi.withdraw(id);
      toast.success("Quotation withdrawn");
      loadQuotations();
    } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(null); }
  };

  const tabs = isProvider
    ? [
        { key: "browse", label: "Browse Requests", count: openRequests.length },
        { key: "quotations", label: "My Quotations", count: quotations?.length ?? 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle={isProvider ? "Submit proposals for open service requests" : "Compare provider proposals and select a partner"}
      />

      {isProvider && (
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={(k) => setTab(k as any)}
        />
      )}

      {/* ── Provider: Browse open requests ── */}
      {isProvider && tab === "browse" && (
        <>
          {openRequests.length === 0 ? (
            <Card><EmptyState icon={<FileText className="h-6 w-6" />} title="No open requests" description="There are no open service requests to quote on right now." /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {openRequests.map((req) => {
                const alreadyQuoted = (quotations ?? []).some((q) => q.serviceRequestId === req.id);
                return (
                  <Card key={req.id}>
                    <div className="flex items-start justify-between border-b border-border px-5 py-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-charcoal">{req.title}</h3>
                        <p className="text-xs text-sage">{req.organization?.name} · {req.building?.name}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="space-y-3 p-5">
                      {req.description && <p className="line-clamp-2 text-sm text-sage">{req.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sage">
                        {req.budget && <span>Budget: <span className="font-medium text-charcoal">{money(req.budget)}</span></span>}
                        {req.preferredDate && <span>Needed by: <span className="font-medium text-charcoal">{dateShort(req.preferredDate)}</span></span>}
                        {req.priority && <span>Priority: <span className="font-medium text-charcoal">{humanize(req.priority)}</span></span>}
                      </div>
                      <div className="pt-1">
                        {alreadyQuoted ? <p className="text-sm font-medium text-pine">✓ Already quoted</p> : <Button className="w-full" onClick={() => openQuoteModal(req)}><Plus className="h-4 w-4" /> Submit Quotation</Button>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Provider: My quotations ── */}
      {isProvider && tab === "quotations" && (
        <>
          {!quotations ? <Loading /> : quotations.length === 0 ? (
            <Card><EmptyState icon={<Quote className="h-6 w-6" />} title="No quotations yet" description="Browse open requests and submit your first quotation." action={<Button onClick={() => setTab("browse")}><Plus className="h-4 w-4" /> Browse Requests</Button>} /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {quotations.map((q) => (
                <Card key={q.id} className={`p-5 ${q.status === "ACCEPTED" ? "border-pine ring-1 ring-pine/30" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-charcoal">{q.serviceRequest?.title || "Service request"}</h4>
                      <p className="text-xs text-sage">{dateShort(q.createdAt)}</p>
                    </div>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-charcoal">{money(q.price)}</p>
                  {q.duration && <p className="text-sm text-sage">Duration: {q.duration}</p>}
                  {q.numberOfWorkers && <p className="text-sm text-sage">Workers: {q.numberOfWorkers}</p>}
                  {["DRAFT", "SUBMITTED"].includes(q.status) && (
                    <div className="mt-3 border-t border-border pt-3">
                      <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10" loading={busy === q.id} onClick={() => withdraw(q.id)}>
                        Withdraw
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Hiring org: Compare & accept (provider-style cards) ── */}
      {!isProvider && (
        <>
          {!quotations ? <Loading /> : all.length === 0 ? (
            <Card><EmptyState icon={<Quote className="h-6 w-6" />} title="No quotations" description="Provider proposals will appear here for comparison once you submit service requests." /></Card>
          ) : (
            <div className="space-y-8">
              {all.map(([requestId, list]) => {
                const recommended = recommendedQuote(list);
                const competingCount = list.filter((q) => ELIGIBLE_STATUSES.includes(q.status)).length;
                const hasComparison = competingCount >= 2;
                const request = list[0].serviceRequest;
                return (
                  <section key={requestId} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div>
                        <h2 className="font-semibold text-charcoal">{request?.category?.name || request?.title || "Service task"}</h2>
                        {request?.category?.name && <p className="text-xs text-sage">{request.title}</p>}
                      </div>
                      <span className="text-xs font-medium text-sage">{list.length} quotation{list.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                      {list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map((q) => {
                        const accepted = q.status === "ACCEPTED";
                        // Only badge a recommendation when there is a real
                        // comparison (2+ eligible quotes) — a lone quote
                        // isn't "recommended", it's just the only option.
                        const recommendedForTask = hasComparison && recommended?.id === q.id;
                        const reason = recommendedForTask ? recommendationReason(q, list) : "";
                        return (
                          <Card key={q.id} className={`flex flex-col ${accepted || recommendedForTask ? "border-pine ring-1 ring-pine/30" : ""}`}>
                            <div className="flex items-start justify-between border-b border-border px-5 py-4">
                              <div className="min-w-0">
                                <h3 className="truncate font-semibold text-charcoal">{q.provider?.name || "Provider"}</h3>
                                <p className="truncate text-xs text-sage">{q.serviceRequest?.title || "Service request"}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge status={q.status} />
                                {recommendedForTask && (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-pine" title={`Recommended: ${reason}`}>
                                    <Sparkles className="h-3 w-3" /> Recommended{reason && <span className="font-semibold text-pine/70">· {reason}</span>}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-1 flex-col p-5">
                              <p className="text-2xl font-bold text-charcoal">{money(q.price)}</p>
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sage">
                                {q.duration && <span>Duration: <span className="font-medium text-charcoal">{q.duration}</span></span>}
                                {q.numberOfWorkers && <span>Workers: <span className="font-medium text-charcoal">{q.numberOfWorkers}</span></span>}
                                {q.sla && <span>SLA: <span className="font-medium text-charcoal">{q.sla}</span></span>}
                                {q.expiryDate && <span>Expires: <span className="font-medium text-charcoal">{dateShort(q.expiryDate)}</span></span>}
                              </div>
                              {q.terms && <p className="mt-3 line-clamp-2 text-xs text-sage">{q.terms}</p>}
                              <div className="mt-auto pt-4">
                                <Button className="w-full" disabled={accepted || q.status === "REJECTED"} loading={busy === q.id} onClick={() => accept(q.id)}>
                                  {accepted ? <><Check className="h-4 w-4" /> Selected</> : "Accept quotation"}
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Submit Quotation Modal */}
      <Modal open={openQuote} onClose={() => setOpenQuote(false)} title={`Quote: ${selectedRequest?.title}`} wide>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-sage">
            {selectedRequest?.description}
            {selectedRequest?.budget && <span className="ml-2 font-medium text-charcoal">Budget: {money(selectedRequest.budget)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total price *">
              <Input type="number" min={0} value={quoteForm.price} onChange={(e) => setQuoteForm({ ...quoteForm, price: e.target.value })} placeholder="5000" />
            </Field>
            <Field label="Number of workers">
              <Input type="number" min={1} value={quoteForm.numberOfWorkers} onChange={(e) => setQuoteForm({ ...quoteForm, numberOfWorkers: e.target.value })} />
            </Field>
            <Field label="Labor cost">
              <Input type="number" min={0} value={quoteForm.laborCost} onChange={(e) => setQuoteForm({ ...quoteForm, laborCost: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Material cost">
              <Input type="number" min={0} value={quoteForm.materialCost} onChange={(e) => setQuoteForm({ ...quoteForm, materialCost: e.target.value })} placeholder="Optional" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration">
              <Input value={quoteForm.duration} onChange={(e) => setQuoteForm({ ...quoteForm, duration: e.target.value })} placeholder="e.g. 3 days" />
            </Field>
            <Field label="Expiry date">
              <Input type="date" value={quoteForm.expiryDate} onChange={(e) => setQuoteForm({ ...quoteForm, expiryDate: e.target.value })} />
            </Field>
          </div>
          <Field label="SLA">
            <Input value={quoteForm.sla} onChange={(e) => setQuoteForm({ ...quoteForm, sla: e.target.value })} placeholder="e.g. 24hr response time" />
          </Field>
          <Field label="Warranty">
            <Input value={quoteForm.warranty} onChange={(e) => setQuoteForm({ ...quoteForm, warranty: e.target.value })} placeholder="e.g. 6 months parts & labor" />
          </Field>
          <Field label="Terms & conditions">
            <Textarea value={quoteForm.terms} onChange={(e) => setQuoteForm({ ...quoteForm, terms: e.target.value })} placeholder="Payment terms, conditions…" />
          </Field>
          <Field label="Notes">
            <Textarea value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="Additional notes for the client…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenQuote(false)}>Cancel</Button>
            <Button loading={submittingQuote} onClick={submitQuotation}><Send className="h-4 w-4" /> Submit Quotation</Button>
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
}
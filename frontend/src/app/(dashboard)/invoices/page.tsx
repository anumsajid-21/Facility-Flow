"use client";
import { useEffect, useState } from "react";
import { ReceiptText, Eye } from "lucide-react";
import { invoicesApi, apiError } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, EmptyState, Loading, StatusBadge, Modal, Field, Input, Tabs } from "@/components/ui/kit";
import { PaymentHistoryContent } from "@/components/payments/PaymentHistoryContent";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { money, dateShort, timeShort } from "@/lib/utils";

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const isOrg = user?.role === "HIRING_ORG" || user?.role === "ADMIN";
  const isProvider = user?.role === "PROVIDER";
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", date: "", paymentMethod: "BANK_TRANSFER" });
  const [busy, setBusy] = useState("");

  const load = () => invoicesApi.list().then((p) => setInvoices(p.data)).catch(() => setInvoices([]));
  useEffect(() => { load(); }, []);

  const openDetail = async (inv: any) => {
    setDetail(inv);
    try {
      const d = await invoicesApi.get(inv.id);
      setDetail(d);
      setPayForm((f) => ({ ...f, amount: String(Number(d.balance ?? 0) > 0 ? d.balance : "") }));
    } catch { /* keep row data */ }
  };

  const recordPayment = async () => {
    if (busy === "pay" || !detail) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error("Required", "Enter a payment amount.");
    setBusy("pay");
    try {
      await invoicesApi.addPayment(detail.id, {
        amount: Number(payForm.amount),
        date: payForm.date || undefined,
        paymentMethod: payForm.paymentMethod,
      });
      toast.success("Payment recorded");
      setPayForm({ amount: "", date: "", paymentMethod: "BANK_TRANSFER" });
      const d = await invoicesApi.get(detail.id);
      setDetail(d);
      load();
    } catch (e: any) { toast.error("Failed", apiError(e)); } finally { setBusy(""); }
  };

  const changeStatus = async (inv: any, status: string) => {
    setBusy(inv.id);
    try { await invoicesApi.updateStatus(inv.id, status); toast.success("Status updated"); await load(); const d = await invoicesApi.get(inv.id); setDetail(d); }
    catch (e: any) { toast.error("Failed", apiError(e)); } finally { setBusy(""); }
  };

  const totalOutstanding = (invoices ?? []).filter((i) => i.status === "PENDING" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.total ?? 0), 0);
  const [view, setView] = useState("invoices");

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices & Payments" subtitle={isProvider ? "Invoices and earnings for your completed jobs" : "Billing and payments across active contracts"} />
      <Tabs tabs={[{ key: "invoices", label: "Invoices", count: invoices?.length }, { key: "payments", label: "Payment History" }]} active={view} onChange={(k) => setView(k as string)} />

      {view === "payments" ? <PaymentHistoryContent /> : (
      <>
     
      {invoices && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4"><p className="text-xs text-sage">Total billed</p><p className="mt-1 text-2xl font-bold text-charcoal">{money(invoices.reduce((s, i) => s + Number(i.total ?? 0), 0))}</p></Card>
          <Card className="p-4"><p className="text-xs text-sage">Outstanding</p><p className="mt-1 text-2xl font-bold text-terracotta">{money(totalOutstanding)}</p></Card>
          <Card className="p-4"><p className="text-xs text-sage">Invoice count</p><p className="mt-1 text-2xl font-bold text-charcoal">{invoices.length}</p></Card>
        </div>
      )}

      {!invoices ? <Loading /> : invoices.length === 0 ? (
        <Card><EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No invoices" description="Invoices are generated for completed, approved jobs." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-pine/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-charcoal">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-semibold text-charcoal">{money(inv.total)}</td>
                    <td className="px-4 py-3 text-sm text-sage">{dateShort(inv.dueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-sm text-sage">{dateShort(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetail(inv)}><Eye className="h-4 w-4" /> View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.invoiceNumber ?? ""}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex justify-end border-b border-border pb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const token = localStorage.getItem("token");
                  fetch(invoicesApi.pdfUrl(detail.id), {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                    .then((res) => res.blob())
                    .then((blob) => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${detail.invoiceNumber || "Invoice"}.pdf`;
                      a.click();
                    })
                    .catch(() => toast.error("Download failed", "Could not export PDF."));
                }}
              >
                Download PDF
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-sage">Provider</p><p className="font-medium text-charcoal">{detail.provider?.name ?? "â€”"}</p></div>
              <div><p className="text-xs text-sage">Organization</p><p className="font-medium text-charcoal">{detail.organization?.name ?? "â€”"}</p></div>
              <div><p className="text-xs text-sage">Service</p><p className="font-medium text-charcoal">{detail.contract?.serviceName ?? detail.job?.serviceName ?? "â€”"}</p></div>
              <div><p className="text-xs text-sage">Due date</p><p className="font-medium text-charcoal">{dateShort(detail.dueDate)}</p></div>
              <div><p className="text-xs text-sage">Amount</p><p className="font-medium text-charcoal">{money(detail.amount)}</p></div>
              <div><p className="text-xs text-sage">Total</p><p className="font-medium text-charcoal">{money(detail.total)}</p></div>
              <div><p className="text-xs text-sage">Status</p><StatusBadge status={detail.status} /></div>
              <div><p className="text-xs text-sage">Total paid</p><p className="font-medium text-charcoal">{money(detail.totalPaid ?? 0)}</p></div>
              <div><p className="text-xs text-sage">Balance</p><p className="font-medium text-charcoal">{money(detail.balance ?? detail.total)}</p></div>
            </div>

            {isProvider && (
              <Field label="Update status">
                <select className="h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm" value={detail.status} disabled={busy === detail.id} onChange={(e) => changeStatus(detail, e.target.value)}>
                  {["DRAFT", "ISSUED", "PENDING", "OVERDUE", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-sage">Payments</p>
              {!detail.payments || detail.payments.length === 0 ? <p className="text-sm text-sage">No payments recorded yet.</p> : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {detail.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-charcoal">{money(p.amount)}</p>
                        <p className="text-xs text-sage">{dateShort(p.date)} {timeShort(p.date)} Â· {p.paymentMethod} Â· Ref: {p.paymentReference}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOrg && detail.status !== "PAID" && detail.status !== "CANCELLED" && (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 text-sm font-semibold text-charcoal">Record payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount *"><Input type="number" min={0} step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
                  <Field label="Payment date"><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></Field>
                  <Field label="Method">
                    <select className="h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm" value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                      {["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button loading={busy === "pay"} onClick={recordPayment}>Record payment</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      </>
      )}
    </div>
  );
}

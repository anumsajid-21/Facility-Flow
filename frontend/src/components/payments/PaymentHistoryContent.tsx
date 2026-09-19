"use client";

import { useEffect, useState } from "react";
import { ReceiptText, Download, Filter } from "lucide-react";
import { invoicesApi, apiError, providersApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, EmptyState, Loading, StatusBadge, Field, Input } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { money, dateShort } from "@/lib/utils";

export function PaymentHistoryContent() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [providers, setProviders] = useState<any[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", providerId: "", category: "" });

  const isProvider = user?.role === "PROVIDER";

  const load = () => {
    invoicesApi
      .paymentHistory({
        from: filters.from || undefined,
        to: filters.to || undefined,
        providerId: filters.providerId || undefined,
        category: filters.category || undefined,
      })
      .then((res) => {
        setRows(res?.data ?? []);
        setTotal(res?.total ?? 0);
      })
      .catch((e) => {
        toast.error("Failed", apiError(e));
        setRows([]);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("token");
      const url = invoicesApi.paymentHistoryCsvUrl({
        from: filters.from || undefined,
        to: filters.to || undefined,
        providerId: filters.providerId || undefined,
        category: filters.category || undefined,
      });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export ready", "CSV downloaded.");
    } catch {
      toast.error("Export failed", "Could not download the CSV.");
    }
  };

  useEffect(() => {
    if (!isProvider) providersApi.list({ limit: 100 }).then((p) => setProviders(p.data)).catch(() => setProviders([]));
  }, [isProvider]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 pb-2.5 text-sm font-medium text-charcoal">
            <Filter className="h-4 w-4 text-sage" /> Filters
          </div>
          <Field label="From">
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </Field>
          {!isProvider && (
            <Field label="Provider">
              <select
                className="h-10 rounded-lg border border-input bg-ivory px-3 text-sm"
                value={filters.providerId}
                onChange={(e) => setFilters({ ...filters, providerId: e.target.value })}
              >
                <option value="">All providers</option>
                {providers.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Category">
            <Input value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="e.g. Cleaning" />
          </Field>
          <Button onClick={load}>Apply</Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold text-charcoal">
            <ReceiptText className="h-4 w-4 text-terracotta" /> Transactions
          </h3>
          <span className="text-sm font-semibold text-pine">Total: {money(total)}</span>
        </div>
        {rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ReceiptText className="h-8 w-8 text-sage" />} title="No payments found" description="No payment records match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-sage">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">{isProvider ? "Organization" : "Provider"}</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sand/40">
                    <td className="px-5 py-3 text-sage">{dateShort(r.date)}</td>
                    <td className="px-5 py-3 font-medium text-charcoal">{r.invoiceNumber}</td>
                    <td className="px-5 py-3 text-charcoal">{isProvider ? r.organizationName : r.providerName}</td>
                    <td className="px-5 py-3 text-sage">{r.category}</td>
                    <td className="px-5 py-3 text-right font-semibold text-pine">{money(r.amount)}</td>
                    <td className="px-5 py-3 text-sage">{r.method}</td>
                    <td className="px-5 py-3 text-sage">{r.reference}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status === "COMPLETED" ? "PAID" : r.status} />
                    </td>
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


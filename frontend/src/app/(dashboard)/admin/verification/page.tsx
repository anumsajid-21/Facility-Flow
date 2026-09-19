"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Shield, XCircle } from "lucide-react";
import { adminApi, apiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Loading, PageHeader, StatusBadge } from "@/components/ui/kit";
import { toast } from "@/store/toast";

export default function VerificationQueuePage() {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const load = () => adminApi.verificationQueue().then(setDocs).catch(() => setDocs([]));
  useEffect(() => { load(); }, []);
  const review = async (status: "APPROVED" | "REJECTED") => { if (!selected.length) return; try { await adminApi.bulkReviewDocuments(selected, status, notes); toast.success("Documents reviewed", `${selected.length} document(s) updated`); setSelected([]); setNotes(""); load(); } catch (e) { toast.error("Review failed", apiError(e)); } };
  return <div className="space-y-6"><PageHeader title="Verification queue" subtitle="Review provider documents and keep compliance current." />
    {!docs ? <Loading /> : docs.length === 0 ? <Card><EmptyState icon={<Shield className="h-6 w-6" />} title="Queue is clear" description="No provider documents require review." /></Card> : <Card className="overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-border p-4"><Button size="sm" onClick={() => review("APPROVED")} disabled={!selected.length}><CheckCircle2 className="mr-1 h-4 w-4" /> Approve selected</Button><Button size="sm" variant="outline" onClick={() => review("REJECTED")} disabled={!selected.length}><XCircle className="mr-1 h-4 w-4" /> Reject selected</Button><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review note (optional)" className="min-w-48 flex-1 rounded-lg border border-border px-3 py-2 text-sm" /></div><div className="divide-y divide-border">{docs.map((doc) => <label key={doc.id} className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-muted/40"><input type="checkbox" checked={selected.includes(doc.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, doc.id] : selected.filter((id) => id !== doc.id))} /><div className="min-w-0 flex-1"><p className="font-medium text-charcoal">{doc.provider?.name} · {doc.documentType}</p><p className="text-xs text-sage">{doc.file?.originalName} {doc.expiresAt ? `· Expires ${new Date(doc.expiresAt).toLocaleDateString()}` : ""}</p></div><StatusBadge status={doc.status} /></label>)}</div></Card>}
  </div>;
}

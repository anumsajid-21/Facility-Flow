"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSignature, Building2, HardHat } from "lucide-react";
import { contractsApi } from "@/services/api";
import { Card, PageHeader, EmptyState, Loading, StatusBadge } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { money, dateShort } from "@/lib/utils";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[] | null>(null);
  useEffect(() => { contractsApi.list({ limit: 50 }).then((p) => setContracts(p.data)).catch(() => setContracts([])); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Contracts" subtitle="Active agreements and their related jobs" />

      {!contracts ? <Loading /> : contracts.length === 0 ? (
        <Card><EmptyState icon={<FileSignature className="h-6 w-6" />} title="No contracts yet" description="Contracts are created once a quotation is accepted." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {contracts.map((c) => (
            <Link key={c.id} href={`/contracts/${c.id}`} className="group min-w-0">
              <Card className="flex h-full flex-col transition-all group-hover:border-brass group-hover:shadow-raised">
                <div className="flex items-start justify-between border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-charcoal group-hover:text-pine">{c.title || c.serviceName || "Contract"}</h3>
                    <p className="truncate text-xs text-sage">{c.provider?.name || "Provider"} · {c.organization?.name}</p>
                  </div>
                  <StatusBadge status={c.status} className="shrink-0" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-2xl font-bold text-charcoal">{money(c.price)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sage">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {c.building?.name || "—"}</span>
                    <span className="flex items-center gap-1"><HardHat className="h-3.5 w-3.5" /> {c.jobs?.length ?? 0} jobs</span>
                    <span>{dateShort(c.startDate)}{c.endDate ? ` – ${dateShort(c.endDate)}` : ""}</span>
                    {c.frequency && <span className="font-medium text-charcoal">{c.frequency}</span>}
                  </div>
                  <div className="mt-auto pt-4">
                    <Button variant="outline" className="w-full">View details</Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
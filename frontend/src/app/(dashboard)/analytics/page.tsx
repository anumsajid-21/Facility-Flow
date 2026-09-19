"use client";
import { useEffect, useState } from "react";
import { BarChart3, Download, Star, Building2, Users, Wallet, Layers } from "lucide-react";
import { analyticsApi, facilitiesApi } from "@/services/api";
import { Card, EmptyState, Loading, PageHeader, Tabs } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

const PALETTE = ["#0E3B4D", "#F2A65A", "#7FA9B8", "#145A6E", "#8C8171", "#D9903E", "#5E8CA0", "#C9A66B"];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[] | null>(null);
  const [range, setRange] = useState("365");
  const [tab, setTab] = useState("spend");
  const getParams = () => ({ from: new Date(Date.now() - Number(range) * 864e5).toISOString(), to: new Date().toISOString() });
  const download = async () => { const response = await analyticsApi.exportCsv(getParams()); const url = URL.createObjectURL(response.data); const link = document.createElement("a"); link.href = url; link.download = "facilityflow-analytics.csv"; link.click(); URL.revokeObjectURL(url); };
  useEffect(() => {
    setData(null);
    analyticsApi.spend({ from: new Date(Date.now() - Number(range) * 864e5).toISOString(), to: new Date().toISOString() }).then(setData).catch(() => setData({ monthly: [], byCategory: [], byProvider: [], scorecards: [] }));
  }, [range]);
  useEffect(() => { facilitiesApi.buildings().then((p) => setBuildings(p.data)).catch(() => setBuildings([])); }, []);
  if (!data) return <Loading />;

  const monthly = data.monthly ?? [];
  const max = Math.max(1, ...monthly.map((x: any) => Number(x.amount)));
  const totalSpend = (data.monthly ?? []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const topProvider = [...(data.byProvider ?? [])].sort((a: any, b: any) => Number(b.amount) - Number(a.amount))[0];
  const catMax = Math.max(1, ...(data.byCategory ?? []).map((x: any) => x.amount));
  const totalFloors = (buildings ?? []).reduce((s: number, b: any) => s + (b.floors?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Spend, provider performance and facility coverage."
        actions={<><select value={range} onChange={(e) => setRange(e.target.value)} className="h-10 rounded-lg border border-input bg-ivory px-3 text-sm"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></select><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" /> Export CSV</Button></>} />
      <Tabs tabs={[{ key: "spend", label: "Spend" }, { key: "providers", label: "Providers" }, { key: "buildings", label: "Buildings" }]} active={tab} onChange={(k) => setTab(k as string)} />

      {tab === "spend" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-sage">Total spend</p><Wallet className="h-4 w-4 text-pine" /></div><p className="mt-1 text-xl font-bold text-charcoal">{money(totalSpend)}</p></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-sage">Top provider</p><Users className="h-4 w-4 text-pine" /></div><p className="mt-1 truncate text-sm font-semibold text-charcoal">{topProvider?.name ?? "—"}</p><p className="text-xs text-sage">{topProvider ? money(topProvider.amount) : ""}</p></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-sage">Categories</p><Layers className="h-4 w-4 text-pine" /></div><p className="mt-1 text-xl font-bold text-charcoal">{data.byCategory?.length ?? 0}</p></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-sage">Months tracked</p><BarChart3 className="h-4 w-4 text-pine" /></div><p className="mt-1 text-xl font-bold text-charcoal">{data.monthly?.length ?? 0}</p></Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-charcoal">Spend over time</h2><span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">PKR</span></div>
              {monthly.length ? (
                <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="relative h-40">
                    <div className="absolute inset-x-0 bottom-5 border-b border-border" />
                    <div className="absolute inset-x-0 top-1/2 border-b border-border/70" />
                    {monthly.length === 1 ? (
                      <div className="absolute inset-x-0 bottom-5 flex flex-col items-center">
                        <span className="mb-2 rounded-full bg-pine px-2.5 py-1 text-[11px] font-semibold text-ivory">{money(monthly[0].amount)}</span>
                        <span className="h-3 w-3 rounded-full border-2 border-ivory bg-pine shadow-card" title={money(monthly[0].amount)} />
                      </div>
                    ) : (
                      <div className="absolute inset-x-0 bottom-5 flex h-32 items-end gap-2">
                        {monthly.map((row: any) => (
                          <div key={row.period} className="group flex flex-1 flex-col items-center justify-end">
                            <span className="mb-1 text-[10px] font-medium text-pine opacity-0 transition-opacity group-hover:opacity-100">{money(row.amount)}</span>
                            <span className="w-3 rounded-full bg-pine transition-all group-hover:bg-terracotta" style={{ height: `${Math.max(8, (Number(row.amount) / max) * 112)}px` }} title={money(row.amount)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-sage">
                    {monthly.map((row: any) => <span key={row.period}>{row.period.slice(5)}</span>)}
                  </div>
                </div>
              ) : <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No invoice data yet" />}
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold text-charcoal">Spend by category</h2>
              <div className="mt-4 space-y-3">
                {data.byCategory?.length ? data.byCategory.map((row: any, i: number) => (
                  <div key={row.category}>
                    <div className="flex justify-between text-sm"><span className="text-charcoal">{row.category}</span><span className="font-medium text-pine">{money(row.amount)}</span></div>
                    <div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (row.amount / catMax) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} /></div>
                  </div>
                )) : <p className="text-sm text-sage">No category data yet.</p>}
              </div>
            </Card>
          </div>
        </>
      )}


      {tab === "providers" && (
        <>
          <Card className="p-5">
            <h2 className="font-semibold text-charcoal">Spend by provider</h2>
            <div className="mt-4 space-y-3">
              {data.byProvider?.length ? [...data.byProvider].sort((a: any, b: any) => Number(b.amount) - Number(a.amount)).map((row: any, i: number) => {
                const pMax = Math.max(1, ...(data.byProvider ?? []).map((x: any) => x.amount));
                return (
                  <div key={row.id}>
                    <div className="flex justify-between text-sm"><span className="text-charcoal">{row.name}</span><span className="font-medium text-pine">{money(row.amount)}</span></div>
                    <div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (row.amount / pMax) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} /></div>
                  </div>
                );
              }) : <p className="text-sm text-sage">No provider spend yet.</p>}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5"><h2 className="font-semibold text-charcoal">Provider scorecards</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-sage"><tr><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Rating</th><th className="px-5 py-3">Jobs</th><th className="px-5 py-3">Rework</th><th className="px-5 py-3">SLA breaches</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.scorecards?.map((row: any) => (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className="px-5 py-3 font-medium text-charcoal">{row.name}</td>
                      <td className="px-5 py-3 text-brass"><Star className="mr-1 inline h-4 w-4" />{row.averageRating.toFixed(1)}</td>
                      <td className="px-5 py-3 text-sage">{row.jobs}</td>
                      <td className="px-5 py-3 text-sage">{row.reworkRate}%</td>
                      <td className="px-5 py-3 text-sage">{row.slaBreaches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "buildings" && (
        !buildings ? <Loading /> : buildings.length === 0 ? (
          <Card><EmptyState icon={<Building2 className="h-6 w-6" />} title="No buildings yet" /></Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-sage">Buildings</p><Building2 className="h-4 w-4 text-pine" /></div><p className="mt-1 text-xl font-bold text-charcoal">{buildings.length}</p></Card>
              <Card className="p-4"><p className="text-xs text-sage">Floors tracked</p><p className="mt-1 text-xl font-bold text-charcoal">{totalFloors}</p></Card>
              <Card className="p-4"><p className="text-xs text-sage">Cities</p><p className="mt-1 text-xl font-bold text-charcoal">{new Set((buildings ?? []).map((b: any) => b.city).filter(Boolean)).size}</p></Card>
              <Card className="p-4"><p className="text-xs text-sage">Avg spend / building</p><p className="mt-1 truncate text-sm font-semibold text-charcoal">{buildings.length ? money(totalSpend / buildings.length) : "—"}</p></Card>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-sage"><tr><th className="px-5 py-3">Building</th><th className="px-5 py-3">City</th><th className="px-5 py-3">Floors</th><th className="px-5 py-3">Areas</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {buildings.map((b: any) => (
                      <tr key={b.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-medium text-charcoal">{b.name}</td>
                        <td className="px-5 py-3 text-sage">{b.city ?? "—"}</td>
                        <td className="px-5 py-3 text-sage">{b.floors?.length ?? 0}</td>
                        <td className="px-5 py-3 text-sage">{(b.floors ?? []).reduce((s: number, f: any) => s + (f.areas?.length ?? 0), 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}

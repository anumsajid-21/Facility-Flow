"use client";
import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Quote, FileSignature, HardHat, AlertTriangle, Clock, ArrowRight, Star, TrendingUp, Briefcase, Users, Building2, Activity } from "lucide-react";
import { analyticsApi, adminApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardHeader } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

function KPI({ label, value, hint, icon, accent }: { label: string; value: string | number; hint?: string; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0"><p className="text-xs font-medium text-sage">{label}</p><p className="mt-1 text-2xl font-bold text-charcoal">{value}</p>{hint && <p className="mt-0.5 truncate text-[11px] text-sage">{hint}</p>}</div>
        <div className={`rounded-lg p-2 ${accent}`}>{icon}</div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user?.role === "ADMIN") {
      adminApi.dashboard().then(setData).catch((e: any) => setError(e?.message || "Failed to load"));
    } else {
      analyticsApi.dashboard().then(setData).catch((e: any) => setError(e?.message || "Failed to load"));
    }
  }, [user?.role]);
  if (!data && !error) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <div className="rounded-xl border border-border bg-ivory p-6 text-sm text-sage">Unable to load dashboard. Please refresh.</div>;
  if (user?.role === "ADMIN") return <AdminCockpit data={data} />;
  return user?.role === "PROVIDER" ? <ProviderCockpit data={data} name={user.name} /> : <HiringCockpit data={data} />;
}

function AdminCockpit({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-charcoal">Admin Dashboard</h1><p className="mt-1 text-sm text-sage">Overview of the entire FacilityFlow platform.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Organizations" value={data.totalOrganizations} icon={<Building2 className="h-4 w-4 text-pine" />} accent="bg-pine/10" />
        <KPI label="Providers" value={data.totalProviders} icon={<Users className="h-4 w-4 text-brass" />} accent="bg-brass-soft" />
        <KPI label="Service Requests" value={data.totalServiceRequests} icon={<FileText className="h-4 w-4 text-terracotta" />} accent="bg-terracotta-soft" />
        <KPI label="Active Contracts" value={data.activeContracts} icon={<FileSignature className="h-4 w-4 text-pine" />} accent="bg-pine/10" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Organizations" />
          <div className="space-y-2 p-2">
            {data.recentOrganizations?.length === 0 ? <p className="px-3 py-6 text-center text-sm text-sage">No organizations yet.</p> : data.recentOrganizations?.map((org: any) => (
              <div key={org.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal">
                <Building2 className="h-4 w-4 text-pine" />
                <span className="flex-1">{org.name}</span>
                <span className="text-xs text-sage">{org.members?.length ?? 0} members</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent Providers" />
          <div className="space-y-2 p-2">
            {data.recentProviders?.length === 0 ? <p className="px-3 py-6 text-center text-sm text-sage">No providers yet.</p> : data.recentProviders?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal">
                <Users className="h-4 w-4 text-brass" />
                <span className="flex-1">{p.name}</span>
                <span className="text-xs text-sage">{p.verificationStatus}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Service Requests" />
          <div className="space-y-2 p-2">
            {data.recentServiceRequests?.length === 0 ? <p className="px-3 py-6 text-center text-sm text-sage">No service requests yet.</p> : data.recentServiceRequests?.map((r: any) => (
              <Link key={r.id} href={`/service-requests/${r.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal transition-colors hover:bg-muted">
                <FileText className="h-4 w-4 text-terracotta" />
                <span className="flex-1">{r.title}</span>
                <span className="text-xs text-sage">{r.organization?.name}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-2 p-4">
            <Link href="/providers"><Button variant="outline" className="w-full">View Providers</Button></Link>
            <Link href="/service-requests"><Button variant="outline" className="w-full">View Requests</Button></Link>
            <Link href="/facilities"><Button variant="outline" className="w-full">View Buildings</Button></Link>
            <Link href="/contracts"><Button variant="outline" className="w-full">View Contracts</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProviderCockpit({ data, name }: { data: any; name: string }) {
  const kpis = [
    { label: "Average rating", value: data.averageRating ? `${data.averageRating.toFixed(1)} stars` : "", hint: `${data.totalReviews} reviews`, icon: <Star className="h-4 w-4 text-brass" />, accent: "bg-brass-soft" },
    { label: "Revenue", value: money(data.revenue), icon: <TrendingUp className="h-4 w-4 text-pine" />, accent: "bg-pine/10" },
    { label: "Active contracts", value: data.activeContracts, icon: <FileSignature className="h-4 w-4 text-pine" />, accent: "bg-pine/10" },
    { label: "Upcoming jobs", value: data.upcomingJobs, icon: <HardHat className="h-4 w-4 text-terracotta" />, accent: "bg-terracotta-soft" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-charcoal">Welcome back, {name}</h1><p className="mt-1 text-sm text-sage">Here is how your operations are tracking.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{kpis.map((k) => <KPI key={k.label} {...k} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Quotations submitted" /><div className="p-5 text-4xl font-bold text-charcoal">{data.quotationsSubmitted}</div></Card>
        <Card><CardHeader title="Requests available" /><div className="flex items-center justify-between p-5"><div className="text-4xl font-bold text-charcoal">{data.requestsReceived}</div><Link href="/quotations"><Button variant="outline" size="sm">Browse <ArrowRight className="h-4 w-4" /></Button></Link></div></Card>
      </div>
    </div>
  );
}

function HiringCockpit({ data }: { data: any }) {
  const needsAttention = [
    data.overdueInvoices > 0 && { text: `${data.overdueInvoices} overdue invoice${data.overdueInvoices > 1 ? "s" : ""}`, to: "/invoices" },
    data.pendingApprovals > 0 && { text: `${data.pendingApprovals} job${data.pendingApprovals > 1 ? "s" : ""} awaiting approval`, to: "/jobs" },
    data.pendingQuotations > 0 && { text: `${data.pendingQuotations} quotation${data.pendingQuotations > 1 ? "s" : ""} to review`, to: "/quotations" },
  ].filter(Boolean) as { text: string; to: string }[];
  const pipeline = [
    { label: "Requests", value: data.activeServiceRequests, to: "/service-requests" },
    { label: "Quotations", value: data.pendingQuotations, to: "/quotations" },
    { label: "Contracts", value: data.activeContracts, to: "/contracts" },
    { label: "Jobs", value: data.upcomingJobs + data.completedJobs, to: "/jobs" },
    { label: "Approvals", value: data.pendingApprovals, to: "/jobs" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-charcoal">Operations Cockpit</h1><p className="mt-1 text-sm text-sage">Real-time view of your facility service pipeline.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{pipeline.slice(0, 4).map((p) => <KPI key={p.label} label={p.label} value={p.value} icon={<Clock className="h-4 w-4 text-sage" />} accent="bg-muted" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Needs attention" />
          <div className="space-y-1 p-2">{needsAttention.length === 0 ? <p className="px-3 py-6 text-center text-sm text-sage">All clear.</p> : needsAttention.map((n, i) => (
            <Link key={i} href={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal transition-colors hover:bg-muted"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="flex-1">{n.text}</span><ArrowRight className="h-4 w-4 text-sage" /></Link>
          ))}</div>
        </Card>
        <Card>
          <CardHeader title="Spending" subtitle="Across issued invoices" />
          <div className="space-y-4 p-5"><p className="text-xs text-sage">Total issued</p><p className="text-2xl font-bold text-charcoal">{money(data.totalSpending)}</p><p className="text-xs text-sage">Paid / committed</p><p className="text-lg font-semibold text-pine">{money(data.paidSpending)}</p><Link href="/invoices"><Button variant="outline" size="sm" className="w-full">View invoices</Button></Link></div>
        </Card>
        <Card>
          <CardHeader title="Service pipeline" subtitle="Requests to Approvals" />
          <div className="space-y-0.5 p-3">{pipeline.map((px) => (
            <Link key={px.label} href={px.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"><span className="w-20 text-sage">{px.label}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-terracotta" style={{ width: `${Math.min(100, (px.value / Math.max(1, pipeline[0].value)) * 100)}%` }} /></div><span className="w-6 text-right font-semibold text-charcoal">{px.value}</span></Link>
          ))}</div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Completed jobs" actions={<Briefcase className="h-4 w-4 text-sage" />} /><div className="p-5 text-4xl font-bold text-charcoal">{data.completedJobs}</div></Card>
        <Card><CardHeader title="Quick actions" /><div className="grid grid-cols-2 gap-2 p-4"><Link href="/service-requests"><Button variant="outline" className="w-full">New request</Button></Link><Link href="/jobs"><Button variant="outline" className="w-full">View jobs</Button></Link></div></Card>
      </div>
    </div>
  );
}
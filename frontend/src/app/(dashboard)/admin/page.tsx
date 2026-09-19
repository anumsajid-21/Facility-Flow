"use client";
import { useEffect, useState } from "react";
import { Shield, Building2, Users, FileText, Home, FileSignature, Activity } from "lucide-react";
import { adminApi, apiError } from "@/services/api";
import { Card, PageHeader, EmptyState, Loading, StatusBadge, Tabs, Field, Modal, useConfirm } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort, humanize } from "@/lib/utils";

export default function AdminPage() {
  const [dash, setDash] = useState<any | null>(null);
  const [tab, setTab] = useState("overview");
  const [orgs, setOrgs] = useState<any[] | null>(null);
  const [providers, setProviders] = useState<any[] | null>(null);
  const [buildings, setBuildings] = useState<any[] | null>(null);
  const [users, setUsers] = useState<any[] | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<any | null>(null);
  const [verifyForm, setVerifyForm] = useState({ status: "VERIFIED", notes: "" });
  const [busy, setBusy] = useState("");
  const { confirmDialog } = useConfirm();

  useEffect(() => {
    adminApi.dashboard().then(setDash).catch(() => setDash(undefined));
    adminApi.organizations().then(setOrgs).catch(() => setOrgs([]));
    adminApi.providers().then(setProviders).catch(() => setProviders([]));
    adminApi.buildings().then((p) => setBuildings(p.data)).catch(() => setBuildings([]));
    adminApi.users().then(setUsers).catch(() => setUsers([]));
    adminApi.activity().then(setActivity).catch(() => setActivity([]));
  }, []);

  const submitVerify = async () => {
    if (!verifyTarget) return;
    setBusy("verify");
    try {
      await adminApi.verifyProvider(verifyTarget.id, verifyForm.status, verifyForm.notes);
      toast.success("Provider updated", `${verifyTarget.name}: ${verifyForm.status}`);
      setVerifyTarget(null);
      adminApi.providers().then(setProviders).catch(() => {});
    } catch (e: any) { toast.error("Failed", apiError(e)); } finally { setBusy(""); }
  };

  const stats = [
    { label: "Organizations", value: dash?.totalOrganizations, icon: Building2 },
    { label: "Providers", value: dash?.totalProviders, icon: Users },
    { label: "Service requests", value: dash?.totalServiceRequests, icon: FileText },
    { label: "Active contracts", value: dash?.activeContracts, icon: FileSignature },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Platform-wide overview and moderation" />

      {!dash ? (dash === undefined ? <Card><EmptyState icon={<Shield className="h-6 w-6" />} title="Unable to load" description="Admin data could not be loaded." /></Card> : <Loading />) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-sage">{s.label}</p>
                <s.icon className="h-4 w-4 text-pine" />
              </div>
              <p className="mt-1 text-2xl font-bold text-charcoal">{s.value ?? "—"}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "organizations", label: "Organizations" },
          { key: "providers", label: "Providers" },
          { key: "buildings", label: "Buildings" },
          { key: "users", label: "Users" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as string)}
      />

      {tab === "overview" && (
        <Card>
          <div className="border-b border-border px-5 py-4"><h3 className="flex items-center gap-2 font-semibold text-charcoal"><Activity className="h-4 w-4 text-pine" /> Recent activity</h3></div>
          {!activity ? <Loading /> : activity.length === 0 ? <div className="p-5 text-sm text-sage">No recorded activity yet.</div> : (
            <div className="divide-y divide-border">
              {activity.slice(0, 8).map((a) => (
                <div key={a.id} className="px-5 py-2.5">
                  <p className="text-sm text-charcoal">{humanize(a.action)} <span className="text-xs text-sage">· {a.entityType}</span></p>
                  <p className="text-xs text-sage">{a.actor?.name ?? "System"} · {dateShort(a.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "organizations" && (
        !orgs ? <Loading /> : orgs.length === 0 ? <Card><EmptyState icon={<Building2 className="h-6 w-6" />} title="No organizations" /></Card> : (
          <Card className="divide-y divide-border">
            {orgs.map((o) => (
              <div key={o.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-charcoal">{o.name}</p>
                  <span className="text-xs text-sage">{dateShort(o.createdAt)}</span>
                </div>
                <p className="text-xs text-sage">{o.members?.length ? o.members.map((m: any) => m.user?.name).filter(Boolean).join(", ") : "No members"}</p>
              </div>
            ))}
          </Card>
        )
      )}

      {tab === "providers" && (
        !providers ? <Loading /> : providers.length === 0 ? <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No providers" /></Card> : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-pine/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Quotations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Contracts</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Reviews</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {providers.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-charcoal">{p.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.verificationStatus} /></td>
                      <td className="px-4 py-3 text-sm text-sage">{p._count?.quotations ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-sage">{p._count?.contracts ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-sage">{p._count?.reviews ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => { setVerifyTarget(p); setVerifyForm({ status: p.verificationStatus === "VERIFIED" ? "SUSPENDED" : "VERIFIED", notes: "" }); }}>Update status</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === "buildings" && (
        !buildings ? <Loading /> : buildings.length === 0 ? <Card><EmptyState icon={<Home className="h-6 w-6" />} title="No buildings" /></Card> : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-pine/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Organization</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">City</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Floors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {buildings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-charcoal">{b.name}</td>
                      <td className="px-4 py-3 text-sm text-sage">{b.organization?.name}</td>
                      <td className="px-4 py-3 text-sm text-sage">{b.city ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-sage">{b.floors?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === "users" && (
        !users ? <Loading /> : users.length === 0 ? <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No users" /></Card> : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-pine/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-charcoal">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-sage">{u.email}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                      <td className="px-4 py-3 text-sm text-sage">{dateShort(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      <Modal open={!!verifyTarget} onClose={() => setVerifyTarget(null)} title={`Update provider: ${verifyTarget?.name ?? ""}`}>
        <div className="space-y-4">
          <Field label="Verification status">
            <select className="h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm" value={verifyForm.status} onChange={(e) => setVerifyForm({ ...verifyForm, status: e.target.value })}>
              {["UNVERIFIED", "DOCUMENTS_SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="min-h-[80px] w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm" value={verifyForm.notes} onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })} placeholder="Reason / notes…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>Cancel</Button>
            <Button loading={busy === "verify"} onClick={submitVerify}>Save</Button>
          </div>
        </div>
      </Modal>
      {confirmDialog}
    </div>
  );
}



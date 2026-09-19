"use client";
import { useEffect, useState } from "react";
import { Users, Plus, Mail, CheckCircle2, XCircle, Power } from "lucide-react";
import { workersApi } from "@/services/api";
import { Card, PageHeader, EmptyState, Modal, Field, Input, Loading, Badge } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", skills: "", certifications: "", availability: "" });

  const load = () => workersApi.list().then((p) => setWorkers(p.data)).catch(() => setWorkers([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast.error("Required", "Worker name is required.");
    setBusy(true);
    try {
      await workersApi.create(form);
      toast.success("Worker added");
      setOpenCreate(false);
      setForm({ name: "", skills: "", certifications: "", availability: "" });
      load();
    } catch (e: any) { toast.error("Failed", e?.message || "Could not add worker"); } finally { setBusy(false); }
  };

  const sendInvite = async () => {
    if (!inviteEmail) return toast.error("Required", "Email address is required.");
    setBusy(true);
    try {
      await workersApi.invite(openInvite.id, inviteEmail);
      toast.success("Invite sent", `Worker invite activated for ${inviteEmail}`);
      setOpenInvite(null);
      setInviteEmail("");
      load();
    } catch (e: any) { toast.error("Failed", e?.message || "Could not send invite"); } finally { setBusy(false); }
  };

  const toggleStatus = async (w: any) => {
    const nextStatus = w.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await workersApi.setStatus(w.id, nextStatus);
      toast.success(`Worker ${nextStatus.toLowerCase()}`);
      load();
    } catch (e: any) { toast.error("Failed", e?.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Workers" subtitle="Manage your team of service workers" actions={<Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4" /> Add worker</Button>} />
      {!workers ? <Loading /> : workers.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No workers yet" description="Add your first worker to start assigning them to jobs." action={<Button onClick={() => setOpenCreate(true)}>Add worker</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((w) => (
            <Card key={w.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pine/10 text-sm font-bold text-pine">{w.name?.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <h4 className="font-semibold text-charcoal">{w.name}</h4>
                      <p className="text-xs text-sage">{w.skills || "No skills listed"}</p>
                    </div>
                  </div>
                  <Badge variant={w.status === "ACTIVE" ? "success" : "neutral"}>{w.status}</Badge>
                </div>
                {w.availability && <p className="mt-3 text-xs text-sage">Availability: {w.availability}</p>}
                {w.certifications && <p className="mt-1 text-xs text-sage">Certifications: {w.certifications}</p>}
                
                <div className="mt-4 pt-3 border-t border-border/50 text-xs flex items-center justify-between">
                  <span className="text-sage">App Login:</span>
                  {w.userId ? (
                    <span className="flex items-center gap-1 font-medium text-pine"><CheckCircle2 className="h-3.5 w-3.5 text-pine" /> {w.email || "Active"}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-medium"><XCircle className="h-3.5 w-3.5" /> Pending invite</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                {!w.userId ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setOpenInvite(w); setInviteEmail(w.email || ""); }}>
                    <Mail className="h-3.5 w-3.5 mr-1" /> Invite to app
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => toggleStatus(w)}>
                    <Power className="h-3.5 w-3.5 mr-1" /> {w.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Add worker">
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required /></Field>
          <Field label="Skills"><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Electrical, Plumbing" /></Field>
          <Field label="Certifications"><Input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="Licensed electrician" /></Field>
          <Field label="Availability"><Input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="Mon-Fri 9-5" /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button><Button type="submit" loading={busy}>Add worker</Button></div>
        </form>
      </Modal>

      <Modal open={!!openInvite} onClose={() => setOpenInvite(null)} title={`Invite ${openInvite?.name || "Worker"}`}>
        <form onSubmit={(e) => { e.preventDefault(); sendInvite(); }} className="space-y-4">
          <p className="text-sm text-sage">Enter the worker&apos;s email address to create their mobile login credentials.</p>
          <Field label="Worker Email"><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="worker@example.com" required /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpenInvite(null)}>Cancel</Button><Button type="submit" loading={busy}>Send Invite</Button></div>
        </form>
      </Modal>
    </div>
  );
}
"use client";
import { useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
import { workersApi } from "@/services/api";
import { Card, PageHeader, EmptyState, Modal, Field, Input, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Workers" subtitle="Manage your team of service workers" actions={<Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4" /> Add worker</Button>} />
      {!workers ? <Loading /> : workers.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No workers yet" description="Add your first worker to start assigning them to jobs." action={<Button onClick={() => setOpenCreate(true)}>Add worker</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pine/10 text-sm font-bold text-pine">{w.name?.slice(0, 1).toUpperCase()}</div>
                <div className="flex-1"><h4 className="font-semibold text-charcoal">{w.name}</h4><p className="text-xs text-sage">{w.skills || "No skills listed"}</p></div>
              </div>
              {w.availability && <p className="mt-2 text-xs text-sage">Availability: {w.availability}</p>}
              {w.certifications && <p className="mt-1 text-xs text-sage">Certifications: {w.certifications}</p>}
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
    </div>
  );
}
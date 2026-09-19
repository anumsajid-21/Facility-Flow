"use client";
import { useEffect, useState } from "react";
import { Building2, Plus, MapPin, Layers, Trash2, CornerDownRight, Pencil } from "lucide-react";
import { facilitiesApi } from "@/services/api";
import { Card, PageHeader, EmptyState, Modal, Field, Input, Loading, useConfirm } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";

const BUILDING_TYPES = [
  "Office", "Restaurant", "Hotel", "Hospital", "School",
  "Warehouse", "Residential", "Retail", "Industrial", "Other",
];

function BuildingTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-input bg-ivory px-3 text-sm text-charcoal"
    >
      <option value="">Select building type…</option>
      {BUILDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export default function FacilitiesPage() {
  const [buildings, setBuildings] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [areasByFloor, setAreasByFloor] = useState<Record<string, any[]>>({});
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", buildingType: "" });
  const [newFloors, setNewFloors] = useState<{ name: string; areas: { name: string; category: string }[] }[]>([]);
  const [floorCount, setFloorCount] = useState(0);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", city: "", buildingType: "" });
  const [editDetail, setEditDetail] = useState<any>(null);
  const [areaDrafts, setAreaDrafts] = useState<Record<string, { name: string; category: string }[]>>({});
  const [newFloorName, setNewFloorName] = useState("");
  const [areaCategories, setAreaCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const load = () => facilitiesApi.buildings().then((p) => setBuildings(p.data)).catch(() => setBuildings([]));

  useEffect(() => {
    load();
    facilitiesApi.areaCategories().then(setAreaCategories).catch(() => setAreaCategories([]));
  }, []);

  const selectBuilding = async (b: any) => {
    setSelected(b); setAreasByFloor({});
    try { setFloors((await facilitiesApi.building(b.id))?.floors ?? []); } catch { setFloors([]); }
  };

  const toggleAreas = async (floorId: string) => {
    if (areasByFloor[floorId]) {
      setAreasByFloor((m) => { const n = { ...m }; delete n[floorId]; return n; });
      return;
    }
    try {
      const a = await facilitiesApi.areas(floorId);
      setAreasByFloor((m) => ({ ...m, [floorId]: a }));
    } catch { /* ignore */ }
  };

  const floorOrdinal = (n: number): string => {
    const s = String(n);
    if (s.endsWith("1") && !s.endsWith("11")) return `${n}st Floor`;
    if (s.endsWith("2") && !s.endsWith("12")) return `${n}nd Floor`;
    if (s.endsWith("3") && !s.endsWith("13")) return `${n}rd Floor`;
    return `${n}th Floor`;
  };

  const generateFloors = (n: number) => {
    const count = Math.max(0, Math.min(100, Number(n) || 0));
    setFloorCount(count);
    const names: string[] = [];
    for (let i = 1; i <= count; i += 1) names.push(floorOrdinal(i));
    setNewFloors(names.map((name) => ({ name, areas: [] })));
  };

  const startEdit = async (b: any) => {
    setEditing(b);
    setEditForm({ name: b.name || "", address: b.address || "", city: b.city || "", buildingType: b.buildingType || "" });
    setEditDetail(null);
    setAreaDrafts({});
    setNewFloorName("");
    setOpenEdit(true);
    await refreshEditDetail(b.id);
  };

  const refreshEditDetail = async (id: string) => {
    try {
      const detail = await facilitiesApi.building(id);
      setEditDetail(detail?.floors ?? []);
    } catch { setEditDetail([]); }
  };

  const renameFloor = (floorId: string, name: string) => {
    setEditDetail((list: any[]) => list.map((f) => (f.id === floorId ? { ...f, name } : f)));
    void facilitiesApi.updateFloor(floorId, name).catch(() => {});
  };

  const renameArea = (floorId: string, areaId: string, patch: { name?: string; category?: string }) => {
    setEditDetail((list: any[]) => list.map((f) => f.id === floorId ? { ...f, areas: (f.areas ?? []).map((a: any) => a.id === areaId ? { ...a, ...patch } : a) } : f));
    void facilitiesApi.updateArea(areaId, patch).catch(() => {});
  };

  const addFloorNow = async (e: any) => {
    e.preventDefault();
    if (!editing || !newFloorName.trim()) return toast.error("Required", "Enter a floor name.");
    try {
      await facilitiesApi.createFloor(editing.id, newFloorName.trim());
      setNewFloorName("");
      await refreshEditDetail(editing.id);
      toast.success("Floor added");
    } catch (err: any) { toast.error("Failed", err?.message); }
  };

  const addAreasNow = async (floorId: string) => {
    const drafts = areaDrafts[floorId] ?? [];
    const valid = drafts.filter((a) => a.name.trim());
    if (!valid.length) return toast.error("Required", "Enter at least one area name.");
    try {
      for (const a of valid) {
        await facilitiesApi.createArea(floorId, { name: a.name.trim(), category: a.category || undefined });
      }
      setAreaDrafts((m) => ({ ...m, [floorId]: [] }));
      await refreshEditDetail(editing.id);
      toast.success(`${valid.length} area(s) added`);
    } catch (err: any) { toast.error("Failed", err?.message); }
  };

  const saveEdit = async () => {
    if (!editing || !editForm.name || !editForm.address || !editForm.city)
      return toast.error("Missing fields", "Name, address and city are required.");
    setBusy(true);
    try {
      await facilitiesApi.updateBuilding(editing.id, editForm);
      toast.success("Building updated");
      setOpenEdit(false);
      setEditing(null);
      setEditDetail(null);
      if (selected?.id === editing.id) setSelected({ ...selected, ...editForm });
      load();
    } catch (e: any) {
      toast.error("Failed", e?.message || "Could not update building");
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!form.name || !form.address || !form.city)
      return toast.error("Missing fields", "Name, address and city are required.");
    setBusy(true);
    try {
      const building = await facilitiesApi.createBuilding(form);
      for (const f of newFloors) {
        if (!f.name.trim()) continue;
        try {
          const floor = await facilitiesApi.createFloor(building.id, f.name.trim());
          for (const a of f.areas) {
            if (!a.name.trim()) continue;
            try {
              await facilitiesApi.createArea(floor.id, { name: a.name.trim(), category: a.category || undefined });
            } catch { /* keep going */ }
          }
        } catch { /* keep going */ }
      }
      toast.success("Building created", newFloors.length ? "Floors and areas were added too." : undefined);
      setOpenCreate(false);
      setForm({ name: "", address: "", city: "", buildingType: "" });
      setNewFloors([]);
      setFloorCount(0);
      load();
    } catch (e: any) {
      toast.error("Failed", e?.message || "Could not create building");
    } finally { setBusy(false); }
  };

  const removeBuilding = async (id: string) => {
    if (!(await confirm("Delete this building?", "The building and its floors/areas will be removed from your facilities. This cannot be undone.", { confirmLabel: "Delete", danger: true }))) return;
    try {
      await facilitiesApi.deleteBuilding(id);
      toast.success("Building deleted");
      if (selected?.id === id) setSelected(null);
      load();
    } catch (e: any) { toast.error("Failed", e?.message); }
  };

  const addFloor = async () => {
    const name = window.prompt("Floor name");
    if (!name || !selected) return;
    try {
      await facilitiesApi.createFloor(selected.id, name);
      toast.success("Floor added");
      selectBuilding(selected);
    } catch (e: any) { toast.error("Failed", e?.message); }
  };

  const addArea = async (floorId: string) => {
    const name = window.prompt("Area name");
    if (!name) return;
    try {
      await facilitiesApi.createArea(floorId, { name });
      toast.success("Area added");
      selectBuilding(selected);
    } catch (e: any) { toast.error("Failed", e?.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Facilities" subtitle="Buildings, floors and areas across your portfolio"
        actions={<Button onClick={() => { setOpenCreate(true); setNewFloors([]); setFloorCount(0); }}><Plus className="h-4 w-4" /> Add building</Button>} />

      {!buildings ? <Loading /> : buildings.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No buildings yet"
            description="Add your first building to start structuring your facilities."
            action={<Button onClick={() => { setOpenCreate(true); setNewFloors([]); setFloorCount(0); }}>Add building</Button>} />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* Building list */}
          <div className="space-y-2">
            {buildings.map((b) => (
              <Card key={b.id} className={`cursor-pointer transition-all ${selected?.id === b.id ? "border-pine ring-1 ring-pine/30" : "hover:border-brass"}`}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="shrink-0 rounded-lg bg-pine/10 p-2.5 text-pine"><Building2 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => selectBuilding(b)}>
                    <p className="truncate font-semibold text-charcoal">{b.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-sage"><MapPin className="h-3 w-3" /> {b.city}, {b.address}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {b.buildingType && <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-sage">{b.buildingType}</span>}
                    {b.numberOfFloors ? <span className="flex items-center gap-1 text-xs text-sage"><Layers className="h-3 w-3" /> {b.numberOfFloors}</span> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => startEdit(b)} className="rounded p-1 text-sage hover:bg-pine/10 hover:text-pine" title="Edit building"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => removeBuilding(b.id)} className="rounded p-1 text-sage hover:bg-terracotta-soft hover:text-terracotta" title="Delete building"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Selected building detail */}
          <Card>
            {!selected ? (
              <EmptyState icon={<Building2 className="h-6 w-6" />} title="Select a building" description="Choose a building to view its floors and areas." />
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-charcoal">{selected.name}</h3>
                    <p className="text-xs text-sage">{selected.city}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addFloor}><Plus className="h-4 w-4" /> Floor</Button>
                </div>
                <div className="space-y-2 p-4">
                  {floors.length === 0 ? (
                    <p className="py-8 text-center text-sm text-sage">No floors yet.</p>
                  ) : floors.map((f) => {
                    const open = !!areasByFloor[f.id];
                    return (
                      <div key={f.id}>
                        <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                          <button
                            onClick={() => toggleAreas(f.id)}
                            type="button"
                            className="flex flex-1 items-center gap-2 text-sm font-medium text-charcoal hover:text-pine"
                          >
                            <Layers className="h-4 w-4 text-pine" /> {f.name}
                          </button>
                          <button onClick={() => addArea(f.id)} className="rounded p-1 text-sage hover:bg-pine/10 hover:text-pine" title="Add area"><Plus className="h-4 w-4" /></button>
                        </div>
                        {open && (
                          <div className="mt-1 space-y-1 pl-5">
                            {areasByFloor[f.id]?.length
                              ? areasByFloor[f.id].map((a) => (
                                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-charcoal">
                                    <CornerDownRight className="h-3 w-3 text-brass" /> {a.name}
                                  </div>
                                ))
                              : <p className="text-xs text-sage">No areas yet.</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Create building modal */}
      <Modal open={openCreate} onClose={() => { setOpenCreate(false); setNewFloors([]); setFloorCount(0); }} title="Add building" wide>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="HQ Tower" required /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" required /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Austin" required /></Field>
            <Field label="Building type"><BuildingTypeSelect value={form.buildingType} onChange={(v) => setForm({ ...form, buildingType: v })} /></Field>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-charcoal">Floors &amp; areas (optional)</p>
                <p className="text-xs text-sage">Structure the building now — you can also add these later from the building view.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-sage">Floors:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={floorCount}
                    onChange={(e) => generateFloors(Number(e.target.value))}
                    onBlur={(e) => generateFloors(Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="h-9 w-20 rounded-lg border border-input bg-ivory px-2 text-sm text-charcoal outline-none focus:border-brass"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setNewFloors((f) => [...f, { name: "", areas: [] }])}><Plus className="h-4 w-4" /> Add floor</Button>
              </div>
            </div>

            {newFloors.length === 0 ? (
              <p className="py-2 text-center text-xs text-sage">No floors added yet.</p>
            ) : (
              <div className="space-y-3">
                {newFloors.map((f, fi) => (
                  <div key={fi} className="rounded-lg border border-border bg-ivory p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={f.name}
                        onChange={(e) => setNewFloors((arr) => arr.map((x, i) => i === fi ? { ...x, name: e.target.value } : x))}
                        placeholder="Floor name (e.g. Ground Floor)"
                      />
                      <button
                        type="button"
                        onClick={() => setNewFloors((arr) => arr.filter((_, i) => i !== fi))}
                        className="rounded p-1.5 text-sage hover:bg-terracotta-soft hover:text-terracotta"
                        title="Remove floor"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 space-y-2 pl-4">
                      {f.areas.map((a, ai) => (
                        <div key={ai} className="flex flex-wrap items-center gap-2">
                          <CornerDownRight className="h-3 w-3 shrink-0 text-brass" />
                          <Input
                            className="max-w-[200px] flex-1"
                            value={a.name}
                            onChange={(e) => setNewFloors((arr) => arr.map((x, i) => i === fi ? { ...x, areas: x.areas.map((y, j) => j === ai ? { ...y, name: e.target.value } : y) } : x))}
                            placeholder="Area name"
                          />
                          <select
                            className="h-10 rounded-lg border border-input bg-ivory px-2 text-sm"
                            value={a.category}
                            onChange={(e) => setNewFloors((arr) => arr.map((x, i) => i === fi ? { ...x, areas: x.areas.map((y, j) => j === ai ? { ...y, category: e.target.value } : y) } : x))}
                          >
                            <option value="">Category…</option>
                            {areaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => setNewFloors((arr) => arr.map((x, i) => i === fi ? { ...x, areas: x.areas.filter((_, j) => j !== ai) } : x))}
                            className="rounded p-1 text-sage hover:bg-terracotta-soft hover:text-terracotta"
                            title="Remove area"
                          ><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewFloors((arr) => arr.map((x, i) => i === fi ? { ...x, areas: [...x.areas, { name: "", category: "" }] } : x))}
                        >
                          <Plus className="h-3 w-3" /> Add area
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpenCreate(false); setNewFloors([]); setFloorCount(0); }}>Cancel</Button>
            <Button type="submit" loading={busy}>Create building</Button>
          </div>
        </form>
      </Modal>

      {/* Edit building modal */}
      <Modal open={openEdit} onClose={() => { setOpenEdit(false); setAreaDrafts({}); }} title={`Edit building: ${editing?.name ?? ""}`} wide>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-4">
          <Field label="Name"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Address"><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} required /></Field>
            <Field label="City"><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} required /></Field>
            <Field label="Building type"><BuildingTypeSelect value={editForm.buildingType} onChange={(v) => setEditForm({ ...editForm, buildingType: v })} /></Field>
          </div>

          {editDetail && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-charcoal">Floors</p>
                <p className="text-xs text-sage">Rename, remove or add floors and their areas.</p>
              </div>
              {editDetail.map((f: any) => (
                <div key={f.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-pine" />
                    <Input
                      value={f.name}
                      onChange={(e) => renameFloor(f.id, e.target.value)}
                      className="max-w-[220px]"
                      placeholder="Floor name"
                    />
                  </div>
                  <div className="mt-2 space-y-2 pl-6">
                    {(f.areas ?? []).map((a: any) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2">
                        <CornerDownRight className="h-3 w-3 shrink-0 text-brass" />
                        <Input
                          defaultValue={a.name}
                          key={`name-${a.id}`}
                          onBlur={(e) => { if (e.target.value.trim() !== a.name) renameArea(f.id, a.id, { name: e.target.value.trim() || a.name }); }}
                          className="max-w-[180px]"
                          placeholder="Area name"
                        />
                        <select
                          defaultValue={a.category ?? ""}
                          key={`cat-${a.id}`}
                          onChange={(e) => renameArea(f.id, a.id, { category: e.target.value })}
                          className="h-10 rounded-lg border border-input bg-ivory px-2 text-sm"
                        >
                          <option value="">Category…</option>
                          {areaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                    {/* draft areas for this floor */}
                    {(areaDrafts[f.id] ?? []).map((d, di) => (
                      <div key={`draft-${di}`} className="flex flex-wrap items-center gap-2">
                        <CornerDownRight className="h-3 w-3 shrink-0 text-brass" />
                        <Input
                          autoFocus
                          value={d.name}
                          onChange={(e) => setAreaDrafts((m) => ({ ...m, [f.id]: (m[f.id] ?? []).map((x, i) => i === di ? { ...x, name: e.target.value } : x) }))}
                          className="max-w-[180px]"
                          placeholder="Area name"
                        />
                        <select
                          value={d.category}
                          onChange={(e) => setAreaDrafts((m) => ({ ...m, [f.id]: (m[f.id] ?? []).map((x, i) => i === di ? { ...x, category: e.target.value } : x) }))}
                          className="h-10 rounded-lg border border-input bg-ivory px-2 text-sm"
                        >
                          <option value="">Category…</option>
                          {areaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => setAreaDrafts((m) => ({ ...m, [f.id]: (m[f.id] ?? []).filter((_, i) => i !== di) }))}
                          className="rounded p-1 text-sage hover:bg-terracotta-soft hover:text-terracotta"
                          title="Remove area draft"
                        ><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAreaDrafts((m) => ({ ...m, [f.id]: [...(m[f.id] ?? []), { name: "", category: "" }] }))}
                      >
                        <Plus className="h-3 w-3" /> Add area
                      </Button>
                      {(areaDrafts[f.id] ?? []).length > 0 && (
                        <Button type="button" size="sm" onClick={() => addAreasNow(f.id)}>Save areas</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add a floor */}
              <form onSubmit={addFloorNow} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-ivory p-3">
                <Input
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  placeholder="New floor name (e.g. 5th Floor)"
                />
                <Button type="submit"><Plus className="h-4 w-4" /> Add floor</Button>
              </form>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpenEdit(false); setAreaDrafts({}); }}>Cancel</Button>
            <Button type="submit" loading={busy}>Save changes</Button>
          </div>
        </form>
      </Modal>

      {confirmDialog}
    </div>
  );
}

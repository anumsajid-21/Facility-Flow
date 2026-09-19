"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search, AlertCircle, Sparkles, Loader2, CheckCircle2, Mic, MicOff, Pencil } from "lucide-react";
import { serviceRequestsApi, facilitiesApi, apiError } from "@/services/api";
import { Card, PageHeader, EmptyState, Modal, Field, Input, Textarea, Select, Loading, Tabs, StatusBadge } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { cn, dateShort, money } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "QUOTATIONS_RECEIVED", label: "Quotations" },
  { key: "PROVIDER_SELECTED", label: "Selected" },
  { key: "DRAFT", label: "Drafts" },
  { key: "CLOSED", label: "Closed" },
];

const FALLBACK_CATEGORIES = [
  "Commercial Cleaning",
  "Glass/Façade Cleaning",
  "HVAC/AC",
  "Electrical",
  "Plumbing",
  "Pest Control",
  "Landscaping",
  "General Facility Maintenance",
];

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default function ServiceRequestsPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", buildingId: "", floorId: "", areaId: "", priority: "NORMAL", budget: "", preferredDate: "" });
  // When set, the modal edits an existing request (PATCH) instead of creating one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // AI Assist — purely a helper that pre-fills the fields above; submission still goes through create().
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<{ category: { id: string; name: string } | null; title: string; description: string; priority: string; followUpQuestions: string[] } | null>(null);
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({});
  const [aiApplied, setAiApplied] = useState(false);

  // Voice dictation for the AI Assist description — speech-to-text only, no audio is ever uploaded.
  const [dictating, setDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef<any>(null);
  const voiceInputSupported = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleDictation = () => {
    if (dictating) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) { setDictationError("Voice input isn't supported in this browser."); return; }
    setDictationError("");
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      if (transcript.trim()) setAiText((prev) => (prev.trim() ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
    };
    recognition.onerror = (event: any) => {
      setDictationError(event.error === "not-allowed" ? "Microphone access was denied. Allow microphone access to dictate." : "Voice input stopped unexpectedly.");
      setDictating(false);
    };
    recognition.onend = () => setDictating(false);
    recognitionRef.current = recognition;
    recognition.start();
    setDictating(true);
  };

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const load = () => serviceRequestsApi.list().then((p) => setItems(p.data)).catch(() => setItems([]));
  useEffect(() => {
    load();
    serviceRequestsApi.categories().then(setCategories).catch(() => setCategories(FALLBACK_CATEGORIES.map((name) => ({ id: name, name }))));
    facilitiesApi.buildings().then((p) => {
      setBuildings(p.data);
    }).catch((err) => {
      console.error("Failed to load buildings:", err);
      setBuildings([]);
    });
    serviceRequestsApi.aiAssistStatus().then((r) => setAiEnabled(!!r?.enabled)).catch(() => setAiEnabled(false));
  }, []);

  // Detail page hands off "edit this request" via sessionStorage, then navigates here.
  useEffect(() => {
    const editId = typeof window !== "undefined" ? sessionStorage.getItem("editRequestId") : null;
    if (editId) {
      sessionStorage.removeItem("editRequestId");
      openEdit(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAi = () => {
    setAiOpen(false);
    setAiText("");
    setAiLoading(false);
    setAiError("");
    setAiSuggestion(null);
    setAiAnswers({});
    setAiApplied(false);
  };

  const runAiAssist = async () => {
    if (aiText.trim().length < 10) {
      setAiError("Please describe the problem in a bit more detail (at least 10 characters).");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const result = await serviceRequestsApi.aiAssist(aiText.trim(), Object.keys(aiAnswers).length ? aiAnswers : undefined);
      if (!result || typeof result.title !== "string" || typeof result.description !== "string") {
        throw new Error("AI Assist returned an unexpected response.");
      }
      setAiSuggestion(result);
      setAiApplied(false);
    } catch (e) {
      setAiSuggestion(null);
      setAiError(apiError(e) || "AI Assist couldn't analyze this description. You can still fill in the form manually.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    const matchedCategory = aiSuggestion.category ? categories.find((c) => c.id === aiSuggestion.category!.id) : null;
    setForm((f) => ({
      ...f,
      categoryId: matchedCategory ? matchedCategory.id : "OTHER",
      title: matchedCategory ? f.title : aiSuggestion.title,
      description: aiSuggestion.description,
      priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(aiSuggestion.priority) ? aiSuggestion.priority : f.priority,
    }));
    setAiApplied(true);
    toast.success("Suggestions applied", "Review the fields below, then submit as usual.");
  };

  const lastBuildingRef = useRef("");
  useEffect(() => {
    if (form.buildingId) {
      facilitiesApi.floors(form.buildingId).then(setFloors).catch(() => setFloors([]));
    } else {
      setFloors([]);
    }
    // Clear floor/area only when the building actually changed — not when an
    // edit modal pre-fills building+floor+area in one go.
    if (lastBuildingRef.current !== "" && lastBuildingRef.current !== form.buildingId) {
      setForm((f) => ({ ...f, floorId: "", areaId: "" }));
    }
    lastBuildingRef.current = form.buildingId;
  }, [form.buildingId]);

  const lastFloorRef = useRef("");
  useEffect(() => {
    if (form.floorId) {
      facilitiesApi.areas(form.floorId).then(setAreas).catch(() => setAreas([]));
    } else {
      setAreas([]);
    }
    if (lastFloorRef.current !== "" && lastFloorRef.current !== form.floorId) {
      setForm((f) => ({ ...f, areaId: "" }));
    }
    lastFloorRef.current = form.floorId;
  }, [form.floorId]);

  const filtered = (items ?? []).filter((r) => {
    const matchesTab = tab === "all" ? true : r.status === tab;
    const q = search.toLowerCase();
    const matchesSearch = !q || (r.title || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });
  const countFor = (k: string) => k === "all" ? (items ?? []).length : (items ?? []).filter((r) => r.status === k).length;

  // Creates a new request, or saves changes to an existing one (editingId set).
  const create = async () => {
    setError("");
    const selectedCategory = categories.find((c) => c.id === form.categoryId);
    const isOther = form.categoryId === "OTHER";
    const title = isOther ? form.title.trim() : selectedCategory?.name ?? "";
    if (!form.categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!title) {
      setError("Please describe the service for the \"Other\" category.");
      return;
    }
    if (!form.buildingId) {
      setError("Please select a building.");
      return;
    }
    setBusy(true);
    const payload: any = {
        title,
        description: form.description.trim(),
        buildingId: form.buildingId,
        priority: form.priority,
        // "Other" is a UI-only choice; the API accepts only real category UUIDs.
        categoryId: isOther || !isUuid(form.categoryId) ? undefined : form.categoryId,
        // Empty string clears the budget on the server (stored as null).
        budget: form.budget ? Number(form.budget) : null,
        preferredDate: form.preferredDate || undefined,
        floorId: form.floorId || null,
        areaId: form.areaId || null,
      };
      try {
        if (editingId) {
          await serviceRequestsApi.update(editingId, payload);
          toast.success("Request updated", "Your changes have been saved.");
          setOpenCreate(false);
          resetForm();
          load();
        } else {
          const result = await serviceRequestsApi.create(payload);
          if (result) {
            // Publish immediately so the request is live, appears under "Open" and counts on the dashboard.
            try { await serviceRequestsApi.submit(result.id); } catch { /* stays as draft if submit fails */ }
            toast.success("Request created", "Your service request is now open for quotations.");
            setOpenCreate(false);
            resetForm();
            load();
          }
        }
      } catch (e: any) {
        console.error("Save request failed:", e);
        const msg = apiError(e);
        setError(msg);
        toast.error("Failed", msg);
      } finally {
        setBusy(false);
      }
  };

  const resetForm = () => {
    setForm({ title: "", description: "", categoryId: "", buildingId: "", floorId: "", areaId: "", priority: "NORMAL", budget: "", preferredDate: "" });
    setFloors([]);
    setAreas([]);
    setError("");
    setEditingId(null);
    setOpenCreate(false);
    resetAi();
  };

  // Pre-fills the shared modal with an existing request's values.
  const openEdit = async (requestId: string) => {
    setError("");
    try {
      const r = await serviceRequestsApi.get(requestId);
      const categoryMatch = r.categoryId ? categories.find((c) => c.id === r.categoryId) : null;
      setForm({
        title: r.title || "",
        description: r.description || "",
        categoryId: categoryMatch ? r.categoryId : r.categoryId ? "OTHER" : "",
        buildingId: r.buildingId || "",
        floorId: r.floorId || "",
        areaId: r.areaId || "",
        priority: r.priority || "NORMAL",
        budget: r.budget != null ? String(r.budget) : "",
        preferredDate: r.preferredDate ? String(r.preferredDate).slice(0, 10) : "",
      });
      setEditingId(requestId);
      setOpenCreate(true);
    } catch (e: any) {
      toast.error("Failed", apiError(e) || "Could not load the request for editing.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Service Requests" subtitle="Create, track and compare requests" actions={<Button onClick={() => { setOpenCreate(true); setError(""); }}><Plus className="h-4 w-4" /> Create request</Button>} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={TABS.map((t) => ({ ...t, count: countFor(t.key) }))} active={tab} onChange={setTab} />
        <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage" /><Input className="pl-9" placeholder="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {!items ? <Loading /> : filtered.length === 0 ? (
        <Card><EmptyState icon={<FileText className="h-6 w-6" />} title="No service requests" description={items.length === 0 ? "Create your first request to get started." : "Nothing matches your filters."} action={items.length === 0 ? <Button onClick={() => setOpenCreate(true)}>Create request</Button> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-pine/5"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Request</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Building</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Budget</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Status</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sage">Created</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-sage">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">{filtered.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3"><Link href={`/service-requests/${r.id}`} className="text-sm font-medium text-charcoal hover:text-pine">{r.title || "Untitled request"}</Link><p className="max-w-xs truncate text-xs text-sage">{r.description}</p></td>
                <td className="px-4 py-3 text-sm text-sage">{r.building?.name ?? ""}</td>
                <td className="px-4 py-3 text-sm font-medium text-charcoal">{r.budget ? money(r.budget) : ""}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-sm text-sage">{dateShort(r.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {["DRAFT", "OPEN"].includes(r.status) && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)} title="Edit request">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    <Link href={`/service-requests/${r.id}`} className="rounded-lg px-2 py-1.5 text-sm font-medium text-pine hover:bg-muted">View</Link>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      <Modal open={openCreate} onClose={resetForm} title={editingId ? "Edit service request" : "Create service request"}>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aiEnabled && !editingId && (
            <div className="rounded-xl border border-brass/40 bg-brass-soft/30 p-3">
              {!aiOpen ? (
                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="flex w-full items-center gap-2 text-left text-sm font-medium text-pine hover:underline"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-brass" /> Not sure how to fill this in? Describe the problem and let AI Assist suggest the details.
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                    <Sparkles className="h-4 w-4 text-brass" /> AI Assist
                  </div>
                  <Field label="Describe the problem in your own words">
                    <div className="relative">
                      <Textarea
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        placeholder="e.g. The AC in our second-floor meeting room is not cooling and is leaking water."
                        rows={3}
                        className="pr-11"
                      />
                      {voiceInputSupported && (
                        <button
                          type="button"
                          onClick={toggleDictation}
                          title={dictating ? "Stop dictation" : "Dictate with your microphone"}
                          className={cn(
                            "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                            dictating ? "animate-pulse bg-destructive text-ivory" : "bg-muted text-sage hover:text-pine",
                          )}
                        >
                          {dictating ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    {dictationError && <p className="mt-1 text-xs text-destructive">{dictationError}</p>}
                  </Field>
                  {aiError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span>{aiError}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={runAiAssist} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {aiSuggestion ? "Re-analyze" : "Analyze"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={resetAi}>Cancel</Button>
                  </div>

                  {aiSuggestion && (
                    <div className="space-y-3 rounded-lg border border-border bg-ivory p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sage">Suggested details</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex gap-2"><dt className="w-20 shrink-0 text-sage">Category</dt><dd className="text-charcoal">{aiSuggestion.category?.name ?? "Other"}</dd></div>
                        <div className="flex gap-2"><dt className="w-20 shrink-0 text-sage">Title</dt><dd className="text-charcoal">{aiSuggestion.title}</dd></div>
                        <div className="flex gap-2"><dt className="w-20 shrink-0 text-sage">Priority</dt><dd className="text-charcoal">{aiSuggestion.priority}</dd></div>
                        <div className="flex gap-2"><dt className="w-20 shrink-0 text-sage">Details</dt><dd className="text-charcoal">{aiSuggestion.description}</dd></div>
                      </dl>

                      {aiSuggestion.followUpQuestions.length > 0 && (
                        <div className="space-y-2 border-t border-border pt-2">
                          <p className="text-xs font-semibold text-sage">A few optional details would help — answer any that apply, then re-analyze:</p>
                          {aiSuggestion.followUpQuestions.map((q) => (
                            <Field key={q} label={q}>
                              <Input
                                value={aiAnswers[q] ?? ""}
                                onChange={(e) => setAiAnswers((a) => ({ ...a, [q]: e.target.value }))}
                              />
                            </Field>
                          ))}
                        </div>
                      )}

                      <Button type="button" size="sm" onClick={applyAiSuggestion} disabled={aiApplied} className="gap-1.5">
                        {aiApplied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Applied to form below</> : "Use these suggestions"}
                      </Button>
                      <p className="text-[11px] text-sage">You can still edit every field below before submitting — nothing is sent until you click Create.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="OTHER">Other (describe below)</option>
            </Select>
          </Field>
          {form.categoryId === "OTHER" && (
            <Field label="Describe the service"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Water tank cleaning" /></Field>
          )}
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Full details of what is needed" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Building">
              <Select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })}>
                <option value="">Select building</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Floor">
              <Select value={form.floorId} onChange={(e) => setForm({ ...form, floorId: e.target.value })} disabled={!form.buildingId}>
                <option value="">Select floor</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Area">
              <Select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })} disabled={!form.floorId}>
                <option value="">Select area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget"><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="1500" /></Field>
            <Field label="Preferred date"><Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={resetForm}>Cancel</Button><Button type="submit" loading={busy}>{editingId ? "Save changes" : "Create"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
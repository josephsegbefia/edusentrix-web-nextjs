"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Save, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { useAuth } from "@/providers/auth-provider";

type ImportRow = {
  sourceRowNumber: number;
  sourceFullName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  department?: string | null;
  status?: string | null;
  photoUrl?: string | null;
  homeroomClassGroupId?: string | null;
  subjectOfferingIds: string[];
  explicitAssignments: Array<{ classGroupId?: string | null; subjectOfferingId?: string | null }>;
  setupStatus?: string;
};

type ImportJob = { id: string; status: string; parsedRows: ImportRow[] };
type ClassOption = { id: string; name: string; gradeId: string; gradeName: string };
type OfferingOption = { id: string; subjectId: string; displayName: string; gradeIds: string[] };
type AssignmentDraft = { classGroupId: string; subjectOfferingIds: string[] };

type Props = {
  job: ImportJob;
  onJobChange: (job: ImportJob) => void;
  onClose: () => void;
};

const STEPS = ["Identity", "Homeroom", "Teaching", "Photo & create"] as const;
const secondaryButtonClass = "gap-2 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)";
const primaryButtonClass = "gap-2 bg-brand text-black hover:opacity-90";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeRow(row: ImportRow): ImportRow {
  return {
    ...row,
    firstName: row.firstName || "",
    lastName: row.lastName || "",
    email: row.email || "",
    phone: row.phone || "",
    employeeId: row.employeeId || "",
    department: row.department || "",
    status: row.status || "active",
    photoUrl: row.photoUrl || "",
    homeroomClassGroupId: row.homeroomClassGroupId || "",
    subjectOfferingIds: Array.isArray(row.subjectOfferingIds) ? row.subjectOfferingIds.map(String) : [],
    explicitAssignments: Array.isArray(row.explicitAssignments) ? row.explicitAssignments : [],
  };
}

export function TeacherImportSetupWizard({ job, onJobChange, onClose }: Props) {
  const { me } = useAuth();
  const rows = job.parsedRows.map(normalizeRow);
  const [rowIndex, setRowIndex] = React.useState(() => Math.max(0, rows.findIndex((row) => row.setupStatus !== "completed")));
  const [step, setStep] = React.useState(1);
  const [homeroomQuery, setHomeroomQuery] = React.useState("");
  const [assignmentQueries, setAssignmentQueries] = React.useState<Record<number, string>>({});
  const [draft, setDraft] = React.useState<ImportRow>(() => normalizeRow(rows[Math.max(0, rows.findIndex((row) => row.setupStatus !== "completed"))] || rows[0]));
  const [assignments, setAssignments] = React.useState<AssignmentDraft[]>(() => []);
  const [classes, setClasses] = React.useState<ClassOption[]>([]);
  const [offerings, setOfferings] = React.useState<OfferingOption[]>([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const row = rows[rowIndex];
    if (!row) return;
    setDraft(normalizeRow(row));
    const grouped = new Map<string, string[]>();
    for (const item of row.explicitAssignments) {
      const classGroupId = stringValue(item.classGroupId);
      const offeringId = stringValue(item.subjectOfferingId);
      if (!classGroupId || !offeringId) continue;
      grouped.set(classGroupId, [...(grouped.get(classGroupId) || []), offeringId]);
    }
    setAssignments(Array.from(grouped, ([classGroupId, subjectOfferingIds]) => ({ classGroupId, subjectOfferingIds: [...new Set(subjectOfferingIds)] })));
    setHomeroomQuery("");
    setAssignmentQueries({});
    setStep(1);
  // The row index is the intentional navigation key; rows are refreshed after saves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIndex]);

  React.useEffect(() => {
    if (!me?.schoolId) return;
    let cancelled = false;
    setLoadingCatalog(true);
    Promise.all([
      fetch("/api/admin/grades?active=1", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/class-groups?active=1", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/subject-offerings?isActive=true", { cache: "no-store" }).then((res) => res.json()),
    ]).then(([gradeJson, classJson, offeringJson]) => {
      if (cancelled) return;
      const gradeRows = Array.isArray(gradeJson?.data) ? gradeJson.data : [];
      const gradeMap = new Map(gradeRows.map((item: Record<string, unknown>) => [stringValue(item.id || item._id), stringValue(item.name)]));
      const classRows = Array.isArray(classJson?.data) ? classJson.data : [];
      setClasses(classRows.map((item: Record<string, unknown>) => {
        const gradeId = stringValue(item.gradeId && typeof item.gradeId === "object" ? record(item.gradeId)._id : item.gradeId);
        return { id: stringValue(item._id || item.id), name: stringValue(item.name), gradeId, gradeName: gradeMap.get(gradeId) || "" };
      }).filter((item: ClassOption) => item.id && item.name));
      const offeringRows = Array.isArray(offeringJson?.data) ? offeringJson.data : [];
      setOfferings(offeringRows.map((item: Record<string, unknown>) => ({
        id: stringValue(item.id || item._id),
        subjectId: stringValue(item.subjectId),
        displayName: stringValue(item.displayName || item.shortName || "Subject"),
        gradeIds: Array.isArray(item.gradeIds) ? item.gradeIds.map(String) : [],
      })).filter((item: OfferingOption) => item.id && item.subjectId));
    }).catch(() => setError("School grades, classes, or subject offerings could not be loaded.")).finally(() => {
      if (!cancelled) setLoadingCatalog(false);
    });
    return () => { cancelled = true; };
  }, [me?.schoolId]);

  const updateDraft = (patch: Partial<ImportRow>) => setDraft((current) => ({ ...current, ...patch }));
  const currentClass = (id: string) => classes.find((item) => item.id === id);
  const optionsForClass = (classGroupId: string) => {
    const group = currentClass(classGroupId);
    if (!group) return [];
    return offerings.filter((offering) => offering.gradeIds.length === 0 || offering.gradeIds.includes(group.gradeId));
  };
  const visibleHomeroomClasses = classes.filter((item) => `${item.gradeName} ${item.name}`.toLowerCase().includes(homeroomQuery.trim().toLowerCase()));

  const saveDraft = async (action: "save" | "complete" | "mark_created" = "save", teacherId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${job.id}/setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          teacherId,
          sourceRowNumber: draft.sourceRowNumber,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          employeeId: draft.employeeId,
          department: draft.department,
          status: draft.status || "active",
          photoUrl: draft.photoUrl,
          homeroomClassGroupId: draft.homeroomClassGroupId,
          assignments,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save this teacher setup");
      onJobChange(json.data as ImportJob);
      return json.data as ImportJob;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this teacher setup");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveForLater = async () => {
    const saved = await saveDraft();
    if (saved) onClose();
  };

  const createTeacher = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
      setError("Add a valid first name, last name, and email before creating this teacher.");
      setStep(1);
      return;
    }
    const saved = await saveDraft("save");
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      const subjectIds = [...new Set(assignments.flatMap((assignment) => assignment.subjectOfferingIds.map((id) => offerings.find((offering) => offering.id === id)?.subjectId).filter((value): value is string => Boolean(value))))];
      const teachingAssignments = assignments.flatMap((assignment) => assignment.subjectOfferingIds.map((offeringId) => {
        const offering = offerings.find((item) => item.id === offeringId);
        return offering ? { subjectId: offering.subjectId, subjectOfferingId: offering.id, classGroupId: assignment.classGroupId } : null;
      }).filter((value): value is { subjectId: string; subjectOfferingId: string; classGroupId: string } => Boolean(value)));
      const response = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          email: draft.email.trim().toLowerCase(),
          phone: draft.phone || undefined,
          employeeId: draft.employeeId || undefined,
          department: draft.department || undefined,
          photoUrl: draft.photoUrl || undefined,
          status: draft.status === "inactive" ? "inactive" : "active",
          subjectIds,
          teachingAssignments,
          homeroomClassGroupId: draft.homeroomClassGroupId || undefined,
          teachingAssignmentResolution: "add_alongside",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not create this teacher");
      const teacherId = stringValue(json.data?._id || json.data?.id);
      const completed = await saveDraft("mark_created", teacherId);
      if (!completed) return;
      const nextRows = (completed as ImportJob).parsedRows;
      const nextIndex = nextRows.findIndex((row) => row.setupStatus !== "completed");
      if (nextIndex >= 0) setRowIndex(nextIndex);
      else onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this teacher");
    } finally {
      setBusy(false);
    }
  };

  if (!draft) return <p className="text-sm text-(--ws-fg-60)">No staged teachers were found.</p>;
  if (job.status === "completed") return <div className="space-y-4 text-center"><Check className="mx-auto h-10 w-10 text-emerald-500" /><h3 className="text-lg font-semibold text-(--ws-fg)">Teacher setup complete</h3><p className="text-sm text-(--ws-fg-60)">All staged teachers were created. You can close this window.</p><Button onClick={onClose} className={primaryButtonClass}>Close</Button></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-(--ws-fg-70)">Teacher <span className="font-semibold">{rowIndex + 1}</span> of {rows.length}</p>
          <div className="max-w-full rounded-xl border border-(--ws-cyan)/30 bg-(--ws-cyan)/5 px-4 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-(--ws-fg-60)">Source name</p>
            <p className="mt-1 truncate text-lg font-semibold text-(--ws-fg)" title={draft.sourceFullName || `${draft.firstName} ${draft.lastName}`}>
              {draft.sourceFullName || `${draft.firstName} ${draft.lastName}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void saveForLater()} disabled={busy} className={secondaryButtonClass}><Save className="h-4 w-4" />Save and resume later</Button>
      </div>

      <div className="flex items-center justify-between pb-6">
        <div className="text-sm text-(--ws-fg-70)">Step <span className="font-semibold">{step}</span> of {STEPS.length}</div>
        <div className="flex max-w-[min(100%,280px)] flex-wrap justify-end gap-1">
          {STEPS.map((label, index) => <span key={label} aria-label={label} className={`h-1.5 w-8 rounded-full transition-all ${index + 1 <= step ? "bg-brand" : "bg-(--ws-fill-strong)"}`} />)}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">{error}</div>}

      {step === 1 && <section className="space-y-6"><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-(--ws-fg-60)">Personal details</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="First name *" value={draft.firstName} onChange={(value) => updateDraft({ firstName: value })} /><Field label="Last name *" value={draft.lastName} onChange={(value) => updateDraft({ lastName: value })} /><Field label="Email *" type="email" value={draft.email} onChange={(value) => updateDraft({ email: value })} /><Field label="Phone" value={draft.phone || ""} onChange={(value) => updateDraft({ phone: value })} /><Field label="Employee ID" value={draft.employeeId || ""} onChange={(value) => updateDraft({ employeeId: value })} /><Field label="Department" value={draft.department || ""} onChange={(value) => updateDraft({ department: value })} /></div><div className="space-y-3"><Label className="text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-60)">Status</Label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(["active", "inactive"] as const).map((status) => { const selected = draft.status === status; return <label key={status} className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-4 text-sm font-medium capitalize transition-all ${selected ? "border-(--ws-cyan) bg-(--ws-cyan)/15 text-(--ws-cyan)" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"}`}><input type="radio" name="teacher-status" value={status} checked={selected} onChange={() => updateDraft({ status })} className="sr-only" />{status}</label>; })}</div></div><p className="text-xs text-(--ws-fg-50)">The imported identity values are suggestions. You can edit them before creation.</p></section>}

      {step === 2 && <section className="space-y-6"><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-(--ws-fg-60)">Homeroom (optional)</h2><p className="text-sm text-(--ws-fg-60)">Pick a class group now, or skip and assign subjects and classes after the teacher is created.</p><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--ws-fg-50)" /><Input type="search" placeholder="Search class groups..." value={homeroomQuery} onChange={(event) => setHomeroomQuery(event.target.value)} className="h-11 rounded-lg border border-(--ws-line) bg-(--ws-fill) pl-10 text-(--ws-fg) placeholder:text-(--ws-fg-50) focus:border-brand focus:ring-1 focus:ring-brand" /></div><div className="max-h-72 overflow-y-auto rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">{loadingCatalog ? <div className="py-8 text-center text-sm text-(--ws-fg-60)">Loading class groups…</div> : visibleHomeroomClasses.length === 0 ? <div className="py-8 text-center text-sm text-(--ws-fg-60)">{homeroomQuery.trim() ? "No class groups found matching your search." : "No active class groups are available."}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><button type="button" onClick={() => updateDraft({ homeroomClassGroupId: "" })} className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${!draft.homeroomClassGroupId ? "border-(--ws-cyan) bg-(--ws-cyan)/15 text-(--ws-cyan) shadow-lg shadow-cyan-500/10" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-80) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong)"}`}><span className="block font-semibold">No homeroom</span><span className="mt-1 block text-xs text-(--ws-fg-60)">Skip for now</span>{!draft.homeroomClassGroupId && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-(--ws-cyan) text-black"><Check className="h-4 w-4" /></span>}</button>{visibleHomeroomClasses.map((item) => { const selected = draft.homeroomClassGroupId === item.id; return <button type="button" key={item.id} onClick={() => updateDraft({ homeroomClassGroupId: item.id })} className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${selected ? "border-(--ws-cyan) bg-(--ws-cyan)/15 text-(--ws-cyan) shadow-lg shadow-cyan-500/10" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-80) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong)"}`}><span className="block font-semibold">{item.name}</span>{item.gradeName && <span className="mt-1 block text-xs text-(--ws-fg-60)">{item.gradeName}</span>}{selected && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-(--ws-cyan) text-black"><Check className="h-4 w-4" /></span>}</button>; })}</div>}</div></section>}

      {step === 3 && <section className="space-y-6"><div><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-(--ws-fg-60)">Teaching assignments</h2><p className="mt-2 text-sm text-(--ws-fg-60)">Add a class group, then select only subject offerings configured for that class.</p></div>{loadingCatalog ? <div className="flex items-center gap-2 text-sm text-(--ws-fg-60)"><Loader2 className="h-4 w-4 animate-spin" />Loading school catalog…</div> : <>{assignments.map((assignment, index) => { const query = assignmentQueries[index] || ""; const matchingClasses = classes.filter((item) => `${item.gradeName} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())); const selectedClass = currentClass(assignment.classGroupId); return <div key={`${assignment.classGroupId}-${index}`} className="space-y-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-(--ws-fg)">Class group {index + 1}</p><Button type="button" variant="outline" className={secondaryButtonClass} onClick={() => setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--ws-fg-50)" /><Input type="search" placeholder="Search class groups..." value={query} onChange={(event) => setAssignmentQueries((current) => ({ ...current, [index]: event.target.value }))} className="h-11 rounded-lg border border-(--ws-line) bg-(--ws-fill) pl-10 text-(--ws-fg) placeholder:text-(--ws-fg-50) focus:border-brand focus:ring-1 focus:ring-brand" /></div><div className="max-h-64 overflow-y-auto rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">{matchingClasses.length === 0 ? <div className="py-6 text-center text-sm text-(--ws-fg-60)">{query.trim() ? "No class groups found matching your search." : "No active class groups are available."}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{matchingClasses.map((item) => { const selected = assignment.classGroupId === item.id; return <button type="button" key={item.id} onClick={() => setAssignments((current) => current.map((entry, entryIndex) => entryIndex === index ? { classGroupId: item.id, subjectOfferingIds: [] } : entry))} className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${selected ? "border-(--ws-cyan) bg-(--ws-cyan)/15 text-(--ws-cyan) shadow-lg shadow-cyan-500/10" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-80) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong)"}`}><span className="block font-semibold">{item.name}</span>{item.gradeName && <span className="mt-1 block text-xs text-(--ws-fg-60)">{item.gradeName}</span>}{selected && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-(--ws-cyan) text-black"><Check className="h-4 w-4" /></span>}</button>; })}</div>}</div>{selectedClass ? <div className="space-y-3"><p className="text-sm font-medium text-(--ws-fg)">Subjects taught in {selectedClass.name}</p><div className="grid gap-2 sm:grid-cols-2">{optionsForClass(assignment.classGroupId).map((offering) => <label key={offering.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-sm text-(--ws-fg-80)"><input type="checkbox" checked={assignment.subjectOfferingIds.includes(offering.id)} onChange={(event) => setAssignments((current) => current.map((item, itemIndex) => itemIndex !== index ? item : { ...item, subjectOfferingIds: event.target.checked ? [...item.subjectOfferingIds, offering.id] : item.subjectOfferingIds.filter((id) => id !== offering.id) }))} className="accent-cyan-600 dark:accent-cyan-400" />{offering.displayName}</label>)}</div>{optionsForClass(assignment.classGroupId).length === 0 && <p className="text-xs text-(--ws-amber)">No subject offerings are configured for this class.</p>}</div> : <p className="text-sm text-(--ws-fg-60)">Select a class group to choose its subject offerings.</p>}</div>; })}<Button type="button" variant="outline" className={secondaryButtonClass} onClick={() => setAssignments((current) => [...current, { classGroupId: "", subjectOfferingIds: [] }])}>Add class group</Button></>}</section>}

      {step === 4 && <section className="space-y-6"><div><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-(--ws-fg-60)">Photo &amp; create</h2><p className="mt-2 text-sm text-(--ws-fg-60)">Add an avatar now or skip it and update the teacher later.</p></div>{me?.schoolId ? <ImageUploader schoolId={me.schoolId} subjectRole="teachers" initialPreviewUrl={draft.photoUrl || null} onUploaded={(payload) => updateDraft({ photoUrl: payload.url })} onError={setError} label="Upload teacher avatar" /> : null}<div className="space-y-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 text-sm"><p className="font-medium text-(--ws-fg)">Ready to create</p><p className="text-(--ws-fg-60)">{draft.firstName} {draft.lastName} · {draft.email}</p><p className="text-(--ws-fg-60)">{assignments.reduce((count, item) => count + item.subjectOfferingIds.length, 0)} subject/class assignment(s) · {draft.homeroomClassGroupId ? "homeroom selected" : "no homeroom"}</p></div></section>}

      <div className="flex items-center justify-between border-t border-(--ws-line) pt-6"><Button type="button" variant="outline" onClick={() => step > 1 ? setStep((current) => current - 1) : onClose()} disabled={busy} className={secondaryButtonClass}><ChevronLeft className="h-4 w-4" />{step > 1 ? "Previous" : "Cancel"}</Button>{step < 4 ? <Button type="button" onClick={() => { setError(null); setStep((current) => current + 1); }} disabled={busy} className={primaryButtonClass}>Next<ChevronRight className="h-4 w-4" /></Button> : <Button type="button" onClick={() => void createTeacher()} disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{busy ? "Creating…" : "Create Teacher"}</Button>}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-60)">{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-40) focus:border-brand focus:ring-1 focus:ring-brand" /></div>;
}

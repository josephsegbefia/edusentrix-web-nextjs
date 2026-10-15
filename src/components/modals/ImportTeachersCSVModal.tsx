"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { TeacherImportReviewV2 } from "@/components/admin/teachers/import/TeacherImportReviewV2";
import { TeacherImportSetupWizard } from "@/components/admin/teachers/import/TeacherImportSetupWizard";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { TEACHER_IMPORT_TEMPLATE_CSV } from "@/lib/teachers/teacher-import-template";

type ImportStage = "upload" | "analysing" | "review" | "invitations" | "results";
type Issue = { code: string; message: string; field?: string | null; value?: string | null };
type SubjectResolution = {
  resolutionKey: string;
  sourceValue: string;
  subjectOfferingIds: string[];
  resolvedNames: string[];
  status: string;
  affectedRows: number[];
  candidateOptions?: Array<{ id: string; label: string; gradeBand?: string | null }>;
  note?: string | null;
};
type ClassResolution = {
  sourceValue: string;
  classGroupId?: string | null;
  status: string;
  affectedRows: number[];
  candidateOptions?: Array<{ id: string; label: string; gradeId: string }>;
  occupiedTeacherName?: string | null;
  homeroomDecision?: "keep_existing" | "replace" | "no_assign" | null;
  note?: string | null;
};
type ImportRow = {
  sourceRowNumber: number;
  sourceValues: Record<string, string>;
  sourceFullName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  status?: string | null;
  subjects: string[];
  explicitAssignments: Array<{ classGroupId?: string | null; subjectOfferingId?: string | null }>;
  subjectOfferingIds: string[];
  subjectIds: string[];
  department?: string | null;
  homeroomClassGroupId?: string | null;
  commitError?: string | null;
  teacherId?: string | null;
  setupStatus?: string;
  photoUrl?: string | null;
  invitation?: { status: string; warning?: string | null; invitationId?: string | null } | null;
  homeroomClass?: string | null;
  homeroomGrade?: string | null;
  resolutionStatus: string;
  rowState: string;
  issues: Issue[];
};
type ImportJob = {
  id: string;
  status: string;
  workflow?: string;
  fileName: string;
  selectedSheetName?: string | null;
  availableSheets?: Array<{ name: string; score: number; rowCount: number; signals: string[] }>;
  sheetSelectionRequired?: boolean;
  columnMappings: Array<{ sourceHeader: string; canonicalField: string | null; source: string; status: string }>;
  parsedRows: ImportRow[];
  subjectResolutions: SubjectResolution[];
  classResolutions: ClassResolution[];
  analysisSummary?: {
    totalRows: number;
    readyRows: number;
    needsReviewRows: number;
    blockedRows: number;
    existingRows: number;
    mappedColumns: number;
    resolvedSubjectAliases: number;
    resolvedClassAliases: number;
    leoUnavailable: boolean;
  } | null;
  analysisWarnings: Issue[];
  analysisErrors: Issue[];
  result?: Record<string, number> | null;
  leoAnalysis?: { status: string; reasonCode?: string | null; reason?: string | null; model?: string | null } | null;
};

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const fields = [
  ["firstName", "First name"],
  ["middleNames", "Middle names"],
  ["lastName", "Last name"],
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["employeeId", "Employee ID"],
  ["department", "Department"],
  ["status", "Status"],
  ["subjects", "Subjects"],
  ["gradeScopes", "Grades taught"],
  ["classScopes", "Classes taught"],
  ["explicitAssignments", "Teaching assignments"],
  ["homeroomClass", "Homeroom class"],
  ["homeroomGrade", "Homeroom grade"],
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function normalizeIssue(value: unknown): Issue {
  const issue = record(value);
  return {
    code: stringValue(issue.code),
    message: stringValue(issue.message),
    field: nullableString(issue.field),
    value: nullableString(issue.value),
  };
}

function normalizeImportJob(value: unknown): ImportJob {
  const source = record(value);
  const parsedRows = Array.isArray(source.parsedRows)
    ? source.parsedRows.map((value) => {
        const row = record(value);
        const hasAnalysisState = typeof row.resolutionStatus === "string" && typeof row.rowState === "string";
        const issues = Array.isArray(row.issues) ? row.issues.map(normalizeIssue) : [];
        if (!hasAnalysisState) {
          issues.push({
            code: "legacy_import_needs_reanalysis",
            message: "This import was created by an older import version and needs to be re-analysed/re-uploaded.",
          });
        }
        return {
          sourceRowNumber: typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : 0,
          sourceValues: Object.fromEntries(Object.entries(record(row.sourceValues)).map(([key, item]) => [key, stringValue(item)])),
          sourceFullName: nullableString(row.sourceFullName || row.fullName),
          firstName: stringValue(row.firstName),
          lastName: stringValue(row.lastName),
          email: stringValue(row.email),
          phone: nullableString(row.phone),
          employeeId: nullableString(row.employeeId),
          department: nullableString(row.department),
          status: nullableString(row.status),
          subjects: stringArray(row.subjects),
          explicitAssignments: Array.isArray(row.explicitAssignments) ? row.explicitAssignments as ImportRow["explicitAssignments"] : [],
          subjectOfferingIds: stringArray(row.subjectOfferingIds),
          subjectIds: stringArray(row.subjectIds),
          homeroomClass: nullableString(row.homeroomClass),
          homeroomGrade: nullableString(row.homeroomGrade),
          homeroomClassGroupId: nullableString(row.homeroomClassGroupId),
          resolutionStatus: hasAnalysisState ? stringValue(row.resolutionStatus) : "needs_review",
          rowState: hasAnalysisState ? stringValue(row.rowState) : "pending",
          issues,
          commitError: nullableString(row.commitError),
          teacherId: nullableString(row.teacherId),
          setupStatus: stringValue(row.setupStatus, "pending"),
          photoUrl: nullableString(row.photoUrl),
          invitation: row.invitation && typeof row.invitation === "object"
            ? {
                status: stringValue(record(row.invitation).status, "not_requested"),
                warning: nullableString(record(row.invitation).warning),
                invitationId: nullableString(record(row.invitation).invitationId),
              }
            : null,
        };
      })
    : [];
  const normalizeResolution = (value: unknown): SubjectResolution => {
    const resolution = record(value);
    const sourceValue = stringValue(resolution.sourceValue);
    return {
      resolutionKey: stringValue(resolution.resolutionKey, sourceValue ? `legacy:${sourceValue}` : ""),
      sourceValue,
      subjectOfferingIds: stringArray(resolution.subjectOfferingIds),
      resolvedNames: stringArray(resolution.resolvedNames),
      status: stringValue(resolution.status, "needs_review"),
      affectedRows: Array.isArray(resolution.affectedRows) ? resolution.affectedRows.filter((item): item is number => typeof item === "number") : [],
      candidateOptions: Array.isArray(resolution.candidateOptions)
        ? resolution.candidateOptions.map((value) => {
            const option = record(value);
            return { id: stringValue(option.id), label: stringValue(option.label), gradeBand: nullableString(option.gradeBand) };
          })
        : [],
      note: nullableString(resolution.note),
    };
  };
  const classResolution = (value: unknown): ClassResolution => {
    const resolution = record(value);
    return {
      sourceValue: stringValue(resolution.sourceValue),
      classGroupId: nullableString(resolution.classGroupId),
      status: stringValue(resolution.status, "needs_review"),
      affectedRows: Array.isArray(resolution.affectedRows) ? resolution.affectedRows.filter((item): item is number => typeof item === "number") : [],
      candidateOptions: Array.isArray(resolution.candidateOptions)
        ? resolution.candidateOptions.map((value) => {
            const option = record(value);
            return { id: stringValue(option.id), label: stringValue(option.label), gradeId: stringValue(option.gradeId) };
          })
        : [],
      occupiedTeacherName: nullableString(resolution.occupiedTeacherName),
      homeroomDecision: nullableString(resolution.homeroomDecision) as ClassResolution["homeroomDecision"],
      note: nullableString(resolution.note),
    };
  };
  const analysisWarnings = Array.isArray(source.analysisWarnings) ? source.analysisWarnings.map(normalizeIssue) : [];
  if (parsedRows.some((row) => row.issues.some((issue) => issue.code === "legacy_import_needs_reanalysis")) && !analysisWarnings.some((issue) => issue.code === "legacy_import_needs_reanalysis")) {
    analysisWarnings.push({ code: "legacy_import_needs_reanalysis", message: "This import was created by an older import version and needs to be re-analysed/re-uploaded." });
  }
  return {
    id: stringValue(source.id),
    status: stringValue(source.status),
    workflow: stringValue(source.workflow, "legacy_relationship_review"),
    fileName: stringValue(source.fileName),
    selectedSheetName: nullableString(source.selectedSheetName),
    availableSheets: Array.isArray(source.availableSheets) ? source.availableSheets as ImportJob["availableSheets"] : [],
    sheetSelectionRequired: Boolean(source.sheetSelectionRequired),
    columnMappings: Array.isArray(source.columnMappings) ? source.columnMappings.map((value) => {
      const mapping = record(value);
      return { sourceHeader: stringValue(mapping.sourceHeader), canonicalField: nullableString(mapping.canonicalField), source: stringValue(mapping.source), status: stringValue(mapping.status, "needs_review") };
    }) : [],
    parsedRows,
    subjectResolutions: Array.isArray(source.subjectResolutions) ? source.subjectResolutions.map(normalizeResolution) : [],
    classResolutions: Array.isArray(source.classResolutions) ? source.classResolutions.map(classResolution) : [],
    analysisSummary: source.analysisSummary ? record(source.analysisSummary) as ImportJob["analysisSummary"] : null,
    analysisWarnings,
    analysisErrors: Array.isArray(source.analysisErrors) ? source.analysisErrors.map(normalizeIssue) : [],
    result: source.result ? record(source.result) as ImportJob["result"] : null,
    leoAnalysis: source.leoAnalysis ? record(source.leoAnalysis) as ImportJob["leoAnalysis"] : null,
  };
}

async function readJob(id: string) {
  const response = await fetch(`/api/admin/teachers/imports/${id}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error || "Unable to load teacher import");
  return normalizeImportJob(json.data);
}

function statusLabel(row: ImportRow) {
  if (row.rowState === "existing") return "Existing — skipped";
  if (row.resolutionStatus === "blocked") return "Blocked";
  if (row.resolutionStatus === "needs_review") return "Needs review";
  return "Ready";
}

export function ImportTeachersCSVModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { confirm: confirmDialogAction, confirmationDialog } = useConfirmationDialog();
  const [file, setFile] = React.useState<File | null>(null);
  const [stage, setStage] = React.useState<ImportStage>("upload");
  const [job, setJob] = React.useState<ImportJob | null>(null);
  const [activeDraft, setActiveDraft] = React.useState<ImportJob | null>(null);
  const [invitationMode, setInvitationMode] = React.useState<"send_now" | "create_only">("send_now");
  const [busy, setBusy] = React.useState(false);
  const [subjectChoices, setSubjectChoices] = React.useState<Record<string, string[]>>({});
  const [classChoices, setClassChoices] = React.useState<Record<string, { id: string; decision: "keep_existing" | "replace" | "no_assign" }>>({});
  const [reanalysisPending, setReanalysisPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setJob(null);
      setActiveDraft(null);
      setStage("upload");
      setBusy(false);
      setSubjectChoices({});
      setClassChoices({});
      setReanalysisPending(false);
    } else {
      void fetch("/api/admin/teachers/imports?active=1", { cache: "no-store" })
        .then((response) => response.json())
        .then((json) => {
          const candidate = Array.isArray(json?.data) ? json.data[0] : null;
          if (json?.success && candidate) setActiveDraft(normalizeImportJob(candidate));
        })
        .catch(() => undefined);
    }
  }, [open]);

  const poll = React.useCallback(async (id: string, terminal: string[]) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const latest = await readJob(id);
      setJob(latest);
      if (terminal.includes(latest.status)) return latest;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("This import is still running. You can close this window and return from import history later.");
  }, []);

  const upload = async () => {
    if (!file) return toast.error("Choose a CSV, XLS, or XLSX file first.");
    setBusy(true);
    setStage("analysing");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/teachers/bulk-create", { method: "POST", body: form });
      const json = await response.json();
      if (response.status === 409 && json.errorCode === "ACTIVE_IMPORT_DRAFT_EXISTS" && json.data?.job) {
        const existing = normalizeImportJob(json.data.job);
        setActiveDraft(existing);
        setJob(existing);
        setStage(existing.status === "review_ready" ? "review" : "analysing");
        toast.info("Resuming your unfinished teacher import.");
        if (["uploaded", "analyzing"].includes(existing.status)) {
          const latest = await poll(existing.id, ["review_ready", "failed", "cancelled"]);
          setJob(latest);
          if (latest.status === "review_ready") setStage("review");
        }
        return;
      }
      if (!response.ok || !json.success || !json.teacherImportJobId) throw new Error(json.error || "Teacher import upload failed");
      const latest = await poll(String(json.teacherImportJobId), ["review_ready", "failed", "cancelled"]);
      if (latest.status === "review_ready") setStage("review");
      else toast.error(latest.analysisWarnings?.[0]?.message || "Teacher analysis failed.");
    } catch (error) {
      setStage("upload");
      toast.error(error instanceof Error ? error.message : "Teacher import failed");
    } finally {
      setBusy(false);
    }
  };

  const continueDraft = async () => {
    if (!activeDraft) return;
    setJob(activeDraft);
    setActiveDraft(null);
    if (activeDraft.status === "review_ready") {
      setStage("review");
      return;
    }
    setStage("analysing");
    try {
      const latest = await poll(activeDraft.id, ["review_ready", "failed", "cancelled"]);
      setJob(latest);
      if (latest.status === "review_ready") setStage("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resume teacher import");
      setStage("upload");
    }
  };

  const startOver = async () => {
    if (!activeDraft) return;
    const decision = await confirmDialogAction({
      title: "Start over with this import?",
      description: "The saved review draft will be cancelled and its uploaded file discarded. This cannot be undone.",
      confirmLabel: "Start over",
      cancelLabel: "Keep draft",
    });
    if (decision !== "confirm") return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${activeDraft.id}/cancel`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not discard the unfinished import");
      setActiveDraft(null);
      setJob(null);
      setFile(null);
      toast.success("Unfinished import discarded. You can upload a new file.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard the unfinished import");
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const requiresFreshReview = reanalysisPending;
      const rows = requiresFreshReview ? [] : job.parsedRows.map((row) => ({ sourceRowNumber: row.sourceRowNumber, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, employeeId: row.employeeId, status: row.status }));
      const subjectResolutions = (requiresFreshReview ? [] : job.subjectResolutions)
        .filter((resolution) => !["resolved", "ignored"].includes(resolution.status))
        .map((resolution) => ({ resolutionKey: resolution.resolutionKey, subjectOfferingIds: (subjectChoices[resolution.resolutionKey] || []).filter((value) => value !== "__ignore__"), ignored: subjectChoices[resolution.resolutionKey]?.includes("__ignore__") || false }));
      const classResolutions = (requiresFreshReview ? [] : job.classResolutions)
        .filter((resolution) => resolution.status !== "resolved" || resolution.occupiedTeacherName)
        .map((resolution) => ({ sourceValue: resolution.sourceValue, classGroupId: classChoices[resolution.sourceValue]?.id || resolution.classGroupId || null, homeroomDecision: classChoices[resolution.sourceValue]?.decision || resolution.homeroomDecision || "no_assign" as const }));
      const response = await fetch(`/api/admin/teachers/imports/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          selectedSheetName: job.selectedSheetName || null,
          columnMappings: job.columnMappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, canonicalField: mapping.canonicalField || null })),
          subjectResolutions,
          classResolutions,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save review changes");
      setJob(normalizeImportJob(json.data));
      if (requiresFreshReview) {
        setReanalysisPending(false);
        setSubjectChoices({});
        setClassChoices({});
        toast.success("Workbook changes were reanalysed. Review the refreshed rows before continuing.");
        return false;
      }
      toast.success("Review decisions saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save review changes");
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (sourceRowNumber: number, patch: Partial<ImportRow>) => {
    setJob((current) => current ? {
      ...current,
      parsedRows: current.parsedRows.map((row) => row.sourceRowNumber === sourceRowNumber ? { ...row, ...patch } : row),
    } : current);
  };

  const updateColumnMapping = (sourceHeader: string, canonicalField: string | null) => {
    setJob((current) => current ? {
      ...current,
      columnMappings: current.columnMappings.map((mapping) =>
        mapping.sourceHeader === sourceHeader ? { ...mapping, canonicalField } : mapping
      ),
    } : current);
    setReanalysisPending(true);
  };

  const confirm = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const saved = await saveReview();
      if (!saved) return;
      const response = await fetch(`/api/admin/teachers/imports/${job.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationMode }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not confirm teacher import");
      setStage("results");
      const latest = await poll(job.id, ["completed", "completed_with_errors", "failed"]);
      setJob(latest);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm teacher import");
    } finally {
      setBusy(false);
    }
  };

  const retryLeo = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${job.id}/leo-retry`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not retry Leo analysis");
      setStage("analysing");
      const latest = await poll(job.id, ["review_ready", "failed", "cancelled"]);
      setJob(latest);
      if (latest.status === "review_ready") setStage("review");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not retry Leo analysis"); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  const summary = job?.analysisSummary;
  const unresolvedSubjects = job?.subjectResolutions.filter((item) => !["resolved", "ignored"].includes(item.status)) || [];
  const unresolvedClasses = job?.classResolutions.filter((item) => item.status !== "resolved" || item.occupiedTeacherName) || [];
  const canConfirm = Boolean(job && (summary?.blockedRows || 0) === 0 && (summary?.needsReviewRows || 0) === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onOpenChange(false); }} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-(--ws-line) bg-(--ws-popover) text-(--ws-fg) shadow-[var(--ws-shadow)]">
        <div className="flex items-start justify-between border-b border-(--ws-line) px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-(--ws-cyan)">Teacher onboarding</p>
            <h2 className="mt-1 text-xl font-semibold">Staged teacher onboarding</h2>
            <p className="mt-1 text-sm text-(--ws-fg-60)">Upload identity details first, then complete each teacher safely in the guided setup wizard.</p>
          </div>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => onOpenChange(false)} aria-label="Close import"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-1 border-b border-(--ws-line) px-6 py-3 text-xs text-(--ws-fg-60)">
          {(["upload", "analysing", "review", "invitations", "results"] as ImportStage[]).map((item) => <span key={item} className={`rounded-full px-3 py-1 ${stage === item ? "bg-(--ws-cyan)/15 text-(--ws-cyan)" : ""}`}>{item === "analysing" ? "Prepare" : item === "review" ? "Setup" : item[0].toUpperCase() + item.slice(1)}</span>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {stage === "upload" && (
            <div className="space-y-5">
              {activeDraft && <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Unfinished teacher setup found</p><p className="mt-1 text-sm text-(--ws-fg-60)">{activeDraft.fileName} · {activeDraft.status === "review_ready" ? "ready to continue" : activeDraft.status === "failed" ? "analysis needs attention" : "preparing identities"}</p><p className="mt-1 text-xs text-(--ws-fg-60)">{activeDraft.analysisSummary?.totalRows || 0} teacher identities detected. Your saved setup state is preserved.</p></div><div className="flex gap-2"><Button size="sm" onClick={() => void continueDraft()} disabled={busy || activeDraft.status === "failed"}>Resume setup</Button><Button size="sm" variant="outline" onClick={() => void startOver()} disabled={busy}>Start over</Button></div></div></div>}
              <div className="rounded-xl border border-(--ws-cyan)/20 bg-(--ws-cyan)/8 p-4 text-sm">
                <div className="flex gap-3"><FileSpreadsheet className="mt-0.5 h-5 w-5 text-(--ws-cyan)" /><div><p className="font-medium">Identity template recommended, not mandatory</p><p className="mt-1 text-(--ws-fg-60)">Upload teacher names, phone numbers, and email addresses. Other spreadsheet columns are ignored during upload and can be completed later in the guided setup wizard.</p><p className="mt-1 text-xs text-(--ws-fg-60)">Names are preserved exactly as supplied. Where a name has more than two parts, the final part becomes the last name and the earlier parts stay together as the first name.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => { const url = URL.createObjectURL(new Blob([TEACHER_IMPORT_TEMPLATE_CSV], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "teachers-identity-import-template.csv"; link.click(); URL.revokeObjectURL(url); toast.success("Template downloaded"); }}><Download className="mr-2 h-4 w-4" />Download template</Button></div></div>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-(--ws-line) bg-(--ws-fill) px-6 py-12 text-center hover:bg-(--ws-fill-strong)"><Upload className="h-8 w-8 text-(--ws-cyan)" /><span className="mt-3 text-sm font-medium">Choose CSV, XLS, or XLSX</span><span className="mt-1 text-xs text-(--ws-fg-60)">{file ? file.name : "The upload is analysed in the background; no teachers are created yet."}</span><input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
              <Button onClick={upload} disabled={!file || busy} className="w-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Start analysis</Button>
            </div>
          )}
          {stage === "analysing" && <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><Loader2 className="h-10 w-10 animate-spin text-(--ws-cyan)" /><h3 className="mt-4 font-medium">Preparing {file?.name || "workbook"}</h3><p className="mt-2 max-w-md text-sm text-(--ws-fg-60)">Reading the workbook, preserving source identity values, and preparing the teacher setup queue. You may close this window; the background job continues.</p></div>}
          {stage === "review" && job && job.workflow === "identity_setup_v1" && <TeacherImportSetupWizard job={job} onJobChange={(next) => { setJob((current) => current ? ({ ...current, status: next.status, parsedRows: next.parsedRows as ImportRow[] } as ImportJob) : current); }} onClose={() => onOpenChange(false)} />}
          {stage === "review" && job && job.workflow !== "identity_setup_v1" && <TeacherImportReviewV2 jobId={job.id} onContinue={() => setStage("invitations")} />}
          {/* Legacy relationship review UI is intentionally disabled for new identity_setup_v1 imports.
          {stage === "review" && job && false && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-4"><Stat label="Teachers found" value={summary?.totalRows || 0} /><Stat label="Ready" value={summary?.readyRows || 0} tone="good" /><Stat label="Needs review" value={summary?.needsReviewRows || 0} tone="warn" /><Stat label="Blocked" value={summary?.blockedRows || 0} tone="bad" /></div>
              {summary?.leoUnavailable && <Notice tone="warn">Leo assistance unavailable. Deterministic matching completed; review the remaining items manually.</Notice>}
              {reviewJob.leoAnalysis && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 text-xs"><span><span className="font-medium">Leo intelligence:</span> {reviewJob.leoAnalysis.status}{reviewJob.leoAnalysis.reasonCode ? ` · ${reviewJob.leoAnalysis.reasonCode}` : ""}{reviewJob.leoAnalysis.reason ? ` — ${reviewJob.leoAnalysis.reason}` : ""}</span>{["unavailable", "degraded"].includes(reviewJob.leoAnalysis.status) && <Button size="sm" variant="outline" onClick={retryLeo} disabled={busy}>Retry Leo without re-upload</Button>}</div>}
              {job.selectedSheetName && <p className="text-xs text-(--ws-fg-60)">Selected worksheet: <span className="font-medium text-(--ws-fg)">{job.selectedSheetName}</span>. {summary?.mappedColumns || 0} columns mapped automatically.</p>}
              {job.sheetSelectionRequired && (job.availableSheets || []).length > 1 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4"><h3 className="font-medium">Confirm worksheet</h3><p className="mt-1 text-xs text-(--ws-fg-60)">More than one worksheet looks like teacher data. Choose the intended sheet; saving reruns the full review safely.</p><select className="mt-3 rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-sm" value={job.selectedSheetName || ""} onChange={(event) => { setJob({ ...job, selectedSheetName: event.target.value || null }); setReanalysisPending(true); }}>{(job.availableSheets || []).map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rowCount} rows</option>)}</select></div>}
              {job.columnMappings.some((mapping) => !mapping.canonicalField) && <div className="rounded-xl border border-(--ws-line) p-4"><h3 className="font-medium">Unmapped columns</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Choose a canonical field only when the column truly contains that value.</p><div className="mt-3 space-y-2">{job.columnMappings.filter((mapping) => !mapping.canonicalField).map((mapping) => <div key={mapping.sourceHeader} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{mapping.sourceHeader}</span><select className="rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2" value={mapping.canonicalField || ""} onChange={(event) => updateColumnMapping(mapping.sourceHeader, event.target.value || null)}><option value="">Ignore</option>{fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div></div>}
              {unresolvedSubjects.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4"><h3 className="font-medium">Subject resolution</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Choose a real active SubjectOffering. Identical source text is kept separate when its grade context differs.</p><div className="mt-3 space-y-3">{unresolvedSubjects.map((resolution) => <div key={resolution.resolutionKey} className="rounded-lg border border-(--ws-line) p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{resolution.sourceValue}</p><p className="text-xs text-(--ws-fg-60)">{resolution.affectedRows.length} affected row(s) · {resolution.note}</p></div><select className="max-w-full rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-sm" value={(subjectChoices[resolution.resolutionKey] || [])[0] || ""} onChange={(event) => setSubjectChoices({ ...subjectChoices, [resolution.resolutionKey]: event.target.value ? [event.target.value] : [] })}><option value="">Leave unresolved</option><option value="__ignore__">Ignore this subject for these rows</option>{(resolution.candidateOptions || []).map((option) => <option key={option.id} value={option.id}>{option.label}{option.gradeBand ? ` · ${option.gradeBand}` : ""}</option>)}</select></div></div>)}</div></div>}
              {unresolvedClasses.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4"><h3 className="font-medium">Homeroom resolution</h3><div className="mt-3 space-y-3">{unresolvedClasses.map((resolution) => <div key={resolution.sourceValue} className="rounded-lg border border-(--ws-line) p-3"><p className="font-medium">{resolution.sourceValue}</p><p className="text-xs text-(--ws-fg-60)">{resolution.occupiedTeacherName ? `Current homeroom teacher: ${resolution.occupiedTeacherName}` : resolution.note}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><select className="rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-sm" value={classChoices[resolution.sourceValue]?.id || resolution.classGroupId || ""} onChange={(event) => setClassChoices({ ...classChoices, [resolution.sourceValue]: { id: event.target.value, decision: classChoices[resolution.sourceValue]?.decision || "replace" } })}><option value="">Choose class</option>{(resolution.candidateOptions || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select className="rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-sm" value={classChoices[resolution.sourceValue]?.decision || "no_assign"} onChange={(event) => setClassChoices({ ...classChoices, [resolution.sourceValue]: { id: classChoices[resolution.sourceValue]?.id || resolution.classGroupId || "", decision: event.target.value as "keep_existing" | "replace" | "no_assign" } })}><option value="no_assign">Do not assign homeroom</option><option value="keep_existing">Keep existing teacher</option><option value="replace">Replace with imported teacher</option></select></div></div>)}</div></div>}
              <div className="rounded-xl border border-(--ws-line) p-4"><h3 className="font-medium">Row review</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Names, email addresses, and status values can be corrected before confirmation. The source row number is preserved for audit.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="text-xs text-(--ws-fg-60)"><tr><th className="px-2 py-2">Row</th><th className="px-2 py-2">First name</th><th className="px-2 py-2">Last name</th><th className="px-2 py-2">Email</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Subjects</th><th className="px-2 py-2">Homeroom</th><th className="px-2 py-2">State</th></tr></thead><tbody>{job.parsedRows.map((row) => <tr key={row.sourceRowNumber} className="border-t border-(--ws-line)"><td className="px-2 py-2 text-(--ws-fg-60)">{row.sourceRowNumber}</td><td className="px-2 py-2"><input className="w-32 rounded-md border border-(--ws-line) bg-(--ws-fill) px-2 py-1" value={row.firstName} onChange={(event) => updateRow(row.sourceRowNumber, { firstName: event.target.value })} /></td><td className="px-2 py-2"><input className="w-32 rounded-md border border-(--ws-line) bg-(--ws-fill) px-2 py-1" value={row.lastName} onChange={(event) => updateRow(row.sourceRowNumber, { lastName: event.target.value })} /></td><td className="px-2 py-2"><input className="w-56 rounded-md border border-(--ws-line) bg-(--ws-fill) px-2 py-1" value={row.email} onChange={(event) => updateRow(row.sourceRowNumber, { email: event.target.value })} /></td><td className="px-2 py-2"><select className="rounded-md border border-(--ws-line) bg-(--ws-fill) px-2 py-1" value={row.status || "active"} onChange={(event) => updateRow(row.sourceRowNumber, { status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option><option value="terminated">Terminated</option>{row.status && !["active", "inactive", "on_leave", "terminated"].includes(row.status) && <option value={row.status}>{row.status} — review</option>}</select></td><td className="max-w-[220px] px-2 py-2">{(Array.isArray(row.subjects) ? row.subjects : []).join(", ") || "—"}</td><td className="px-2 py-2">{[row.homeroomGrade, row.homeroomClass].filter(Boolean).join(" ") || "—"}</td><td className="px-2 py-2"><span className={row.resolutionStatus === "resolved" ? "text-emerald-500" : row.resolutionStatus === "blocked" ? "text-rose-500" : "text-amber-500"}>{statusLabel(row)}</span>{row.issues?.[0] && <p className="mt-1 max-w-[220px] text-xs text-(--ws-fg-60)">{row.issues[0].message}</p>}</td></tr>)}</tbody></table></div></div>
              <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={saveReview} disabled={busy}>Save review</Button><Button onClick={() => { if (reanalysisPending) return toast.error("Save the worksheet or column changes and review the refreshed results first."); if (!canConfirm) return toast.error("Resolve blocked and review items before continuing."); setStage("invitations"); }} disabled={busy || !canConfirm || reanalysisPending}>Continue to invitations</Button></div>
            </div>
          )}
          */}
          {stage === "invitations" && job && <div className="mx-auto max-w-2xl space-y-5"><h3 className="text-lg font-semibold">Invitation behaviour</h3><p className="text-sm text-(--ws-fg-60)">Choose what happens after each teacher is created. Invitation delivery never rolls back a successful teacher creation.</p><label className="flex cursor-pointer gap-3 rounded-xl border border-(--ws-line) p-4"><input type="radio" checked={invitationMode === "send_now"} onChange={() => setInvitationMode("send_now")} /><span><span className="font-medium">Send invitations after teachers are created</span><span className="mt-1 block text-xs text-(--ws-fg-60)">Uses the existing Clerk and email invitation flow. Delivery may be sent or queued for retry.</span></span></label><label className="flex cursor-pointer gap-3 rounded-xl border border-(--ws-line) p-4"><input type="radio" checked={invitationMode === "create_only"} onChange={() => setInvitationMode("create_only")} /><span><span className="font-medium">Create teachers only</span><span className="mt-1 block text-xs text-(--ws-fg-60)">No invitation is created; invite teachers later from the existing teacher workflow.</span></span></label><div className="flex justify-between"><Button variant="outline" onClick={() => setStage("review")}>Back</Button><Button onClick={() => setStage("results")}>Review confirmation</Button></div></div>}
          {stage === "results" && job && job.status === "review_ready" && <div className="mx-auto max-w-2xl space-y-5"><h3 className="text-lg font-semibold">Confirm teacher creation</h3><Notice tone="warn">This is the only step that creates teachers. The approved interpretation becomes immutable for the background commit.</Notice><div className="rounded-xl border border-(--ws-line) p-4 text-sm"><p><strong>{summary?.readyRows || 0}</strong> ready rows will be processed.</p><p className="mt-1 text-(--ws-fg-60)">Existing teachers remain skipped and are never overwritten.</p><p className="mt-1 text-(--ws-fg-60)">Invitation mode: {invitationMode === "send_now" ? "send now" : "create only"}.</p></div><div className="flex justify-between"><Button variant="outline" onClick={() => setStage("invitations")}>Back</Button><Button onClick={confirm} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirm and create teachers</Button></div></div>}
          {stage === "results" && job && job.status !== "review_ready" && <div className="mx-auto max-w-2xl space-y-5 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h3 className="text-lg font-semibold">Import {job.status === "completed" ? "complete" : "finished with issues"}</h3><p className="text-sm text-(--ws-fg-60)">The result is saved and can be inspected after closing this window.</p><div className="grid gap-3 text-left sm:grid-cols-3"><Stat label="Created" value={job.result?.created || 0} tone="good" /><Stat label="Skipped existing" value={job.result?.existing || 0} /><Stat label="Failed" value={job.result?.failed || 0} tone={job.result?.failed ? "bad" : undefined} /></div><Button onClick={() => onOpenChange(false)}>Close</Button></div>}
        </div>
      </div>
      {confirmationDialog}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  return <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3"><p className="text-xs text-(--ws-fg-60)">{label}</p><p className={`mt-1 text-xl font-semibold ${tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : tone === "bad" ? "text-rose-500" : ""}`}>{value}</p></div>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warn" | "bad" }) {
  return <div className={`flex gap-2 rounded-xl border p-3 text-sm ${tone === "warn" ? "border-amber-400/30 bg-amber-400/5 text-amber-600" : "border-rose-400/30 bg-rose-400/5 text-rose-600"}`}><AlertCircle className="h-4 w-4 shrink-0" />{children}</div>;
}

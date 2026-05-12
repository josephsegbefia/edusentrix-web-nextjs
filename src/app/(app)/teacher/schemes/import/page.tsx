"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileUp, Route, Sparkles } from "lucide-react";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  useTeacherSchemeImportCancel,
  useTeacherSchemeImportConfirm,
  useTeacherSchemeImportCreate,
  useTeacherSchemeImportJob,
  useTeacherSchemeImportSaveRows,
} from "@/hooks/teacher/useTeacherSchemeImport";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { SchemeImportParsedRowClient } from "@/types/scheme-import";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

function makeSchemeTitle(input: {
  gradeName?: string;
  subjectName?: string;
  periodName?: string;
}) {
  const bits = [
    input.gradeName || "Grade",
    input.subjectName || "Subject",
    input.periodName || "Current Term",
  ];
  return `${bits.join(" ")} Scheme of Learning`.replace(/\s+/g, " ").trim();
}

function TeacherSchemeImportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { data: ctxRes } = useTeacherContext();
  const { data: classesData } = useTeacherClasses();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const schoolId = ctxRes?.data?.school?._id ?? "";
  const schoolCurriculumCode = ctxRes?.data?.school?.curriculumCode || "ghana_nacca";
  const currentPeriod = ctxRes?.data?.currentPeriod ?? null;
  const canImport = can(permissions, PERMISSIONS.schemeImportUpload);
  const canConfirm = can(permissions, PERMISSIONS.schemeImportConfirm);
  const isNaCCASchool = schoolCurriculumCode === "ghana_nacca";

  const { data: job, isLoading: jobLoading, error: jobError } = useTeacherSchemeImportJob(jobId);
  const createMutation = useTeacherSchemeImportCreate();
  const saveRowsMutation = useTeacherSchemeImportSaveRows(jobId);
  const confirmMutation = useTeacherSchemeImportConfirm(jobId);
  const cancelMutation = useTeacherSchemeImportCancel(jobId);

  const [localRows, setLocalRows] = useState<SchemeImportParsedRowClient[] | null>(null);
  const [schemeTitle, setSchemeTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [assignmentKey, setAssignmentKey] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const assignmentOptions = useMemo(
    () =>
      (classesData?.data?.classes || [])
        .filter((row) => row._id && row.gradeId && row.subjectId)
        .map((row) => ({
          key: `${row.gradeId}|${row.subjectId}`,
          className: row.name,
          gradeId: row.gradeId,
          gradeName: row.gradeName,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          description: "Applies to all class groups in this grade",
        }))
        .filter((row, index, all) => all.findIndex((item) => item.key === row.key) === index),
    [classesData?.data?.classes]
  );

  const selectedAssignment = assignmentOptions.find((option) => option.key === assignmentKey);

  useEffect(() => {
    if (job?.parsedRows && job.status === "parsed") {
      setLocalRows(job.parsedRows.map((r) => ({ ...r })));
    }
  }, [job?.id, job?.parsedRows, job?.status]);

  useEffect(() => {
    if (assignmentKey || assignmentOptions.length !== 1) return;
    setAssignmentKey(assignmentOptions[0].key);
  }, [assignmentKey, assignmentOptions]);

  useEffect(() => {
    if (titleTouched) return;
    if (selectedAssignment) {
      setSchemeTitle(
        makeSchemeTitle({
          gradeName: selectedAssignment.gradeName,
          subjectName: selectedAssignment.subjectName,
          periodName: currentPeriod?.name,
        }).slice(0, 220)
      );
      return;
    }
    if (!job?.fileName) return;
    const base = job.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    setSchemeTitle(base.slice(0, 220) || "Imported Scheme of Learning");
  }, [currentPeriod?.name, job?.fileName, selectedAssignment, titleTouched]);

  async function persistRows(rows: SchemeImportParsedRowClient[]) {
    if (!jobId) return;
    setActionError(null);
    try {
      await saveRowsMutation.mutateAsync(rows);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save rows");
    }
  }

  async function confirmDraft() {
    if (!jobId || !localRows || !schemeTitle.trim() || !selectedAssignment || !currentPeriod?._id) {
      return;
    }
    setActionError(null);
    try {
      await saveRowsMutation.mutateAsync(localRows);
      const data = await confirmMutation.mutateAsync({
        schemeTitle: schemeTitle.trim(),
        academicPeriodId: currentPeriod._id,
        gradeId: selectedAssignment.gradeId,
        classGroupId: null,
        subjectId: selectedAssignment.subjectId,
      });
      if (data.scheme?.id) {
        router.push(`/teacher/schemes/${data.scheme.id}`);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create draft scheme");
    }
  }

  async function handleUploaded(payload: {
    url: string;
    fileName?: string;
    publicId?: string;
  }) {
    setUploadError(null);
    const name = payload.fileName || "scheme-import.csv";
    try {
      const created = await createMutation.mutateAsync({
        fileUrl: payload.url,
        fileName: name,
        fileKey: payload.publicId,
      });
      router.replace(`/teacher/schemes/import?jobId=${created.id}`);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload registration failed");
    }
  }

  function updateLocalRow(
    idx: number,
    patch: Partial<SchemeImportParsedRowClient>
  ) {
    setLocalRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  const parsedStats = localRows
    ? {
        total: localRows.length,
        lowConfidence: localRows.filter((row) => row.confidence != null && row.confidence < 0.55)
          .length,
        issues: localRows.filter((row) => row.errors.length > 0).length,
        skipped: localRows.filter((row) => row.skipped).length,
      }
    : null;

  if (!canImport) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-white/80">
        <p>You do not have permission to import schemes.</p>
        <Link href="/teacher/schemes" className="mt-4 inline-block text-sky-400 hover:text-sky-300">
          Back to schemes
        </Link>
      </div>
    );
  }

  if (ctxRes?.data?.school && !isNaCCASchool) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-white/80">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-50">
          <p className="text-xs uppercase tracking-wide text-amber-100/70">Scheme of Learning import</p>
          <h1 className="mt-2 text-xl font-semibold">Import is for NaCCA schools only</h1>
          <p className="mt-2 text-sm leading-6 text-amber-50/80">
            The current upload/import parser expects GES/NaCCA scheme documents. Use the Schemes of
            Learning page to create or manage plans manually for this curriculum.
          </p>
          <Link href="/teacher/schemes" className="mt-4 inline-block text-sky-300 hover:text-sky-200">
            Back to schemes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Scheme of Learning</p>
            <h1 className="text-xl font-semibold text-white">Import official scheme document</h1>
            <p className="mt-1 text-sm text-white/65">
              Upload a GES/NaCCA-style PDF or spreadsheet. We preserve week,
              strand, sub-strand, content standard, indicators, and resources so
              Lesson Notes can be created from the saved rows.
            </p>
          </div>
          <Link
            href="/teacher/schemes"
            className="text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            ← All schemes
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Upload", icon: FileUp },
            { label: "Context", icon: Route },
            { label: "Review", icon: Sparkles },
            { label: "Create", icon: CheckCircle2 },
          ].map((step, index) => (
            <div key={step.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/65">
                  {index + 1}
                </span>
                <step.icon className="h-4 w-4 text-emerald-200" />
              </div>
              <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
            </div>
          ))}
        </div>

        {!jobId || job?.status === "failed" ? (
          <div className="mt-4 max-w-xl">
            {schoolId ? (
              <DocumentUploader
                schoolId={schoolId}
                category="teacher"
                label="Upload .csv, .xlsx, or .pdf"
                onUploaded={(p) =>
                  handleUploaded({
                    url: p.url,
                    fileName: p.fileName,
                    publicId: p.publicId,
                  })
                }
                onError={(msg) => setUploadError(msg)}
              />
            ) : (
              <p className="text-sm text-white/60">Loading school context…</p>
            )}
            {uploadError ? <p className="mt-2 text-sm text-rose-300">{uploadError}</p> : null}
            {createMutation.isPending ? (
              <p className="mt-2 text-sm text-white/60">Parsing or extracting…</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {jobLoading && jobId ? <p className="text-sm text-white/70">Loading import…</p> : null}
      {jobError ? <p className="text-sm text-rose-300">{jobError.message}</p> : null}

      {job?.status === "failed" && job.parseError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-100">
          <p className="font-medium">Could not parse file</p>
          <p className="mt-1 text-rose-200/90">{job.parseError}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/15"
            onClick={() => router.replace("/teacher/schemes/import")}
          >
            Try another file
          </button>
        </div>
      ) : null}

      {job?.status === "parsed" && localRows ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <h2 className="text-lg font-semibold text-white">Preview</h2>
            <p className="mt-1 text-sm text-white/60">
              Review the extracted Scheme of Learning rows. Fix only the fields
              that look wrong, then create the draft.
            </p>
            {parsedStats ? (
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/65">
                  <span className="block text-white/40">Rows</span>
                  <span className="text-base font-semibold text-white">{parsedStats.total}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/65">
                  <span className="block text-white/40">Issues</span>
                  <span className="text-base font-semibold text-white">{parsedStats.issues}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/65">
                  <span className="block text-white/40">Low confidence</span>
                  <span className="text-base font-semibold text-white">{parsedStats.lowConfidence}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/65">
                  <span className="block text-white/40">Skipped</span>
                  <span className="text-base font-semibold text-white">{parsedStats.skipped}</span>
                </div>
              </div>
            ) : null}
            {job?.sourceKind === "pdf_ai" ? (
              <p className="mt-2 text-xs text-amber-200/85">
                PDF import: confidence scores are AI estimates. Rows below ~55% confidence are highlighted —
                fix or skip them before creating the draft.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-sm">
                <span className="text-white/55">Grade and subject</span>
                <PremiumSelect value={assignmentKey || "pick"} onValueChange={(value) => setAssignmentKey(value === "pick" ? "" : value)}>
                  <PremiumSelectTrigger className="border-white/15 bg-black/30 text-white">
                    <PremiumSelectValue placeholder="Select assigned grade and subject" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="pick">Select assigned grade and subject</PremiumSelectItem>
                    {assignmentOptions.map((option) => (
                      <PremiumSelectItem
                        key={option.key}
                        value={option.key}
                        description={option.description}
                      >
                        {option.gradeName} · {option.subjectName}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1 text-sm">
                <span className="text-white/55">Academic period</span>
                <div className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white">
                  {currentPeriod?.name || "No current period"}
                </div>
              </label>
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                <span className="text-white/55">Draft scheme title</span>
                <input
                  value={schemeTitle}
                  onChange={(e) => {
                    setTitleTouched(true);
                    setSchemeTitle(e.target.value);
                  }}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                />
              </label>
            </div>
            {!selectedAssignment || !currentPeriod?._id ? (
              <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                Choose the assigned grade/subject and ensure a current academic period is set before creating the draft.
              </p>
            ) : null}
            {actionError ? (
              <p className="mt-3 rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {actionError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!localRows || saveRowsMutation.isPending}
                onClick={() => localRows && persistRows(localRows)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
              >
                {saveRowsMutation.isPending ? "Saving…" : "Save edits"}
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={async () => {
                  await cancelMutation.mutateAsync();
                  router.replace("/teacher/schemes/import");
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/85 hover:bg-white/5"
              >
                Cancel import
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/30 text-xs uppercase tracking-wide text-white/45">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Week ending</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Strand</th>
                  <th className="px-3 py-2">Sub-strand</th>
                  <th className="px-3 py-2">Content standard</th>
                  <th className="px-3 py-2">Indicators</th>
                  <th className="px-3 py-2">Resources</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Conf.</th>
                  <th className="px-3 py-2">Skip</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {localRows.map((row, idx) => (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      "border-b border-white/5",
                      row.confidence != null &&
                        row.confidence < 0.55 &&
                        "bg-amber-500/[0.12]"
                    )}
                  >
                    <td className="px-3 py-2 text-white/55">{row.rowIndex}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={53}
                        value={row.weekNumber ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          let w: number | null = null;
                          if (v !== "") {
                            const n = Number.parseInt(v, 10);
                            w = Number.isFinite(n) ? n : null;
                          }
                          updateLocalRow(idx, { weekNumber: w });
                        }}
                        className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.weekEnding ?? ""}
                        onChange={(e) => updateLocalRow(idx, { weekEnding: e.target.value || null })}
                        className="w-full min-w-[110px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.rowType ?? "teaching"}
                        onChange={(e) =>
                          updateLocalRow(idx, {
                            rowType: e.target.value as SchemeImportParsedRowClient["rowType"],
                          })
                        }
                        className="rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      >
                        <option value="teaching">Teaching</option>
                        <option value="revision">Revision</option>
                        <option value="examination">Examination</option>
                        <option value="holiday">Holiday</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.title}
                        onChange={(e) => updateLocalRow(idx, { title: e.target.value })}
                        className="w-full min-w-[140px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.strand ?? ""}
                        onChange={(e) => updateLocalRow(idx, { strand: e.target.value || null })}
                        className="w-full min-w-[140px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.subStrand ?? ""}
                        onChange={(e) => updateLocalRow(idx, { subStrand: e.target.value || null })}
                        className="w-full min-w-[160px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.contentStandard ?? ""}
                        onChange={(e) =>
                          updateLocalRow(idx, { contentStandard: e.target.value || null })
                        }
                        className="w-full min-w-[150px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={(row.indicators || []).join("\n")}
                        onChange={(e) =>
                          updateLocalRow(idx, {
                            indicators: e.target.value
                              .split(/\n|,/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={2}
                        className="w-full min-w-[150px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={(row.resources || []).join("\n")}
                        onChange={(e) =>
                          updateLocalRow(idx, {
                            resources: e.target.value
                              .split(/\n|,/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={2}
                        className="w-full min-w-[150px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.notes ?? ""}
                        onChange={(e) => updateLocalRow(idx, { notes: e.target.value || null })}
                        className="w-full min-w-[130px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-white/65">
                      {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.skipped}
                        onChange={(e) => updateLocalRow(idx, { skipped: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-amber-200/90">
                      {row.errors.length ? row.errors.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                !canConfirm ||
                saveRowsMutation.isPending ||
                confirmMutation.isPending ||
                !schemeTitle.trim() ||
                !selectedAssignment ||
                !currentPeriod?._id
              }
              onClick={() => confirmDraft()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saveRowsMutation.isPending || confirmMutation.isPending
                ? "Creating draft…"
                : "Create draft scheme"}
            </button>
          </div>
        </div>
      ) : null}

      {job?.status === "confirmed" && job.resultSchemeId ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">
          <p>Import complete.</p>
          <Link
            href={`/teacher/schemes/${job.resultSchemeId}`}
            className="mt-2 inline-block font-medium text-emerald-300 hover:text-emerald-200"
          >
            Open imported scheme →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function TeacherSchemeImportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-white/70">Loading import…</div>
      }
    >
      <TeacherSchemeImportInner />
    </Suspense>
  );
}

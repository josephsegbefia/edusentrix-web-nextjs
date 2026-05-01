"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
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
import type { SchemeImportParsedRowClient } from "@/types/scheme-import";

function TeacherSchemeImportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { data: ctxRes } = useTeacherContext();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const schoolId = ctxRes?.data?.school?._id ?? "";
  const canImport = can(permissions, PERMISSIONS.schemeImportUpload);
  const canConfirm = can(permissions, PERMISSIONS.schemeImportConfirm);

  const { data: job, isLoading: jobLoading, error: jobError } = useTeacherSchemeImportJob(jobId);
  const createMutation = useTeacherSchemeImportCreate();
  const saveRowsMutation = useTeacherSchemeImportSaveRows(jobId);
  const confirmMutation = useTeacherSchemeImportConfirm(jobId);
  const cancelMutation = useTeacherSchemeImportCancel(jobId);

  const [localRows, setLocalRows] = useState<SchemeImportParsedRowClient[] | null>(null);
  const [schemeTitle, setSchemeTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (job?.parsedRows && job.status === "parsed") {
      setLocalRows(job.parsedRows.map((r) => ({ ...r })));
    }
  }, [job?.id, job?.parsedRows, job?.status]);

  useEffect(() => {
    if (!job?.fileName) return;
    const base = job.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    setSchemeTitle((prev) =>
      prev.trim().length > 0 ? prev : base.slice(0, 220) || "Imported scheme"
    );
  }, [job?.fileName]);

  async function persistRows(rows: SchemeImportParsedRowClient[]) {
    if (!jobId) return;
    await saveRowsMutation.mutateAsync(rows);
  }

  async function confirmDraft() {
    if (!jobId || !localRows || !schemeTitle.trim()) return;
    await saveRowsMutation.mutateAsync(localRows);
    const data = await confirmMutation.mutateAsync({
      schemeTitle: schemeTitle.trim(),
    });
    if (data.scheme?.id) {
      router.push(`/teacher/schemes/${data.scheme.id}`);
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Schemes of work</p>
            <h1 className="text-xl font-semibold text-white">Import from CSV or Excel</h1>
            <p className="mt-1 text-sm text-white/65">
              Upload a spreadsheet with a header row. Expected columns include{" "}
              <span className="text-white/85">title</span> (or topic), optional{" "}
              <span className="text-white/85">week</span>,{" "}
              <span className="text-white/85">learning objective</span>, and{" "}
              <span className="text-white/85">notes</span>.
            </p>
          </div>
          <Link
            href="/teacher/schemes"
            className="text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            ← All schemes
          </Link>
        </div>

        {!jobId || job?.status === "failed" ? (
          <div className="mt-4 max-w-xl">
            {schoolId ? (
              <DocumentUploader
                schoolId={schoolId}
                category="teacher"
                label="Upload .csv, .xlsx"
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
              <p className="mt-2 text-sm text-white/60">Parsing file…</p>
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
              Fix validation errors or skip rows. Save edits before confirming.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                <span className="text-white/55">Draft scheme title</span>
                <input
                  value={schemeTitle}
                  onChange={(e) => setSchemeTitle(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                />
              </label>
            </div>
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
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/30 text-xs uppercase tracking-wide text-white/45">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Objective</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Skip</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {localRows.map((row, idx) => (
                  <tr key={row.rowIndex} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white/55">{row.rowIndex}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={53}
                        value={row.weekNumber ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            let w: number | null = null;
                            if (v !== "") {
                              const n = Number.parseInt(v, 10);
                              w = Number.isFinite(n) ? n : null;
                            }
                            next[idx] = { ...next[idx], weekNumber: w };
                            return next;
                          });
                        }}
                        className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[idx] = { ...next[idx], title: v };
                            return next;
                          });
                        }}
                        className="w-full min-w-[140px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.learningObjective ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[idx] = { ...next[idx], learningObjective: v || null };
                            return next;
                          });
                        }}
                        className="w-full min-w-[140px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.notes ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[idx] = { ...next[idx], notes: v || null };
                            return next;
                          });
                        }}
                        className="w-full min-w-[120px] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.skipped}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setLocalRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[idx] = { ...next[idx], skipped: v };
                            return next;
                          });
                        }}
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
                !schemeTitle.trim()
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

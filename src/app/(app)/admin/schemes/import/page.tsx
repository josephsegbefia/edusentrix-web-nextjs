"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";
import { SchemeImportDocumentUploader } from "@/components/schemes/SchemeImportDocumentUploader";
import { useClasses } from "@/hooks/admin/useClasses";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useSchool } from "@/hooks/admin/useSchool";
import {
  useAdminSchemeImportConfirm,
  useAdminSchemeImportCreate,
  useAdminSchemeImportJob,
  useAdminSchemeImportSaveRows,
} from "@/hooks/admin/useAdminSchemeImport";
import type { SchemeImportParsedRowClient } from "@/types/scheme-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatImportCell(value: string | string[] | null | undefined, maxLen = 280): string {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join("; ")
    : typeof value === "string"
      ? value.trim()
      : "";
  if (!text) return "-";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function makeTitle(input: { grade?: string; subject?: string; period?: string }) {
  return [input.grade || "Grade", input.subject || "Subject", input.period || "Term"]
    .join(" ")
    .concat(" Scheme of Learning")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function AdminSchemeImportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { data: schoolRes } = useSchool();
  const { data: periodsData } = useAcademicPeriods();
  const { data: classesData } = useClasses({ isActive: true });
  const createMutation = useAdminSchemeImportCreate();
  const { data: job, isLoading: jobLoading, error: jobError } = useAdminSchemeImportJob(jobId);
  const saveRowsMutation = useAdminSchemeImportSaveRows(jobId);
  const confirmMutation = useAdminSchemeImportConfirm(jobId);

  const [localRows, setLocalRows] = useState<SchemeImportParsedRowClient[] | null>(null);
  const [periodId, setPeriodId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [schemeTitle, setSchemeTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [parsePhase, setParsePhase] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentPeriod = useMemo(
    () => periodsData?.periods.find((p) => p.isCurrent) ?? periodsData?.periods[0] ?? null,
    [periodsData?.periods]
  );
  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          (classesData?.data ?? []).map((row) => [
            row.grade.id,
            { id: row.grade.id, name: row.grade.name },
          ])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [classesData?.data]
  );
  const subjectOptions = useMemo(
    () =>
      Array.from(
        new Map(
          (classesData?.data ?? [])
            .filter((row) => row.grade.id === gradeId)
            .flatMap((row) => row.subjects)
            .map((subject) => [subject.id, subject])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [classesData?.data, gradeId]
  );
  const selectedGrade = gradeOptions.find((grade) => grade.id === gradeId) ?? null;
  const selectedSubject = subjectOptions.find((subject) => subject.id === subjectId) ?? null;
  const schoolCurriculumCode = schoolRes?.data?.curriculumCode || "ghana_nacca";
  const isNaCCASchool = schoolCurriculumCode === "ghana_nacca";

  useEffect(() => {
    if (!periodId && currentPeriod?._id) setPeriodId(currentPeriod._id);
  }, [currentPeriod?._id, periodId]);

  useEffect(() => {
    if (job?.parsedRows && job.status === "parsed") {
      setLocalRows(job.parsedRows.map((row) => ({ ...row })));
    } else if (job?.status === "failed") {
      setLocalRows(null);
    }
  }, [job?.id, job?.parsedRows, job?.status]);

  useEffect(() => {
    if (titleTouched) return;
    const period = periodsData?.periods.find((p) => p._id === periodId);
    setSchemeTitle(
      makeTitle({
        grade: selectedGrade?.name,
        subject: selectedSubject?.name,
        period: period ? `${period.yearLabel} ${period.term}` : undefined,
      })
    );
  }, [periodId, periodsData?.periods, selectedGrade, selectedSubject, titleTouched]);

  async function handleUploaded(payload: {
    url: string;
    fileName?: string;
    publicId?: string;
    uploadKey?: string;
    mimeType?: string;
    bytes?: number;
  }) {
    setUploadError(null);
    setUploadWarning(null);
    setParsePhase(null);
    const name = payload.fileName || "scheme-import.csv";
    const isPdf =
      name.toLowerCase().endsWith(".pdf") || (payload.mimeType || "").toLowerCase().includes("pdf");
    if (isPdf && payload.bytes != null && payload.bytes < 20_000) {
      setUploadWarning(
        `This PDF is only ${Math.round(payload.bytes / 1024)} KB. If parsing fails, re-export a full copy or use CSV/XLSX.`,
      );
    }
    try {
      setParsePhase(
        isPdf
          ? "Download complete. Leo is reading the PDF and extracting scheme rows with AI first…"
          : "Reading spreadsheet rows…",
      );
      const created = await createMutation.mutateAsync({
        fileUrl: payload.url,
        fileName: name,
        fileKey: payload.uploadKey || payload.publicId,
        mimeType: payload.mimeType,
      });
      setParsePhase(null);
      router.replace(`/admin/schemes/import?jobId=${created.id}`);
    } catch (e) {
      setParsePhase(null);
      setUploadError(e instanceof Error ? e.message : "Upload registration failed");
    }
  }

  async function retryFailedImport() {
    if (!job?.fileUrl) {
      setUploadError("This failed import has no retained file. Upload the document again.");
      return;
    }
    setUploadError(null);
    setUploadWarning(null);
    setParsePhase(
      "Retrying import with the retained file. Reading PDF and extracting rows with Leo…",
    );
    try {
      const created = await createMutation.mutateAsync({
        fileUrl: job.fileUrl,
        fileName: job.fileName || "scheme-import.pdf",
      });
      setParsePhase(null);
      router.replace(`/admin/schemes/import?jobId=${created.id}`);
    } catch (e) {
      setParsePhase(null);
      setUploadError(e instanceof Error ? e.message : "Retry failed");
    }
  }

  async function confirmImport() {
    if (!localRows || !jobId || !selectedGrade || !selectedSubject || !periodId || !schemeTitle.trim()) return;
    setActionError(null);
    try {
      await saveRowsMutation.mutateAsync(localRows);
      const result = await confirmMutation.mutateAsync({
        schemeTitle: schemeTitle.trim(),
        academicPeriodId: periodId,
        gradeId: selectedGrade.id,
        classGroupId: null,
        subjectId: selectedSubject.id,
      });
      if (result.scheme?.id) router.push(`/admin/schemes/${result.scheme.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not import Scheme of Learning");
    }
  }

  const stats = localRows
    ? {
        total: localRows.length,
        usable: localRows.filter((row) => !row.skipped && row.errors.length === 0).length,
        issues: localRows.filter((row) => row.errors.length > 0).length,
      }
    : null;

  const canConfirm = Boolean(localRows?.length && selectedGrade && selectedSubject && periodId && schemeTitle.trim());

  if (schoolRes?.data && !isNaCCASchool) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 md:p-6">
        <section className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-6 text-amber-50">
          <p className="text-xs uppercase tracking-wide text-amber-100/70">Scheme of Learning import</p>
          <h1 className="mt-2 text-2xl font-semibold">Import is for NaCCA schools only</h1>
          <p className="mt-2 text-sm leading-6 text-amber-50/80">
            The current upload/import parser is built for GES/NaCCA scheme documents. This school is
            configured for a different curriculum programme, so admins should manage learning plans
            manually from the Schemes of Learning page for now.
          </p>
          <Button asChild className="mt-5 bg-amber-100 text-slate-950 hover:bg-white">
            <Link href="/admin/schemes">Back to Schemes</Link>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Scheme of Learning</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Import official scheme document</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Upload a GES/NaCCA PDF or spreadsheet, choose the exact grade and subject, review
              the extracted rows, then create an approved Scheme of Learning for all class groups in that grade.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit border-white/10 bg-white/5 text-white">
            <Link href="/admin/schemes">Back to Schemes</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-4">
        {["Upload", "Context", "Review", "Create"].map((label, index) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
                {index + 1}
              </Badge>
              <p className="text-sm font-medium text-white">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2 text-white">
          <FileUp className="h-5 w-5 text-blue-200" />
          <h2 className="text-lg font-semibold">1. Upload</h2>
        </div>
        {!jobId || job?.status === "failed" ? (
          <div className="mt-4">
            {schoolRes?.data?.id ? (
              <SchemeImportDocumentUploader
                schoolId={schoolRes.data.id}
                label="Upload .pdf, .csv, or .xlsx"
                onUploaded={(payload) =>
                  handleUploaded({
                    url: payload.url,
                    fileName: payload.fileName,
                    publicId: payload.publicId,
                    uploadKey: payload.uploadKey,
                    mimeType: payload.mimeType,
                    bytes: payload.bytes,
                  })
                }
                onError={setUploadError}
              />
            ) : (
              <p className="text-sm text-white/55">Loading school context...</p>
            )}
            {uploadWarning ? (
              <p className="mt-2 text-sm text-amber-200">{uploadWarning}</p>
            ) : null}
            {uploadError ? <p className="mt-2 text-sm text-rose-300">{uploadError}</p> : null}
            {createMutation.isPending || parsePhase ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                <p>{parsePhase || "Processing import…"}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Uploaded: {job?.fileName}
          </div>
        )}
      </section>

      {jobLoading && jobId ? <p className="text-sm text-white/65">Loading import...</p> : null}
      {jobError ? <p className="text-sm text-rose-300">{jobError.message}</p> : null}
      {job?.status === "failed" && job.parseError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-100">
          <p className="font-medium">Could not parse file</p>
          <p className="mt-1">{job.parseError}</p>
          {job.fileUrl ? (
            <Button
              type="button"
              onClick={() => void retryFailedImport()}
              disabled={createMutation.isPending || Boolean(parsePhase)}
              className="mt-4 bg-rose-100 text-rose-950 hover:bg-white disabled:opacity-50"
            >
              {createMutation.isPending || parsePhase ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Retry import without re-uploading
            </Button>
          ) : (
            <p className="mt-3 text-xs text-rose-100/70">
              The uploaded file is no longer retained for this failed import. Upload the document again.
            </p>
          )}
        </div>
      ) : null}

      {job?.status === "parsed" &&
      (job.sourceKind === "pdf_ai" || job.sourceKind === "pdf_gemini") ? (
        <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 text-sm text-teal-100">
          <p className="font-medium">Extracted by Leo (AI)</p>
          <p className="mt-1">
            {job.sourceKind === "pdf_gemini"
              ? "Leo used Gemini to map scheme rows from the PDF text."
              : "Leo used AI to map scheme rows from the PDF text."}{" "}
            Review all columns before confirming.
          </p>
        </div>
      ) : null}

      {job?.status === "parsed" &&
      (job.sourceKind === "pdf_parse_tables" ||
        job.sourceKind === "pdf_excavator" ||
        job.sourceKind === "pdf_text_grid") ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">
          <p className="font-medium">Extracted locally from PDF (no AI required)</p>
          <p className="mt-1">
            {job.sourceKind === "pdf_parse_tables"
              ? "Used pdf-parse table detection."
              : job.sourceKind === "pdf_text_grid"
                ? "Used text-based scheme layout detection (for EduSentrix and similar exports)."
                : "Used PDFExcavator table detection."}{" "}
            Review all columns before confirming.
          </p>
        </div>
      ) : null}

      {job?.status === "parsed" && job.parseWarning ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100">
          <p className="font-medium">
            {/api key|authenticate|not configured/i.test(job.parseWarning)
              ? "AI extraction unavailable — limited manual parse"
              : "Manual PDF parser used — columns may be incomplete"}
          </p>
          <p className="mt-1">{job.parseWarning}</p>
          {job.fileUrl &&
          /connection|econnreset|network|fetch failed|timed out/i.test(job.parseWarning) ? (
            <div className="mt-3 border-t border-amber-500/20 pt-3">
              <p className="mb-2 text-xs text-amber-200/80">
                AI extraction failed due to a network issue, not a PDF problem. Try again once your
                connection is stable.
              </p>
              <Button
                type="button"
                onClick={() => void retryFailedImport()}
                disabled={createMutation.isPending || Boolean(parsePhase)}
                className="bg-amber-200 text-amber-950 hover:bg-white disabled:opacity-50"
              >
                {createMutation.isPending || parsePhase ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Retry AI extraction
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {localRows ? (
        <>
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="text-lg font-semibold text-white">2. Tie to grade and subject</h2>
              <p className="mt-1 text-sm text-white/50">
                This is the step that prevents confusion: every imported scheme must have one
                period, grade, and subject before it can be created. It will apply to all class
                groups within the selected grade.
              </p>
            </div>
            <PremiumSelect value={periodId} onValueChange={setPeriodId}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Academic period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {(periodsData?.periods ?? []).map((period) => (
                  <PremiumSelectItem key={period._id} value={period._id}>
                    {period.yearLabel} · {period.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect
              value={gradeId}
              onValueChange={(value) => {
                setGradeId(value);
                setSubjectId("");
              }}
            >
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Grade" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {gradeOptions.map((row) => (
                  <PremiumSelectItem key={row.id} value={row.id}>
                    {row.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={subjectId} onValueChange={setSubjectId} disabled={!selectedGrade}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {subjectOptions.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <Input
              value={schemeTitle}
              onChange={(event) => {
                setTitleTouched(true);
                setSchemeTitle(event.target.value);
              }}
              placeholder="Scheme title"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">3. Review extracted rows</h2>
                <p className="mt-1 text-sm text-white/50">
                  Skip rows that should not become lesson-planning rows.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
                  {stats?.total ?? 0} rows
                </Badge>
                <Badge variant="outline" className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                  {stats?.usable ?? 0} usable
                </Badge>
                {stats?.issues ? (
                  <Badge variant="outline" className="border-rose-300/25 bg-rose-500/10 text-rose-100">
                    {stats.issues} with issues
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                    <TableHead className="sticky left-0 z-10 min-w-[52px] bg-slate-950/90 text-white/55">
                      Use
                    </TableHead>
                    <TableHead className="min-w-[100px] text-white/55">Week ending</TableHead>
                    <TableHead className="min-w-[180px] text-white/55">Topic</TableHead>
                    <TableHead className="min-w-[120px] text-white/55">Strand</TableHead>
                    <TableHead className="min-w-[120px] text-white/55">Sub-strand</TableHead>
                    <TableHead className="min-w-[160px] text-white/55">Content standard</TableHead>
                    <TableHead className="min-w-[160px] text-white/55">Indicators</TableHead>
                    <TableHead className="min-w-[160px] text-white/55">Learning outcomes</TableHead>
                    <TableHead className="min-w-[200px] text-white/55">
                      Teaching &amp; learning activities
                    </TableHead>
                    <TableHead className="min-w-[140px] text-white/55">Resources</TableHead>
                    <TableHead className="min-w-[140px] text-white/55">Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localRows.map((row, index) => (
                    <TableRow key={`${row.rowIndex}-${index}`} className="border-white/5 align-top">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={!row.skipped}
                          onChange={(event) =>
                            setLocalRows((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[index] = { ...next[index], skipped: !event.target.checked };
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-white/70">
                        {row.weekEnding || "-"}
                        {row.weekNumber != null ? (
                          <div className="text-xs text-white/40">Week {row.weekNumber}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Input
                          value={row.title}
                          onChange={(event) =>
                            setLocalRows((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[index] = { ...next[index], title: event.target.value };
                              return next;
                            })
                          }
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </TableCell>
                      <TableCell className="max-w-[200px] whitespace-pre-wrap text-xs text-white/60">
                        {formatImportCell(row.strand)}
                      </TableCell>
                      <TableCell className="max-w-[200px] whitespace-pre-wrap text-xs text-white/60">
                        {formatImportCell(row.subStrand)}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-pre-wrap text-xs text-white/60">
                        {formatImportCell(row.contentStandard)}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-pre-wrap text-xs text-white/60">
                        {formatImportCell(row.indicators)}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-pre-wrap text-xs text-white/60">
                        {formatImportCell(row.learningOutcomes)}
                      </TableCell>
                      <TableCell className="max-w-[280px] whitespace-pre-wrap text-xs text-white/55">
                        {formatImportCell(row.teachingLearningActivities, 400)}
                      </TableCell>
                      <TableCell className="max-w-[200px] whitespace-pre-wrap text-xs text-white/55">
                        {formatImportCell(row.resources)}
                      </TableCell>
                      <TableCell className="max-w-[200px] whitespace-pre-wrap text-xs text-white/55">
                        {formatImportCell(row.assessment)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-blue-200" />
                <div>
                  <h2 className="text-lg font-semibold text-white">4. Create approved scheme</h2>
                  <p className="mt-1 text-sm text-white/50">
                    After creation, open the review detail page to activate it for Lesson Notes.
                  </p>
                  {actionError ? <p className="mt-2 text-sm text-rose-300">{actionError}</p> : null}
                </div>
              </div>
              <Button
                onClick={() => void confirmImport()}
                disabled={!canConfirm || saveRowsMutation.isPending || confirmMutation.isPending}
                className="bg-blue-500 text-white hover:bg-blue-400"
              >
                {saveRowsMutation.isPending || confirmMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Scheme
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function AdminSchemeImportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/60">Loading import wizard...</div>}>
      <AdminSchemeImportInner />
    </Suspense>
  );
}

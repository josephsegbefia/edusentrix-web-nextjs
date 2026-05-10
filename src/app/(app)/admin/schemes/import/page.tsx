"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
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

function makeTitle(input: { grade?: string; className?: string; subject?: string; period?: string }) {
  return [input.className || input.grade || "Class", input.subject || "Subject", input.period || "Term"]
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
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [schemeTitle, setSchemeTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentPeriod = useMemo(
    () => periodsData?.periods.find((p) => p.isCurrent) ?? periodsData?.periods[0] ?? null,
    [periodsData?.periods]
  );
  const selectedClass = classesData?.data.find((row) => row.id === classId) ?? null;
  const selectedSubject = selectedClass?.subjects.find((subject) => subject.id === subjectId) ?? null;
  const schoolCurriculumCode = schoolRes?.data?.curriculumCode || "ghana_nacca";
  const isNaCCASchool = schoolCurriculumCode === "ghana_nacca";

  useEffect(() => {
    if (!periodId && currentPeriod?._id) setPeriodId(currentPeriod._id);
  }, [currentPeriod?._id, periodId]);

  useEffect(() => {
    if (job?.parsedRows && job.status === "parsed") {
      setLocalRows(job.parsedRows.map((row) => ({ ...row })));
    }
  }, [job?.id, job?.parsedRows, job?.status]);

  useEffect(() => {
    if (titleTouched) return;
    const period = periodsData?.periods.find((p) => p._id === periodId);
    setSchemeTitle(
      makeTitle({
        grade: selectedClass?.grade.name,
        className: selectedClass?.fullLabel || selectedClass?.name,
        subject: selectedSubject?.name,
        period: period ? `${period.yearLabel} ${period.term}` : undefined,
      })
    );
  }, [periodId, periodsData?.periods, selectedClass, selectedSubject, titleTouched]);

  async function handleUploaded(payload: { url: string; fileName?: string; publicId?: string }) {
    setUploadError(null);
    try {
      const created = await createMutation.mutateAsync({
        fileUrl: payload.url,
        fileName: payload.fileName || "scheme-import.csv",
        fileKey: payload.publicId,
      });
      router.replace(`/admin/schemes/import?jobId=${created.id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload registration failed");
    }
  }

  async function confirmImport() {
    if (!localRows || !jobId || !selectedClass || !selectedSubject || !periodId || !schemeTitle.trim()) return;
    setActionError(null);
    try {
      await saveRowsMutation.mutateAsync(localRows);
      const result = await confirmMutation.mutateAsync({
        schemeTitle: schemeTitle.trim(),
        academicPeriodId: periodId,
        gradeId: selectedClass.grade.id,
        classGroupId: selectedClass.id,
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

  const canConfirm = Boolean(localRows?.length && selectedClass && selectedSubject && periodId && schemeTitle.trim());

  if (schoolRes?.data && !isNaCCASchool) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Scheme of Learning</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Import official scheme document</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Upload a GES/NaCCA PDF or spreadsheet, choose the exact class and subject, review
              the extracted rows, then create an approved Scheme of Learning for activation.
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
          <div className="mt-4 max-w-xl">
            {schoolRes?.data?.id ? (
              <DocumentUploader
                schoolId={schoolRes.data.id}
                category="teacher"
                label="Upload .pdf, .csv, or .xlsx"
                onUploaded={(payload) =>
                  handleUploaded({
                    url: payload.url,
                    fileName: payload.fileName,
                    publicId: payload.publicId,
                  })
                }
                onError={setUploadError}
              />
            ) : (
              <p className="text-sm text-white/55">Loading school context...</p>
            )}
            {uploadError ? <p className="mt-2 text-sm text-rose-300">{uploadError}</p> : null}
            {createMutation.isPending ? (
              <p className="mt-2 text-sm text-white/55">Leo is extracting scheme rows...</p>
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
        </div>
      ) : null}

      {localRows ? (
        <>
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="text-lg font-semibold text-white">2. Tie to class and subject</h2>
              <p className="mt-1 text-sm text-white/50">
                This is the step that prevents confusion: every imported scheme must have one
                period, class, grade, and subject before it can be created.
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
              value={classId}
              onValueChange={(value) => {
                setClassId(value);
                setSubjectId("");
              }}
            >
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {(classesData?.data ?? []).map((row) => (
                  <PremiumSelectItem key={row.id} value={row.id}>
                    {row.fullLabel || row.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={subjectId} onValueChange={setSubjectId} disabled={!selectedClass}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {(selectedClass?.subjects ?? []).map((subject) => (
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
                    <TableHead className="text-white/55">Use</TableHead>
                    <TableHead className="text-white/55">Week</TableHead>
                    <TableHead className="text-white/55">Topic</TableHead>
                    <TableHead className="text-white/55">Strand</TableHead>
                    <TableHead className="text-white/55">Content / Indicators</TableHead>
                    <TableHead className="text-white/55">Resources</TableHead>
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
                        {row.weekNumber ?? "-"}
                        {row.weekEnding ? <div className="text-xs text-white/40">{row.weekEnding}</div> : null}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
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
                      <TableCell className="max-w-[220px] text-xs text-white/60">
                        {row.strand || "-"}
                        {row.subStrand ? <div className="mt-1 text-white/40">{row.subStrand}</div> : null}
                      </TableCell>
                      <TableCell className="max-w-[300px] text-xs text-white/60">
                        {row.contentStandard || "-"}
                        {row.indicators.length ? (
                          <div className="mt-1 text-white/45">{row.indicators.join("; ")}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-white/55">
                        {row.resources.length ? row.resources.join("; ") : "-"}
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

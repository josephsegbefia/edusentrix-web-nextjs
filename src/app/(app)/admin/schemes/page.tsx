"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileUp,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAdminSchemeQueue } from "@/hooks/admin/useAdminSchemes";
import { useSchemeDeleteFlow } from "@/hooks/schemes/useSchemeDeleteFlow";
import { adminCanDeleteSchemeStatus } from "@/lib/schemes/scheme-delete";
import { useSchool } from "@/hooks/admin/useSchool";
import type { AdminSchemeQueueRow, SchemeStatus } from "@/types/schemes";
import { SchemeStatusBadge } from "@/components/schemes/SchemeStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function formatPeriodLabels(row: AdminSchemeQueueRow) {
  const ay = row.academicYear?.name;
  const tm = row.term?.name;
  if (ay && tm && ay !== tm) return `${ay} · ${tm}`;
  if (ay) return ay;
  if (tm) return tm;
  if (row.academicPeriodLabel) return row.academicPeriodLabel;
  return "—";
}

function sourceTypeLabel(sourceType?: string) {
  switch (sourceType) {
    case "pdf_import":
      return "PDF import";
    case "csv_import":
      return "CSV import";
    case "excel_import":
      return "Excel import";
    case "ai_generated":
      return "Leo draft";
    case "manual":
      return "Manual";
    default:
      return "Draft";
  }
}

function rowHasCompleteContext(row: AdminSchemeQueueRow) {
  return Boolean(row.grade?.id && row.subject?.id && (row.academicYear?.id || row.term?.id || row.academicPeriodLabel));
}

export default function AdminSchemesPage() {
  const queryClient = useQueryClient();
  const { requestDelete, confirmationDialog, linkedNotesDialog } = useSchemeDeleteFlow({
    apiBasePath: "/api/admin/schemes",
    onDeleted: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
    },
  });

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [periodId, setPeriodId] = React.useState<string>("any");
  const [gradeId, setGradeId] = React.useState<string>("any");
  const [subjectId, setSubjectId] = React.useState<string>("any");
  const [teacherId, setTeacherId] = React.useState<string>("any");
  const [curriculumId, setCurriculumId] = React.useState<string>("any");
  const [classGroupId, setClassGroupId] = React.useState<string>("any");

  React.useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [searchDebounced, periodId, gradeId, subjectId, teacherId, curriculumId, classGroupId]);

  const { data, isLoading, error } = useAdminSchemeQueue({
    status: "all",
    page,
    periodId: periodId === "any" ? undefined : periodId,
    gradeId: gradeId === "any" ? undefined : gradeId,
    subjectId: subjectId === "any" ? undefined : subjectId,
    teacherId: teacherId === "any" ? undefined : teacherId,
    curriculumId: curriculumId === "any" ? undefined : curriculumId,
    classGroupId: classGroupId === "any" ? undefined : classGroupId,
    search: searchDebounced || undefined,
  });

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;
  const incompleteContextCount = rows.filter((row) => !rowHasCompleteContext(row)).length;
  const importCount = rows.filter((row) => row.sourceType?.includes("import")).length;
  const { data: schoolRes } = useSchool();
  const schoolCurriculumCode = schoolRes?.data?.curriculumCode;
  const schoolLoaded = Boolean(schoolRes?.data);
  const isNaCCASchool = schoolCurriculumCode === "ghana_nacca";

  const { data: periodsJson } = useQuery({
    queryKey: ["admin-periods-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/periods", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { periods?: Array<{ _id: string; yearLabel: string; term: string }> } | null;
      if (!res.ok || !json?.periods) throw new Error("Periods failed");
      return json.periods;
    },
    staleTime: 60_000,
  });

  const { data: gradesJson } = useQuery({
    queryKey: ["admin-grades-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grades?active=1", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ id: string; name: string }> } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error("Grades failed");
      return json.data;
    },
    staleTime: 60_000,
  });

  const { data: subjectsJson } = useQuery({
    queryKey: ["admin-subjects-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subjects?isActive=true", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ id: string; name: string }> } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error("Subjects failed");
      return json.data;
    },
    staleTime: 60_000,
  });

  const { data: teachersJson } = useQuery({
    queryKey: ["admin-teachers-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers?limit=100", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Array<{ id: string; fullName: string }>;
      } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error("Teachers failed");
      return json.data;
    },
    staleTime: 60_000,
  });

  const { data: curriculaJson } = useQuery({
    queryKey: ["admin-curricula-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/curricula", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { curricula: Array<{ id: string; title: string }> };
      } | null;
      if (!res.ok || !json?.success || !json.data?.curricula) throw new Error("Curricula failed");
      return json.data.curricula;
    },
    staleTime: 60_000,
  });

  const { data: classesJson } = useQuery({
    queryKey: ["admin-classes-picklist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/classes", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Array<{ id: string; name: string; fullLabel?: string }>;
      } | null;
      if (!res.ok || !json?.success || !json.data) return [];
      return json.data;
    },
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      {confirmationDialog}
      {linkedNotesDialog}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <ClipboardCheck className="h-3.5 w-3.5 text-blue-200" />
              Academic quality control
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Schemes of Learning
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Review imported schemes before they become the lesson-planning backbone. Each scheme
              must be tied to the right grade, subject, and academic period before activation.
            </p>
            {isNaCCASchool ? (
              <Button asChild className="mt-4 bg-blue-500 text-white hover:bg-blue-400">
                <Link href="/admin/schemes/import">
                  <FileUp className="mr-2 h-4 w-4" />
                  Import Scheme
                </Link>
              </Button>
            ) : schoolLoaded ? (
              <p className="mt-4 max-w-2xl rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/85">
                Upload/import is currently available only for Ghana NaCCA schools. Use manual scheme
                review and activation for this curriculum.
              </p>
            ) : null}
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:max-w-xl">
            {[
              {
                icon: FileUp,
                label: isNaCCASchool ? "Import" : "Plan",
                text: isNaCCASchool ? "GES PDF, CSV, or Excel" : "Manual scheme setup",
              },
              { icon: ClipboardCheck, label: "Review", text: "Check context and rows" },
              { icon: Route, label: "Use", text: "Lesson Notes and coverage" },
            ].map((step) => (
              <div key={step.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <step.icon className="h-4 w-4 text-blue-200" />
                <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
                <p className="mt-0.5 text-xs text-white/45">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-blue-300/20 bg-blue-500/10 p-2">
              <Sparkles className="h-5 w-5 text-blue-100" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">What admins do here</h2>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Confirm the imported rows match the official Scheme of Learning, check the grade,
                subject, and period context, then activate the scheme teachers should use for
                lesson-note planning.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
              {importCount} imported in this view
            </Badge>
            {incompleteContextCount > 0 ? (
              <Badge variant="outline" className="border-amber-300/30 bg-amber-500/10 text-amber-100">
                {incompleteContextCount} need context check
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                Context complete
              </Badge>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/45">
            Leo can help admins extract rows during import. Admin review is still the final gate
            before Lesson Notes use the scheme.
          </p>
        </div>
      </section>

      <div className="w-full">
          <Card className={glassPanel}>
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Filter className="h-5 w-5 text-blue-200" />
                  Filters
                </CardTitle>
                <Badge variant="outline" className="w-fit border-white/15 bg-white/5 text-white/60">
                  {pagination?.total ?? 0} schemes
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Search</Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Title…"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Period</Label>
                  <PremiumSelect value={periodId} onValueChange={setPeriodId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any period" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any period</PremiumSelectItem>
                      {(periodsJson ?? []).map((p) => (
                        <PremiumSelectItem key={String(p._id)} value={String(p._id)}>
                          {p.yearLabel} · {p.term}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Grade</Label>
                  <PremiumSelect value={gradeId} onValueChange={setGradeId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any grade" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any grade</PremiumSelectItem>
                      {(gradesJson ?? []).map((g) => (
                        <PremiumSelectItem key={g.id} value={g.id}>
                          {g.name}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Class group</Label>
                  <PremiumSelect value={classGroupId} onValueChange={setClassGroupId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any class" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any class</PremiumSelectItem>
                      {(classesJson ?? []).map((c) => (
                        <PremiumSelectItem key={c.id} value={c.id}>
                          {c.fullLabel ?? c.name}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Subject</Label>
                  <PremiumSelect value={subjectId} onValueChange={setSubjectId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any subject" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any subject</PremiumSelectItem>
                      {(subjectsJson ?? []).map((s) => (
                        <PremiumSelectItem key={s.id} value={s.id}>
                          {s.name}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Teacher</Label>
                  <PremiumSelect value={teacherId} onValueChange={setTeacherId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any teacher" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any teacher</PremiumSelectItem>
                      {(teachersJson ?? []).map((t) => (
                        <PremiumSelectItem key={t.id} value={t.id}>
                          {t.fullName || "Teacher"}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-white/45">Framework</Label>
                  <PremiumSelect value={curriculumId} onValueChange={setCurriculumId}>
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Any framework" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="any">Any framework</PremiumSelectItem>
                      {(curriculaJson ?? []).map((c) => (
                        <PremiumSelectItem key={c.id} value={c.id}>
                          {c.title}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error ? (
                <p className="p-6 text-sm text-rose-300">{error.message}</p>
              ) : null}

              {isLoading ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-white/55">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-200" />
                  <p className="text-sm">Loading schemes…</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-base font-medium text-white">No Schemes of Learning found</p>
                  <p className="mt-2 text-sm text-white/50">
                    Import a scheme or adjust the filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                        <TableHead className="text-white/55">Scheme of Learning</TableHead>
                        <TableHead className="text-white/55">Source</TableHead>
                        <TableHead className="text-white/55">Subject</TableHead>
                        <TableHead className="text-white/55">Grade / Class</TableHead>
                        <TableHead className="text-white/55">Year / Term</TableHead>
                        <TableHead className="text-white/55">Teacher</TableHead>
                        <TableHead className="text-white/55 text-right">Items</TableHead>
                        <TableHead className="text-white/55">Status</TableHead>
                        <TableHead className="text-white/55">Submitted</TableHead>
                        <TableHead className="text-white/55">Updated</TableHead>
                        <TableHead className="text-right text-white/55">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <TableCell className="max-w-[240px]">
                            <Link
                              href={`/admin/schemes/${row.id}`}
                              className="font-medium text-white hover:text-blue-200"
                            >
                              {row.title}
                            </Link>
                            {!rowHasCompleteContext(row) ? (
                              <div className="mt-1 flex items-center gap-1 text-xs text-amber-200">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Check grade, subject, and period
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="whitespace-nowrap border-white/15 bg-white/5 text-xs text-white/65"
                            >
                              {sourceTypeLabel(row.sourceType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white/75">
                            {row.subject?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-white/65">
                            <span>{row.grade?.name ?? "—"}</span>
                            {row.classGroup ? (
                              <span className="text-white/45"> · {row.classGroup.name}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[200px] text-sm text-white/65">
                            {formatPeriodLabels(row)}
                          </TableCell>
                          <TableCell className="text-sm text-white/65">
                            {row.ownerTeacher?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/75">
                            {row.itemCount}
                          </TableCell>
                          <TableCell>
                            <SchemeStatusBadge status={row.status as SchemeStatus} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-white/55">
                            {row.submittedAt
                              ? new Date(row.submittedAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-white/55">
                            {new Date(row.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-white/10 bg-white/5 text-white/80"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-white/10 bg-slate-950 text-white">
                                <DropdownMenuItem asChild className="focus:bg-white/10">
                                  <Link href={`/admin/schemes/${row.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View / Review
                                  </Link>
                                </DropdownMenuItem>
                                {adminCanDeleteSchemeStatus(row.status) ? (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem
                                      className="text-rose-300 focus:bg-rose-500/15 focus:text-rose-200"
                                      onClick={() =>
                                        void requestDelete({ id: row.id, title: row.title })
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete scheme
                                    </DropdownMenuItem>
                                  </>
                                ) : row.status === "active" ? (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem disabled className="text-xs text-white/45">
                                      Archive active schemes before deleting
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {pagination && pagination.totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <p className="text-xs text-white/45">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="border-white/10 bg-white/5 text-white/80"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages || isLoading}
                      onClick={() => setPage((p) => p + 1)}
                      className="border-white/10 bg-white/5 text-white/80"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
      </div>

    </div>
  );
}

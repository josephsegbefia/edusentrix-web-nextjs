"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Trophy,
  TrendingUp,
  BookOpen,
  User,
  Award,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentAcademicsTab({ student }: Props) {
  const { academicSummary, academicRecords } = student;

  const terms = academicRecords?.terms ?? [];
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(
    terms[0]?.id ?? null
  );

  React.useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      setSelectedTermId(terms[0]?.id ?? null);
    }
  }, [terms, selectedTermId]);

  const currentTerm = terms.find((t) => t.id === selectedTermId) ?? null;

  const currentSubjects =
    academicRecords?.subjectsByTerm.find((t) => t.termId === selectedTermId)
      ?.subjects ?? [];

  const hasAcademicData =
    (academicSummary && academicSummary.overallAverage != null) ||
    terms.length > 0 ||
    currentSubjects.length > 0;

  return (
    <div className="mt-4 space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
                <GraduationCap className="h-4 w-4 text-blue-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Overall Average
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {academicSummary?.overallAverage != null
                ? `${academicSummary.overallAverage.toFixed(1)}%`
                : currentTerm?.average != null
                ? `${currentTerm.average.toFixed(1)}%`
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {academicSummary?.latestTermLabel ??
                currentTerm?.label ??
                "No term label"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/30">
                <Trophy className="h-4 w-4 text-amber-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Class Position
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {academicSummary?.classPosition ?? currentTerm?.position != null
                ? academicSummary?.classPosition ?? currentTerm?.position
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Out of{" "}
              {academicSummary?.totalSubjects ??
                currentTerm?.totalSubjects ??
                "--"}{" "}
              subjects
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                <TrendingUp className="h-4 w-4 text-emerald-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Trend
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {academicSummary?.trend
                ? academicSummary.trend === "up"
                  ? "Improving"
                  : academicSummary.trend === "down"
                  ? "Declining"
                  : "Stable"
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Compared to previous term
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Academic Performance Card */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <BookOpen className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Academic Performance
            </CardTitle>
          </div>
          {terms.length > 0 && (
            <Select
              value={selectedTermId ?? undefined}
              onValueChange={setSelectedTermId}
            >
              <SelectTrigger className="h-8 w-full border-white/15 bg-black/40 text-xs sm:w-[180px]">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-slate-950/95 text-xs">
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-xs">
          {!hasAcademicData ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No academic records are available yet for this student.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Once teachers start recording grades and term results,
                they&apos;ll appear here as a full gradebook.
              </p>
            </div>
          ) : (
            <>
              {/* Subject breakdown table */}
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                <div className="border-b border-white/10 px-4 py-3 bg-black/40">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground/80" />
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Subject Breakdown
                    </span>
                  </div>
                </div>
                {currentSubjects.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <BookOpen className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                    <p className="text-[11px] text-muted-foreground/80">
                      No subject-level breakdown has been recorded for this term
                      yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="max-h-[400px] overflow-auto">
                      <table className="min-w-full border-separate border-spacing-y-1 px-2">
                        <thead className="sticky top-0 bg-black/40 backdrop-blur z-10">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              Subject
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              Teacher
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              CA
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              Exam
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              Total
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentSubjects.map((subject) => (
                            <tr
                              key={subject.id}
                              className="group rounded-lg bg-white/5 transition-colors hover:bg-white/10"
                            >
                              <td className="rounded-l-lg px-3 py-2">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-foreground">
                                    {subject.name}
                                  </span>
                                  {subject.shortCode && (
                                    <span className="text-[10px] text-muted-foreground/70">
                                      {subject.shortCode}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-muted-foreground/60" />
                                  <span className="text-[10px] text-muted-foreground/90">
                                    {subject.teacherName ?? "--"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-medium">
                                {subject.caScore != null
                                  ? subject.caScore.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-medium">
                                {subject.examScore != null
                                  ? subject.examScore.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-semibold">
                                {subject.total != null
                                  ? subject.total.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="rounded-r-lg px-3 py-2 text-right">
                                {subject.gradeLetter ? (
                                  <Badge className="bg-primary/20 border border-primary/30 text-primary-100 text-[10px] font-semibold">
                                    {subject.gradeLetter}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/80">
                                    --
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Teacher Comments & Notes */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/5 via-violet-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-400/30">
              <User className="h-4 w-4 text-violet-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Teacher Comments & Notes
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center">
            <User className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-[11px] text-muted-foreground/90">
              This area will show term-specific teacher remarks, subject notes
              and end-of-term comments once the gradebook and remark system are
              live.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
      {/* Left: term selector + subject breakdown */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 flex items-center justify-between gap-3 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Academic Performance
            </CardTitle>
            {terms.length > 0 && (
              <Select
                value={selectedTermId ?? undefined}
                onValueChange={setSelectedTermId}
              >
                <SelectTrigger className="h-8 w-[180px] border-white/15 bg-black/40 text-xs">
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
              <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[11px] text-muted-foreground/90">
                No academic records are available yet for this student.
                <div className="mt-1">
                  Once teachers start recording grades and term results,
                  they&apos;ll appear here as a full gradebook.
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Overall Average
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {academicSummary?.overallAverage != null
                        ? `${academicSummary.overallAverage.toFixed(1)}%`
                        : currentTerm?.average != null
                        ? `${currentTerm.average.toFixed(1)}%`
                        : "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      {academicSummary?.latestTermLabel ??
                        currentTerm?.label ??
                        "No term label"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Class Position
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {academicSummary?.classPosition ??
                      currentTerm?.position != null
                        ? academicSummary?.classPosition ??
                          currentTerm?.position
                        : "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      Out of{" "}
                      {academicSummary?.totalSubjects ??
                        currentTerm?.totalSubjects ??
                        "--"}{" "}
                      subjects
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Trend
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {academicSummary?.trend
                        ? academicSummary.trend === "up"
                          ? "Improving"
                          : academicSummary.trend === "down"
                          ? "Declining"
                          : "Stable"
                        : "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      Compared to previous term
                    </div>
                  </div>
                </div>

                {/* Subject breakdown table */}
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30">
                  <div className="border-b border-white/10 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    Subject Breakdown
                  </div>
                  {currentSubjects.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-muted-foreground/80">
                      No subject-level breakdown has been recorded for this term
                      yet.
                    </div>
                  ) : (
                    <div className="max-h-[320px] overflow-auto text-[11px]">
                      <table className="min-w-full border-separate border-spacing-y-1 px-2">
                        <thead className="text-[10px] uppercase text-muted-foreground/80">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">
                              Subject
                            </th>
                            <th className="px-2 py-1 text-left font-medium">
                              Teacher
                            </th>
                            <th className="px-2 py-1 text-right font-medium">
                              CA
                            </th>
                            <th className="px-2 py-1 text-right font-medium">
                              Exam
                            </th>
                            <th className="px-2 py-1 text-right font-medium">
                              Total
                            </th>
                            <th className="px-2 py-1 text-right font-medium">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentSubjects.map((subject) => (
                            <tr
                              key={subject.id}
                              className="rounded-lg bg-white/5"
                            >
                              <td className="rounded-l-lg px-2 py-1">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium">
                                    {subject.name}
                                  </span>
                                  {subject.shortCode && (
                                    <span className="text-[10px] text-muted-foreground/80">
                                      {subject.shortCode}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-1">
                                <span className="text-[10px] text-muted-foreground/90">
                                  {subject.teacherName ?? "--"}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-right">
                                {subject.caScore != null
                                  ? subject.caScore.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {subject.examScore != null
                                  ? subject.examScore.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {subject.total != null
                                  ? subject.total.toFixed(1)
                                  : "--"}
                              </td>
                              <td className="rounded-r-lg px-2 py-1 text-right">
                                {subject.gradeLetter ? (
                                  <Badge className="bg-white/10 text-[10px]">
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
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: space reserved for future charts / comments */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Teacher Comments & Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 text-[11px] text-muted-foreground/85">
            <p>
              This area will show term-specific teacher remarks, subject notes
              and end-of-term comments once the gradebook and remark system are
              live.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import type { AcademicProfileSubjectResultDTO } from "@/types/academics/student-academic-profile";
import {
  formatSubjectResultScore,
  formatComponentCellValue,
  resolveSubjectResultsTableLayout,
} from "@/lib/academics/profile/subject-results-table-utils";
import { ScoreComponentChips } from "@/components/admin/students/detail/ScoreComponentChips";
import { SubjectResultStatusBadge } from "@/components/admin/students/detail/SubjectResultStatusBadge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

type Props = {
  subjects: AcademicProfileSubjectResultDTO[];
  periodId: string | null;
  periodIsReleased?: boolean;
  onViewBreakdown: (subjectId: string) => void;
};

const thClass =
  "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-300";
const tdClass = "px-3 py-2.5 text-xs text-slate-100/90 align-middle";

export function SubjectResultsTable({
  subjects,
  periodId,
  periodIsReleased = false,
  onViewBreakdown,
}: Props) {
  const layout = React.useMemo(
    () => resolveSubjectResultsTableLayout(subjects),
    [subjects]
  );

  if (!subjects.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
        No subject results recorded for this period yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className={thClass}>Subject</th>
            {layout.mode === "columns"
              ? layout.columns.map((column) => (
                  <th key={column.componentKey} className={cn(thClass, "text-right")}>
                    {column.label}
                  </th>
                ))
              : (
                  <th className={thClass}>Components</th>
                )}
            <th className={cn(thClass, "text-right")}>Total</th>
            <th className={cn(thClass, "text-center")}>Grade</th>
            <th className={cn(thClass, "text-right")}>Teacher</th>
            <th className={cn(thClass, "text-center")}>Status</th>
            <th className={cn(thClass, "text-center")}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {subjects.map((row) => {
            const componentByKey = new Map(
              row.components.map((component) => [component.componentKey, component])
            );
            const totalScore = row.roundedFinalScore ?? row.finalScore;

            return (
              <tr key={row.subjectId} className="hover:bg-white/5">
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{row.subjectName}</span>
                    {row.subjectCode ? (
                      <span className="text-[11px] text-slate-400">{row.subjectCode}</span>
                    ) : null}
                  </div>
                </td>

                {layout.mode === "columns" ? (
                  layout.columns.map((column) => (
                    <td
                      key={column.componentKey}
                      className={cn(tdClass, "text-right text-[11px] tabular-nums")}
                    >
                      {formatComponentCellValue(componentByKey.get(column.componentKey))}
                    </td>
                  ))
                ) : (
                  <td className={tdClass}>
                    <ScoreComponentChips components={row.components} />
                  </td>
                )}

                <td className={cn(tdClass, "text-right text-[11px] font-semibold tabular-nums")}>
                  {formatSubjectResultScore(totalScore)}
                </td>

                <td className={cn(tdClass, "text-center")}>
                  <span
                    className={cn(
                      "inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      row.gradeLabel
                        ? row.isPassed === false
                          ? "border-red-400/60 bg-red-500/15 text-red-50"
                          : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                        : "border-slate-600/60 bg-slate-800/60 text-slate-200"
                    )}
                  >
                    {row.gradeLabel ?? "--"}
                  </span>
                </td>

                <td className={cn(tdClass, "text-right text-[11px] text-slate-300")}>
                  {row.teacherName ?? "--"}
                </td>

                <td className={cn(tdClass, "text-center")}>
                  <SubjectResultStatusBadge
                    row={row}
                    periodIsReleased={periodIsReleased}
                  />
                </td>

                <td className={cn(tdClass, "text-center")}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewBreakdown(row.subjectId)}
                    disabled={!periodId || !row.hasBreakdown}
                    className="h-7 w-7 p-0 hover:bg-primary/20"
                    title={
                      row.hasBreakdown
                        ? "View assessment breakdown"
                        : "Breakdown not available"
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import * as React from "react";
import type { GradebookAssessment, GradebookStudent } from "@/hooks/teacher/useTeacherGradebook";
import { cn } from "@/lib/utils";

export type GradebookTotalsProps = {
  assessments: GradebookAssessment[];
  students: GradebookStudent[];
};

function formatScore(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

export function GradebookTotals({ assessments, students }: GradebookTotalsProps) {
  const totals = React.useMemo(() => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const assessment of assessments) {
      sums[assessment.id] = 0;
      counts[assessment.id] = 0;
    }

    let caSum = 0;
    let examSum = 0;
    let finalSum = 0;

    students.forEach((student) => {
      caSum += student.totals.caTotal ?? 0;
      examSum += student.totals.examTotal ?? 0;
      finalSum += student.totals.finalScore ?? 0;

      assessments.forEach((assessment) => {
        const score = student.scores?.[assessment.id]?.score;
        if (typeof score === "number") {
          sums[assessment.id] += score;
          counts[assessment.id] += 1;
        }
      });
    });

    const avg: Record<string, number | null> = {};
    const sumRow: Record<string, number | null> = {};

    assessments.forEach((assessment) => {
      const count = counts[assessment.id] || 0;
      sumRow[assessment.id] = count > 0 ? formatScore(sums[assessment.id]) : null;
      avg[assessment.id] = count > 0 ? formatScore(sums[assessment.id] / count) : null;
    });

    const studentCount = students.length || 1;

    return {
      sumRow,
      avg,
      caAverage: formatScore(caSum / studentCount),
      examAverage: formatScore(examSum / studentCount),
      finalAverage: formatScore(finalSum / studentCount),
      caTotal: formatScore(caSum),
      examTotal: formatScore(examSum),
      finalTotal: formatScore(finalSum),
    };
  }, [assessments, students]);

  if (students.length === 0) return null;

  return (
    <tfoot className="bg-white/5 text-xs text-white/60">
      <tr>
        <td
          className={cn(
            "sticky left-0 z-10 border-t border-white/10 bg-neutral-950/80 px-3 py-3 font-semibold",
            "backdrop-blur"
          )}
        >
          Totals
        </td>
        <td
          className={cn(
            "sticky left-[200px] z-10 border-t border-white/10 bg-neutral-950/80 px-3 py-3",
            "backdrop-blur"
          )}
        />
        {assessments.map((assessment) => (
          <td key={assessment.id} className="border-t border-white/10 px-3 py-3 text-center">
            {totals.sumRow[assessment.id] ?? "—"}
          </td>
        ))}
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.caTotal}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.examTotal}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.finalTotal}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">—</td>
      </tr>
      <tr>
        <td
          className={cn(
            "sticky left-0 z-10 border-t border-white/10 bg-neutral-950/80 px-3 py-3 font-semibold",
            "backdrop-blur"
          )}
        >
          Average
        </td>
        <td
          className={cn(
            "sticky left-[200px] z-10 border-t border-white/10 bg-neutral-950/80 px-3 py-3",
            "backdrop-blur"
          )}
        />
        {assessments.map((assessment) => (
          <td key={assessment.id} className="border-t border-white/10 px-3 py-3 text-center">
            {totals.avg[assessment.id] ?? "—"}
          </td>
        ))}
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.caAverage}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.examAverage}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">{totals.finalAverage}</td>
        <td className="border-t border-white/10 px-3 py-3 text-center">—</td>
      </tr>
    </tfoot>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { GradebookAssessment, GradebookCategory, GradebookStudent } from "@/hooks/teacher/useTeacherGradebook";
import { GradebookHeader } from "./GradebookHeader";
import { GradebookCell } from "./GradebookCell";
import { GradebookTotals } from "./GradebookTotals";

const CA_TYPES = new Set(["ca", "quiz", "assignment", "midterm", "project"]);
const EXAM_TYPES = new Set(["exam", "mock"]);

export type GradebookGridProps = {
  categories: GradebookCategory[];
  students: GradebookStudent[];
  canEdit: boolean;
  onRecord: (assessment: GradebookAssessment, studentId: string, score: number | null) => void;
  onInvalid?: (message: string) => void;
  draftAssessments?: GradebookAssessment[];
  weights?: { caWeight: number; examWeight: number };
};

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function mergeCategories(options: {
  categories: GradebookCategory[];
  draftAssessments: GradebookAssessment[];
  weights?: { caWeight: number; examWeight: number };
}) {
  const { categories, draftAssessments, weights } = options;
  const categoryMap = new Map<string, GradebookCategory>();

  categories.forEach((category) => {
    categoryMap.set(category.name, {
      ...category,
      assessments: [...category.assessments],
    });
  });

  draftAssessments.forEach((assessment) => {
    const categoryName = CA_TYPES.has(assessment.type) ? "CA" : EXAM_TYPES.has(assessment.type) ? "Exam" : "CA";
    const defaultWeight = categoryName === "CA" ? weights?.caWeight ?? 0.3 : weights?.examWeight ?? 0.7;

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        name: categoryName,
        weight: defaultWeight,
        assessments: [],
      });
    }

    const category = categoryMap.get(categoryName);
    if (!category) return;

    if (!category.assessments.some((existing) => existing.id === assessment.id)) {
      category.assessments.push(assessment);
    }
  });

  const merged = Array.from(categoryMap.values());
  merged.forEach((category) => {
    category.assessments.sort((a, b) => a.title.localeCompare(b.title));
  });
  return merged;
}

export function GradebookGrid({
  categories,
  students,
  canEdit,
  onRecord,
  onInvalid,
  draftAssessments = [],
  weights,
}: GradebookGridProps) {
  const mergedCategories = React.useMemo(
    () => mergeCategories({ categories, draftAssessments, weights }),
    [categories, draftAssessments, weights]
  );

  const assessments = React.useMemo(
    () => mergedCategories.flatMap((category) => category.assessments),
    [mergedCategories]
  );

  if (students.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
        No students found in this class group for the current period.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm text-white/70">
          <GradebookHeader categories={mergedCategories} />
          <tbody>
            {students.map((student) => (
              <tr key={student._id} className="border-b border-white/10">
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[200px] border-b border-white/10 bg-neutral-950/80 px-3 py-3 text-left",
                    "backdrop-blur"
                  )}
                >
                  <div className="font-semibold text-white">{student.name}</div>
                </td>
                <td
                  className={cn(
                    "sticky left-[200px] z-10 min-w-[140px] border-b border-white/10 bg-neutral-950/80 px-3 py-3 text-left text-xs text-white/50",
                    "backdrop-blur"
                  )}
                >
                  {student.admissionNo || "—"}
                </td>
                {assessments.map((assessment) => (
                  <td key={`${student._id}-${assessment.id}`} className="border-b border-white/10 px-3 py-3">
                    <GradebookCell
                      value={student.scores?.[assessment.id]?.score ?? null}
                      maxScore={assessment.maxScore}
                      status={student.scores?.[assessment.id]?.status ?? "draft"}
                      disabled={!canEdit}
                      onInvalid={onInvalid}
                      onSave={(score) => onRecord(assessment, student._id, score)}
                    />
                  </td>
                ))}
                <td className="border-b border-white/10 px-3 py-3 text-center text-xs">
                  {formatScore(student.totals.caTotal)}
                </td>
                <td className="border-b border-white/10 px-3 py-3 text-center text-xs">
                  {formatScore(student.totals.examTotal)}
                </td>
                <td className="border-b border-white/10 px-3 py-3 text-center text-xs font-semibold text-white">
                  {formatScore(student.totals.finalScore)}
                </td>
                <td className="border-b border-white/10 px-3 py-3 text-center text-xs font-semibold text-white">
                  {student.totals.grade || "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <GradebookTotals assessments={assessments} students={students} />
        </table>
      </div>
    </div>
  );
}

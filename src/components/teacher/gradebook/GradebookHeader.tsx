"use client";
import type { GradebookCategory } from "@/hooks/teacher/useTeacherGradebook";
import { cn } from "@/lib/utils";

export type GradebookHeaderProps = {
  categories: GradebookCategory[];
};

export function GradebookHeader({ categories }: GradebookHeaderProps) {
  return (
    <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
      <tr>
        <th
          rowSpan={2}
          className={cn(
            "sticky left-0 z-20 min-w-[200px] border-b border-white/10 bg-neutral-950/80 px-3 py-3 text-left",
            "backdrop-blur"
          )}
        >
          Student
        </th>
        <th
          rowSpan={2}
          className={cn(
            "sticky left-[200px] z-20 min-w-[140px] border-b border-white/10 bg-neutral-950/80 px-3 py-3 text-left",
            "backdrop-blur"
          )}
        >
          Admission No
        </th>
        {categories.map((category) => (
          <th
            key={category.name}
            colSpan={category.assessments.length}
            className="border-b border-white/10 px-3 py-3 text-center"
          >
            {category.name} ({Math.round(category.weight * 100)}%)
          </th>
        ))}
        <th colSpan={4} className="border-b border-white/10 px-3 py-3 text-center">
          Totals
        </th>
      </tr>
      <tr className="text-[10px] text-white/40">
        {categories.flatMap((category) =>
          category.assessments.map((assessment) => (
            <th
              key={assessment.id}
              className="min-w-[120px] border-b border-white/10 px-3 py-3 text-center"
            >
              <div className="text-xs font-semibold text-white/70">{assessment.title}</div>
              <div className="text-[10px] text-white/40">Max {assessment.maxScore}</div>
            </th>
          ))
        )}
        <th className="min-w-[110px] border-b border-white/10 px-3 py-3 text-center">CA Total</th>
        <th className="min-w-[110px] border-b border-white/10 px-3 py-3 text-center">Exam Total</th>
        <th className="min-w-[110px] border-b border-white/10 px-3 py-3 text-center">Final</th>
        <th className="min-w-[80px] border-b border-white/10 px-3 py-3 text-center">Grade</th>
      </tr>
    </thead>
  );
}

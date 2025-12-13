"use client";

import * as React from "react";
import type { StudentSubjectPerformanceRow } from "@/types/admin/student-academics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

type Props = {
  subjects: StudentSubjectPerformanceRow[];
  termId: string | null;
  onViewBreakdown: (subjectId: string) => void;
};

export function SubjectPerformanceTable({
  subjects,
  termId,
  onViewBreakdown,
}: Props) {
  if (!subjects.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
        No subject grades recorded for this term yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
      <div className="grid grid-cols-12 border-b border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-300">
        <div className="col-span-3">Subject</div>
        <div className="col-span-2 text-right">CA</div>
        <div className="col-span-2 text-right">Exam</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-1 text-center">Grade</div>
        <div className="col-span-1 text-right">Teacher</div>
        <div className="col-span-1 text-center">Actions</div>
      </div>
      <div className="divide-y divide-white/5">
        {subjects.map((s) => (
          <div
            key={s.subjectId}
            className="grid grid-cols-12 items-center px-4 py-2 text-xs text-slate-100/90 hover:bg-white/5"
          >
            <div className="col-span-3 flex flex-col">
              <span className="font-medium">{s.subjectName}</span>
              {s.shortCode && (
                <span className="text-[11px] text-slate-400">
                  {s.shortCode}
                </span>
              )}
            </div>
            <div className="col-span-2 text-right text-[11px]">
              {typeof s.caPercentage === "number"
                ? `${s.caPercentage.toFixed(1)}%`
                : "--"}
            </div>
            <div className="col-span-2 text-right text-[11px]">
              {typeof s.examPercentage === "number"
                ? `${s.examPercentage.toFixed(1)}%`
                : "--"}
            </div>
            <div className="col-span-2 text-right text-[11px] font-semibold">
              {typeof s.totalScore === "number"
                ? `${s.totalScore.toFixed(1)}%`
                : "--"}
            </div>
            <div className="col-span-1 flex justify-center">
              <span
                className={cn(
                  "inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  s.gradeLetter
                    ? s.isPassed
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                      : "border-red-400/60 bg-red-500/15 text-red-50"
                    : "border-slate-600/60 bg-slate-800/60 text-slate-200"
                )}
              >
                {s.gradeLetter ?? "--"}
              </span>
            </div>
            <div className="col-span-1 text-right text-[11px] text-slate-300">
              {s.teacherName ?? "--"}
            </div>
            <div className="col-span-1 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewBreakdown(s.subjectId)}
                disabled={!termId}
                className="h-7 w-7 p-0 hover:bg-primary/20"
                title="View assessment breakdown"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

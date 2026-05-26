"use client";
import { BarChart3, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GradebookGradingScale } from "@/hooks/teacher/useTeacherGradebookAssessments";
import { cn } from "@/lib/utils";
import { glassInsetClass, glassPanelClass } from "@/lib/ui/glass-surfaces";

export type GradePreviewProps = {
  scale?: GradebookGradingScale | null;
};

export function GradePreview({ scale }: GradePreviewProps) {
  const mappings = scale?.gradeMappings || [];

  return (
    <Card className={glassPanelClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/30 bg-linear-to-br from-teal-500/20 to-cyan-500/15 text-teal-200 shadow-inner shadow-white/5">
            <BarChart3 className="h-4 w-4" />
          </span>
          Grade preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn(glassInsetClass, "rounded-2xl p-4")}>
          <div className="text-xs uppercase tracking-[0.2em] text-white/40">Weights</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white">
            <div className={cn(glassInsetClass, "p-3")}>
              <div className="text-xs text-white/50">Continuous Assessment</div>
              <div className="text-lg font-semibold text-emerald-200">
                {Math.round((scale?.caWeight ?? 0.3) * 100)}%
              </div>
            </div>
            <div className={cn(glassInsetClass, "p-3")}>
              <div className="text-xs text-white/50">Exam</div>
              <div className="text-lg font-semibold text-indigo-200">
                {Math.round((scale?.examWeight ?? 0.7) * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className={cn(glassInsetClass, "rounded-2xl p-4")}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
            <Scale className="h-3.5 w-3.5" />
            {scale?.name ?? "Default scale"}
          </div>
          {mappings.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">
              Grade mappings are not configured. Final grade letters will remain blank until an admin sets a grading scale.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {mappings.map((mapping) => (
                <div
                  key={`${mapping.letter}-${mapping.minPercentage}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70"
                >
                  <span className="font-semibold text-white">{mapping.letter}</span>
                  <span>
                    {mapping.minPercentage}% - {mapping.maxPercentage}%
                  </span>
                  <span className="text-white/40">{mapping.point} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

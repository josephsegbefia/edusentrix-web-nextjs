"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useSubjectResultPreview } from "@/hooks/teacher/useSubjectResults";
import { SUBJECT_RESULT_STATUS_LABELS } from "@/constants/academics/assessment-engine";
import { glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  AcademicGradingPolicyDTO,
  SubjectResultPreviewStudentDTO,
} from "@/types/academics/assessment-engine";

type FinalPreviewTabProps = {
  classGroupId: string;
  subjectId: string;
  academicPeriodId?: string | null;
  gradingPolicy: AcademicGradingPolicyDTO | null;
  enabled?: boolean;
};

function formatComponentSummary(student: SubjectResultPreviewStudentDTO) {
  return student.components
    .map((component) => `${component.label} ${component.rawPercentage.toFixed(1)}%`)
    .join(" · ");
}

export function FinalPreviewTab({
  classGroupId,
  subjectId,
  academicPeriodId,
  gradingPolicy,
  enabled = true,
}: FinalPreviewTabProps) {
  const { data, isLoading, error, refetch, isFetching } = useSubjectResultPreview(
    classGroupId,
    subjectId,
    academicPeriodId,
    enabled
  );

  const preview = data?.data;
  const components = gradingPolicy?.scoreComponents ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Calculating subject result preview…
      </div>
    );
  }

  if (error) {
    return (
      <GlassPanel className="p-6 text-center">
        <p className="text-sm text-rose-200">
          {error instanceof Error ? error.message : "Failed to load subject result preview."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("mt-4", glassSecondaryButtonClass)}
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </GlassPanel>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4 sm:p-5" glow="teal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Calculated subject results</h3>
            <p className="mt-1 text-sm text-white/55">
              {preview.summary.calculableStudents}/{preview.summary.totalStudents} students ready ·{" "}
              {preview.summary.blockedStudents} blocked · {preview.summary.lockedStudents} already
              submitted
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={glassSecondaryButtonClass}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh preview
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-white/45">
                <th className="px-4 py-3">Student</th>
                {components.map((component) => (
                  <th key={component.key} className="px-4 py-3">
                    {component.label}
                  </th>
                ))}
                <th className="px-4 py-3">Final</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Pass</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issues</th>
              </tr>
            </thead>
            <tbody>
              {preview.students.map((student) => (
                <tr key={student.studentId} className="border-b border-white/5 align-top">
                  <td className="px-4 py-3">
                    <p className="text-white">{student.name}</p>
                    {student.admissionNo ? (
                      <p className="text-xs text-white/45">{student.admissionNo}</p>
                    ) : null}
                  </td>
                  {components.map((component) => {
                    const snapshot = student.components.find(
                      (entry) => entry.componentKey === component.key
                    );
                    return (
                      <td key={component.key} className="px-4 py-3 text-white/70">
                        {snapshot ? (
                          <div>
                            <p>{snapshot.rawPercentage.toFixed(1)}%</p>
                            <p className="text-xs text-white/40">
                              Wtd {snapshot.weightedScore.toFixed(1)}
                            </p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-white/70">{student.roundedFinalScore}</td>
                  <td className="px-4 py-3 text-white/70">{student.gradeLabel || "—"}</td>
                  <td className="px-4 py-3">
                    {student.blocked ? (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-100">
                        Blocked
                      </Badge>
                    ) : student.isPassed ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-100">
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-rose-500/30 text-rose-100">
                        Below pass
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {student.subjectResultStatus ? (
                      <Badge variant="outline" className="border-white/10 text-white/70">
                        {SUBJECT_RESULT_STATUS_LABELS[student.subjectResultStatus] ??
                          student.subjectResultStatus}
                      </Badge>
                    ) : (
                      <span className="text-white/45">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/55">
                    {student.blocked ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{student.issues.length} issue(s)</span>
                        </div>
                        <p className="text-xs text-white/45">{formatComponentSummary(student)}</p>
                        {student.issues.slice(0, 2).map((issue) => (
                          <p key={issue.code} className="text-xs text-amber-200/90">
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-200/80">Ready</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}

// src/components/admin/students/detail/AssessmentBreakdownModal.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useAssessmentBreakdown } from "@/hooks/admin/useAssessmentBreakdown";
import { Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  studentId: string;
  subjectId: string;
  termId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssessmentBreakdownModal({
  studentId,
  subjectId,
  termId,
  open,
  onOpenChange,
}: Props) {
  const { data, isLoading, isError } = useAssessmentBreakdown(
    studentId,
    subjectId,
    termId,
    open // only fetch when modal is open
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white/90">
            {isLoading ? "Loading..." : data?.data.subjectName}
          </DialogTitle>
          {data?.data.termLabel && (
            <p className="text-sm text-muted-foreground">
              {data.data.termLabel}
            </p>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-8 text-center">
            <p className="text-sm text-destructive">
              Failed to load assessment breakdown
            </p>
          </div>
        )}

        {data?.data && (
          <div className="space-y-4">
            {/* Summary Cards */}
            {data.data.summary && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-white/10 bg-linear-to-br from-blue-500/10 to-transparent">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      CA Total
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {data.data.summary.caTotal.toFixed(1)} /{" "}
                      {data.data.summary.caMaxTotal.toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-linear-to-br from-purple-500/10 to-transparent">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Exam Score
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {data.data.summary.examScore.toFixed(1)} /{" "}
                      {data.data.summary.examMaxScore.toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Total Score
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {data.data.summary.totalScore.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Assessments List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/90">
                Assessment Details
              </h3>
              {data.data.assessments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
                  <FileText className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground/90">
                    No assessments recorded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.data.assessments.map((assessment) => {
                    const percentage = assessment.percentage;
                    const colorClass =
                      percentage >= 75
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : percentage >= 60
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-red-500/30 bg-red-500/10";

                    return (
                      <Card
                        key={assessment.id}
                        className={cn(
                          "border-white/10 bg-linear-to-br from-white/5 to-transparent",
                          colorClass
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-white/90">
                                  {assessment.title}
                                </span>
                                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 uppercase">
                                  {assessment.assessmentType}
                                </span>
                              </div>
                              {assessment.gradedAt && (
                                <p className="text-[10px] text-muted-foreground mb-1">
                                  Graded:{" "}
                                  {new Date(
                                    assessment.gradedAt
                                  ).toLocaleDateString()}
                                </p>
                              )}
                              {assessment.remarks && (
                                <p className="text-xs text-muted-foreground/80 mt-1">
                                  {assessment.remarks}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-semibold text-white">
                                {assessment.score.toFixed(1)} /{" "}
                                {assessment.maxScore.toFixed(1)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {percentage.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">
                                Weight: {(assessment.weight * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

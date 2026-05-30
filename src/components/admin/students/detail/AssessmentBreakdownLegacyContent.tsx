"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type LegacyBreakdownData = {
  subjectId: string;
  subjectName: string;
  termId: string;
  termLabel: string;
  assessments: Array<{
    id: string;
    assessmentType: string;
    title: string;
    score: number;
    maxScore: number;
    percentage: number;
    weight: number;
    gradedAt: string | null;
    remarks: string | null;
    createdAt: string;
  }>;
  summary: {
    caTotal: number;
    caMaxTotal: number;
    examScore: number;
    examMaxScore: number;
    totalScore: number;
  } | null;
};

export function AssessmentBreakdownLegacyContent({ data }: { data: LegacyBreakdownData }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
        Showing legacy gradebook assessments. Migrate to the assessment engine for full
        component and contribution detail.
      </p>

      {data.summary ? (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-white/10 bg-linear-to-br from-blue-500/10 to-transparent">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">CA total</p>
              <p className="text-lg font-semibold text-white">
                {data.summary.caTotal.toFixed(1)} / {data.summary.caMaxTotal.toFixed(1)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-linear-to-br from-purple-500/10 to-transparent">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Exam score</p>
              <p className="text-lg font-semibold text-white">
                {data.summary.examScore.toFixed(1)} / {data.summary.examMaxScore.toFixed(1)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Total score</p>
              <p className="text-lg font-semibold text-white">
                {data.summary.totalScore.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white/90">Assessment details</h3>
        {data.assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-white/30" />
            <p className="text-xs text-white/50">No assessments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.assessments.map((assessment) => {
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-medium text-white/90">
                            {assessment.title}
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-white/70">
                            {assessment.assessmentType}
                          </span>
                        </div>
                        {assessment.gradedAt ? (
                          <p className="mb-1 text-[10px] text-white/45">
                            Graded: {new Date(assessment.gradedAt).toLocaleDateString()}
                          </p>
                        ) : null}
                        {assessment.remarks ? (
                          <p className="mt-1 text-xs text-white/55">{assessment.remarks}</p>
                        ) : null}
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-sm font-semibold text-white">
                          {assessment.score.toFixed(1)} / {assessment.maxScore.toFixed(1)}
                        </p>
                        <p className="text-xs text-white/55">{percentage.toFixed(1)}%</p>
                        <p className="mt-1 text-[10px] text-white/40">
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
  );
}

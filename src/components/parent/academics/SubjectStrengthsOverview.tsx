// src/components/parent/academics/SubjectStrengthsOverview.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Award } from "lucide-react";
import { cn } from "@/lib/utils";

type SubjectPerformanceRow = {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  totalScore: number | null;
  gradeLetter: string | null;
};

type Props = {
  subjects: SubjectPerformanceRow[];
};

export function SubjectStrengthsOverview({ subjects }: Props) {
  const subjectsWithScores = React.useMemo(() => {
    return subjects
      .filter((s) => s.totalScore !== null)
      .map((s) => ({
        ...s,
        score: s.totalScore ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [subjects]);

  if (subjectsWithScores.length === 0) {
    return (
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <Award className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Subject Overview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <p className="text-[11px] text-muted-foreground/90">
              No subject data available yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topSubjects = subjectsWithScores.slice(0, 3);
  const bottomSubjects = subjectsWithScores.slice(-3).reverse();

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <Award className="h-4 w-4 text-primary-200" />
          </div>
          <CardTitle className="text-sm font-semibold text-white/80">
            Subject Overview
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Performers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">
              Strongest Subjects
            </h4>
          </div>
          <div className="space-y-2">
            {topSubjects.map((subject, idx) => (
              <div
                key={subject.subjectId}
                className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-[10px] font-bold text-emerald-100">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {subject.subjectName}
                    </p>
                    {subject.shortCode && (
                      <p className="text-[10px] text-emerald-200/70">
                        {subject.shortCode}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-100">
                      {subject.score.toFixed(1)}%
                    </p>
                    {subject.gradeLetter && (
                      <p className="text-[10px] text-emerald-200/70">
                        Grade {subject.gradeLetter}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Areas for Improvement */}
        {bottomSubjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                Areas to Focus On
              </h4>
            </div>
            <div className="space-y-2">
              {bottomSubjects.map((subject, idx) => (
                <div
                  key={subject.subjectId}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5",
                    subject.score < 50
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        subject.score < 50
                          ? "bg-red-500/30 text-red-100"
                          : "bg-amber-500/30 text-amber-100"
                      )}
                    >
                      {bottomSubjects.length - idx}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {subject.subjectName}
                      </p>
                      {subject.shortCode && (
                        <p
                          className={cn(
                            "text-[10px]",
                            subject.score < 50
                              ? "text-red-200/70"
                              : "text-amber-200/70"
                          )}
                        >
                          {subject.shortCode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-bold",
                          subject.score < 50
                            ? "text-red-100"
                            : "text-amber-100"
                        )}
                      >
                        {subject.score.toFixed(1)}%
                      </p>
                      {subject.gradeLetter && (
                        <p
                          className={cn(
                            "text-[10px]",
                            subject.score < 50
                              ? "text-red-200/70"
                              : "text-amber-200/70"
                          )}
                        >
                          Grade {subject.gradeLetter}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

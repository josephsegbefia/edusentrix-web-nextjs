// src/components/admin/students/ClassDistributionList.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClassGroupLabel } from "@/lib/utils/formatClassGroupLabel";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentQuickStats } from "@/types/admin/student";

type ClassDistributionListProps = {
  distribution: StudentQuickStats["classDistribution"];
  loading?: boolean;
};

export function ClassDistributionList({
  distribution,
  loading = false,
}: ClassDistributionListProps) {
  const items = distribution ?? [];
  if (loading) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/15 via-cyan-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Class Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
                <div className="h-1.5 w-full animate-pulse rounded-full bg-white/5" />
              </div>
              <div className="h-4 w-8 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/15 via-cyan-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Class Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <p className="text-xs text-white/50">
            No students found yet. Once students are assigned to classes,
            you&apos;ll see their distribution here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(...items.map((d) => d.count || 0));

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/15 via-cyan-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider">
          Class Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        {items.map((item) => {
          const key =
            item.classGroupId ||
            `${item.gradeName ?? "No grade"}-${item.classGroupName}`;
          const pct = max > 0 ? (item.count / max) * 100 : 0;
          const label =
            formatClassGroupLabel(
              item.gradeName,
              item.classGroupName ?? ""
            ).trim() || "No class";

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="truncate text-xs font-medium text-white/90">
                    {label}
                  </p>
                  <span className="shrink-0 text-xs font-semibold text-white/70">
                    {item.count}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full bg-linear-to-r from-cyan-400/80 via-cyan-500/80 to-cyan-400/80 transition-all duration-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

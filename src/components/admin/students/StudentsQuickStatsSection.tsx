// src/components/admin/students/StudentsQuickStatsSection.tsx
"use client";

import * as React from "react";
import { GraduationCap, AlertCircle, Star, TrendingUp } from "lucide-react";
import { useStudentStats } from "@/hooks/admin/useStudentStats";

// import { GradeDistributionCard } from "./GradeDistributionCard";
import { MetricStatCard } from "../stats/MetricsStatCard";

export function StudentsQuickStatsSection() {
  const { data, isLoading, isError } = useStudentStats();

  if (isError && !isLoading) {
    // Non-blocking: we just don't show stats if they fail
    return null;
  }

  const total = data?.total ?? 0;
  const owingCount = data?.owingCount ?? 0;
  const owingAmount = data?.owingAmount ?? 0;
  const topPerformers = data?.topPerformers ?? 0;
  const newThisMonth = data?.newThisMonth ?? 0;
  // const gradeDistribution = data?.gradeDistribution ?? [];

  return (
    <section className="grid gap-4">
      {/* Main metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <MetricStatCard
          label="Total Students"
          value={isLoading ? "…" : total.toLocaleString()}
          description={`${newThisMonth} new this month`}
          icon={<GraduationCap className="h-4 w-4" />}
          tone="blue"
          loading={isLoading}
        />

        <MetricStatCard
          label="Fee Defaulters"
          value={
            isLoading
              ? "…"
              : owingCount === 0
              ? "0"
              : owingCount.toLocaleString()
          }
          description={
            isLoading
              ? undefined
              : owingAmount > 0
              ? `$${owingAmount.toLocaleString()} outstanding`
              : "No outstanding fees"
          }
          icon={<AlertCircle className="h-4 w-4" />}
          tone="danger"
          loading={isLoading}
        />

        <MetricStatCard
          label="Top Performers"
          value={isLoading ? "…" : topPerformers.toLocaleString()}
          description="Academic excellence"
          icon={<Star className="h-4 w-4" />}
          tone="warning"
          loading={isLoading}
        />

        <MetricStatCard
          label="New This Month"
          value={isLoading ? "…" : newThisMonth.toLocaleString()}
          description="Recent enrollments"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
          loading={isLoading}
        />
      </div>

      {/* Grade distribution - commented out for now */}
      {/* <GradeDistributionCard distribution={gradeDistribution} loading={isLoading} /> */}
    </section>
  );
}

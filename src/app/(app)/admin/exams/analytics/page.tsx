"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { ExamAnalyticsDashboard } from "@/components/admin/exams/ExamAnalyticsDashboard";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";

export default function ExamAnalyticsPage() {
  const [periodFilter, setPeriodFilter] = React.useState("all");
  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods ?? [];

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={BarChart3}
        title="Exam operations"
        subtitle="Simple readiness and workload analytics across active exam sessions."
        backHref="/admin/exams/sessions"
        backLabel="Exam sessions"
        actions={
          <Button type="button" variant="outline" className={glassSecondaryButtonClass} asChild>
            <Link href="/admin/exams/sessions">
              <CalendarRange className="mr-2 h-4 w-4" />
              Manage sessions
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PremiumSelect value={periodFilter} onValueChange={setPeriodFilter}>
          <PremiumSelectTrigger className="w-full sm:w-[260px]">
            <PremiumSelectValue placeholder="Filter by period" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All active periods</PremiumSelectItem>
            {periods.map((period) => (
              <PremiumSelectItem key={period._id} value={period._id}>
                {period.yearLabel} · {period.term}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      <ExamAnalyticsDashboard
        academicPeriodId={periodFilter === "all" ? null : periodFilter}
      />
    </WorkspacePageShell>
  );
}

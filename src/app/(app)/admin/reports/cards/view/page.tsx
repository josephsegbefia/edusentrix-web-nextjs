"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ReportCardView } from "@/components/admin/reports/ReportCardView";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useReportCard } from "@/hooks/admin/useReportCard";
import { glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { Button } from "@/components/ui/button";

export default function AdminReportCardViewPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const academicPeriodId = searchParams.get("academicPeriodId");

  const { data, isLoading, error, refetch, isFetching } = useReportCard(
    studentId,
    academicPeriodId
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          backHref="/admin/reports/report-runs"
          backLabel="Report workflows"
          iconName="file-text"
          title="Report card preview"
          subtitle="Preview the official snapshot or legacy report card layout for a student and term."
          actions={
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              disabled={isFetching || !studentId || !academicPeriodId}
              onClick={() => void refetch()}
            >
              Refresh
            </Button>
          }
        />

        {!studentId || !academicPeriodId ? (
          <GlassPanel className="p-6 text-sm text-white/60">
            Provide `studentId` and `academicPeriodId` query parameters to preview a report card.
          </GlassPanel>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20 text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading report card…
          </div>
        ) : error ? (
          <GlassPanel className="p-6 text-sm text-rose-200">
            {error instanceof Error ? error.message : "Failed to load report card."}
          </GlassPanel>
        ) : data ? (
          <div className="space-y-4">
            {data.source === "snapshot" ? (
              <GlassPanel className="px-4 py-3 text-sm text-emerald-100/80">
                Showing frozen report snapshot ({data.status ?? "snapshot"}).
              </GlassPanel>
            ) : (
              <GlassPanel className="px-4 py-3 text-sm text-amber-100/80">
                Showing legacy SubjectGrade data fallback until a released snapshot exists.
              </GlassPanel>
            )}
            <ReportCardView data={data} />
          </div>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

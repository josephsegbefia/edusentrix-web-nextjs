"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import { ArrowRight, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAdminReportRuns } from "@/hooks/admin/useAdminReportRuns";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  REPORT_CARD_RUN_STATUSES,
  REPORT_CARD_RUN_STATUS_LABELS,
} from "@/constants/academics/assessment-engine";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ReportCardRunStatus } from "@/types/academics/assessment-engine";

const STATUS_STYLES: Record<ReportCardRunStatus, string> = {
  draft: "border-white/10 bg-white/5 text-white/60",
  opened: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
  collecting_marks: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
  ready_to_compile: "border-teal-500/20 bg-teal-500/10 text-teal-100",
  compiled: "border-violet-500/20 bg-violet-500/10 text-violet-100",
  submitted_for_approval: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  returned: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  released: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  archived: "border-white/10 bg-white/5 text-white/45",
};

const QUEUE_STATUSES: ReportCardRunStatus[] = [
  "submitted_for_approval",
  "approved",
  "returned",
  "released",
  "compiled",
];

export function AdminReportRunsClient() {
  const busy = useBusyToast();
  const [statusFilter, setStatusFilter] = React.useState<string>("submitted_for_approval");

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useAdminReportRuns(statusFilter);

  const runs = data?.data ?? [];
  const isBusy = isFetching;

  async function handleRefresh() {
    await busy.promise(refetch(), {
      loading: "Refreshing report runs…",
      success: "Report runs updated.",
      error: "Failed to refresh report runs.",
    });
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={ClipboardList}
        title="Report card approval"
        subtitle="Review compiled class report runs submitted by homeroom teachers."
        actions={
          <Button
            type="button"
            variant="outline"
            className={glassSecondaryButtonClass}
            disabled={isBusy}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isBusy && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <GlassPanel className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Approval queue</h3>
            <p className="mt-1 text-sm text-white/50">
              Filter runs by workflow status. Open a run to review readiness and take action.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger aria-label="Filter by status">
                <PremiumSelectValue placeholder="Filter status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                {QUEUE_STATUSES.map((status) => (
                  <PremiumSelectItem key={status} value={status}>
                    {REPORT_CARD_RUN_STATUS_LABELS[status]}
                  </PremiumSelectItem>
                ))}
                {REPORT_CARD_RUN_STATUSES.filter(
                  (status) => !QUEUE_STATUSES.includes(status)
                ).map((status) => (
                  <PremiumSelectItem key={status} value={status}>
                    {REPORT_CARD_RUN_STATUS_LABELS[status]}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-white/60">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading report runs…
            </div>
          ) : error ? (
            <div className={cn(glassInsetClass, "px-4 py-8 text-center")}>
              <p className="text-sm text-rose-200">
                {error instanceof Error ? error.message : "Failed to load report runs."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("mt-4", glassSecondaryButtonClass)}
                onClick={() => void handleRefresh()}
              >
                Try again
              </Button>
            </div>
          ) : runs.length === 0 ? (
            <div className={cn(glassInsetClass, "px-6 py-10 text-center")}>
              <h3 className="text-lg font-semibold text-white">No report runs found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">
                {statusFilter === "submitted_for_approval"
                  ? "No class report runs are waiting for approval right now."
                  : "Try another status filter to see report runs in this workflow stage."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <Link
                  key={run._id}
                  href={`/admin/reports/report-runs/${run._id}`}
                  className={cn(
                    glassInsetClass,
                    "flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.07] sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-white">
                        {run.classGroup.label || run.classGroup.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[run.status] ?? STATUS_STYLES.draft}
                      >
                        {REPORT_CARD_RUN_STATUS_LABELS[run.status] ?? run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/60">
                      {run.academicPeriod.term} {run.academicPeriod.yearLabel}
                    </p>
                    {run.submittedAt ? (
                      <p className="mt-1 text-xs text-white/45">
                        Submitted {format(new Date(run.submittedAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-cyan-200">
                    Review run
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </GlassPanel>
    </WorkspacePageShell>
  );
}

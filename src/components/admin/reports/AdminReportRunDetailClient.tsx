"use client";

import * as React from "react";
import { format } from "date-fns/format";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  useAdminReportRun,
  useApproveAdminReportRun,
  useReleaseAdminReportRun,
  useReturnAdminReportRun,
} from "@/hooks/admin/useAdminReportRuns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  canApproveReportRunStatus,
  canReleaseReportRunStatus,
  canReturnReportRunStatus,
} from "@/lib/academics/reporting/report-card-approval-service";
import { REPORT_CARD_RUN_STATUS_LABELS } from "@/constants/academics/assessment-engine";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  ReportApprovalLogDTO,
  ReportCardRunSubjectReadinessRow,
} from "@/types/academics/assessment-engine";

const SUBJECT_STATUS_STYLES: Record<
  ReportCardRunSubjectReadinessRow["status"],
  string
> = {
  missing: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  partial: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  submitted: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
};

const SUBJECT_STATUS_LABELS: Record<ReportCardRunSubjectReadinessRow["status"], string> = {
  missing: "Not started",
  partial: "Partial",
  submitted: "Submitted",
  approved: "Approved",
};

const APPROVAL_ACTION_LABELS: Record<string, string> = {
  open: "Opened",
  submit: "Submitted",
  compile: "Compiled",
  approve: "Approved",
  return: "Returned",
  release: "Released",
  lock: "Locked",
  unlock: "Unlocked",
  revoke: "Revoked",
  comment: "Comment added",
};

type AdminReportRunDetailClientProps = {
  runId: string;
};

function formatApprovalAction(action: ReportApprovalLogDTO["action"]) {
  return APPROVAL_ACTION_LABELS[String(action)] ?? String(action);
}

export function AdminReportRunDetailClient({ runId }: AdminReportRunDetailClientProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [returnNote, setReturnNote] = React.useState("");

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useAdminReportRun(runId);

  const approveRun = useApproveAdminReportRun();
  const returnRun = useReturnAdminReportRun();
  const releaseRun = useReleaseAdminReportRun();

  const run = data?.data ?? null;
  const readiness = run?.readinessSnapshot;
  const isBusy =
    isFetching ||
    approveRun.isPending ||
    returnRun.isPending ||
    releaseRun.isPending;

  const canApprove = run ? canApproveReportRunStatus(run.status) : false;
  const canReturn = run ? canReturnReportRunStatus(run.status) : false;
  const canRelease = run ? canReleaseReportRunStatus(run.status) : false;

  async function handleRefresh() {
    await busy.promise(refetch(), {
      loading: "Refreshing report run…",
      success: "Report run updated.",
      error: "Failed to refresh report run.",
    });
  }

  async function handleApprove() {
    if (!run) return;

    const result = await confirm({
      title: "Approve report run?",
      description:
        "This confirms the compiled class report cards are ready for release. Subject results will be marked approved.",
      confirmLabel: "Approve report run",
      intent: "default",
    });
    if (result !== "confirm") return;

    try {
      await busy.promise(approveRun.mutateAsync({ runId: run._id }), {
        loading: "Approving report run…",
        success: "Report run approved.",
        error: (err) => (err instanceof Error ? err.message : "Failed to approve report run"),
      });
    } catch {
      // Toast handled
    }
  }

  async function handleReturnSubmit() {
    if (!run) return;

    const note = returnNote.trim();
    if (!note) return;

    try {
      await busy.promise(returnRun.mutateAsync({ runId: run._id, note }), {
        loading: "Returning report run…",
        success: "Report run returned to homeroom teacher.",
        error: (err) => (err instanceof Error ? err.message : "Failed to return report run"),
      });
      setReturnOpen(false);
      setReturnNote("");
    } catch {
      // Toast handled
    }
  }

  async function handleRelease() {
    if (!run) return;

    const result = await confirm({
      title: "Release report cards?",
      description:
        "Released report cards become official snapshots for parents and students. Subject results will be locked and verification codes will be created.",
      confirmLabel: "Release report cards",
      intent: "default",
    });
    if (result !== "confirm") return;

    try {
      await busy.promise(
        releaseRun.mutateAsync({
          runId: run._id,
          releaseVisibility: { parent: true, student: true },
        }),
        {
          loading: "Releasing report cards…",
          success: "Report cards released.",
          error: (err) => (err instanceof Error ? err.message : "Failed to release report cards"),
        }
      );
    } catch {
      // Toast handled
    }
  }

  return (
    <WorkspacePageShell>
      {confirmationDialog}

      <WorkspacePageHeader
        backHref="/admin/reports/report-runs"
        backLabel="Report card approval"
        icon={ClipboardList}
        title={run?.classGroup.label ?? "Report run"}
        subtitle={
          run
            ? `${run.academicPeriod.term} ${run.academicPeriod.yearLabel} · ${REPORT_CARD_RUN_STATUS_LABELS[run.status] ?? run.status}`
            : "Review readiness, issues, and approval history."
        }
        badge={
          run ? (
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-100">
              {REPORT_CARD_RUN_STATUS_LABELS[run.status] ?? run.status}
            </Badge>
          ) : undefined
        }
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

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-white/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading report run…
        </div>
      ) : error ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-rose-200">
            {error instanceof Error ? error.message : "Failed to load report run."}
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
        </GlassPanel>
      ) : run ? (
        <div className="space-y-4">
          <GlassPanel className="p-4 sm:p-5" glow="cyan">
            <h3 className="text-base font-semibold text-white">Admin actions</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {canApprove
                ? "This run is waiting for your review. Approve it when ready, or return it with clear correction notes."
                : canRelease
                  ? "This run is approved. Release it when you are ready to publish official report cards."
                  : run.status === "released"
                    ? "This report run has been released. Report cards are locked as official snapshots."
                    : run.status === "returned"
                      ? "This run was returned to the homeroom teacher for correction."
                      : "No admin action is available for this run at its current status."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canApprove ? (
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  disabled={approveRun.isPending}
                  onClick={() => void handleApprove()}
                >
                  {approveRun.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
              ) : null}
              {canReturn ? (
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  disabled={returnRun.isPending}
                  onClick={() => setReturnOpen(true)}
                >
                  {returnRun.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Return to homeroom
                </Button>
              ) : null}
              {canRelease ? (
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  disabled={releaseRun.isPending}
                  onClick={() => void handleRelease()}
                >
                  {releaseRun.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Release to parents
                </Button>
              ) : null}
            </div>
          </GlassPanel>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassPanel className="p-4">
              <p className="text-xs uppercase tracking-wide text-white/45">Subjects submitted</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {readiness?.subjectsSubmitted ?? 0}/{readiness?.subjectsExpected ?? 0}
              </p>
            </GlassPanel>
            <GlassPanel className="p-4">
              <p className="text-xs uppercase tracking-wide text-white/45">Students complete</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {readiness?.studentsComplete ?? 0}/{readiness?.studentsExpected ?? 0}
              </p>
            </GlassPanel>
            <GlassPanel className="p-4">
              <p className="text-xs uppercase tracking-wide text-white/45">Attendance ready</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {readiness?.attendanceReady ? (
                  <span className="text-emerald-200">Ready</span>
                ) : (
                  <span className="text-amber-200">Needs records</span>
                )}
              </p>
            </GlassPanel>
            <GlassPanel className="p-4">
              <p className="text-xs uppercase tracking-wide text-white/45">Compiled cards</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {run.studentReportCardCount}
              </p>
            </GlassPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-200" />
                <h3 className="text-base font-semibold text-white">Attendance readiness</h3>
              </div>
              <p className="mt-3 text-sm text-white/60">
                {readiness?.attendanceReady
                  ? "Homeroom attendance records exist for this period."
                  : "Attendance records are missing for this period."}
              </p>
            </GlassPanel>

            <GlassPanel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-cyan-200" />
                <h3 className="text-base font-semibold text-white">Comments readiness</h3>
              </div>
              <p className="mt-3 text-sm text-white/60">
                {readiness?.commentsReady
                  ? "Homeroom and headteacher comments are ready."
                  : "Report comments are not fully captured yet. Homeroom and headteacher comments will be required before release."}
              </p>
            </GlassPanel>
          </div>

          <GlassPanel className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <h3 className="text-base font-semibold text-white">Subject readiness</h3>
              <p className="mt-1 text-sm text-white/50">
                Submitted subject results included in this report run.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-white/45">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {run.subjectReadiness.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                        No subject assignments found for this class.
                      </td>
                    </tr>
                  ) : (
                    run.subjectReadiness.map((row) => (
                      <tr key={row.subjectId} className="border-b border-white/5 align-top">
                        <td className="px-4 py-3 text-white">{row.subjectName}</td>
                        <td className="px-4 py-3 text-white/70">{row.teacherName ?? "—"}</td>
                        <td className="px-4 py-3 text-white/70">
                          {row.submittedCount}/{row.studentsExpected}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={SUBJECT_STATUS_STYLES[row.status]}>
                            {SUBJECT_STATUS_LABELS[row.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-white/55">
                          {row.issues.length > 0 ? (
                            <ul className="space-y-1 text-xs text-amber-200">
                              {row.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-emerald-200/80">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassPanel>

          {(run.issueSummary?.length ?? 0) > 0 ? (
            <GlassPanel className="p-4 sm:p-5">
              <h3 className="text-base font-semibold text-white">Readiness issues</h3>
              <ul className="mt-4 space-y-2">
                {run.issueSummary?.map((issue) => (
                  <li
                    key={issue.code}
                    className={cn(
                      glassInsetClass,
                      "flex items-start gap-2 px-3 py-2 text-sm",
                      issue.severity === "error" ? "text-amber-200" : "text-white/60"
                    )}
                  >
                    {issue.severity === "error" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                    )}
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ) : null}

          <GlassPanel className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white">Approval timeline</h3>
            {(run.approvalLogs?.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-white/50">No approval events recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {run.approvalLogs.map((entry) => (
                  <li key={entry._id} className={cn(glassInsetClass, "px-3 py-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {formatApprovalAction(entry.action)}
                      </span>
                      {entry.beforeStatus && entry.afterStatus ? (
                        <span className="text-xs text-white/45">
                          {entry.beforeStatus} → {entry.afterStatus}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")} ·{" "}
                      {entry.actorRole}
                    </p>
                    {entry.note ? (
                      <p className="mt-2 text-sm leading-6 text-white/70">{entry.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          {run.submittedAt ? (
            <GlassPanel className={cn(glassInsetClass, "px-4 py-3 text-sm text-white/60")}>
              Submitted for approval on{" "}
              {format(new Date(run.submittedAt), "MMM d, yyyy · h:mm a")}.
            </GlassPanel>
          ) : null}

          {run.releasedAt ? (
            <GlassPanel className={cn(glassInsetClass, "px-4 py-3 text-sm text-emerald-100/80")}>
              Released on {format(new Date(run.releasedAt), "MMM d, yyyy · h:mm a")}.
            </GlassPanel>
          ) : null}
        </div>
      ) : null}

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Return report run</DialogTitle>
            <DialogDescription className="text-white/60">
              Explain what the homeroom teacher should fix before resubmitting. A note is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-note">Return note</Label>
            <Textarea
              id="return-note"
              value={returnNote}
              onChange={(event) => setReturnNote(event.target.value)}
              placeholder="Describe the corrections needed…"
              className="min-h-28 border-white/10 bg-black/20 text-white placeholder:text-white/30"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => setReturnOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={!returnNote.trim() || returnRun.isPending}
              onClick={() => void handleReturnSubmit()}
            >
              {returnRun.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Return to homeroom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePageShell>
  );
}

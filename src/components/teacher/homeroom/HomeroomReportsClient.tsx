"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  useCompileHomeroomReportRun,
  useHomeroomReportRun,
  useHomeroomReportRuns,
  useOpenHomeroomReportRun,
  useSubmitHomeroomReportRun,
} from "@/hooks/teacher/useHomeroomReportRuns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { REPORT_CARD_RUN_STATUS_LABELS } from "@/constants/academics/assessment-engine";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  ReportCardRunDetailDTO,
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

type HomeroomReportsClientProps = {
  classGroupId?: string | null;
  classLabel?: string | null;
  permissions?: Permission[];
};

function canCompileRun(run: ReportCardRunDetailDTO) {
  const readiness = run.readinessSnapshot;
  if (!readiness) return false;

  const blockingIssues = (run.issueSummary ?? []).some((issue) => issue.severity === "error");
  return (
    !blockingIssues &&
    readiness.subjectsSubmitted === readiness.subjectsExpected &&
    readiness.subjectsExpected > 0 &&
    readiness.studentsExpected > 0 &&
    readiness.attendanceReady &&
    ["draft", "opened", "collecting_marks", "ready_to_compile", "returned"].includes(run.status)
  );
}

function nextActionCopy(run: ReportCardRunDetailDTO | null, hasRun: boolean) {
  if (!hasRun || !run) {
    return "Open report preparation for your homeroom class to begin.";
  }

  if (run.status === "submitted_for_approval") {
    return "Your class report run is with admin for approval.";
  }

  if (run.status === "approved" || run.status === "released") {
    return "This report run has moved beyond homeroom submission.";
  }

  if (run.status === "compiled") {
    return "Compile is complete. Submit the run when you are ready for admin review.";
  }

  if (canCompileRun(run)) {
    return "All required readiness checks passed. Compile report cards next.";
  }

  return "Complete subject submissions and homeroom attendance before compiling.";
}

export function HomeroomReportsClient({
  classGroupId,
  classLabel,
  permissions = [],
}: HomeroomReportsClientProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const canView = can(permissions, PERMISSIONS.gradebookView);
  const canPublish = can(permissions, PERMISSIONS.gradebookPublish);

  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
    isFetching: listFetching,
  } = useHomeroomReportRuns(classGroupId, null, Boolean(classGroupId && canView));

  const activeRunId = listData?.data?.[0]?._id ?? null;

  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
    isFetching: detailFetching,
  } = useHomeroomReportRun(activeRunId, Boolean(activeRunId && canView));

  const openRun = useOpenHomeroomReportRun();
  const compileRun = useCompileHomeroomReportRun();
  const submitRun = useSubmitHomeroomReportRun();

  const run = detailData?.data ?? null;
  const readiness = run?.readinessSnapshot;
  const isBusy =
    openRun.isPending || compileRun.isPending || submitRun.isPending || listFetching || detailFetching;

  async function handleRefresh() {
    await busy.promise(
      Promise.all([refetchList(), activeRunId ? refetchDetail() : Promise.resolve()]).then(
        (results) => {
          const failed = results.find((result) => "error" in result && result.error);
          if (failed && "error" in failed && failed.error) throw failed.error;
          return results;
        }
      ),
      {
        loading: "Refreshing report run…",
        success: "Report run updated.",
        error: "Failed to refresh report run.",
      }
    );
  }

  async function handleOpenRun() {
    if (!classGroupId) return;

    try {
      await busy.promise(
        openRun.mutateAsync({ classGroupId }),
        {
          loading: "Opening report preparation…",
          success: "Report preparation opened.",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to open report run",
        }
      );
    } catch {
      // Toast handled by busy.promise
    }
  }

  async function handleCompile() {
    if (!run || !classGroupId) return;

    const result = await confirm({
      title: "Compile report cards?",
      description:
        "This creates attendance and student report snapshots for your class. Reports are not released to parents yet.",
      confirmLabel: "Compile report cards",
      intent: "default",
    });
    if (result !== "confirm") return;

    try {
      await busy.promise(
        compileRun.mutateAsync({ runId: run._id, classGroupId }),
        {
          loading: "Compiling report cards…",
          success: "Report cards compiled.",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to compile report cards",
        }
      );
    } catch {
      // Toast handled by busy.promise
    }
  }

  async function handleSubmit() {
    if (!run || !classGroupId) return;

    const result = await confirm({
      title: "Submit to admin?",
      description:
        "This sends the compiled class report run for admin or headteacher approval. You cannot edit it until it is returned.",
      confirmLabel: "Submit for approval",
      intent: "default",
    });
    if (result !== "confirm") return;

    try {
      await busy.promise(
        submitRun.mutateAsync({ runId: run._id, classGroupId }),
        {
          loading: "Submitting report run…",
          success: "Report run submitted for approval.",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to submit report run",
        }
      );
    } catch {
      // Toast handled by busy.promise
    }
  }

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={ClipboardList}
          title="Report cards"
          subtitle="Prepare and submit class report card runs for admin approval."
        />
        <GlassPanel className="p-6">
          <p className="text-sm text-white/60">
            Your role does not include gradebook access. Ask an admin to grant gradebook
            permissions.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  if (!classGroupId) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={ClipboardList}
          title="Report cards"
          subtitle="Prepare and submit class report card runs for admin approval."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/60">
            No homeroom class is assigned yet. Contact your admin to enable report card preparation.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const loading = listLoading || (activeRunId && detailLoading);
  const error = listError ?? detailError;

  return (
    <WorkspacePageShell>
      {confirmationDialog}

      <WorkspacePageHeader
        icon={ClipboardList}
        title="Report cards"
        subtitle={`Prepare, compile, and submit report cards for ${classLabel ?? "your homeroom class"}.`}
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

      {loading ? (
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
      ) : !activeRunId ? (
        <GlassPanel className="p-8 text-center" glow="teal">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10">
            <Sparkles className="h-5 w-5 text-teal-200" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Start report preparation</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/60">
            Open a report run for the current term once subject teachers have submitted their marks.
          </p>
          <Button
            type="button"
            className={cn("mt-5", glassPrimaryButtonClass)}
            disabled={!canPublish || openRun.isPending}
            onClick={() => void handleOpenRun()}
          >
            {openRun.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookOpenCheck className="mr-2 h-4 w-4" />
            )}
            Open report preparation
          </Button>
          {!canPublish ? (
            <p className="mt-2 text-xs text-white/45">
              You do not have permission to open report runs.
            </p>
          ) : null}
        </GlassPanel>
      ) : run ? (
        <div className="space-y-4">
          <GlassPanel className="p-4 sm:p-5" glow="cyan">
            <h3 className="text-base font-semibold text-white">Next action</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">{nextActionCopy(run, true)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canCompileRun(run) ? (
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  disabled={!canPublish || compileRun.isPending}
                  onClick={() => void handleCompile()}
                >
                  {compileRun.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Compile report cards
                </Button>
              ) : null}
              {run.status === "compiled" ? (
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  disabled={!canPublish || submitRun.isPending}
                  onClick={() => void handleSubmit()}
                >
                  {submitRun.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit to admin
                </Button>
              ) : null}
              {!readiness?.attendanceReady ? (
                <Button asChild variant="outline" className={glassSecondaryButtonClass}>
                  <Link href="/teacher/attendance">Review attendance</Link>
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
              <p className="text-xs uppercase tracking-wide text-white/45">Report status</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {REPORT_CARD_RUN_STATUS_LABELS[run.status] ?? run.status}
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
                  : "Attendance records are missing for this period. Record or review daily homeroom attendance before compiling reports."}
              </p>
              {!readiness?.attendanceReady ? (
                <Button asChild variant="outline" className={cn("mt-4", glassSecondaryButtonClass)}>
                  <Link href="/teacher/attendance/homeroom">Take homeroom attendance</Link>
                </Button>
              ) : (
                <p className="mt-3 text-xs text-emerald-200/90">
                  Attendance snapshots will be frozen during compile.
                </p>
              )}
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
              {!readiness?.headteacherCommentReady ? (
                <p className="mt-3 text-xs text-white/45">
                  Headteacher comments are completed during admin approval.
                </p>
              ) : null}
            </GlassPanel>
          </div>

          <GlassPanel className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <h3 className="text-base font-semibold text-white">Subject readiness</h3>
              <p className="mt-1 text-sm text-white/50">
                Track submitted subject results from teachers in your class.
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
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {run.subjectReadiness.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                        No subject assignments found for this class yet.
                      </td>
                    </tr>
                  ) : (
                    run.subjectReadiness.map((row) => (
                      <tr key={row.subjectId} className="border-b border-white/5 align-top">
                        <td className="px-4 py-3 text-white">{row.subjectName}</td>
                        <td className="px-4 py-3 text-white/70">
                          {row.teacherName ?? "—"}
                        </td>
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
                        <td className="px-4 py-3">
                          <Button asChild variant="outline" size="sm" className={glassSecondaryButtonClass}>
                            <Link href={`/teacher/marks/${classGroupId}/${row.subjectId}`}>
                              View marks
                            </Link>
                          </Button>
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
                      issue.severity === "error"
                        ? "text-amber-200"
                        : "text-white/60"
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

          {run.studentReportCardCount > 0 ? (
            <GlassPanel className={cn(glassInsetClass, "px-4 py-3 text-sm text-white/60")}>
              {run.studentReportCardCount} student report card snapshot
              {run.studentReportCardCount === 1 ? "" : "s"} compiled for this run.
            </GlassPanel>
          ) : null}
        </div>
      ) : null}
    </WorkspacePageShell>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarRange,
  BarChart3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
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
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { EXAM_SESSION_STATUSES } from "@/constants/academics/exam-scheduling-engine";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";
import { ExamSessionWizard } from "@/components/admin/exams/ExamSessionWizard";
import { ExamAnalyticsDashboard } from "@/components/admin/exams/ExamAnalyticsDashboard";
import { ExamWorkspaceErrorState } from "@/components/admin/exams/ExamWorkspaceErrorState";
import {
  formatExamSessionStatus,
  formatExamType,
} from "@/components/admin/exams/exam-session-form";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useCancelExamSession, useExamSessions } from "@/hooks/admin/useExamSessions";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/70",
  scheduled: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  conflict_review: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  in_progress: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  locked: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  archived: "border-white/10 bg-white/5 text-white/45",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-100",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...EXAM_SESSION_STATUSES.map((status) => ({
    value: status,
    label: formatExamSessionStatus(status),
  })),
];

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

function SessionCard({
  session,
  periodLabel,
  onEdit,
  onCancel,
  cancelling,
}: {
  session: ExamSessionDTO;
  periodLabel: string;
  onEdit: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const canEdit = session.status === "draft" || session.status === "scheduled";
  const canCancel = !["locked", "archived", "cancelled"].includes(session.status);

  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{session.name}</h3>
            <Badge
              variant="outline"
              className={STATUS_STYLES[session.status] ?? STATUS_STYLES.draft}
            >
              {formatExamSessionStatus(session.status)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {periodLabel} · {formatExamType(session.examType)}
          </p>
          <p className="mt-1 text-sm text-white/50">
            {formatDateRange(session.startDate, session.endDate)}
          </p>
          <p className="mt-2 text-xs text-white/40">
            {session.appliesToClassGroupIds.length} class group
            {session.appliesToClassGroupIds.length === 1 ? "" : "s"} ·{" "}
            {session.appliesToGradeIds.length} grade
            {session.appliesToGradeIds.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={onEdit}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
          <Button type="button" size="sm" className={glassPrimaryButtonClass} asChild>
            <Link href={`/admin/exams/sessions/${session.id}/timetable`}>
              Open timetable
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} asChild>
            <Link href={`/admin/exams/sessions/${session.id}/conflicts`}>
              <ShieldAlert className="mr-2 h-3.5 w-3.5" />
              Conflict review
            </Link>
          </Button>
          {canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-rose-500/30 text-rose-100 hover:bg-rose-500/10"
              onClick={onCancel}
              disabled={cancelling}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ExamSessionsPage() {
  const busy = useBusyToast();
  const confirm = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [periodFilter, setPeriodFilter] = React.useState("all");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<ExamSessionDTO | null>(null);

  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods ?? [];
  const {
    data: sessionsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useExamSessions({
    status: statusFilter,
    academicPeriodId: periodFilter,
  });
  const cancelSession = useCancelExamSession();

  const sessions = sessionsData?.data ?? [];

  const periodLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const period of periods) {
      map.set(period._id, `${period.yearLabel} · ${period.term}`);
    }
    return map;
  }, [periods]);

  function openCreateWizard() {
    setEditingSession(null);
    setWizardOpen(true);
  }

  function openEditWizard(session: ExamSessionDTO) {
    setEditingSession(session);
    setWizardOpen(true);
  }

  async function handleCancel(session: ExamSessionDTO) {
    const confirmed = await confirm({
      title: "Cancel exam session?",
      description: `This will mark "${session.name}" as cancelled. Published timetables will no longer be editable through this session.`,
      confirmLabel: "Cancel session",
      destructive: true,
    });
    if (!confirmed) return;

    await busy.promise(cancelSession.mutateAsync(session.id), {
      loading: "Cancelling session…",
      success: "Exam session cancelled",
      error: (error) =>
        error instanceof Error ? error.message : "Could not cancel session",
    });
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={CalendarRange}
        title="Exam Sessions"
        subtitle="Create and manage exam sessions before building timetables and assigning invigilators."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button type="button" variant="outline" className={glassSecondaryButtonClass} asChild>
              <Link href="/admin/exams/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                Operations
              </Link>
            </Button>
            <Button type="button" className={glassPrimaryButtonClass} onClick={openCreateWizard}>
              <Plus className="mr-2 h-4 w-4" />
              Create exam session
            </Button>
          </div>
        }
      />

      <ExamAnalyticsDashboard
        academicPeriodId={periodFilter === "all" ? null : periodFilter}
        compact
      />

      <GlassPanel className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger className="w-full sm:w-[220px]">
                <PremiumSelectValue placeholder="Filter by status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={periodFilter} onValueChange={setPeriodFilter}>
              <PremiumSelectTrigger className="w-full sm:w-[240px]">
                <PremiumSelectValue placeholder="Filter by period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All periods</PremiumSelectItem>
                {periods.map((period) => (
                  <PremiumSelectItem key={period._id} value={period._id}>
                    {period.yearLabel} · {period.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading exam sessions…
          </div>
        ) : isError ? (
          <ExamWorkspaceErrorState
            title="Could not load exam sessions"
            description={
              error instanceof Error ? error.message : "Something went wrong loading exam sessions."
            }
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : sessions.length === 0 ? (
          <div className={cn(glassInsetClass, "px-6 py-12 text-center")}>
            <CalendarRange className="mx-auto h-10 w-10 text-cyan-300/80" />
            <h3 className="mt-4 text-lg font-semibold text-white">No exam sessions yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">
              Create an exam session to start building exam timetables and assigning
              invigilators.
            </p>
            <Button
              type="button"
              className={cn(glassPrimaryButtonClass, "mt-6")}
              onClick={openCreateWizard}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create exam session
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                periodLabel={periodLabelById.get(session.academicPeriodId) ?? "Unknown period"}
                onEdit={() => openEditWizard(session)}
                onCancel={() => void handleCancel(session)}
                cancelling={cancelSession.isPending}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <ExamSessionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        session={editingSession}
        onCompleted={() => setEditingSession(null)}
      />
    </WorkspacePageShell>
  );
}

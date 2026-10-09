"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ExamTimetableEntryDTO } from "@/types/academics/exam-scheduling-engine";
import { ExamTimetableEntryDrawer } from "@/components/admin/exams/ExamTimetableEntryDrawer";
import { ExamDraftGenerationModal } from "@/components/admin/exams/ExamDraftGenerationModal";
import { ExamSmartSchedulerModal } from "@/components/admin/exams/ExamSmartSchedulerModal";
import { ExamSchedulingLeoPanel } from "@/components/admin/exams/ExamSchedulingLeoPanel";
import { ExamWorkspaceErrorState } from "@/components/admin/exams/ExamWorkspaceErrorState";
import { getExamAssessmentLinkBadge } from "@/components/admin/exams/ExamAssessmentLinkSection";
import { ExamInvigilatorDrawer } from "@/components/admin/exams/ExamInvigilatorDrawer";
import { ExamPublishModal } from "@/components/admin/exams/ExamPublishModal";
import {
  ExamVersionHistoryDrawer,
  getCurrentExamVersionLabel,
} from "@/components/admin/exams/ExamVersionHistoryDrawer";
import {
  formatExamSessionStatus,
  formatExamType,
} from "@/components/admin/exams/exam-session-form";
import {
  useDeleteExamTimetableEntry,
  useExamSession,
  useExamTimetableEntries,
} from "@/hooks/admin/useExamTimetableEntries";
import {
  useExamInvigilatorAssignments,
  useTeacherLabelMap,
} from "@/hooks/admin/useExamInvigilators";
import { useExamVenues } from "@/hooks/admin/useExamVenues";
import { useExamTimetableVersions } from "@/hooks/admin/useExamPublish";
import {
  downloadExamTimetableCsvExport,
  downloadExamTimetablePdfExport,
} from "@/hooks/admin/useExamExports";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

const ENTRY_STATUS_STYLES: Record<string, string> = {
  draft: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)",
  ready: "border-sky-500/30 bg-sky-500/10 text-(--ws-cyan)",
  published: "border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)",
  in_progress: "border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan)",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-(--ws-rose)",
  rescheduled: "border-amber-500/30 bg-amber-500/10 text-(--ws-amber)",
};

function formatEntryStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime} – ${endTime}`;
}

const INVIGILATOR_ROLE_SHORT: Record<string, string> = {
  lead: "Lead",
  assistant: "Asst",
  standby: "Standby",
  relief: "Relief",
};

const ACTIVE_INVIGILATOR_STATUSES = new Set(["assigned", "acknowledged"]);

type ExamTimetableBuilderProps = {
  sessionId: string;
};

export function ExamTimetableBuilder({ sessionId }: ExamTimetableBuilderProps) {
  const busy = useBusyToast();
  const confirm = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [classGroupFilter, setClassGroupFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [draftModalOpen, setDraftModalOpen] = React.useState(false);
  const [smartSchedulerOpen, setSmartSchedulerOpen] = React.useState(false);
  const [invigilatorDrawerOpen, setInvigilatorDrawerOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<ExamTimetableEntryDTO | null>(
    null
  );
  const [invigilatorEntry, setInvigilatorEntry] =
    React.useState<ExamTimetableEntryDTO | null>(null);
  const [publishModalOpen, setPublishModalOpen] = React.useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = React.useState(false);
  const [exportBusy, setExportBusy] = React.useState(false);

  const { data: sessionData, isLoading: sessionLoading, isError: sessionError, refetch: refetchSession } = useExamSession(sessionId);
  const session = sessionData?.data;
  const { data: versionsData, refetch: refetchVersions } = useExamTimetableVersions(sessionId);

  const {
    data: entriesData,
    isLoading: entriesLoading,
    isFetching,
    isError: entriesError,
    refetch,
  } = useExamTimetableEntries(sessionId, {
    status: statusFilter,
    classGroupId: classGroupFilter,
    date: dateFilter || undefined,
  });

  const deleteEntry = useDeleteExamTimetableEntry(sessionId);
  const { data: venuesData } = useExamVenues({ activeOnly: true });
  const { data: invigilatorsData } = useExamInvigilatorAssignments(sessionId);

  const entries = entriesData?.data ?? [];
  const invigilatorAssignments = invigilatorsData?.data ?? [];
  const invigilatorsByEntryId = React.useMemo(() => {
    const map = new Map<string, typeof invigilatorAssignments>();
    for (const assignment of invigilatorAssignments) {
      if (!ACTIVE_INVIGILATOR_STATUSES.has(assignment.status)) continue;
      const current = map.get(assignment.examTimetableEntryId) ?? [];
      current.push(assignment);
      map.set(assignment.examTimetableEntryId, current);
    }
    return map;
  }, [invigilatorAssignments]);

  const invigilatorTeacherIds = React.useMemo(
    () => [...new Set(invigilatorAssignments.map((row) => row.teacherId))],
    [invigilatorAssignments]
  );
  const { data: invigilatorTeacherLabels } = useTeacherLabelMap(invigilatorTeacherIds);
  const venuesById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const venue of venuesData?.data ?? []) {
      map.set(venue.id, venue.name);
    }
    return map;
  }, [venuesData?.data]);

  const { data: labelMaps } = useQuery({
    queryKey: ["exam-timetable-labels", sessionId],
    enabled: Boolean(session),
    queryFn: async () => {
      const [subjectsRes, ...classGroupResponses] = await Promise.all([
        fetch("/api/admin/subjects?isActive=true", { cache: "no-store" }),
        ...(session!.appliesToGradeIds.length > 0
          ? session!.appliesToGradeIds.map((gradeId) =>
              fetch(
                `/api/admin/class-groups/search?gradeId=${encodeURIComponent(gradeId)}&limit=50`,
                { cache: "no-store" }
              )
            )
          : []),
      ]);

      const subjectsJson = (await subjectsRes.json()) as {
        data?: Array<{ _id?: string; id?: string; name?: string }>;
      };
      const subjectMap = new Map<string, string>();
      for (const row of subjectsJson.data ?? []) {
        subjectMap.set(String(row._id ?? row.id ?? ""), String(row.name ?? ""));
      }

      const classGroupMap = new Map<string, string>();
      for (const res of classGroupResponses) {
        const json = (await res.json()) as {
          data?: Array<{ id: string; label: string; name: string }>;
        };
        for (const group of json.data ?? []) {
          classGroupMap.set(group.id, group.label || group.name);
        }
      }

      return { subjectMap, classGroupMap };
    },
  });

  const canMutate =
    session && ["draft", "scheduled", "conflict_review"].includes(session.status);
  const canPublish =
    session &&
    ["draft", "scheduled", "conflict_review", "published"].includes(session.status);
  const currentVersionLabel = getCurrentExamVersionLabel(versionsData?.data);

  async function runExport(label: string, action: () => Promise<void>) {
    setExportBusy(true);
    try {
      await busy.promise(action(), {
        loading: `${label}…`,
        success: `${label} downloaded`,
        error: (error) => (error instanceof Error ? error.message : "Export failed"),
      });
    } finally {
      setExportBusy(false);
    }
  }

  const summary = React.useMemo(() => {
    const missingVenue = entries.filter(
      (entry) => !entry.isUnscheduled && !entry.venueId && !entry.roomLabel
    ).length;
    const unscheduled = entries.filter((entry) => entry.isUnscheduled).length;
    const missingAssessmentLink = entries.filter(
      (entry) => entry.contributesToReport && !entry.assessmentItemId
    ).length;

    const missingInvigilators = entries.filter(
      (entry) => (invigilatorsByEntryId.get(entry.id) ?? []).length === 0
    ).length;

    return {
      total: entries.length,
      unscheduled,
      missingVenue,
      missingInvigilators,
      missingAssessmentLink,
      publishedVersion: currentVersionLabel ?? (session?.publishedAt
        ? new Date(session.publishedAt).toLocaleDateString()
        : "Not published"),
    };
  }, [entries, invigilatorsByEntryId, session?.publishedAt, currentVersionLabel]);

  function openCreateDrawer() {
    setEditingEntry(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(entry: ExamTimetableEntryDTO) {
    setEditingEntry(entry);
    setDrawerOpen(true);
  }

  function openInvigilatorDrawer(entry: ExamTimetableEntryDTO) {
    setInvigilatorEntry(entry);
    setInvigilatorDrawerOpen(true);
  }

  async function handleDelete(entry: ExamTimetableEntryDTO) {
    const confirmed = await confirm({
      title: "Delete draft exam paper?",
      description: "This draft paper will be removed from the timetable.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    await busy.promise(deleteEntry.mutateAsync(entry.id), {
      loading: "Deleting exam paper…",
      success: "Exam paper deleted",
      error: (error) =>
        error instanceof Error ? error.message : "Could not delete exam paper",
    });
  }

  if (sessionLoading) {
    return (
      <WorkspacePageShell>
        <div className="flex items-center justify-center py-24 text-(--ws-fg-70)">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading exam session…
        </div>
      </WorkspacePageShell>
    );
  }

  if (sessionError) {
    return (
      <WorkspacePageShell>
        <ExamWorkspaceErrorState
          title="Could not load exam session"
          description="The timetable builder could not load this session. Check your connection and try again."
          onRetry={() => void refetchSession()}
          backHref="/admin/exams/sessions"
          backLabel="Exam sessions"
        />
      </WorkspacePageShell>
    );
  }

  if (!session) {
    return (
      <WorkspacePageShell>
        <div className={cn(glassInsetClass, "mx-auto max-w-lg p-8 text-center")}>
          <h2 className="text-lg font-semibold text-(--ws-fg)">Exam session not found</h2>
          <Button asChild className={cn(glassPrimaryButtonClass, "mt-4")}>
            <Link href="/admin/exams/sessions">Back to exam sessions</Link>
          </Button>
        </div>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={CalendarRange}
        title={session.name}
        subtitle={`${formatExamType(session.examType)} · ${formatExamSessionStatus(session.status)}${currentVersionLabel ? ` · ${currentVersionLabel}` : ""} · Timetable builder`}
        backHref="/admin/exams/sessions"
        backLabel="Exam sessions"
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
              <Link href={`/admin/exams/sessions/${sessionId}/conflicts`}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                Conflict review
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => setVersionDrawerOpen(true)}
            >
              <History className="mr-2 h-4 w-4" />
              Version history
              {currentVersionLabel ? (
                <Badge
                  variant="outline"
                  className="ml-2 border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan)"
                >
                  {currentVersionLabel}
                </Badge>
              ) : null}
            </Button>
            <PremiumDropdownMenu>
              <PremiumDropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  disabled={exportBusy}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </PremiumDropdownMenuTrigger>
              <PremiumDropdownMenuContent align="end" className="min-w-60">
                <PremiumDropdownMenuItem
                  icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                  onClick={() =>
                    void runExport("Published CSV", () =>
                      downloadExamTimetableCsvExport({ sessionId, mode: "published" })
                    )
                  }
                >
                  CSV — published timetable
                </PremiumDropdownMenuItem>
                {canMutate ? (
                  <PremiumDropdownMenuItem
                    icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    onClick={() =>
                      void runExport("Working CSV", () =>
                        downloadExamTimetableCsvExport({ sessionId, mode: "draft" })
                      )
                    }
                  >
                    CSV — working draft
                  </PremiumDropdownMenuItem>
                ) : null}
                <PremiumDropdownMenuSeparator />
                <PremiumDropdownMenuItem
                  icon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() =>
                    void runExport("Published PDF", () =>
                      downloadExamTimetablePdfExport({
                        sessionId,
                        mode: "published",
                        type: "full",
                      })
                    )
                  }
                >
                  PDF — full timetable (published)
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() =>
                    void runExport("Invigilation PDF", () =>
                      downloadExamTimetablePdfExport({
                        sessionId,
                        mode: "published",
                        type: "invigilation",
                      })
                    )
                  }
                >
                  PDF — invigilation roster
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() =>
                    void runExport("Venue PDF", () =>
                      downloadExamTimetablePdfExport({
                        sessionId,
                        mode: "published",
                        type: "venue",
                      })
                    )
                  }
                >
                  PDF — venue schedule
                </PremiumDropdownMenuItem>
                {canMutate ? (
                  <PremiumDropdownMenuItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    onClick={() =>
                      void runExport("Draft PDF", () =>
                        downloadExamTimetablePdfExport({
                          sessionId,
                          mode: "draft",
                          type: "full",
                        })
                      )
                    }
                  >
                    PDF — full timetable (working draft)
                  </PremiumDropdownMenuItem>
                ) : null}
              </PremiumDropdownMenuContent>
            </PremiumDropdownMenu>
            {canPublish ? (
              <Button
                type="button"
                className={glassPrimaryButtonClass}
                onClick={() => setPublishModalOpen(true)}
              >
                <Rocket className="mr-2 h-4 w-4" />
                {currentVersionLabel ? "Republish" : "Publish"}
              </Button>
            ) : null}
            {canMutate ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  onClick={() => setDraftModalOpen(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate drafts
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  onClick={() => setSmartSchedulerOpen(true)}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Smart schedule
                </Button>
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  onClick={openCreateDrawer}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add exam paper
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {canMutate ? (
        <ExamSchedulingLeoPanel sessionId={sessionId} mode="improvements" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label: "Exam papers",
            value: summary.total,
            icon: ClipboardList,
            tone: "text-(--ws-cyan)",
          },
          {
            label: "Unscheduled",
            value: summary.unscheduled,
            icon: Sparkles,
            tone: summary.unscheduled > 0 ? "text-(--ws-amber)" : "text-(--ws-emerald)",
          },
          {
            label: "Missing venue",
            value: summary.missingVenue,
            icon: MapPin,
            tone: summary.missingVenue > 0 ? "text-(--ws-amber)" : "text-(--ws-emerald)",
          },
          {
            label: "Missing invigilators",
            value: summary.missingInvigilators,
            icon: Users,
            tone:
              summary.missingInvigilators > 0 ? "text-(--ws-amber)" : "text-(--ws-emerald)",
          },
          {
            label: "Missing assessment links",
            value: summary.missingAssessmentLink,
            icon: Link2,
            tone:
              summary.missingAssessmentLink > 0 ? "text-(--ws-amber)" : "text-(--ws-emerald)",
          },
          {
            label: "Published version",
            value: summary.publishedVersion,
            icon: AlertTriangle,
            tone: "text-(--ws-fg-70)",
            isText: true,
          },
        ].map((card) => (
          <GlassPanel key={card.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-(--ws-fg-70)">{card.label}</p>
                <p className={cn("mt-2 text-2xl font-semibold", card.tone)}>
                  {card.isText ? card.value : card.value}
                </p>
              </div>
              <card.icon className={cn("h-5 w-5", card.tone)} />
            </div>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger className="w-full sm:w-[180px]">
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                <PremiumSelectItem value="ready">Ready</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>

            <div className="w-full sm:w-[220px]">
              <CustomDatePicker
                surface="theme"
                label="Filter by date"
                value={dateFilter ? new Date(`${dateFilter}T00:00:00`) : null}
                onChange={(date) =>
                  setDateFilter(date ? date.toISOString().slice(0, 10) : "")
                }
              />
            </div>

            {session.appliesToClassGroupIds.length > 0 ? (
              <PremiumSelect value={classGroupFilter} onValueChange={setClassGroupFilter}>
                <PremiumSelectTrigger className="w-full sm:w-[220px]">
                  <PremiumSelectValue placeholder="Class group" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All class groups</PremiumSelectItem>
                  {session.appliesToClassGroupIds.map((classGroupId) => (
                    <PremiumSelectItem key={classGroupId} value={classGroupId}>
                      {labelMaps?.classGroupMap.get(classGroupId) ?? classGroupId}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            ) : null}
          </div>
        </div>

        {entriesError ? (
          <ExamWorkspaceErrorState
            title="Could not load exam papers"
            description="The timetable list failed to load. Try again or refresh the page."
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : entriesLoading ? (
          <div className="flex items-center justify-center py-16 text-(--ws-fg-70)">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading timetable entries…
          </div>
        ) : entries.length === 0 ? (
          <div className={cn(glassInsetClass, "px-6 py-12 text-center")}>
            <ClipboardList className="mx-auto h-10 w-10 text-(--ws-cyan)" />
            <h3 className="mt-4 text-lg font-semibold text-(--ws-fg)">
              No exam papers have been added yet
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-(--ws-fg-70)">
              Add papers manually to build this session&apos;s exam timetable.
            </p>
            {canMutate ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  onClick={() => setDraftModalOpen(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate drafts
                </Button>
                <Button
                  type="button"
                  className={glassPrimaryButtonClass}
                  onClick={openCreateDrawer}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add exam paper
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-(--ws-line)">
            <Table>
              <TableHeader>
                <TableRow className="border-(--ws-line) hover:bg-transparent">
                  <TableHead className="text-(--ws-fg-70)">Date</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Time</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Class</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Subject</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Venue</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Invigilator(s)</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Assessment link</TableHead>
                  <TableHead className="text-(--ws-fg-70)">Status</TableHead>
                  <TableHead className="text-right text-(--ws-fg-70)">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const classLabels = entry.classGroupIds
                    .map((id) => labelMaps?.classGroupMap.get(id) ?? id)
                    .join(", ");
                  const venueLabel =
                    (entry.venueId && venuesById.get(entry.venueId)) ||
                    entry.roomLabel ||
                    "—";
                  const assessmentBadge = getExamAssessmentLinkBadge(entry);
                  const entryInvigilators = invigilatorsByEntryId.get(entry.id) ?? [];

                  return (
                    <TableRow key={entry.id} className="border-(--ws-line) hover:bg-(--ws-fill-strong)">
                      <TableCell className="whitespace-nowrap text-(--ws-fg)">
                        {entry.isUnscheduled ? (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-(--ws-amber)">
                            Unscheduled
                          </Badge>
                        ) : (
                          formatDateLabel(entry.date)
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-(--ws-fg-70)">
                        {entry.isUnscheduled
                          ? "—"
                          : formatTimeRange(entry.startTime, entry.endTime)}
                      </TableCell>
                      <TableCell className="min-w-[140px] text-(--ws-fg-70)">{classLabels}</TableCell>
                      <TableCell className="min-w-[120px] text-(--ws-fg)">
                        {labelMaps?.subjectMap.get(entry.subjectId) ?? entry.title ?? "Subject"}
                      </TableCell>
                      <TableCell className="text-(--ws-fg-70)">{venueLabel}</TableCell>
                      <TableCell className="min-w-[160px]">
                        {entryInvigilators.length === 0 ? (
                          <button
                            type="button"
                            className={cn(
                              "text-left text-sm",
                              canMutate
                                ? "text-(--ws-amber) hover:text-(--ws-amber)"
                                : "text-(--ws-fg-70)"
                            )}
                            onClick={() => canMutate && openInvigilatorDrawer(entry)}
                            disabled={!canMutate}
                          >
                            Not assigned
                          </button>
                        ) : (
                          <div className="space-y-1">
                            {entryInvigilators.map((assignment) => {
                              const teacherName =
                                invigilatorTeacherLabels?.get(assignment.teacherId) ??
                                "Teacher";
                              return (
                                <p
                                  key={assignment.id}
                                  className="text-sm text-(--ws-fg-70)"
                                >
                                  {teacherName}
                                  <span className="text-(--ws-fg-70)">
                                    {" "}
                                    · {INVIGILATOR_ROLE_SHORT[assignment.role] ?? assignment.role}
                                  </span>
                                </p>
                              );
                            })}
                            {canMutate ? (
                              <button
                                type="button"
                                className="text-xs text-(--ws-cyan) hover:text-(--ws-cyan)"
                                onClick={() => openInvigilatorDrawer(entry)}
                              >
                                Manage
                              </button>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className={cn(
                            canMutate &&
                              (entry.status === "draft" || entry.status === "ready") &&
                              "cursor-pointer"
                          )}
                          onClick={() =>
                            canMutate &&
                            (entry.status === "draft" || entry.status === "ready") &&
                            openEditDrawer(entry)
                          }
                          disabled={
                            !canMutate ||
                            (entry.status !== "draft" && entry.status !== "ready")
                          }
                        >
                          <Badge variant="outline" className={assessmentBadge.tone}>
                            {assessmentBadge.label}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            ENTRY_STATUS_STYLES[entry.status] ?? ENTRY_STATUS_STYLES.draft
                          }
                        >
                          {formatEntryStatus(entry.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canMutate ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={glassSecondaryButtonClass}
                              onClick={() => openInvigilatorDrawer(entry)}
                              title="Assign invigilators"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {canMutate &&
                          (entry.status === "draft" || entry.status === "ready") ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={glassSecondaryButtonClass}
                                onClick={() => openEditDrawer(entry)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {entry.status === "draft" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-rose-500/30 text-(--ws-rose) hover:bg-rose-500/10"
                                  onClick={() => void handleDelete(entry)}
                                  disabled={deleteEntry.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassPanel>

      <ExamTimetableEntryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        session={session}
        entry={editingEntry}
        onCompleted={() => setEditingEntry(null)}
      />

      <ExamDraftGenerationModal
        open={draftModalOpen}
        onOpenChange={setDraftModalOpen}
        session={session}
      />

      <ExamSmartSchedulerModal
        open={smartSchedulerOpen}
        onOpenChange={setSmartSchedulerOpen}
        session={session}
        onApplied={() => void refetch()}
      />

      {invigilatorEntry ? (
        <ExamInvigilatorDrawer
          open={invigilatorDrawerOpen}
          onOpenChange={(open) => {
            setInvigilatorDrawerOpen(open);
            if (!open) setInvigilatorEntry(null);
          }}
          session={session}
          entry={invigilatorEntry}
          subjectLabel={
            labelMaps?.subjectMap.get(invigilatorEntry.subjectId) ??
            invigilatorEntry.title ??
            undefined
          }
          classLabels={invigilatorEntry.classGroupIds
            .map((id) => labelMaps?.classGroupMap.get(id) ?? id)
            .join(", ")}
          canMutate={Boolean(canMutate)}
        />
      ) : null}

      <ExamPublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        session={session}
        onPublished={() => {
          void refetch();
          void refetchVersions();
        }}
      />

      <ExamVersionHistoryDrawer
        open={versionDrawerOpen}
        onOpenChange={setVersionDrawerOpen}
        sessionId={sessionId}
        sessionName={session.name}
      />
    </WorkspacePageShell>
  );
}

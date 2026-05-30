"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ExamConflictDTO, ExamConflictSeverity } from "@/types/academics/exam-scheduling-engine";
import {
  formatExamSessionStatus,
  formatExamType,
} from "@/components/admin/exams/exam-session-form";
import { formatExamConflictType } from "@/components/admin/exams/exam-conflict-labels";
import {
  buildConflictFixRequest,
  getConflictFixActions,
  type ConflictFixRequest,
} from "@/components/admin/exams/exam-conflict-actions";
import { ExamConflictFixModals } from "@/components/admin/exams/ExamConflictFixModals";
import { ExamConflictOverrideModal } from "@/components/admin/exams/ExamConflictOverrideModal";
import { ExamSchedulingLeoPanel } from "@/components/admin/exams/ExamSchedulingLeoPanel";
import { useExamConflictCheck } from "@/hooks/admin/useExamConflicts";
import { useExamSession, useExamTimetableEntries } from "@/hooks/admin/useExamTimetableEntries";

type ConflictTab = ExamConflictSeverity;

const TAB_OPTIONS: Array<{
  id: ConflictTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  {
    id: "error",
    label: "Errors",
    icon: ShieldAlert,
    tone: "text-rose-200",
  },
  {
    id: "warning",
    label: "Warnings",
    icon: AlertTriangle,
    tone: "text-amber-200",
  },
  {
    id: "info",
    label: "Info",
    icon: Info,
    tone: "text-sky-200",
  },
];

const SEVERITY_STYLES: Record<ExamConflictSeverity, string> = {
  error: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-100",
};

function readinessTone(score: number) {
  if (score >= 85) return "text-emerald-200";
  if (score >= 60) return "text-amber-200";
  return "text-rose-200";
}

function readinessLabel(score: number, errorCount: number, entryCount: number) {
  if (entryCount === 0) return "Add exam papers before publishing.";
  if (errorCount === 0 && score >= 85) return "Ready to review for publishing.";
  if (errorCount === 0) return "Minor issues remain. Review warnings before publishing.";
  return "Blocking issues must be resolved before publishing.";
}

function formatEntryScheduleLabel(entry: {
  isUnscheduled: boolean;
  date: string;
  startTime: string;
  endTime: string;
}) {
  if (entry.isUnscheduled) return "Unscheduled";
  const date = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${date} · ${entry.startTime} – ${entry.endTime}`;
}

type ExamConflictReviewProps = {
  sessionId: string;
};

export function ExamConflictReview({ sessionId }: ExamConflictReviewProps) {
  const [activeTab, setActiveTab] = React.useState<ConflictTab>("error");
  const [fixRequest, setFixRequest] = React.useState<ConflictFixRequest | null>(null);
  const [overrideConflict, setOverrideConflict] = React.useState<ExamConflictDTO | null>(null);

  const { data: sessionData, isLoading: sessionLoading } = useExamSession(sessionId);
  const session = sessionData?.data;

  const {
    data: conflictData,
    isLoading: conflictsLoading,
    isFetching,
    refetch,
    error: conflictError,
  } = useExamConflictCheck(sessionId);

  const { data: entriesData } = useExamTimetableEntries(sessionId);
  const entries = entriesData?.data ?? [];
  const entryById = React.useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );

  const { data: labelMaps } = useQuery({
    queryKey: ["exam-conflict-labels", sessionId],
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

  const result = conflictData?.data;
  const allConflicts = result?.conflicts ?? [];
  const summary = result?.summary;
  const policy = result?.policy;

  const tabCounts: Record<ConflictTab, number> = {
    error: allConflicts.filter((row) => row.severity === "error").length,
    warning: allConflicts.filter((row) => row.severity === "warning").length,
    info: allConflicts.filter((row) => row.severity === "info").length,
  };

  const activeConflicts = allConflicts.filter((row) => row.severity === activeTab);

  React.useEffect(() => {
    if ((summary?.errors ?? 0) > 0) {
      setActiveTab("error");
      return;
    }
    if ((summary?.warnings ?? 0) > 0) {
      setActiveTab("warning");
      return;
    }
    if (tabCounts.error > 0) {
      setActiveTab("error");
      return;
    }
    if (tabCounts.warning > 0) {
      setActiveTab("warning");
      return;
    }
    setActiveTab("info");
  }, [
    summary?.errors,
    summary?.warnings,
    tabCounts.error,
    tabCounts.warning,
  ]);

  function resolveEntryLabel(entryId: string) {
    const entry = entryById.get(entryId);
    if (!entry) return "Exam paper";
    const subject =
      labelMaps?.subjectMap.get(entry.subjectId) ?? entry.title ?? "Subject";
    const classes = entry.classGroupIds
      .map((id) => labelMaps?.classGroupMap.get(id) ?? id)
      .join(", ");
    return classes ? `${subject} · ${classes}` : subject;
  }

  if (sessionLoading) {
    return (
      <WorkspacePageShell>
        <div className="flex items-center justify-center py-24 text-white/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading exam session…
        </div>
      </WorkspacePageShell>
    );
  }

  if (!session) {
    return (
      <WorkspacePageShell>
        <div className={cn(glassInsetClass, "mx-auto max-w-lg p-8 text-center")}>
          <h2 className="text-lg font-semibold text-white">Exam session not found</h2>
          <Button asChild className={cn(glassPrimaryButtonClass, "mt-4")}>
            <Link href="/admin/exams/sessions">Back to exam sessions</Link>
          </Button>
        </div>
      </WorkspacePageShell>
    );
  }

  const readinessScore = summary?.readinessScore ?? 0;
  const canMutate =
    session && ["draft", "scheduled", "conflict_review"].includes(session.status);

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={ShieldAlert}
        title={`${session.name} · Conflict review`}
        subtitle={`${formatExamType(session.examType)} · ${formatExamSessionStatus(session.status)}`}
        backHref={`/admin/exams/sessions/${sessionId}/timetable`}
        backLabel="Timetable builder"
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
              Run review
            </Button>
            <Button type="button" className={glassPrimaryButtonClass} asChild>
              <Link href={`/admin/exams/sessions/${sessionId}/timetable`}>
                Open timetable
              </Link>
            </Button>
          </div>
        }
      />

      {conflictsLoading ? (
        <div className="flex items-center justify-center py-20 text-white/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Running conflict review…
        </div>
      ) : conflictError ? (
        <GlassPanel className="p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-300/80" />
          <p className="mt-4 text-sm text-white/70">
            {conflictError instanceof Error
              ? conflictError.message
              : "Could not run conflict review."}
          </p>
          <Button
            type="button"
            className={cn(glassPrimaryButtonClass, "mt-4")}
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </GlassPanel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
            <GlassPanel className="p-6">
              <p className="text-xs uppercase tracking-wide text-white/45">Publish readiness</p>
              <div className="mt-4 flex items-end gap-3">
                <p className={cn("text-5xl font-semibold tabular-nums", readinessTone(readinessScore))}>
                  {readinessScore}
                </p>
                <p className="pb-1 text-sm text-white/50">/ 100</p>
              </div>
              <p className="mt-3 text-sm text-white/70">
                {readinessLabel(
                  readinessScore,
                  summary?.errors ?? 0,
                  summary?.entryCount ?? 0
                )}
              </p>
              {result?.checkedAt ? (
                <p className="mt-4 text-xs text-white/40">
                  Last checked{" "}
                  {new Date(result.checkedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
            </GlassPanel>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Blocking errors",
                  value: summary?.errors ?? 0,
                  icon: ShieldAlert,
                  tone: (summary?.errors ?? 0) > 0 ? "text-rose-200" : "text-emerald-200",
                },
                {
                  label: "Warnings",
                  value: summary?.warnings ?? 0,
                  icon: AlertTriangle,
                  tone: (summary?.warnings ?? 0) > 0 ? "text-amber-200" : "text-white/70",
                },
                {
                  label: "Overridden",
                  value: summary?.overridden ?? 0,
                  icon: CheckCircle2,
                  tone: (summary?.overridden ?? 0) > 0 ? "text-emerald-200" : "text-white/70",
                },
                {
                  label: "Info notices",
                  value: summary?.info ?? 0,
                  icon: Info,
                  tone: "text-sky-200",
                },
              ].map((card) => (
                <GlassPanel key={card.label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/45">
                        {card.label}
                      </p>
                      <p className={cn("mt-2 text-2xl font-semibold", card.tone)}>
                        {card.value}
                      </p>
                    </div>
                    <card.icon className={cn("h-5 w-5", card.tone)} />
                  </div>
                </GlassPanel>
              ))}
            </div>
          </div>

          <GlassPanel className="p-4 sm:p-6">
            <div className="mb-6 flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => {
                const active = activeTab === tab.id;
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
                      active
                        ? "border-white/15 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <tab.icon className={cn("h-4 w-4", tab.tone)} />
                    {tab.label}
                    <Badge variant="outline" className="border-white/10 bg-black/20 text-white/70">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {activeConflicts.length === 0 ? (
              <div className={cn(glassInsetClass, "px-6 py-12 text-center")}>
                {activeTab === "error" ? (
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300/80" />
                ) : (
                  <CalendarRange className="mx-auto h-10 w-10 text-cyan-300/80" />
                )}
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {activeTab === "error"
                    ? "No blocking errors found"
                    : activeTab === "warning"
                      ? "No warnings right now"
                      : "No info notices right now"}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">
                  {activeTab === "error"
                    ? "This session has no blocking scheduling issues in the current review."
                    : "Check the other tabs if you are preparing to publish."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeConflicts.map((conflict) => (
                  <div key={conflict.key} className="space-y-3">
                    <ConflictCard
                      conflict={conflict}
                      sessionId={sessionId}
                      canMutate={Boolean(canMutate)}
                      allowOverride={Boolean(policy?.allowConflictOverride)}
                      onFix={(request) => setFixRequest(request)}
                      onOverride={() => setOverrideConflict(conflict)}
                      resolveEntryLabel={resolveEntryLabel}
                      getEntrySchedule={(entryId) => {
                        const entry = entryById.get(entryId);
                        return entry ? formatEntryScheduleLabel(entry) : null;
                      }}
                    />
                    <ExamSchedulingLeoPanel
                      sessionId={sessionId}
                      mode="conflict-explain"
                      conflictKey={conflict.key}
                    />
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </>
      )}

      <ExamConflictFixModals
        session={session}
        entries={entries}
        fixRequest={fixRequest}
        onOpenChange={(open) => {
          if (!open) setFixRequest(null);
        }}
        onFixed={() => void refetch()}
        resolveEntryLabel={resolveEntryLabel}
      />

      <ExamConflictOverrideModal
        open={Boolean(overrideConflict)}
        onOpenChange={(open) => {
          if (!open) setOverrideConflict(null);
        }}
        sessionId={sessionId}
        conflict={overrideConflict}
        requireReason={Boolean(policy?.requireOverrideReason)}
        onCompleted={() => void refetch()}
      />
    </WorkspacePageShell>
  );
}

function ConflictCard({
  conflict,
  sessionId,
  canMutate,
  allowOverride,
  onFix,
  onOverride,
  resolveEntryLabel,
  getEntrySchedule,
}: {
  conflict: ExamConflictDTO;
  sessionId: string;
  canMutate: boolean;
  allowOverride: boolean;
  onFix: (request: ConflictFixRequest) => void;
  onOverride: () => void;
  resolveEntryLabel: (entryId: string) => string;
  getEntrySchedule: (entryId: string) => string | null;
}) {
  const fixActions = getConflictFixActions(conflict);
  const isOverridden = Boolean(conflict.isOverridden);
  const affectedEntries = conflict.affectedEntryIds.map((entryId) => ({
    id: entryId,
    label: resolveEntryLabel(entryId),
    schedule: getEntrySchedule(entryId),
  }));

  return (
    <div className={cn(glassInsetClass, "space-y-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
              {formatExamConflictType(conflict.type)}
            </Badge>
            <Badge variant="outline" className={SEVERITY_STYLES[conflict.severity]}>
              {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)}
            </Badge>
            {isOverridden ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              >
                Overridden
              </Badge>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-white">{conflict.message}</p>
          {isOverridden && conflict.overrideReason ? (
            <p className="text-sm text-emerald-100/80">
              Override reason: {conflict.overrideReason}
            </p>
          ) : null}
        </div>
      </div>

      {affectedEntries.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/45">Affected exam papers</p>
          <ul className="mt-2 space-y-2">
            {affectedEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85"
              >
                <p>{entry.label}</p>
                {entry.schedule ? (
                  <p className="mt-1 text-xs text-white/45">{entry.schedule}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conflict.suggestion ? (
        <div className={cn(glassInsetClass, "border-amber-500/20 bg-amber-500/5 p-3")}>
          <p className="text-xs uppercase tracking-wide text-amber-100/70">Suggested fix</p>
          <p className="mt-1 text-sm text-amber-50/90">{conflict.suggestion}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {canMutate && !isOverridden
          ? fixActions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                className={glassPrimaryButtonClass}
                onClick={() => {
                  const request = buildConflictFixRequest({
                    action: action.id,
                    conflict,
                  });
                  if (request) onFix(request);
                }}
              >
                {action.label}
              </Button>
            ))
          : null}
        {canMutate &&
        allowOverride &&
        conflict.canOverride &&
        !isOverridden ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={glassSecondaryButtonClass}
            onClick={onOverride}
          >
            Override
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} asChild>
          <Link href={`/admin/exams/sessions/${sessionId}/timetable`}>
            Open timetable
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

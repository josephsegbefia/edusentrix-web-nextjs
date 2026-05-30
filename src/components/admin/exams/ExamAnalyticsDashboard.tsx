"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  Loader2,
  ShieldAlert,
  Users,
  NotebookPen,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { formatExamSessionStatus } from "@/components/admin/exams/exam-session-form";
import { useExamSchedulingAnalytics } from "@/hooks/admin/useExamAnalytics";

type ExamAnalyticsDashboardProps = {
  academicPeriodId?: string | null;
  compact?: boolean;
};

const CARD_TONES = [
  "text-cyan-200",
  "text-emerald-200",
  "text-amber-200",
  "text-rose-200",
  "text-violet-200",
];

export function ExamAnalyticsDashboard({
  academicPeriodId,
  compact = false,
}: ExamAnalyticsDashboardProps) {
  const { data, isLoading, isError, refetch, isFetching } = useExamSchedulingAnalytics(
    academicPeriodId ?? null
  );
  const analytics = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-white/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading exam analytics…
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <GlassPanel className="p-6 text-center">
        <p className="text-sm text-white/60">Could not load exam analytics.</p>
        <Button
          type="button"
          variant="outline"
          className={cn(glassSecondaryButtonClass, "mt-4")}
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </GlassPanel>
    );
  }

  const cards = [
    {
      label: "Total papers",
      value: analytics.summary.totalPapers,
      icon: ClipboardList,
      href: "/admin/exams/sessions",
    },
    {
      label: "Published papers",
      value: analytics.summary.publishedPapers,
      icon: BarChart3,
      href: "/admin/exams/sessions",
    },
    {
      label: "Open conflicts",
      value: analytics.summary.openConflictErrors + analytics.summary.openConflictWarnings,
      icon: ShieldAlert,
      href: "/admin/exams/sessions",
    },
    {
      label: "Marks pending",
      value: analytics.summary.marksPendingPapers,
      icon: NotebookPen,
      href: "/admin/exams/sessions",
    },
    {
      label: "Active sessions",
      value: analytics.summary.activeSessionCount,
      icon: Users,
      href: "/admin/exams/sessions",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="block">
              <GlassPanel className="h-full p-4 transition hover:border-white/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">{card.label}</p>
                    <p className={cn("mt-2 text-2xl font-semibold text-white", CARD_TONES[index])}>
                      {card.value}
                    </p>
                  </div>
                  <Icon className={cn("h-5 w-5", CARD_TONES[index])} />
                </div>
              </GlassPanel>
            </Link>
          );
        })}
      </div>

      {!compact ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassPanel className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Session highlights</h3>
                <p className="text-sm text-white/50">
                  Drill down into timetables and conflict review from each session.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={glassSecondaryButtonClass}
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            {analytics.sessionHighlights.length === 0 ? (
              <div className={cn(glassInsetClass, "px-4 py-8 text-center text-sm text-white/50")}>
                No active exam sessions in this view.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.sessionHighlights.slice(0, 6).map((session) => (
                  <div
                    key={session.sessionId}
                    className={cn(glassInsetClass, "flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between")}
                  >
                    <div>
                      <p className="font-medium text-white">{session.sessionName}</p>
                      <p className="mt-1 text-sm text-white/55">
                        {formatExamSessionStatus(session.status)} · {session.totalPapers} papers ·{" "}
                        {session.publishedPapers} published · {session.conflictErrors} blocking
                        conflict{session.conflictErrors === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={glassSecondaryButtonClass}
                        asChild
                      >
                        <Link href={`/admin/exams/sessions/${session.sessionId}/timetable`}>
                          Timetable
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={glassSecondaryButtonClass}
                        asChild
                      >
                        <Link href={`/admin/exams/sessions/${session.sessionId}/conflicts`}>
                          Conflicts
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white">Invigilation workload</h3>
            <p className="mt-1 text-sm text-white/50">
              Teachers with the highest active invigilation load across active sessions.
            </p>
            <div className="mt-4 space-y-2">
              {analytics.invigilationWorkload.length === 0 ? (
                <div className={cn(glassInsetClass, "px-4 py-6 text-sm text-white/50")}>
                  No invigilator assignments yet.
                </div>
              ) : (
                analytics.invigilationWorkload.map((row) => (
                  <div
                    key={row.teacherId}
                    className={cn(glassInsetClass, "flex items-center justify-between px-3 py-2")}
                  >
                    <span className="text-sm text-white/80">
                      {row.teacherName ?? "Teacher"}
                    </span>
                    <span className="text-sm font-medium text-cyan-100">
                      {row.assignmentCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
        </div>
      ) : null}
    </div>
  );
}

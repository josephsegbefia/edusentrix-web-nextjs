"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  NotebookPen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useParentWardLessonSessions } from "@/hooks/parent/useParentWardLessonSessions";
import { cn } from "@/lib/utils";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";

function formatLessonDate(value: string | null) {
  if (!value) return "Date not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ParentWardLessonsPage() {
  const params = useParams();
  const wardId = typeof params.id === "string" ? params.id : null;
  const { data, isLoading, isError, error } = useParentWardLessonSessions(wardId);
  const sessions = data?.success && data.data.visible ? data.data.sessions : [];
  const familySummaryCount = sessions.filter((row) => row.hasParentSummary).length;
  const notebookNotesCount = sessions.filter(
    (row) => row.notebookNotesPublished && row.hasNotebookNotes
  ).length;

  if (!wardId) {
    return (
      <div className="p-4 text-white md:p-8">
        <WorkspacePageShell className="w-full">
          <GlassPanel className="p-6" glow="cyan">
            <p className="text-sm text-white/60">Missing ward id.</p>
          </GlassPanel>
        </WorkspacePageShell>
      </div>
    );
  }

  return (
    <div className="p-4 pb-16 text-white md:p-8">
      <WorkspacePageShell className="w-full">
        <WorkspacePageHeader
          title="Class Lessons"
          subtitle="Published lesson summaries and notebook notes for your child&apos;s class."
          icon={BookOpen}
          backHref={`/parent/wards/${wardId}`}
          backLabel="Back to ward"
        />

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <GlassPanel className="p-5" glow="teal">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl bg-white/10" />
                ))}
              </div>
            </GlassPanel>
            <GlassPanel className="p-5" glow="cyan">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl bg-white/10" />
                ))}
              </div>
            </GlassPanel>
          </div>
        ) : null}

        {isError ? (
          <GlassPanel className="p-5" glow="none">
            <div className={cn(glassInsetClass, "flex items-start gap-3 border-red-500/30 bg-red-500/10 p-4")}>
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
              <div>
                <p className="font-medium text-red-100">Could not load lessons</p>
                <p className="mt-1 text-sm text-red-100/75">
                  {error instanceof Error ? error.message : "Please try again shortly."}
                </p>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {!isLoading && data?.success && !data.data.visible ? (
          <GlassPanel className="p-6" glow="cyan">
            <div className={cn(glassInsetClass, "flex items-start gap-3 p-4")}>
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <div>
                <p className="font-medium text-white">Lesson summaries are not enabled</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  Parent-facing lesson summaries are not enabled for your school. Administrators
                  can turn this on under{" "}
                  <span className="font-medium text-white/85">Admin &gt; Settings &gt; Features</span>.
                </p>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {!isLoading && data?.success && data.data.visible ? (
          <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
            <GlassPanel className="p-5" glow="teal">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                    Lesson Library
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Published for families</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <SummaryStat icon={BookOpen} label="Lessons" value={sessions.length} tone="teal" />
                  <SummaryStat
                    icon={FileText}
                    label="Family Summaries"
                    value={familySummaryCount}
                    tone="cyan"
                  />
                  <SummaryStat
                    icon={NotebookPen}
                    label="Notebook Notes"
                    value={notebookNotesCount}
                    tone="amber"
                  />
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5" glow="both">
              {sessions.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <BookOpen className="h-6 w-6 text-white/35" />
                  </div>
                  <p className="mt-4 font-medium text-white">No published lessons yet</p>
                  <p className="mt-1 max-w-sm text-sm text-white/55">
                    Lessons will appear here after teachers publish family-facing class summaries.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((row) => (
                    <Link
                      key={row.id}
                      href={`/parent/wards/${wardId}/lesson-sessions/${row.id}`}
                      className={cn(
                        glassInsetClass,
                        "group block p-4 transition-colors hover:border-teal-400/35 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.subjectName ? (
                              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">
                                {row.subjectName}
                              </Badge>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatLessonDate(row.scheduledDate)}
                            </span>
                          </div>
                          <h2 className="text-base font-semibold leading-snug text-white transition-colors group-hover:text-teal-100">
                            {row.title}
                          </h2>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          {row.hasParentSummary ? (
                            <Badge className="border-teal-400/40 bg-teal-500/15 text-teal-100">
                              <FileText className="mr-1 h-3 w-3" />
                              Family summary
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/15 text-white/45">
                              Summary pending
                            </Badge>
                          )}
                          {row.notebookNotesPublished && row.hasNotebookNotes ? (
                            <Badge className="border-amber-400/35 bg-amber-500/15 text-amber-100">
                              <NotebookPen className="mr-1 h-3 w-3" />
                              Notebook notes
                            </Badge>
                          ) : null}
                          <ChevronRight className="h-5 w-5 text-white/30 transition-colors group-hover:text-teal-200" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "teal" | "cyan" | "amber";
}) {
  const toneClass = {
    teal: "border-teal-400/25 bg-teal-500/15 text-teal-200",
    cyan: "border-cyan-400/25 bg-cyan-500/15 text-cyan-200",
    amber: "border-amber-400/25 bg-amber-500/15 text-amber-200",
  }[tone];

  return (
    <div className={cn(glassInsetClass, "flex items-center gap-3 p-4")}>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">{label}</p>
      </div>
    </div>
  );
}

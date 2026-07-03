"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Presentation,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  glassInsetClass,
  glassPanelClass,
  glassPanelTopShineClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type AdminLessonSessionDetailResponse = {
  success: boolean;
  data?: {
    session: {
      id: string;
      title: string;
      status: string;
      scheduledDate: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      sequenceInWeek: number;
      teacher: { id: string; name: string };
      classGroup: { id: string; name: string };
      subject: {
        id: string;
        name: string;
        code: string | null;
        gradeBand: string | null;
        stage: string | null;
      };
      weekPlan: {
        id: string;
        title: string;
        weekLabel: string;
        weekStartDate: string | null;
        weekEndDate: string | null;
        status: string | null;
      } | null;
      visibility: {
        student: string;
        parent: boolean;
        admin: boolean;
        learnTeacherPriority: boolean;
      };
      counts: {
        contentBlocks: number;
        assessmentItems: number;
        boardNotes: number;
      };
      planNotes: string | null;
      contentBlocks: Array<{
        id: string;
        type: string;
        title: string;
        estimatedMinutes: number | null;
        aiGenerated: boolean;
        teacherReviewed: boolean;
      }>;
      assessmentItems: Array<{
        id: string;
        type: string;
        title: string;
        estimatedMinutes: number | null;
        aiGenerated: boolean;
      }>;
      createdAt: string | null;
      updatedAt: string | null;
    };
    deliveries: Array<{
      id: string;
      classGroup: { id: string; name: string };
      status: string;
      scheduledDate: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      scheduledTeacher: { id: string; name: string };
      actualTeacher: { id: string; name: string } | null;
      substituteReason: string | null;
      startedAt: string | null;
      endedAt: string | null;
      completedAt: string | null;
    }>;
  };
  error?: string;
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_STYLES: Record<string, string> = {
  draft: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  ready: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  published: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  archived: "border-white/15 bg-white/5 text-white/60",
  scheduled: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  in_progress: "border-teal-400/30 bg-teal-500/10 text-teal-100",
  delivered: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  cancelled: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? "border-white/15 bg-white/5 text-white/70",
      )}
    >
      {humanize(status)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-500/10 text-teal-100">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold text-white">{value}</p>
          <p className="text-xs text-white/45">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-white/45">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium text-white/80">{value}</span>
    </div>
  );
}

export function AdminLessonSessionDetail({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error, refetch, isFetching } =
    useQuery<AdminLessonSessionDetailResponse>({
      queryKey: ["admin-lesson-session", sessionId],
      queryFn: async () => {
        const res = await fetch(`/api/admin/lesson-sessions/${sessionId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | AdminLessonSessionDetailResponse
          | null;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to load lesson session");
        }
        return json;
      },
      enabled: Boolean(sessionId),
      staleTime: 30_000,
    });

  if (isLoading) {
    return (
      <div className={cn(glassPanelClass, "p-6")}>
        <div className={glassPanelTopShineClass} />
        <div className="flex items-center gap-3 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading lesson session...
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className={cn(glassPanelClass, "p-6 text-center")}>
        <div className={glassPanelTopShineClass} />
        <p className="text-sm text-rose-200">
          {error instanceof Error ? error.message : "Could not load this lesson session."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          className="mt-4 border-white/10 bg-white/5 text-white/70"
        >
          Retry
        </Button>
      </div>
    );
  }

  const { session, deliveries } = data.data;

  return (
    <div className="space-y-6">
      <section className={cn(glassPanelClass, "p-5 sm:p-6")}>
        <div className={glassPanelTopShineClass} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={session.status} />
              <Badge variant="secondary" className="border-white/10 bg-white/5 text-white/60">
                Session {session.sequenceInWeek}
              </Badge>
              {isFetching ? (
                <Badge variant="secondary" className="border-white/10 bg-white/5 text-white/50">
                  Refreshing
                </Badge>
              ) : null}
            </div>
            <h2 className="text-2xl font-semibold tracking-normal text-white">{session.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              {session.subject.name} for {session.classGroup.name}, owned by {session.teacher.name}.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Schedule"
            value={`${formatDate(session.scheduledDate)} - ${session.startTime}-${session.endTime}`}
            icon={CalendarDays}
          />
          <MetricCard label="Duration" value={`${session.durationMinutes} min`} icon={Clock} />
          <MetricCard label="Content blocks" value={session.counts.contentBlocks} icon={BookOpen} />
          <MetricCard
            label="Assessment items"
            value={session.counts.assessmentItems}
            icon={CheckCircle2}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className={cn(glassPanelClass, "p-5 sm:p-6")}>
          <div className={glassPanelTopShineClass} />
          <div className="mb-4 flex items-center gap-2">
            <Presentation className="h-5 w-5 text-teal-200" />
            <h3 className="text-base font-semibold text-white">Delivery tracking</h3>
          </div>

          {deliveries.length === 0 ? (
            <div className={cn(glassInsetClass, "p-5 text-sm text-white/55")}>
              No delivery record has been created for this session yet.
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={delivery.status} />
                        <span className="text-sm font-medium text-white">{delivery.classGroup.name}</span>
                      </div>
                      <p className="mt-2 text-sm text-white/50">
                        {DAY_LABELS[delivery.dayOfWeek] ?? "Day"} - {formatDate(delivery.scheduledDate)} -{" "}
                        {delivery.startTime}-{delivery.endTime}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-white/80">
                        {delivery.actualTeacher?.name ?? delivery.scheduledTeacher.name}
                      </p>
                      <p className="text-xs text-white/40">
                        {delivery.actualTeacher ? "Actual teacher" : "Scheduled teacher"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <DetailRow label="Started" value={formatDateTime(delivery.startedAt)} />
                    <DetailRow label="Ended" value={formatDateTime(delivery.endedAt)} />
                    <DetailRow label="Completed" value={formatDateTime(delivery.completedAt)} />
                  </div>
                  {delivery.substituteReason ? (
                    <p className="mt-3 text-xs text-amber-100/75">
                      Substitute reason: {humanize(delivery.substituteReason)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className={cn(glassPanelClass, "p-5")}>
            <div className={glassPanelTopShineClass} />
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-200" />
              <h3 className="text-base font-semibold text-white">Session details</h3>
            </div>
            <DetailRow label="Teacher" value={session.teacher.name} />
            <DetailRow label="Class" value={session.classGroup.name} />
            <DetailRow label="Subject" value={session.subject.name} />
            <DetailRow label="Subject code" value={session.subject.code ?? "Not set"} />
            <DetailRow label="Day" value={DAY_LABELS[session.dayOfWeek] ?? "Not set"} />
            <DetailRow label="Updated" value={formatDateTime(session.updatedAt)} />
          </section>

          <section className={cn(glassPanelClass, "p-5")}>
            <div className={glassPanelTopShineClass} />
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
              <h3 className="text-base font-semibold text-white">Visibility</h3>
            </div>
            <DetailRow label="Students" value={humanize(session.visibility.student)} />
            <DetailRow label="Parents" value={session.visibility.parent ? "Visible" : "Hidden"} />
            <DetailRow label="Admins" value={session.visibility.admin ? "Visible" : "Hidden"} />
            <DetailRow
              label="Learn priority"
              value={session.visibility.learnTeacherPriority ? "Prioritized" : "Normal"}
            />
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={cn(glassPanelClass, "p-5 sm:p-6")}>
          <div className={glassPanelTopShineClass} />
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-200" />
            <h3 className="text-base font-semibold text-white">Content outline</h3>
          </div>
          {session.planNotes ? (
            <div className={cn(glassInsetClass, "mb-4 p-4")}>
              <p className="text-xs font-medium uppercase tracking-wide text-white/35">Plan notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{session.planNotes}</p>
            </div>
          ) : null}
          {session.contentBlocks.length === 0 ? (
            <div className={cn(glassInsetClass, "p-5 text-sm text-white/55")}>
              No content blocks have been added.
            </div>
          ) : (
            <div className="space-y-3">
              {session.contentBlocks.map((block) => (
                <div key={block.id} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{block.title}</p>
                      <p className="mt-1 text-xs text-white/40">{humanize(block.type)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {block.estimatedMinutes ? (
                        <Badge variant="secondary" className="border-white/10 bg-white/5 text-white/55">
                          {block.estimatedMinutes} min
                        </Badge>
                      ) : null}
                      {block.aiGenerated ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border-white/10 bg-white/5",
                            block.teacherReviewed ? "text-emerald-200" : "text-amber-200",
                          )}
                        >
                          {block.teacherReviewed ? "AI reviewed" : "AI needs review"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={cn(glassPanelClass, "p-5 sm:p-6")}>
          <div className={glassPanelTopShineClass} />
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-200" />
            <h3 className="text-base font-semibold text-white">Assessment outline</h3>
          </div>
          {session.assessmentItems.length === 0 ? (
            <div className={cn(glassInsetClass, "p-5 text-sm text-white/55")}>
              No assessment items have been added.
            </div>
          ) : (
            <div className="space-y-3">
              {session.assessmentItems.map((item) => (
                <div key={item.id} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-white/40">{humanize(item.type)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.estimatedMinutes ? (
                        <Badge variant="secondary" className="border-white/10 bg-white/5 text-white/55">
                          {item.estimatedMinutes} min
                        </Badge>
                      ) : null}
                      {item.aiGenerated ? (
                        <Badge variant="secondary" className="border-white/10 bg-white/5 text-cyan-200">
                          AI drafted
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {session.weekPlan ? (
        <section className={cn(glassPanelClass, "p-5 sm:p-6")}>
          <div className={glassPanelTopShineClass} />
          <div className="mb-4 flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-cyan-200" />
            <h3 className="text-base font-semibold text-white">Week plan context</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailRow label="Plan" value={session.weekPlan.title} />
            <DetailRow label="Week" value={session.weekPlan.weekLabel || "Not labeled"} />
            <DetailRow
              label="Dates"
              value={`${formatDate(session.weekPlan.weekStartDate)} - ${formatDate(
                session.weekPlan.weekEndDate,
              )}`}
            />
            <DetailRow label="Status" value={session.weekPlan.status ? humanize(session.weekPlan.status) : "Not set"} />
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-white/35">
        <UserRound className="h-3.5 w-3.5" />
        Admin view is read-only. Teaching, publishing, and content edits remain in teacher workflows.
      </p>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  BookOpen,
  ClipboardCheck,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  Users,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { useAdminLessonAnalytics } from "@/hooks/admin/useAdminLessonAnalytics";
import { defaultLessonAnalyticsRange } from "@/lib/lessons/analytics-range";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { LessonsV2CoverageSection } from "@/components/lessons/LessonsV2CoverageSection";

function StatTile({
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <div className={cn(glassInsetClass, "p-4 sm:p-5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-24 animate-pulse rounded bg-white/10" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      )}
      {subtitle ? <p className="mt-1 text-xs text-white/50">{subtitle}</p> : null}
    </div>
  );
}

function AnalyticsSection({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ElementType;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-0">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/70">
          <Icon className="h-4 w-4 text-teal-300" />
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/50">{description}</p>
        ) : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </GlassPanel>
  );
}

function RankingPanel({
  title,
  icon: Icon,
  iconClassName,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconClassName?: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-0">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Icon className={cn("h-4 w-4", iconClassName ?? "text-teal-300")} />
          {title}
        </h2>
        <p className="mt-1 text-xs text-white/50">{subtitle}</p>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </GlassPanel>
  );
}

export default function AdminLessonAnalyticsPage() {
  const def = React.useMemo(() => defaultLessonAnalyticsRange(), []);
  const [startDate, setStartDate] = React.useState<Date | null>(def.from);
  const [endDate, setEndDate] = React.useState<Date | null>(def.to);

  const { data, isLoading, isFetching, error, refetch } = useAdminLessonAnalytics(
    startDate,
    endDate,
    true
  );

  const rangeLabel =
    startDate && endDate
      ? `${format(startDate, "d MMM yyyy")} – ${format(endDate, "d MMM yyyy")}`
      : "";

  const maxClass = Math.max(1, ...(data?.classCoverage.map((c) => c.publishedLessonsInRange) ?? []));
  const maxTeacher = Math.max(1, ...(data?.topTeachers.map((t) => t.count) ?? []));
  const maxTaskTeacher = Math.max(
    1,
    ...(data?.lessonTasks.teacherRanking.map((r) => r.linkedTasksCreatedInRange) ?? [])
  );
  const maxTaskClass = Math.max(
    1,
    ...(data?.lessonTasks.classRanking.map((r) => r.linkedTasksCreatedInRange) ?? [])
  );

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        iconName="bar-chart-3"
        title="Lesson analytics"
        subtitle="Delivery metrics for your school — aligned with the lessons module spec."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" asChild className={glassSecondaryButtonClass}>
              <Link href="/admin/lesson-notes">
                <BookOpen className="mr-2 h-4 w-4" />
                Lesson notes
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className={glassSecondaryButtonClass}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      <GlassPanel className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Date range</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          Applies to lesson creation, publish events, reflections, flashcard reviews, student lesson
          activity, and roster-weighted curriculum completion for lessons published in range.
        </p>
        <div className="mt-4">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            startLabel="From"
            endLabel="To"
          />
          {rangeLabel ? (
            <p className="mt-3 text-xs text-white/45">
              Selected window: <span className="text-white/70">{rangeLabel}</span>
            </p>
          ) : null}
        </div>
      </GlassPanel>

      {error ? (
        <GlassPanel className="border-rose-500/30 p-4 text-sm text-rose-100" glow="none">
          {error.message}
        </GlassPanel>
      ) : null}

      <AnalyticsSection title="Lesson activity" icon={Presentation}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Lessons created"
            value={data?.createdInRange.total ?? "—"}
            subtitle="In selected range"
            loading={isLoading}
          />
          <StatTile
            label="Published (events)"
            value={data?.publishedEventsInRange ?? "—"}
            subtitle="First publish / republish in range"
            loading={isLoading}
          />
          <StatTile
            label="Drafts now"
            value={data?.currentDraftsTotal ?? "—"}
            subtitle="All unpublished lessons"
            loading={isLoading}
          />
          <StatTile
            label="Reflections completed"
            value={data?.reflectionsCompletedInRange ?? "—"}
            subtitle="Marked taught in range"
            loading={isLoading}
          />
        </div>
        {isLoading || data ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/20 text-white/70">
              Draft: {isLoading ? "…" : data?.createdInRange.byStatus.draft}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
              Published: {isLoading ? "…" : data?.createdInRange.byStatus.published}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/60">
              Archived: {isLoading ? "…" : data?.createdInRange.byStatus.archived}
            </Badge>
          </div>
        ) : null}
      </AnalyticsSection>

      <AnalyticsSection
        title="Student lesson reads"
        icon={Presentation}
        description="Percentages use the same date window: the session rate is studied events divided by all student–lesson rows with activity; the learner rate is students who marked at least one lesson studied versus students with any lesson activity."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Read engagements"
            value={data?.studentLessons?.engagementsInRange ?? "—"}
            subtitle="Student–lesson rows with activity in range"
            loading={isLoading}
          />
          <StatTile
            label="Learners active"
            value={data?.studentLessons?.distinctStudentsInRange ?? "—"}
            subtitle="Distinct students who opened a lesson"
            loading={isLoading}
          />
          <StatTile
            label="Marked studied"
            value={data?.studentLessons?.completionsInRange ?? "—"}
            subtitle="Completion events in range"
            loading={isLoading}
          />
          <StatTile
            label="Learners completed"
            value={data?.studentLessons?.distinctStudentsCompletedInRange ?? "—"}
            subtitle="Distinct students who marked studied"
            loading={isLoading}
          />
          <StatTile
            label="Session completion"
            value={
              data?.studentLessons?.completionRateAmongEngagementsPercent != null
                ? `${data.studentLessons.completionRateAmongEngagementsPercent}%`
                : "—"
            }
            subtitle="Studied ÷ engagements (in range)"
            loading={isLoading}
          />
          <StatTile
            label="Learner completion"
            value={
              data?.studentLessons?.learnerCompletionRatePercent != null
                ? `${data.studentLessons.learnerCompletionRatePercent}%`
                : "—"
            }
            subtitle="Completers ÷ active learners (in range)"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Curriculum completion"
        icon={GraduationCap}
        description="Lessons that are published with a publish date in the window. Each lesson counts one slot per active student in its class. The coverage percent is studied completions in the window divided by those slots (capped at 100%)."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Published lessons"
            value={data?.curriculumCompletionInRange?.publishedLessonsInRange ?? "—"}
            subtitle="Status published, date in range"
            loading={isLoading}
          />
          <StatTile
            label="Student slots"
            value={data?.curriculumCompletionInRange?.studentSlotsTotal ?? "—"}
            subtitle="Roster sum across those lessons"
            loading={isLoading}
          />
          <StatTile
            label="Studied completions"
            value={data?.curriculumCompletionInRange?.completionsForPublishedLessonsInRange ?? "—"}
            subtitle="Marked studied in range (those lessons)"
            loading={isLoading}
          />
          <StatTile
            label="Coverage"
            value={
              data?.curriculumCompletionInRange?.coveragePercent != null
                ? `${data.curriculumCompletionInRange.coveragePercent}%`
                : "—"
            }
            subtitle="Completions ÷ slots"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection title="Flashcard usage" icon={Layers}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Total cards"
            value={data?.flashcards.totalCards ?? "—"}
            subtitle="In catalogue (school)"
            loading={isLoading}
          />
          <StatTile
            label="Review sessions"
            value={data?.flashcards.reviewSessionsInRange ?? "—"}
            subtitle="Rows with last review in range"
            loading={isLoading}
          />
          <StatTile
            label="Active students"
            value={data?.flashcards.activeStudentsInRange ?? "—"}
            subtitle="Distinct learners reviewing in range"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Lesson task outcomes"
        icon={ClipboardCheck}
        description="Tracks assignments/quizzes linked from lessons for academic-head reporting."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Linked tasks created"
            value={data?.lessonTasks.linkedTasksCreatedInRange ?? "—"}
            subtitle="Created in selected range"
            loading={isLoading}
          />
          <StatTile
            label="Linked tasks published"
            value={data?.lessonTasks.linkedTasksPublishedInRange ?? "—"}
            subtitle="Published in selected range"
            loading={isLoading}
          />
          <StatTile
            label="Quizzes / Assignments"
            value={
              data?.lessonTasks
                ? `${data.lessonTasks.linkedQuizCountInRange} / ${data.lessonTasks.linkedAssignmentCountInRange}`
                : "—"
            }
            subtitle="Quiz count / assignment-like count"
            loading={isLoading}
          />
          <StatTile
            label="Submissions"
            value={data?.lessonTasks.submissionsInRange ?? "—"}
            subtitle="Submitted/late/graded in range"
            loading={isLoading}
          />
          <StatTile
            label="Learners submitted"
            value={data?.lessonTasks.distinctLearnersSubmittedInRange ?? "—"}
            subtitle="Distinct students"
            loading={isLoading}
          />
          <StatTile
            label="Graded submissions"
            value={data?.lessonTasks.gradedSubmissionsInRange ?? "—"}
            subtitle="Graded in range"
            loading={isLoading}
          />
          <StatTile
            label="Avg graded score"
            value={
              data?.lessonTasks.averageScorePercentInRange != null
                ? `${data.lessonTasks.averageScorePercentInRange}%`
                : "—"
            }
            subtitle="Across linked graded submissions"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Collaboration health"
        icon={Users}
        description="Co-teaching and comment-thread indicators for shared lesson workflows."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Shared lessons total"
            value={data?.collaboration.lessonsWithCollaboratorsTotal ?? "—"}
            subtitle="Lessons with at least one collaborator"
            loading={isLoading}
          />
          <StatTile
            label="Shared lessons active"
            value={data?.collaboration.lessonsUpdatedByCollaboratorsInRange ?? "—"}
            subtitle="Shared lessons updated in range"
            loading={isLoading}
          />
          <StatTile
            label="Comments created"
            value={data?.collaboration.commentsCreatedInRange ?? "—"}
            subtitle="Collaboration notes opened in range"
            loading={isLoading}
          />
          <StatTile
            label="Comments resolved"
            value={data?.collaboration.commentsResolvedInRange ?? "—"}
            subtitle="Resolved in range"
            loading={isLoading}
          />
          <StatTile
            label="Open comments now"
            value={data?.collaboration.openCommentsNow ?? "—"}
            subtitle="Current unresolved notes"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingPanel
          title="Teacher activity"
          icon={Users}
          iconClassName="text-sky-300"
          subtitle="Lessons created in range (top 15)."
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : !data?.topTeachers.length ? (
            <p className="py-6 text-center text-sm text-white/45">No data for this range.</p>
          ) : (
            <ul className="space-y-3">
              {data.topTeachers.map((t) => (
                <li
                  key={t.teacherId}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,1fr)_2.5rem] sm:gap-3"
                >
                  <span className="truncate text-sm text-white/90">{t.name}</span>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-500/60"
                      style={{ width: `${Math.min(100, (t.count / maxTeacher) * 100)}%` }}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-white/80 sm:pt-0">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RankingPanel>

        <RankingPanel
          title="Class coverage"
          icon={ClipboardCheck}
          iconClassName="text-emerald-300"
          subtitle="Published lessons per class (publish date in range)."
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : !data?.classCoverage.length ? (
            <p className="py-6 text-center text-sm text-white/45">No published lessons in range.</p>
          ) : (
            <ul className="space-y-3">
              {data.classCoverage.map((c) => (
                <li
                  key={c.classGroupId}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,1fr)_2.5rem] sm:gap-3"
                >
                  <span className="truncate text-sm text-white/90">{c.label}</span>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500/60"
                      style={{
                        width: `${Math.min(100, (c.publishedLessonsInRange / maxClass) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-white/80">
                    {c.publishedLessonsInRange}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RankingPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RankingPanel
          title="Teacher task ranking"
          icon={Users}
          iconClassName="text-sky-300"
          subtitle="By linked lesson tasks created in range."
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : !data?.lessonTasks.teacherRanking.length ? (
            <p className="py-6 text-center text-sm text-white/45">No linked task data in range.</p>
          ) : (
            <ul className="space-y-3">
              {data.lessonTasks.teacherRanking.map((row) => (
                <li
                  key={row.teacherId}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,1fr)_3rem] sm:gap-3"
                >
                  <div>
                    <p className="truncate text-sm text-white/90">{row.name}</p>
                    <p className="text-xs text-white/45">
                      {row.submissionsInRange} submissions · {row.gradedSubmissionsInRange} graded
                      {row.averageScorePercentInRange != null
                        ? ` · ${row.averageScorePercentInRange}% avg`
                        : ""}
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-500/60"
                      style={{
                        width: `${Math.min(100, (row.linkedTasksCreatedInRange / maxTaskTeacher) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-white/80">
                    {row.linkedTasksCreatedInRange}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RankingPanel>

        <RankingPanel
          title="Class task ranking"
          icon={ClipboardCheck}
          iconClassName="text-emerald-300"
          subtitle="Classes receiving the most linked lesson tasks in range."
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : !data?.lessonTasks.classRanking.length ? (
            <p className="py-6 text-center text-sm text-white/45">No linked task data in range.</p>
          ) : (
            <ul className="space-y-3">
              {data.lessonTasks.classRanking.map((row) => (
                <li
                  key={row.classGroupId}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,1fr)_3rem] sm:gap-3"
                >
                  <div>
                    <p className="truncate text-sm text-white/90">{row.label}</p>
                    <p className="text-xs text-white/45">{row.submissionsInRange} submissions</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500/60"
                      style={{
                        width: `${Math.min(100, (row.linkedTasksCreatedInRange / maxTaskClass) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-white/80">
                    {row.linkedTasksCreatedInRange}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RankingPanel>

        <RankingPanel
          title="Collaboration hotspots"
          icon={BookOpen}
          iconClassName="text-amber-300"
          subtitle="Lessons with most unresolved collaboration notes."
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : !data?.collaboration.hotspots.length ? (
            <p className="py-6 text-center text-sm text-white/45">No open collaboration notes.</p>
          ) : (
            <ul className="space-y-3">
              {data.collaboration.hotspots.map((row) => (
                <li
                  key={row.lessonId}
                  className={cn(
                    glassInsetClass,
                    "flex items-center justify-between gap-3 px-3 py-2"
                  )}
                >
                  <span className="line-clamp-2 text-sm text-white/85">{row.lessonTitle}</span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-200">
                    {row.openCommentsNow} open
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </RankingPanel>
      </div>

      <LessonsV2CoverageSection v2Coverage={data?.v2Coverage} loading={isLoading} />
    </WorkspacePageShell>
  );
}

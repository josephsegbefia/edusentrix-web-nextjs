"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  Users,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import { useAdminLessonAnalytics } from "@/hooks/admin/useAdminLessonAnalytics";
import { defaultLessonAnalyticsRange } from "@/lib/lessons/analytics-range";
import { cn } from "@/lib/utils";

function StatCard({
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
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
        {loading ? (
          <div className="mt-2 h-9 w-24 animate-pulse rounded bg-white/10" />
        ) : (
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        )}
        {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
      </CardContent>
    </Card>
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
    <div className="space-y-8 p-6 text-white md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lesson analytics</h1>
            <p className="text-sm text-white/55">
              Delivery metrics for your school — aligned with the lessons module spec.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
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
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-white">Date range</CardTitle>
          <p className="text-xs text-white/50">
            Applies to lesson creation, publish events, reflections, flashcard reviews, student
            lesson activity, and roster-weighted curriculum completion for lessons published in range.
          </p>
        </CardHeader>
        <CardContent>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            startLabel="From"
            endLabel="To"
          />
          {rangeLabel && (
            <p className="mt-3 text-xs text-white/45">
              Selected window: <span className="text-white/70">{rangeLabel}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-100">{error.message}</CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Presentation className="h-4 w-4" />
          Lesson activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Lessons created"
            value={data?.createdInRange.total ?? "—"}
            subtitle="In selected range"
            loading={isLoading}
          />
          <StatCard
            label="Published (events)"
            value={data?.publishedEventsInRange ?? "—"}
            subtitle="First publish / republish in range"
            loading={isLoading}
          />
          <StatCard
            label="Drafts now"
            value={data?.currentDraftsTotal ?? "—"}
            subtitle="All unpublished lessons"
            loading={isLoading}
          />
          <StatCard
            label="Reflections completed"
            value={data?.reflectionsCompletedInRange ?? "—"}
            subtitle="Marked taught in range"
            loading={isLoading}
          />
        </div>
        {(isLoading || data) && (
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
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Presentation className="h-4 w-4" />
          Student lesson reads
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Percentages use the same date window: the session rate is studied events divided by all
          student–lesson rows with activity; the learner rate is students who marked at least one
          lesson studied versus students with any lesson activity.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Read engagements"
            value={data?.studentLessons?.engagementsInRange ?? "—"}
            subtitle="Student–lesson rows with activity in range"
            loading={isLoading}
          />
          <StatCard
            label="Learners active"
            value={data?.studentLessons?.distinctStudentsInRange ?? "—"}
            subtitle="Distinct students who opened a lesson"
            loading={isLoading}
          />
          <StatCard
            label="Marked studied"
            value={data?.studentLessons?.completionsInRange ?? "—"}
            subtitle="Completion events in range"
            loading={isLoading}
          />
          <StatCard
            label="Learners completed"
            value={data?.studentLessons?.distinctStudentsCompletedInRange ?? "—"}
            subtitle="Distinct students who marked studied"
            loading={isLoading}
          />
          <StatCard
            label="Session completion"
            value={
              data?.studentLessons?.completionRateAmongEngagementsPercent != null
                ? `${data.studentLessons.completionRateAmongEngagementsPercent}%`
                : "—"
            }
            subtitle="Studied ÷ engagements (in range)"
            loading={isLoading}
          />
          <StatCard
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
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <GraduationCap className="h-4 w-4" />
          Curriculum completion
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Lessons that are <span className="text-white/70">published</span> with a publish date in
          the window. Each lesson counts one slot per active student in its class. The coverage
          percent is studied completions in the window divided by those slots (capped at 100%).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Published lessons"
            value={data?.curriculumCompletionInRange?.publishedLessonsInRange ?? "—"}
            subtitle="Status published, date in range"
            loading={isLoading}
          />
          <StatCard
            label="Student slots"
            value={data?.curriculumCompletionInRange?.studentSlotsTotal ?? "—"}
            subtitle="Roster sum across those lessons"
            loading={isLoading}
          />
          <StatCard
            label="Studied completions"
            value={data?.curriculumCompletionInRange?.completionsForPublishedLessonsInRange ?? "—"}
            subtitle="Marked studied in range (those lessons)"
            loading={isLoading}
          />
          <StatCard
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
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Layers className="h-4 w-4" />
          Flashcard usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total cards"
            value={data?.flashcards.totalCards ?? "—"}
            subtitle="In catalogue (school)"
            loading={isLoading}
          />
          <StatCard
            label="Review sessions"
            value={data?.flashcards.reviewSessionsInRange ?? "—"}
            subtitle="Rows with last review in range"
            loading={isLoading}
          />
          <StatCard
            label="Active students"
            value={data?.flashcards.activeStudentsInRange ?? "—"}
            subtitle="Distinct learners reviewing in range"
            loading={isLoading}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <ClipboardCheck className="h-4 w-4" />
          Lesson task outcomes
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Tracks assignments/quizzes linked from lessons for academic-head reporting.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Linked tasks created"
            value={data?.lessonTasks.linkedTasksCreatedInRange ?? "—"}
            subtitle="Created in selected range"
            loading={isLoading}
          />
          <StatCard
            label="Linked tasks published"
            value={data?.lessonTasks.linkedTasksPublishedInRange ?? "—"}
            subtitle="Published in selected range"
            loading={isLoading}
          />
          <StatCard
            label="Quizzes / Assignments"
            value={
              data?.lessonTasks
                ? `${data.lessonTasks.linkedQuizCountInRange} / ${data.lessonTasks.linkedAssignmentCountInRange}`
                : "—"
            }
            subtitle="Quiz count / assignment-like count"
            loading={isLoading}
          />
          <StatCard
            label="Submissions"
            value={data?.lessonTasks.submissionsInRange ?? "—"}
            subtitle="Submitted/late/graded in range"
            loading={isLoading}
          />
          <StatCard
            label="Learners submitted"
            value={data?.lessonTasks.distinctLearnersSubmittedInRange ?? "—"}
            subtitle="Distinct students"
            loading={isLoading}
          />
          <StatCard
            label="Graded submissions"
            value={data?.lessonTasks.gradedSubmissionsInRange ?? "—"}
            subtitle="Graded in range"
            loading={isLoading}
          />
          <StatCard
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
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Users className="h-4 w-4" />
          Collaboration health
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Co-teaching and comment-thread indicators for shared lesson workflows.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Shared lessons total"
            value={data?.collaboration.lessonsWithCollaboratorsTotal ?? "—"}
            subtitle="Lessons with at least one collaborator"
            loading={isLoading}
          />
          <StatCard
            label="Shared lessons active"
            value={data?.collaboration.lessonsUpdatedByCollaboratorsInRange ?? "—"}
            subtitle="Shared lessons updated in range"
            loading={isLoading}
          />
          <StatCard
            label="Comments created"
            value={data?.collaboration.commentsCreatedInRange ?? "—"}
            subtitle="Collaboration notes opened in range"
            loading={isLoading}
          />
          <StatCard
            label="Comments resolved"
            value={data?.collaboration.commentsResolvedInRange ?? "—"}
            subtitle="Resolved in range"
            loading={isLoading}
          />
          <StatCard
            label="Open comments now"
            value={data?.collaboration.openCommentsNow ?? "—"}
            subtitle="Current unresolved notes"
            loading={isLoading}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Users className="h-4 w-4 text-sky-300" />
              Teacher activity
            </CardTitle>
            <p className="text-xs text-white/50">Lessons created in range (top 15).</p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <ClipboardCheck className="h-4 w-4 text-emerald-300" />
              Class coverage
            </CardTitle>
            <p className="text-xs text-white/50">
              Published lessons per class (publish date in range).
            </p>
          </CardHeader>
          <CardContent>
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
                    <span className="text-right text-sm tabular-nums text-white/80">{c.publishedLessonsInRange}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Users className="h-4 w-4 text-sky-300" />
              Teacher task ranking
            </CardTitle>
            <p className="text-xs text-white/50">By linked lesson tasks created in range.</p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <ClipboardCheck className="h-4 w-4 text-emerald-300" />
              Class task ranking
            </CardTitle>
            <p className="text-xs text-white/50">Classes receiving the most linked lesson tasks in range.</p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <BookOpen className="h-4 w-4 text-amber-300" />
              Collaboration hotspots
            </CardTitle>
            <p className="text-xs text-white/50">Lessons with most unresolved collaboration notes.</p>
          </CardHeader>
          <CardContent>
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
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span className="line-clamp-2 text-sm text-white/85">{row.lessonTitle}</span>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-200">
                      {row.openCommentsNow} open
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

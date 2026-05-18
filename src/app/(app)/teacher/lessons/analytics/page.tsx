"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherLessonAnalytics } from "@/hooks/teacher/useTeacherLessonAnalytics";
import { defaultLessonAnalyticsRange } from "@/lib/lessons/analytics-range";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { LessonsV2CoverageSection } from "@/components/lessons/LessonsV2CoverageSection";

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

export default function TeacherLessonAnalyticsPage() {
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);

  const def = React.useMemo(() => defaultLessonAnalyticsRange(), []);
  const [startDate, setStartDate] = React.useState<Date | null>(def.from);
  const [endDate, setEndDate] = React.useState<Date | null>(def.to);

  const { data, isLoading, isFetching, error, refetch } = useTeacherLessonAnalytics(
    startDate,
    endDate,
    canView
  );

  const rangeLabel =
    startDate && endDate
      ? `${format(startDate, "d MMM yyyy")} – ${format(endDate, "d MMM yyyy")}`
      : "";

  if (!canView) {
    return (
      <div className="space-y-6 p-6 text-white md:p-8">
        <div>
          <h1 className="text-2xl font-semibold">Lesson analytics</h1>
          <p className="text-sm text-white/60">Analytics are unavailable without journal access.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-6 text-sm text-white/60">
            Ask an admin to grant journal permissions to view lessons and engagement.
          </CardContent>
        </Card>
      </div>
    );
  }

  const my = data?.myLessons;
  const quickCoverage =
    data?.curriculumCompletionInRange?.coveragePercent != null
      ? `${data.curriculumCompletionInRange.coveragePercent}%`
      : "—";
  const quickSessionCompletion =
    data?.studentLessons?.completionRateAmongEngagementsPercent != null
      ? `${data.studentLessons.completionRateAmongEngagementsPercent}%`
      : "—";
  const quickLinkedSubmissions = data?.lessonTasks?.submissionsInRange ?? "—";
  const quickFlashcardActive = data?.flashcards?.activeStudentsInRange ?? "—";

  return (
    <div className="space-y-8 p-6 text-white md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lesson analytics</h1>
            <p className="text-sm text-white/55">Your lessons, student reads, flashcards, and reflections.</p>
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
            <Link href="/teacher/lessons">
              <Presentation className="mr-2 h-4 w-4" />
              My lessons
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/teacher/lesson-notes">
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
            Applies to activity on <span className="text-white/70">your</span> lessons, roster-weighted
            coverage for your publishes in range, and reflections you completed.
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
          <BarChart3 className="h-4 w-4" />
          Snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Coverage now"
            value={quickCoverage}
            subtitle="Curriculum coverage in range"
            loading={isLoading}
          />
          <StatCard
            label="Session completion"
            value={quickSessionCompletion}
            subtitle="Studied ÷ lesson engagements"
            loading={isLoading}
          />
          <StatCard
            label="Linked submissions"
            value={quickLinkedSubmissions}
            subtitle="Assignments/quizzes from lessons"
            loading={isLoading}
          />
          <StatCard
            label="Flashcard learners"
            value={quickFlashcardActive}
            subtitle="Active reviewers in range"
            loading={isLoading}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Presentation className="h-4 w-4" />
          My lesson activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Lessons created"
            value={my?.createdInRange ?? "—"}
            subtitle="In selected range"
            loading={isLoading}
          />
          <StatCard
            label="Published (events)"
            value={my?.publishedEventsInRange ?? "—"}
            subtitle="Publish date in range"
            loading={isLoading}
          />
          <StatCard
            label="Drafts pending"
            value={my?.draftsPending ?? "—"}
            subtitle="Unpublished now"
            loading={isLoading}
          />
          <StatCard
            label="Reflections done"
            value={my?.reflectionsCompletedInRange ?? "—"}
            subtitle="Marked taught in range"
            loading={isLoading}
          />
        </div>
        {(isLoading || data) && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/20 text-white/70">
              Created draft: {isLoading ? "…" : my?.createdInRangeByStatus.draft}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
              Created published: {isLoading ? "…" : my?.createdInRangeByStatus.published}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/60">
              Created archived: {isLoading ? "…" : my?.createdInRangeByStatus.archived}
            </Badge>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <Presentation className="h-4 w-4" />
          Student lesson reads (my classes)
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Counts only students engaging with <span className="text-white/70">your</span> published
          lessons. Session and learner completion rates match the admin definitions.
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
            subtitle="Distinct students on your lessons"
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
          Curriculum completion (your publishes)
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Same definition as school admin, limited to lessons you teach. Published in range, one
          slot per active student in the lesson class; coverage is studied completions in range ÷
          slots.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Published lessons"
            value={data?.curriculumCompletionInRange?.publishedLessonsInRange ?? "—"}
            subtitle="Yours, published, date in range"
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
            subtitle="Marked studied in range"
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
          Flashcards (my decks)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total cards"
            value={data?.flashcards.totalCards ?? "—"}
            subtitle="Across your lesson decks"
            loading={isLoading}
          />
          <StatCard
            label="Review sessions"
            value={data?.flashcards.reviewSessionsInRange ?? "—"}
            subtitle="Progress rows with last review in range"
            loading={isLoading}
          />
          <StatCard
            label="Active students"
            value={data?.flashcards.activeStudentsInRange ?? "—"}
            subtitle="Distinct learners reviewing your decks"
            loading={isLoading}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <BookOpen className="h-4 w-4" />
          Lesson tasks (assignments & quizzes)
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Includes only tasks linked to your lessons via lesson-to-task creation flow.
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
            subtitle="Published date in range"
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
            subtitle="Status graded in range"
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

      <LessonsV2CoverageSection v2Coverage={data?.v2Coverage} loading={isLoading} />

      {isLoading && !data && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      )}
    </div>
  );
}

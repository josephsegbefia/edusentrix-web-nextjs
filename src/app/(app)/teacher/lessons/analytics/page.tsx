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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherLessonAnalytics } from "@/hooks/teacher/useTeacherLessonAnalytics";
import { defaultLessonAnalyticsRange } from "@/lib/lessons/analytics-range";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
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
        <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/10" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
      )}
      {subtitle ? <p className="mt-1 text-xs leading-relaxed text-white/50">{subtitle}</p> : null}
    </div>
  );
}

function AnalyticsSection({
  title,
  icon: Icon,
  description,
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-0" glow="both">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/70">
          <Icon className="h-4 w-4 text-teal-300" />
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/50">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {children}
        {footer}
      </div>
    </GlassPanel>
  );
}

function headerActions({
  isFetching,
  onRefresh,
}: {
  isFetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        asChild
        className={cn("rounded-xl", glassSecondaryButtonClass)}
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
        onClick={onRefresh}
        disabled={isFetching}
        className={cn("rounded-xl", glassSecondaryButtonClass)}
      >
        <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
        Refresh
      </Button>
    </>
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
    canView,
  );

  const rangeLabel =
    startDate && endDate
      ? `${format(startDate, "d MMM yyyy")} – ${format(endDate, "d MMM yyyy")}`
      : "";

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          backHref="/teacher/lessons"
          backLabel="My lessons"
          icon={BarChart3}
          title="Lesson analytics"
          subtitle="Analytics are unavailable without journal access."
        />
        <GlassPanel className="p-6">
          <p className="text-sm text-white/60">
            Ask an admin to grant journal permissions to view lessons and engagement.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
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
    <WorkspacePageShell>
      <WorkspacePageHeader
        backHref="/teacher/lessons"
        backLabel="My lessons"
        icon={BarChart3}
        title="Lesson analytics"
        subtitle="Your lessons, student reads, flashcards, and reflections — scoped to the date range below."
        badge={
          rangeLabel ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {rangeLabel}
            </span>
          ) : undefined
        }
        actions={headerActions({ isFetching, onRefresh: () => void refetch() })}
      />

      <GlassPanel className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white/90">Date range</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Applies to activity on <span className="text-white/70">your</span> lessons,
            roster-weighted coverage for your publishes in range, and reflections you completed.
          </p>
        </div>
        <div className={cn(glassInsetClass, "p-4")}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            startLabel="From"
            endLabel="To"
          />
        </div>
      </GlassPanel>

      {error ? (
        <GlassPanel className="border-rose-500/30 bg-rose-500/10 p-4" glow="none">
          <p className="text-sm text-rose-100">{error.message}</p>
        </GlassPanel>
      ) : null}

      <AnalyticsSection title="Snapshot" icon={BarChart3}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Coverage now"
            value={quickCoverage}
            subtitle="Curriculum coverage in range"
            loading={isLoading}
          />
          <StatTile
            label="Session completion"
            value={quickSessionCompletion}
            subtitle="Studied ÷ lesson engagements"
            loading={isLoading}
          />
          <StatTile
            label="Linked submissions"
            value={quickLinkedSubmissions}
            subtitle="Assignments/quizzes from lessons"
            loading={isLoading}
          />
          <StatTile
            label="Flashcard learners"
            value={quickFlashcardActive}
            subtitle="Active reviewers in range"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="My lesson activity"
        icon={Presentation}
        footer={
          isLoading || data ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <Badge className="border-0 bg-white/10 text-white/70">
                Created draft: {isLoading ? "…" : my?.createdInRangeByStatus.draft}
              </Badge>
              <Badge className="border-0 bg-emerald-500/20 text-emerald-100">
                Created published: {isLoading ? "…" : my?.createdInRangeByStatus.published}
              </Badge>
              <Badge className="border-0 bg-white/10 text-white/55">
                Created archived: {isLoading ? "…" : my?.createdInRangeByStatus.archived}
              </Badge>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Lessons created"
            value={my?.createdInRange ?? "—"}
            subtitle="In selected range"
            loading={isLoading}
          />
          <StatTile
            label="Published (events)"
            value={my?.publishedEventsInRange ?? "—"}
            subtitle="Publish date in range"
            loading={isLoading}
          />
          <StatTile
            label="Drafts pending"
            value={my?.draftsPending ?? "—"}
            subtitle="Unpublished now"
            loading={isLoading}
          />
          <StatTile
            label="Reflections done"
            value={my?.reflectionsCompletedInRange ?? "—"}
            subtitle="Marked taught in range"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Student lesson reads"
        icon={Presentation}
        description="Counts only students engaging with your published lessons. Session and learner completion rates match the admin definitions."
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
            subtitle="Distinct students on your lessons"
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
        description="Same definition as school admin, limited to lessons you teach. Published in range, one slot per active student in the lesson class; coverage is studied completions in range ÷ slots."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Published lessons"
            value={data?.curriculumCompletionInRange?.publishedLessonsInRange ?? "—"}
            subtitle="Yours, published, date in range"
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
            subtitle="Marked studied in range"
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

      <AnalyticsSection title="Flashcards" icon={Layers} description="Your lesson flashcard decks and student review activity in range.">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Total cards"
            value={data?.flashcards.totalCards ?? "—"}
            subtitle="Across your lesson decks"
            loading={isLoading}
          />
          <StatTile
            label="Review sessions"
            value={data?.flashcards.reviewSessionsInRange ?? "—"}
            subtitle="Progress rows with last review in range"
            loading={isLoading}
          />
          <StatTile
            label="Active students"
            value={data?.flashcards.activeStudentsInRange ?? "—"}
            subtitle="Distinct learners reviewing your decks"
            loading={isLoading}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Lesson tasks"
        icon={BookOpen}
        description="Includes only tasks linked to your lessons via the lesson-to-task creation flow."
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
            subtitle="Published date in range"
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
            subtitle="Status graded in range"
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

      <LessonsV2CoverageSection v2Coverage={data?.v2Coverage} loading={isLoading} />

      {isLoading && !data ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-teal-300/40" />
        </div>
      ) : null}
    </WorkspacePageShell>
  );
}

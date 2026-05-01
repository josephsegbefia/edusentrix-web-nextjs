"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import { Presentation, BookOpen, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentLessons } from "@/hooks/student/useStudentLessons";

export default function StudentLessonsPage() {
  const {
    data,
    isPending,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useStudentLessons();

  const lessons = data?.pages.flatMap((p) => p.data.lessons) ?? [];
  const progress = data?.pages[0]?.data.progress;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Lessons</h1>
          <p className="mt-1 text-sm text-slate-400">
            Published lessons from your teachers for your class
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="border-slate-600/60 bg-slate-900/40 text-slate-200"
        >
          Refresh
        </Button>
      </div>

      {!isPending && progress && progress.publishedLessonsTotal > 0 && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <Card className="border border-violet-500/25 bg-violet-500/5">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-300/80">Your progress</p>
              <p className="mt-1 text-sm text-slate-300">
                You&apos;ve marked{" "}
                <span className="font-semibold text-white">{progress.studiedLessonsCount}</span> of{" "}
                <span className="font-semibold text-white">{progress.publishedLessonsTotal}</span>{" "}
                published lessons as studied
                {progress.studiedPercent != null && (
                  <span className="text-slate-400"> ({progress.studiedPercent}%)</span>
                )}
                .
              </p>
              {lessons.length < progress.publishedLessonsTotal && (
                <p className="mt-1 text-xs text-slate-500">
                  Loaded {lessons.length} of {progress.publishedLessonsTotal} lessons.
                  {hasNextPage ? " Tap “Load more” below for the rest." : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {progress.revision && (
            <Card className="border border-cyan-500/25 bg-cyan-500/5">
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-cyan-300/80">
                  Revision analytics
                </p>
                <p className="text-sm text-slate-300">
                  Streak:{" "}
                  <span className="font-semibold text-white">
                    {progress.revision.recentCompletionStreakDays}
                  </span>{" "}
                  day{progress.revision.recentCompletionStreakDays === 1 ? "" : "s"} ·{" "}
                  <span className="font-semibold text-white">
                    {progress.revision.completedLessonsInLast7Days}
                  </span>{" "}
                  lessons completed in the last 7 days
                </p>
                <p className="text-xs text-slate-400">
                  Flashcards:{" "}
                  <span className="text-white">
                    {progress.revision.flashcardsKnownCount} known
                  </span>
                  ,{" "}
                  <span className="text-amber-200">
                    {progress.revision.flashcardsNeedsReviewCount} need review
                  </span>
                  ,{" "}
                  <span className="text-slate-300">
                    {progress.revision.flashcardsTrackedTotal} tracked
                  </span>
                  {" "}({progress.revision.reviewEventsTotal} review events).
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {error && (
        <Card className="mb-6 border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-100">
            {error.message}
          </CardContent>
        </Card>
      )}

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl bg-slate-800/80" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Card className="border border-slate-700/80 bg-slate-900/40">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-600/50 bg-slate-800/60">
              <Presentation className="h-7 w-7 text-slate-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">No lessons yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              When your teachers publish a lesson for your class, it will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lessons.map((lesson) => (
            <Link key={lesson.id} href={`/student/lessons/${lesson.id}`}>
              <Card className="h-full border border-slate-700/80 bg-slate-900/40 transition-colors hover:border-violet-500/40 hover:bg-slate-900/70">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      >
                        Published
                      </Badge>
                      {lesson.studied && (
                        <Badge
                          variant="outline"
                          className="border-sky-500/35 bg-sky-500/10 text-sky-200"
                        >
                          Studied
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="mt-2 line-clamp-2 text-lg text-white">
                    {lesson.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-400">
                  {lesson.subjectName && <p>Subject · {lesson.subjectName}</p>}
                  {lesson.scheduledAt && (
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      {format(new Date(lesson.scheduledAt), "EEE, d MMM yyyy")}
                    </p>
                  )}
                  {lesson.publishedAt && (
                    <p className="text-xs text-slate-500">
                      Posted {format(new Date(lesson.publishedAt), "d MMM yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && lessons.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="border-slate-600/60 bg-slate-900/40 text-slate-200"
          >
            {isFetchingNextPage ? "Loading…" : "Load more lessons"}
          </Button>
        </div>
      )}
    </div>
  );
}

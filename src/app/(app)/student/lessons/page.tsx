"use client";

import * as React from "react";
import Link from "next/link";
import { Presentation, BookOpen, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentLessonSessions } from "@/hooks/student/useStudentLessonSessions";

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
  } = useStudentLessonSessions();

  const sessions = data?.pages.flatMap((p) => p.data.sessions) ?? [];
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

      {!isPending && progress && progress.total > 0 && (
        <div className="mb-6">
          <Card className="border border-violet-500/25 bg-violet-500/5">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-300/80">
                Your progress
              </p>
              <p className="mt-1 text-sm text-slate-300">
                You&apos;ve marked{" "}
                <span className="font-semibold text-white">{progress.studiedCount}</span> of{" "}
                <span className="font-semibold text-white">{progress.total}</span> lessons as
                studied
                {progress.studiedPercent != null && (
                  <span className="text-slate-400"> ({progress.studiedPercent}%)</span>
                )}
                .
              </p>
              {sessions.length < progress.total && (
                <p className="mt-1 text-xs text-slate-500">
                  Loaded {sessions.length} of {progress.total} lessons.
                  {hasNextPage ? " Tap \u201cLoad more\u201d below for the rest." : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <Card className="mb-6 border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-100">
            {error instanceof Error ? error.message : "Failed to load lessons"}
          </CardContent>
        </Card>
      )}

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl bg-slate-800/80" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
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
          {sessions.map((session) => (
            <Link key={session.id} href={`/student/lessons/${session.id}`}>
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
                      {session.studied && (
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
                    {session.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-400">
                  {session.subjectName && <p>Subject · {session.subjectName}</p>}
                  {session.scheduledDate && (
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      {new Date(`${session.scheduledDate}T00:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "short", day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && sessions.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="border-slate-600/60 bg-slate-900/40 text-slate-200"
          >
            {isFetchingNextPage ? "Loading\u2026" : "Load more lessons"}
          </Button>
        </div>
      )}
    </div>
  );
}

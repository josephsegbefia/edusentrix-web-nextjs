"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessonWeekNotebookSummary } from "@/hooks/teacher/useLessonWeekNotebookSummary";
import { cn } from "@/lib/utils";

type Props = {
  weekPlanId: string;
};

export function LessonWeekNotebookSummaryView({ weekPlanId }: Props) {
  const { data, isLoading, error } = useLessonWeekNotebookSummary(weekPlanId);
  const payload = data?.data;

  if (error) {
    return (
      <Card className="border border-rose-500/30 bg-rose-500/10">
        <CardContent className="p-5 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Failed to load notebook summary"}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !payload) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl bg-white/5" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  const { weekPlan, sessions, summary } = payload;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Week notebook summary</h1>
          <p className="mt-1 text-sm text-white/60">
            {weekPlan.title} · {weekPlan.weekLabel} ({weekPlan.weekStartDate} – {weekPlan.weekEndDate})
          </p>
          {weekPlan.lessonNoteTopic ? (
            <p className="mt-1 text-xs text-white/45">{weekPlan.lessonNoteTopic}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          asChild
          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        >
          <Link href="/teacher/lessons">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to lessons
          </Link>
        </Button>
      </div>

      <Card className="border border-teal-400/20 bg-teal-500/8">
        <CardContent className="flex flex-wrap gap-4 p-4 text-sm text-white/75">
          <span>
            <strong className="text-white">{summary.withNotes}</strong>/{summary.total} sessions
            have notebook notes
          </span>
          <span>
            <strong className="text-white">{summary.sharedWithStudents}</strong> shared with students
          </span>
          <span>
            <strong className="text-white">{summary.taught}</strong> taught so far
          </span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sessions.map((session) => (
          <Card
            key={session.id}
            className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl"
          >
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base text-white">
                  Session {session.sequenceInWeek}: {session.title}
                </CardTitle>
                <p className="mt-1 text-xs text-white/50">
                  {session.scheduledDate} · {session.startTime}–{session.endTime}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session.notebookNotesPublished ? (
                  <Badge className="border-0 bg-teal-500/20 text-teal-100">Shared</Badge>
                ) : session.hasNotebookNotes ? (
                  <Badge className="border-0 bg-white/10 text-white/60">Draft</Badge>
                ) : (
                  <Badge className="border-0 bg-amber-500/15 text-amber-100">No notes yet</Badge>
                )}
                {session.deliveryStatus ? (
                  <Badge className="border-0 bg-white/10 text-white/55 capitalize">
                    {session.deliveryStatus.replace("_", " ")}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  asChild
                  className="border-white/10 bg-white/5 text-xs text-white/70"
                >
                  <Link href={`/teacher/lessons/sessions/${session.id}`}>
                    Open session
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {session.notebookNotesHtml ? (
                <div
                  className={cn(
                    "prose prose-invert max-w-none rounded-xl border border-white/10 bg-black/20 p-4",
                    "prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white/90",
                    "prose-p:text-sm prose-p:text-white/75 prose-li:text-sm prose-li:text-white/75",
                  )}
                  dangerouslySetInnerHTML={{ __html: session.notebookNotesHtml }}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/3 px-4 py-8 text-sm text-white/45">
                  <NotebookPen className="h-5 w-5 shrink-0 text-white/25" />
                  Generate notebook notes on the session page or in teach mode.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

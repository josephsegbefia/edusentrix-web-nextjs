"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Presentation } from "lucide-react";
import { format } from "date-fns/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LessonNoteReadonlyView } from "@/components/lesson-notes/LessonNoteReadonlyView";
import { StudentLessonResourcesList } from "@/components/lessons/StudentLessonResourcesList";
import { StudentLessonFlashcardsStudy } from "@/components/lessons/StudentLessonFlashcardsStudy";
import { useStudentLesson } from "@/hooks/student/useStudentLesson";
import { useStudentLessonComplete } from "@/hooks/student/useStudentLessonComplete";
import { useBusyToast } from "@/hooks/useBusyToast";

export default function StudentLessonDetailPage() {
  const params = useParams<{ id: string }>();
  const lessonId = typeof params?.id === "string" ? params.id : null;
  const busyToast = useBusyToast();
  const { data, isLoading, error } = useStudentLesson(lessonId);
  const completeMut = useStudentLessonComplete(lessonId);

  const payload = data?.data;

  React.useEffect(() => {
    if (!lessonId || !payload) return;
    void fetch(`/api/student/lessons/${lessonId}/view`, { method: "POST" }).catch(() => {
      /* non-blocking */
    });
  }, [lessonId, payload]);

  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-5 text-sm text-rose-100">
            {error.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !payload) {
    return (
      <div className="min-h-screen space-y-4 p-6 md:p-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
          />
        ))}
      </div>
    );
  }

  const { lesson, displayNote, progress } = payload;
  const isCompleted = progress?.completionStatus === "completed";

  const markComplete = () => {
    if (!lessonId || isCompleted) return;
    void busyToast.promise(completeMut.mutateAsync(), {
      loading: "Saving…",
      success: "Marked as studied",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/student/lessons">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-600/60 bg-slate-900/40 text-slate-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            All lessons
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isCompleted && (
            <Badge
              variant="outline"
              className="border-sky-500/35 bg-sky-500/15 text-sky-200"
            >
              You marked this as studied
            </Badge>
          )}
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            Published for your class
          </Badge>
          {lesson.scheduledAt && (
            <span className="text-xs text-slate-500">
              Scheduled {format(new Date(lesson.scheduledAt), "d MMM yyyy")}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-slate-400">
        <Presentation className="h-5 w-5 text-violet-400" />
        <span className="text-sm">Read-only lesson content</span>
      </div>

      <LessonNoteReadonlyView note={displayNote} />

      <div className="mt-8 space-y-8">
        <StudentLessonResourcesList lessonId={lesson.id} />
        <StudentLessonFlashcardsStudy lessonId={lesson.id} />
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-300">
            When you have reviewed the lesson (and flashcards if any), you can mark it as studied.
            Your teacher and school may use this for engagement insights.
          </p>
          <Button
            type="button"
            className="mt-3 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            disabled={isCompleted || completeMut.isPending}
            onClick={() => markComplete()}
          >
            {isCompleted ? "Marked as studied" : "Mark as studied"}
          </Button>
        </div>
      </div>
    </div>
  );
}

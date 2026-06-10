"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonWeekPreviewPresenter } from "@/components/lessons/LessonWeekPreviewPresenter";
import { useLessonNoteWeekPreview } from "@/hooks/teacher/useLessonNoteWeekPreview";

export default function TeacherLessonNoteWeekPreviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const noteId = typeof params?.id === "string" ? params.id : null;

  const { data, isLoading, error } = useLessonNoteWeekPreview(noteId, null, Boolean(noteId));

  if (!noteId) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-6 text-sm text-rose-100">Invalid lesson note.</CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="border border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-white/70">
              {error instanceof Error
                ? error.message
                : "Could not load a week preview for this note."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                asChild
                className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
              >
                <Link href={`/teacher/lessons/create?noteId=${noteId}`}>
                  <Presentation className="mr-2 h-4 w-4" />
                  Create weekly lessons
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                asChild
                className="border-white/10 bg-white/5 text-white/75"
              >
                <Link href={`/teacher/lesson-notes/${noteId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to note
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <LessonWeekPreviewPresenter
      weekTitle={data.weekPlan.title}
      weekLabel={data.weekPlan.weekLabel}
      sessions={data.sessions}
      onClose={() => router.push(`/teacher/lesson-notes/${noteId}`)}
    />
  );
}

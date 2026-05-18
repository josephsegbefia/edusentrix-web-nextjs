"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonNoteReadonlyView } from "@/components/lesson-notes/LessonNoteReadonlyView";
import { TeacherLessonNoteWorkflowBar } from "@/components/lesson-notes/TeacherLessonNoteWorkflowBar";
import { TeacherLessonNoteSectionRevisionDialog } from "@/components/lesson-notes/TeacherLessonNoteSectionRevisionDialog";
import { useTeacherLessonNote } from "@/hooks/teacher/useTeacherLessonNote";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import type { LessonNoteReviewComment } from "@/types/lesson-notes";
import type { LessonNoteReviewSection } from "@/lib/lesson-notes/review";

export default function TeacherLessonNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = typeof params?.id === "string" ? params.id : null;
  const { data, isLoading, error, refetch } = useTeacherLessonNote(noteId);
  const { data: teacherContext } = useTeacherContext();
  const permissions = teacherContext?.data.permissions as Permission[] | undefined;
  const canWrite = can(permissions, PERMISSIONS.journalWrite);
  const note = data?.data;

  const [activeSection, setActiveSection] = React.useState<LessonNoteReviewSection | null>(null);

  const activeSectionComments = React.useMemo<LessonNoteReviewComment[]>(
    () =>
      activeSection && note
        ? note.reviewComments.filter((comment) => comment.sectionKey === activeSection.key)
        : [],
    [activeSection, note],
  );

  if (error) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-5 text-sm text-rose-100">
          {error.message || "Failed to load lesson note."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !note) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Note</h1>
          <p className="mt-1 text-sm text-white/60">
            Review feedback, update sections, and track approval status.
          </p>
        </div>
        <Link href="/teacher/lesson-notes">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to notes
          </Button>
        </Link>
      </div>

      <TeacherLessonNoteWorkflowBar
        note={note}
        canWrite={canWrite}
        onActionComplete={() => void refetch()}
      />

      <LessonNoteReadonlyView
        note={note}
        layout="stepper"
        renderSectionActions={(section, comments) =>
          canWrite && comments.length > 0 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveSection(section)}
              className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Revise with AI
            </Button>
          ) : null
        }
      />

      <TeacherLessonNoteSectionRevisionDialog
        note={note}
        section={activeSection}
        comments={activeSectionComments}
        open={!!activeSection}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSection(null);
          }
        }}
      />
    </div>
  );
}

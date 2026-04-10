"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import {
  useAdminLessonNote,
  useUpdateAdminLessonNoteComment,
} from "@/hooks/admin/useAdminLessonNotes";
import { AdminReviewCommentComposer } from "@/components/lesson-notes/AdminReviewCommentComposer";
import { LessonNoteReadonlyView } from "@/components/lesson-notes/LessonNoteReadonlyView";

export default function AdminLessonNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const noteId = typeof params?.id === "string" ? params.id : null;
  const { data, isLoading, error } = useAdminLessonNote(noteId);
  const updateComment = useUpdateAdminLessonNoteComment();

  const note = data?.data;

  const handleResolve = async (commentId: string) => {
    if (!noteId) return;
    try {
      await updateComment.mutateAsync({
        noteId,
        commentId,
        status: "resolved",
      });
      toast.success("Comment Resolved", {
        description: "The review note has been marked as resolved.",
      });
    } catch (err) {
      toast.error("Update Failed", {
        description: err instanceof Error ? err.message : "Failed to update comment",
      });
    }
  };

  const handleReopen = async (commentId: string) => {
    if (!noteId) return;
    try {
      await updateComment.mutateAsync({
        noteId,
        commentId,
        status: "open",
      });
      toast.success("Comment Reopened", {
        description: "The review note is back in the open queue.",
      });
    } catch (err) {
      toast.error("Update Failed", {
        description: err instanceof Error ? err.message : "Failed to update comment",
      });
    }
  };

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
          <div key={index} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Note Review</h1>
          <p className="text-sm text-white/60">
            Review sections, add comments, and track teacher responses.
          </p>
        </div>
        <Link href="/admin/lesson-notes">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Inbox
          </Button>
        </Link>
      </div>

      <LessonNoteReadonlyView
        note={note}
        renderCommentActions={(_, comment) =>
          comment.status === "resolved" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleReopen(comment.id)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => handleResolve(comment.id)}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            >
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Resolve
            </Button>
          )
        }
        renderSectionFooter={(section) => (
          <AdminReviewCommentComposer noteId={note.id} section={section} />
        )}
      />
    </div>
  );
}

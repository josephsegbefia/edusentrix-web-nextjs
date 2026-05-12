"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCheck, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import {
  useAdminLessonNote,
  useUpdateAdminLessonNoteComment,
} from "@/hooks/admin/useAdminLessonNotes";
import { AdminReviewCommentComposer } from "@/components/lesson-notes/AdminReviewCommentComposer";
import { LessonNoteReadonlyView } from "@/components/lesson-notes/LessonNoteReadonlyView";
import { ApprovalActionsPanel } from "@/components/teacher/lesson-notes/ApprovalWorkflow";
import type { LessonNoteStatus } from "@/types/lesson-notes";

export default function AdminLessonNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const noteId = typeof params?.id === "string" ? params.id : null;
  const { data, isLoading, error, refetch } = useAdminLessonNote(noteId);
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
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
        <Button variant="outline" size="sm" asChild className="w-fit border-white/10 bg-white/5 text-white">
          <Link href="/admin/lesson-notes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to inbox
          </Link>
        </Button>
        <Card className="relative overflow-hidden rounded-2xl border border-rose-400/25 bg-linear-to-br from-rose-950/80 to-slate-950/90 shadow-2xl shadow-rose-950/20 backdrop-blur-xl">
          <CardContent className="p-5 text-sm text-rose-100">
            {error.message || "Failed to load lesson note."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !note) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
        <div className="h-9 w-44 animate-pulse rounded-lg border border-white/10 bg-white/6 backdrop-blur-xl" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/55">
          <Loader2 className="h-8 w-8 animate-spin text-sky-200" />
          <p className="text-sm">Loading lesson note…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild className="border-white/10 bg-white/5 text-white">
          <Link href="/admin/lesson-notes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to inbox
          </Link>
        </Button>
      </div>

      <LessonNoteReadonlyView
        surfaceVariant="glass"
        note={note}
        headerActions={
          <ApprovalActionsPanel
            noteId={note.id}
            currentStatus={note.status as LessonNoteStatus}
            isAdmin
            onActionComplete={() => void refetch()}
            className="max-w-xl"
          />
        }
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

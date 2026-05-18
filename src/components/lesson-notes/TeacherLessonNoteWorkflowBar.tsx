"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCircle, Pencil, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ApprovalStatusBadge,
  ApprovalTimeline,
  RejectionReasonAlert,
  ReturnToDraftButton,
  SubmitForApprovalButton,
} from "@/components/teacher/lesson-notes/ApprovalWorkflow";
import type { LessonNoteDetail, LessonNoteStatus } from "@/types/lesson-notes";
import { normalizeLessonNoteStatus } from "@/types/lesson-notes";

type TeacherLessonNoteWorkflowBarProps = {
  note: LessonNoteDetail;
  canWrite: boolean;
  onActionComplete?: () => void;
  className?: string;
};

function statusSubtitle(status: LessonNoteStatus, openComments: number) {
  switch (status) {
    case "draft":
      return "Finish your note and submit it for school review when ready.";
    case "submitted":
      return openComments > 0
        ? "Your school left review comments. Update sections below, then resubmit when ready."
        : "Waiting for school review. You can still edit while it is in the queue.";
    case "rejected":
      return "Your school asked for revisions. Review comments, edit the note, and submit again.";
    case "approved":
      return "Approved for delivery. You can create weekly lessons from this note.";
    default:
      return "Track review status and next steps for this lesson note.";
  }
}

export function TeacherLessonNoteWorkflowBar({
  note,
  canWrite,
  onActionComplete,
  className,
}: TeacherLessonNoteWorkflowBarProps) {
  const status = normalizeLessonNoteStatus(note.status);
  const requireApproved = note.lessonsWorkflow?.requireApprovedLessonNote ?? false;
  const canCreateLesson = !requireApproved || status === "approved";
  const openRequiredChanges = note.reviewComments.filter(
    (comment) =>
      comment.status === "open" && comment.commentType === "required_change",
  ).length;

  const showEdit =
    canWrite && ["draft", "submitted", "rejected"].includes(status);

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent p-4 shadow-lg shadow-black/20 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ApprovalStatusBadge status={status} size="md" />
            {note.openCommentCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-100">
                <Bell className="h-3 w-3" />
                {note.openCommentCount} open comment{note.openCommentCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {openRequiredChanges > 0 ? (
              <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-100">
                {openRequiredChanges} required change{openRequiredChanges === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-white/60">{statusSubtitle(status, note.openCommentCount)}</p>
        </div>

        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            {showEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              >
                <Link href={`/teacher/lesson-notes?edit=${note.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit note
                </Link>
              </Button>
            ) : null}
            <ReturnToDraftButton
              noteId={note.id}
              currentStatus={status}
              onSuccess={onActionComplete}
            />
            <SubmitForApprovalButton
              noteId={note.id}
              currentStatus={status}
              onSuccess={onActionComplete}
            />
            {canCreateLesson ? (
              <Button
                type="button"
                size="sm"
                asChild
                className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
              >
                <Link
                  href={`/teacher/lessons/create?noteId=${note.id}${note.classGroupId ? `&classGroupId=${note.classGroupId}` : ""}`}
                >
                  <Presentation className="mr-2 h-4 w-4" />
                  Create weekly lessons
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled
                title="Your school requires lesson note approval before creating student lessons."
                className="bg-white/5 text-white/40"
              >
                <Presentation className="mr-2 h-4 w-4" />
                Create weekly lessons
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {status === "rejected" && note.rejectionReason ? (
        <RejectionReasonAlert reason={note.rejectionReason} />
      ) : null}

      {status === "approved" ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100/90">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p>
            This lesson note is approved. Create weekly lessons from your timetable, then publish
            each session when you are ready.
          </p>
        </div>
      ) : null}

      <ApprovalTimeline noteId={note.id} />
    </div>
  );
}

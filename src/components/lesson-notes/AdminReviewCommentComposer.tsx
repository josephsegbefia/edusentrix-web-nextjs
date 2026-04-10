"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useToast } from "@/hooks/useToast";
import { useCreateAdminLessonNoteComment } from "@/hooks/admin/useAdminLessonNotes";
import {
  REVIEW_COMMENT_TYPE_OPTIONS,
  type LessonNoteReviewSection,
} from "@/lib/lesson-notes/review";
import type { LessonNoteReviewCommentType } from "@/types/lesson-notes";

type AdminReviewCommentComposerProps = {
  noteId: string;
  section: LessonNoteReviewSection;
};

export function AdminReviewCommentComposer({
  noteId,
  section,
}: AdminReviewCommentComposerProps) {
  const toast = useToast();
  const createComment = useCreateAdminLessonNoteComment();
  const [commentType, setCommentType] =
    React.useState<LessonNoteReviewCommentType>("suggestion");
  const [comment, setComment] = React.useState("");

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast.warning("Comment Required", {
        description: "Add a review note before saving.",
      });
      return;
    }

    try {
      await createComment.mutateAsync({
        noteId,
        sectionKey: section.key,
        sectionLabel: section.label,
        commentType,
        comment: comment.trim(),
      });
      toast.success("Comment Added", {
        description: `Saved a review note for ${section.label.toLowerCase()}.`,
      });
      setComment("");
      setCommentType("suggestion");
    } catch (error) {
      toast.error("Comment Failed", {
        description: error instanceof Error ? error.message : "Failed to save comment",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <MessageSquarePlus className="h-4 w-4 text-sky-300" />
        Add Review Comment
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.18em] text-white/45">
          Comment Type
        </Label>
        <PremiumSelect value={commentType} onValueChange={(value) => setCommentType(value as LessonNoteReviewCommentType)}>
          <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
            <PremiumSelectValue placeholder="Select comment type" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            {REVIEW_COMMENT_TYPE_OPTIONS.map((option) => (
              <PremiumSelectItem key={option.value} value={option.value}>
                {option.label}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.18em] text-white/45">
          Comment
        </Label>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={`Add a clear review note for ${section.label.toLowerCase()}...`}
          className="min-h-28 border-white/10 bg-white/5 text-white placeholder:text-white/35"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={createComment.isPending}
          className="bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
        >
          {createComment.isPending ? "Saving..." : "Save Comment"}
        </Button>
      </div>
    </div>
  );
}

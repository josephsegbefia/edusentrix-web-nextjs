"use client";

import * as React from "react";
import { Highlighter, MessageSquarePlus, WandSparkles, X } from "lucide-react";
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
  const [highlightedText, setHighlightedText] = React.useState("");

  const captureSelection = React.useCallback(() => {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() || "";
    if (selected) setHighlightedText(selected.slice(0, 500));
  }, []);

  const clearHighlight = React.useCallback(() => {
    setHighlightedText("");
    window.getSelection()?.removeAllRanges();
  }, []);

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
        comment: highlightedText
          ? `Highlighted text: "${highlightedText}"\n\n${comment.trim()}`
          : comment.trim(),
      });
      toast.success("Comment Added", {
        description: `Saved a review note for ${section.label.toLowerCase()}.`,
      });
      setComment("");
      setHighlightedText("");
      setCommentType("suggestion");
    } catch (error) {
      toast.error("Comment Failed", {
        description: error instanceof Error ? error.message : "Failed to save comment",
      });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <MessageSquarePlus className="h-4 w-4 text-sky-300" />
        Add Review Comment
      </div>

      <div className="rounded-xl border border-sky-300/15 bg-sky-500/10 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-sky-50/85">
            <Highlighter className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
            <span>
              Select text in this section, then capture it to attach a precise highlight to your
              review note. Use <span className="text-sky-100">Clear selection</span> to remove a
              captured highlight.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={captureSelection}
              className="w-fit border-sky-300/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
            >
              <WandSparkles className="mr-2 h-3.5 w-3.5" />
              Capture selection
            </Button>
            {highlightedText ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearHighlight}
                className="w-fit border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Clear selection
              </Button>
            ) : null}
          </div>
        </div>
        {highlightedText ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
            <p>
              <span className="font-semibold text-sky-100">Highlighted:</span> {highlightedText}
            </p>
            <button
              type="button"
              onClick={clearHighlight}
              className="shrink-0 rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Clear highlighted selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
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

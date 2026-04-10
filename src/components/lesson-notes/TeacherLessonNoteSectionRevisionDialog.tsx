"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AISectionAssistant } from "@/components/teacher/lesson-notes/AIAssistant";
import { useTeacherLessonNoteUpdate } from "@/hooks/teacher/useTeacherLessonNoteUpdate";
import { useToast } from "@/hooks/useToast";
import {
  buildLessonNoteSectionAIConfig,
  buildLessonNoteSectionAIContext,
} from "@/lib/lesson-notes/section-ai";
import { getReviewCommentTypeMeta, type LessonNoteReviewSection } from "@/lib/lesson-notes/review";
import type { LessonNoteDetail, LessonNoteReviewComment } from "@/types/lesson-notes";
import type { AIGenerateResponse } from "@/hooks/teacher/useTeacherAIGenerate";
import { applyAIResultToLessonNoteSection } from "@/lib/lesson-notes/section-ai";

type TeacherLessonNoteSectionRevisionDialogProps = {
  note: LessonNoteDetail;
  section: LessonNoteReviewSection | null;
  comments: LessonNoteReviewComment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TeacherLessonNoteSectionRevisionDialog({
  note,
  section,
  comments,
  open,
  onOpenChange,
}: TeacherLessonNoteSectionRevisionDialogProps) {
  const toast = useToast();
  const updateMutation = useTeacherLessonNoteUpdate();

  const aiConfig = React.useMemo(
    () => (section ? buildLessonNoteSectionAIConfig(note, section.key) : null),
    [note, section]
  );

  const aiContext = React.useMemo(
    () => (section ? buildLessonNoteSectionAIContext(note, section.key, comments) : null),
    [comments, note, section]
  );

  const handleGenerated = async (data: AIGenerateResponse) => {
    if (!section) {
      return;
    }

    const patch = applyAIResultToLessonNoteSection(note, section.key, data);
    if (!patch) {
      toast.warning("No Revision Applied", {
        description: "The AI response did not contain a usable update for this section.",
      });
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        id: note.id,
        ...patch,
      });
      if ((result as { queued?: boolean })?.queued) {
        toast.info("Revision Queued", {
          description: "The section update will sync when the device is back online.",
        });
      } else {
        toast.success("Section Updated", {
          description: `${section.label} was revised and saved.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Revision Failed", {
        description: error instanceof Error ? error.message : "Failed to update section",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-[#11151c] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-violet-300" />
            Revise {section?.label || "Section"} With AI
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Review the comments below, then ask AI to help you update this section only.
          </DialogDescription>
        </DialogHeader>

        {!section || !aiConfig || !aiContext ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            This section does not currently support AI-assisted revision.
          </div>
        ) : (
          <div className="space-y-4">
            {comments.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">Review Comments</div>
                <div className="space-y-2">
                  {comments.map((comment) => {
                    const typeMeta = getReviewCommentTypeMeta(comment.commentType);
                    return (
                      <div
                        key={comment.id}
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={typeMeta.toneClassName}>{typeMeta.label}</Badge>
                          <span className="text-xs text-white/45">{comment.authorName}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/80">{comment.comment}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <AISectionAssistant
              context={aiContext}
              action={aiConfig.action}
              section={aiConfig.sectionLabel}
              title={`Improve ${section.label}`}
              description="AI uses the current lesson context and the review comments above, but it only updates this section."
              buttonLabel="Generate Revision"
              existingContent={aiConfig.existingContent}
              fieldBlueprint={aiConfig.fieldBlueprint}
              promptPlaceholder='What do you want help with on this section? e.g. "Address the reviewer remarks and make the explanation more practical."'
              disabled={updateMutation.isPending}
              onGenerated={handleGenerated}
            />

            {updateMutation.isPending && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                Saving the revised section...
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

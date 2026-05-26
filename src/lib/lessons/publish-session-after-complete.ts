import "server-only";

import type { ILessonSession } from "@/models/LessonSession";
import {
  assertSessionPublishAllowed,
  normalizeContentBlocks,
} from "@/lib/lessons/content-blocks";

/**
 * After a teacher completes delivery, make the session visible to students when safe.
 * Learn and the student portal both require studentVisibility "published".
 */
export function applyStudentPublishAfterDeliveryComplete(input: {
  session: ILessonSession;
  requireTeacherReviewForAiContent: boolean;
}): { published: boolean; blockedReason?: string } {
  const blocks = normalizeContentBlocks(input.session.contentBlocks ?? []);
  const gate = assertSessionPublishAllowed({
    contentBlocks: blocks,
    requireTeacherReviewForAiContent: input.requireTeacherReviewForAiContent,
  });

  if (!gate.ok) {
    return { published: false, blockedReason: gate.error };
  }

  input.session.status = "published";
  input.session.studentVisibility = "published";
  return { published: true };
}

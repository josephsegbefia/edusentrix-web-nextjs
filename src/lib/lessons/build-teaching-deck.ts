import "server-only";

import { randomUUID } from "crypto";
import type { ILessonContentBlock, ILessonSession } from "@/models/LessonSession";
import type { LessonContentBlockType } from "@/types/lesson-content-blocks";
import type { TeachingDeck, TeachingSlide, TeachingSlideType } from "@/types/teaching-deck";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { LESSON_CONTENT_BLOCK_LABELS } from "@/types/lesson-content-blocks";

function mapBlockTypeToSlide(type: LessonContentBlockType): TeachingSlideType {
  switch (type) {
    case "activity":
      return "activity";
    case "check":
      return "check";
    case "discussion":
      return "discussion";
    case "exit_ticket":
      return "exit_ticket";
    case "resource_embed":
      return "resource";
    default:
      return "content_block";
  }
}

function slideFromBlock(block: ILessonContentBlock): TeachingSlide {
  const type = mapBlockTypeToSlide(block.type);
  return {
    id: randomUUID(),
    type,
    title: block.title?.trim() || LESSON_CONTENT_BLOCK_LABELS[block.type],
    bodyHtml: sanitizeLessonHtml(block.bodyHtml),
    speakerNotes: block.aiGenerated
      ? "Leo draft — confirm accuracy before relying on this in class."
      : null,
    contentBlockId: block.id,
    estimatedMinutes: block.estimatedMinutes ?? null,
    resourceUrl: block.resourceUrl ?? null,
    timerMinutes:
      type === "activity" || type === "check"
        ? block.estimatedMinutes ?? 5
        : null,
  };
}

export function buildTeachingDeckFromSession(session: ILessonSession): TeachingDeck {
  const slides: TeachingSlide[] = [
    {
      id: randomUUID(),
      type: "title",
      title: session.title,
      bodyHtml: `<p>${session.scheduledDate ? new Date(session.scheduledDate).toISOString().slice(0, 10) : ""} · ${session.startTime}–${session.endTime}</p>`,
      speakerNotes: session.planNotes?.trim() || null,
    },
  ];

  const blocks = [...(session.contentBlocks ?? [])].sort((a, b) => a.order - b.order);
  for (const block of blocks) {
    slides.push(slideFromBlock(block));
  }

  if (session.planNotes?.trim() && blocks.length === 0) {
    slides.push({
      id: randomUUID(),
      type: "plan_notes",
      title: "Teaching plan",
      bodyHtml: null,
      speakerNotes: session.planNotes.trim(),
    });
  }

  slides.push({
    id: randomUUID(),
    type: "timer",
    title: "Wrap up",
    bodyHtml: "<p>Close the lesson and prepare for attendance or reflection.</p>",
    timerMinutes: 3,
  });

  return {
    slides,
    builtAt: new Date().toISOString(),
    sourceContentVersion: session.contentVersion || 1,
  };
}

export function teachingDeckNeedsRebuild(
  session: ILessonSession,
  deck: TeachingDeck | null | undefined,
): boolean {
  if (!deck?.slides?.length) return true;
  return (deck.sourceContentVersion || 0) !== (session.contentVersion || 1);
}

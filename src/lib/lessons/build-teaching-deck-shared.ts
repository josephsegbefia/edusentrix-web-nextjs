import type { LessonContentBlock, LessonContentBlockType } from "@/types/lesson-content-blocks";
import { LESSON_CONTENT_BLOCK_LABELS } from "@/types/lesson-content-blocks";
import type { TeachingDeck, TeachingSlide, TeachingSlideType } from "@/types/teaching-deck";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";

export type TeachingDeckSessionInput = {
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  planNotes?: string | null;
  contentBlocks?: LessonContentBlock[];
  contentVersion?: number;
};

function newSlideId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

function slideFromBlock(block: LessonContentBlock): TeachingSlide {
  const type = mapBlockTypeToSlide(block.type);
  return {
    id: newSlideId(),
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
      type === "activity" || type === "check" ? block.estimatedMinutes ?? 5 : null,
  };
}

export function buildTeachingDeckFromSessionInput(
  session: TeachingDeckSessionInput,
): TeachingDeck {
  const slides: TeachingSlide[] = [
    {
      id: newSlideId(),
      type: "title",
      title: session.title,
      bodyHtml: `<p>${session.scheduledDate} · ${session.startTime}–${session.endTime}</p>`,
      speakerNotes: session.planNotes?.trim() || null,
    },
  ];

  const blocks = [...(session.contentBlocks ?? [])].sort((a, b) => a.order - b.order);
  for (const block of blocks) {
    slides.push(slideFromBlock(block));
  }

  if (session.planNotes?.trim() && blocks.length === 0) {
    slides.push({
      id: newSlideId(),
      type: "plan_notes",
      title: "Teaching plan",
      bodyHtml: null,
      speakerNotes: session.planNotes.trim(),
    });
  }

  slides.push({
    id: newSlideId(),
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

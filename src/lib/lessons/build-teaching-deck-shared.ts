import type { LessonContentBlock, LessonContentBlockType } from "@/types/lesson-content-blocks";
import { LESSON_CONTENT_BLOCK_LABELS, isTeacherOnlyLessonBlockType } from "@/types/lesson-content-blocks";
import type { TeachingDeck, TeachingSlide, TeachingSlideType } from "@/types/teaching-deck";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { renderLessonMathLatex } from "@/lib/lessons/katex-utils";

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
    case "illustration":
    case "audio":
      return "resource";
    default:
      return "content_block";
  }
}

function buildSlideBodyHtml(block: LessonContentBlock): string | null {
  const base = sanitizeLessonHtml(block.bodyHtml);

  if (block.type === "math_expression" || block.type === "worked_example") {
    const latex = block.mathMeta?.latex?.trim();
    if (latex) {
      const rendered = renderLessonMathLatex(latex, { displayMode: true });
      if (rendered.html) {
        return `${block.mathMeta?.plainText ? `<p>${block.mathMeta.plainText}</p>` : ""}${rendered.html}${base ? `<div>${base}</div>` : ""}`;
      }
    }
  }

  if (block.type === "illustration" && block.resourceUrl) {
    const alt = block.assetMeta?.altText || block.title || "Lesson illustration";
    const caption = block.assetMeta?.caption || block.accessibilityMeta?.caption;
    return `${base || ""}<figure><img src="${block.resourceUrl}" alt="${alt.replace(/"/g, "&quot;")}" style="max-width:100%;height:auto;" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  }

  if (block.type === "diagram") {
    return base || `<p>${block.title || "Visual diagram"}</p>`;
  }

  return base || null;
}

function slideFromBlock(block: LessonContentBlock): TeachingSlide | null {
  if (isTeacherOnlyLessonBlockType(block.type)) return null;

  const type = mapBlockTypeToSlide(block.type);
  return {
    id: newSlideId(),
    type,
    title: block.title?.trim() || LESSON_CONTENT_BLOCK_LABELS[block.type],
    bodyHtml: buildSlideBodyHtml(block),
    speakerNotes: block.aiGenerated
      ? "Leo draft — confirm accuracy before relying on this in class."
      : null,
    contentBlockId: block.id,
    contentBlockType: block.type,
    diagramMeta: block.diagramMeta ?? null,
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
    const slide = slideFromBlock(block);
    if (slide) slides.push(slide);
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

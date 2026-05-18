import "server-only";

import { randomUUID } from "crypto";
import { z } from "zod";
import {
  LESSON_CONTENT_BLOCK_TYPES,
  type LessonContentBlock,
  type LessonContentBlockType,
} from "@/types/lesson-content-blocks";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { normalizeSafeExternalUrl } from "@/lib/lessons/content-safety";

const BlockSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(LESSON_CONTENT_BLOCK_TYPES),
  title: z.string().trim().max(200).optional().nullable(),
  bodyHtml: z.string().max(24_000),
  order: z.number().int().min(0).optional(),
  estimatedMinutes: z.number().min(0).max(180).optional().nullable(),
  aiGenerated: z.boolean().optional(),
  teacherReviewed: z.boolean().optional(),
  resourceUrl: z.string().max(2000).optional().nullable(),
});

export function normalizeContentBlocks(raw: unknown): LessonContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const parsed: LessonContentBlock[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = BlockSchema.safeParse(raw[i]);
    if (!row.success) continue;
    const d = row.data;
    const type = d.type as LessonContentBlockType;
    let bodyHtml = sanitizeLessonHtml(d.bodyHtml);
    let resourceUrl: string | null = null;
    if (type === "resource_embed") {
      resourceUrl = normalizeSafeExternalUrl(String(d.resourceUrl || d.bodyHtml || ""));
      if (resourceUrl && !bodyHtml) {
        bodyHtml = `<p><a href="${resourceUrl}" rel="noopener noreferrer">${resourceUrl}</a></p>`;
      }
    }
    if (!bodyHtml.trim() && type !== "resource_embed") continue;
    parsed.push({
      id: d.id?.trim() || randomUUID(),
      type,
      title: d.title?.trim() || null,
      bodyHtml,
      order: d.order ?? i,
      estimatedMinutes: d.estimatedMinutes ?? null,
      aiGenerated: Boolean(d.aiGenerated),
      teacherReviewed: Boolean(d.teacherReviewed),
      resourceUrl,
    });
  }
  return parsed
    .sort((a, b) => a.order - b.order)
    .map((b, index) => ({ ...b, order: index }));
}

export { validateCoverageWeights } from "@/lib/lessons/coverage-weights";

export function assertSessionPublishAllowed(input: {
  contentBlocks: LessonContentBlock[];
  requireTeacherReviewForAiContent: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.requireTeacherReviewForAiContent) return { ok: true };
  const unreviewed = input.contentBlocks.filter((b) => b.aiGenerated && !b.teacherReviewed);
  if (unreviewed.length > 0) {
    return {
      ok: false,
      error: `Review ${unreviewed.length} AI-generated content block${unreviewed.length === 1 ? "" : "s"} before publishing to students.`,
    };
  }
  return { ok: true };
}

export function countUnreviewedAiBlocks(blocks: LessonContentBlock[]): number {
  return blocks.filter((b) => b.aiGenerated && !b.teacherReviewed).length;
}

export function markAllAiBlocksReviewed(blocks: LessonContentBlock[]): LessonContentBlock[] {
  return blocks.map((b) => (b.aiGenerated ? { ...b, teacherReviewed: true } : b));
}

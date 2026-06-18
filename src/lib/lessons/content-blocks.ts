import "server-only";

import { z } from "zod";
import {
  LESSON_CONTENT_BLOCK_TYPES,
  type LessonContentBlock,
} from "@/types/lesson-content-blocks";
import { normalizeLessonContentBlock } from "@/lib/lessons/content-block-normalizer";
import {
  assertLessonSessionReadyForPublish,
  getLessonSessionReadiness,
} from "@/lib/lessons/content-readiness";
import { sanitizeLessonHtml, normalizeSafeExternalUrl } from "@/lib/lessons/content-safety";

const BLOCK_TYPES_ALLOWING_EMPTY_BODY = new Set([
  "diagram",
  "illustration",
  "audio",
  "asset_plan",
  "math_expression",
  "resource_embed",
]);

const MetaSchema = z.record(z.string(), z.unknown()).optional().nullable();

const BlockSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(LESSON_CONTENT_BLOCK_TYPES),
  title: z.string().trim().max(200).optional().nullable(),
  bodyHtml: z.string().max(24_000).optional().default(""),
  order: z.number().int().min(0).optional(),
  estimatedMinutes: z.number().min(0).max(180).optional().nullable(),
  aiGenerated: z.boolean().optional(),
  teacherReviewed: z.boolean().optional(),
  resourceUrl: z.string().max(2000).optional().nullable(),
  subjectMode: z.string().max(40).optional().nullable(),
  languageMeta: MetaSchema,
  mathMeta: MetaSchema,
  assetMeta: MetaSchema,
  reviewMeta: MetaSchema,
  accessibilityMeta: MetaSchema,
  diagramMeta: MetaSchema,
});

export function normalizeContentBlocks(raw: unknown): LessonContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const parsed: LessonContentBlock[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = BlockSchema.safeParse(raw[i]);
    if (!row.success) continue;
    const d = row.data;
    let bodyHtml = sanitizeLessonHtml(d.bodyHtml || "");
    let resourceUrl: string | null = normalizeSafeExternalUrl(String(d.resourceUrl || "")) || null;

    if (d.type === "resource_embed") {
      resourceUrl = normalizeSafeExternalUrl(String(d.resourceUrl || d.bodyHtml || ""));
      if (resourceUrl && !bodyHtml) {
        bodyHtml = `<p><a href="${resourceUrl}" rel="noopener noreferrer">${resourceUrl}</a></p>`;
      }
    }

    const hasStructuredContent =
      d.type === "diagram" ||
      d.type === "illustration" ||
      d.type === "audio" ||
      d.type === "math_expression" ||
      d.type === "worked_example";

    if (!bodyHtml.trim() && !BLOCK_TYPES_ALLOWING_EMPTY_BODY.has(d.type) && !hasStructuredContent) {
      continue;
    }

    const normalized = normalizeLessonContentBlock(
      {
        ...d,
        bodyHtml,
        resourceUrl,
      },
      i,
    );
    if (normalized) parsed.push(normalized);
  }

  return parsed
    .sort((a, b) => a.order - b.order)
    .map((b, index) => ({ ...b, order: index }));
}

export { validateCoverageWeights } from "@/lib/lessons/coverage-weights";
export {
  getLessonSessionReadiness,
  getBlockedPublishReasons,
  getLessonQualitySummary,
  assertLessonSessionReadyForPublish,
  filterStudentVisibleContentBlocks,
} from "@/lib/lessons/content-readiness";

export function assertSessionPublishAllowed(input: {
  contentBlocks: LessonContentBlock[];
  requireTeacherReviewForAiContent: boolean;
}): { ok: true } | { ok: false; error: string; blockingReasons?: string[] } {
  const readiness = assertLessonSessionReadyForPublish(input.contentBlocks, {
    requireTeacherReviewForAiContent: input.requireTeacherReviewForAiContent,
  });
  if (!readiness.ok) {
    return {
      ok: false,
      error: readiness.error,
      blockingReasons: readiness.blockingReasons,
    };
  }
  return { ok: true };
}

export function countUnreviewedAiBlocks(blocks: LessonContentBlock[]): number {
  return blocks.filter((b) => b.aiGenerated && !b.teacherReviewed).length;
}

export function markAllAiBlocksReviewed(blocks: LessonContentBlock[]): LessonContentBlock[] {
  return blocks.map((b) =>
    b.aiGenerated
      ? {
          ...b,
          teacherReviewed: true,
          reviewMeta: {
            ...b.reviewMeta,
            aiReviewStatus: "approved",
          },
        }
      : b,
  );
}

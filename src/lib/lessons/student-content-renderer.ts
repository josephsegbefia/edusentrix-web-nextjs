import type {
  LessonContentBlock,
  StudentLessonSessionContentDto,
} from "@/types/lesson-content-blocks";

export function mapStudentPayloadBlocksToContentBlocks(
  blocks: StudentLessonSessionContentDto["blocks"],
): LessonContentBlock[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    title: block.title,
    bodyHtml: block.bodyHtml,
    order: block.order,
    estimatedMinutes: block.estimatedMinutes,
    aiGenerated: false,
    teacherReviewed: true,
    resourceUrl: block.resourceUrl ?? null,
    mathMeta: block.mathMeta
      ? {
          latex: block.mathMeta.latex ?? null,
          plainText: block.mathMeta.plainText ?? null,
          renderMode: block.mathMeta.renderMode,
          format: block.mathMeta.latex ? "latex" : "plain",
        }
      : null,
    diagramMeta: block.diagramMeta ?? null,
    accessibilityMeta: block.accessibilityMeta ?? null,
    assetMeta: block.accessibilityMeta
      ? {
          altText: block.accessibilityMeta.altText ?? null,
          caption: block.accessibilityMeta.caption ?? null,
          assetStatus: "approved",
        }
      : block.resourceUrl
        ? { assetStatus: "approved", assetKind: "illustration" }
        : null,
  }));
}

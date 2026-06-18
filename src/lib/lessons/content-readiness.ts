import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { isTeacherOnlyLessonBlockType } from "@/types/lesson-content-blocks";

export type LessonReadinessSummary = {
  aiReview: "ready" | "pending" | "not_required";
  language: "ready" | "needs_review" | "not_required";
  math: "ready" | "invalid" | "not_required";
  assets: "ready" | "missing_required_assets" | "needs_review" | "optional";
  accessibility: "ready" | "needs_alt_text" | "not_required";
  audio: "ready" | "missing" | "optional";
};

export type LessonSessionReadiness = {
  canPublish: boolean;
  summary: LessonReadinessSummary;
  blockingReasons: string[];
};

const LANGUAGE_BLOCK_TYPES = new Set(["bilingual_text", "vocabulary", "pronunciation"]);
const MATH_BLOCK_TYPES = new Set(["math_expression", "worked_example"]);
const VISUAL_BLOCK_TYPES = new Set(["diagram", "illustration"]);
const AUDIO_BLOCK_TYPES = new Set(["audio"]);

function getAltText(block: LessonContentBlock): string {
  return (
    block.assetMeta?.altText?.trim() ||
    block.accessibilityMeta?.altText?.trim() ||
    ""
  );
}

function isLanguageBlockNeedingReview(block: LessonContentBlock): boolean {
  if (!LANGUAGE_BLOCK_TYPES.has(block.type)) return false;
  const status = block.languageMeta?.languageReviewStatus;
  if (status === "approved" || status === "not_required") return false;
  if (status === "needs_review" || status === "rejected") return true;
  if (block.languageMeta?.requiresLanguageReview) return true;
  return block.aiGenerated && !block.teacherReviewed;
}

function isInvalidMathBlock(block: LessonContentBlock): boolean {
  if (!MATH_BLOCK_TYPES.has(block.type)) return false;
  return block.mathMeta?.validationStatus === "invalid";
}

function isMissingRequiredAsset(block: LessonContentBlock): boolean {
  if (!VISUAL_BLOCK_TYPES.has(block.type) && !AUDIO_BLOCK_TYPES.has(block.type)) {
    return false;
  }
  if (!block.assetMeta?.required) return false;
  const status = block.assetMeta.assetStatus;
  if (status === "approved") return false;
  if (block.type === "illustration" || block.type === "audio") {
    if (block.resourceUrl?.trim()) {
      if (block.assetMeta.source === "ai" && status !== "approved") return true;
      if (status === "missing" || status === "planned") return true;
      return false;
    }
    return true;
  }
  if (block.type === "diagram") {
    if (block.diagramMeta?.diagramType) return false;
    return status === "missing" || status === "planned" || !status;
  }
  return status === "missing" || status === "planned" || status === "draft";
}

function isUnapprovedAiIllustration(block: LessonContentBlock): boolean {
  if (block.type !== "illustration") return false;
  if (block.assetMeta?.source !== "ai") return false;
  return block.assetMeta.assetStatus !== "approved";
}

function isRequiredVisualMissingAlt(block: LessonContentBlock): boolean {
  if (!VISUAL_BLOCK_TYPES.has(block.type)) return false;
  if (!block.assetMeta?.required) return false;
  return !getAltText(block);
}

export function getLessonQualitySummary(blocks: LessonContentBlock[]): LessonReadinessSummary {
  const unreviewedAi = blocks.filter((b) => b.aiGenerated && !b.teacherReviewed);
  const languagePending = blocks.filter(isLanguageBlockNeedingReview);
  const invalidMath = blocks.filter(isInvalidMathBlock);
  const missingAssets = blocks.filter(isMissingRequiredAsset);
  const unapprovedAiIllustrations = blocks.filter(isUnapprovedAiIllustration);
  const missingAlt = blocks.filter(isRequiredVisualMissingAlt);
  const audioBlocks = blocks.filter((b) => b.type === "audio");
  const missingAudio = audioBlocks.filter(
    (b) => b.assetMeta?.required && !b.resourceUrl?.trim(),
  );

  return {
    aiReview:
      unreviewedAi.length === 0
        ? blocks.some((b) => b.aiGenerated)
          ? "ready"
          : "not_required"
        : "pending",
    language:
      languagePending.length === 0
        ? blocks.some((b) => LANGUAGE_BLOCK_TYPES.has(b.type))
          ? "ready"
          : "not_required"
        : "needs_review",
    math:
      invalidMath.length === 0
        ? blocks.some((b) => MATH_BLOCK_TYPES.has(b.type))
          ? "ready"
          : "not_required"
        : "invalid",
    assets:
      missingAssets.length > 0 || unapprovedAiIllustrations.length > 0
        ? "missing_required_assets"
        : blocks.some((b) => VISUAL_BLOCK_TYPES.has(b.type) || b.type === "asset_plan")
          ? "ready"
          : "optional",
    accessibility:
      missingAlt.length === 0
        ? blocks.some((b) => VISUAL_BLOCK_TYPES.has(b.type))
          ? "ready"
          : "not_required"
        : "needs_alt_text",
    audio:
      audioBlocks.length === 0
        ? "optional"
        : missingAudio.length > 0
          ? "missing"
          : "ready",
  };
}

export function getBlockedPublishReasons(
  blocks: LessonContentBlock[],
  options?: { requireTeacherReviewForAiContent?: boolean },
): string[] {
  const reasons: string[] = [];
  const requireAiReview = options?.requireTeacherReviewForAiContent ?? true;

  if (requireAiReview) {
    const unreviewed = blocks.filter((b) => b.aiGenerated && !b.teacherReviewed);
    if (unreviewed.length > 0) {
      reasons.push(
        `Review ${unreviewed.length} AI-generated content block${unreviewed.length === 1 ? "" : "s"} before publishing.`,
      );
    }
  }

  const languagePending = blocks.filter(isLanguageBlockNeedingReview);
  if (languagePending.length > 0) {
    reasons.push(
      `${languagePending.length} Ghanaian-language block${languagePending.length === 1 ? "" : "s"} need teacher language review.`,
    );
  }

  const invalidMath = blocks.filter(isInvalidMathBlock);
  if (invalidMath.length > 0) {
    reasons.push(
      `${invalidMath.length} math block${invalidMath.length === 1 ? "" : "s"} contain invalid expressions.`,
    );
  }

  const missingAssets = blocks.filter(isMissingRequiredAsset);
  if (missingAssets.length > 0) {
    reasons.push(
      `${missingAssets.length} required visual or audio asset${missingAssets.length === 1 ? "" : "s"} still missing.`,
    );
  }

  const unapprovedAiIllustrations = blocks.filter(isUnapprovedAiIllustration);
  if (unapprovedAiIllustrations.length > 0) {
    reasons.push(
      `${unapprovedAiIllustrations.length} AI-generated illustration${unapprovedAiIllustrations.length === 1 ? "" : "s"} need teacher approval.`,
    );
  }

  const missingAlt = blocks.filter(isRequiredVisualMissingAlt);
  if (missingAlt.length > 0) {
    reasons.push(
      `${missingAlt.length} required visual block${missingAlt.length === 1 ? "" : "s"} missing alt text.`,
    );
  }

  return reasons;
}

export function getLessonSessionReadiness(
  blocks: LessonContentBlock[],
  options?: { requireTeacherReviewForAiContent?: boolean },
): LessonSessionReadiness {
  const blockingReasons = getBlockedPublishReasons(blocks, options);
  return {
    canPublish: blockingReasons.length === 0,
    summary: getLessonQualitySummary(blocks),
    blockingReasons,
  };
}

export function assertLessonSessionReadyForPublish(
  blocks: LessonContentBlock[],
  options?: { requireTeacherReviewForAiContent?: boolean },
): { ok: true } | { ok: false; error: string; blockingReasons: string[] } {
  const readiness = getLessonSessionReadiness(blocks, options);
  if (readiness.canPublish) return { ok: true };
  return {
    ok: false,
    error: readiness.blockingReasons[0] || "Lesson content is not ready to publish.",
    blockingReasons: readiness.blockingReasons,
  };
}

/** Student-safe blocks — hides teacher-only planning blocks. */
export function filterStudentVisibleContentBlocks(
  blocks: LessonContentBlock[],
): LessonContentBlock[] {
  return blocks.filter((block) => !isTeacherOnlyLessonBlockType(block.type));
}

import { randomUUID } from "crypto";
import type {
  LessonAccessibilityMeta,
  LessonAssetMeta,
  LessonContentBlock,
  LessonDiagramMeta,
  LessonLanguageMeta,
  LessonMathMeta,
  LessonReviewMeta,
  LessonSubjectMode,
} from "@/types/lesson-content-blocks";
import { validateLessonMathLatex } from "@/lib/lessons/katex-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function normalizeLanguageMeta(raw: unknown): LessonLanguageMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  const vocabularyItems = Array.isArray(r.vocabularyItems)
    ? r.vocabularyItems
        .map((item) => {
          const row = asRecord(item);
          if (!row) return null;
          const word = asString(row.word, 200);
          if (!word) return null;
          return {
            word,
            meaningEnglish: asString(row.meaningEnglish, 500) ?? undefined,
            pronunciationHint: asString(row.pronunciationHint, 300) ?? undefined,
            exampleSentence: asString(row.exampleSentence, 500) ?? undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  return {
    languageCode: asString(r.languageCode, 40) ?? undefined,
    languageName: asString(r.languageName, 120) ?? undefined,
    dialectOrVariant: asString(r.dialectOrVariant, 120),
    supportLanguageCode: asString(r.supportLanguageCode, 40),
    mediumOfInstruction:
      typeof r.mediumOfInstruction === "string"
        ? (r.mediumOfInstruction as LessonLanguageMeta["mediumOfInstruction"])
        : undefined,
    teacherApprovedSpelling: asBool(r.teacherApprovedSpelling),
    requiresLanguageReview: asBool(r.requiresLanguageReview),
    languageReviewStatus:
      typeof r.languageReviewStatus === "string"
        ? (r.languageReviewStatus as LessonLanguageMeta["languageReviewStatus"])
        : undefined,
    reviewedBy: asString(r.reviewedBy, 120),
    reviewedAt: asString(r.reviewedAt, 80),
    vocabularyItems: vocabularyItems?.length ? vocabularyItems : undefined,
  };
}

function normalizeMathMeta(raw: unknown): LessonMathMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  const latex = asString(r.latex, 4000);
  const steps = Array.isArray(r.steps)
    ? r.steps
        .map((step) => {
          const row = asRecord(step);
          if (!row) return null;
          return {
            title: asString(row.title, 200) ?? undefined,
            latex: asString(row.latex, 2000) ?? undefined,
            plainText: asString(row.plainText, 2000) ?? undefined,
            bodyHtml: asString(row.bodyHtml, 4000) ?? undefined,
          };
        })
        .filter((step): step is NonNullable<typeof step> => Boolean(step))
    : undefined;

  const meta: LessonMathMeta = {
    format:
      typeof r.format === "string" ? (r.format as LessonMathMeta["format"]) : latex ? "latex" : "plain",
    latex,
    mathml: asString(r.mathml, 8000),
    plainText: asString(r.plainText, 2000),
    renderMode:
      typeof r.renderMode === "string"
        ? (r.renderMode as LessonMathMeta["renderMode"])
        : undefined,
    mathKind:
      typeof r.mathKind === "string"
        ? (r.mathKind as LessonMathMeta["mathKind"])
        : undefined,
    validationStatus:
      typeof r.validationStatus === "string"
        ? (r.validationStatus as LessonMathMeta["validationStatus"])
        : undefined,
    validationMessage: asString(r.validationMessage, 500),
    steps: steps?.length ? steps : undefined,
  };

  if (latex) {
    const validation = validateLessonMathLatex(latex);
    meta.validationStatus = validation.valid ? "valid" : "invalid";
    meta.validationMessage = validation.message ?? null;
  }

  return meta;
}

function normalizeAssetMeta(raw: unknown): LessonAssetMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  return {
    assetKind:
      typeof r.assetKind === "string"
        ? (r.assetKind as LessonAssetMeta["assetKind"])
        : undefined,
    assetStatus:
      typeof r.assetStatus === "string"
        ? (r.assetStatus as LessonAssetMeta["assetStatus"])
        : undefined,
    source:
      typeof r.source === "string" ? (r.source as LessonAssetMeta["source"]) : undefined,
    altText: asString(r.altText, 500),
    caption: asString(r.caption, 500),
    required: asBool(r.required),
    generationPrompt: asString(r.generationPrompt, 2000),
    uploadThingKey: asString(r.uploadThingKey, 500),
  };
}

function normalizeReviewMeta(
  raw: unknown,
  block: Pick<LessonContentBlock, "aiGenerated" | "teacherReviewed">,
): LessonReviewMeta | null {
  const r = asRecord(raw);
  const derivedAiStatus = block.aiGenerated
    ? block.teacherReviewed
      ? "approved"
      : "needs_review"
    : "not_required";

  if (!r) {
    return { aiReviewStatus: derivedAiStatus };
  }

  return {
    aiReviewStatus:
      typeof r.aiReviewStatus === "string"
        ? (r.aiReviewStatus as LessonReviewMeta["aiReviewStatus"])
        : derivedAiStatus,
    languageReviewStatus:
      typeof r.languageReviewStatus === "string"
        ? (r.languageReviewStatus as LessonReviewMeta["languageReviewStatus"])
        : undefined,
    mathReviewStatus:
      typeof r.mathReviewStatus === "string"
        ? (r.mathReviewStatus as LessonReviewMeta["mathReviewStatus"])
        : undefined,
    assetReviewStatus:
      typeof r.assetReviewStatus === "string"
        ? (r.assetReviewStatus as LessonReviewMeta["assetReviewStatus"])
        : undefined,
    accessibilityReviewStatus:
      typeof r.accessibilityReviewStatus === "string"
        ? (r.accessibilityReviewStatus as LessonReviewMeta["accessibilityReviewStatus"])
        : undefined,
    reviewedBy: asString(r.reviewedBy, 120),
    reviewedAt: asString(r.reviewedAt, 80),
    reviewNotes: asString(r.reviewNotes, 1000),
  };
}

function normalizeAccessibilityMeta(raw: unknown): LessonAccessibilityMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  return {
    altText: asString(r.altText, 500),
    caption: asString(r.caption, 500),
    transcript: asString(r.transcript, 4000),
  };
}

function normalizeDiagramMeta(raw: unknown): LessonDiagramMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  const diagramType =
    typeof r.diagramType === "string"
      ? (r.diagramType as LessonDiagramMeta["diagramType"])
      : undefined;
  const data = asRecord(r.data) ?? undefined;
  if (!diagramType && !data) return null;
  return { diagramType, data };
}

function normalizeSubjectMode(raw: unknown): LessonSubjectMode {
  const value = asString(raw, 40);
  if (
    value === "ghanaian_language" ||
    value === "mathematics" ||
    value === "science_visual" ||
    value === "visual_heavy"
  ) {
    return value;
  }
  return "general";
}

export function normalizeLessonContentBlock(
  raw: unknown,
  fallbackOrder = 0,
): LessonContentBlock | null {
  const r = asRecord(raw);
  if (!r || typeof r.type !== "string") return null;

  const aiGenerated = Boolean(r.aiGenerated);
  const teacherReviewed = Boolean(r.teacherReviewed);
  const mathMeta = normalizeMathMeta(r.mathMeta);

  const block: LessonContentBlock = {
    id: asString(r.id, 120) ?? randomUUID(),
    type: r.type as LessonContentBlock["type"],
    title: asString(r.title, 200),
    bodyHtml: typeof r.bodyHtml === "string" ? r.bodyHtml : "",
    order: typeof r.order === "number" && Number.isFinite(r.order) ? Math.max(0, r.order) : fallbackOrder,
    estimatedMinutes:
      typeof r.estimatedMinutes === "number" && Number.isFinite(r.estimatedMinutes)
        ? r.estimatedMinutes
        : null,
    aiGenerated,
    teacherReviewed,
    resourceUrl: asString(r.resourceUrl, 2000),
    subjectMode: normalizeSubjectMode(r.subjectMode),
    languageMeta: normalizeLanguageMeta(r.languageMeta),
    mathMeta,
    assetMeta: normalizeAssetMeta(r.assetMeta),
    reviewMeta: normalizeReviewMeta(r.reviewMeta, { aiGenerated, teacherReviewed }),
    accessibilityMeta: normalizeAccessibilityMeta(r.accessibilityMeta),
    diagramMeta: normalizeDiagramMeta(r.diagramMeta),
  };

  return block;
}

export function normalizeLessonContentBlocks(raw: unknown): LessonContentBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, index) => normalizeLessonContentBlock(row, index))
    .filter((block): block is LessonContentBlock => Boolean(block))
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({ ...block, order: index }));
}

export function getEffectiveSubjectMode(block: LessonContentBlock): LessonSubjectMode {
  return block.subjectMode ?? "general";
}

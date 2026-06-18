export const LEGACY_LESSON_CONTENT_BLOCK_TYPES = [
  "explanation",
  "example",
  "activity",
  "discussion",
  "check",
  "resource_embed",
  "exit_ticket",
  "teacher_note",
  "did_you_know",
] as const;

export const ADVANCED_LESSON_CONTENT_BLOCK_TYPES = [
  "bilingual_text",
  "vocabulary",
  "pronunciation",
  "math_expression",
  "worked_example",
  "diagram",
  "illustration",
  "audio",
  "asset_plan",
] as const;

export const LESSON_CONTENT_BLOCK_TYPES = [
  ...LEGACY_LESSON_CONTENT_BLOCK_TYPES,
  ...ADVANCED_LESSON_CONTENT_BLOCK_TYPES,
] as const;

export type LessonContentBlockType = (typeof LESSON_CONTENT_BLOCK_TYPES)[number];

export type LessonSubjectMode =
  | "general"
  | "ghanaian_language"
  | "mathematics"
  | "science_visual"
  | "visual_heavy";

export type LessonLanguageMeta = {
  languageCode?: string;
  languageName?: string;
  dialectOrVariant?: string | null;
  supportLanguageCode?: string | null;
  mediumOfInstruction?:
    | "local_language_only"
    | "english_supported"
    | "bilingual"
    | "vocabulary_focus"
    | "pronunciation_focus";
  teacherApprovedSpelling?: boolean;
  requiresLanguageReview?: boolean;
  languageReviewStatus?:
    | "not_required"
    | "needs_review"
    | "approved"
    | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  vocabularyItems?: Array<{
    word: string;
    meaningEnglish?: string;
    pronunciationHint?: string;
    exampleSentence?: string;
  }>;
};

export type LessonMathMeta = {
  format?: "latex" | "mathml" | "plain";
  latex?: string | null;
  mathml?: string | null;
  plainText?: string | null;
  renderMode?: "inline" | "block" | "step";
  mathKind?:
    | "fraction"
    | "equation"
    | "expression"
    | "geometry"
    | "graph"
    | "number_line"
    | "table"
    | "worked_solution";
  validationStatus?: "valid" | "invalid" | "not_checked";
  validationMessage?: string | null;
  steps?: Array<{
    title?: string;
    latex?: string;
    plainText?: string;
    bodyHtml?: string;
  }>;
};

export type LessonAssetMeta = {
  assetKind?:
    | "diagram"
    | "illustration"
    | "audio"
    | "video"
    | "teacher_upload"
    | "approved_library"
    | "ai_generated";
  assetStatus?:
    | "planned"
    | "missing"
    | "draft"
    | "needs_review"
    | "approved"
    | "rejected";
  source?: "system" | "teacher" | "ai" | "library";
  altText?: string | null;
  caption?: string | null;
  required?: boolean;
  generationPrompt?: string | null;
  uploadThingKey?: string | null;
};

export type LessonReviewMeta = {
  aiReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  languageReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  mathReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  assetReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  accessibilityReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};

export type LessonAccessibilityMeta = {
  altText?: string | null;
  caption?: string | null;
  transcript?: string | null;
};

export type LessonDiagramType =
  | "fraction_bar"
  | "fraction_circle"
  | "number_line"
  | "angle"
  | "simple_shape"
  | "flowchart"
  | "labelled_process";

export type LessonDiagramMeta = {
  diagramType?: LessonDiagramType;
  data?: Record<string, unknown>;
};

export type LessonContentBlock = {
  id: string;
  type: LessonContentBlockType;
  title?: string | null;
  bodyHtml: string;
  order: number;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
  teacherReviewed: boolean;
  resourceUrl?: string | null;

  subjectMode?: LessonSubjectMode;
  languageMeta?: LessonLanguageMeta | null;
  mathMeta?: LessonMathMeta | null;
  assetMeta?: LessonAssetMeta | null;
  reviewMeta?: LessonReviewMeta | null;
  accessibilityMeta?: LessonAccessibilityMeta | null;
  diagramMeta?: LessonDiagramMeta | null;
};

export const LESSON_CONTENT_BLOCK_LABELS: Record<LessonContentBlockType, string> = {
  explanation: "Explanation",
  example: "Example",
  activity: "Activity",
  discussion: "Discussion",
  check: "Quick check",
  resource_embed: "Resource",
  exit_ticket: "Exit ticket",
  teacher_note: "Teacher note",
  did_you_know: "Did you know",
  bilingual_text: "Bilingual text",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  math_expression: "Math expression",
  worked_example: "Worked example",
  diagram: "Diagram",
  illustration: "Illustration",
  audio: "Audio",
  asset_plan: "Asset plan",
};

export const TEACHER_ONLY_LESSON_BLOCK_TYPES: LessonContentBlockType[] = [
  "teacher_note",
  "asset_plan",
];

export function isAdvancedLessonBlockType(type: LessonContentBlockType): boolean {
  return (ADVANCED_LESSON_CONTENT_BLOCK_TYPES as readonly string[]).includes(type);
}

export function isTeacherOnlyLessonBlockType(type: LessonContentBlockType): boolean {
  return TEACHER_ONLY_LESSON_BLOCK_TYPES.includes(type);
}

export type LessonSessionAiMetadata = {
  leoGeneratedAt?: string | null;
  teacherReviewedAllAi?: boolean;
};

export type StudentNotebookNotesDto = {
  contentHtml: string;
  publishedAt: string;
  aiGenerated: boolean;
};

/** Stable student/mobile payload for published sessions */
export type StudentLessonSessionContentDto = {
  sessionId: string;
  title: string;
  contentVersion: number;
  scheduledDate: string;
  blocks: Array<{
    id: string;
    type: LessonContentBlockType;
    title: string | null;
    bodyHtml: string;
    order: number;
    estimatedMinutes: number | null;
    resourceUrl?: string | null;
    mathMeta?: Pick<LessonMathMeta, "latex" | "plainText" | "renderMode"> | null;
    accessibilityMeta?: Pick<LessonAccessibilityMeta, "altText" | "caption"> | null;
    diagramMeta?: LessonDiagramMeta | null;
  }>;
  notebookNotes?: StudentNotebookNotesDto | null;
};

export type WeekSplitSessionProposal = {
  timetableSlotId: string;
  timetableSlotIds?: string[];
  scheduledDate?: string;
  sequenceInWeek: number;
  title: string;
  noteSectionKeys: string[];
  schemeItemIds: string[];
  coverageWeight: number;
  focusSummary?: string;
};

export type ProposeWeekSplitResponse = {
  success: boolean;
  isDraft?: boolean;
  disclaimer?: string;
  error?: string;
  data?: {
    sessions: WeekSplitSessionProposal[];
  };
};

export type GenerateSessionContentResponse = {
  success: boolean;
  isDraft?: boolean;
  disclaimer?: string;
  error?: string;
  data?: {
    contentBlocks: LessonContentBlock[];
  };
};

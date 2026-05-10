import type {
  EXAM_PAPER_OWNER_ROLES,
  EXAM_PAPER_SCOPES,
  EXAM_PAPER_SOURCE_MODES,
  EXAM_PAPER_STATUSES,
  EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES,
  EXAM_QUESTION_ATTACHMENT_TYPES,
  EXAM_QUESTION_DIFFICULTIES,
  EXAM_QUESTION_SOURCES,
  EXAM_QUESTION_TYPES,
  EXAM_REVIEW_DECISIONS,
  QUESTION_BANK_ITEM_SOURCES,
  QUESTION_BANK_ITEM_STATUSES,
} from "@/constants/examinations";

export type ExamQuestionType = (typeof EXAM_QUESTION_TYPES)[number];
export type ExamQuestionDifficulty =
  (typeof EXAM_QUESTION_DIFFICULTIES)[number];
export type ExamPaperStatus = (typeof EXAM_PAPER_STATUSES)[number];
export type ExamPaperScope = (typeof EXAM_PAPER_SCOPES)[number];
export type ExamPaperOwnerRole = (typeof EXAM_PAPER_OWNER_ROLES)[number];
export type ExamPaperSourceMode = (typeof EXAM_PAPER_SOURCE_MODES)[number];
export type ExamQuestionSource = (typeof EXAM_QUESTION_SOURCES)[number];
export type ExamQuestionAttachmentType =
  (typeof EXAM_QUESTION_ATTACHMENT_TYPES)[number];
export type ExamQuestionAttachmentDisplayMode =
  (typeof EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES)[number];
export type QuestionBankItemStatus =
  (typeof QUESTION_BANK_ITEM_STATUSES)[number];
export type QuestionBankItemSource =
  (typeof QUESTION_BANK_ITEM_SOURCES)[number];
export type ExamReviewDecision = (typeof EXAM_REVIEW_DECISIONS)[number];

export type ExamQuestionOption = {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
};

export type ExamSubQuestion = {
  label: string;
  prompt: string;
  marks: number;
  expectedAnswer?: string;
  markingGuide?: string;
};

export type ExamQuestionAttachment = {
  id: string;
  type: ExamQuestionAttachmentType;
  url: string;
  uploadKey?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  altText?: string;
  displayMode: ExamQuestionAttachmentDisplayMode;
};

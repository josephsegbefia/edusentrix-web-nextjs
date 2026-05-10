import { z } from "zod";
import {
  EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES,
  EXAM_QUESTION_ATTACHMENT_TYPES,
  EXAM_QUESTION_DIFFICULTIES,
  EXAM_QUESTION_SOURCES,
  EXAM_QUESTION_TYPES,
} from "@/constants/examinations";

export const SectionCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(4000).nullable().optional(),
  order: z.number().int().min(0).optional(),
  marks: z.number().min(0).default(0),
});

export const SectionPatchSchema = SectionCreateSchema.partial();

const QuestionOptionSchema = z.object({
  id: z.string().trim().max(40).optional(),
  label: z.string().trim().min(1).max(12),
  text: z.string().trim().min(1).max(8000),
  isCorrect: z.boolean().optional(),
});

const SubQuestionSchema = z.object({
  label: z.string().trim().min(1).max(20),
  prompt: z.string().trim().min(1).max(12000),
  marks: z.number().min(0).default(0),
  expectedAnswer: z.string().trim().max(20000).nullable().optional(),
  markingGuide: z.string().trim().max(20000).nullable().optional(),
});

const QuestionAttachmentSchema = z.object({
  id: z.string().trim().max(80).optional(),
  type: z.enum(EXAM_QUESTION_ATTACHMENT_TYPES).default("image"),
  url: z.string().trim().min(1).max(4000),
  uploadKey: z.string().trim().max(1000).nullable().optional(),
  fileName: z.string().trim().max(500).nullable().optional(),
  mimeType: z.string().trim().max(200).nullable().optional(),
  caption: z.string().trim().max(1000).nullable().optional(),
  altText: z.string().trim().max(1000).nullable().optional(),
  displayMode: z.enum(EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES).default("above_question"),
});

export const QuestionCreateSchema = z.object({
  sectionId: z.string().trim().min(1).nullable().optional(),
  questionBankItemId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(EXAM_QUESTION_TYPES),
  prompt: z.string().trim().min(1).max(30000),
  plainTextPrompt: z.string().trim().max(30000).nullable().optional(),
  options: z.array(QuestionOptionSchema).default([]),
  subQuestions: z.array(SubQuestionSchema).default([]),
  marks: z.number().min(0).default(1),
  difficulty: z.enum(EXAM_QUESTION_DIFFICULTIES).default("medium"),
  topic: z.string().trim().max(240).nullable().optional(),
  subtopic: z.string().trim().max(240).nullable().optional(),
  curriculumNodeIds: z.array(z.string().trim().min(1)).default([]),
  schemeItemIds: z.array(z.string().trim().min(1)).default([]),
  lessonIds: z.array(z.string().trim().min(1)).default([]),
  lessonNoteIds: z.array(z.string().trim().min(1)).default([]),
  expectedAnswer: z.string().trim().max(30000).nullable().optional(),
  markingGuide: z.string().trim().max(30000).nullable().optional(),
  explanation: z.string().trim().max(20000).nullable().optional(),
  attachments: z.array(QuestionAttachmentSchema).default([]),
  order: z.number().int().min(0).optional(),
  source: z.enum(EXAM_QUESTION_SOURCES).default("manual"),
});

export const QuestionPatchSchema = QuestionCreateSchema.omit({
  questionBankItemId: true,
  source: true,
}).partial();

export const ReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        order: z.number().int().min(0),
        sectionId: z.string().trim().min(1).nullable().optional(),
      })
    )
    .min(1),
});

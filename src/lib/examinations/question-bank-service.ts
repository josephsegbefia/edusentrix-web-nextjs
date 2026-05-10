import { z } from "zod";
import { Types } from "mongoose";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import {
  QUESTION_BANK_ITEM_SOURCES,
  QUESTION_BANK_ITEM_STATUSES,
} from "@/constants/examinations";
import {
  QuestionCreateSchema,
  QuestionPatchSchema,
} from "@/lib/examinations/builder-schemas";
import {
  assertEditablePaper,
  assertSectionBelongsToPaper,
  nextQuestionOrder,
  normalizeEmbeddedQuestionItems,
  parseBuilderId,
  recalculateExamPaperMarks,
} from "@/lib/examinations/builder-service";
import { teacherCanEditExamPaper } from "@/lib/examinations/paper-access";
import { serializeQuestionBankItem } from "@/lib/examinations/serializers";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamQuestion } from "@/models/ExamQuestion";
import { Grade } from "@/models/Grade";
import { QuestionBankItem } from "@/models/QuestionBankItem";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import type { TeacherContext } from "@/lib/auth/requireTeacher";

export const QuestionBankCreateSchema = QuestionCreateSchema.extend({
  subjectId: z.string().trim().min(1),
  gradeId: z.string().trim().min(1),
  classGroupIds: z.array(z.string().trim().min(1)).default([]),
  curriculumId: z.string().trim().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  status: z.enum(QUESTION_BANK_ITEM_STATUSES).optional(),
  source: z.enum(QUESTION_BANK_ITEM_SOURCES).default("manual"),
}).omit({ sectionId: true, questionBankItemId: true, order: true });

export const QuestionBankPatchSchema = QuestionPatchSchema.extend({
  subjectId: z.string().trim().min(1).optional(),
  gradeId: z.string().trim().min(1).optional(),
  classGroupIds: z.array(z.string().trim().min(1)).optional(),
  curriculumId: z.string().trim().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).optional(),
  status: z.enum(QUESTION_BANK_ITEM_STATUSES).optional(),
});

export const QuestionBankReuseSchema = z.object({
  examPaperId: z.string().trim().min(1),
  sectionId: z.string().trim().min(1).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export async function requireQuestionBankActor() {
  const member = await requireSchoolMember({
    allowedRoles: ["school_admin", "teacher", "staff"],
  });
  const teacher = await Teacher.findOne({
    userId: member.userId,
    schoolId: member.schoolId,
  })
    .select("_id")
    .lean();
  return {
    schoolId: member.schoolId,
    userId: member.userId,
    roles: member.roles,
    isAdmin: member.isAdmin,
    teacherId: teacher?._id ?? null,
  };
}

export function objectIdOrError(value: string, label: string) {
  const parsed = parseBuilderId(value);
  if (!parsed) throw new Error(`${label} is invalid`);
  return parsed;
}

export function compactObjectIds(values: string[], label: string) {
  return Array.from(new Set(values)).map((value) => objectIdOrError(value, label));
}

export async function validateQuestionBankAcademicRefs(input: {
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  gradeId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
}) {
  const [subject, grade] = await Promise.all([
    Subject.exists({ _id: input.subjectId, schoolId: input.schoolId, isActive: true }),
    Grade.exists({ _id: input.gradeId, schoolId: input.schoolId, isActive: true }),
  ]);
  if (!subject) throw new Error("Subject was not found for this school");
  if (!grade) throw new Error("Grade was not found for this school");

  if (input.classGroupIds.length > 0) {
    const count = await ClassGroup.countDocuments({
      _id: { $in: input.classGroupIds },
      schoolId: input.schoolId,
      gradeId: input.gradeId,
      isActive: true,
    });
    if (count !== input.classGroupIds.length) {
      throw new Error("One or more class groups do not belong to the selected grade");
    }
  }
}

export function questionBankStatusForActor(
  requestedStatus: string | undefined,
  isAdmin: boolean
) {
  if (!requestedStatus) return isAdmin ? "curated" : "draft";
  if (!isAdmin && ["approved", "curated"].includes(requestedStatus)) return "draft";
  return requestedStatus;
}

export async function reuseQuestionBankItem(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  teacherContext?: TeacherContext;
  questionBankItemId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  sectionId?: Types.ObjectId | null;
  order?: number;
}) {
  const item = await QuestionBankItem.findOne({
    _id: input.questionBankItemId,
    schoolId: input.schoolId,
    status: { $ne: "archived" },
  });
  if (!item) return { status: 404, error: "Question bank item not found" } as const;

  const access = await assertEditablePaper({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  });
  if ("error" in access) return access;
  if (
    input.teacherContext &&
    !teacherCanEditExamPaper(access.paper, input.teacherContext)
  ) {
    return { status: 403, error: "Forbidden" } as const;
  }

  await assertSectionBelongsToPaper({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
    sectionId: input.sectionId ?? null,
  });

  const question = await ExamQuestion.create({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
    sectionId: input.sectionId ?? null,
    questionBankItemId: item._id,
    type: item.type,
    prompt: item.prompt,
    plainTextPrompt: item.plainTextPrompt ?? null,
    options: item.options,
    subQuestions: item.subQuestions,
    marks: item.marks,
    difficulty:
      item.performanceDifficulty ||
      item.teacherIntendedDifficulty ||
      item.aiEstimatedDifficulty ||
      "medium",
    topic: item.topic ?? null,
    subtopic: item.subtopic ?? null,
    curriculumNodeIds: item.curriculumNodeIds,
    schemeItemIds: item.schemeItemIds,
    lessonIds: item.lessonIds,
    lessonNoteIds: item.lessonNoteIds,
    expectedAnswer: item.expectedAnswer ?? null,
    markingGuide: item.markingGuide ?? null,
    explanation: item.explanation ?? null,
    attachments: item.attachments,
    order:
      input.order ??
      (await nextQuestionOrder({
        schoolId: input.schoolId,
        examPaperId: input.examPaperId,
        sectionId: input.sectionId ?? null,
      })),
    createdBy: input.userId,
    teacherId: input.teacherContext?.teacherId ?? item.originalTeacherId ?? null,
    source: "question_bank",
  });

  await QuestionBankItem.updateOne(
    { _id: item._id, schoolId: input.schoolId },
    {
      $inc: { usedCount: 1 },
      $set: { lastUsedExamPaperId: input.examPaperId },
      $setOnInsert: { firstUsedExamPaperId: input.examPaperId },
    }
  );
  if (!item.firstUsedExamPaperId) {
    item.firstUsedExamPaperId = input.examPaperId;
    await item.save();
  }
  await recalculateExamPaperMarks({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  });
  return { question } as const;
}

export async function createQuestionBankItemsFromExam(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  examPaperId: Types.ObjectId;
  isAdmin: boolean;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  }).lean();
  if (!paper) return { status: 404, error: "Exam paper not found" } as const;

  const questions = await ExamQuestion.find({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  })
    .sort({ sectionId: 1, order: 1, createdAt: 1 })
    .lean();

  const created = await QuestionBankItem.insertMany(
    questions.map((question) => ({
      schoolId: input.schoolId,
      subjectId: paper.subjectId,
      gradeId: paper.gradeId,
      classGroupIds: paper.classGroupIds,
      curriculumNodeIds: question.curriculumNodeIds,
      schemeItemIds: question.schemeItemIds,
      lessonIds: question.lessonIds,
      lessonNoteIds: question.lessonNoteIds,
      type: question.type,
      prompt: question.prompt,
      plainTextPrompt: question.plainTextPrompt ?? null,
      options: question.options,
      subQuestions: question.subQuestions,
      marks: question.marks,
      teacherIntendedDifficulty: question.difficulty,
      topic: question.topic ?? null,
      subtopic: question.subtopic ?? null,
      tags: [],
      expectedAnswer: question.expectedAnswer ?? null,
      markingGuide: question.markingGuide ?? null,
      explanation: question.explanation ?? null,
      attachments: question.attachments,
      createdBy: input.userId,
      originalTeacherId: question.teacherId ?? input.teacherId ?? null,
      firstUsedExamPaperId: input.examPaperId,
      lastUsedExamPaperId: input.examPaperId,
      usedCount: 1,
      source: "past_exam",
      status: input.isAdmin ? "curated" : "draft",
    })),
    { ordered: false }
  );

  return { data: created.map((item) => serializeQuestionBankItem(item.toObject())) } as const;
}

export function normalizeQuestionBankEmbeddedItems<T extends { id?: string }>(
  items: T[]
) {
  return normalizeEmbeddedQuestionItems(items);
}

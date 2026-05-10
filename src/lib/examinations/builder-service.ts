import { randomUUID } from "crypto";
import { Types } from "mongoose";
import {
  serializeExamPaperSection,
  serializeExamQuestion,
} from "@/lib/examinations/serializers";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";

export function parseBuilderId(value: string) {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

export async function assertEditablePaper(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  });
  if (!paper) return { status: 404, error: "Exam paper not found" } as const;
  if (!["draft", "needs_revision"].includes(paper.status)) {
    return {
      status: 409,
      error: "Only draft or revision-requested exam papers can be edited",
    } as const;
  }
  return { paper } as const;
}

export async function recalculateExamPaperMarks(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const result = await ExamQuestion.aggregate<{ total: number }>([
    { $match: { schoolId: input.schoolId, examPaperId: input.examPaperId } },
    { $group: { _id: null, total: { $sum: "$marks" } } },
  ]);
  const totalMarks = result[0]?.total ?? 0;
  await ExamPaper.updateOne(
    { _id: input.examPaperId, schoolId: input.schoolId },
    { $set: { totalMarks } }
  );
  return totalMarks;
}

export async function nextSectionOrder(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const latest = await ExamPaperSection.findOne({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  })
    .sort({ order: -1 })
    .select("order")
    .lean();
  return (latest?.order ?? -1) + 1;
}

export async function nextQuestionOrder(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  sectionId?: Types.ObjectId | null;
}) {
  const latest = await ExamQuestion.findOne({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
    sectionId: input.sectionId ?? null,
  })
    .sort({ order: -1 })
    .select("order")
    .lean();
  return (latest?.order ?? -1) + 1;
}

export async function assertSectionBelongsToPaper(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  sectionId?: Types.ObjectId | null;
}) {
  if (!input.sectionId) return true;
  const exists = await ExamPaperSection.exists({
    _id: input.sectionId,
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  });
  if (!exists) throw new Error("Section was not found on this exam paper");
  return true;
}

export function normalizeEmbeddedQuestionItems<T extends { id?: string }>(
  items: T[]
) {
  return items.map((item) => ({
    ...item,
    id: item.id || randomUUID(),
  }));
}

export function serializeSectionDocument(doc: unknown) {
  return serializeExamPaperSection(doc as Parameters<typeof serializeExamPaperSection>[0]);
}

export function serializeQuestionDocument(doc: unknown) {
  return serializeExamQuestion(doc as Parameters<typeof serializeExamQuestion>[0]);
}

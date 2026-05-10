import type { Types } from "mongoose";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperReview } from "@/models/ExamPaperReview";
import { ExamQuestion } from "@/models/ExamQuestion";

export async function submitExamPaper(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  userId: Types.ObjectId;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  });
  if (!paper) return { status: 404, error: "Exam paper not found" } as const;
  if (!["draft", "needs_revision"].includes(paper.status)) {
    return {
      status: 409,
      error: "Only draft or revision-requested papers can be submitted",
    } as const;
  }

  const questionCount = await ExamQuestion.countDocuments({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
  });
  if (questionCount < 1) {
    return {
      status: 409,
      error: "Add at least one question before submitting this exam paper",
    } as const;
  }

  paper.status = "submitted";
  paper.submittedAt = new Date();
  await paper.save();
  return { paper } as const;
}

export async function approveExamPaper(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  userId: Types.ObjectId;
  comment?: string | null;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  });
  if (!paper) return { status: 404, error: "Exam paper not found" } as const;
  if (!["submitted", "needs_revision"].includes(paper.status)) {
    return {
      status: 409,
      error: "Only submitted or revision-requested papers can be approved",
    } as const;
  }

  paper.status = "approved";
  paper.approvedAt = new Date();
  paper.approvedBy = input.userId;
  await paper.save();

  await ExamPaperReview.create({
    schoolId: input.schoolId,
    examPaperId: input.examPaperId,
    reviewerId: input.userId,
    decision: "approved",
    comment: input.comment || null,
  });

  return { paper } as const;
}

export async function completeExamPaper(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  });
  if (!paper) return { status: 404, error: "Exam paper not found" } as const;
  if (!["approved", "printed"].includes(paper.status)) {
    return {
      status: 409,
      error: "Only approved or printed papers can be completed",
    } as const;
  }

  paper.status = "completed";
  paper.completedAt = new Date();
  await paper.save();
  return { paper } as const;
}

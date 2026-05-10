import type { Types } from "mongoose";
import type { IExamPaper } from "@/models/ExamPaper";
import type { IExamPaperSection } from "@/models/ExamPaperSection";
import type { IExamQuestion } from "@/models/ExamQuestion";
import type { IExamType } from "@/models/ExamType";
import type { IQuestionBankItem } from "@/models/QuestionBankItem";

function id(value?: Types.ObjectId | string | null): string | null {
  return value ? String(value) : null;
}

function date(value?: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function serializeExamType(examType: Partial<IExamType>) {
  return {
    id: id(examType._id),
    schoolId: id(examType.schoolId),
    name: examType.name,
    description: examType.description ?? null,
    requiresApproval: examType.requiresApproval ?? true,
    appearsOnReportCard: examType.appearsOnReportCard ?? false,
    contributesToFinalGrade: examType.contributesToFinalGrade ?? false,
    canBePrinted: examType.canBePrinted ?? true,
    allowCandidateNumbers: examType.allowCandidateNumbers ?? true,
    allowAnswerSheet: examType.allowAnswerSheet ?? false,
    allowedQuestionTypes: examType.allowedQuestionTypes ?? [],
    status: examType.status ?? "active",
    createdAt: date(examType.createdAt),
    updatedAt: date(examType.updatedAt),
  };
}

export function serializeExamPaper(paper: Partial<IExamPaper>) {
  return {
    id: id(paper._id),
    schoolId: id(paper.schoolId),
    title: paper.title,
    examTypeId: id(paper.examTypeId),
    academicYearId: id(paper.academicYearId),
    termId: id(paper.termId),
    academicPeriodId: id(paper.academicPeriodId),
    scope: paper.scope ?? "class_group",
    gradeId: id(paper.gradeId),
    classGroupId: id(paper.classGroupId),
    classGroupIds: (paper.classGroupIds ?? []).map((value) => String(value)),
    subjectId: id(paper.subjectId),
    teacherId: id(paper.teacherId),
    leadSetterId: id(paper.leadSetterId),
    contributorIds: (paper.contributorIds ?? []).map((value) => String(value)),
    setBy: id(paper.setBy),
    createdBy: id(paper.createdBy),
    ownerRole: paper.ownerRole ?? "teacher",
    durationMinutes: paper.durationMinutes ?? null,
    totalMarks: paper.totalMarks ?? 0,
    instructions: paper.instructions ?? null,
    candidateInstructions: paper.candidateInstructions ?? null,
    status: paper.status ?? "draft",
    sourceMode: paper.sourceMode ?? "manual",
    scheduledExamDate: date(paper.scheduledExamDate),
    submittedAt: date(paper.submittedAt),
    approvedAt: date(paper.approvedAt),
    approvedBy: id(paper.approvedBy),
    completedAt: date(paper.completedAt),
    archivedAt: date(paper.archivedAt),
    createdAt: date(paper.createdAt),
    updatedAt: date(paper.updatedAt),
  };
}

export function serializeExamPaperSection(section: Partial<IExamPaperSection>) {
  return {
    id: id(section._id),
    schoolId: id(section.schoolId),
    examPaperId: id(section.examPaperId),
    title: section.title,
    instructions: section.instructions ?? null,
    order: section.order ?? 0,
    marks: section.marks ?? 0,
    createdAt: date(section.createdAt),
    updatedAt: date(section.updatedAt),
  };
}

export function serializeExamQuestion(question: Partial<IExamQuestion>) {
  return {
    id: id(question._id),
    schoolId: id(question.schoolId),
    examPaperId: id(question.examPaperId),
    sectionId: id(question.sectionId),
    questionBankItemId: id(question.questionBankItemId),
    type: question.type,
    prompt: question.prompt,
    plainTextPrompt: question.plainTextPrompt ?? null,
    options: question.options ?? [],
    subQuestions: question.subQuestions ?? [],
    marks: question.marks ?? 0,
    difficulty: question.difficulty ?? "medium",
    topic: question.topic ?? null,
    subtopic: question.subtopic ?? null,
    curriculumNodeIds: (question.curriculumNodeIds ?? []).map((value) =>
      String(value)
    ),
    schemeItemIds: (question.schemeItemIds ?? []).map((value) => String(value)),
    lessonIds: (question.lessonIds ?? []).map((value) => String(value)),
    lessonNoteIds: (question.lessonNoteIds ?? []).map((value) => String(value)),
    expectedAnswer: question.expectedAnswer ?? null,
    markingGuide: question.markingGuide ?? null,
    explanation: question.explanation ?? null,
    attachments: question.attachments ?? [],
    order: question.order ?? 0,
    createdBy: id(question.createdBy),
    teacherId: id(question.teacherId),
    source: question.source ?? "manual",
    createdAt: date(question.createdAt),
    updatedAt: date(question.updatedAt),
  };
}

export function serializeQuestionBankItem(item: Partial<IQuestionBankItem>) {
  return {
    id: id(item._id),
    schoolId: id(item.schoolId),
    subjectId: id(item.subjectId),
    gradeId: id(item.gradeId),
    classGroupIds: (item.classGroupIds ?? []).map((value) => String(value)),
    curriculumId: id(item.curriculumId),
    curriculumNodeIds: (item.curriculumNodeIds ?? []).map((value) =>
      String(value)
    ),
    schemeItemIds: (item.schemeItemIds ?? []).map((value) => String(value)),
    lessonIds: (item.lessonIds ?? []).map((value) => String(value)),
    lessonNoteIds: (item.lessonNoteIds ?? []).map((value) => String(value)),
    type: item.type,
    prompt: item.prompt,
    plainTextPrompt: item.plainTextPrompt ?? null,
    options: item.options ?? [],
    subQuestions: item.subQuestions ?? [],
    marks: item.marks ?? 0,
    teacherIntendedDifficulty: item.teacherIntendedDifficulty ?? null,
    aiEstimatedDifficulty: item.aiEstimatedDifficulty ?? null,
    performanceDifficulty: item.performanceDifficulty ?? null,
    topic: item.topic ?? null,
    subtopic: item.subtopic ?? null,
    tags: item.tags ?? [],
    expectedAnswer: item.expectedAnswer ?? null,
    markingGuide: item.markingGuide ?? null,
    explanation: item.explanation ?? null,
    attachments: item.attachments ?? [],
    createdBy: id(item.createdBy),
    originalTeacherId: id(item.originalTeacherId),
    firstUsedExamPaperId: id(item.firstUsedExamPaperId),
    lastUsedExamPaperId: id(item.lastUsedExamPaperId),
    usedCount: item.usedCount ?? 0,
    source: item.source ?? "manual",
    status: item.status ?? "draft",
    createdAt: date(item.createdAt),
    updatedAt: date(item.updatedAt),
  };
}

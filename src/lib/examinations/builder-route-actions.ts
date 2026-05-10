import type { Types } from "mongoose";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import { teacherCanEditExamPaper } from "@/lib/examinations/paper-access";
import {
  QuestionCreateSchema,
  QuestionPatchSchema,
  ReorderSchema,
  SectionCreateSchema,
  SectionPatchSchema,
} from "@/lib/examinations/builder-schemas";
import {
  assertEditablePaper,
  assertSectionBelongsToPaper,
  nextQuestionOrder,
  nextSectionOrder,
  normalizeEmbeddedQuestionItems,
  parseBuilderId,
  recalculateExamPaperMarks,
  serializeQuestionDocument,
  serializeSectionDocument,
} from "@/lib/examinations/builder-service";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";

type ActorInput = {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  teacherContext?: TeacherContext;
};

async function ensureEditable(actor: ActorInput, examPaperId: Types.ObjectId) {
  const result = await assertEditablePaper({
    schoolId: actor.schoolId,
    examPaperId,
  });
  if ("error" in result) return result;
  if (
    actor.teacherContext &&
    !teacherCanEditExamPaper(result.paper, actor.teacherContext)
  ) {
    return { status: 403, error: "Forbidden" } as const;
  }
  return result;
}

export async function createSectionAction(
  req: Request,
  actor: ActorInput,
  examPaperId: Types.ObjectId
) {
  const access = await ensureEditable(actor, examPaperId);
  if ("error" in access) return access;

  const parsed = SectionCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }

  const section = await ExamPaperSection.create({
    schoolId: actor.schoolId,
    examPaperId,
    title: parsed.data.title,
    instructions: parsed.data.instructions ?? null,
    order:
      parsed.data.order ??
      (await nextSectionOrder({ schoolId: actor.schoolId, examPaperId })),
    marks: parsed.data.marks,
  });

  return { data: serializeSectionDocument(section.toObject()) } as const;
}

export async function patchSectionAction(
  req: Request,
  actor: ActorInput,
  sectionId: Types.ObjectId
) {
  const section = await ExamPaperSection.findOne({
    _id: sectionId,
    schoolId: actor.schoolId,
  });
  if (!section) return { status: 404, error: "Section not found" } as const;
  const access = await ensureEditable(actor, section.examPaperId);
  if ("error" in access) return access;

  const parsed = SectionPatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }

  if (parsed.data.title !== undefined) section.title = parsed.data.title;
  if (parsed.data.instructions !== undefined)
    section.instructions = parsed.data.instructions;
  if (parsed.data.order !== undefined) section.order = parsed.data.order;
  if (parsed.data.marks !== undefined) section.marks = parsed.data.marks;
  await section.save();
  return { data: serializeSectionDocument(section.toObject()) } as const;
}

export async function deleteSectionAction(
  actor: ActorInput,
  sectionId: Types.ObjectId
) {
  const section = await ExamPaperSection.findOne({
    _id: sectionId,
    schoolId: actor.schoolId,
  });
  if (!section) return { status: 404, error: "Section not found" } as const;
  const access = await ensureEditable(actor, section.examPaperId);
  if ("error" in access) return access;

  await Promise.all([
    ExamQuestion.updateMany(
      { schoolId: actor.schoolId, sectionId },
      { $set: { sectionId: null } }
    ),
    ExamPaperSection.deleteOne({ _id: sectionId, schoolId: actor.schoolId }),
  ]);
  return { data: true } as const;
}

export async function createQuestionAction(
  req: Request,
  actor: ActorInput,
  examPaperId: Types.ObjectId
) {
  const access = await ensureEditable(actor, examPaperId);
  if ("error" in access) return access;

  const parsed = QuestionCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }

  const sectionId = parsed.data.sectionId
    ? parseBuilderId(parsed.data.sectionId)
    : null;
  if (parsed.data.sectionId && !sectionId) {
    return { status: 400, error: "Invalid section id" } as const;
  }
  await assertSectionBelongsToPaper({
    schoolId: actor.schoolId,
    examPaperId,
    sectionId,
  });

  const question = await ExamQuestion.create({
    schoolId: actor.schoolId,
    examPaperId,
    sectionId,
    questionBankItemId: parsed.data.questionBankItemId
      ? parseBuilderId(parsed.data.questionBankItemId)
      : null,
    type: parsed.data.type,
    prompt: parsed.data.prompt,
    plainTextPrompt: parsed.data.plainTextPrompt ?? null,
    options: normalizeEmbeddedQuestionItems(parsed.data.options),
    subQuestions: parsed.data.subQuestions,
    marks: parsed.data.marks,
    difficulty: parsed.data.difficulty,
    topic: parsed.data.topic ?? null,
    subtopic: parsed.data.subtopic ?? null,
    curriculumNodeIds: parsed.data.curriculumNodeIds.map((id) => parseBuilderId(id)),
    schemeItemIds: parsed.data.schemeItemIds.map((id) => parseBuilderId(id)),
    lessonIds: parsed.data.lessonIds.map((id) => parseBuilderId(id)),
    lessonNoteIds: parsed.data.lessonNoteIds.map((id) => parseBuilderId(id)),
    expectedAnswer: parsed.data.expectedAnswer ?? null,
    markingGuide: parsed.data.markingGuide ?? null,
    explanation: parsed.data.explanation ?? null,
    attachments: normalizeEmbeddedQuestionItems(parsed.data.attachments),
    order:
      parsed.data.order ??
      (await nextQuestionOrder({ schoolId: actor.schoolId, examPaperId, sectionId })),
    createdBy: actor.userId,
    teacherId: actor.teacherContext?.teacherId ?? access.paper.leadSetterId ?? null,
    source: parsed.data.source,
  });

  await recalculateExamPaperMarks({ schoolId: actor.schoolId, examPaperId });
  return { data: serializeQuestionDocument(question.toObject()) } as const;
}

export async function patchQuestionAction(
  req: Request,
  actor: ActorInput,
  questionId: Types.ObjectId
) {
  const question = await ExamQuestion.findOne({
    _id: questionId,
    schoolId: actor.schoolId,
  });
  if (!question) return { status: 404, error: "Question not found" } as const;
  if (!question.examPaperId) {
    return { status: 409, error: "Question is not attached to an exam paper" } as const;
  }
  const access = await ensureEditable(actor, question.examPaperId);
  if ("error" in access) return access;

  const parsed = QuestionPatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }

  if (parsed.data.sectionId !== undefined) {
    const sectionId = parsed.data.sectionId ? parseBuilderId(parsed.data.sectionId) : null;
    if (parsed.data.sectionId && !sectionId) {
      return { status: 400, error: "Invalid section id" } as const;
    }
    await assertSectionBelongsToPaper({
      schoolId: actor.schoolId,
      examPaperId: question.examPaperId,
      sectionId,
    });
    question.sectionId = sectionId;
  }
  if (parsed.data.type !== undefined) question.type = parsed.data.type;
  if (parsed.data.prompt !== undefined) question.prompt = parsed.data.prompt;
  if (parsed.data.plainTextPrompt !== undefined)
    question.plainTextPrompt = parsed.data.plainTextPrompt;
  if (parsed.data.options !== undefined)
    question.options = normalizeEmbeddedQuestionItems(parsed.data.options);
  if (parsed.data.subQuestions !== undefined)
    question.subQuestions = parsed.data.subQuestions;
  if (parsed.data.marks !== undefined) question.marks = parsed.data.marks;
  if (parsed.data.difficulty !== undefined)
    question.difficulty = parsed.data.difficulty;
  if (parsed.data.topic !== undefined) question.topic = parsed.data.topic;
  if (parsed.data.subtopic !== undefined) question.subtopic = parsed.data.subtopic;
  if (parsed.data.expectedAnswer !== undefined)
    question.expectedAnswer = parsed.data.expectedAnswer;
  if (parsed.data.markingGuide !== undefined)
    question.markingGuide = parsed.data.markingGuide;
  if (parsed.data.explanation !== undefined)
    question.explanation = parsed.data.explanation;
  if (parsed.data.attachments !== undefined)
    question.attachments = normalizeEmbeddedQuestionItems(parsed.data.attachments);
  if (parsed.data.order !== undefined) question.order = parsed.data.order;

  await question.save();
  await recalculateExamPaperMarks({
    schoolId: actor.schoolId,
    examPaperId: question.examPaperId,
  });
  return { data: serializeQuestionDocument(question.toObject()) } as const;
}

export async function deleteQuestionAction(
  actor: ActorInput,
  questionId: Types.ObjectId
) {
  const question = await ExamQuestion.findOne({
    _id: questionId,
    schoolId: actor.schoolId,
  });
  if (!question) return { status: 404, error: "Question not found" } as const;
  if (!question.examPaperId) {
    return { status: 409, error: "Question is not attached to an exam paper" } as const;
  }
  const access = await ensureEditable(actor, question.examPaperId);
  if ("error" in access) return access;
  const examPaperId = question.examPaperId;

  await ExamQuestion.deleteOne({ _id: questionId, schoolId: actor.schoolId });
  await recalculateExamPaperMarks({ schoolId: actor.schoolId, examPaperId });
  return { data: true } as const;
}

export async function reorderSectionsAction(
  req: Request,
  actor: ActorInput,
  examPaperId: Types.ObjectId
) {
  const access = await ensureEditable(actor, examPaperId);
  if ("error" in access) return access;
  const parsed = ReorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }
  await ExamPaperSection.bulkWrite(
    parsed.data.items.map((item) => ({
      updateOne: {
        filter: {
          _id: parseBuilderId(item.id),
          schoolId: actor.schoolId,
          examPaperId,
        },
        update: { $set: { order: item.order } },
      },
    }))
  );
  return { data: true } as const;
}

export async function reorderQuestionsAction(
  req: Request,
  actor: ActorInput,
  examPaperId: Types.ObjectId
) {
  const access = await ensureEditable(actor, examPaperId);
  if ("error" in access) return access;
  const parsed = ReorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return { status: 400, error: "Validation failed", issues: parsed.error.flatten() } as const;
  }
  await ExamQuestion.bulkWrite(
    parsed.data.items.map((item) => ({
      updateOne: {
        filter: {
          _id: parseBuilderId(item.id),
          schoolId: actor.schoolId,
          examPaperId,
        },
        update: {
          $set: {
            order: item.order,
            sectionId: item.sectionId ? parseBuilderId(item.sectionId) : null,
          },
        },
      },
    }))
  );
  return { data: true } as const;
}

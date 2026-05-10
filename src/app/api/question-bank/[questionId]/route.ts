import { connectToDatabase } from "@/db/connectToDatabase";
import {
  QuestionBankPatchSchema,
  compactObjectIds,
  objectIdOrError,
  questionBankStatusForActor,
  requireQuestionBankActor,
  validateQuestionBankAcademicRefs,
} from "@/lib/examinations/question-bank-service";
import {
  normalizeEmbeddedQuestionItems,
  parseBuilderId,
} from "@/lib/examinations/builder-service";
import { serializeQuestionBankItem } from "@/lib/examinations/serializers";
import { QuestionBankItem } from "@/models/QuestionBankItem";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();
    const { questionId } = await params;
    const itemId = parseBuilderId(questionId);
    if (!itemId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const item = await QuestionBankItem.findOne({
      _id: itemId,
      schoolId: actor.schoolId,
    }).lean();
    if (!item) {
      return Response.json({ success: false, error: "Question bank item not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: serializeQuestionBankItem(item) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch question bank item" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();
    const { questionId } = await params;
    const itemId = parseBuilderId(questionId);
    if (!itemId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const item = await QuestionBankItem.findOne({
      _id: itemId,
      schoolId: actor.schoolId,
    });
    if (!item) {
      return Response.json({ success: false, error: "Question bank item not found" }, { status: 404 });
    }

    const parsed = QuestionBankPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const nextSubjectId = parsed.data.subjectId
      ? objectIdOrError(parsed.data.subjectId, "Subject")
      : item.subjectId;
    const nextGradeId = parsed.data.gradeId
      ? objectIdOrError(parsed.data.gradeId, "Grade")
      : item.gradeId;
    const nextClassGroupIds = parsed.data.classGroupIds
      ? compactObjectIds(parsed.data.classGroupIds, "Class group")
      : item.classGroupIds;
    if (
      parsed.data.subjectId !== undefined ||
      parsed.data.gradeId !== undefined ||
      parsed.data.classGroupIds !== undefined
    ) {
      await validateQuestionBankAcademicRefs({
        schoolId: actor.schoolId,
        subjectId: nextSubjectId,
        gradeId: nextGradeId,
        classGroupIds: nextClassGroupIds,
      });
    }

    if (parsed.data.subjectId !== undefined) item.subjectId = nextSubjectId;
    if (parsed.data.gradeId !== undefined) item.gradeId = nextGradeId;
    if (parsed.data.classGroupIds !== undefined) item.classGroupIds = nextClassGroupIds;
    if (parsed.data.curriculumId !== undefined) {
      item.curriculumId = parsed.data.curriculumId
        ? objectIdOrError(parsed.data.curriculumId, "Curriculum")
        : null;
    }
    if (parsed.data.type !== undefined) item.type = parsed.data.type;
    if (parsed.data.prompt !== undefined) item.prompt = parsed.data.prompt;
    if (parsed.data.plainTextPrompt !== undefined)
      item.plainTextPrompt = parsed.data.plainTextPrompt;
    if (parsed.data.options !== undefined)
      item.options = normalizeEmbeddedQuestionItems(parsed.data.options);
    if (parsed.data.subQuestions !== undefined)
      item.subQuestions = parsed.data.subQuestions;
    if (parsed.data.marks !== undefined) item.marks = parsed.data.marks;
    if (parsed.data.difficulty !== undefined)
      item.teacherIntendedDifficulty = parsed.data.difficulty;
    if (parsed.data.topic !== undefined) item.topic = parsed.data.topic;
    if (parsed.data.subtopic !== undefined) item.subtopic = parsed.data.subtopic;
    if (parsed.data.expectedAnswer !== undefined)
      item.expectedAnswer = parsed.data.expectedAnswer;
    if (parsed.data.markingGuide !== undefined)
      item.markingGuide = parsed.data.markingGuide;
    if (parsed.data.explanation !== undefined)
      item.explanation = parsed.data.explanation;
    if (parsed.data.attachments !== undefined)
      item.attachments = normalizeEmbeddedQuestionItems(parsed.data.attachments);
    if (parsed.data.tags !== undefined) item.tags = Array.from(new Set(parsed.data.tags));
    if (parsed.data.status !== undefined) {
      item.status = questionBankStatusForActor(parsed.data.status, actor.isAdmin);
    }

    await item.save();
    return Response.json({ success: true, data: serializeQuestionBankItem(item.toObject()) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update question bank item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();
    const { questionId } = await params;
    const itemId = parseBuilderId(questionId);
    if (!itemId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    await QuestionBankItem.updateOne(
      { _id: itemId, schoolId: actor.schoolId },
      { $set: { status: "archived" } }
    );
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to archive question bank item" },
      { status: 500 }
    );
  }
}

import { connectToDatabase } from "@/db/connectToDatabase";
import {
  QuestionBankCreateSchema,
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

export async function GET(req: Request) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || "24"), 1),
      100
    );
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
    const subjectId = searchParams.get("subjectId");
    const gradeId = searchParams.get("gradeId");
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const tag = searchParams.get("tag");

    const filter: Record<string, unknown> = {
      schoolId: actor.schoolId,
      status: status || { $ne: "archived" },
    };
    if (subjectId) filter.subjectId = objectIdOrError(subjectId, "Subject");
    if (gradeId) filter.gradeId = objectIdOrError(gradeId, "Grade");
    if (type) filter.type = type;
    if (difficulty) {
      filter.$or = [
        { teacherIntendedDifficulty: difficulty },
        { aiEstimatedDifficulty: difficulty },
        { performanceDifficulty: difficulty },
      ];
    }
    if (tag) filter.tags = tag;
    if (q) {
      filter.$and = [
        {
          $or: [
            { prompt: { $regex: q, $options: "i" } },
            { topic: { $regex: q, $options: "i" } },
            { subtopic: { $regex: q, $options: "i" } },
            { tags: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      QuestionBankItem.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      QuestionBankItem.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: items.map(serializeQuestionBankItem),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch question bank" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();

    const parsed = QuestionBankCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const subjectId = objectIdOrError(parsed.data.subjectId, "Subject");
    const gradeId = objectIdOrError(parsed.data.gradeId, "Grade");
    const classGroupIds = compactObjectIds(parsed.data.classGroupIds, "Class group");
    await validateQuestionBankAcademicRefs({
      schoolId: actor.schoolId,
      subjectId,
      gradeId,
      classGroupIds,
    });

    const item = await QuestionBankItem.create({
      schoolId: actor.schoolId,
      subjectId,
      gradeId,
      classGroupIds,
      curriculumId: parsed.data.curriculumId
        ? objectIdOrError(parsed.data.curriculumId, "Curriculum")
        : null,
      curriculumNodeIds: compactObjectIds(parsed.data.curriculumNodeIds, "Curriculum node"),
      schemeItemIds: compactObjectIds(parsed.data.schemeItemIds, "Scheme item"),
      lessonIds: compactObjectIds(parsed.data.lessonIds, "Lesson"),
      lessonNoteIds: compactObjectIds(parsed.data.lessonNoteIds, "Lesson note"),
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      plainTextPrompt: parsed.data.plainTextPrompt ?? null,
      options: normalizeEmbeddedQuestionItems(parsed.data.options),
      subQuestions: parsed.data.subQuestions,
      marks: parsed.data.marks,
      teacherIntendedDifficulty: parsed.data.difficulty,
      topic: parsed.data.topic ?? null,
      subtopic: parsed.data.subtopic ?? null,
      tags: Array.from(new Set(parsed.data.tags)),
      expectedAnswer: parsed.data.expectedAnswer ?? null,
      markingGuide: parsed.data.markingGuide ?? null,
      explanation: parsed.data.explanation ?? null,
      attachments: normalizeEmbeddedQuestionItems(parsed.data.attachments),
      createdBy: actor.userId,
      originalTeacherId: actor.teacherId,
      source: parsed.data.source,
      status: questionBankStatusForActor(parsed.data.status, actor.isAdmin),
    });

    return Response.json(
      { success: true, data: serializeQuestionBankItem(item.toObject()) },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create question bank item" },
      { status: 500 }
    );
  }
}

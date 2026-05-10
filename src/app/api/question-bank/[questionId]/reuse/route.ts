import { connectToDatabase } from "@/db/connectToDatabase";
import {
  QuestionBankReuseSchema,
  objectIdOrError,
  requireQuestionBankActor,
  reuseQuestionBankItem,
} from "@/lib/examinations/question-bank-service";
import { serializeExamQuestion } from "@/lib/examinations/serializers";
import type { TeacherContext } from "@/lib/auth/requireTeacher";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();
    const { questionId } = await params;
    const parsed = QuestionBankReuseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (!actor.isAdmin && !actor.teacherId) {
      return Response.json({ success: false, error: "Teacher record not found" }, { status: 404 });
    }
    const teacherContext =
      !actor.isAdmin && actor.teacherId
        ? ({
            userId: actor.userId,
            teacherId: actor.teacherId,
            schoolId: actor.schoolId,
            isAdmin: false,
            roles: actor.roles,
            subroles: [],
            permissions: [],
          } as TeacherContext)
        : undefined;

    const result = await reuseQuestionBankItem({
      schoolId: actor.schoolId,
      userId: actor.userId,
      teacherContext,
      questionBankItemId: objectIdOrError(questionId, "Question bank item"),
      examPaperId: objectIdOrError(parsed.data.examPaperId, "Exam paper"),
      sectionId: parsed.data.sectionId
        ? objectIdOrError(parsed.data.sectionId, "Section")
        : null,
      order: parsed.data.order,
    });
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json(
      { success: true, data: serializeExamQuestion(result.question.toObject()) },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reuse question" },
      { status: 500 }
    );
  }
}

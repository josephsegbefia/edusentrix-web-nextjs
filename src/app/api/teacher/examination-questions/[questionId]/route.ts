import { connectToDatabase } from "@/db/connectToDatabase";
import { can } from "@/lib/auth/can";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  deleteQuestionAction,
  patchQuestionAction,
} from "@/lib/examinations/builder-route-actions";
import { parseBuilderId } from "@/lib/examinations/builder-service";
import { PERMISSIONS } from "@/lib/rbac";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examQuestionsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { questionId } = await params;
    const parsedQuestionId = parseBuilderId(questionId);
    if (!parsedQuestionId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const result = await patchQuestionAction(
      req,
      { schoolId: ctx.schoolId, userId: ctx.userId, teacherContext: ctx },
      parsedQuestionId
    );
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examQuestionsDelete)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { questionId } = await params;
    const parsedQuestionId = parseBuilderId(questionId);
    if (!parsedQuestionId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const result = await deleteQuestionAction(
      { schoolId: ctx.schoolId, userId: ctx.userId, teacherContext: ctx },
      parsedQuestionId
    );
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete question" },
      { status: 500 }
    );
  }
}

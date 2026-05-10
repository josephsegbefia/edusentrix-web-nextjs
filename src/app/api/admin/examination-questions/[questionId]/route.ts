import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  deleteQuestionAction,
  patchQuestionAction,
} from "@/lib/examinations/builder-route-actions";
import { parseBuilderId } from "@/lib/examinations/builder-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { questionId } = await params;
    const parsedQuestionId = parseBuilderId(questionId);
    if (!parsedQuestionId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const result = await patchQuestionAction(
      req,
      { schoolId: ctx.schoolId, userId: ctx.userId },
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
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { questionId } = await params;
    const parsedQuestionId = parseBuilderId(questionId);
    if (!parsedQuestionId) {
      return Response.json({ success: false, error: "Invalid question id" }, { status: 400 });
    }
    const result = await deleteQuestionAction(
      { schoolId: ctx.schoolId, userId: ctx.userId },
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

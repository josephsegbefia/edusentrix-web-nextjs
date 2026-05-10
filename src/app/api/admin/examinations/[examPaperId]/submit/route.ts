import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { submitExamPaper } from "@/lib/examinations/paper-lifecycle";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }

    const result = await submitExamPaper({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
      userId: ctx.userId,
    });
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit exam paper" },
      { status: 500 }
    );
  }
}

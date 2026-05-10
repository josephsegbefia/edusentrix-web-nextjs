import { connectToDatabase } from "@/db/connectToDatabase";
import { can } from "@/lib/auth/can";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { teacherCanViewExamPaper } from "@/lib/examinations/paper-access";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { completeExamPaper } from "@/lib/examinations/paper-lifecycle";
import { PERMISSIONS } from "@/lib/rbac";
import { ExamPaper } from "@/models/ExamPaper";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsComplete)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }
    const paper = await ExamPaper.findOne({ _id: paperId, schoolId: ctx.schoolId });
    if (!paper) return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    if (!teacherCanViewExamPaper(paper, ctx)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await completeExamPaper({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
    });
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to complete exam paper" },
      { status: 500 }
    );
  }
}

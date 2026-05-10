import { connectToDatabase } from "@/db/connectToDatabase";
import { can } from "@/lib/auth/can";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { teacherCanViewExamPaper } from "@/lib/examinations/paper-access";
import { buildExamPaperQuestionPdf } from "@/lib/examinations/exam-paper-pdf";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { PERMISSIONS } from "@/lib/rbac";
import { ExamPaper } from "@/models/ExamPaper";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsPrint)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }
    const paper = await ExamPaper.findOne({ _id: paperId, schoolId: ctx.schoolId }).lean();
    if (!paper) {
      return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    }
    if (!teacherCanViewExamPaper(paper, ctx)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const pdf = await buildExamPaperQuestionPdf({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
    });
    if (!pdf) {
      return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    }
    return new Response(Buffer.from(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to export exam paper" },
      { status: 500 }
    );
  }
}

import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { buildExamPaperQuestionPdf } from "@/lib/examinations/exam-paper-pdf";

export async function GET(
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
